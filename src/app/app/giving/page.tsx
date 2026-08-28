import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getMyClaims, type ClaimState } from "@/lib/claims";
import { formatPrice } from "@/lib/format";
import { ClaimButtons } from "@/components/claim-buttons";

export default async function GivingPage() {
  const me = await requireUser();
  const myClaims = await getMyClaims(me.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Gifts you&apos;re giving
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;ve reserved or bought, across all your groups. Only
          you can see this.
        </p>
      </div>

      {myClaims.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          You haven&apos;t claimed any gifts yet. Open a group and browse
          someone&apos;s list to reserve one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {myClaims.map((c) => (
            <div
              key={c.itemId}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.itemTitle}</span>
                  {formatPrice(c.priceCents) && (
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(c.priceCents)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  For {c.ownerName} · {c.listTitle}
                  {c.groupName ? ` · ${c.groupName}` : " · personal list"}
                </p>
                {c.url && (
                  <a
                    href={c.url}
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
                  itemId={c.itemId}
                  claimState={c.state as ClaimState}
                  mine={c.state as "reserved" | "purchased"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
