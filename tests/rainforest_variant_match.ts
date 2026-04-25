// Measurement-only script. Runs 15 diverse queries through the SAME scoring logic
// used by fetchAmazonPrice in src/app/api/price/route.ts and prints each top match.
// You eyeball the output and tally RIGHT / WRONG-VARIANT / ACCESSORY / MISSING.
// Decision gate (from Loot_Weekender_Scope.md §7 POC step 0):
//   >20% wrong → add Rainforest fix to Workstream A this Weekender
//   <10% wrong → defer post-Weekender
//   10-20% wrong → decide in review

import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local manually — tsx doesn't auto-load Next.js env.
const envPath = join(process.cwd(), ".env.local");
const envText = readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY;
if (!RAINFOREST_API_KEY) {
  console.error("RAINFOREST_API_KEY missing from .env.local");
  process.exit(1);
}

const QUERIES: { id: number; category: string; q: string }[] = [
  // Electronics (5)
  { id: 1, category: "electronics", q: "Sony WH-1000XM5 wireless headphones" },
  { id: 2, category: "electronics", q: "Apple AirPods Pro 2nd generation" },
  { id: 3, category: "electronics", q: "boAt Airdopes 141 earbuds" },
  { id: 4, category: "electronics", q: "Samsung Galaxy Watch 6 44mm" },
  { id: 5, category: "electronics", q: "Dell XPS 13 9340 laptop" },
  // Fashion / home (5)
  { id: 6, category: "fashion-home", q: "Nike Air Force 1 men white sneakers" },
  { id: 7, category: "fashion-home", q: "Prestige induction cooktop 2000W" },
  { id: 8, category: "fashion-home", q: "Philips air fryer 4.1 litre HD9252" },
  { id: 9, category: "fashion-home", q: "Wakefit orthopaedic mattress queen size 6 inch" },
  { id: 10, category: "fashion-home", q: "Ray-Ban aviator sunglasses RB3025 for men" },
  // Grocery / quick-commerce-friendly (5)
  { id: 11, category: "grocery", q: "Maggi masala noodles 70g pack of 12" },
  { id: 12, category: "grocery", q: "Nescafe Classic instant coffee 200g jar" },
  { id: 13, category: "grocery", q: "Horlicks Classic Malt 500g refill" },
  { id: 14, category: "grocery", q: "Colgate Total toothpaste 200g" },
  { id: 15, category: "grocery", q: "Amul butter salted 500g" },
];

const ACCESSORY_WORDS = new Set([
  "replacement", "filter", "refill", "case", "cover", "sleeve", "bag", "pouch",
  "strap", "cable", "charger", "adapter", "plug", "cord", "stand", "mount",
  "holder", "pad", "mat", "protector", "glass", "skin", "wrap", "spare",
  "cartridge", "capsule", "pod", "ink", "toner", "bulb", "lamp", "tube",
]);

type RawResult = {
  title?: string;
  asin?: string;
  price?: { value?: number };
  availability?: { type?: string };
};

type ScoredResult = {
  r: RawResult;
  score: number;
  isAccessory: boolean;
  hits: number;
  totalTokens: number;
};

async function rainforestScoredTopN(query: string, n: number) {
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", RAINFOREST_API_KEY!);
  url.searchParams.set("type", "search");
  url.searchParams.set("amazon_domain", "amazon.in");
  url.searchParams.set("search_term", query);
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString());
  if (!res.ok) {
    return { error: `Rainforest API ${res.status}` as const };
  }

  const data = await res.json();
  const results: RawResult[] = data?.search_results ?? [];
  if (!results.length) return { top: [] as ScoredResult[], rawTopTitle: null as string | null };

  const productTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 1);

  const withPrices = results.filter((r) => typeof r.price?.value === "number");

  const scored: ScoredResult[] = withPrices.map((r) => {
    const titleWords = new Set(
      String(r.title ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 1)
    );
    const hits = productTokens.filter((t) => titleWords.has(t)).length;
    const baseScore = hits / productTokens.length;
    const isAccessory = [...titleWords].some((w) => ACCESSORY_WORDS.has(w));
    return {
      r,
      score: isAccessory ? baseScore * 0.15 : baseScore,
      isAccessory,
      hits,
      totalTokens: productTokens.length,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return { top: scored.slice(0, n), rawTopTitle: results[0]?.title ?? null };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function main() {
  console.log("\n=== Rainforest Variant-Match Measurement ===");
  console.log(`Running ${QUERIES.length} queries through fetchAmazonPrice's scoring logic.`);
  console.log(`For each, review the TOP MATCH and tally: RIGHT / WRONG-VARIANT / ACCESSORY / MISSING.\n`);

  const tally = { right: 0, wrongVariant: 0, accessory: 0, missing: 0 };

  for (const q of QUERIES) {
    try {
      const result = await rainforestScoredTopN(q.q, 3);
      console.log(`\n[${q.id}] ${q.category.toUpperCase()} — "${q.q}"`);
      if ("error" in result) {
        console.log(`  ERROR: ${result.error}`);
        tally.missing++;
        continue;
      }
      if (!result.top.length) {
        console.log(`  NO RESULTS from Rainforest`);
        tally.missing++;
        continue;
      }
      const t = result.top[0];
      const flag = t.isAccessory ? " [ACCESSORY-PENALTY APPLIED]" : "";
      console.log(`  TOP MATCH: ${truncate(String(t.r.title ?? ""), 90)}`);
      console.log(`    price=₹${t.r.price?.value}  asin=${t.r.asin}  score=${t.score.toFixed(2)} (${t.hits}/${t.totalTokens} tokens)${flag}`);
      if (result.rawTopTitle && result.rawTopTitle !== t.r.title) {
        console.log(`    (Rainforest raw-top was: ${truncate(result.rawTopTitle, 85)})`);
      }
      if (result.top.length > 1) {
        console.log(`    runners-up:`);
        for (let i = 1; i < result.top.length; i++) {
          const r = result.top[i];
          console.log(`      ${i + 1}. ${truncate(String(r.r.title ?? ""), 80)}  (score ${r.score.toFixed(2)})`);
        }
      }
      await new Promise((res) => setTimeout(res, 400)); // rate-limit courtesy
    } catch (e) {
      console.log(`  CRASHED: ${String(e).slice(0, 150)}`);
      tally.missing++;
    }
  }

  console.log("\n\n=== Review instructions ===");
  console.log("For each of the 15 rows above, mark it as:");
  console.log("  RIGHT         — top match is the correct product (any reasonable variant)");
  console.log("  WRONG-VARIANT — correct product class but wrong model/size/version");
  console.log("  ACCESSORY     — a case/filter/cable instead of the main product");
  console.log("  MISSING       — Rainforest returned nothing or an unrelated item");
  console.log("\nThen report back the tally (e.g. right=11, wrong=2, accessory=1, missing=1).");
  console.log("Decision gate: >20% non-RIGHT → fix Rainforest matching this Weekender. <10% → defer. 10-20% → judgment call.\n");
}

void main();
