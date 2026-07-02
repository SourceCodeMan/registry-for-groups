import "server-only";
import { del } from "@vercel/blob";

// Vercel Blob public URLs look like https://<id>.public.blob.vercel-storage.com/…
const OUR_BLOB = /\.blob\.vercel-storage\.com\//;

/**
 * Best-effort delete of an image we uploaded, so a replaced or removed gift
 * photo doesn't stay publicly fetchable forever (privacy) and storage doesn't
 * grow unbounded (cost). Ignores pasted third-party image URLs and never
 * throws into the caller.
 */
export async function deleteOwnedBlob(
  url: string | null | undefined,
): Promise<void> {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN || !OUR_BLOB.test(url)) return;
  try {
    await del(url);
  } catch (e) {
    console.error("[blob] delete failed", (e as Error).message);
  }
}
