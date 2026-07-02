import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { uploadLimiter } from "@/lib/ratelimit";

// The client shrinks images before sending, so this ceiling is just a
// backstop against abuse.
const MAX_BYTES = 6 * 1024 * 1024;

/** Sniff real image bytes — never trust the client-declared MIME. */
function sniff(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a
  )
    return "image/png";
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

/**
 * Accept a single image and stash it in Vercel Blob (object storage on a CDN),
 * returning its public URL — which the caller saves as the item's imageUrl.
 * Images never touch the database, so it stays tiny. Inert (501) until a Blob
 * store is configured via BLOB_READ_WRITE_TOKEN.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Photo uploads aren't set up yet." },
      { status: 501 },
    );
  }

  const session = await getSession();
  if (!session?.user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  if (!(await uploadLimiter.limit(session.user.id)).success) {
    return Response.json(
      { error: "You've uploaded a lot of photos — try again later." },
      { status: 429 },
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "No image was sent." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "That image is too large — try a smaller one." },
      { status: 413 },
    );
  }

  // Content type comes from the bytes, not the client's claim.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = sniff(head);
  if (!type) {
    return Response.json(
      { error: "Please use a JPEG, PNG, or WebP image." },
      { status: 415 },
    );
  }
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";

  try {
    const blob = await put(`gift-images/${session.user.id}/photo.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    return Response.json({ url: blob.url });
  } catch (e) {
    console.error("[upload] blob put failed", (e as Error).message);
    return Response.json({ error: "Upload failed. Please try again." }, {
      status: 500,
    });
  }
}
