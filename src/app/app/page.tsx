import Link from "next/link";
import { requireUser, getUserGroups } from "@/lib/session";
import { getUserPersonalLists } from "@/lib/lists";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OCCASION_LABEL } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  family: "Family",
  friends: "Friends",
  office: "Office",
  other: "Group",
};

function groupType(metadata: string | null): string {
  if (!metadata) return "other";
  try {
    const t = JSON.parse(metadata)?.type;
    return typeof t === "string" ? t : "other";
  } catch {
    return "other";
  }
}

export default async function AppHome() {
  const user = await requireUser();
  const [groups, personalLists] = await Promise.all([
    getUserGroups(user.id),
    getUserPersonalLists(user.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Your groups</h1>
          <div className="flex gap-2">
            <Link
              href="/app/groups/find"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Find a group
            </Link>
            <Link href="/app/groups/new" className={cn(buttonVariants())}>
              New group
            </Link>
          </div>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                You&apos;re not in a group yet
              </CardTitle>
              <CardDescription>
                Create one, find an existing group, or open an invite link.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <Link key={g.id} href={`/app/groups/${g.id}`} className="block">
                <Card className="transition-colors hover:border-foreground/30">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{g.name}</CardTitle>
                      <Badge variant="secondary">
                        {TYPE_LABEL[groupType(g.metadata)] ?? "Group"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {g.role === "owner" || g.role === "admin"
                        ? "You're an admin"
                        : "Member"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {personalLists.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Personal lists
            </h2>
            <p className="text-sm text-muted-foreground">
              Lists that aren&apos;t shared with any group.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {personalLists.map((l) => (
              <Link key={l.id} href={`/app/lists/${l.id}`} className="block">
                <Card className="transition-colors hover:border-foreground/30">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{l.title}</CardTitle>
                      <Badge variant="secondary">
                        {OCCASION_LABEL[l.occasion] ?? "General"}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
