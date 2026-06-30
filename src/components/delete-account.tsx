"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
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

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await authClient.deleteUser({ password });
      if (error) {
        setError(error.message ?? "Couldn't delete your account.");
        return;
      }
      toast.success("Your account has been deleted.");
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Delete account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and your lists. Any gifts you reserved
          are released so others can claim them. This can&apos;t be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={() => {
            setError(null);
            setPassword("");
            setOpen(true);
          }}
        >
          Delete my account
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account and your lists. Enter your
              password to confirm.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onDelete} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="del-pw">Password</Label>
              <Input
                id="del-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
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
              <Button type="submit" variant="destructive" disabled={busy || !password}>
                {busy ? "Deleting…" : "Delete account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
