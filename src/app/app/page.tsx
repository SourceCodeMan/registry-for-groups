import Link from "next/link";
import { requireUser, getUserGroups } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const groups = await getUserGroups(user.id);

  if (groups.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground">
            You&apos;re not in a group yet. Create one to get started — you can
            invite everyone else once it&apos;s set up.
          </p>
        </div>
        <Link
          href="/app/groups/new"
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Create a group
        </Link>
        <p className="text-sm text-muted-foreground">
          Got an invite link? Just open it to join.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your groups</h1>
        <Link href="/app/groups/new" className={cn(buttonVariants())}>
          New group
        </Link>
      </div>
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
    </div>
  );
}
