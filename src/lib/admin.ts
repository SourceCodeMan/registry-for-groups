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
  user:
    | { email?: string | null; emailVerified?: boolean | null }
    | null
    | undefined,
): boolean {
  if (!user?.emailVerified) return false;
  const email = user.email?.toLowerCase();
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
  verifiedUsers: number;
  users7d: number;
  groups: number;
  groups7d: number;
  memberships: number;
  admins: number;
  wishlists: number;
  pickLists: number;
  archivedLists: number;
  itemsRequested: number;
  reserved: number;
  gifted: number;
  picks: number;
  joinRequestsPending: number;
  joinRequestsApproved: number;
  joinRequestsDenied: number;
  liveInvites: number;
  viewsAll: number;
  viewsToday: number;
  views7d: number;
  views30d: number;
  dbSize: string;
};

/** Aggregate counts that a group admin may see without revealing who claimed
 * any item. That distinction is important: claims remain secret from list
 * owners and group admins alike. */
export type GroupStats = {
  members: number;
  admins: number;
  wishlists: number;
  pickLists: number;
  archivedLists: number;
  itemsRequested: number;
  reserved: number;
  gifted: number;
  picks: number;
  joinRequestsPending: number;
  joinRequestsApproved: number;
  joinRequestsDenied: number;
  liveInvites: number;
};

