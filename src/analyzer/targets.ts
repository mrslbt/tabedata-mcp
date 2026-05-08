/**
 * Personalized daily target calculation.
 *
 * Mifflin-St Jeor BMR (more accurate than Harris-Benedict for modern body
 * compositions) × activity multiplier (TDEE) ± goal-driven deficit/surplus.
 *
 * Condition-aware adjustments:
 *   - diabetes_risk: shift macro split toward fat (35%) to lower carb load.
 *   - hypertension: surfaces a sodium guidance note (sodium target itself
 *     is not in the schema).
 */

import type { DailyTargets, Goal, UserProfile } from "../types.js";

const ACTIVITY_MULTIPLIERS: Record<UserProfile["activity"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DEFICITS: Record<Goal, number> = {
  cut_aggressive: -750,
  cut_moderate: -500,
  maintain: 0,
  bulk_slow: 200,
  bulk_aggressive: 400,
};

const PROTEIN_PER_KG: Record<Goal, number> = {
  cut_aggressive: 2.2,
  cut_moderate: 2.0,
  maintain: 1.6,
  bulk_slow: 1.8,
  bulk_aggressive: 2.0,
};

const FIBER_G_PER_1000_KCAL = 14;
const WATER_ML_PER_KG = 35;

export function calculateBMR(p: UserProfile): number {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  return Math.round(p.sex === "male" ? base + 5 : base - 161);
}

export function calculateDailyTargets(p: UserProfile): DailyTargets {
  const bmr = calculateBMR(p);
  const multiplier = ACTIVITY_MULTIPLIERS[p.activity];
  const tdee = Math.round(bmr * multiplier);

  const conditions = new Set(p.conditions ?? []);
  const hasDiabetes = conditions.has("diabetes_risk");
  const hasHypertension = conditions.has("hypertension");

  const deficit = GOAL_DEFICITS[p.goal];
  const notes: string[] = [];

  const target_calories = Math.max(1200, Math.round(tdee + deficit));
  const target_protein_g = Math.round(p.weight_kg * PROTEIN_PER_KG[p.goal]);
  const protein_kcal = target_protein_g * 4;

  const fat_pct = hasDiabetes ? 0.35 : 0.25;
  const target_fat_g = Math.round((target_calories * fat_pct) / 9);
  const fat_kcal = target_fat_g * 9;

  const target_carbs_g = Math.max(
    0,
    Math.round((target_calories - protein_kcal - fat_kcal) / 4),
  );

  const target_fiber_g = Math.round(
    (target_calories / 1000) * FIBER_G_PER_1000_KCAL,
  );

  const target_water_l = Math.round((p.weight_kg * WATER_ML_PER_KG) / 100) / 10;

  if (hasDiabetes) {
    notes.push("Diabetes risk: fat ratio raised to 35% to lower carb load.");
  }
  if (hasHypertension) {
    notes.push(
      "Hypertension: keep sodium <2300mg/day. Use konbini_item / restaurant_meal results — Japanese restaurant bowls regularly exceed 1500mg/serving.",
    );
  }

  return {
    bmr,
    tdee,
    target_calories,
    target_protein_g,
    target_carbs_g,
    target_fat_g,
    target_fiber_g,
    target_water_l,
    basis: {
      formula: "Mifflin-St Jeor",
      multiplier,
      deficit,
      notes,
    },
  };
}
