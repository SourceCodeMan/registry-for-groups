import "server-only";

// Simple in-memory sliding-window limiter, keyed by an arbitrary string.
// Per server instance — adequate at our scale; swap to a shared store (Upstash)
// if this ever needs to be global across many instances.
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}
