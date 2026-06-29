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
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    occasion: text("occasion").notNull().default("general"),
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
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  item: one(items, { fields: [claims.itemId], references: [items.id] }),
  buyer: one(user, { fields: [claims.buyerUserId], references: [user.id] }),
}));
