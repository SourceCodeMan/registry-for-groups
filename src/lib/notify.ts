import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { giftNotifications, user as users } from "@/db/schema";
import { sendEmail, giftPurchasedEmail } from "@/lib/email";

/**
 * Nudge a list owner that a gift was bought for them — at most once per window,
 * and always generic (never the item, the buyer, or the count). Debounce is
 * claimed atomically: the upsert only "wins" (returns a row) if it inserted a
 * fresh row or the last send is older than the window, so concurrent purchases
 * can't produce a flood. Best-effort — never throws into the caller.
 */
export async function notifyOwnerOfPurchase(ownerUserId: string): Promise<void> {
  try {
    const slot = await db
      .insert(giftNotifications)
      // Use the DB clock for both the stored value and the window comparison so
      // app/Postgres clock skew can't shift the effective window.
      .values({ userId: ownerUserId, lastSentAt: sql`now()` })
      .onConflictDoUpdate({
        target: giftNotifications.userId,
        set: { lastSentAt: sql`now()` },
        setWhere: sql`${giftNotifications.lastSentAt} < now() - interval '20 hours'`,
      })
      .returning({ userId: giftNotifications.userId });
    if (slot.length === 0) return; // nudged recently — stay quiet

    const [owner] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);
    if (!owner?.email) return;

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const mail = giftPurchasedEmail(`${base}/surprise`);
    await sendEmail({ to: owner.email, ...mail });
  } catch (e) {
    console.error("[notify] gift purchase nudge failed", (e as Error).message);
  }
}
