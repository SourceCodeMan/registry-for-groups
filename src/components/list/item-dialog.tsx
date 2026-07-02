"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUp, Sparkles, X } from "lucide-react";
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

// Photo uploads light up only when a Blob store is configured for the build.
const UPLOADS_ENABLED = process.env.NEXT_PUBLIC_UPLOADS_ENABLED === "1";
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

/** Shrink an image on-device to a sane size before upload — keeps storage
 *  (and the user's data) small. Falls back to the original on any failure. */
async function resizeImage(file: File, maxDim = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("resize failed"))),
      "image/jpeg",
      quality,
    ),
  );
}

export function ItemDialog({
  listId,
  item,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  mode = "item",
}: {
  listId: string;
  item?: ItemData;
  triggerLabel: React.ReactNode;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerSize?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  triggerClassName?: string;
  /** "option" tweaks copy + hides Quantity for pick-list choices. */
  mode?: "item" | "option";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState(() => emptyFields(item));
  const isEdit = !!item;
  const isOption = mode === "option";
  const noun = isOption ? "option" : "item";

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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      let body: Blob = file;
      try {
        body = await resizeImage(file);
      } catch {
        body = file; // couldn't shrink (e.g. HEIC) — send the original
      }
      if (body.size > MAX_UPLOAD_BYTES) {
        toast.error("That image is too large — try a smaller one.");
        return;
      }
      const fd = new FormData();
      fd.append("file", body, "gift.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }
      setF((prev) => ({ ...prev, imageUrl: data.url as string }));
      toast.success("Photo added.");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
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
            <DialogTitle>
              {isEdit ? `Edit ${noun}` : `Add ${isOption ? "an option" : "an item"}`}
            </DialogTitle>
            <DialogDescription>
              {isOption
                ? "An option people can choose from. Paste a link to autofill, or type it in."
                : "Paste a link and let us fill in the details, or type them in."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-4">
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
                placeholder={isOption ? "e.g. Hoodie" : "e.g. Wireless headphones"}
              />
            </div>
            {isOption ? (
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
            ) : (
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
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="imageUrl">Photo (optional)</Label>
              {f.imageUrl && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-14 shrink-0 rounded-md border object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setF((p) => ({ ...p, imageUrl: "" }))}
                  >
                    <X className="size-4" /> Remove
                  </Button>
                </div>
              )}
              {UPLOADS_ENABLED && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <ImageUp className="size-4" />
                    {uploading
                      ? "Uploading…"
                      : f.imageUrl
                        ? "Replace photo"
                        : "Upload a photo"}
                  </Button>
                </>
              )}
              <Input
                id="imageUrl"
                type="url"
                value={f.imageUrl}
                onChange={set("imageUrl")}
                placeholder={
                  UPLOADS_ENABLED ? "…or paste an image link" : "https://…"
                }
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
                {saving
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : isOption
                      ? "Add option"
                      : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
