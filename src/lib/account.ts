import "server-only";
import { APIError } from "better-auth/api";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { claims, organization } from "@/db/schema";

/**
 * Runs in Better Auth's `beforeDelete` hook, right before a user row is
 * removed. The user's own lists/items/memberships/picks/invites/join-requests
 * are cleaned up by ON DELETE CASCADE; their *purchased* claims on other
 * people's items are set null (the gift was really bought, so the item stays
 * marked). This handles the two things cascades can't:
 *
 *  1. BLOCK deletion if the user is the only admin of a group that still has
 *     other members — they must hand off admin first (chosen policy).
 *  2. Release their active reservations so those gifts free up, and delete any
 *     group where they were the only member.
 */
export async function prepareAccountDeletion(userId: string): Promise<void> {
  // 1. Sole-admin-of-a-shared-group → block.
  const blocking = (await db.execute(sql`
    select o.name
    from organization o
    join member m
      on m.organization_id = o.id
     and m.user_id = ${userId}
     and m.role in ('owner', 'admin')
    where (select count(*) from member a
            where a.organization_id = o.id
              and a.role in ('owner', 'admin')) = 1
      and (select count(*) from member t
            where t.organization_id = o.id) > 1
  `)) as unknown as Array<{ name: string }>;

  if (blocking.length > 0) {
    const names = blocking.map((r) => `"${r.name}"`).join(", ");
    throw new APIError("BAD_REQUEST", {
      message:
        `You're the only admin of ${names}. Make someone else an admin ` +
        `(or remove the other members) before deleting your account.`,
    });
  }

  // 2a. Release the user's active reservations so those items free up. (Their
  //     claims on their OWN items will cascade away with their lists.)
  await db
    .delete(claims)
    .where(and(eq(claims.buyerUserId, userId), eq(claims.state, "reserved")));

  // 2b. Delete any group where this user is the only member (cascades all of
  //     its contents). Groups with other members are either kept (another
  //     admin exists) or were blocked above.
  const solo = (await db.execute(sql`
    select o.id
    from organization o
    join member m on m.organization_id = o.id and m.user_id = ${userId}
    where (select count(*) from member t where t.organization_id = o.id) = 1
  `)) as unknown as Array<{ id: string }>;

  if (solo.length > 0) {
    await db.delete(organization).where(
      inArray(
        organization.id,
        solo.map((r) => r.id),
      ),
    );
  }
}
