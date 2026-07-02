"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { items, lists, picks } from "@/db/schema";
import { requireUser, getMembership } from "@/lib/session";
import { requireOwnedList } from "@/lib/lists";
import { requirePickableItem } from "@/lib/picks";
import { deleteOwnedBlob } from "@/lib/blob";

export type PickListFormState = { error?: string };
export type ActionResult = { ok: boolean; error?: string };

const titleSchema = z.string().trim().min(1).max(80);

function clampMaxPicks(value: unknown): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, n));
}

/* --------------------------- create / edit --------------------------- */

export async function createPickListAction(
  _prev: PickListFormState,
  formData: FormData,
): Promise<PickListFormState> {
  const user = await requireUser();
  const organizationId = String(formData.get("groupId") ?? "");
  const membership = await getMembership(user.id, organizationId);
  if (!membership) return { error: "You're not a member of this group." };

  const parsed = titleSchema.safeParse(formData.get("title"));
  if (!parsed.success) return { error: "Please give the pick list a name." };

  const [created] = await db
    .insert(lists)
    .values({
      organizationId,
      ownerUserId: user.id,
      title: parsed.data,
      kind: "pick",
      occasion: "general",
      maxPicksPerMember: clampMaxPicks(formData.get("maxPicks")),
    })
    .returning({ id: lists.id });

  redirect(`/app/groups/${organizationId}/picks/${created.id}`);
}

export async function updatePickListAction(
  listId: string,
  input: { title: string; maxPicksPerMember: number },
): Promise<ActionResult> {
  const user = await requireUser();
  const list = await requireOwnedList(user.id, listId);
  if (!list || list.kind !== "pick") return { ok: false, error: "Not found." };

  const parsed = titleSchema.safeParse(input.title);
  if (!parsed.success)
    return { ok: false, error: "Please give the pick list a name." };

  await db
    .update(lists)
    .set({
      title: parsed.data,
      maxPicksPerMember: clampMaxPicks(input.maxPicksPerMember),
    })
    .where(eq(lists.id, listId));
  return { ok: true };
}

export async function deletePickListAction(listId: string): Promise<void> {
  const user = await requireUser();
  const list = await requireOwnedList(user.id, listId);
  if (!list || list.kind !== "pick") redirect("/app");
  const groupId = list!.organizationId;
  const imgs = await db
    .select({ imageUrl: items.imageUrl })
    .from(items)
    .where(eq(items.listId, listId));
  await db.delete(lists).where(eq(lists.id, listId));
  await Promise.all(imgs.map((r) => deleteOwnedBlob(r.imageUrl)));
  redirect(groupId ? `/app/groups/${groupId}` : "/app");
}

/* ------------------------------- pick -------------------------------- */

/**
 * Toggle the viewer's choice of one option. With maxPicksPerMember = 1 this is
 * radio behaviour (choosing a new option replaces the old one); above 1 it's
 * checkbox behaviour capped at the list's limit.
 */
export async function togglePickAction(
  listId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string; picked?: boolean }> {
  const user = await requireUser();
  const row = await requirePickableItem(user.id, itemId);
  if (!row || row.item.listId !== listId)
    return { ok: false, error: "Not found." };

  const [existing] = await db
    .select({ id: picks.id })
    .from(picks)
    .where(and(eq(picks.itemId, itemId), eq(picks.pickerUserId, user.id)))
    .limit(1);

  if (existing) {
    await db.delete(picks).where(eq(picks.id, existing.id));
    return { ok: true, picked: false };
  }

  const max = row.list.maxPicksPerMember;
  try {
    if (max <= 1) {
      // Single-choice: replace any prior pick on this list.
      await db.transaction(async (tx) => {
        await tx
          .delete(picks)
          .where(
            and(eq(picks.listId, listId), eq(picks.pickerUserId, user.id)),
          );
        await tx
          .insert(picks)
          .values({ listId, itemId, pickerUserId: user.id });
      });
    } else {
      const [{ n } = { n: 0 }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(picks)
        .where(
          and(eq(picks.listId, listId), eq(picks.pickerUserId, user.id)),
        );
      if ((n ?? 0) >= max)
        return {
          ok: false,
          error: `You can choose up to ${max} option${max === 1 ? "" : "s"}.`,
        };
      await db.insert(picks).values({ listId, itemId, pickerUserId: user.id });
    }
  } catch {
    // Unique (item, picker) race — the pick already exists, treat as success.
    return { ok: true, picked: true };
  }
  return { ok: true, picked: true };
}
