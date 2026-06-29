import Link from "next/link";
import { requireUser } from "@/lib/session";
import { GroupSearch } from "./group-search";

export default async function FindGroupPage() {
  await requireUser();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Link
        href="/app"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to home
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Find a group</h1>
        <p className="text-sm text-muted-foreground">
          Search by group name or the admin&apos;s email. You&apos;ll send a
          request — the admin approves it before you can see anyone&apos;s lists.
        </p>
      </div>
      <GroupSearch />
    </div>
  );
}
