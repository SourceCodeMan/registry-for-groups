"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires a fire-and-forget beacon once per navigation so the owner dashboard has
 * a rough visit count. Runs only in real browsers (so JS-less bots don't
 * inflate it) and never blocks rendering.
 */
export function PageView() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const sent =
        typeof navigator !== "undefined" &&
        navigator.sendBeacon?.("/api/pageview");
      if (!sent) {
        fetch("/api/pageview", { method: "POST", keepalive: true }).catch(
          () => {},
        );
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);
  return null;
}
