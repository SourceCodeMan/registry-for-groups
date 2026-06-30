import Link from "next/link";
import { requireSuperAdmin, getAppStats } from "@/lib/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminPage() {
  await requireSuperAdmin();
  const s = await getAppStats();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to app
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Owner dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Application-wide stats. Only you can see this page.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          People &amp; content
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Signups" value={s.users.toLocaleString()} />
          <Stat label="Groups" value={s.groups.toLocaleString()} />
          <Stat
            label="Wishlists"
            value={s.wishlists.toLocaleString()}
            hint={`+ ${s.pickLists.toLocaleString()} pick lists`}
          />
          <Stat
            label="Items requested"
            value={s.itemsRequested.toLocaleString()}
            hint="across all wishlists"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Gifting</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Gifts reserved" value={s.reserved.toLocaleString()} />
          <Stat
            label="Gifts purchased"
            value={s.gifted.toLocaleString()}
            hint="marked as bought"
          />
          <Stat label="Pick-list choices" value={s.picks.toLocaleString()} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Traffic &amp; storage
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Visits (all time)"
            value={s.viewsAll.toLocaleString()}
            hint={`${s.viewsToday.toLocaleString()} today · ${s.views7d.toLocaleString()} this week · ${s.views30d.toLocaleString()} this month`}
          />
          <Stat label="Database size" value={s.dbSize} />
        </div>
      </section>
    </div>
  );
}
