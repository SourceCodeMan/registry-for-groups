/**
 * Idempotent 0006 apply at Vercel build time (DATABASE_URL is in the
 * environment). Safe to re-run: unique index is IF NOT EXISTS, email
 * backfill is flagged so later deploys don't mark unverified signups as
 * verified.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL unset, skipping");
  process.exit(0);
}

const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 10 });

try {
  await sql.unsafe(`
    DELETE FROM "member" a USING "member" b
    WHERE a.ctid < b.ctid
      AND a.organization_id = b.organization_id
      AND a.user_id = b.user_id
  `);
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "member_org_user_uidx"
    ON "member" USING btree ("organization_id","user_id")
  `);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "_ops_flags" (
      "key" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `);
  const inserted = await sql`
    INSERT INTO "_ops_flags" ("key")
    VALUES ('email_verified_backfill_0006')
    ON CONFLICT DO NOTHING
    RETURNING "key"
  `;
  if (inserted.length) {
    await sql.unsafe(`
      UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false
    `);
    console.log("[migrate] backfilled email_verified on existing users");
  }
  console.log("[migrate] 0006 applied");
} catch (e) {
  console.error("[migrate] failed", e);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
