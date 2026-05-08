/**
 * search_food — bilingual fuzzy text search across the curated DB.
 *
 * v0.1: curated only. v0.5: Open Food Facts → USDA → MEXT fallback when
 * curated returns nothing, gated behind config.enableExternalSources.
 */

import { z } from "zod";
import { allItems } from "../data/index.js";
import { search } from "../search/fuzzy.js";
import { jsonResult, type ToolDefinition } from "./types.js";

const input = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search term (English or Japanese). 検索語(英語または日本語)。"),
  language: z
    .enum(["en", "jp", "both"])
    .default("both")
    .describe("Match against EN names, JP names, or both. 検索対象の言語。"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of results. 最大結果数。"),
  category: z
    .enum(["konbini", "restaurant", "generic", "supplement", "drink"])
    .optional()
    .describe("Restrict to a category. カテゴリで絞り込み。"),
});

export const searchFoodTool: ToolDefinition<typeof input> = {
  name: "search_food",
  title: "Search Japanese Food Database",
  description: [
    "Fuzzy bilingual search across the curated Japanese food database. Pure-curated by design — no third-party aggregation. Accepts queries in English or Japanese (e.g. 'salad chicken' or 'サラダチキン').",
    "",
    "キュレーション済みの日本の食品データベースを横断検索します。日本語・英語どちらでも検索可能(例: 「サラダチキン」または 'salad chicken')。第三者アグリゲーションは行いません。",
  ].join("\n"),
  inputSchema: input,
  async handler(args) {
    const matches = search(args.query, allItems, {
      language: args.language,
      max: args.max_results,
      category: args.category,
    });

    return jsonResult({
      results: matches.map((m) => ({
        item: m.item,
        score: m.score,
        matched_on: m.matched_on,
      })),
      result_count: matches.length,
      source: matches.length > 0 ? "curated" : "none",
      query_interpretation: args.query,
      notes:
        matches.length === 0
          ? [
              "No curated match. tabedata-mcp is curated-only by design — if the item isn't in our DB it isn't there. Contributions welcome via PR (see CONTRIBUTING.md).",
            ]
          : undefined,
    });
  },
};
