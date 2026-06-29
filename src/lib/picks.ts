import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, lists, picks, user as users } from "@/db/schema";
import { getMembership } from "@/lib/session";

export type PickOption = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
};

export type PickListView = {
  list: {
    id: string;
    title: string;
    organizationId: string;
    ownerUserId: string;
    maxPicksPerMember: number;
  };
  isCreator: boolean;
  creatorName: string;
  options: PickOption[];
  /** Item ids the VIEWER has chosen (always their own only). */
  myPickedItemIds: string[];
  /**
   * Per-option pickers — populated ONLY for the creator (so they can fulfill).
   * A non-creator member never receives anyone else's choices.
   */
  results?: { itemId: string; pickers: { id: string; name: string }[] }[];
};

function toOption(it: typeof items.$inferSelect): PickOption {
  return {
    id: it.id,
    title: it.title,
    description: it.description,
    url: it.url,
    imageUrl: it.imageUrl,
    priceCents: it.priceCents,
  };
}

/**
 * Load a pick list as seen by `viewerId`. Returns null (→ uniform 404) if it
 * doesn't exist, isn't a pick list, or the viewer isn't a member of its group.
 * The creator gets the full who-picked-what results; everyone else gets only
 * the options plus their own selections.
 */
export async function getPickList(
  viewerId: string,
  listId: string,
): Promise<PickListView | null> {
  const [list] = await db
    .select()
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);
  if (!list || list.kind !== "pick" || list.organizationId === null)
    return null;

  const membership = await getMembership(viewerId, list.organizationId);
  if (!membership) return null;

  const isCreator = list.ownerUserId === viewerId;

  const [creator] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, list.ownerUserId))
    .limit(1);

  const optionRows = await db
    .select()
    .from(items)
    .where(eq(items.listId, listId))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));

  const myPicks = await db
    .select({ itemId: picks.itemId })
    .from(picks)
    .where(and(eq(picks.listId, listId), eq(picks.pickerUserId, viewerId)));

  let results: PickListView["results"];
  if (isCreator) {
    const rows = await db
      .select({
        itemId: picks.itemId,
        pickerId: users.id,
        pickerName: users.name,
      })
      .from(picks)
      .innerJoin(users, eq(picks.pickerUserId, users.id))
      .where(eq(picks.listId, listId))
      .orderBy(asc(picks.createdAt));
    const byItem = new Map<string, { id: string; name: string }[]>();
    for (const o of optionRows) byItem.set(o.id, []);
    for (const r of rows)
      (byItem.get(r.itemId) ?? []).push({ id: r.pickerId, name: r.pickerName });
    results = optionRows.map((o) => ({
      itemId: o.id,
      pickers: byItem.get(o.id) ?? [],
    }));
  }

  return {
    list: {
      id: list.id,
      title: list.title,
      organizationId: list.organizationId,
      ownerUserId: list.ownerUserId,
      maxPicksPerMember: list.maxPicksPerMember,
    },
    isCreator,
    creatorName: creator?.name ?? "Someone",
    options: optionRows.map(toOption),
    myPickedItemIds: myPicks.map((p) => p.itemId),
    results,
  };
}

export type GroupPickListSummary = {
  id: string;
  title: string;
  creatorUserId: string;
  creatorName: string;
  optionCount: number;
  pickerCount: number;
};

/** All pick lists in a group, with option + distinct-picker counts. */
export async function getGroupPickLists(
  organizationId: string,
): Promise<GroupPickListSummary[]> {
  const rows = await db
    .select({
      id: lists.id,
      title: lists.title,
      creatorUserId: lists.ownerUserId,
      creatorName: users.name,
      createdAt: lists.createdAt,
    })
    .from(lists)
    .innerJoin(users, eq(lists.ownerUserId, users.id))
    .where(and(eq(lists.organizationId, organizationId), eq(lists.kind, "pick")))
    .orderBy(asc(lists.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const optionCounts = await db
    .select({ listId: items.listId, n: sql<number>`count(*)::int` })
    .from(items)
    .where(inArray(items.listId, ids))
    .groupBy(items.listId);
  const pickerCounts = await db
    .select({
      listId: picks.listId,
      n: sql<number>`count(distinct ${picks.pickerUserId})::int`,
    })
    .from(picks)
    .where(inArray(picks.listId, ids))
    .groupBy(picks.listId);

  const optMap = new Map(optionCounts.map((o) => [o.listId, o.n]));
  const pickMap = new Map(pickerCounts.map((p) => [p.listId, p.n]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    creatorUserId: r.creatorUserId,
    creatorName: r.creatorName,
    optionCount: optMap.get(r.id) ?? 0,
    pickerCount: pickMap.get(r.id) ?? 0,
  }));
}

/**
 * Resolve an option the viewer may CHOOSE. Returns null (→ uniform 404) if the
 * item doesn't exist, its list isn't a pick list, the viewer isn't a member, or
 * the viewer is the list's creator (the creator runs the list; they don't pick
 * from it).
 */
export async function requirePickableItem(viewerId: string, itemId: string) {
  const [row] = await db
    .select({ item: items, list: lists })
    .from(items)
    .innerJoin(lists, eq(items.listId, lists.id))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) return null;
  if (row.list.kind !== "pick" || row.list.organizationId === null) return null;
  if (row.list.ownerUserId === viewerId) return null;
  const membership = await getMembership(viewerId, row.list.organizationId);
  if (!membership) return null;
  return row;
}
