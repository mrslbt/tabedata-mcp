#!/usr/bin/env node
/**
 * End-to-end integration tests over the actual MCP stdio protocol. Exercises
 * every tool against the curated seed dataset.
 *
 * Run: SKIP_LIVE=1 node test/integration.test.mjs   (default)
 *
 * No live API calls in v0.1; SKIP_LIVE remains in the env shape for forward
 * compatibility with v0.5 external-source fallbacks.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[36m·\x1b[0m";

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`${PASS} ${label}`);
  } else {
    failures++;
    console.log(`${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function parseJsonContent(toolResp) {
  const block = toolResp.content?.[0];
  if (!block || block.type !== "text") {
    throw new Error("expected text content block");
  }
  return JSON.parse(block.text);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, TABEDATA_DISABLE_EXTERNAL: "true" },
});

const client = new Client(
  { name: "tabedata-integration-test", version: "1.0.0" },
  { capabilities: {} },
);

try {
  await client.connect(transport);
  console.log(`${PASS} Server connected over stdio`);

  // ─── Tool surface ───────────────────────────────
  const toolsResp = await client.listTools();
  const toolNames = toolsResp.tools.map((t) => t.name).sort();
  console.log(`${INFO} tools: ${toolNames.join(", ")}`);

  const expected = [
    "analyze_meal",
    "daily_targets",
    "find_alternatives",
    "konbini_item",
    "restaurant_meal",
    "search_food",
  ];
  check(
    "all 6 tools exposed",
    JSON.stringify(toolNames) === JSON.stringify(expected),
  );

  for (const tool of toolsResp.tools) {
    const hasJp = /[぀-ヿ一-鿿]/.test(tool.description ?? "");
    check(`${tool.name} has Japanese in description`, hasJp);
  }

  // ─── daily_targets ──────────────────────────────
  console.log(`\n${INFO} daily_targets`);
  const targets = parseJsonContent(
    await client.callTool({
      name: "daily_targets",
      arguments: {
        weight_kg: 93,
        height_cm: 170.7,
        age: 34,
        sex: "male",
        activity: "moderate",
        goal: "cut_moderate",
      },
    }),
  );
  check("daily_targets returns BMR ~1832", targets.bmr === 1832);
  check("daily_targets returns TDEE ~2840", targets.tdee === 2840);
  check("daily_targets returns water 3.3L", targets.target_water_l === 3.3);

  // ─── search_food ────────────────────────────────
  console.log(`\n${INFO} search_food`);
  const sf1 = parseJsonContent(
    await client.callTool({
      name: "search_food",
      arguments: { query: "salad chicken" },
    }),
  );
  check(
    "search_food finds salad chicken (English)",
    sf1.result_count > 0 && sf1.results[0].item.id.includes("salad-chicken"),
  );

  const sf2 = parseJsonContent(
    await client.callTool({
      name: "search_food",
      arguments: { query: "親子丼" },
    }),
  );
  check(
    "search_food finds 親子丼 (Japanese kanji)",
    sf2.result_count > 0 && sf2.results[0].item.id === "nakau-oyakodon",
  );

  const sf3 = parseJsonContent(
    await client.callTool({
      name: "search_food",
      arguments: { query: "オヤコドン" },
    }),
  );
  check(
    "search_food finds オヤコドン (katakana → matches kana variant)",
    sf3.result_count > 0 && sf3.results[0].item.id === "nakau-oyakodon",
  );

  const sf4 = parseJsonContent(
    await client.callTool({
      name: "search_food",
      arguments: { query: "rice", category: "generic" },
    }),
  );
  check(
    "search_food respects category=generic filter",
    sf4.results.every((r) => r.item.category === "generic"),
  );

  // ─── konbini_item ───────────────────────────────
  console.log(`\n${INFO} konbini_item`);
  const k1 = parseJsonContent(
    await client.callTool({
      name: "konbini_item",
      arguments: { chain: "7-eleven", category: "salad-chicken" },
    }),
  );
  check(
    "konbini_item: 7-Eleven salad-chicken returns ≥2 items",
    k1.result_count >= 2,
  );
  check(
    "konbini_item: results all 7-Eleven",
    k1.results.every((r) => r.item.chain === "7-eleven"),
  );

  const k2 = parseJsonContent(
    await client.callTool({
      name: "konbini_item",
      arguments: { chain: "lawson", search: "ブランパン" },
    }),
  );
  check(
    "konbini_item: 'ブランパン' resolves to bran bread",
    k2.results[0]?.item.id === "lawson-bran-pan-2pc",
  );

  // ─── restaurant_meal with size variants ─────────
  console.log(`\n${INFO} restaurant_meal`);
  const rm1 = parseJsonContent(
    await client.callTool({
      name: "restaurant_meal",
      arguments: { chain: "nakau", item: "oyakodon", size: "large" },
    }),
  );
  check(
    "restaurant_meal: Nakau oyakodon large = 738 kcal (per official PDF)",
    rm1.result?.nutrition.calories === 738,
  );
  check(
    "restaurant_meal: applied_size = large",
    rm1.result?.applied_size === "large",
  );
  check(
    "restaurant_meal: size_variants includes all 4 sizes",
    rm1.size_variants?.length === 4,
  );

  const rm2 = parseJsonContent(
    await client.callTool({
      name: "restaurant_meal",
      arguments: { chain: "nakau", item: "親子丼" },
    }),
  );
  check(
    "restaurant_meal: defaults to regular (並) when no size given",
    rm2.result?.nutrition.calories === 620,
  );

  const rm3 = parseJsonContent(
    await client.callTool({
      name: "restaurant_meal",
      arguments: {
        chain: "nakau",
        item: "親子丼",
        modifications: ["玉子追加"],
      },
    }),
  );
  check(
    "restaurant_meal: records modifications",
    Array.isArray(rm3.modifications_recorded) &&
      rm3.modifications_recorded.includes("玉子追加"),
  );

  // ─── find_alternatives ──────────────────────────
  console.log(`\n${INFO} find_alternatives`);
  const fa1 = parseJsonContent(
    await client.callTool({
      name: "find_alternatives",
      arguments: {
        current_food: "tuna mayo onigiri",
        optimize_for: "lower_calorie",
        constraint: "same_chain",
        max_results: 5,
      },
    }),
  );
  check(
    "find_alternatives: lower-calorie returns alternatives",
    fa1.alternatives.length > 0,
  );
  check(
    "find_alternatives: every alternative has lower-or-equal calories",
    fa1.alternatives.every(
      (a) =>
        a.food.nutrition.calories <= fa1.current.item.nutrition.calories,
    ),
  );

  const fa2 = parseJsonContent(
    await client.callTool({
      name: "find_alternatives",
      arguments: {
        current_food: "Lawson karaage-kun",
        optimize_for: "higher_protein",
        constraint: "any",
      },
    }),
  );
  check(
    "find_alternatives: higher-protein alts all ≥ baseline protein",
    fa2.alternatives.every(
      (a) =>
        a.food.nutrition.protein_g >=
        fa2.current.item.nutrition.protein_g,
    ),
  );

  // ─── analyze_meal ───────────────────────────────
  console.log(`\n${INFO} analyze_meal`);
  const am1 = parseJsonContent(
    await client.callTool({
      name: "analyze_meal",
      arguments: {
        items: ["1 oikos plain", "2 boiled eggs", "200g rice"],
      },
    }),
  );
  check(
    "analyze_meal: all 3 items resolved against curated DB",
    am1.items_resolved.every((r) => r.confidence !== "unresolved"),
  );
  // Expected totals:
  //   oikos plain: 92 kcal, 12g protein
  //   2 boiled eggs (~50g each): 152 kcal, 12.4g protein
  //   200g rice: 336 kcal, 5g protein
  //   sum: ~580 kcal, ~29.4g protein
  check(
    "analyze_meal: total calories ≈ 580",
    Math.abs(am1.totals.calories - 580) <= 15,
    `got ${am1.totals.calories}`,
  );
  check(
    "analyze_meal: total protein ≈ 29.4g",
    Math.abs(am1.totals.protein_g - 29.4) <= 1,
    `got ${am1.totals.protein_g}`,
  );

  // Restaurant size variant via natural language
  const am2 = parseJsonContent(
    await client.callTool({
      name: "analyze_meal",
      arguments: { items: ["Nakau large oyakodon"] },
    }),
  );
  check(
    "analyze_meal: parses 'Nakau large oyakodon' to size large",
    am2.items_resolved[0].resolved?.id === "nakau-oyakodon" &&
      am2.items_resolved[0].scaled_nutrition.calories === 738,
    `got ${am2.items_resolved[0].scaled_nutrition?.calories} kcal`,
  );

  // User profile target comparison
  const am3 = parseJsonContent(
    await client.callTool({
      name: "analyze_meal",
      arguments: {
        items: ["1 oikos plain", "200g rice"],
        user_profile: {
          weight_kg: 93,
          height_cm: 170.7,
          age: 34,
          sex: "male",
          activity: "moderate",
          goal: "cut_moderate",
        },
      },
    }),
  );
  check(
    "analyze_meal: vs_targets present when user_profile passed",
    am3.vs_targets != null,
  );
  check(
    "analyze_meal: vs_targets includes calorie_delta",
    typeof am3.vs_targets?.calorie_delta === "number",
  );

  // Validation error path
  const bad = await client.callTool({
    name: "konbini_item",
    arguments: { chain: "not-a-chain" },
  });
  check("konbini_item rejects invalid chain enum", bad.isError === true);
} catch (err) {
  failures++;
  console.log(`${FAIL} Test harness error: ${err?.message ?? err}`);
  console.log(err?.stack);
} finally {
  await client.close().catch(() => {});
}

if (failures > 0) {
  console.log(`\n${FAIL} ${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\n${PASS} all integration checks passed`);
