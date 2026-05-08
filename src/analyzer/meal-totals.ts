/**
 * Sum nutrition across resolved meal items, scaling by quantity.
 *
 * Quantity scaling rules:
 *   - unit "serving" → multiply nutrition by count (1.0 default).
 *   - unit "piece"   → same as serving (each piece = one serving).
 *   - unit "g"       → if item.serving.size_g is known, scale by g/size_g.
 *                       Otherwise treat as serving with a warning.
 *   - unit "ml"      → if item.serving.size_ml is known, scale by ml/size_ml.
 *
 * Restaurant size variants resolve to a per-size NutritionInfo BEFORE this
 * function — the size_variant override is applied by the resolver, so we
 * only see the final scalable item here.
 */

import type {
  FoodItem,
  MealTotals,
  NutritionInfo,
  ResolvedItem,
} from "../types.js";

export function scaleNutrition(
  base: NutritionInfo,
  factor: number,
): NutritionInfo {
  return {
    calories: round1(base.calories * factor),
    protein_g: round1(base.protein_g * factor),
    fat_g: round1(base.fat_g * factor),
    carbs_g: round1(base.carbs_g * factor),
    fiber_g: base.fiber_g != null ? round1(base.fiber_g * factor) : undefined,
    sugar_g: base.sugar_g != null ? round1(base.sugar_g * factor) : undefined,
    sodium_mg: round1(base.sodium_mg * factor),
    cholesterol_mg:
      base.cholesterol_mg != null
        ? round1(base.cholesterol_mg * factor)
        : undefined,
    salt_g: base.salt_g != null ? round1(base.salt_g * factor) : undefined,
  };
}

export function scaleForQuantity(
  item: FoodItem,
  count: number,
  unit: ResolvedItem["unit"],
): { nutrition: NutritionInfo; factor: number; warning?: string } {
  if (unit === "serving" || unit === "piece") {
    return { nutrition: scaleNutrition(item.nutrition, count), factor: count };
  }
  if (unit === "g") {
    const sizeG = item.serving.size_g;
    if (sizeG && sizeG > 0) {
      const factor = count / sizeG;
      return { nutrition: scaleNutrition(item.nutrition, factor), factor };
    }
    return {
      nutrition: scaleNutrition(item.nutrition, 1),
      factor: 1,
      warning: `${item.id} has no serving.size_g; treating ${count}g as 1 serving`,
    };
  }
  if (unit === "ml") {
    const sizeMl = item.serving.size_ml;
    if (sizeMl && sizeMl > 0) {
      const factor = count / sizeMl;
      return { nutrition: scaleNutrition(item.nutrition, factor), factor };
    }
    return {
      nutrition: scaleNutrition(item.nutrition, 1),
      factor: 1,
      warning: `${item.id} has no serving.size_ml; treating ${count}ml as 1 serving`,
    };
  }
  return { nutrition: scaleNutrition(item.nutrition, 1), factor: 1 };
}

export function sumTotals(items: ResolvedItem[]): MealTotals {
  const totals: MealTotals = {
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    fiber_g: 0,
    sodium_mg: 0,
  };
  for (const r of items) {
    if (!r.scaled_nutrition) continue;
    totals.calories += r.scaled_nutrition.calories;
    totals.protein_g += r.scaled_nutrition.protein_g;
    totals.fat_g += r.scaled_nutrition.fat_g;
    totals.carbs_g += r.scaled_nutrition.carbs_g;
    totals.fiber_g += r.scaled_nutrition.fiber_g ?? 0;
    totals.sodium_mg += r.scaled_nutrition.sodium_mg;
  }
  return {
    calories: round1(totals.calories),
    protein_g: round1(totals.protein_g),
    fat_g: round1(totals.fat_g),
    carbs_g: round1(totals.carbs_g),
    fiber_g: round1(totals.fiber_g),
    sodium_mg: round1(totals.sodium_mg),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
