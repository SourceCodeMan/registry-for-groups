import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { claims, items, lists, organization, user as users } from "@/db/schema";
import { getMembership } from "@/lib/session";

export type ClaimState = "unclaimed" | "reserved" | "purchased";

export type ViewItem = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  quantity: number;
  claimState: ClaimState;
  /** The VIEWER's own claim on this item (never anyone else's). */
  mine: "reserved" | "purchased" | null;
};

export type ViewList = {
  id: string;
  title: string;
  occasion: string;
  eventDate: string | null;
  items: ViewItem[];
};

/**
 * Another member's lists as seen by `viewerId`.
 *
 * Returns, per item, only a coarse `claimState` (unclaimed/reserved/purchased)
 * and the viewer's OWN claim. Buyer identities and claim counts NEVER leave
 * this function. Returns null if the viewer may not see this — and crucially if
 * `ownerUserId === viewerId`, so an owner can never obtain claim data about
 * their own list through this path.
 */
export async function getMemberListsForViewer(
  viewerId: string,
  organizationId: string,
  ownerUserId: string,
): Promise<{
  owner: { id: string; name: string };
  lists: ViewList[];
} | null> {
  if (ownerUserId === viewerId) return null;

  const viewerMembership = await getMembership(viewerId, organizationId);
  if (!viewerMembership) return null;
  const ownerMembership = await getMembership(ownerUserId, organizationId);
  if (!ownerMembership) return null;

  const [owner] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, ownerUserId))
    .limit(1);
  if (!owner) return null;

  const ownerLists = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.organizationId, organizationId),
        eq(lists.ownerUserId, ownerUserId),
        // Only wishlists are browsable/claimable here; pick lists are separate.
        eq(lists.kind, "wishlist"),
      ),
    )
    .orderBy(asc(lists.createdAt));

  const listIds = ownerLists.map((l) => l.id);
  const allItems = listIds.length
    ? await db
        .select()
        .from(items)
        .where(inArray(items.listId, listIds))
        .orderBy(asc(items.sortOrder), asc(items.createdAt))
    : [];

  const itemIds = allItems.map((i) => i.id);
  const allClaims = itemIds.length
    ? await db
        .select({
          itemId: claims.itemId,
          buyerUserId: claims.buyerUserId,
          state: claims.state,
        })
        .from(claims)
        .where(inArray(claims.itemId, itemIds))
    : [];

  // Aggregate on the server; buyer ids never make it into the returned shape.
  const agg = new Map<
    string,
    { purchased: boolean; reserved: boolean; mine: "reserved" | "purchased" | null }
  >();
  for (const it of allItems)
    agg.set(it.id, { purchased: false, reserved: false, mine: null });
  for (const c of allClaims) {
    const a = agg.get(c.itemId);
    if (!a) continue;
    if (c.buyerUserId === viewerId) {
      // The viewer's own claim feeds `mine` only — never the "others"
      // aggregate, so a co-claimant can't be inferred from a state mismatch.
      a.mine = c.state as "reserved" | "purchased";
      continue;
    }
    if (c.state === "purchased") a.purchased = true;
    else if (c.state === "reserved") a.reserved = true;
  }

  const itemsByList = new Map<string, ViewItem[]>();
  for (const it of allItems) {
    const a = agg.get(it.id)!;
    // If the viewer holds a claim, the public state mirrors THEIR state — we
    // never surface a stronger aggregate that would prove someone else claimed
    // it too. Otherwise it reflects other members' claims (so they don't
    // double-buy), but never who.
    const claimState: ClaimState = a.mine
      ? a.mine
      : a.purchased
        ? "purchased"
        : a.reserved
          ? "reserved"
          : "unclaimed";
    const arr = itemsByList.get(it.listId) ?? [];
    arr.push({
      id: it.id,
      title: it.title,
      description: it.description,
      url: it.url,
      imageUrl: it.imageUrl,
      priceCents: it.priceCents,
      quantity: it.quantity,
      claimState,
      mine: a.mine,
    });
    itemsByList.set(it.listId, arr);
  }

  return {
    owner: { id: owner.id, name: owner.name },
    lists: ownerLists.map((l) => ({
      id: l.id,
      title: l.title,
      occasion: l.occasion,
      eventDate: l.eventDate,
      items: itemsByList.get(l.id) ?? [],
    })),
  };
}

/**
 * Resolve an item the viewer is allowed to CLAIM. Returns null (→ uniform 404,
 * no oracle) if the item doesn't exist, the viewer isn't in its group, OR the
 * viewer owns the list (you can't claim your own — and must not be able to tell
 * that's why it failed).
 */
export async function requireClaimableItem(viewerId: string, itemId: string) {
  const [row] = await db
    .select({ item: items, list: lists })
    .from(items)
    .innerJoin(lists, eq(items.listId, lists.id))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) return null;
  if (row.list.ownerUserId === viewerId) return null;
  // Personal (ungrouped) lists aren't browsable, so nothing on them is claimable.
  if (row.list.organizationId === null) return null;
  // Pick-list options are chosen, never claimed — keep the two flows disjoint.
  if (row.list.kind !== "wishlist") return null;
  const membership = await getMembership(viewerId, row.list.organizationId);
  if (!membership) return null;
  return row;
}

/** The viewer's own claims across every group (the "Gifts I'm giving" view). */
export async function getMyClaims(viewerId: string) {
  return db
    .select({
      itemId: claims.itemId,
      state: claims.state,
      itemTitle: items.title,
      priceCents: items.priceCents,
      url: items.url,
      listTitle: lists.title,
      ownerName: users.name,
      groupId: organization.id,
      groupName: organization.name,
    })
    .from(claims)
    .innerJoin(items, eq(claims.itemId, items.id))
    .innerJoin(lists, eq(items.listId, lists.id))
    .innerJoin(users, eq(lists.ownerUserId, users.id))
    .innerJoin(organization, eq(lists.organizationId, organization.id))
    .where(eq(claims.buyerUserId, viewerId))
    .orderBy(asc(organization.name), asc(users.name));
}
