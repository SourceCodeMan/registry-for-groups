import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  claims,
  items,
  lists,
  member,
  organization,
  user as users,
} from "@/db/schema";
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
  /** How many claims currently exist (including the viewer's). Never who. */
  claimedCount: number;
  claimState: ClaimState;
  /** The VIEWER's own claim on this item (never anyone else's). */
  mine: "reserved" | "purchased" | null;
};

type ClaimAggRow = {
  itemId: string;
  buyerUserId: string | null;
  state: string;
};

/** Occupancy for one item as seen by `viewerId`. Buyer ids stay here. */
export function occupancyForViewer(
  quantity: number,
  rows: ClaimAggRow[],
  viewerId: string,
): Pick<ViewItem, "claimedCount" | "claimState" | "mine"> {
  const qty = Math.max(1, quantity);
  let claimedCount = 0;
  let purchased = false;
  let reserved = false;
  let mine: ViewItem["mine"] = null;
  for (const c of rows) {
    claimedCount++;
    if (c.buyerUserId === viewerId) {
      mine = c.state as "reserved" | "purchased";
      continue;
    }
    if (c.state === "purchased") purchased = true;
    else if (c.state === "reserved") reserved = true;
  }
  const full = claimedCount >= qty;
  const claimState: ClaimState = mine
    ? mine
    : !full
      ? "unclaimed"
      : purchased
        ? "purchased"
        : reserved
          ? "reserved"
          : "unclaimed";
  return { claimedCount, claimState, mine };
}

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

  const claimsByItem = new Map<string, ClaimAggRow[]>();
  for (const c of allClaims) {
    const arr = claimsByItem.get(c.itemId) ?? [];
    arr.push(c);
    claimsByItem.set(c.itemId, arr);
  }

  const itemsByList = new Map<string, ViewItem[]>();
  for (const it of allItems) {
    const occ = occupancyForViewer(
      it.quantity,
      claimsByItem.get(it.id) ?? [],
      viewerId,
    );
    const arr = itemsByList.get(it.listId) ?? [];
    arr.push({
      id: it.id,
      title: it.title,
      description: it.description,
      url: it.url,
      imageUrl: it.imageUrl,
      priceCents: it.priceCents,
      quantity: it.quantity,
      claimedCount: occ.claimedCount,
      claimState: occ.claimState,
      mine: occ.mine,
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
  // Pick-list options are chosen, never claimed — keep the two flows disjoint.
  if (row.list.kind !== "wishlist") return null;

  const [existing] = await db
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.itemId, itemId), eq(claims.buyerUserId, viewerId)))
    .limit(1);

  // Personal lists aren't browsable. An existing claim (list was later
  // detached) can still be updated or released by its buyer.
  if (row.list.organizationId === null) return existing ? row : null;

  const membership = await getMembership(viewerId, row.list.organizationId);
  if (membership) return row;
  return existing ? row : null;
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
    .leftJoin(organization, eq(lists.organizationId, organization.id))
    .where(eq(claims.buyerUserId, viewerId))
    .orderBy(asc(organization.name), asc(users.name));
}

export type RequestedGift = {
  itemId: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  quantity: number;
  claimedCount: number;
  createdAt: Date;
  ownerName: string;
  listTitle: string;
  groupId: string;
  groupName: string;
  claimState: ClaimState;
  /** The VIEWER's own claim on this item (never anyone else's). */
  mine: "reserved" | "purchased" | null;
};

/**
 * A single feed of everything the viewer's groups have asked for — every
 * wishlist item across every group they belong to, most-recently-added first,
 * so they can find something to give. Their OWN items are excluded (you can't
 * gift yourself, and it must never spoil). Same secrecy rules as browsing one
 * member: coarse claim state so nothing gets double-bought, the viewer's own
 * claim surfaced, but never WHO claimed anything.
 */
export async function getRequestedGiftsForViewer(
  viewerId: string,
  limit = 200,
): Promise<RequestedGift[]> {
  const memberships = await db
    .select({ o: member.organizationId })
    .from(member)
    .where(eq(member.userId, viewerId));
  const groupIds = memberships.map((m) => m.o);
  if (groupIds.length === 0) return [];

  const rows = await db
    .select({
      itemId: items.id,
      title: items.title,
      description: items.description,
      url: items.url,
      imageUrl: items.imageUrl,
      priceCents: items.priceCents,
      quantity: items.quantity,
      createdAt: items.createdAt,
      listTitle: lists.title,
      ownerName: users.name,
      groupId: organization.id,
      groupName: organization.name,
    })
    .from(items)
    .innerJoin(lists, eq(items.listId, lists.id))
    .innerJoin(organization, eq(lists.organizationId, organization.id))
    .innerJoin(users, eq(lists.ownerUserId, users.id))
    .where(
      and(
        inArray(lists.organizationId, groupIds),
        eq(lists.kind, "wishlist"),
        ne(lists.ownerUserId, viewerId),
      ),
    )
    .orderBy(desc(items.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const itemIds = rows.map((r) => r.itemId);
  const allClaims = await db
    .select({
      itemId: claims.itemId,
      buyerUserId: claims.buyerUserId,
      state: claims.state,
    })
    .from(claims)
    .where(inArray(claims.itemId, itemIds));

  const claimsByItem = new Map<string, ClaimAggRow[]>();
  for (const c of allClaims) {
    const arr = claimsByItem.get(c.itemId) ?? [];
    arr.push(c);
    claimsByItem.set(c.itemId, arr);
  }

  return rows.map((r) => {
    const occ = occupancyForViewer(
      r.quantity,
      claimsByItem.get(r.itemId) ?? [],
      viewerId,
    );
    return {
      ...r,
      claimedCount: occ.claimedCount,
      claimState: occ.claimState,
      mine: occ.mine,
    };
  });
}
