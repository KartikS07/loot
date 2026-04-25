/**
 * Pure-function tests for the URL → product path-extraction logic.
 * Run: npm run test:url-research
 *
 * Tests only the deterministic extraction paths (Amazon ASIN, Flipkart itemId,
 * Croma productId). Gemini fallback path needs an integration test, not a unit one.
 */

// We re-implement the path extractor in this test file because the real one
// is colocated inside route.ts which can't be cleanly imported (Next.js route
// module). The intent is to lock down the regex behaviour the route relies on.
//
// If you change the regexes in route.ts, copy them here too.

function extractAmazon(pathname: string) {
  const m = pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (!m) return null;
  return m[1].toUpperCase();
}

function extractFlipkart(pathname: string) {
  const m = pathname.match(/\/([^/]+)\/p\/([a-z0-9]+)/i);
  if (!m) return null;
  return { slug: m[1], itemId: m[2] };
}

function extractCroma(pathname: string) {
  const m = pathname.match(/\/([^/]+)\/p\/(\d+)/i);
  if (!m) return null;
  return { slug: m[1], productId: m[2] };
}

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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${note ? ` (${note})` : ""}`,
    );
  }
}

console.log("\n=== URL → Product Path Extraction Tests ===\n");

// ── Amazon ──

test("Amazon: extracts ASIN from /dp/", () => {
  expect(
    extractAmazon("/Sony-WH-1000XM6-Headphones-Microphones-Studio-Quality/dp/B0F3PT1VBL"),
    "B0F3PT1VBL",
  );
});

test("Amazon: extracts ASIN from /dp/ with trailing path", () => {
  expect(
    extractAmazon("/Sony-WH-1000XM6/dp/B0F3PT1VBL/ref=sr_1_3"),
    "B0F3PT1VBL",
  );
});

test("Amazon: extracts ASIN from /gp/product/", () => {
  expect(extractAmazon("/gp/product/B09XS7JWHH"), "B09XS7JWHH");
});

test("Amazon: lowercase ASIN normalized to uppercase", () => {
  expect(extractAmazon("/foo/dp/b0f3pt1vbl"), "B0F3PT1VBL");
});

test("Amazon: no ASIN on search URL", () => {
  expect(extractAmazon("/s?k=headphones"), null);
});

test("Amazon: no ASIN on category URL", () => {
  expect(extractAmazon("/electronics/category/12345"), null);
});

// ── Flipkart ──

test("Flipkart: extracts /p/ itemId", () => {
  const got = extractFlipkart("/realme-buds-air-5/p/itmb7d860129eb21");
  expect(got, { slug: "realme-buds-air-5", itemId: "itmb7d860129eb21" });
});

test("Flipkart: extracts mixed-case itemId", () => {
  const got = extractFlipkart("/buds/p/ITMFCC9EBAD2EE3E");
  expect(got, { slug: "buds", itemId: "ITMFCC9EBAD2EE3E" });
});

test("Flipkart: rejects search URL", () => {
  expect(extractFlipkart("/search"), null);
});

// ── Croma ──

test("Croma: extracts numeric productId", () => {
  const got = extractCroma("/realme-buds-air-5/p/305040");
  expect(got, { slug: "realme-buds-air-5", productId: "305040" });
});

test("Croma: rejects non-numeric productId on /p/", () => {
  expect(extractCroma("/foo/p/abc123"), null);
});

// ── Slug → product name normalization ──

test("Slug normalization: dashes → spaces", () => {
  const slug = "Sony-WH-1000XM6-Headphones-Microphones-Studio-Quality";
  const cleaned = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  expect(cleaned, "Sony WH 1000XM6 Headphones Microphones Studio Quality");
});

test("Slug normalization: collapses multiple spaces", () => {
  const slug = "foo--bar---baz";
  const cleaned = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  expect(cleaned, "foo bar baz");
});

console.log(`\n${"─".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  • ${f}`));
}
console.log("");
process.exit(failed > 0 ? 1 : 0);
