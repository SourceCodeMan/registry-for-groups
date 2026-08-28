"use server";

import { redirect } from "next/navigation";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { items, lists } from "@/db/schema";
import { requireUser, getMembership } from "@/lib/session";
import { requireOwnedList, requireOwnedItem } from "@/lib/lists";
import { deleteOwnedBlob } from "@/lib/blob";

/* ----------------------------- validation ----------------------------- */

const OCCASIONS = ["birthday", "christmas", "general", "other"] as const;

const listSchema = z.object({
  title: z.string().trim().min(1).max(80),
  occasion: z.enum(OCCASIONS).catch("general"),
  eventDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

/** Validate an optional URL. https-only when `httpsOnly`, else http(s). */
function cleanUrl(
  value: unknown,
  opts: { httpsOnly?: boolean } = {},
): string | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    if (u.protocol === "https:") return u.toString();
    if (u.protocol === "http:" && !opts.httpsOnly) return u.toString();
    return false;
  } catch {
    return false;
  }
}

const itemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  url: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  price: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export type ItemInput = z.input<typeof itemSchema>;

const MAX_CENTS = 99_999_999;

function priceToCents(price?: string | null): number | null {
  if (!price) return null;
  const n = Number.parseFloat(String(price).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(MAX_CENTS, Math.round(n * 100));
}

/* ------------------------------- lists -------------------------------- */

export type ListFormState = { error?: string };

export async function createListAction(
  _prev: ListFormState,
  formData: FormData,
): Promise<ListFormState> {
  const user = await requireUser();
  const organizationId = String(formData.get("groupId") ?? "");
  const membership = await getMembership(user.id, organizationId);
  if (!membership) return { error: "You're not a member of this group." };

  const parsed = listSchema.safeParse({
    title: formData.get("title"),
    occasion: formData.get("occasion"),
    eventDate: formData.get("eventDate"),
  });
  if (!parsed.success) return { error: "Please enter a list name." };

  const { title, occasion, eventDate } = parsed.data;
  const [created] = await db
    .insert(lists)
    .values({
      organizationId,
      ownerUserId: user.id,
      title,
      occasion,
      eventDate: eventDate ? eventDate : null,
    })
    .returning({ id: lists.id });

  redirect(`/app/groups/${organizationId}/lists/${created.id}`);
}

export async function updateListAction(
  listId: string,
  input: { title: string; occasion: string; eventDate?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const list = await requireOwnedList(user.id, listId);
  if (!list) return { ok: false, error: "Not found." };

  const parsed = listSchema.safeParse({
    title: input.title,
    occasion: input.occasion,
    eventDate: input.eventDate ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please enter a list name." };

  await db
    .update(lists)
    .set({
      title: parsed.data.title,
      occasion: parsed.data.occasion,
      eventDate: parsed.data.eventDate ? parsed.data.eventDate : null,
    })
    .where(eq(lists.id, listId));
  return { ok: true };
}

export async function deleteListAction(listId: string): Promise<void> {
  const user = await requireUser();
  const list = await requireOwnedList(user.id, listId);
  if (!list) redirect("/app");
  const imgs = await db
    .select({ imageUrl: items.imageUrl })
    .from(items)
    .where(eq(items.listId, listId));
  await db.delete(lists).where(eq(lists.id, listId));
  await Promise.all(imgs.map((r) => deleteOwnedBlob(r.imageUrl, user.id)));
  redirect(list!.organizationId ? `/app/groups/${list!.organizationId}` : "/app");
}

/* ------------------------------- items -------------------------------- */

export type ItemActionResult = { ok: boolean; error?: string };

function validateItem(data: ItemInput) {
  const parsed = itemSchema.safeParse(data);
  if (!parsed.success) return { error: "Please enter an item name." as const };

  const url = cleanUrl(parsed.data.url);
  if (url === false) return { error: "That product link isn't a valid URL." };
  const imageUrl = cleanUrl(parsed.data.imageUrl, { httpsOnly: true });
  if (imageUrl === false)
    return { error: "The image URL must start with https://" };

  return {
    values: {
      title: parsed.data.title,
      description: parsed.data.description?.trim() || null,
      url,
      imageUrl,
      priceCents: priceToCents(parsed.data.price),
      quantity: parsed.data.quantity,
    },
  };
}

export async function createItemAction(
  listId: string,
  data: ItemInput,
): Promise<ItemActionResult> {
  const user = await requireUser();
  const list = await requireOwnedList(user.id, listId);
  if (!list) return { ok: false, error: "Not found." };

  const v = validateItem(data);
  if ("error" in v) return { ok: false, error: v.error };

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from lists where id = ${listId} for update`,
      );
      if (list.kind === "pick") {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(items)
          .where(eq(items.listId, listId));
        if ((n ?? 0) >= 10) {
          throw new Error("PICK_CAP");
        }
      }
      const [{ max } = { max: 0 }] = await tx
        .select({ max: sql<number>`coalesce(max(${items.sortOrder}), 0)` })
        .from(items)
        .where(eq(items.listId, listId));
      await tx.insert(items).values({
        listId,
        ...v.values,
        sortOrder: (max ?? 0) + 1,
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "PICK_CAP") {
      return { ok: false, error: "A pick list can have at most 10 options." };
    }
    throw e;
  }
  return { ok: true };
}

export async function updateItemAction(
  itemId: string,
  data: ItemInput,
): Promise<ItemActionResult> {
  const user = await requireUser();
  const owned = await requireOwnedItem(user.id, itemId);
  if (!owned) return { ok: false, error: "Not found." };

  const v = validateItem(data);
  if ("error" in v) return { ok: false, error: v.error };

  const oldImage = owned.item.imageUrl;
  await db.update(items).set(v.values).where(eq(items.id, itemId));
  // A swapped-out photo we hosted shouldn't linger publicly.
  if (oldImage && oldImage !== v.values.imageUrl) {
    await deleteOwnedBlob(oldImage, user.id);
  }
  return { ok: true };
}

export async function deleteItemAction(
  itemId: string,
): Promise<ItemActionResult> {
  const user = await requireUser();
  const owned = await requireOwnedItem(user.id, itemId);
  if (!owned) return { ok: false, error: "Not found." };
  await db.delete(items).where(eq(items.id, itemId));
  await deleteOwnedBlob(owned.item.imageUrl, user.id);
  return { ok: true };
}

/** Swap an item's sort position with its neighbor in the given direction. */
export async function moveItemAction(
  itemId: string,
  dir: "up" | "down",
): Promise<ItemActionResult> {
  const user = await requireUser();
  const owned = await requireOwnedItem(user.id, itemId);
  if (!owned) return { ok: false, error: "Not found." };

  const current = owned.item;
  const neighbor = (
    await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.listId, current.listId),
          dir === "up"
            ? lt(items.sortOrder, current.sortOrder)
            : gt(items.sortOrder, current.sortOrder),
        ),
      )
      .orderBy(
        dir === "up" ? desc(items.sortOrder) : asc(items.sortOrder),
      )
      .limit(1)
  )[0];
  if (!neighbor) return { ok: true }; // already at the edge

  await db.transaction(async (tx) => {
    await tx
      .update(items)
      .set({ sortOrder: neighbor.sortOrder })
      .where(eq(items.id, current.id));
    await tx
      .update(items)
      .set({ sortOrder: current.sortOrder })
      .where(eq(items.id, neighbor.id));
  });
  return { ok: true };
}
