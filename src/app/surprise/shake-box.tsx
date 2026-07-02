"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShakeBox() {
  const [shaking, setShaking] = useState(false);
  const [caught, setCaught] = useState(false);

  function shake() {
    setShaking(true);
    window.setTimeout(() => {
      setShaking(false);
      setCaught(true);
    }, 720);
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div
        className={cn("select-none text-7xl", shaking && "animate-present-shake")}
        role="img"
        aria-label="A wrapped present"
      >
        🎁
      </div>

      {caught ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-heading text-2xl font-semibold">
            🙈 Hey — no peeking!
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Nice try. Your gift is a surprise — that&apos;s the whole point. But
            yes… something you asked for is on its way. 🎉
          </p>
          <Link
            href="/app"
            className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
          >
            Back to your registry
          </Link>
        </div>
      ) : (
        <>
          <p className="max-w-xs text-muted-foreground">
            Someone bought you a gift off your list… go on, give it a shake.
          </p>
          <Button onClick={shake} disabled={shaking}>
            🎁 Shake it!
          </Button>
        </>
      )}
    </div>
  );
}
