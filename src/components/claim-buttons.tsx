"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Gift } from "lucide-react";
import {
  reserveItemAction,
  purchaseItemAction,
  releaseClaimAction,
  type ClaimActionResult,
} from "@/lib/claim-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClaimState } from "@/lib/claims";

export function ClaimButtons({
  itemId,
  claimState,
  mine,
}: {
  itemId: string;
  claimState: ClaimState;
  mine: "reserved" | "purchased" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ClaimActionResult>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  // The viewer has their own claim on this item.
  if (mine) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {mine === "purchased" ? (
          <Badge className="gap-1 bg-emerald-600 text-white">
            <Gift className="size-3" /> You&apos;re getting this
          </Badge>
        ) : (
          <Badge variant="secondary">You reserved this</Badge>
        )}
        {mine === "reserved" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => purchaseItemAction(itemId))}
          >
            <Check className="size-4" /> Mark purchased
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => releaseClaimAction(itemId))}
        >
          Release
        </Button>
      </div>
    );
  }

  // Someone else has it — show status, never who, no actions.
  if (claimState !== "unclaimed") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {claimState === "purchased" ? "Purchased" : "Reserved"} by someone
      </Badge>
    );
  }

  // Unclaimed.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => reserveItemAction(itemId))}
      >
        Reserve
      </Button>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(() => purchaseItemAction(itemId))}
      >
        <Check className="size-4" /> Mark purchased
      </Button>
    </div>
  );
}
