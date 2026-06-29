"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ExternalLink } from "lucide-react";
import { togglePickAction } from "@/lib/pick-actions";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PickOption } from "@/lib/picks";

export function MemberPickView({
  listId,
  maxPicks,
  options,
  initialPicked,
}: {
  listId: string;
  maxPicks: number;
  options: PickOption[];
  initialPicked: string[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initialPicked),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const single = maxPicks <= 1;

  function choose(itemId: string) {
    if (busyId) return;
    const isOn = picked.has(itemId);

    // Client-side guard for the multi-select cap.
    if (!isOn && !single && picked.size >= maxPicks) {
      toast.error(
        `You can choose up to ${maxPicks} option${maxPicks === 1 ? "" : "s"}.`,
      );
      return;
    }

    const prev = picked;
    // Optimistic update.
    const next = new Set(prev);
    if (isOn) next.delete(itemId);
    else if (single) {
      next.clear();
      next.add(itemId);
    } else next.add(itemId);
    setPicked(next);
    setBusyId(itemId);

    startTransition(async () => {
      const res = await togglePickAction(listId, itemId);
      setBusyId(null);
      if (!res.ok) {
        setPicked(prev); // revert
        toast.error(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const on = picked.has(opt.id);
        const price = formatPrice(opt.priceCents);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => choose(opt.id)}
            disabled={!!busyId}
            aria-pressed={on}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              on
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-foreground/30",
              busyId && busyId !== opt.id && "opacity-60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center border",
                single ? "rounded-full" : "rounded-md",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input",
              )}
            >
              {on && <Check className="size-3.5" />}
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            {opt.imageUrl ? (
              <img
                src={opt.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="size-14 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-xs">
                🎁
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                  {opt.title}
                </span>
                {price && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {price}
                  </span>
                )}
              </div>
              {opt.description && (
                <p className="text-sm text-muted-foreground">
                  {opt.description}
                </p>
              )}
              {opt.url && (
                <a
                  href={opt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                >
                  View details <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
