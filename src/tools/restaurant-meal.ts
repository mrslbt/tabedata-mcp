/**
 * restaurant_meal — chain-scoped lookup with size variants.
 *
 * Resolves the user's requested size from the matched item's `size_variants`
 * array. Modifications are recorded but not yet applied (v0.3 work).
 */

import { z } from "zod";
import { itemsByChain } from "../data/index.js";
import { search } from "../search/fuzzy.js";
import type { FoodItem, NutritionInfo, SizeVariant } from "../types.js";
import { jsonResult, type ToolDefinition } from "./types.js";

const RESTAURANT_CHAINS = [
  "nakau",
  "sukiya",
  "yoshinoya",
  "matsuya",
  "cocoichi",
  "saizeriya",
  "tenya",
  "mosburger",
  "subway-jp",
  "yayoiken",
  "ootoya",
  "pepper-lunch",
  "marugame",
  "ichiran",
  "kichiri-misshoku",
  "mcdonalds-jp",
  "kfc-jp",
  "starbucks-jp",
  "lotteria",
  "burger-king-jp",
  "freshness-burger",
  "dotour",
] as const;

const input = z.object({
  chain: z
    .enum(RESTAURANT_CHAINS)
    .describe("Restaurant chain slug. 飲食チェーン。"),
  item: z
    .string()
    .min(1)
    .describe("Menu item to look up (EN or JP). 検索するメニュー名。"),
  size: z
    .enum(["mini", "small", "regular", "large", "extra-large"])
    .default("regular")
    .describe(
      "Size variant. Defaults to regular (並). サイズ。既定値: regular(並)。",
    ),
  modifications: z
    .array(z.string())
    .optional()
    .describe(
      "Modifications such as 'no rice' or '玉子追加'. v0.1 records but does not apply these — full delta math lands in v0.3. メニューの変更指示。",
    ),
});

function applyVariant(
  item: FoodItem,
  variant: SizeVariant,
): NutritionInfo {
  // When the variant carries absolute overrides for the core macros, use
  // them. Otherwise scale base nutrition by the modifier.
  if (
    variant.calories != null &&
    variant.protein_g != null &&
    variant.fat_g != null &&
    variant.carbs_g != null &&
    variant.sodium_mg != null
  ) {
    return {
      ...item.nutrition,
      calories: variant.calories,
      protein_g: variant.protein_g,
      fat_g: variant.fat_g,
      carbs_g: variant.carbs_g,
      sodium_mg: variant.sodium_mg,
    };
  }
  const m = variant.modifier;
  return {
    ...item.nutrition,
    calories: round1(item.nutrition.calories * m),
    protein_g: round1(item.nutrition.protein_g * m),
    fat_g: round1(item.nutrition.fat_g * m),
    carbs_g: round1(item.nutrition.carbs_g * m),
    sodium_mg: round1(item.nutrition.sodium_mg * m),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export const restaurantMealTool: ToolDefinition<typeof input> = {
  name: "restaurant_meal",
  title: "Restaurant Chain Meal Lookup",
  description: [
    "Look up a restaurant chain meal with size variants. Sources are official PDFs and allergen tables from the chain's website, cited per item. Default size is 並 (regular). Modifications field is recorded but not yet applied to nutrition totals — full modification math lands in v0.3.",
    "",
    "飲食チェーンのメニューをサイズ違いで検索します。出典は各社公式PDFまたはアレルゲン情報ページで、商品ごとに引用URLを保持します。既定サイズは並。「玉子追加」などの変更項目はv0.1では記録のみ、栄養への反映はv0.3予定。",
  ].join("\n"),
  inputSchema: input,
  async handler(args) {
    const items = itemsByChain.get(args.chain) ?? [];
    if (items.length === 0) {
      return jsonResult({
        chain: args.chain,
        query: args.item,
        size: args.size,
        result: null,
        result_count: 0,
        size_variants: [],
        notes: [
          `No curated items for chain '${args.chain}' yet. Coverage expanding through v1.0.`,
        ],
      });
    }

    const matches = search(args.item, items, { max: 1 });
    const top = matches[0];
    if (!top) {
      return jsonResult({
        chain: args.chain,
        query: args.item,
        size: args.size,
        result: null,
        result_count: 0,
        size_variants: [],
        notes: [`No '${args.item}' on the curated ${args.chain} menu yet.`],
      });
    }

    const item = top.item;
    const variants = item.size_variants ?? [];
    const requestedVariant =
      variants.find((v) => v.size === args.size) ??
      variants.find((v) => v.size === "regular");

    const resolvedNutrition = requestedVariant
      ? applyVariant(item, requestedVariant)
      : item.nutrition;

    return jsonResult({
      chain: args.chain,
      query: args.item,
      size: args.size,
      matched_on: top.matched_on,
      score: top.score,
      result: {
        ...item,
        nutrition: resolvedNutrition,
        applied_size: requestedVariant?.size ?? "regular",
      },
      size_variants: variants,
      modifications_recorded: args.modifications ?? [],
      modifications_applied: [],
      notes:
        args.modifications && args.modifications.length > 0
          ? [
              "modifications were recorded but not applied to nutrition. Full modification math lands in v0.3.",
            ]
          : undefined,
    });
  },
};
