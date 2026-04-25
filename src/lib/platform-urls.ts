/**
 * Extract canonical product-page URLs for each Indian e-commerce platform
 * from Gemini's prose search output. Input is loosely structured text;
 * output is a map of platform name → direct product URL.
 *
 * Pre-processing handles the three artifact classes that previously broke
 * extraction (~40% Flipkart miss rate):
 *   1. Markdown link syntax: [label](https://...) → https://...
 *   2. URL encoding: %2F → "/", %3A → ":", etc.
 *   3. Backtick wrapping: `https://...` → https://...
 *
 * Regex character classes use the `/i` flag where appropriate — JS's `/i`
 * applies to character classes too, so `[a-z0-9]` with `/i` matches both
 * cases. No separate uppercase pass is needed.
 */

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

/** Replace Markdown links [label](url) with plain url. */
function stripMarkdownLinks(text: string): string {
  return text.replace(MARKDOWN_LINK, "$2");
}

/** Drop backticks around URLs without touching code blocks' contents. */
function stripBackticks(text: string): string {
  return text.replace(/`([^`\n]+)`/g, "$1");
}

/**
 * Targeted URL-decode for the chars that actually appear in e-comm slugs.
 * decodeURIComponent on the full text would throw on stray `%` — we only
 * touch the few encodings Gemini commonly emits.
 */
function decodeUrlsBestEffort(text: string): string {
  return text
    .replace(/%2F/gi, "/")
    .replace(/%3A/gi, ":")
    .replace(/%2D/gi, "-")
    .replace(/%5F/gi, "_")
    .replace(/%3F/gi, "?")
    .replace(/%3D/gi, "=")
    .replace(/%26/gi, "&");
}

export function preprocessPriceData(raw: string): string {
  return decodeUrlsBestEffort(stripBackticks(stripMarkdownLinks(raw)));
}

function trimQueryAndFragment(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Extract direct product URLs for each supported platform from Gemini's
 * Phase 1 prose. `rainforestAmazonUrl`, when supplied, overrides any
 * Amazon URL from prose (it's real-time and authoritative).
 */
export function extractDirectLinks(
  raw: string,
  rainforestAmazonUrl?: string | null,
): Record<string, string> {
  const text = preprocessPriceData(raw);
  const links: Record<string, string> = {};

  // Amazon India — /dp/{ASIN} (ASINs are uppercase alphanumeric, exactly 10 chars)
  const amazon = text.match(/amazon\.in\/[^\s"'<)]+\/dp\/([A-Z0-9]{10})/);
  if (amazon) links["Amazon India"] = `https://www.amazon.in/dp/${amazon[1]}`;

  // Rainforest overrides prose for Amazon (real-time, authoritative)
  if (rainforestAmazonUrl) links["Amazon India"] = rainforestAmazonUrl;

  // Flipkart — /p/{itemId}. /i flag makes [a-z0-9] match both cases.
  const flipkart = text.match(
    /https?:\/\/(?:www\.)?flipkart\.com\/[^\s"'<)]+\/p\/[a-z0-9]+/i,
  );
  if (flipkart) links["Flipkart"] = trimQueryAndFragment(flipkart[0]);

  // Croma — /p/{numericId}
  const croma = text.match(
    /https?:\/\/(?:www\.)?croma\.com\/[^\s"'<)]+\/p\/\d+/i,
  );
  if (croma) links["Croma"] = trimQueryAndFragment(croma[0]);

  // Blinkit — /prn/...
  const blinkit = text.match(
    /https?:\/\/(?:www\.)?blinkit\.com\/prn\/[^\s"'<)]+/i,
  );
  if (blinkit) links["Blinkit"] = trimQueryAndFragment(blinkit[0]);

  // Zepto — /pn/...
  const zepto = text.match(
    /https?:\/\/(?:www\.)?zepto\.com\/pn\/[^\s"'<)]+/i,
  );
  if (zepto) links["Zepto"] = trimQueryAndFragment(zepto[0]);

  // Meesho — /slug/p/{numericId}
  const meesho = text.match(
    /https?:\/\/(?:www\.)?meesho\.com\/[^\s"'<)]+\/p\/\d+/i,
  );
  if (meesho) links["Meesho"] = trimQueryAndFragment(meesho[0]);

  return links;
}
