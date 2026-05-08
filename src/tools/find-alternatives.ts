/**
 * find_alternatives — swap an item for a better one along a chosen axis.
 *
 * Heuristic: rank curated items by the chosen metric, filter by constraint
 * (same_chain / same_category / any), exclude the source item, and report
 * the top N with improvement and tradeoff annotations.
 */

import { z } from "zod";
import { allItems } from "../data/index.js";
import { search } from "../search/fuzzy.js";
import type { FoodItem } from "../types.js";
import { jsonResult, type ToolDefinition } from "./types.js";

type OptimizeAxis = "higher_protein" | "lower_calorie" | "lower_sodium";

const input = z.object({
  current_food: z
    .string()
    .min(1)
    .describe(
      "Current food (EN or JP). 例: 'tuna mayo onigiri', 'ツナマヨおにぎり'。",
    ),
  optimize_for: z
    .enum(["higher_protein", "lower_calorie", "lower_sodium"])
    .describe("Optimization axis. 改善したい指標。"),
  constraint: z
    .enum(["same_chain", "same_category", "any"])
    .default("any")
    .describe("Restrict alternatives. 制約条件。"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("Maximum alternatives to return. 最大件数。"),
});

function metric(item: FoodItem, axis: OptimizeAxis): number {
  const n = item.nutrition;
  switch (axis) {
    case "lower_calorie":
      return n.calories;
    case "lower_sodium":
      return n.sodium_mg;
    case "higher_protein":
      // Negate so the same "ascending sort" picks better-protein items.
      return -n.protein_g;
  }
}

function delta(current: FoodItem, alt: FoodItem, axis: OptimizeAxis): string {
  const c = current.nutrition;
  const a = alt.nutrition;
  switch (axis) {
    case "lower_calorie":
      return `calories ${c.calories} → ${a.calories} kcal (${signed(a.calories - c.calories)})`;
    case "lower_sodium":
      return `sodium ${c.sodium_mg} → ${a.sodium_mg}mg (${signed(a.sodium_mg - c.sodium_mg)})`;
    case "higher_protein":
      return `protein ${c.protein_g}g → ${a.protein_g}g (${signed(a.protein_g - c.protein_g, 1)})`;
  }
}

function tradeoff(current: FoodItem, alt: FoodItem, axis: OptimizeAxis): string {
  const c = current.nutrition;
  const a = alt.nutrition;
  const parts: string[] = [];
  if (axis !== "lower_calorie" && a.calories > c.calories + 30) {
    parts.push(`+${a.calories - c.calories} kcal`);
  }
  if (axis !== "higher_protein" && a.protein_g + 2 < c.protein_g) {
    parts.push(`−${(c.protein_g - a.protein_g).toFixed(1)}g protein`);
  }
  if (axis !== "lower_sodium" && a.sodium_mg > c.sodium_mg + 100) {
    parts.push(`+${a.sodium_mg - c.sodium_mg}mg sodium`);
  }
  return parts.length > 0 ? parts.join(", ") : "none";
}

function signed(n: number, decimals = 0): string {
  const v = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  return n >= 0 ? `+${v}` : v;
}

export const findAlternativesTool: ToolDefinition<typeof input> = {
  name: "find_alternatives",
  title: "Find Better Food Alternatives",
  description: [
    "Find alternatives for a food along a chosen axis: higher protein, lower calorie, or lower sodium. Returns each alternative with its improvement and tradeoff.",
    "",
    "ある食品の代替案を、たんぱく質・カロリー・ナトリウムなど指定軸で提案します。改善点とトレードオフを併記します。",
  ].join("\n"),
  inputSchema: input,
  async handler(args) {
    const matches = search(args.current_food, allItems, { max: 1 });
    const current = matches[0]?.item;
    if (!current) {
      return jsonResult({
        current: null,
        query: args.current_food,
        optimize_for: args.optimize_for,
        alternatives: [],
        notes: [`No curated match for '${args.current_food}'.`],
      });
    }

    let pool = allItems.filter((i) => i.id !== current.id);
    if (args.constraint === "same_chain" && current.chain) {
      pool = pool.filter((i) => i.chain === current.chain);
    } else if (args.constraint === "same_category") {
      pool = pool.filter((i) => i.category === current.category);
    }

    // Alternatives must actually be BETTER (or equal) than the current value.
    const currentValue = metric(current, args.optimize_for);
    const better = pool.filter(
      (i) => metric(i, args.optimize_for) <= currentValue,
    );

    better.sort(
      (a, b) => metric(a, args.optimize_for) - metric(b, args.optimize_for),
    );

    const top = better.slice(0, args.max_results);
    return jsonResult({
      current: {
        item: current,
        matched_on: matches[0]!.matched_on,
      },
      optimize_for: args.optimize_for,
      constraint: args.constraint,
      alternatives: top.map((alt) => ({
        food: alt,
        improvement: delta(current, alt, args.optimize_for),
        tradeoff: tradeoff(current, alt, args.optimize_for),
      })),
      result_count: top.length,
    });
  },
};
