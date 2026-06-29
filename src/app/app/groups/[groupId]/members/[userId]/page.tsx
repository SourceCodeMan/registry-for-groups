import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getMemberListsForViewer } from "@/lib/claims";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice, OCCASION_LABEL } from "@/lib/format";
import { ClaimButtons } from "@/components/claim-buttons";

export default async function MemberListsPage({
  params,
}: {
  params: Promise<{ groupId: string; userId: string }>;
}) {
  const { groupId, userId } = await params;
  const me = await requireUser();

  // Viewing yourself here would expose claim state on your own list — bounce
  // to your own (claim-free) management view instead.
  if (userId === me.id) redirect(`/app/groups/${groupId}`);

  const data = await getMemberListsForViewer(me.id, groupId, userId);
  if (!data) notFound();

  const { owner, lists } = data;
  const firstName = owner.name.split(" ")[0];
  const hasItems = lists.some((l) => l.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/app/groups/${groupId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to group
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {owner.name}&apos;s lists
        </h1>
        <p className="text-sm text-muted-foreground">
          {`Claim a gift below — ${firstName} won't see what's been picked, and no one sees that it was you.`}
        </p>
      </div>

      {!hasItems ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          {`${firstName} hasn't added anything yet.`}
        </div>
      ) : (
        lists
          .filter((l) => l.items.length > 0)
          .map((list) => (
            <section key={list.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{list.title}</h2>
                <Badge variant="secondary">
                  {OCCASION_LABEL[list.occasion] ?? "General"}
                </Badge>
                {list.eventDate && (
                  <span className="text-sm text-muted-foreground">
                    {formatDate(list.eventDate)}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {list.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="size-16 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-xs">
                        🎁
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        {formatPrice(item.priceCents) && (
                          <span className="text-sm text-muted-foreground">
                            {formatPrice(item.priceCents)}
                          </span>
                        )}
                        {item.quantity > 1 && (
                          <span className="text-xs text-muted-foreground">
                            wants {item.quantity}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          View item <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <div className="shrink-0">
                      <ClaimButtons
                        itemId={item.id}
                        claimState={item.claimState}
                        mine={item.mine}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
