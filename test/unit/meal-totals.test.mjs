import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scaleNutrition,
  scaleForQuantity,
  sumTotals,
} from "../../src/analyzer/meal-totals.ts";

const oikos = {
  id: "oikos-plain",
  name_en: "Oikos Plain Greek Yogurt",
  name_jp: "オイコス プレーン",
  category: "supplement",
  serving: { size_label: "1 pouch", size_label_jp: "1個", size_g: 113 },
  nutrition: {
    calories: 92,
    protein_g: 12,
    fat_g: 0,
    carbs_g: 11,
    sodium_mg: 50,
  },
  tags: ["high_protein"],
  source: { url: "x", type: "official_label", verified_at: "2026-05-09", verified_by: "@mrslbt" },
  confidence: "high",
  last_updated: "2026-05-09",
};

const rice = {
  id: "white-rice-cooked",
  name_en: "White Rice (Cooked)",
  name_jp: "白米",
  category: "generic",
  serving: { size_label: "200g serving", size_label_jp: "200g", size_g: 200 },
  nutrition: {
    calories: 336,
    protein_g: 5,
    fat_g: 0.6,
    carbs_g: 74,
    sodium_mg: 2,
  },
  tags: [],
  source: { url: "x", type: "mext", verified_at: "2026-05-09", verified_by: "@mrslbt" },
  confidence: "high",
  last_updated: "2026-05-09",
};

test("scaleNutrition: doubles correctly", () => {
  const out = scaleNutrition(oikos.nutrition, 2);
  assert.equal(out.calories, 184);
  assert.equal(out.protein_g, 24);
  assert.equal(out.sodium_mg, 100);
});

test("scaleForQuantity: serving uses count directly", () => {
  const { nutrition, factor } = scaleForQuantity(oikos, 2, "serving");
  assert.equal(factor, 2);
  assert.equal(nutrition.calories, 184);
});

test("scaleForQuantity: grams scale by size_g", () => {
  // rice serving = 200g → 100g should halve.
  const { nutrition, factor } = scaleForQuantity(rice, 100, "g");
  assert.equal(factor, 0.5);
  assert.equal(nutrition.calories, 168);
  assert.equal(nutrition.carbs_g, 37);
});

test("scaleForQuantity: grams without size_g returns warning", () => {
  const noSize = {
    ...rice,
    serving: { size_label: "1 portion", size_label_jp: "1人前" },
  };
  const r = scaleForQuantity(noSize, 100, "g");
  assert.ok(r.warning, "expected warning when size_g missing");
  assert.equal(r.factor, 1);
});

test("sumTotals: aggregates across resolved items", () => {
  const resolved = [
    {
      query: "1 oikos",
      resolved: oikos,
      quantity: 1,
      unit: "serving",
      confidence: "exact",
      source: "curated",
      scaled_nutrition: oikos.nutrition,
    },
    {
      query: "200g rice",
      resolved: rice,
      quantity: 200,
      unit: "g",
      confidence: "exact",
      source: "curated",
      scaled_nutrition: rice.nutrition,
    },
  ];
  const totals = sumTotals(resolved);
  assert.equal(totals.calories, 92 + 336);
  assert.equal(totals.protein_g, 12 + 5);
  assert.equal(totals.sodium_mg, 50 + 2);
});

test("sumTotals: skips unresolved items", () => {
  const resolved = [
    {
      query: "mystery food",
      resolved: null,
      quantity: 1,
      unit: "serving",
      confidence: "unresolved",
      source: "none",
    },
  ];
  const totals = sumTotals(resolved);
  assert.equal(totals.calories, 0);
});
