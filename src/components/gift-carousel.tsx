"use client";

import { useEffect, useState } from "react";

// Order the hero rotates through. Files live in /public/gifts/<name>.svg.
const GIFTS = [
  "wrapped-present",
  "gift-bag",
  "corporate-gift",
  "envelope",
  "stacked-presents",
  "ribbon-bow",
];

export function GiftCarousel({ className }: { className?: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    const t = setInterval(
      () => setActive((p) => (p + 1) % GIFTS.length),
      2800,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div
      aria-hidden
      className={`relative animate-[gift-float_5s_ease-in-out_infinite] ${className ?? ""}`}
    >
      {GIFTS.map((name, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={name}
          src={`/gifts/${name}.svg`}
          alt=""
          draggable={false}
          className={`absolute inset-0 size-full object-contain transition-all duration-700 ease-out ${
            idx === active
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
