import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";

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
    nextCookies(), // keep last — wires Set-Cookie into Next.js server actions
  ],
});

export type Session = typeof auth.$Infer.Session;
