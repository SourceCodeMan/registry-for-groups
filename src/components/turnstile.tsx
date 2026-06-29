"use client";

import Script from "next/script";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Is the captcha configured for this environment? (Both keys must be set.) */
export const captchaEnabled = !!SITE_KEY;

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
      action?: string;
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileHandle = { reset: () => void };

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured,
 * so callers can include it unconditionally. Reports the token via `onToken`
 * (and `null` on expiry/error); expose `reset()` so a form can request a fresh
 * token after a failed submit (Turnstile tokens are single-use).
 */
export const Turnstile = forwardRef<
  TurnstileHandle,
  { onToken: (token: string | null) => void }
>(function Turnstile({ onToken }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.turnstile,
  );

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
        onToken(null);
      }
    },
  }));

  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !window.turnstile || !containerRef.current) return;
    if (widgetId.current) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "auto",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
  }, []);

  useEffect(() => {
    if (ready) renderWidget();
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [ready, renderWidget]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  );
});
