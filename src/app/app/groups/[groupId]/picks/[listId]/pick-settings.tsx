"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import {
  updatePickListAction,
  deletePickListAction,
} from "@/lib/pick-actions";
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

export function PickSettings({
  list,
}: {
  list: { id: string; title: string; maxPicksPerMember: number };
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
      const res = await updatePickListAction(list.id, {
        title: String(f.get("title") ?? ""),
        maxPicksPerMember: Number(f.get("maxPicks") ?? 1),
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
    if (!confirm("Delete this pick list and everyone's choices on it?")) return;
    startDelete(async () => {
      await deletePickListAction(list.id);
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
        aria-label="Delete pick list"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit pick list</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Name</Label>
              <Input
                id="edit-title"
                name="title"
                required
                maxLength={80}
                defaultValue={list.title}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-maxpicks">
                How many can each person choose?
              </Label>
              <select
                id="edit-maxpicks"
                name="maxPicks"
                defaultValue={String(list.maxPicksPerMember)}
                className={selectClass}
              >
                <option value="1">Just one</option>
                <option value="2">Up to 2</option>
                <option value="3">Up to 3</option>
                <option value="5">Up to 5</option>
                <option value="10">Any of them</option>
              </select>
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
