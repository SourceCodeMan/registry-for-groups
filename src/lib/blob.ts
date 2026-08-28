import "server-only";
import { del } from "@vercel/blob";

const BLOB_HOST = /\.blob\.vercel-storage\.com$/i;

/** True only for a https blob URL this user uploaded under gift-images/<id>/. */
export function isOwnedBlobUrl(
  url: string,
  ownerUserId: string,
): boolean {
  if (!ownerUserId || /[/\\]/.test(ownerUserId)) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!BLOB_HOST.test(u.hostname)) return false;
    const prefix = `/gift-images/${ownerUserId}/`;
    return u.pathname === prefix.slice(0, -1) || u.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

/**
 * Best-effort delete of an image we uploaded, so a replaced or removed gift
 * photo doesn't stay publicly fetchable forever (privacy) and storage doesn't
 * grow unbounded (cost). Ignores pasted third-party image URLs and never
 * throws into the caller.
 */
export async function deleteOwnedBlob(
  url: string | null | undefined,
  ownerUserId: string,
): Promise<void> {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  if (!isOwnedBlobUrl(url, ownerUserId)) return;
  try {
    await del(url);
  } catch (e) {
    console.error("[blob] delete failed", (e as Error).message);
  }
}
