/**
 * Unit tests for daily-targets math.
 * Run: npm run test:unit
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateBMR,
  calculateDailyTargets,
} from "../../src/analyzer/targets.ts";

test("calculateBMR — Mifflin-St Jeor, male", () => {
  // 10 * 93 + 6.25 * 170.7 - 5 * 34 + 5 = 930 + 1066.875 - 170 + 5 = 1831.875 → 1832
  const bmr = calculateBMR({
    weight_kg: 93,
    height_cm: 170.7,
    age: 34,
    sex: "male",
    activity: "moderate",
    goal: "cut_moderate",
  });
  assert.equal(bmr, 1832);
});

test("calculateBMR — Mifflin-St Jeor, female", () => {
  // 10 * 60 + 6.25 * 165 - 5 * 30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 → 1320
  const bmr = calculateBMR({
    weight_kg: 60,
    height_cm: 165,
    age: 30,
    sex: "female",
    activity: "light",
    goal: "maintain",
  });
  assert.equal(bmr, 1320);
});

test("daily targets — male, moderate, cut_moderate", () => {
  const t = calculateDailyTargets({
    weight_kg: 93,
    height_cm: 170.7,
    age: 34,
    sex: "male",
    activity: "moderate",
    goal: "cut_moderate",
  });
  // BMR 1832, TDEE 1832 * 1.55 = 2839.6 → 2840, deficit -500 → 2340
  assert.equal(t.bmr, 1832);
  assert.equal(t.tdee, 2840);
  assert.equal(t.target_calories, 2340);
  // Protein 2.0 g/kg × 93 = 186
  assert.equal(t.target_protein_g, 186);
  assert.equal(t.basis.formula, "Mifflin-St Jeor");
  assert.equal(t.basis.deficit, -500);
});

test("daily targets — diabetes_risk shifts macros", () => {
  const baseline = calculateDailyTargets({
    weight_kg: 80,
    height_cm: 175,
    age: 40,
    sex: "male",
    activity: "moderate",
    goal: "maintain",
  });
  const withDiabetes = calculateDailyTargets({
    weight_kg: 80,
    height_cm: 175,
    age: 40,
    sex: "male",
    activity: "moderate",
    goal: "maintain",
    conditions: ["diabetes_risk"],
  });
  // diabetes_risk → fat 35% (vs 25%), carbs scale down
  assert.ok(
    withDiabetes.target_fat_g > baseline.target_fat_g,
    `diabetes fat ${withDiabetes.target_fat_g} should exceed baseline ${baseline.target_fat_g}`,
  );
  assert.ok(
    withDiabetes.target_carbs_g < baseline.target_carbs_g,
    "diabetes carbs should fall below baseline",
  );
});

test("daily targets — hypertension surfaces sodium guidance", () => {
  const t = calculateDailyTargets({
    weight_kg: 80,
    height_cm: 175,
    age: 40,
    sex: "male",
    activity: "moderate",
    goal: "maintain",
    conditions: ["hypertension"],
  });
  assert.ok(
    t.basis.notes.some((n) => n.includes("sodium")),
    "should record sodium guidance note for hypertension",
  );
});

test("daily targets — calorie floor at 1200", () => {
  const t = calculateDailyTargets({
    weight_kg: 45,
    height_cm: 150,
    age: 25,
    sex: "female",
    activity: "sedentary",
    goal: "cut_aggressive",
  });
  assert.ok(
    t.target_calories >= 1200,
    `calories ${t.target_calories} should not drop below 1200 floor`,
  );
});

test("daily targets — bulk_aggressive applies positive surplus", () => {
  const t = calculateDailyTargets({
    weight_kg: 70,
    height_cm: 175,
    age: 28,
    sex: "male",
    activity: "active",
    goal: "bulk_aggressive",
  });
  assert.equal(t.basis.deficit, 400);
  assert.ok(t.target_calories > t.tdee, "bulk should exceed TDEE");
});

test("daily targets — macro math sums to roughly the calorie target", () => {
  const t = calculateDailyTargets({
    weight_kg: 80,
    height_cm: 175,
    age: 30,
    sex: "male",
    activity: "moderate",
    goal: "maintain",
  });
  const macroKcal =
    t.target_protein_g * 4 + t.target_carbs_g * 4 + t.target_fat_g * 9;
  assert.ok(
    Math.abs(macroKcal - t.target_calories) <= 10,
    `macro kcal ${macroKcal} should be within 10 of target ${t.target_calories}`,
  );
});

test("daily targets — water uses 35ml/kg", () => {
  const t = calculateDailyTargets({
    weight_kg: 93,
    height_cm: 170.7,
    age: 34,
    sex: "male",
    activity: "moderate",
    goal: "cut_moderate",
  });
  // 93 * 35 = 3255ml → 3.3L
  assert.equal(t.target_water_l, 3.3);
});
