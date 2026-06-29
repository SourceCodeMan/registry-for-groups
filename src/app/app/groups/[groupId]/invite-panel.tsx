"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createInviteAction, emailInviteAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function InvitePanel({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

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

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await emailInviteAction(groupId, email);
      if (!res.ok) {
        toast.error(res.error ?? "Could not send the invite.");
        return;
      }
      toast.success(`Invite sent to ${email.trim()}`);
      setEmail("");
    } catch {
      toast.error("Could not send the invite. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      <Separator />

      <form onSubmit={sendEmail} className="flex flex-col gap-2">
        <span className="text-sm font-medium">Or email an invite</span>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
