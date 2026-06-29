"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { createItemAction, updateItemAction } from "@/lib/list-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ItemData = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  quantity: number;
};

function emptyFields(item?: ItemData) {
  return {
    title: item?.title ?? "",
    url: item?.url ?? "",
    price: item?.priceCents != null ? (item.priceCents / 100).toFixed(2) : "",
    quantity: String(item?.quantity ?? 1),
    imageUrl: item?.imageUrl ?? "",
    description: item?.description ?? "",
  };
}

export function ItemDialog({
  listId,
  item,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
}: {
  listId: string;
  item?: ItemData;
  triggerLabel: React.ReactNode;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerSize?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [f, setF] = useState(() => emptyFields(item));
  const isEdit = !!item;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setF(emptyFields(item)); // reset on close
  }

  async function fetchFromLink() {
    const url = f.url.trim();
    if (!url) {
      toast.error("Paste a link first.");
      return;
    }
    setFetching(true);
    try {
      const res = await fetch("/api/unfurl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        toast.error("Couldn't fetch that link.");
        return;
      }
      const data = (await res.json()) as {
        title: string | null;
        description: string | null;
        imageUrl: string | null;
        priceCents: number | null;
      };
      // Compute against the current snapshot, filling only empty fields.
      const next = { ...f };
      let filled = 0;
      if (data.title && !f.title.trim()) {
        next.title = data.title;
        filled++;
      }
      if (data.priceCents != null && !f.price.trim()) {
        next.price = (data.priceCents / 100).toFixed(2);
        filled++;
      }
      if (data.imageUrl && !f.imageUrl.trim()) {
        next.imageUrl = data.imageUrl;
        filled++;
      }
      if (data.description && !f.description.trim()) {
        next.description = data.description;
        filled++;
      }
      setF(next);
      if (filled > 0) toast.success("Filled in what we could find.");
      else toast.message("Couldn't pull details — add them manually.");
    } catch {
      toast.error("Couldn't fetch that link.");
    } finally {
      setFetching(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        title: f.title,
        description: f.description,
        url: f.url,
        imageUrl: f.imageUrl,
        price: f.price,
        quantity: f.quantity,
      };
      const res = isEdit
        ? await updateItemAction(item!.id, data)
        : await createItemAction(listId, data);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save the item.");
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit item" : "Add an item"}</DialogTitle>
            <DialogDescription>
              Paste a link and let us fill in the details, or type them in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">Link (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  type="url"
                  value={f.url}
                  onChange={set("url")}
                  placeholder="https://…"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={fetchFromLink}
                  disabled={fetching}
                >
                  <Sparkles className="size-4" />
                  {fetching ? "Fetching…" : "Fetch"}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Name</Label>
              <Input
                id="title"
                value={f.title}
                onChange={set("title")}
                required
                maxLength={200}
                placeholder="e.g. Wireless headphones"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Price (optional)</Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={f.price}
                  onChange={set("price")}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={99}
                  value={f.quantity}
                  onChange={set("quantity")}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input
                id="imageUrl"
                type="url"
                value={f.imageUrl}
                onChange={set("imageUrl")}
                placeholder="https://…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Notes (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                maxLength={2000}
                value={f.description}
                onChange={set("description")}
                placeholder="Color, size, why you'd love it…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
