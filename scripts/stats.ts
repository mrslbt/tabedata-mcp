/**
 * stats — print database stats: total items, breakdown by category and chain,
 * confidence distribution, source-type distribution. Used to track v1.0
 * coverage progress toward 300+ items.
 */

import { allItems } from "../src/data/index.js";

const byCategory = new Map<string, number>();
const byChain = new Map<string, number>();
const byConfidence = new Map<string, number>();
const bySource = new Map<string, number>();

for (const item of allItems) {
  byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  if (item.chain) {
    byChain.set(item.chain, (byChain.get(item.chain) ?? 0) + 1);
  }
  byConfidence.set(item.confidence, (byConfidence.get(item.confidence) ?? 0) + 1);
  bySource.set(item.source.type, (bySource.get(item.source.type) ?? 0) + 1);
}

const sorted = (m: Map<string, number>) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\n=== tabedata-mcp stats ===\n`);
console.log(`Total items: ${allItems.length}\n`);
console.log(`By category:`);
for (const [k, v] of sorted(byCategory)) console.log(`  ${k.padEnd(12)} ${v}`);
console.log(`\nBy chain:`);
for (const [k, v] of sorted(byChain)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(`\nBy confidence:`);
for (const [k, v] of sorted(byConfidence)) console.log(`  ${k.padEnd(8)} ${v}`);
console.log(`\nBy source type:`);
for (const [k, v] of sorted(bySource)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(`\nv1.0 target: 300+ items. Progress: ${allItems.length}/300\n`);
