"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireUser, getMembership, isAdminRole } from "@/lib/session";
import { createInviteForGroup, acceptInviteToken } from "@/lib/invites";
import { sendEmail, inviteEmail } from "@/lib/email";
import { inviteLimiter } from "@/lib/ratelimit";

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

  if (!(await inviteLimiter.limit(user.id)).success) {
    return { error: "You've created a lot of invites — try again later." };
  }

  const { token } = await createInviteForGroup(organizationId, user.id);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return { url: `${base}/join/${token}` };
}

export type EmailInviteResult = { ok: boolean; error?: string };

export async function emailInviteAction(
  organizationId: string,
  email: string,
): Promise<EmailInviteResult> {
  const user = await requireUser();
  const m = await getMembership(user.id, organizationId);
  if (!m || !isAdminRole(m.role)) return { ok: false, error: "Only admins can invite." };

  // Don't let the invite endpoint be used as a spam relay.
  if (!(await inviteLimiter.limit(user.id)).success) {
    return { ok: false, error: "You've sent a lot of invites — try again later." };
  }

  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const { token } = await createInviteForGroup(organizationId, user.id);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const mail = inviteEmail(org?.name ?? "your group", `${base}/join/${token}`);
  await sendEmail({ to: clean, ...mail });
  return { ok: true };
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
