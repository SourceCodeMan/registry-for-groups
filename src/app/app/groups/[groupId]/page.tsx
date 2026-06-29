import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization, user as users } from "@/db/schema";
import { requireUser, getMembership, isAdminRole } from "@/lib/session";
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
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {members.map((m, i) => (
            <div key={m.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 py-3">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {m.name}
                    {m.id === me.id && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.email}
                  </span>
                </div>
                {isAdminRole(m.role) && <Badge variant="secondary">Admin</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {admin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite people</CardTitle>
            <CardDescription>
              Share a link to add someone to {org.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvitePanel groupId={groupId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
