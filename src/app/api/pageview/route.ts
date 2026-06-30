import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pageViews } from "@/db/schema";

/**
 * A tiny, privacy-light visit counter: bump today's tally by one. No PII, no
 * cookies, no per-path data — just a daily number for the owner dashboard.
 * Best-effort; a failure here must never affect the page the user is viewing.
 */
export async function POST() {
  try {
    await db
      .insert(pageViews)
      .values({ day: sql`current_date`, views: 1 })
      .onConflictDoUpdate({
        target: pageViews.day,
        set: { views: sql`${pageViews.views} + 1` },
      });
  } catch {
    // swallow — the beacon is fire-and-forget
  }
  return new Response(null, { status: 204 });
}
