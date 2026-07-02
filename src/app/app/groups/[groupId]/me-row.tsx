"use client";

import { toast } from "sonner";

/**
 * Your own row in the Members list. You can't "browse" your own lists (that
 * would spoil the surprises), so instead of a dead, unclickable name, clicking
 * it jumps up to the "Your lists" section, flashes it, and explains — which is
 * what confused people were looking for.
 */
export function MeRow({ children }: { children: React.ReactNode }) {
  function jumpToLists() {
    const el = document.getElementById("your-lists");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Remove + reflow + re-add so the flash replays on every click.
    el.classList.remove("flash-highlight");
    void el.offsetWidth;
    el.classList.add("flash-highlight");
    toast("✨ This is where your lists live — tap one to add or edit gifts.");
  }

  return (
    <button
      type="button"
      onClick={jumpToLists}
      className="-mx-2 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted/50"
    >
      {children}
    </button>
  );
}
