import Link from "next/link";
import {
  requireSuperAdmin,
  getAppStats,
  getGroupOverviews,
} from "@/lib/admin";
import { formatDate } from "@/lib/format";
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
  const [s, groups] = await Promise.all([getAppStats(), getGroupOverviews()]);

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
          Application-wide stats and every group using Registry for Groups.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          People &amp; content
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Signups" value={s.users.toLocaleString()} />
          <Stat
            label="Verified accounts"
            value={s.verifiedUsers.toLocaleString()}
            hint={`${s.users7d.toLocaleString()} signed up in the last 7 days`}
          />
          <Stat
            label="Groups"
            value={s.groups.toLocaleString()}
            hint={`${s.groups7d.toLocaleString()} created in the last 7 days`}
          />
          <Stat
            label="Memberships"
            value={s.memberships.toLocaleString()}
            hint={`${s.admins.toLocaleString()} group admins`}
          />
          <Stat
            label="Wishlists"
            value={s.wishlists.toLocaleString()}
            hint={`${s.pickLists.toLocaleString()} pick lists · ${s.archivedLists.toLocaleString()} archived`}
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
          <Stat
            label="Live invite links"
            value={s.liveInvites.toLocaleString()}
            hint="not used, revoked, or expired"
          />
          <Stat
            label="Join requests"
            value={s.joinRequestsPending.toLocaleString()}
            hint={`${s.joinRequestsApproved.toLocaleString()} approved · ${s.joinRequestsDenied.toLocaleString()} declined`}
          />
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

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            All groups
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A complete activity summary, including groups you do not belong to.
            Claim data is aggregated only; this never exposes gift buyers or
            item-level claim details.
          </p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {groups.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No groups have been created yet.
              </p>
            ) : (
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Group</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                    <th className="px-3 py-3 text-right font-medium">People</th>
                    <th className="px-3 py-3 text-right font-medium">Lists</th>
                    <th className="px-3 py-3 text-right font-medium">Requested</th>
                    <th className="px-3 py-3 text-right font-medium">Reserved</th>
                    <th className="px-3 py-3 text-right font-medium">Purchased</th>
                    <th className="px-3 py-3 text-right font-medium">Join queue</th>
                    <th className="px-4 py-3 text-right font-medium">Live invites</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{g.name}</div>
                        <div className="text-xs text-muted-foreground">/{g.slug}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatDate(g.createdAt.toISOString().slice(0, 10))}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {g.members} <span className="text-xs text-muted-foreground">({g.admins} admins)</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {g.wishlists + g.pickLists}
                        <span className="text-xs text-muted-foreground"> ({g.wishlists} + {g.pickLists})</span>
                      </td>
                      <td className="px-3 py-3 text-right">{g.itemsRequested}</td>
                      <td className="px-3 py-3 text-right">{g.reserved}</td>
                      <td className="px-3 py-3 text-right">{g.gifted}</td>
                      <td className="px-3 py-3 text-right">
                        {g.joinRequestsPending}
                        <span className="text-xs text-muted-foreground"> ({g.joinRequestsApproved} approved)</span>
                      </td>
                      <td className="px-4 py-3 text-right">{g.liveInvites}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
