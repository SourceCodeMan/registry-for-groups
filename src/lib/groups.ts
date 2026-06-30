import "server-only";
import crypto from "crypto";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  joinRequests,
  member,
  organization,
  user as users,
} from "@/db/schema";
import { RESERVED_SLUGS, normalizeSlug } from "@/lib/slug";

export type GroupBySlug = {
  id: string;
  name: string;
  slug: string;
  metadata: string | null;
};

/** Look up a group by its (normalized) vanity slug. Public — never returns
 *  any list/member data, only enough to render a join landing. */
export async function getGroupBySlug(
  rawSlug: string,
): Promise<GroupBySlug | null> {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return null;
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      metadata: organization.metadata,
    })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  return org ?? null;
}

/** Is this slug already in use by some OTHER group? */
export async function isSlugTaken(
  rawSlug: string,
  exceptOrgId?: string,
): Promise<boolean> {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return false;
  const [hit] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!hit) return false;
  return exceptOrgId ? hit.id !== exceptOrgId : true;
}

/** A clean default slug derived from the group name, made unique. */
export async function pickAvailableSlug(name: string): Promise<string> {
  let base = normalizeSlug(name).slice(0, 32).replace(/-+$/g, "");
  if (base.length < 3 || RESERVED_SLUGS.has(base)) {
    base = `group-${base}`.replace(/-+$/g, "").slice(0, 32);
  }
  if (base.length < 3) base = "group";
  if (!(await isSlugTaken(base))) return base;
  for (let i = 0; i < 6; i++) {
    const cand = `${base}-${crypto.randomBytes(2).toString("hex")}`.slice(0, 40);
    if (!(await isSlugTaken(cand))) return cand;
  }
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

export type GroupSearchResult = {
  id: string;
  name: string;
  adminName: string | null;
  alreadyRequested: boolean;
};

/** Find groups by name (partial) or admin email (exact), excluding groups the
 * viewer is already in. Never exposes any list data — just discovery. */
export async function searchGroups(
  rawQuery: string,
  viewerId: string,
): Promise<GroupSearchResult[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const emailExact = q.toLowerCase();

  const candidates = await db
    .selectDistinct({ id: organization.id, name: organization.name })
    .from(organization)
    .leftJoin(member, eq(member.organizationId, organization.id))
    .leftJoin(users, eq(member.userId, users.id))
    .where(
      or(
        ilike(organization.name, like),
        and(
          eq(users.email, emailExact),
          inArray(member.role, ["owner", "admin"]),
        ),
      ),
    )
    .limit(20);
  if (candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);

  const mineRows = await db
    .select({ o: member.organizationId })
    .from(member)
    .where(
      and(eq(member.userId, viewerId), inArray(member.organizationId, ids)),
    );
  const mine = new Set(mineRows.map((m) => m.o));

  const reqRows = await db
    .select({ o: joinRequests.organizationId })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, viewerId),
        eq(joinRequests.status, "pending"),
        inArray(joinRequests.organizationId, ids),
      ),
    );
  const requested = new Set(reqRows.map((r) => r.o));

  const adminRows = await db
    .select({ o: member.organizationId, name: users.name })
    .from(member)
    .innerJoin(users, eq(member.userId, users.id))
    .where(
      and(
        inArray(member.organizationId, ids),
        inArray(member.role, ["owner", "admin"]),
      ),
    );
  const adminByOrg = new Map<string, string>();
  for (const a of adminRows) if (!adminByOrg.has(a.o)) adminByOrg.set(a.o, a.name);

  return candidates
    .filter((c) => !mine.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      adminName: adminByOrg.get(c.id) ?? null,
      alreadyRequested: requested.has(c.id),
    }));
}

export type PendingJoinRequest = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

/** Pending requests to join a group, for the admin panel. */
export async function getPendingJoinRequests(
  organizationId: string,
): Promise<PendingJoinRequest[]> {
  return db
    .select({
      id: joinRequests.id,
      name: users.name,
      email: users.email,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .innerJoin(users, eq(joinRequests.userId, users.id))
    .where(
      and(
        eq(joinRequests.organizationId, organizationId),
        eq(joinRequests.status, "pending"),
      ),
    )
    .orderBy(asc(joinRequests.createdAt));
}
