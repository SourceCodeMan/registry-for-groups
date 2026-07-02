/**
 * Vanity-slug rules, shared by the server (authoritative validation) and the
 * client (cosmetic live preview). Pure functions — no DB, no server-only.
 */

/**
 * Slugs that would shadow a real route, look like a system page, or invite
 * impersonation. A group slug can never be one of these. (Next.js already
 * resolves concrete routes ahead of the `/[slug]` catch-all, but reserving
 * them keeps links unambiguous and blocks abuse.)
 */
export const RESERVED_SLUGS = new Set([
  "app", "api", "join", "r", "u", "g", "s", "auth",
  "login", "signin", "sign-in", "signup", "sign-up", "logout", "signout",
  "forgot-password", "reset-password", "verify", "verification",
  "settings", "setting", "account", "accounts", "admin", "administrator",
  "dashboard", "new", "create", "edit", "find", "search", "explore",
  "help", "support", "contact", "about", "faq",
  "terms", "privacy", "legal", "cookies", "policy", "policies",
  "blog", "pricing", "plans", "plan", "billing", "upgrade", "pro",
  "home", "index", "public", "static", "assets", "asset",
  "images", "image", "img", "media", "files", "file",
  "favicon", "robots", "sitemap", "manifest", "webmanifest", "well-known",
  "_next", "next", "vercel", "status", "health", "ping",
  "me", "you", "us", "team", "owner", "surprise",
  "group", "groups", "list", "lists", "gift", "gifts",
  "registry", "registries", "pick", "picks", "wishlist", "wishlists",
]);

const MIN_LEN = 3;
const MAX_LEN = 32;

/** Lowercase, strip accents, collapse non-alphanumerics to single hyphens. */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // drop accents so "café" -> "cafe"
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string };

/** Authoritative validation. Returns the normalized slug or a friendly error. */
export function validateSlug(input: string): SlugCheck {
  const slug = normalizeSlug(input);
  if (slug.length < MIN_LEN)
    return { ok: false, error: `Use at least ${MIN_LEN} letters or numbers.` };
  if (slug.length > MAX_LEN)
    return { ok: false, error: `Keep it under ${MAX_LEN} characters.` };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return { ok: false, error: "Use only letters, numbers, and hyphens." };
  if (RESERVED_SLUGS.has(slug))
    return { ok: false, error: "That link is reserved — try another." };
  return { ok: true, slug };
}
