/**
 * analyze_meal — natural-language meal analyzer.
 *
 * Pipeline per item: parseQuantity → search → applySizeVariant → scale → sum.
 *
 * v0.1 quantity parser handles: numeric counts, weights in g, simple fractions
 * (half, 1/2, 3/4), and known restaurant size names (Nakau large, Sukiya 大盛).
 * Modification deltas land in v0.3.
 */

import { z } from "zod";
import { sumTotals } from "../analyzer/meal-totals.js";
import { resolveMealItem } from "../analyzer/resolver.js";
import { calculateDailyTargets } from "../analyzer/targets.js";
import { jsonResult, type ToolDefinition } from "./types.js";

const userProfileSchema = z
  .object({
    weight_kg: z.number().positive(),
    height_cm: z.number().positive(),
    age: z.number().int().positive(),
    sex: z.enum(["male", "female"]),
    activity: z.enum([
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ]),
    goal: z.enum([
      "cut_aggressive",
      "cut_moderate",
      "maintain",
      "bulk_slow",
      "bulk_aggressive",
    ]),
    conditions: z.array(z.enum(["diabetes_risk", "hypertension"])).optional(),
  })
  .describe(
    "Optional user profile. When present, totals are compared against personalized targets. ユーザー情報。",
  );

const input = z.object({
  items: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      "Free-form meal items (EN or JP). Examples: ['1 oikos plain', '200g rice', 'Nakau large oyakodon, 3/4 rice']. 食事項目。",
    ),
  user_profile: userProfileSchema.optional(),
});

export const analyzeMealTool: ToolDefinition<typeof input> = {
  name: "analyze_meal",
  title: "Analyze Meal",
  description: [
    "Parse a free-form list of meal items and return macro totals (calories, protein, fat, carbs, fiber, sodium). Recognizes counts ('2 eggs'), weights ('200g rice'), fractions ('half avocado', '3/4 portion'), and restaurant size names ('Nakau large oyakodon'). Optional user_profile compares totals against personalized targets.",
    "",
    "自然言語の食事リストを解析し、PFC・繊維・ナトリウムの合計を返します。「2個」「200g」「半分」「3/4」「Nakau 大盛」など多様な指定に対応。user_profile を渡すと個別目標との差分も返します。",
  ].join("\n"),
  inputSchema: input,
  async handler(args) {
    const resolved = args.items.map((q) => resolveMealItem(q));
    const totals = sumTotals(resolved);

    const unresolved = resolved.filter((r) => r.confidence === "unresolved");
    const notes: string[] = [];
    if (unresolved.length > 0) {
      notes.push(
        `${unresolved.length} item(s) could not be resolved against the curated DB: ${unresolved.map((r) => `'${r.query}'`).join(", ")}. tabedata-mcp is curated-only by design — contribute missing items via PR.`,
      );
    }
    if (resolved.some((r) => r.notes && r.notes.length > 0)) {
      notes.push("See per-item notes in items_resolved.");
    }

    const vs_targets = args.user_profile
      ? buildTargetComparison(totals, args.user_profile)
      : undefined;

    return jsonResult({
      items_resolved: resolved,
      totals,
      vs_targets,
      notes,
    });
  },
};

function buildTargetComparison(
  totals: ReturnType<typeof sumTotals>,
  profile: NonNullable<z.infer<typeof input>["user_profile"]>,
) {
  const t = calculateDailyTargets(profile);
  return {
    target_calories: t.target_calories,
    target_protein_g: t.target_protein_g,
    calorie_delta: round1(totals.calories - t.target_calories),
    protein_delta: round1(totals.protein_g - t.target_protein_g),
    deficit_or_surplus: round1(t.target_calories - totals.calories),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
