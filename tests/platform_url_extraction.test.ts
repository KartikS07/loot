/**
 * Pure-function unit tests for platform URL extraction. Fast, deterministic,
 * no network — runs in under a second.
 *
 * Run: npm run test:urls
 */

import { extractDirectLinks, preprocessPriceData } from "../src/lib/platform-urls";

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

function expectEq<T>(actual: T, expected: T, note = "") {
  if (actual !== expected) {
    throw new Error(
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${note ? ` (${note})` : ""}`,
    );
  }
}

console.log("\n=== Platform URL Extraction Tests ===\n");

// ── Preprocessing ──────────────────────────────────────────

test("preprocess: unwraps Markdown link syntax", () => {
  const out = preprocessPriceData("See [this](https://example.com/x) now");
  expectEq(out, "See https://example.com/x now");
});

test("preprocess: strips surrounding backticks", () => {
  const out = preprocessPriceData("Try `https://example.com/x` for sure");
  expectEq(out, "Try https://example.com/x for sure");
});

test("preprocess: decodes %2F and %3A", () => {
  const out = preprocessPriceData("https:%2F%2Fwww.example.com%2Ffoo");
  expectEq(out, "https://www.example.com/foo");
});

// ── Flipkart ───────────────────────────────────────────────

test("Flipkart: extracts lowercase /p/ itemId", () => {
  const out = extractDirectLinks(
    "Flipkart has it at https://www.flipkart.com/realme-buds-air-5/p/itmb7d860129eb21 for ₹2,499",
  );
  expectEq(
    out["Flipkart"],
    "https://www.flipkart.com/realme-buds-air-5/p/itmb7d860129eb21",
  );
});

test("Flipkart: extracts MIXED-CASE /p/ itemId (regression)", () => {
  const out = extractDirectLinks(
    "Listing: https://www.flipkart.com/realme-buds/p/ITMFCC9EBAD2EE3E ₹2,499",
  );
  expectEq(
    out["Flipkart"],
    "https://www.flipkart.com/realme-buds/p/ITMFCC9EBAD2EE3E",
  );
});

test("Flipkart: strips query + fragment", () => {
  const out = extractDirectLinks(
    "https://www.flipkart.com/foo/p/itmabc?affid=xyz&pid=123#reviews",
  );
  expectEq(out["Flipkart"], "https://www.flipkart.com/foo/p/itmabc");
});

test("Flipkart: unwraps Markdown link [label](url)", () => {
  const out = extractDirectLinks(
    "Check [Flipkart listing](https://www.flipkart.com/foo/p/itmabc123) at ₹999",
  );
  expectEq(out["Flipkart"], "https://www.flipkart.com/foo/p/itmabc123");
});

test("Flipkart: decodes URL-encoded slashes in inlined URLs", () => {
  const out = extractDirectLinks(
    "See https:%2F%2Fwww.flipkart.com%2Ffoo%2Fp%2Fitmabc123 for details",
  );
  expectEq(out["Flipkart"], "https://www.flipkart.com/foo/p/itmabc123");
});

test("Flipkart: strips surrounding backticks", () => {
  const out = extractDirectLinks(
    "Flipkart: `https://www.flipkart.com/foo/p/itmxyz999` live now",
  );
  expectEq(out["Flipkart"], "https://www.flipkart.com/foo/p/itmxyz999");
});

test("Flipkart: does NOT extract from search URL", () => {
  const out = extractDirectLinks("Flipkart search: https://www.flipkart.com/search?q=buds");
  expectEq(out["Flipkart"], undefined);
});

// ── Amazon India ───────────────────────────────────────────

test("Amazon: extracts /dp/ ASIN", () => {
  const out = extractDirectLinks("Amazon: https://www.amazon.in/realme/dp/B0C2JZFQZ4");
  expectEq(out["Amazon India"], "https://www.amazon.in/dp/B0C2JZFQZ4");
});

test("Amazon: Rainforest override wins over prose", () => {
  const out = extractDirectLinks(
    "Amazon: https://www.amazon.in/realme/dp/B0C2JZFQZ4",
    "https://www.amazon.in/dp/B0OVERRIDEX",
  );
  expectEq(out["Amazon India"], "https://www.amazon.in/dp/B0OVERRIDEX");
});

test("Amazon: Markdown-wrapped URL is unwrapped", () => {
  const out = extractDirectLinks(
    "See [Amazon](https://www.amazon.in/foo/dp/B0ABCDE123) for ₹3,999",
  );
  expectEq(out["Amazon India"], "https://www.amazon.in/dp/B0ABCDE123");
});

// ── Croma / Blinkit / Zepto / Meesho ───────────────────────

test("Croma: extracts numeric productId", () => {
  const out = extractDirectLinks("https://www.croma.com/realme-buds/p/305040");
  expectEq(out["Croma"], "https://www.croma.com/realme-buds/p/305040");
});

test("Blinkit: extracts /prn/ URL", () => {
  const out = extractDirectLinks("https://www.blinkit.com/prn/realme-buds-air-5/prid/105234");
  expectEq(
    out["Blinkit"],
    "https://www.blinkit.com/prn/realme-buds-air-5/prid/105234",
  );
});

test("Zepto: extracts /pn/ URL", () => {
  const out = extractDirectLinks("https://www.zepto.com/pn/realme-buds-air-5/pvid/abc-123");
  expectEq(
    out["Zepto"],
    "https://www.zepto.com/pn/realme-buds-air-5/pvid/abc-123",
  );
});

test("Meesho: extracts /p/ with numeric id", () => {
  const out = extractDirectLinks("https://www.meesho.com/realme-buds/p/12345");
  expectEq(out["Meesho"], "https://www.meesho.com/realme-buds/p/12345");
});

// ── Integration-ish: combined Gemini-style prose ───────────

test("Combined: extracts all platforms from realistic Gemini prose", () => {
  const prose = `
Based on my search, the realme Buds Air 5 is available at:

- [Flipkart](https://www.flipkart.com/realme-buds-air-5/p/itmb7d860129eb21): ₹2,499 with HDFC discount
- Amazon India: https://www.amazon.in/realme-buds-air-5/dp/B0C2JZFQZ4 for ₹2,599
- Croma: \`https://www.croma.com/realme-buds-air-5/p/305040\` at ₹2,699
- Meesho: https://www.meesho.com/realme-buds-air-5/p/98765 for ₹2,449
- Blinkit (same-day): https://www.blinkit.com/prn/realme-buds-air-5/prid/105234 ₹2,699
- Zepto: https%3A%2F%2Fwww.zepto.com%2Fpn%2Frealme-buds-air-5%2Fpvid%2Fxyz-88 ₹2,699
`;
  const out = extractDirectLinks(prose);
  expectEq(out["Flipkart"], "https://www.flipkart.com/realme-buds-air-5/p/itmb7d860129eb21");
  expectEq(out["Amazon India"], "https://www.amazon.in/dp/B0C2JZFQZ4");
  expectEq(out["Croma"], "https://www.croma.com/realme-buds-air-5/p/305040");
  expectEq(out["Meesho"], "https://www.meesho.com/realme-buds-air-5/p/98765");
  expectEq(out["Blinkit"], "https://www.blinkit.com/prn/realme-buds-air-5/prid/105234");
  expectEq(out["Zepto"], "https://www.zepto.com/pn/realme-buds-air-5/pvid/xyz-88");
});

// ── Summary ────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  • ${f}`));
}
console.log("");
process.exit(failed > 0 ? 1 : 0);
