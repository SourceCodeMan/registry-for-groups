"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ShieldPlus, UserMinus } from "lucide-react";
import {
  removeMemberAction,
  promoteMemberAction,
  revokeInviteAction,
  approveJoinRequestAction,
  denyJoinRequestAction,
  type ActionResult,
} from "@/lib/group-actions";
import { Button } from "@/components/ui/button";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  return { pending, run };
}

export function RemoveMemberButton({
  groupId,
  userId,
  name,
}: {
  groupId: string;
  userId: string;
  name: string;
}) {
  const { pending, run } = useRun();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Remove ${name}`}
      onClick={() => {
        if (
          confirm(
            `Remove ${name} from the group?\n\nTheir lists won't be deleted — they become personal lists on their own account.`,
          )
        ) {
          run(() => removeMemberAction(groupId, userId));
        }
      }}
    >
      <UserMinus className="size-4 text-destructive" />
    </Button>
  );
}

export function PromoteMemberButton({
  groupId,
  userId,
  name,
}: {
  groupId: string;
  userId: string;
  name: string;
}) {
  const { pending, run } = useRun();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Make ${name} an admin`}
      title={`Make ${name} an admin`}
      onClick={() => {
        if (confirm(`Make ${name} an admin of this group?`)) {
          run(() => promoteMemberAction(groupId, userId));
        }
      }}
    >
      <ShieldPlus className="size-4" />
    </Button>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const { pending, run } = useRun();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => revokeInviteAction(inviteId))}
    >
      Revoke
    </Button>
  );
}

export function JoinRequestActions({ requestId }: { requestId: string }) {
  const { pending, run } = useRun();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(() => approveJoinRequestAction(requestId))}
      >
        <Check className="size-4" /> Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => denyJoinRequestAction(requestId))}
      >
        Deny
      </Button>
    </div>
  );
}
