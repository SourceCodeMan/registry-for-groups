import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { sendEmail, resetPasswordEmail, verifyEmail } from "@/lib/email";
import { prepareAccountDeletion } from "@/lib/account";
import { validateSlug } from "@/lib/slug";

// Cloudflare Turnstile guards signup + reset-email. Both keys must be set
// together: the widget is gated on the public site key, the plugin on the
// secret. A one-sided config would show a widget that the server ignores
// (or reject tokens the client never sends).
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
const turnstileSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
if (process.env.VERCEL_ENV === "production") {
  if (!turnstileSecret || !turnstileSite) {
    console.error(
      "TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY should both be set in production",
    );
  }
}

/**
 * Better Auth instance.
 *
 * - Email + password accounts (no third-party SSO in v1).
 * - DB-backed, server-side sessions (the `session` table) so logout and
 *   member-removal are *actually* revocable — a kicked member is locked out
 *   immediately, unlike a stateless JWT.
 * - `organization` plugin models our **Group** / **Membership**. Invite,
 *   leave, delete, and role changes go through our own server actions; the
 *   plugin HTTP surface for those is disabled.
 * - Rate limiting uses the database store (no external Redis needed for v1).
 */
export const auth = betterAuth({
  appName: "Registry for Groups",
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    // Don't mint a session until the address is proven — also makes duplicate
    // signup return a generic response instead of an email oracle.
    autoSignIn: false,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    // A reset is the canonical "my account is compromised" action — kill every
    // other session so a stolen cookie can't outlive the reset.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const mail = resetPasswordEmail(url);
      await sendEmail({ to: user.email, ...mail });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const mail = verifyEmail(url);
      await sendEmail({ to: user.email, ...mail });
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      // Re-confirm with the password at the call site. Before the row is
      // removed, run domain cleanup / sole-admin guard.
      beforeDelete: async (user) => {
        await prepareAccountDeletion(user.id);
      },
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
  // The organization plugin is an internal helper for createOrganization.
  // Membership, invites, leave, and delete go through our own server actions
  // so claim/list cleanup and member-only invites actually run. These HTTP
  // paths would bypass that.
  disabledPaths: [
    "/organization/delete",
    "/organization/update",
    "/organization/invite-member",
    "/organization/accept-invitation",
    "/organization/cancel-invitation",
    "/organization/reject-invitation",
    "/organization/update-member-role",
    "/organization/remove-member",
    "/organization/leave",
    "/organization/list-invitations",
    "/organization/get-full-organization",
  ],
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      disableOrganizationDeletion: true,
      invitationExpiresIn: 60 * 60 * 72,
      organizationHooks: {
        beforeCreateOrganization: async ({ organization: org }) => {
          const v = validateSlug(org.slug ?? "");
          if (!v.ok) {
            throw new APIError("BAD_REQUEST", { message: v.error });
          }
          return { data: { ...org, slug: v.slug } };
        },
        beforeUpdateOrganization: async ({ organization: org }) => {
          if (org.slug == null) return;
          const v = validateSlug(org.slug);
          if (!v.ok) {
            throw new APIError("BAD_REQUEST", { message: v.error });
          }
          return { data: { ...org, slug: v.slug } };
        },
        beforeCreateInvitation: async ({ invitation }) => {
          return { data: { ...invitation, role: "member" } };
        },
      },
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
