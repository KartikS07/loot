/**
 * Unit tests for platform whitelist + alias normalization.
 * Run: npm run test:platforms
 */

import { canonicalPlatform, filterPlatforms, KNOWN_PLATFORMS } from "../src/lib/platforms";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    const msg = (e as Error).message;
    failures.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}\n    → ${msg}`);
  }
}

function expect<T>(actual: T, expected: T, note = "") {
  if (actual !== expected) {
    throw new Error(
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${note ? ` (${note})` : ""}`,
    );
  }
}

console.log("\n=== Platform Whitelist + Alias Tests ===\n");

test("canonical: exact Amazon India matches", () => {
  expect(canonicalPlatform("Amazon India"), "Amazon India");
});

test("canonical: 'amazon' alias → Amazon India", () => {
  expect(canonicalPlatform("amazon"), "Amazon India");
});

test("canonical: 'Amazon.in' alias → Amazon India", () => {
  expect(canonicalPlatform("Amazon.in"), "Amazon India");
});

test("canonical: 'Amazon.com' → Amazon India (defensive)", () => {
  expect(canonicalPlatform("Amazon.com"), "Amazon India");
});

test("canonical: case-insensitive Flipkart", () => {
  expect(canonicalPlatform("FLIPKART"), "Flipkart");
  expect(canonicalPlatform("flipkart"), "Flipkart");
});

test("canonical: 'JioMart' and 'Jio Mart' both map", () => {
  expect(canonicalPlatform("JioMart"), "JioMart");
  expect(canonicalPlatform("Jio Mart"), "JioMart");
});

test("canonical: 'Reliance' alias → Reliance Digital", () => {
  expect(canonicalPlatform("Reliance"), "Reliance Digital");
  expect(canonicalPlatform("Reliance Digital"), "Reliance Digital");
});

test("canonical: 'Instamart' and 'Swiggy Instamart' both map", () => {
  expect(canonicalPlatform("Instamart"), "Swiggy Instamart");
  expect(canonicalPlatform("Swiggy Instamart"), "Swiggy Instamart");
});

test("canonical: 'TataCliq' (no space) maps", () => {
  expect(canonicalPlatform("TataCliq"), "Tata Cliq");
});

test("canonical: hallucinated 'Imaginext' → null", () => {
  expect(canonicalPlatform("Imaginext"), null);
});

test("canonical: random brand 'Canon India' → null", () => {
  expect(canonicalPlatform("Canon India"), null);
});

test("canonical: empty + whitespace → null", () => {
  expect(canonicalPlatform(""), null);
  expect(canonicalPlatform("   "), null);
});

test("canonical: non-string → null", () => {
  expect(canonicalPlatform(null as unknown as string), null);
  expect(canonicalPlatform(undefined as unknown as string), null);
});

// ── filterPlatforms ──

test("filter: drops unknown, keeps known, normalizes names", () => {
  const input = [
    { name: "Amazon", price: 100 },
    { name: "Imaginext", price: 200 },
    { name: "Flipkart", price: 150 },
    { name: "Bogus Store", price: 999 },
  ];
  const out = filterPlatforms(input);
  expect(out.length, 2);
  expect(out[0].name, "Amazon India");
  expect(out[1].name, "Flipkart");
});

test("filter: dedupes Amazon + Amazon India → one entry", () => {
  const input = [
    { name: "Amazon", price: 100 },
    { name: "Amazon India", price: 105 },
  ];
  const out = filterPlatforms(input);
  expect(out.length, 1, "should dedupe by canonical name");
  expect(out[0].name, "Amazon India");
});

test("filter: preserves other fields on each entry", () => {
  const input = [{ name: "Flipkart", listedPrice: "₹1,000", inStock: true }];
  const out = filterPlatforms(input);
  expect(out.length, 1);
  expect(out[0].listedPrice, "₹1,000");
  expect(out[0].inStock, true);
});

test("filter: null/undefined/empty input → []", () => {
  expect(filterPlatforms(null).length, 0);
  expect(filterPlatforms(undefined).length, 0);
  expect(filterPlatforms([]).length, 0);
});

test("filter: missing name field → dropped", () => {
  const input = [{ name: undefined, price: 100 }] as Array<{ name?: string; price: number }>;
  const out = filterPlatforms(input);
  expect(out.length, 0);
});

test("KNOWN_PLATFORMS has exactly 11 entries", () => {
  expect(KNOWN_PLATFORMS.length, 11);
});

console.log(`\n${"─".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  • ${f}`));
}
console.log("");
process.exit(failed > 0 ? 1 : 0);
