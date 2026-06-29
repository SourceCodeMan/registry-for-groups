"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const [loading, setLoading] = useState(false);
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const data = {
      title: String(f.get("title") ?? ""),
      description: String(f.get("description") ?? ""),
      url: String(f.get("url") ?? ""),
      imageUrl: String(f.get("imageUrl") ?? ""),
      price: String(f.get("price") ?? ""),
      quantity: String(f.get("quantity") ?? "1"),
    };
    setLoading(true);
    try {
      const res = isEdit
        ? await updateItemAction(item!.id, data)
        : await createItemAction(listId, data);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save the item.");
        return;
      }
      if (!isEdit) formEl.reset();
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const dollars =
    item?.priceCents != null ? (item.priceCents / 100).toFixed(2) : "";

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit item" : "Add an item"}</DialogTitle>
            <DialogDescription>
              Only you can edit this — others just see it on your list.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Name</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                defaultValue={item?.title ?? ""}
                placeholder="e.g. Wireless headphones"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">Link (optional)</Label>
              <Input
                id="url"
                name="url"
                type="url"
                defaultValue={item?.url ?? ""}
                placeholder="https://…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Price (optional)</Label>
                <Input
                  id="price"
                  name="price"
                  inputMode="decimal"
                  defaultValue={dollars}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={item?.quantity ?? 1}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                type="url"
                defaultValue={item?.imageUrl ?? ""}
                placeholder="https://…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Notes (optional)</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                maxLength={2000}
                defaultValue={item?.description ?? ""}
                placeholder="Color, size, why you'd love it…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : isEdit ? "Save changes" : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
