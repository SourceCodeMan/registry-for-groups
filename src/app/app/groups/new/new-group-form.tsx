"use client";

import { useActionState } from "react";
import { createGroupAction, type GroupFormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: GroupFormState = {};

export function NewGroupForm() {
  const [state, action, pending] = useActionState(createGroupAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a group</CardTitle>
        <CardDescription>
          You&apos;ll be the admin. Invite everyone else once it&apos;s made.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Group name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={80}
              placeholder="The Chapman Family"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              defaultValue="family"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="family">Family</option>
              <option value="friends">Friends</option>
              <option value="office">Office / coworkers</option>
              <option value="other">Other</option>
            </select>
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create group"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
