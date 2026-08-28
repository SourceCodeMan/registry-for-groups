import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import ipaddr from "ipaddr.js";
import { parse as parseHtml } from "node-html-parser";

const TIMEOUT_MS = 6000;
const MAX_BYTES = 1_000_000; // 1 MB of decoded HTML is plenty for <head>
const USER_AGENT =
  "Mozilla/5.0 (compatible; RegistryForGroups/1.0; +https://registryforgroups.com)";

export type UnfurlResult = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
};

const EMPTY: UnfurlResult = {
  title: null,
  description: null,
  imageUrl: null,
  priceCents: null,
};

/**
 * Is `ip` a globally-routable public address? Rejects private, loopback,
 * link-local (incl. 169.254.169.254 cloud metadata), unique-local, multicast,
 * reserved, unspecified, carrier-grade NAT, and NAT64; unwraps IPv4-mapped
 * IPv6 so ::ffff:127.0.0.1 is treated as loopback, not a public v6.
 */
function isPublicIp(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return false;
  }
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      return isPublicIp(v6.toIPv4Address().toString());
    }
  }
  // `unicast` is ipaddr.js's catch-all for normal globally-routable addresses;
  // every special/internal range classifies as something else.
  return addr.range() === "unicast";
}

/** undici connect lookup that only ever yields vetted public IPs (and pins the
 * socket to them — no re-resolution → DNS-rebind TOCTOU closed). undici calls
 * back the `all: true` way, i.e. with an ARRAY of { address, family }. */
function safeLookup(
  hostname: string,
  _options: unknown,
  // undici declares the net LookupFunction shape but calls back the `all:true`
  // way (an address ARRAY as the 2nd arg); we satisfy both.
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family: number,
  ) => void,
) {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, result) => {
    if (err) return callback(err, [], 0);
    const addrs = Array.isArray(result) ? result : [];
    const safe = addrs.filter((a) => isPublicIp(a.address));
    if (!safe.length) {
      return callback(
        Object.assign(new Error("blocked: no public address"), {
          code: "ESSRFBLOCKED",
        }),
        [],
        0,
      );
    }
    // IPv4 first — near-universal connectivity; some hosts lack an IPv6 route.
    const v4 = safe.filter((a) => a.family === 4);
    const ordered = [...v4, ...safe.filter((a) => a.family !== 4)];
    callback(null, ordered, 0);
  });
}

function absolutize(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function extract(html: string, baseUrl: string): UnfurlResult {
  const root = parseHtml(html, {
    comment: false,
    blockTextElements: { script: false, style: false },
  });
  const metas = root.querySelectorAll("meta");

  const get = (keys: string[]): string | null => {
    for (const m of metas) {
      const key = (
        m.getAttribute("property") ??
        m.getAttribute("name") ??
        m.getAttribute("itemprop") ??
        ""
      ).toLowerCase();
      if (keys.includes(key)) {
        const content = m.getAttribute("content");
        if (content && content.trim()) return content.trim();
      }
    }
    return null;
  };

  const title =
    get(["og:title", "twitter:title"]) ??
    root.querySelector("title")?.text?.trim() ??
    null;
  const description = get([
    "og:description",
    "twitter:description",
    "description",
  ]);

  let imageUrl = absolutize(
    get([
      "og:image",
      "og:image:secure_url",
      "og:image:url",
      "twitter:image",
      "twitter:image:src",
    ]),
    baseUrl,
  );
  // We store https-only images (mixed-content + viewer-probing safety).
  if (imageUrl && !imageUrl.startsWith("https:")) imageUrl = null;

  const priceStr = get([
    "og:price:amount",
    "product:price:amount",
    "price",
  ]);
  let priceCents: number | null = null;
  if (priceStr) {
    const n = Number.parseFloat(priceStr.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n >= 0) priceCents = Math.round(n * 100);
  }

  return {
    title: title ? title.slice(0, 200) : null,
    description: description ? description.slice(0, 2000) : null,
    imageUrl,
    priceCents,
  };
}

/**
 * Best-effort metadata fetch for a user-supplied product URL. Returns all-null
 * on ANY failure (invalid URL, SSRF block, timeout, non-HTML, parse error) —
 * a uniform shape so the caller can't distinguish a blocked-internal target
 * from a normal miss.
 */
export async function unfurl(rawUrl: string): Promise<UnfurlResult> {
  if (rawUrl.length > 2048) return EMPTY;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return EMPTY;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return EMPTY;

  const agent = new Agent({
    connect: { lookup: safeLookup, timeout: TIMEOUT_MS },
    headersTimeout: TIMEOUT_MS,
    bodyTimeout: TIMEOUT_MS,
  });

  try {
    const res = await undiciFetch(url.toString(), {
      method: "GET",
      dispatcher: agent,
      redirect: "follow", // each hop reconnects through safeLookup → re-vetted
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        // Refuse compression so a gzip bomb can't expand past our byte cap.
        "accept-encoding": "identity",
      },
    });

    if (!res.ok || !res.body) return EMPTY;
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ctype)) return EMPTY;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const room = MAX_BYTES - received;
      if (value.length > room) {
        chunks.push(value.subarray(0, room));
        break;
      }
      received += value.length;
      chunks.push(value);
    }
    await reader.cancel().catch(() => {});

    const html = Buffer.concat(chunks).toString("utf8");
    return extract(html, res.url || url.toString());
  } catch {
    return EMPTY;
  } finally {
    await agent.close().catch(() => {});
  }
}
