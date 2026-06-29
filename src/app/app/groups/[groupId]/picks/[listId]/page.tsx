import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getPickList } from "@/lib/picks";
import { Badge } from "@/components/ui/badge";
import { ItemCard } from "@/components/list/item-card";
import { ItemDialog } from "@/components/list/item-dialog";
import { PickSettings } from "./pick-settings";
import { MemberPickView } from "./member-pick-view";

export default async function PickListPage({
  params,
}: {
  params: Promise<{ groupId: string; listId: string }>;
}) {
  const { groupId, listId } = await params;
  const user = await requireUser();

  const data = await getPickList(user.id, listId);
  // Uniform 404 if it isn't a pick list in a group this user belongs to, or the
  // listId doesn't line up with the group in the URL.
  if (!data || data.list.organizationId !== groupId) notFound();

  const { list, isCreator, creatorName, options, myPickedItemIds, results } =
    data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/groups/${groupId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to group
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {list.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Pick list</Badge>
              {!isCreator && <span>from {creatorName}</span>}
            </div>
          </div>
          {isCreator && (
            <PickSettings
              list={{
                id: list.id,
                title: list.title,
                maxPicksPerMember: list.maxPicksPerMember,
              }}
            />
          )}
        </div>
      </div>

      {isCreator ? (
        <CreatorView
          listId={list.id}
          maxPicks={list.maxPicksPerMember}
          options={options}
          results={results ?? []}
        />
      ) : (
        <MemberView
          listId={list.id}
          maxPicks={list.maxPicksPerMember}
          options={options}
          initialPicked={myPickedItemIds}
        />
      )}
    </div>
  );
}

/* ----------------------------- creator ------------------------------- */

function CreatorView({
  listId,
  maxPicks,
  options,
  results,
}: {
  listId: string;
  maxPicks: number;
  options: import("@/lib/picks").PickOption[];
  results: NonNullable<import("@/lib/picks").PickListView["results"]>;
}) {
  const pickersByItem = new Map(results.map((r) => [r.itemId, r.pickers]));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {`Members each choose ${maxPicks <= 1 ? "one option" : `up to ${maxPicks} options`}. You'll see who picked what below.`}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {options.length}/10 options
          </span>
        </div>

        {options.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Add the options people will choose from.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {options.map((opt, i) => (
              <ItemCard
                key={opt.id}
                listId={listId}
                item={{
                  id: opt.id,
                  title: opt.title,
                  description: opt.description,
                  url: opt.url,
                  imageUrl: opt.imageUrl,
                  priceCents: opt.priceCents,
                  quantity: 1,
                }}
                isFirst={i === 0}
                isLast={i === options.length - 1}
                mode="option"
              />
            ))}
          </div>
        )}

        {options.length < 10 && (
          <div>
            <ItemDialog
              listId={listId}
              triggerLabel="+ Add option"
              triggerVariant="outline"
              mode="option"
            />
          </div>
        )}
      </section>

      {options.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Who&apos;s chosen</h2>
          <div className="flex flex-col gap-3">
            {options.map((opt) => {
              const pickers = pickersByItem.get(opt.id) ?? [];
              return (
                <div
                  key={opt.id}
                  className="flex flex-col gap-1.5 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium [overflow-wrap:anywhere]">
                      {opt.title}
                    </span>
                    <Badge variant={pickers.length ? "default" : "outline"}>
                      {pickers.length}
                    </Badge>
                  </div>
                  {pickers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No one yet.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {pickers.map((p) => p.name).join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------ member ------------------------------- */

function MemberView({
  listId,
  maxPicks,
  options,
  initialPicked,
}: {
  listId: string;
  maxPicks: number;
  options: import("@/lib/picks").PickOption[];
  initialPicked: string[];
}) {
  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        There&apos;s nothing to choose from yet — check back soon.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {maxPicks <= 1
          ? "🎁 Choose the one you'd like."
          : `🎁 Choose up to ${maxPicks} — tap to select.`}
      </p>
      <MemberPickView
        listId={listId}
        maxPicks={maxPicks}
        options={options}
        initialPicked={initialPicked}
      />
    </div>
  );
}
