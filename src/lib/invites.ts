import "server-only";
import crypto from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupInvites, member, organization } from "@/db/schema";
import { getMembership } from "@/lib/session";

/** How many invites this user has minted recently — a DB-backed (so it holds
 * across serverless instances) anti-abuse counter for invite creation. */
export async function recentInviteCount(userId: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.createdByUserId, userId),
        gt(groupInvites.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72h

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A reusable WHERE clause for "this invite is currently usable". */
function liveInvite(tokenHash: string) {
  return and(
    eq(groupInvites.tokenHash, tokenHash),
    isNull(groupInvites.revokedAt),
    sql`${groupInvites.uses} < ${groupInvites.maxUses}`,
    sql`(${groupInvites.expiresAt} IS NULL OR ${groupInvites.expiresAt} > now())`,
  );
}

/** Mint a single-use, member-only invite. Returns the RAW token (only stored hashed). */
export async function createInviteForGroup(
  organizationId: string,
  userId: string,
) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(groupInvites).values({
    organizationId,
    tokenHash: hashToken(token),
    role: "member",
    createdByUserId: userId,
    maxUses: 1,
    uses: 0,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return { token };
}

/** Non-consuming peek used by the /join landing page. Reveals only the group name. */
export async function getInvitePreview(token: string) {
  const rows = await db
    .select({ name: organization.name })
    .from(groupInvites)
    .innerJoin(organization, eq(groupInvites.organizationId, organization.id))
    .where(liveInvite(hashToken(token)))
    .limit(1);
  if (!rows[0]) return { valid: false as const };
  return { valid: true as const, groupName: rows[0].name };
}

/**
 * Accept an invite for `userId`. Existing members are returned idempotently
 * without consuming a use; new members atomically consume one use (so a
 * single-use link can't be redeemed twice in a race) and get a member row.
 */
export async function acceptInviteToken(token: string, userId: string) {
  const tokenHash = hashToken(token);

  const found = await db
    .select({ organizationId: groupInvites.organizationId })
    .from(groupInvites)
    .where(liveInvite(tokenHash))
    .limit(1);
  if (!found[0]) return { ok: false as const };
  const organizationId = found[0].organizationId;

  const existing = await getMembership(userId, organizationId);
  if (existing) return { ok: true as const, organizationId };

  const consumed = await db
    .update(groupInvites)
    .set({ uses: sql`${groupInvites.uses} + 1` })
    .where(liveInvite(tokenHash))
    .returning({ id: groupInvites.id });
  if (consumed.length !== 1) return { ok: false as const };

  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId,
    role: "member",
    createdAt: new Date(),
  });
  return { ok: true as const, organizationId };
}
