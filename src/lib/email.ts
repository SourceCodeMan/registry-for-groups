import "server-only";
import crypto from "crypto";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send a transactional email via Resend's REST API. If RESEND_API_KEY is unset
 * (local dev), it logs to the console instead so flows are testable without an
 * account. The real key is wired at deploy.
 */
export async function sendEmail({ to, subject, html, text }: SendArgs) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ?? "Registry for Groups <onboarding@resend.dev>";

  if (!key) {
    console.log(
      `\n[email:stub] → ${to}\n  subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}\n`,
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text());
    }
  } catch (e) {
    console.error("[email] send failed", (e as Error).message);
  }
}

const BRAND = "#0a0a0a";

/** Escape user-supplied text before it goes into email HTML. */
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapse whitespace (incl. tabs/newlines), trim, and clamp length. */
function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim().slice(0, 80);
}

function shell(heading: string, body: string, cta?: { url: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="font-size:18px;font-weight:600;margin-bottom:24px">🎁 Registry for Groups</div>
    <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #ececec">
      <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
      <div style="font-size:15px;line-height:1.5;color:#404040">${body}</div>
      ${
        cta
          ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:${BRAND};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">${cta.label}</a>`
          : ""
      }
    </div>
    <div style="font-size:12px;color:#999;margin-top:20px">If you didn’t expect this email, you can safely ignore it.</div>
  </div></body></html>`;
}

export function resetPasswordEmail(url: string) {
  return {
    subject: "Reset your Registry for Groups password",
    html: shell(
      "Reset your password",
      "Tap the button below to choose a new password. This link expires in one hour.",
      { url, label: "Reset password" },
    ),
    text: `Reset your Registry for Groups password (link expires in 1 hour):\n${url}`,
  };
}

/**
 * The "you're getting a present!" nudge. Deliberately generic — it NEVER names
 * the item, the buyer, or how many — so it builds excitement without ever
 * spoiling the surprise. One is picked at random for a bit of delight.
 */
const GIFT_NUDGES: Array<{ subject: string; heading: string; line: string }> = [
  { subject: "🎁 Someone loves you!", heading: "Someone loves you! 💛", line: "Somebody in your group just bought you one of the gifts on your list." },
  { subject: "You're getting a present! 🎉", heading: "You're getting a present! 🎉", line: "One of your wishes just came true — a gift was purchased for you." },
  { subject: "Psst… a gift is on its way 🤫", heading: "Psst… a gift is on its way 🤫", line: "Someone just claimed one of your wishlist items. Lucky you!" },
  { subject: "Someone just made your day 🎁", heading: "Someone just made your day 🎁", line: "A gift from your list was marked as bought. How exciting!" },
  { subject: "A surprise is brewing… ✨", heading: "A surprise is brewing… ✨", line: "One of your requested gifts is officially spoken for." },
  { subject: "Ka-ching! A gift was claimed for you 🛍️", heading: "Ka-ching! 🛍️", line: "Someone couldn't resist your wishlist and grabbed you a gift." },
  { subject: "Somebody's thinking of you 💝", heading: "Somebody's thinking of you 💝", line: "A gift you asked for was just purchased." },
  { subject: "One of your wishes is coming true ✨", heading: "A wish is coming true ✨", line: "Someone in your group bought you something straight off your list." },
  { subject: "Shhh — a present just got bought 🤐", heading: "Shhh… 🤐", line: "A gift on your list is now on its way to you." },
  { subject: "You've got a wishlist admirer 😍", heading: "You've got an admirer 😍", line: "Someone loved something on your list enough to buy it." },
  { subject: "🎁 Gift incoming!", heading: "Gift incoming! 🎁", line: "One of your requested gifts was just purchased for you." },
  { subject: "Someone couldn't resist your list 🥰", heading: "Someone couldn't resist 🥰", line: "A gift from your wishlist has been happily snapped up." },
];

export function giftPurchasedEmail(shakeUrl: string) {
  const v = GIFT_NUDGES[crypto.randomInt(0, GIFT_NUDGES.length)];
  const body = `<div style="font-size:44px;line-height:1;text-align:center;margin:2px 0 16px">🎁</div>
    <p style="margin:0 0 12px">${v.line}</p>
    <p style="margin:0;color:#737373">We're keeping it a secret <strong>which</strong> gift and <strong>who</strong> bought it — no spoilers! — but the surprise is real. 😉</p>`;
  return {
    subject: v.subject,
    html: shell(v.heading, body, { url: shakeUrl, label: "🎁 Shake your present" }),
    text: `${v.line}\n\nWe won't say which gift, or who — no spoilers! — but something from your list was just bought for you.\n\nTry to shake it (no cheating!): ${shakeUrl}`,
  };
}

export function inviteEmail(groupName: string, url: string) {
  const clean = normalize(groupName);
  const safe = esc(clean);
  return {
    subject: `You're invited to ${clean} on Registry for Groups`,
    html: shell(
      `Join ${safe} 🎁`,
      `You've been invited to join <strong>${safe}</strong> — make your wishlist and help pick gifts. This link is single-use and expires in 72 hours.`,
      { url, label: "Accept invite" },
    ),
    text: `You're invited to join ${clean} on Registry for Groups (single-use, expires in 72h):\n${url}`,
  };
}
