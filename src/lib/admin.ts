import "server-only";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/session";

/** Application owners, by email, from the ADMIN_EMAILS env var (comma list). */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperAdmin(
  user: { email?: string | null } | null | undefined,
): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && adminEmails().has(email);
}

/** Gate an owner-only page. Unknown users get a uniform 404 (never confirm it
 *  exists). */
export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  return user;
}

export type AppStats = {
  users: number;
  groups: number;
  wishlists: number;
  pickLists: number;
  itemsRequested: number;
  reserved: number;
  gifted: number;
  picks: number;
  viewsAll: number;
  viewsToday: number;
  views7d: number;
  views30d: number;
  dbSize: string;
};

/** Application-wide totals for the owner dashboard. One round trip. */
export async function getAppStats(): Promise<AppStats> {
  const rows = (await db.execute(sql`
    select
      (select count(*) from "user")::int as users,
      (select count(*) from organization)::int as groups,
      (select count(*) from lists where kind = 'wishlist')::int as wishlists,
      (select count(*) from lists where kind = 'pick')::int as pick_lists,
      (select count(*) from items i
         join lists l on l.id = i.list_id
        where l.kind = 'wishlist')::int as items_requested,
      (select count(*) from claims where state = 'reserved')::int as reserved,
      (select count(*) from claims where state = 'purchased')::int as gifted,
      (select count(*) from picks)::int as picks,
      (select coalesce(sum(views), 0) from page_views)::int as views_all,
      (select coalesce(views, 0) from page_views where day = current_date)::int as views_today,
      (select coalesce(sum(views), 0) from page_views where day >= current_date - 6)::int as views_7d,
      (select coalesce(sum(views), 0) from page_views where day >= current_date - 29)::int as views_30d,
      pg_size_pretty(pg_database_size(current_database())) as db_size
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  return {
    users: n(r.users),
    groups: n(r.groups),
    wishlists: n(r.wishlists),
    pickLists: n(r.pick_lists),
    itemsRequested: n(r.items_requested),
    reserved: n(r.reserved),
    gifted: n(r.gifted),
    picks: n(r.picks),
    viewsAll: n(r.views_all),
    viewsToday: n(r.views_today),
    views7d: n(r.views_7d),
    views30d: n(r.views_30d),
    dbSize: String(r.db_size ?? "—"),
  };
}
