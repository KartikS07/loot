/**
 * Unit tests for the price cache module.
 * Run: npm run test:cache
 */

import * as cache from "../src/lib/price-cache";

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

function expect(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("\n=== Price Cache Tests ===\n");

test("makeKey: same product + profile → same key", () => {
  const a = cache.makeKey("Sony WH-1000XM5", { savedCards: ["HDFC"] });
  const b = cache.makeKey("Sony WH-1000XM5", { savedCards: ["HDFC"] });
  expect(a === b, `keys differ: ${a} vs ${b}`);
});

test("makeKey: different product → different key", () => {
  const a = cache.makeKey("Sony WH-1000XM5", {});
  const b = cache.makeKey("boAt Airdopes 141", {});
  expect(a !== b, `keys unexpectedly equal: ${a}`);
});

test("makeKey: case-insensitive + trimmed on product", () => {
  const a = cache.makeKey("  Sony WH-1000XM5  ", {});
  const b = cache.makeKey("sony wh-1000xm5", {});
  expect(a === b, `case/whitespace should not matter: ${a} vs ${b}`);
});

test("makeKey: different profile → different key", () => {
  const a = cache.makeKey("X", { savedCards: ["HDFC"] });
  const b = cache.makeKey("X", { savedCards: ["ICICI"] });
  expect(a !== b, `profile difference should change key`);
});

test("set + get: roundtrip works, returns ageMs near 0", () => {
  cache.clear();
  const k = "test-key-1";
  cache.set(k, { v: 42 });
  const got = cache.get<{ v: number }>(k);
  expect(got !== null, "expected cache hit");
  expect(got!.data.v === 42, "wrong data");
  expect(got!.ageMs >= 0 && got!.ageMs < 100, `ageMs out of range: ${got!.ageMs}`);
});

test("get on missing key → null", () => {
  cache.clear();
  expect(cache.get("nope") === null, "expected null for missing key");
});

test("expired entry → null (and evicted)", () => {
  cache.clear();
  cache.set("expiring", { v: 1 }, 1); // 1ms ttl
  // Wait a tick to let expiry pass deterministically
  const waitUntil = Date.now() + 10;
  while (Date.now() < waitUntil) { /* spin briefly */ }
  expect(cache.get("expiring") === null, "expired entry should return null");
});

test("LRU eviction: over MAX_ENTRIES drops oldest", () => {
  cache.clear();
  // Fill to just under the cap so we know eviction fires predictably.
  // MAX_ENTRIES is 100 in the module.
  for (let i = 0; i < 100; i++) cache.set(`k${i}`, i);
  expect(cache.stats().size === 100, `expected 100, got ${cache.stats().size}`);
  cache.set("k100", 100);
  // Should evict k0 (oldest insertion order)
  expect(cache.get("k0") === null, "oldest entry should have been evicted");
  expect(cache.get<number>("k100")?.data === 100, "newest entry should be present");
  expect(cache.stats().size === 100, "size should stay at cap");
});

console.log(`\n${"─".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  • ${f}`));
}
console.log("");
process.exit(failed > 0 ? 1 : 0);
