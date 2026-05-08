/**
 * Resolve a free-form meal-item string to a curated FoodItem with scaled
 * nutrition. Bridges parse-quantity + fuzzy search + size variants + scaling.
 */

import { allItems } from "../data/index.js";
import type { FoodItem, ResolvedItem, SizeVariant } from "../types.js";
import { search } from "../search/fuzzy.js";
import { parseQuantity } from "./parse-quantity.js";
import { scaleForQuantity, scaleNutrition } from "./meal-totals.js";

export function resolveMealItem(raw: string): ResolvedItem {
  const parsed = parseQuantity(raw);
  const matches = search(parsed.query, allItems, { max: 1 });
  const top = matches[0];

  if (!top) {
    return {
      query: raw,
      resolved: null,
      quantity: parsed.count,
      unit: parsed.unit,
      confidence: "unresolved",
      source: "none",
      notes: parsed.modifications.length
        ? [`modifications recorded: ${parsed.modifications.join(", ")}`]
        : undefined,
    };
  }

  const item = top.item;
  const notes: string[] = [];

  let working: FoodItem = item;
  let appliedSizeNote: string | undefined;

  if (parsed.size && item.size_variants?.length) {
    const variant = item.size_variants.find((v) => v.size === parsed.size);
    if (variant) {
      working = applySizeVariant(item, variant);
      appliedSizeNote = `applied size variant: ${variant.size} (${variant.size_label_jp ?? variant.size})`;
    } else {
      notes.push(
        `requested size '${parsed.size}' not available for '${item.id}'; using base.`,
      );
    }
  }
  if (appliedSizeNote) notes.push(appliedSizeNote);

  const { nutrition, factor, warning } = scaleForQuantity(
    working,
    parsed.count,
    parsed.unit,
  );
  if (warning) notes.push(warning);

  if (parsed.modifications.length) {
    notes.push(
      `modifications recorded but not applied (v0.3): ${parsed.modifications.join(", ")}`,
    );
  }

  // Confidence: exact = top score 1000, fuzzy = anything else above 0.
  const confidence: ResolvedItem["confidence"] =
    top.score >= 1000 ? "exact" : top.score >= 600 ? "fuzzy" : "fallback";

  return {
    query: raw,
    resolved: working,
    quantity: parsed.count,
    unit: parsed.unit,
    confidence,
    source: "curated",
    scaled_nutrition: nutrition,
    notes: notes.length > 0 ? notes : undefined,
  };
}

function applySizeVariant(item: FoodItem, variant: SizeVariant): FoodItem {
  if (
    variant.calories != null &&
    variant.protein_g != null &&
    variant.fat_g != null &&
    variant.carbs_g != null &&
    variant.sodium_mg != null
  ) {
    return {
      ...item,
      nutrition: {
        ...item.nutrition,
        calories: variant.calories,
        protein_g: variant.protein_g,
        fat_g: variant.fat_g,
        carbs_g: variant.carbs_g,
        sodium_mg: variant.sodium_mg,
      },
      serving: variant.size_g
        ? {
            ...item.serving,
            size_label_jp: variant.size_label_jp ?? item.serving.size_label_jp,
            size_g: variant.size_g,
          }
        : item.serving,
    };
  }
  return {
    ...item,
    nutrition: scaleNutrition(item.nutrition, variant.modifier),
  };
}
