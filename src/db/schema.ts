import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  date,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// Re-export the Better Auth tables (user/session/account/verification/
// organization/member/invitation/rateLimit). `organization` == Group and
// `member` == Membership in our domain language.
export * from "./auth-schema";
import { organization, user } from "./auth-schema";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * A wishlist owned by one user inside one group. A user can have many lists
 * (birthday / christmas / general / other).
 */
export const lists = pgTable(
  "lists",
  {
    id: id(),
    // Nullable: a list with no org is a "personal" list (e.g. after the owner
    // is removed from a group) — visible only to the owner.
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    occasion: text("occasion").notNull().default("general"),
    // 'wishlist' (default): the owner lists what THEY want; others secretly
    // claim. 'pick': the owner offers a fixed set of options and group members
    // each choose one (or up to maxPicksPerMember) — and the owner DOES see who
    // picked what, so they can fulfill it. The two kinds never share claim/pick
    // data paths.
    kind: text("kind").notNull().default("wishlist"),
    maxPicksPerMember: integer("max_picks_per_member").notNull().default(1),
    eventDate: date("event_date"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("lists_org_idx").on(t.organizationId),
    index("lists_owner_idx").on(t.ownerUserId),
    check(
      "lists_occasion_chk",
      sql`${t.occasion} in ('birthday','christmas','general','other')`,
    ),
    check("lists_kind_chk", sql`${t.kind} in ('wishlist','pick')`),
  ],
);

/**
 * An item on a list. `updated_at` is touched ONLY by owner edits — never by a
 * claim — so it can never become a side-channel that leaks claim activity to
 * the owner.
 */
export const items = pgTable(
  "items",
  {
    id: id(),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents"),
    currency: text("currency").notNull().default("USD"),
    priority: integer("priority").notNull().default(0),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("items_list_idx").on(t.listId)],
);

/**
 * The claim / purchase record — also the permanent **audit log** of who bought
 * what. NEVER exposed through any API/UI. One row per (item, buyer).
 *
 * `buyerUserId` is `set null` on user-account deletion so the row (and the
 * item's claim state) survives; member *removal* deletes only the membership,
 * not the user, so audit identity is preserved in the common case.
 */
export const claims = pgTable(
  "claims",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    buyerUserId: text("buyer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    state: text("state").notNull().default("reserved"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("claims_item_idx").on(t.itemId),
    uniqueIndex("claims_item_buyer_uidx").on(t.itemId, t.buyerUserId),
    check("claims_state_chk", sql`${t.state} in ('reserved','purchased')`),
  ],
);

/**
 * A member's selection on a `kind = 'pick'` list. UNLIKE `claims`, this is NOT
 * secret — the list's owner is meant to see who picked what so they can fulfill
 * it. One row per (item, picker); a member may hold up to the list's
 * `maxPicksPerMember` rows across the list. Kept entirely separate from the
 * `claims` secrecy engine so the two can never cross-contaminate.
 */
export const picks = pgTable(
  "picks",
  {
    id: id(),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    pickerUserId: text("picker_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("picks_list_idx").on(t.listId),
    index("picks_item_idx").on(t.itemId),
    uniqueIndex("picks_item_picker_uidx").on(t.itemId, t.pickerUserId),
  ],
);

/**
 * Shareable invite links into a group. We store only a SHA-256 hash of the
 * token (the raw token lives in the link), so a DB leak never yields usable
 * invites. Default is single-use (maxUses=1) and role is always `member` — an
 * admin is promoted only by an existing admin, never via a forwardable link.
 */
export const groupInvites = pgTable(
  "group_invites",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email"),
    role: text("role").notNull().default("member"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("group_invites_org_idx").on(t.organizationId),
    check("group_invites_role_chk", sql`${t.role} = 'member'`),
  ],
);

/**
 * A request to join a group (search-and-join). An admin approves/denies; only
 * an approval creates a membership, so a stranger who finds the group name
 * can't see anyone's lists.
 */
export const joinRequests = pgTable(
  "join_requests",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("join_requests_org_idx").on(t.organizationId),
    uniqueIndex("join_requests_org_user_uidx").on(t.organizationId, t.userId),
    check(
      "join_requests_status_chk",
      sql`${t.status} in ('pending','approved','denied')`,
    ),
  ],
);

/**
 * A privacy-light daily visit counter — one row per day, just a tally. No PII,
 * no per-user tracking; fed by a client beacon and read on the owner's
 * analytics page.
 */
export const pageViews = pgTable("page_views", {
  day: date("day").primaryKey(),
  views: integer("views").notNull().default(0),
});

/**
 * Debounce for the "you're getting a present!" nudge. We email a list owner at
 * most once per window when their items get purchased — deliberately generic
 * (never which item, who, or how many), so it builds excitement without ever
 * spoiling the no-spoiler guarantee. One row per owner records the last send.
 */
export const giftNotifications = pgTable("gift_notifications", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastSentAt: timestamp("last_sent_at").defaultNow().notNull(),
});

export const listsRelations = relations(lists, ({ one, many }) => ({
  organization: one(organization, {
    fields: [lists.organizationId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [lists.ownerUserId],
    references: [user.id],
  }),
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  list: one(lists, { fields: [items.listId], references: [lists.id] }),
  claims: many(claims),
  picks: many(picks),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  item: one(items, { fields: [claims.itemId], references: [items.id] }),
  buyer: one(user, { fields: [claims.buyerUserId], references: [user.id] }),
}));

export const picksRelations = relations(picks, ({ one }) => ({
  list: one(lists, { fields: [picks.listId], references: [lists.id] }),
  item: one(items, { fields: [picks.itemId], references: [items.id] }),
  picker: one(user, { fields: [picks.pickerUserId], references: [user.id] }),
}));
