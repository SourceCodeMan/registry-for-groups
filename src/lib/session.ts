import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { member, organization } from "@/db/schema";

/** Current Better Auth session (cached per request). */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** The logged-in user, or redirect to /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Membership row for (user, group) or null. */
export async function getMembership(userId: string, organizationId: string) {
  const rows = await db
    .select()
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Better Auth uses `owner`/`admin`/`member`; we treat owner+admin as admin. */
export function isAdminRole(role: string | null | undefined) {
  return role === "admin" || role === "owner";
}

/** Every group the user belongs to, with their role. */
export async function getUserGroups(userId: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      metadata: organization.metadata,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId));
}
