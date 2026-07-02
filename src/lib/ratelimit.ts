import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { rateLimit as memoryLimit } from "@/lib/rate-limit";

/** Minimal limiter interface shared by the Redis and in-memory backends. */
export type Limiter = { limit: (key: string) => Promise<{ success: boolean }> };

/** Build a Redis client from whichever env naming is present (Upstash native
 * or Vercel KV), or null if no Redis is configured (local dev). */
function redisFromEnv(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function memoryLimiter(max: number, windowMs: number): Limiter {
  return { limit: async (key) => ({ success: memoryLimit(key, max, windowMs) }) };
}

function upstash(rl: Ratelimit): Limiter {
  return {
    limit: async (key) => {
      const r = await rl.limit(key);
      return { success: r.success };
    },
  };
}

const redis = redisFromEnv();

/** True in production once a Redis is configured — the limits below become
 * globally enforced instead of per-instance. */
export const usingRedis = redis !== null;

// Invite minting: 20 per account per hour (copy-link + email invites).
export const inviteLimiter: Limiter = redis
  ? upstash(
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 h"),
        prefix: "rl:invite",
        analytics: false,
      }),
    )
  : memoryLimiter(20, 60 * 60 * 1000);

// Link unfurl: 20 per account per minute.
export const unfurlLimiter: Limiter = redis
  ? upstash(
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        prefix: "rl:unfurl",
        analytics: false,
      }),
    )
  : memoryLimiter(20, 60 * 1000);

// Image uploads: 30 per account per hour — plenty for real use, caps the
// cost/storage blast radius of a scripted-upload abuser.
export const uploadLimiter: Limiter = redis
  ? upstash(
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 h"),
        prefix: "rl:upload",
        analytics: false,
      }),
    )
  : memoryLimiter(30, 60 * 60 * 1000);
