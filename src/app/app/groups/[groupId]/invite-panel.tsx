"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createInviteAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InvitePanel({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await createInviteAction(groupId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setUrl(res.url ?? null);
    } catch {
      toast.error("Could not create an invite. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={generate}
        disabled={loading}
        variant="outline"
        className="w-fit"
      >
        {loading ? "Generating…" : "Create invite link"}
      </Button>
      {url && (
        <div className="flex gap-2">
          <Input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button onClick={copy} variant="secondary">
            Copy
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Single-use and expires in 72 hours — generate one link per person.
      </p>
    </div>
  );
}
