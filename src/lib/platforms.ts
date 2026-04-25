/**
 * Canonical Indian e-commerce platforms Loot tracks, plus an alias map that
 * normalizes Gemini's inconsistent name variants to the canonical form.
 *
 * Any name that doesn't map into this set gets dropped by `filterPlatforms()`
 * — which is our only defense against Gemini hallucinating fake retailers
 * (e.g. "Imaginext" for a Canon camera search).
 */

export const KNOWN_PLATFORMS = [
  "Amazon India",
  "Flipkart",
  "Meesho",
  "JioMart",
  "Croma",
  "Reliance Digital",
  "Tata Cliq",
  "Vijay Sales",
  "Blinkit",
  "Zepto",
  "Swiggy Instamart",
] as const;

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number];

// Any variant Gemini might emit → canonical.
// Normalization key = lowercased + whitespace-collapsed + punctuation-stripped.
const ALIASES: Record<string, KnownPlatform> = {
  "amazon": "Amazon India",
  "amazon india": "Amazon India",
  "amazonin": "Amazon India",
  "amazon in": "Amazon India",
  "amazoncom": "Amazon India", // defensive; Gemini sometimes forgets the .in
  "flipkart": "Flipkart",
  "meesho": "Meesho",
  "jiomart": "JioMart",
  "jio mart": "JioMart",
  "croma": "Croma",
  "reliance digital": "Reliance Digital",
  "reliance": "Reliance Digital",
  "tata cliq": "Tata Cliq",
  "tatacliq": "Tata Cliq",
  "tata cliq luxury": "Tata Cliq",
  "vijay sales": "Vijay Sales",
  "vijaysales": "Vijay Sales",
  "blinkit": "Blinkit",
  "zepto": "Zepto",
  "swiggy instamart": "Swiggy Instamart",
  "instamart": "Swiggy Instamart",
  "swiggy": "Swiggy Instamart",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // drop punctuation like . , - ()
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the canonical name for a platform, or null if unrecognized. */
export function canonicalPlatform(name: string): KnownPlatform | null {
  if (typeof name !== "string") return null;
  const key = normalize(name);
  if (!key) return null;
  return ALIASES[key] ?? null;
}

/**
 * Filter + normalize the platforms array from Phase 2 Gemini output.
 * Drops anything not in the known list. Returns at most one entry per
 * canonical name — if Gemini somehow returned duplicates ("Amazon" +
 * "Amazon India"), we keep the first occurrence.
 */
export function filterPlatforms<T extends { name?: string }>(
  platforms: T[] | undefined | null,
): (T & { name: KnownPlatform })[] {
  if (!Array.isArray(platforms)) return [];
  const seen = new Set<KnownPlatform>();
  const out: (T & { name: KnownPlatform })[] = [];
  for (const p of platforms) {
    const canonical = canonicalPlatform(p?.name ?? "");
    if (!canonical) {
      if (p?.name) console.warn(`[platforms] Dropping unknown platform: "${p.name}"`);
      continue;
    }
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({ ...p, name: canonical });
  }
  return out;
}
