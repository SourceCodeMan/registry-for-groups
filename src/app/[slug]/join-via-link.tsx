"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { requestJoinAction } from "@/lib/group-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type JoinState = "guest" | "member" | "pending" | "canRequest";

export function JoinViaLink({
  organizationId,
  slug,
  state: initial,
}: {
  organizationId: string;
  slug: string;
  state: JoinState;
}) {
  const [state, setState] = useState<JoinState>(initial);
  const [pending, start] = useTransition();
  const redirect = encodeURIComponent(`/${slug}`);

  function request() {
    start(async () => {
      const res = await requestJoinAction(organizationId);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't send your request.");
        return;
      }
      setState("pending");
      toast.success("Request sent — the admin will approve you.");
    });
  }

  if (state === "member") {
    return (
      <Link
        href={`/app/groups/${organizationId}`}
        className={cn(buttonVariants(), "w-full")}
      >
        Open this group
      </Link>
    );
  }

  if (state === "pending") {
    return (
      <p className="rounded-md bg-muted/50 px-3 py-2 text-center text-sm text-muted-foreground">
        ⏳ Your request is waiting for the admin to approve it.
      </p>
    );
  }

  if (state === "guest") {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/login?redirect=${redirect}`}
          className={cn(buttonVariants(), "w-full")}
        >
          Log in to ask to join
        </Link>
        <Link
          href={`/signup?redirect=${redirect}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Create an account
        </Link>
      </div>
    );
  }

  // canRequest
  return (
    <Button className="w-full" onClick={request} disabled={pending}>
      {pending ? "Sending…" : "Request to join"}
    </Button>
  );
}
