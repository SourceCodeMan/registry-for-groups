"use server";

import crypto from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  claims,
  groupInvites,
  items,
  joinRequests,
  lists,
  member,
  organization,
  picks,
} from "@/db/schema";
import { requireUser, getMembership, isAdminRole } from "@/lib/session";
import { revokeInviteById } from "@/lib/invites";
import { searchGroups, isSlugTaken, type GroupSearchResult } from "@/lib/groups";
import { validateSlug } from "@/lib/slug";
import { joinLimiter, searchLimiter } from "@/lib/ratelimit";

export type ActionResult = { ok: boolean; error?: string };

/* ------------------------------ search ------------------------------- */

export async function searchGroupsAction(
  query: string,
): Promise<GroupSearchResult[]> {
  const user = await requireUser();
  if (!(await searchLimiter.limit(user.id)).success) return [];
  return searchGroups(query, user.id);
}

async function requireAdmin(userId: string, organizationId: string) {
  const m = await getMembership(userId, organizationId);
  return m && isAdminRole(m.role) ? m : null;
}

/* ----------------------------- vanity slug --------------------------- */

export async function updateGroupSlugAction(
  organizationId: string,
  rawSlug: string,
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const user = await requireUser();
  if (!(await requireAdmin(user.id, organizationId)))
    return { ok: false, error: "Only admins can change the group link." };

  const v = validateSlug(rawSlug);
  if (!v.ok) return { ok: false, error: v.error };
  if (await isSlugTaken(v.slug, organizationId))
    return { ok: false, error: "That link is already taken." };

  try {
    await db
      .update(organization)
      .set({ slug: v.slug })
      .where(eq(organization.id, organizationId));
  } catch {
    // Unique-index race — someone grabbed it first.
    return { ok: false, error: "That link is already taken." };
  }
  return { ok: true, slug: v.slug };
}

/* ------------------------------ invites ------------------------------ */

export async function revokeInviteAction(
  inviteId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const [inv] = await db
    .select({ org: groupInvites.organizationId })
    .from(groupInvites)
    .where(eq(groupInvites.id, inviteId))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (!(await requireAdmin(user.id, inv.org)))
    return { ok: false, error: "Only admins can revoke invites." };
  await revokeInviteById(inviteId, inv.org);
  return { ok: true };
}

/* --------------------------- remove member --------------------------- */

export async function removeMemberAction(
  organizationId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await requireAdmin(user.id, organizationId)))
    return { ok: false, error: "Only admins can remove members." };
  if (targetUserId === user.id)
    return { ok: false, error: "You can't remove yourself." };

  const target = await getMembership(targetUserId, organizationId);
  if (!target) return { ok: false, error: "They're not in this group." };

  if (isAdminRole(target.role)) {
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          inArray(member.role, ["owner", "admin"]),
        ),
      );
    if ((n ?? 0) <= 1)
      return { ok: false, error: "Can't remove the group's only admin." };
  }

  await db.transaction(async (tx) => {
    // Release the removed member's claims on items still in this group so those
    // gifts free up (their claims are on OTHER members' items).
    const claimRows = await tx
      .select({ id: claims.id })
      .from(claims)
      .innerJoin(items, eq(claims.itemId, items.id))
      .innerJoin(lists, eq(items.listId, lists.id))
      .where(
        and(
          eq(claims.buyerUserId, targetUserId),
          eq(claims.state, "reserved"),
          eq(lists.organizationId, organizationId),
        ),
      );
    if (claimRows.length) {
      await tx.delete(claims).where(
        inArray(
          claims.id,
          claimRows.map((c) => c.id),
        ),
      );
    }
    // Remove the member's own picks on this group's pick lists (their
    // selections) so they don't linger in anyone's results.
    const pickRows = await tx
      .select({ id: picks.id })
      .from(picks)
      .innerJoin(lists, eq(picks.listId, lists.id))
      .where(
        and(
          eq(picks.pickerUserId, targetUserId),
          eq(lists.organizationId, organizationId),
        ),
      );
    if (pickRows.length) {
      await tx.delete(picks).where(
        inArray(
          picks.id,
          pickRows.map((p) => p.id),
        ),
      );
    }
    // A pick list can't function without its group, so delete any the member
    // owns here (cascades their options + everyone's picks on them)...
    await tx
      .delete(lists)
      .where(
        and(
          eq(lists.ownerUserId, targetUserId),
          eq(lists.organizationId, organizationId),
          eq(lists.kind, "pick"),
        ),
      );
    // Release *other* members' reservations on the lists we're about to
    // detach (purchased rows stay as the audit of a real buy).
    const reservedOnOwned = await tx
      .select({ id: claims.id })
      .from(claims)
      .innerJoin(items, eq(claims.itemId, items.id))
      .innerJoin(lists, eq(items.listId, lists.id))
      .where(
        and(
          eq(lists.ownerUserId, targetUserId),
          eq(lists.organizationId, organizationId),
          eq(lists.kind, "wishlist"),
          eq(claims.state, "reserved"),
        ),
      );
    if (reservedOnOwned.length) {
      await tx.delete(claims).where(
        inArray(
          claims.id,
          reservedOnOwned.map((c) => c.id),
        ),
      );
    }
    // ...but keep their WISHLISTS — detach them to personal.
    await tx
      .update(lists)
      .set({ organizationId: null })
      .where(
        and(
          eq(lists.ownerUserId, targetUserId),
          eq(lists.organizationId, organizationId),
          eq(lists.kind, "wishlist"),
        ),
      );
    // Tidy any join-request history for this user/group.
    await tx
      .delete(joinRequests)
      .where(
        and(
          eq(joinRequests.organizationId, organizationId),
          eq(joinRequests.userId, targetUserId),
        ),
      );
    // Finally, remove the membership.
    await tx
      .delete(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, targetUserId),
        ),
      );
  });

  return { ok: true };
}

