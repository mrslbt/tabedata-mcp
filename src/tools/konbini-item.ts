/**
 * konbini_item — chain-scoped lookup across the four major Japanese konbini.
 * Curated data only — no third-party fallback.
 */

import { z } from "zod";
import { itemsByChain } from "../data/index.js";
import { search } from "../search/fuzzy.js";
import { jsonResult, type ToolDefinition } from "./types.js";

const input = z.object({
  chain: z
    .enum(["7-eleven", "lawson", "familymart", "ministop"])
    .describe("Konbini chain. コンビニチェーン。"),
  search: z
    .string()
    .optional()
    .describe(
      "Optional search within the chain (EN or JP). 店内検索(英語または日本語)。",
    ),
  category: z
    .enum([
      "onigiri",
      "salad-chicken",
      "boiled-egg",
      "noodle",
      "drink",
      "snack",
      "yogurt",
      "any",
    ])
    .default("any")
    .describe("Subcategory filter. サブカテゴリ。"),
});

export const konbiniItemTool: ToolDefinition<typeof input> = {
  name: "konbini_item",
  title: "Konbini Item Lookup",
  description: [
    "Look up konbini items (7-Eleven, Lawson, FamilyMart, Ministop) by chain. All data is transcribed from official product labels with cited source URLs. Returns curated items only — no third-party fallback for konbini queries.",
    "",
    "コンビニ商品(セブン-イレブン・ローソン・ファミリーマート・ミニストップ)を検索します。すべてのデータは公式の商品ラベルから引用元URL付きで転記しています。コンビニはキュレーション済みデータのみを返します。",
  ].join("\n"),
  inputSchema: input,
  async handler(args) {
    let items = itemsByChain.get(args.chain) ?? [];
    if (args.category !== "any") {
      items = items.filter((i) => i.subcategory === args.category);
    }

    if (args.search) {
      const matches = search(args.search, items, { max: 20 });
      return jsonResult({
        chain: args.chain,
        category: args.category,
        result_count: matches.length,
        results: matches.map((m) => ({
          item: m.item,
          score: m.score,
          matched_on: m.matched_on,
        })),
      });
    }

    return jsonResult({
      chain: args.chain,
      category: args.category,
      result_count: items.length,
      results: items.map((item) => ({ item })),
    });
  },
};
