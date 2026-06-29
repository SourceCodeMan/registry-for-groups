"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { updateListAction, deleteListAction } from "@/lib/list-actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ListSettings({
  list,
}: {
  list: { id: string; title: string; occasion: string; eventDate: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, startDelete] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await updateListAction(list.id, {
        title: String(f.get("title") ?? ""),
        occasion: String(f.get("occasion") ?? "general"),
        eventDate: String(f.get("eventDate") ?? ""),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function del() {
    if (!confirm("Delete this whole list and everything on it?")) return;
    startDelete(async () => {
      await deleteListAction(list.id);
    });
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={del}
        disabled={deleting}
        aria-label="Delete list"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit list</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">List name</Label>
              <Input
                id="edit-title"
                name="title"
                required
                maxLength={80}
                defaultValue={list.title}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-occasion">Occasion</Label>
              <select
                id="edit-occasion"
                name="occasion"
                defaultValue={list.occasion}
                className={selectClass}
              >
                <option value="general">General</option>
                <option value="birthday">Birthday</option>
                <option value="christmas">Christmas</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-date">Date (optional)</Label>
              <Input
                id="edit-date"
                name="eventDate"
                type="date"
                defaultValue={list.eventDate ?? ""}
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
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
