"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Link2, Pencil } from "lucide-react";
import { updateGroupSlugAction } from "@/lib/group-actions";
import { normalizeSlug } from "@/lib/slug";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
const APP_HOST = APP_ORIGIN.replace(/^https?:\/\//, "") || "registryforgroups.com";

export function GroupLink({
  organizationId,
  slug,
  isAdmin,
}: {
  organizationId: string;
  slug: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(slug);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullUrl =
    (APP_ORIGIN ||
      (typeof window !== "undefined" ? window.location.origin : "")) +
    "/" +
    current;
  const preview = normalizeSlug(draft);

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await updateGroupSlugAction(organizationId, draft);
      if (!res.ok || !res.slug) {
        setError(res.error ?? "Couldn't update the link.");
        return;
      }
      setCurrent(res.slug);
      setOpen(false);
      toast.success("Group link updated.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Group link</CardTitle>
        <CardDescription>
          A clean link to share so people can ask to join. No lists are shown
          until you let them in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">
            <span className="text-muted-foreground">{APP_HOST}/</span>
            <span className="font-medium">{current}</span>
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? (
            <>
              <Check className="size-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-4" /> Copy
            </>
          )}
        </Button>
        {isAdmin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(current);
              setError(null);
              setOpen(true);
            }}
          >
            <Pencil className="size-4" /> Customize
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize the group link</DialogTitle>
            <DialogDescription>
              Letters, numbers, and hyphens. Pick something easy to share.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug-input">Link</Label>
              <Input
                id="slug-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={32}
                autoFocus
                placeholder="chapman-family"
              />
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {preview ? `${APP_HOST}/${preview}` : `${APP_HOST}/…`}
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !preview}>
                {saving ? "Saving…" : "Save link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
