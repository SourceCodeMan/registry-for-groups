import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { member, joinRequests } from "@/db/schema";
import { getSession, getMembership } from "@/lib/session";
import { getGroupBySlug } from "@/lib/groups";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinViaLink, type JoinState } from "./join-via-link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await getGroupBySlug(slug);
  // Vanity group pages are private by design — never index them.
  if (!org) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `Join ${org.name}`,
    description: `${org.name} on Registry for Groups.`,
    robots: { index: false, follow: false },
  };
}

export default async function GroupLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getGroupBySlug(slug);
  if (!org) notFound();

  const session = await getSession();
  const me = session?.user ?? null;

  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.organizationId, org.id));

  let state: JoinState = "guest";
  if (me) {
    const membership = await getMembership(me.id, org.id);
    if (membership) {
      state = "member";
    } else {
      const [req] = await db
        .select({ id: joinRequests.id })
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.organizationId, org.id),
            eq(joinRequests.userId, me.id),
            eq(joinRequests.status, "pending"),
          ),
        )
        .limit(1);
      state = req ? "pending" : "canRequest";
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          🎁 Registry for Groups
        </Link>
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl [overflow-wrap:anywhere]">
              {org.name}
            </CardTitle>
            <CardDescription>
              {count} {count === 1 ? "member" : "members"} · a private gift group
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinViaLink organizationId={org.id} slug={org.slug} state={state} />
          </CardContent>
        </Card>
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          No spoilers — the list owner never sees who claimed what, and no one
          sees who bought what.
        </p>
      </div>
    </main>
  );
}
