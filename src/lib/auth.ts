import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { sendEmail, resetPasswordEmail } from "@/lib/email";

// Cloudflare Turnstile guards the two abuse-prone, unauthenticated endpoints
// (account creation and reset-email requests). It's only wired in when the
// secret is present, so the app keeps working in any environment that hasn't
// set the keys yet — the matching client widget is gated on the public site
// key the same way (see src/components/turnstile.tsx).
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

/**
 * Better Auth instance.
 *
 * - Email + password accounts (no third-party SSO in v1).
 * - DB-backed, server-side sessions (the `session` table) so logout and
 *   member-removal are *actually* revocable — a kicked member is locked out
 *   immediately, unlike a stateless JWT.
 * - `organization` plugin models our **Group** (organization) / **Membership**
 *   (member) / **Invite** (invitation). We constrain invite roles to `member`
 *   in our own server actions; admin is granted only by an existing admin.
 * - Rate limiting uses the database store (no external Redis needed for v1).
 */
export const auth = betterAuth({
  appName: "Registry for Groups",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    // A reset is the canonical "my account is compromised" action — kill every
    // other session so a stolen cookie can't outlive the reset.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const mail = resetPasswordEmail(url);
      await sendEmail({ to: user.email, ...mail });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh once per day
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      // A creator becomes the group's owner/admin. Invitation expiry is short
      // (72h) and single-use; we force role=member at the call site.
      invitationExpiresIn: 60 * 60 * 72,
    }),
    ...(turnstileSecret
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: turnstileSecret,
            // Protect signup + reset-request only; normal login is left
            // un-gated so returning users never face a challenge.
            endpoints: ["/sign-up/email", "/request-password-reset"],
          }),
        ]
      : []),
    nextCookies(), // keep last — wires Set-Cookie into Next.js server actions
  ],
});

export type Session = typeof auth.$Infer.Session;
