import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { pageviewLimiter } from "@/lib/ratelimit";
import { publicAppUrl } from "@/lib/email";

function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  const app = publicAppUrl();
  if (!origin) return true;
  if (!app) return false;
  try {
    return new URL(origin).origin === new URL(app).origin;
  } catch {
    return false;
  }
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * A tiny, privacy-light visit counter: bump today's tally by one. No PII, no
 * cookies, no per-path data — just a daily number for the owner dashboard.
 * Best-effort; a failure here must never affect the page the user is viewing.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return new Response(null, { status: 204 });
  }
  try {
    if (!(await pageviewLimiter.limit(clientIp(req))).success) {
      return new Response(null, { status: 204 });
    }
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
