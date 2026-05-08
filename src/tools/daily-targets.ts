/**
 * daily_targets — personalized macro/water targets via Mifflin-St Jeor BMR
 * × activity multiplier × goal-driven deficit/surplus, with condition-aware
 * adjustments for diabetes risk and hypertension.
 */

import { z } from "zod";
import { calculateDailyTargets } from "../analyzer/targets.js";
import { jsonResult, type ToolDefinition } from "./types.js";

const input = z.object({
  weight_kg: z
    .number()
    .positive()
    .describe("Body weight in kilograms. 体重(kg)。"),
  height_cm: z
    .number()
    .positive()
    .describe("Height in centimeters. 身長(cm)。"),
  age: z.number().int().positive().describe("Age in years. 年齢。"),
  sex: z.enum(["male", "female"]).describe("Biological sex. 性別。"),
  activity: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .describe("Activity level. 活動レベル。"),
  goal: z
    .enum([
      "cut_aggressive",
      "cut_moderate",
      "maintain",
      "bulk_slow",
      "bulk_aggressive",
    ])
    .describe("Body composition goal. 目標。"),
  conditions: z
    .array(z.enum(["diabetes_risk", "hypertension"]))
    .optional()
    .describe(
      "Health conditions. Adjusts macro split (diabetes_risk shifts toward fat) and surfaces guidance notes (hypertension flags sodium ceiling). 持病。",
    ),
});

export const dailyTargetsTool: ToolDefinition<typeof input> = {
  name: "daily_targets",
  title: "Calculate Personalized Daily Targets",
  description: [
    "Calculate personalized daily calorie, protein, carb, fat, fiber, and water targets. Uses Mifflin-St Jeor for BMR, an activity multiplier for TDEE, and a goal-driven deficit/surplus. Diabetes risk shifts the macro split toward fat (35%) to lower carb load. Hypertension surfaces a sodium guidance note.",
    "",
    "個別の1日あたりカロリー・PFC・繊維・水分量を算出します。BMR は Mifflin-St Jeor、TDEE は活動係数、目標から赤字・黒字を決定。糖尿病リスクがある場合は脂質比率を高めて糖質負荷を抑えます。",
  ].join("\n"),
  inputSchema: input,
  async handler(args) {
    return jsonResult(calculateDailyTargets(args));
  },
};
