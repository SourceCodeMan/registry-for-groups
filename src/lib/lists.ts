import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { items, lists } from "@/db/schema";
import { getMembership } from "@/lib/session";

export type ListRow = typeof lists.$inferSelect;
export type ItemRow = typeof items.$inferSelect;

/** All of a user's own lists in a group (newest activity first). */
export async function getUserListsInGroup(
  userId: string,
  organizationId: string,
) {
  return db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.ownerUserId, userId),
        eq(lists.organizationId, organizationId),
      ),
    )
    .orderBy(asc(lists.createdAt));
}

/** A user's personal (ungrouped) lists — kept after being removed from a group. */
export async function getUserPersonalLists(userId: string) {
  return db
    .select()
    .from(lists)
    .where(and(eq(lists.ownerUserId, userId), isNull(lists.organizationId)))
    .orderBy(asc(lists.createdAt));
}

/**
 * Return a list only if `userId` owns it AND still belongs to its group.
 * Used to gate every owner-side mutation.
 */
export async function requireOwnedList(userId: string, listId: string) {
  const [list] = await db
    .select()
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);
  if (!list || list.ownerUserId !== userId) return null;
  // Personal (ungrouped) list — owning it is enough.
  if (list.organizationId === null) return list;
  const membership = await getMembership(userId, list.organizationId);
  if (!membership) return null;
  return list;
}

/** Same guard, resolved from an item id. Returns { item, list }. */
export async function requireOwnedItem(userId: string, itemId: string) {
  const [row] = await db
    .select({ item: items, list: lists })
    .from(items)
    .innerJoin(lists, eq(items.listId, lists.id))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row || row.list.ownerUserId !== userId) return null;
  if (row.list.organizationId === null) return row;
  const membership = await getMembership(userId, row.list.organizationId);
  if (!membership) return null;
  return row;
}

/**
 * Owner's view of one of their lists, with items in display order.
 * Deliberately NEVER touches the `claims` table — the owner must not be able
 * to learn (or infer) that anything has been claimed.
 */
export async function getOwnedListWithItems(userId: string, listId: string) {
  const list = await requireOwnedList(userId, listId);
  if (!list) return null;
  const rows = await db
    .select()
    .from(items)
    .where(eq(items.listId, listId))
    .orderBy(asc(items.sortOrder), asc(items.createdAt));
  return { list, items: rows };
}
