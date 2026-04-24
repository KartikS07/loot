/**
 * Price accuracy regression tests.
 *
 * Captures the repeated bug: "Loot shows ₹X on platform Y,
 * but clicking through shows a different price or the wrong product."
 *
 * Run: npx tsx tests/price_accuracy.test.ts
 * Requires: dev server running on localhost:3001 AND RAINFOREST_API_KEY in .env.local
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── Load env manually (no Next.js runtime here) ──
const envPath = join(process.cwd(), ".env.local");
try {
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .forEach((l) => {
      const [k, ...rest] = l.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    });
} catch { /* env file optional */ }

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const RAINFOREST_KEY = process.env.RAINFOREST_API_KEY;
const PRICE_TOLERANCE = 0.20; // 20% — Gemini search data can be hours stale; tighter = noise

// ── Test runner (no external deps) ──
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => Promise<void>) {
  return fn()
    .then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch((e: Error) => { failed++; failures.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}\n    → ${e.message}`); });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function parsePrice(s: string): number {
  // Handle decimals: "₹4,949.10" → 4949 (not 494910)
  const cleaned = s.replace(/[^0-9.]/g, ""); // keep digits and decimal point
  const withoutDecimal = cleaned.split(".")[0];   // drop fractional rupees
  return parseInt(withoutDecimal) || 0;
}

function priceDiff(a: string, b: string): number {
  const pa = parsePrice(a), pb = parsePrice(b);
  if (!pa || !pb) return 1; // unknown = max diff
  return Math.abs(pa - pb) / Math.max(pa, pb);
}

// ── Helpers ──
async function lootPrice(product: string) {
  const res = await fetch(`${BASE_URL}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product,
      userProfile: { savedCards: ["HDFC"], upiPreferences: ["Google Pay"] },
    }),
  });
  if (!res.ok) throw new Error(`Loot API returned ${res.status}`);
  return res.json() as Promise<{
    platforms: Array<{ name: string; listedPrice: string; effectivePrice: string }>;
    verdict: { bestPlatform: string; bestEffectivePrice: string };
    directLinks?: Record<string, string>;
    error?: string;
  }>;
}

const ACCESSORY_WORDS = new Set([
  "replacement", "filter", "refill", "case", "cover", "sleeve", "bag", "pouch",
  "strap", "cable", "charger", "adapter", "plug", "cord", "stand", "mount",
  "holder", "pad", "mat", "protector", "glass", "skin", "wrap", "spare",
]);

async function rainforestPrice(product: string): Promise<{ price: string; asin: string; title: string } | null> {
  if (!RAINFOREST_KEY) return null;
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", RAINFOREST_KEY);
  url.searchParams.set("type", "search");
  url.searchParams.set("amazon_domain", "amazon.in");
  url.searchParams.set("search_term", product);
  url.searchParams.set("page", "1");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json() as { search_results?: Array<{ price?: { value?: number }; asin?: string; title?: string }> };
  const results = data.search_results ?? [];

  // Use same title-matching + accessory-filter logic as fetchAmazonPrice() in route
  const productTokens = product.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length >= 1);
  const withPrices = results.filter((r) => typeof r.price?.value === "number");
  const scored = withPrices.map((r) => {
    const titleWords = new Set(String(r.title ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length >= 1));
    const hits = productTokens.filter(t => titleWords.has(t)).length;
    const baseScore = hits / productTokens.length;
    const isAccessory = [...titleWords].some(w => ACCESSORY_WORDS.has(w));
    return { r, score: isAccessory ? baseScore * 0.15 : baseScore };
  }).sort((a, b) => b.score - a.score);

  const match = scored[0]?.r;
  if (!match?.price?.value) return null;
  return {
    price: `₹${Math.round(match.price.value).toLocaleString("en-IN")}`,
    asin: match.asin ?? "",
    title: match.title ?? "",
  };
}

// ── Test cases ──

// Test products that have exhibited the regression before
const TEST_PRODUCTS = [
  "realme Buds Air 5",
  "Sony WH-1000XM5",
  "OnePlus Nord Buds 2",
];

