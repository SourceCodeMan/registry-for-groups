"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptState } from "@/lib/actions";
import { Button } from "@/components/ui/button";

const initial: AcceptState = {};

export function AcceptInvite({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Accept & join"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
