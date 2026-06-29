import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization, user as users } from "@/db/schema";
import { requireUser, getMembership, isAdminRole } from "@/lib/session";
import { getUserListsInGroup } from "@/lib/lists";
import { getGroupPickLists } from "@/lib/picks";
import { getPendingInvites } from "@/lib/invites";
import { getPendingJoinRequests } from "@/lib/groups";
import { formatDate } from "@/lib/format";
import {
  RemoveMemberButton,
  RevokeInviteButton,
  JoinRequestActions,
} from "./admin-controls";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InvitePanel } from "./invite-panel";

const OCCASION_LABEL: Record<string, string> = {
  birthday: "Birthday",
  christmas: "Christmas",
  general: "General",
  other: "Other",
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function InviteStatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return <Badge className="bg-pine text-pine-foreground">Joined</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  return (
    <Badge variant="outline" className="capitalize text-muted-foreground">
      {status}
    </Badge>
  );
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const me = await requireUser();

  // Tenancy gate: not a member ⇒ uniform 404 (never confirm the group exists).
  const membership = await getMembership(me.id, groupId);
  if (!membership) notFound();

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, groupId))
    .limit(1);
  if (!org) notFound();

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: member.role,
    })
    .from(member)
    .innerJoin(users, eq(member.userId, users.id))
    .where(eq(member.organizationId, groupId));

  const admin = isAdminRole(membership.role);
  const myLists = await getUserListsInGroup(me.id, groupId);
  const pickLists = await getGroupPickLists(groupId);
  const joinRequests = admin ? await getPendingJoinRequests(groupId) : [];
  const pendingInvites = admin ? await getPendingInvites(groupId) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All groups
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-base">Your lists</CardTitle>
            <CardDescription>
              Make a wishlist for {org.name}. Others can claim gifts without you
              seeing.
            </CardDescription>
          </div>
          <Link
            href={`/app/groups/${groupId}/lists/new`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            New list
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col">
          {myLists.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              You haven&apos;t made a list yet.
            </p>
          ) : (
            myLists.map((l, i) => (
              <div key={l.id}>
                {i > 0 && <Separator />}
                <Link
                  href={`/app/groups/${groupId}/lists/${l.id}`}
                  className="flex items-center justify-between gap-2 py-3 hover:opacity-80"
                >
                  <span className="text-sm font-medium">{l.title}</span>
                  <Badge variant="secondary">
                    {OCCASION_LABEL[l.occasion] ?? "General"}
                  </Badge>
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-base">Pick lists</CardTitle>
            <CardDescription>
              Offer a set of options and let everyone choose. You see who picked
              what.
            </CardDescription>
          </div>
          <Link
            href={`/app/groups/${groupId}/picks/new`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            New pick list
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col">
          {pickLists.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No pick lists yet.
            </p>
          ) : (
            pickLists.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <Separator />}
                <Link
                  href={`/app/groups/${groupId}/picks/${p.id}`}
                  className="flex items-center justify-between gap-2 py-3 hover:opacity-80"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {p.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.creatorUserId === me.id ? "Yours" : `by ${p.creatorName}`}
                      {" · "}
                      {p.optionCount} {p.optionCount === 1 ? "option" : "options"}
                    </span>
                  </div>
                  {p.pickerCount > 0 && (
                    <Badge variant="secondary">
                      {p.pickerCount} chosen
                    </Badge>
                  )}
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            Open a member to see their lists and claim gifts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {members.map((m, i) => {
            const isMe = m.id === me.id;
            const identity = (
              <>
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {m.name}
                    {isMe && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </span>
                </div>
              </>
            );
            return (
              <div key={m.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-2 py-3">
                  {isMe ? (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {identity}
                    </div>
                  ) : (
                    <Link
                      href={`/app/groups/${groupId}/members/${m.id}`}
                      className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/50"
                    >
                      {identity}
                    </Link>
                  )}
                  {isAdminRole(m.role) && (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                  {admin && !isMe && (
                    <RemoveMemberButton
                      groupId={groupId}
                      userId={m.id}
                      name={m.name}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {admin && joinRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests to join</CardTitle>
            <CardDescription>
              People who found {org.name} and asked to join.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {joinRequests.map((r, i) => (
              <div key={r.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {initials(r.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {r.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.email}
                    </span>
                  </div>
                  <JoinRequestActions requestId={r.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {admin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite people</CardTitle>
            <CardDescription>
              Share a link or send an email invite to {org.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvitePanel groupId={groupId} />
          </CardContent>
        </Card>
      )}

      {admin && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email invites</CardTitle>
            <CardDescription>Invites you&apos;ve sent by email.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {pendingInvites.map((inv, i) => (
              <div key={inv.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-2 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {inv.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sent{" "}
                      {formatDate(inv.createdAt.toISOString().slice(0, 10))}
                    </span>
                  </div>
                  <InviteStatusBadge status={inv.status} />
                  {inv.status === "pending" && (
                    <RevokeInviteButton inviteId={inv.id} />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
