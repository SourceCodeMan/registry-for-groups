"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireUser, getMembership, isAdminRole } from "@/lib/session";
import { createInviteForGroup, acceptInviteToken } from "@/lib/invites";

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "group"
  );
}

const groupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["family", "friends", "office", "other"]).catch("family"),
});

export type GroupFormState = { error?: string };

export async function createGroupAction(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await requireUser();
  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: "Please enter a group name." };

  const { name, type } = parsed.data;
  const slug = `${slugify(name)}-${crypto.randomBytes(3).toString("hex")}`;

  let orgId: string | undefined;
  try {
    const org = await auth.api.createOrganization({
      body: { name, slug, metadata: { type } },
      headers: await headers(),
    });
    orgId = org?.id;
  } catch {
    return { error: "Could not create the group. Please try again." };
  }
  if (!orgId) return { error: "Could not create the group." };

  redirect(`/app/groups/${orgId}`);
}

export type InviteResult = { url?: string; error?: string };

export async function createInviteAction(
  organizationId: string,
): Promise<InviteResult> {
  const user = await requireUser();
  const m = await getMembership(user.id, organizationId);
  if (!m || !isAdminRole(m.role)) return { error: "Only admins can invite." };

  const { token } = await createInviteForGroup(organizationId, user.id);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return { url: `${base}/join/${token}` };
}

export type AcceptState = { error?: string };

export async function acceptInviteAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const res = await acceptInviteToken(token, user.id);
  if (!res.ok) return { error: "This invite is invalid or has expired." };
  redirect(`/app/groups/${res.organizationId}`);
}
