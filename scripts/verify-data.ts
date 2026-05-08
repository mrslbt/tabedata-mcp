/**
 * verify-data — walk every curated item and check:
 *   1. Required fields present (id, names, source, last_updated, confidence)
 *   2. id uniqueness across files
 *   3. source.url returns a non-error response (HEAD)
 *   4. last_updated within 12 months — older items get a stale flag
 *
 * Run: npm run verify-data
 *
 * Exits non-zero on any required-field failure or non-2xx source URL,
 * so this can run in CI from item #1 to prevent bit-rot.
 */

import { allItems } from "../src/data/index.js";

const STALE_AFTER_DAYS = 365;

let errors = 0;
let warnings = 0;

function fail(item: string, msg: string) {
  errors++;
  console.error(`✗ ${item}: ${msg}`);
}
function warn(item: string, msg: string) {
  warnings++;
  console.warn(`⚠ ${item}: ${msg}`);
}

const seen = new Set<string>();
for (const item of allItems) {
  if (seen.has(item.id)) fail(item.id, "duplicate id");
  seen.add(item.id);
  if (!item.name_en) fail(item.id, "missing name_en");
  if (!item.name_jp) fail(item.id, "missing name_jp");
  if (!item.source?.url) fail(item.id, "missing source.url");
  if (!item.last_updated) fail(item.id, "missing last_updated");
  if (!item.confidence) fail(item.id, "missing confidence");

  if (item.last_updated) {
    const ageDays =
      (Date.now() - new Date(item.last_updated).getTime()) / 86_400_000;
    if (ageDays > STALE_AFTER_DAYS) {
      warn(item.id, `stale (${Math.round(ageDays)} days since verification)`);
    }
  }
}

if (process.env.SKIP_NETWORK !== "true") {
  for (const item of allItems) {
    if (!item.source?.url) continue;
    try {
      const res = await fetch(item.source.url, { method: "HEAD" });
      // 403 = bot-blocked (page exists; many JP corporate sites do this)
      // 405 = method not allowed (HEAD not supported, but page exists)
      // 429 = rate-limited (page exists, just throttled)
      // Treat all three as "page exists" rather than dead URLs.
      if (
        !res.ok &&
        res.status !== 403 &&
        res.status !== 405 &&
        res.status !== 429
      ) {
        fail(item.id, `source url returned ${res.status}: ${item.source.url}`);
      }
    } catch (err) {
      fail(
        item.id,
        `source url unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

console.log(
  `\n${allItems.length} items checked — ${errors} error(s), ${warnings} warning(s)`,
);
process.exit(errors > 0 ? 1 : 0);
