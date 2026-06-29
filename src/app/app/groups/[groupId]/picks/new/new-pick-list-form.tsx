"use client";

import { useActionState } from "react";
import {
  createPickListAction,
  type PickListFormState,
} from "@/lib/pick-actions";
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

const initial: PickListFormState = {};
const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function NewPickListForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(
    createPickListAction,
    initial,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>New pick list</CardTitle>
        <CardDescription>
          Offer a set of options and let everyone in the group choose. You&apos;ll
          see who picked what, so you know what to get. Add the options on the
          next screen.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <input type="hidden" name="groupId" value={groupId} />
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Name</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={80}
              placeholder="e.g. Team swag, Pick your gift"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxPicks">How many can each person choose?</Label>
            <select
              id="maxPicks"
              name="maxPicks"
              defaultValue="1"
              className={selectClass}
            >
              <option value="1">Just one</option>
              <option value="2">Up to 2</option>
              <option value="3">Up to 3</option>
              <option value="5">Up to 5</option>
              <option value="10">Any of them</option>
            </select>
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create pick list"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