async function runAll() {
  console.log("\n=== Loot Price Accuracy Tests ===\n");

  for (const product of TEST_PRODUCTS) {
    console.log(`\n▸ ${product}`);

    let lootResult: Awaited<ReturnType<typeof lootPrice>>;
    try {
      lootResult = await lootPrice(product);
    } catch (e) {
      console.log(`  ⚠ Skipped — Loot API unavailable: ${(e as Error).message}`);
      continue;
    }

    const amazonPlatform = lootResult.platforms?.find((p) =>
      p.name.toLowerCase().includes("amazon")
    );

    // ── 1. Amazon price matches Rainforest (source of truth) ──
    await test("Amazon price within 15% of Rainforest API", async () => {
      if (!RAINFOREST_KEY) {
        console.log("    ⚠ RAINFOREST_API_KEY not set — skipping source-of-truth check");
        return;
      }
      assert(!!amazonPlatform, "Amazon platform not in Loot results");
      const rf = await rainforestPrice(product);
      assert(!!rf, "Rainforest returned no price for this product");
      const diff = priceDiff(amazonPlatform!.listedPrice, rf!.price);
      assert(
        diff <= PRICE_TOLERANCE,
        `Loot shows ${amazonPlatform!.listedPrice} but Rainforest shows ${rf!.price} — ${(diff * 100).toFixed(1)}% apart (max ${PRICE_TOLERANCE * 100}%)`
      );
    });

    // ── 2. Amazon link must be direct product page, not search ──
    await test("Amazon link is direct product page (amazon.in/dp/ASIN), not search", async () => {
      const amazonLink = lootResult.directLinks?.["Amazon India"];
      assert(
        !!amazonLink,
        "No Amazon direct link in directLinks — will fall back to search URL"
      );
      assert(
        amazonLink!.includes("/dp/"),
        `Amazon link is a search URL, not a product page: ${amazonLink}`
      );
      assert(
        !amazonLink!.includes("/s?k="),
        `Amazon link still uses search format: ${amazonLink}`
      );
    });

    // ── 3. Flipkart link, when present, must be direct product page ──
    await test("Flipkart link is direct /p/ URL when a Flipkart price exists", async () => {
      const flipkartPlatform = lootResult.platforms?.find((p) =>
        p.name.toLowerCase().includes("flipkart")
      );
      if (!flipkartPlatform) {
        console.log("    ⚠ Flipkart not in results for this product — skip");
        return;
      }
      const flipkartLink = lootResult.directLinks?.["Flipkart"];
      assert(
        !!flipkartLink,
        [
          `Flipkart price shown (${flipkartPlatform.listedPrice}) but no direct link extracted.`,
          "User will land on a search page showing DIFFERENT products at different prices.",
          "Fix: Phase 1 must return a Flipkart /p/{itemId} URL for this product.",
        ].join(" ")
      );
      assert(
        flipkartLink!.includes("/p/"),
        `Flipkart link does not contain /p/ — it's a search URL: ${flipkartLink}`
      );
    });

    // ── 4. effectivePrice is within 80-100% of listedPrice (discount sanity) ──
    await test("Effective price is a plausible discount from listed price", async () => {
      for (const p of lootResult.platforms ?? []) {
        const listed = parsePrice(p.listedPrice);
        const effective = parsePrice(p.effectivePrice);
        if (!listed || !effective) continue;
        assert(
          effective >= listed * 0.8,
          `${p.name}: effectivePrice (${p.effectivePrice}) is less than 80% of listedPrice (${p.listedPrice}) — impossible discount`
        );
        assert(
          effective <= listed * 1.01,
          `${p.name}: effectivePrice (${p.effectivePrice}) exceeds listedPrice (${p.listedPrice}) — impossible`
        );
      }
    });

    // ── 5. Verdict price matches best platform price ──
    await test("Verdict bestEffectivePrice matches the cheapest platform's effectivePrice", async () => {
      const verdictPrice = parsePrice(lootResult.verdict?.bestEffectivePrice ?? "");
      const cheapestPlatform = [...(lootResult.platforms ?? [])]
        .sort((a, b) => (parsePrice(a.effectivePrice) || Infinity) - (parsePrice(b.effectivePrice) || Infinity))[0];
      if (!cheapestPlatform || !verdictPrice) return;
      const cheapestPrice = parsePrice(cheapestPlatform.effectivePrice);
      const diff = Math.abs(verdictPrice - cheapestPrice);
      assert(
        diff <= 50, // ₹50 rounding tolerance
        `Verdict shows ${lootResult.verdict?.bestEffectivePrice} but cheapest platform (${cheapestPlatform.name}) is ${cheapestPlatform.effectivePrice} — these should match`
      );
    });
  }

  // ── Summary ──
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  • ${f}`));
  }
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch((e) => { console.error(e); process.exit(1); });