/* ---------------------------- promote member ------------------------- */

export async function promoteMemberAction(
  organizationId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await requireAdmin(user.id, organizationId)))
    return { ok: false, error: "Only admins can promote members." };

  const target = await getMembership(targetUserId, organizationId);
  if (!target) return { ok: false, error: "They're not in this group." };
  if (isAdminRole(target.role)) return { ok: true }; // already an admin

  await db
    .update(member)
    .set({ role: "admin" })
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, targetUserId),
      ),
    );
  return { ok: true };
}

/* ---------------------------- join requests -------------------------- */

export async function requestJoinAction(
  organizationId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await joinLimiter.limit(user.id)).success) {
    return { ok: false, error: "You've sent a lot of requests — try again later." };
  }
  if (await getMembership(user.id, organizationId))
    return { ok: false, error: "You're already in this group." };
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!org) return { ok: false, error: "Group not found." };

  const [existing] = await db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.organizationId, organizationId),
        eq(joinRequests.userId, user.id),
      ),
    )
    .limit(1);
  if (existing?.status === "pending") return { ok: true };
  if (existing?.status === "denied") {
    const at = existing.decidedAt?.getTime() ?? 0;
    if (Date.now() - at < 24 * 60 * 60 * 1000) {
      return {
        ok: false,
        error: "Your last request was declined. Try again tomorrow.",
      };
    }
  }

  await db
    .insert(joinRequests)
    .values({ organizationId, userId: user.id, status: "pending" })
    .onConflictDoUpdate({
      target: [joinRequests.organizationId, joinRequests.userId],
      set: {
        status: "pending",
        createdAt: new Date(),
        decidedAt: null,
        decidedByUserId: null,
      },
    });
  return { ok: true };
}

export async function approveJoinRequestAction(
  requestId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const [req] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!req || req.status !== "pending")
    return { ok: false, error: "Request not found." };
  if (!(await requireAdmin(user.id, req.organizationId)))
    return { ok: false, error: "Only admins can approve." };

  await db.transaction(async (tx) => {
    await tx
      .insert(member)
      .values({
        id: crypto.randomUUID(),
        organizationId: req.organizationId,
        userId: req.userId,
        role: "member",
        createdAt: new Date(),
      })
      .onConflictDoNothing({
        target: [member.organizationId, member.userId],
      });
    await tx
      .update(joinRequests)
      .set({ status: "approved", decidedAt: new Date(), decidedByUserId: user.id })
      .where(eq(joinRequests.id, requestId));
  });
  return { ok: true };
}

export async function denyJoinRequestAction(
  requestId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const [req] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!req || req.status !== "pending")
    return { ok: false, error: "Request not found." };
  if (!(await requireAdmin(user.id, req.organizationId)))
    return { ok: false, error: "Only admins can deny." };

  await db
    .update(joinRequests)
    .set({ status: "denied", decidedAt: new Date(), decidedByUserId: user.id })
    .where(eq(joinRequests.id, requestId));
  return { ok: true };
}
