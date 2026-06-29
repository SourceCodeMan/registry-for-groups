"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { deleteItemAction, moveItemAction } from "@/lib/list-actions";
import { ItemDialog, type ItemData } from "./item-dialog";
import { Button } from "@/components/ui/button";

export function ItemCard({
  listId,
  item,
  isFirst,
  isLast,
}: {
  listId: string;
  item: ItemData;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  function del() {
    if (!confirm(`Delete "${item.title}"?`)) return;
    run(() => deleteItemAction(item.id));
  }

  const price =
    item.priceCents != null
      ? `$${(item.priceCents / 100).toFixed(2)}`
      : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
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
        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          🎁
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.title}</span>
          {price && (
            <span className="text-sm text-muted-foreground">{price}</span>
          )}
          {item.quantity > 1 && (
            <span className="text-xs text-muted-foreground">
              ×{item.quantity}
            </span>
          )}
        </div>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
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

      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className="flex">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isFirst || pending}
            onClick={() => run(() => moveItemAction(item.id, "up"))}
            aria-label="Move up"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isLast || pending}
            onClick={() => run(() => moveItemAction(item.id, "down"))}
            aria-label="Move down"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
        <div className="flex">
          <ItemDialog
            listId={listId}
            item={item}
            triggerLabel="Edit"
            triggerVariant="ghost"
            triggerSize="sm"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            onClick={del}
            aria-label="Delete item"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
