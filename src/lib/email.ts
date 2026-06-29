import "server-only";

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
