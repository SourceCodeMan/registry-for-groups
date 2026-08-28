"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { claims } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { requireClaimableItem } from "@/lib/claims";
import { notifyOwnerOfPurchase } from "@/lib/notify";

export type ClaimActionResult = { ok: boolean; error?: string };

const UNAVAILABLE: ClaimActionResult = {
  ok: false,
  error: "This item isn't available.",
};

async function setClaim(
  itemId: string,
  state: "reserved" | "purchased",
): Promise<ClaimActionResult> {
  const user = await requireUser();
  const claimable = await requireClaimableItem(user.id, itemId);
  // Same generic failure whether the item is missing, cross-group, or the
  // caller's own — no signal that distinguishes them.
  if (!claimable) return UNAVAILABLE;

  // New claims need a live group membership; requireClaimableItem already
  // allows an existing claim on a detached list through.
  let previous: string | undefined;
  try {
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from items where id = ${itemId} for update`,
      );
      const [existing] = await tx
        .select({ state: claims.state })
        .from(claims)
        .where(and(eq(claims.itemId, itemId), eq(claims.buyerUserId, user.id)))
        .limit(1);
      if (!existing) {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(claims)
          .where(eq(claims.itemId, itemId));
        const qty = Math.max(1, claimable.item.quantity);
        if ((n ?? 0) >= qty) return "full" as const;
        await tx
          .insert(claims)
          .values({ itemId, buyerUserId: user.id, state });
      } else {
        await tx
          .update(claims)
          .set({ state, updatedAt: new Date() })
          .where(and(eq(claims.itemId, itemId), eq(claims.buyerUserId, user.id)));
      }
      return existing?.state;
    });
    if (outcome === "full") return UNAVAILABLE;
    previous = outcome;
  } catch {
    return UNAVAILABLE;
  }

  if (state === "purchased" && previous !== "purchased") {
    await notifyOwnerOfPurchase(claimable.list.ownerUserId);
  }
  return { ok: true };
}

export async function reserveItemAction(
  itemId: string,
): Promise<ClaimActionResult> {
  return setClaim(itemId, "reserved");
}

export async function purchaseItemAction(
  itemId: string,
): Promise<ClaimActionResult> {
  return setClaim(itemId, "purchased");
}

/** Remove the caller's OWN claim. Re-checks group membership like every other
 * mutation (a removed member must not retain write access to residual claims),
 * and never reveals anyone else. */
export async function releaseClaimAction(
  itemId: string,
): Promise<ClaimActionResult> {
  const user = await requireUser();
  const claimable = await requireClaimableItem(user.id, itemId);
  if (!claimable) return UNAVAILABLE;
  // Purchased stays purchased — releasing after the owner was nudged would
  // make the "you're getting a present" mail a lie.
  const deleted = await db
    .delete(claims)
    .where(
      and(
        eq(claims.itemId, itemId),
        eq(claims.buyerUserId, user.id),
        eq(claims.state, "reserved"),
      ),
    )
    .returning({ id: claims.id });
  if (deleted.length === 0) {
    const [held] = await db
      .select({ state: claims.state })
      .from(claims)
      .where(and(eq(claims.itemId, itemId), eq(claims.buyerUserId, user.id)))
      .limit(1);
    if (held?.state === "purchased") {
      return { ok: false, error: "Purchased gifts can't be released." };
    }
    return UNAVAILABLE;
  }
  return { ok: true };
}
