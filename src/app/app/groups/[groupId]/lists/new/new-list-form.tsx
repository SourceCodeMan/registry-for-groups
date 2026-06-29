"use client";

import { useActionState } from "react";
import { createListAction, type ListFormState } from "@/lib/list-actions";
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

const initial: ListFormState = {};
const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function NewListForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState(createListAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New list</CardTitle>
        <CardDescription>
          A birthday list, a Christmas list, or just a general wishlist.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <input type="hidden" name="groupId" value={groupId} />
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">List name</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={80}
              placeholder="My Christmas List"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="occasion">Occasion</Label>
            <select
              id="occasion"
              name="occasion"
              defaultValue="general"
              className={selectClass}
            >
              <option value="general">General</option>
              <option value="birthday">Birthday</option>
              <option value="christmas">Christmas</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eventDate">Date (optional)</Label>
            <Input id="eventDate" name="eventDate" type="date" />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create list"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
