import "server-only";
import crypto from "crypto";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupInvites, member, organization } from "@/db/schema";
import { getMembership } from "@/lib/session";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72h

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A reusable WHERE clause for "this invite is currently usable". */
function liveInvite(tokenHash: string) {
  return and(
    eq(groupInvites.tokenHash, tokenHash),
    isNull(groupInvites.revokedAt),
    sql`${groupInvites.uses} < ${groupInvites.maxUses}`,
    sql`(${groupInvites.expiresAt} IS NULL OR ${groupInvites.expiresAt} > now())`,
  );
}

/** Mint a single-use, member-only invite. Returns the RAW token (only stored hashed). */
export async function createInviteForGroup(
  organizationId: string,
  userId: string,
  email?: string | null,
) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(groupInvites).values({
    organizationId,
    tokenHash: hashToken(token),
    email: email ?? null,
    role: "member",
    createdByUserId: userId,
    maxUses: 1,
    uses: 0,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return { token };
}

export type PendingInvite = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  createdAt: Date;
};

/** Email invites for a group with a derived status, for the admin panel. */
export async function getPendingInvites(
  organizationId: string,
): Promise<PendingInvite[]> {
  const rows = await db
    .select({
      id: groupInvites.id,
      email: groupInvites.email,
      uses: groupInvites.uses,
      maxUses: groupInvites.maxUses,
      expiresAt: groupInvites.expiresAt,
      revokedAt: groupInvites.revokedAt,
      createdAt: groupInvites.createdAt,
    })
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.organizationId, organizationId),
        isNotNull(groupInvites.email),
      ),
    )
    .orderBy(desc(groupInvites.createdAt));

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    email: r.email!,
    createdAt: r.createdAt,
    status: r.revokedAt
      ? "revoked"
      : r.uses >= r.maxUses
        ? "accepted"
        : r.expiresAt && r.expiresAt.getTime() < now
          ? "expired"
          : "pending",
  }));
}

/** Revoke an invite (scoped to its group). */
export async function revokeInviteById(
  inviteId: string,
  organizationId: string,
) {
  await db
    .update(groupInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(groupInvites.id, inviteId),
        eq(groupInvites.organizationId, organizationId),
      ),
    );
}

/** Non-consuming peek used by the /join landing page. Reveals only the group name. */
export async function getInvitePreview(token: string) {
  const rows = await db
    .select({ name: organization.name })
    .from(groupInvites)
    .innerJoin(organization, eq(groupInvites.organizationId, organization.id))
    .where(liveInvite(hashToken(token)))
    .limit(1);
  if (!rows[0]) return { valid: false as const };
  return { valid: true as const, groupName: rows[0].name };
}

/**
 * Accept an invite for `userId`. Existing members are returned idempotently
 * without consuming a use; new members atomically consume one use (so a
 * single-use link can't be redeemed twice in a race) and get a member row.
 */
export async function acceptInviteToken(token: string, userId: string) {
  const tokenHash = hashToken(token);

  const found = await db
    .select({ organizationId: groupInvites.organizationId })
    .from(groupInvites)
    .where(liveInvite(tokenHash))
    .limit(1);
  if (!found[0]) return { ok: false as const };
  const organizationId = found[0].organizationId;

  const existing = await getMembership(userId, organizationId);
  if (existing) return { ok: true as const, organizationId };

  const consumed = await db
    .update(groupInvites)
    .set({ uses: sql`${groupInvites.uses} + 1` })
    .where(liveInvite(tokenHash))
    .returning({ id: groupInvites.id });
  if (consumed.length !== 1) return { ok: false as const };

  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId,
    role: "member",
    createdAt: new Date(),
  });
  return { ok: true as const, organizationId };
}
