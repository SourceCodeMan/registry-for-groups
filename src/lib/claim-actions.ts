"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { claims } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { requireClaimableItem } from "@/lib/claims";
import { notifyOwnerOfPurchase } from "@/lib/notify";

export type ClaimActionResult = { ok: boolean; error?: string };

async function setClaim(
  itemId: string,
  state: "reserved" | "purchased",
): Promise<ClaimActionResult> {
  const user = await requireUser();
  const claimable = await requireClaimableItem(user.id, itemId);
  // Same generic failure whether the item is missing, cross-group, or the
  // caller's own — no signal that distinguishes them.
  if (!claimable) return { ok: false, error: "This item isn't available." };

  // Was the caller already the buyer, and in what state? (Drives the one-time
  // "you're getting a present" nudge below.)
  const [existing] = await db
    .select({ state: claims.state })
    .from(claims)
    .where(and(eq(claims.itemId, itemId), eq(claims.buyerUserId, user.id)))
    .limit(1);

  // One claim row per (item, buyer); upsert touches only the caller's own row.
  await db
    .insert(claims)
    .values({ itemId, buyerUserId: user.id, state })
    .onConflictDoUpdate({
      target: [claims.itemId, claims.buyerUserId],
      set: { state, updatedAt: new Date() },
    });

  // Only on a genuine transition INTO purchased — nudge the owner (generic,
  // debounced). The owner can never be the caller (requireClaimableItem).
  if (state === "purchased" && existing?.state !== "purchased") {
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
  if (!claimable) return { ok: false, error: "This item isn't available." };
  await db
    .delete(claims)
    .where(and(eq(claims.itemId, itemId), eq(claims.buyerUserId, user.id)));
  return { ok: true };
}