export type GroupOverview = GroupStats & {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

/** Application-wide totals for the owner dashboard. One round trip. */
export async function getAppStats(): Promise<AppStats> {
  const rows = (await db.execute(sql`
    select
      (select count(*) from "user")::int as users,
      (select count(*) from "user" where email_verified)::int as verified_users,
      (select count(*) from "user" where created_at >= now() - interval '7 days')::int as users_7d,
      (select count(*) from organization)::int as groups,
      (select count(*) from organization where created_at >= now() - interval '7 days')::int as groups_7d,
      (select count(*) from member)::int as memberships,
      (select count(*) from member where role in ('owner', 'admin'))::int as admins,
      (select count(*) from lists where kind = 'wishlist')::int as wishlists,
      (select count(*) from lists where kind = 'pick')::int as pick_lists,
      (select count(*) from lists where archived_at is not null)::int as archived_lists,
      (select count(*) from items i
         join lists l on l.id = i.list_id
        where l.kind = 'wishlist')::int as items_requested,
      (select count(*) from claims where state = 'reserved')::int as reserved,
      (select count(*) from claims where state = 'purchased')::int as gifted,
      (select count(*) from picks)::int as picks,
      (select count(*) from join_requests where status = 'pending')::int as join_requests_pending,
      (select count(*) from join_requests where status = 'approved')::int as join_requests_approved,
      (select count(*) from join_requests where status = 'denied')::int as join_requests_denied,
      (select count(*) from group_invites
        where revoked_at is null
          and uses < max_uses
          and (expires_at is null or expires_at > now()))::int as live_invites,
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
    verifiedUsers: n(r.verified_users),
    users7d: n(r.users_7d),
    groups: n(r.groups),
    groups7d: n(r.groups_7d),
    memberships: n(r.memberships),
    admins: n(r.admins),
    wishlists: n(r.wishlists),
    pickLists: n(r.pick_lists),
    archivedLists: n(r.archived_lists),
    itemsRequested: n(r.items_requested),
    reserved: n(r.reserved),
    gifted: n(r.gifted),
    picks: n(r.picks),
    joinRequestsPending: n(r.join_requests_pending),
    joinRequestsApproved: n(r.join_requests_approved),
    joinRequestsDenied: n(r.join_requests_denied),
    liveInvites: n(r.live_invites),
    viewsAll: n(r.views_all),
    viewsToday: n(r.views_today),
    views7d: n(r.views_7d),
    views30d: n(r.views_30d),
    dbSize: String(r.db_size ?? "—"),
  };
}

/** Detailed group directory for the application owner. It intentionally
 * contains aggregate claim activity only, never buyer or item-level data. */
export async function getGroupOverviews(): Promise<GroupOverview[]> {
  const rows = (await db.execute(sql`
    select
      o.id,
      o.name,
      o.slug,
      o.created_at as "createdAt",
      (select count(*) from member m where m.organization_id = o.id)::int as members,
      (select count(*) from member m where m.organization_id = o.id
        and m.role in ('owner', 'admin'))::int as admins,
      (select count(*) from lists l where l.organization_id = o.id
        and l.kind = 'wishlist')::int as wishlists,
      (select count(*) from lists l where l.organization_id = o.id
        and l.kind = 'pick')::int as pick_lists,
      (select count(*) from lists l where l.organization_id = o.id
        and l.archived_at is not null)::int as archived_lists,
      (select count(*) from items i join lists l on l.id = i.list_id
        where l.organization_id = o.id and l.kind = 'wishlist')::int as items_requested,
      (select count(*) from claims c join items i on i.id = c.item_id
        join lists l on l.id = i.list_id
        where l.organization_id = o.id and c.state = 'reserved')::int as reserved,
      (select count(*) from claims c join items i on i.id = c.item_id
        join lists l on l.id = i.list_id
        where l.organization_id = o.id and c.state = 'purchased')::int as gifted,
      (select count(*) from picks p join lists l on l.id = p.list_id
        where l.organization_id = o.id)::int as picks,
      (select count(*) from join_requests j where j.organization_id = o.id
        and j.status = 'pending')::int as join_requests_pending,
      (select count(*) from join_requests j where j.organization_id = o.id
        and j.status = 'approved')::int as join_requests_approved,
      (select count(*) from join_requests j where j.organization_id = o.id
        and j.status = 'denied')::int as join_requests_denied,
      (select count(*) from group_invites gi where gi.organization_id = o.id
        and gi.revoked_at is null and gi.uses < gi.max_uses
        and (gi.expires_at is null or gi.expires_at > now()))::int as live_invites
    from organization o
    order by o.created_at desc
  `)) as unknown as Array<Record<string, unknown>>;
  const n = (v: unknown) => Number(v ?? 0);
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    createdAt: new Date(String(r.createdAt)),
    members: n(r.members),
    admins: n(r.admins),
    wishlists: n(r.wishlists),
    pickLists: n(r.pick_lists),
    archivedLists: n(r.archived_lists),
    itemsRequested: n(r.items_requested),
    reserved: n(r.reserved),
    gifted: n(r.gifted),
    picks: n(r.picks),
    joinRequestsPending: n(r.join_requests_pending),
    joinRequestsApproved: n(r.join_requests_approved),
    joinRequestsDenied: n(r.join_requests_denied),
    liveInvites: n(r.live_invites),
  }));
}

export async function getGroupStats(groupId: string): Promise<GroupStats> {
  const rows = (await db.execute(sql`
    select
      (select count(*) from member where organization_id = ${groupId})::int as members,
      (select count(*) from member where organization_id = ${groupId}
        and role in ('owner', 'admin'))::int as admins,
      (select count(*) from lists where organization_id = ${groupId}
        and kind = 'wishlist')::int as wishlists,
      (select count(*) from lists where organization_id = ${groupId}
        and kind = 'pick')::int as pick_lists,
      (select count(*) from lists where organization_id = ${groupId}
        and archived_at is not null)::int as archived_lists,
      (select count(*) from items i join lists l on l.id = i.list_id
        where l.organization_id = ${groupId} and l.kind = 'wishlist')::int as items_requested,
      (select count(*) from claims c join items i on i.id = c.item_id
        join lists l on l.id = i.list_id
        where l.organization_id = ${groupId} and c.state = 'reserved')::int as reserved,
      (select count(*) from claims c join items i on i.id = c.item_id
        join lists l on l.id = i.list_id
        where l.organization_id = ${groupId} and c.state = 'purchased')::int as gifted,
      (select count(*) from picks p join lists l on l.id = p.list_id
        where l.organization_id = ${groupId})::int as picks,
      (select count(*) from join_requests where organization_id = ${groupId}
        and status = 'pending')::int as join_requests_pending,
      (select count(*) from join_requests where organization_id = ${groupId}
        and status = 'approved')::int as join_requests_approved,
      (select count(*) from join_requests where organization_id = ${groupId}
        and status = 'denied')::int as join_requests_denied,
      (select count(*) from group_invites where organization_id = ${groupId}
        and revoked_at is null and uses < max_uses
        and (expires_at is null or expires_at > now()))::int as live_invites
  `)) as unknown as Array<Record<string, unknown>>;
  const r = rows[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  return {
    members: n(r.members),
    admins: n(r.admins),
    wishlists: n(r.wishlists),
    pickLists: n(r.pick_lists),
    archivedLists: n(r.archived_lists),
    itemsRequested: n(r.items_requested),
    reserved: n(r.reserved),
    gifted: n(r.gifted),
    picks: n(r.picks),
    joinRequestsPending: n(r.join_requests_pending),
    joinRequestsApproved: n(r.join_requests_approved),
    joinRequestsDenied: n(r.join_requests_denied),
    liveInvites: n(r.live_invites),
  };
}
