import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getRequestedGiftsForViewer } from "@/lib/claims";
import { formatDate, formatPrice } from "@/lib/format";
import { ClaimButtons } from "@/components/claim-buttons";

export default async function RequestedPage() {
  const me = await requireUser();
  const gifts = await getRequestedGiftsForViewer(me.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gifts requested</h1>
        <p className="text-sm text-muted-foreground">
          Everything your groups have asked for, newest first. Reserve or mark
          one bought — the person will never see it was you.
        </p>
      </div>

      {gifts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No one in your groups has added anything yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {gifts.map((g) => (
            <div
              key={g.itemId}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {g.imageUrl ? (
                <img
                  src={g.imageUrl}
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
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                    {g.title}
                  </span>
                  {formatPrice(g.priceCents) && (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatPrice(g.priceCents)}
                    </span>
                  )}
                  {g.quantity > 1 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      wants {g.quantity}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {g.ownerName}
                  </span>{" "}
                  · {g.listTitle} · {g.groupName}
                </p>
                {g.description && (
                  <p className="text-sm text-muted-foreground">
                    {g.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {g.url && (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                    >
                      View item <ExternalLink className="size-3" />
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Added {formatDate(g.createdAt.toISOString().slice(0, 10))}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <ClaimButtons
                  itemId={g.itemId}
                  claimState={g.claimState}
                  mine={g.mine}
                  quantity={g.quantity}
                  claimedCount={g.claimedCount}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
