/**
 * Core domain types for tabedata-mcp.
 *
 * Every curated food item conforms to FoodItem. Tools return strongly-typed
 * results so the registered handlers can serialize them to MCP text/JSON
 * content blocks consistently.
 *
 * Bilingual rule: every item that surfaces to a user-facing field carries a
 * Japanese variant. Single-language items are not allowed in the curated set.
 */

export type FoodCategory =
  | "konbini"
  | "restaurant"
  | "generic"
  | "supplement"
  | "drink";

export type KonbiniChain = "7-eleven" | "lawson" | "familymart" | "ministop";

export type RestaurantChain =
  | "nakau"
  | "sukiya"
  | "yoshinoya"
  | "matsuya"
  | "cocoichi"
  | "saizeriya"
  | "tenya"
  | "mosburger"
  | "subway-jp"
  | "yayoiken"
  | "ootoya"
  | "pepper-lunch"
  | "marugame"
  | "ichiran"
  | "kichiri-misshoku"
  | "mcdonalds-jp"
  | "kfc-jp"
  | "starbucks-jp"
  | "lotteria"
  | "burger-king-jp"
  | "freshness-burger"
  | "dotour";

export type Chain = KonbiniChain | RestaurantChain;

export type Subcategory =
  | "onigiri"
  | "salad-chicken"
  | "boiled-egg"
  | "noodle"
  | "drink"
  | "snack"
  | "bowl"
  | "curry"
  | "burger"
  | "sandwich"
  | "yogurt"
  | "protein-drink"
  | "rice"
  | "bread"
  | "soup"
  | "salad"
  | "side"
  | "dessert"
  | "any";

export type RestaurantSize =
  | "small"
  | "regular"
  | "large"
  | "extra-large"
  | "mini";

export type SourceType =
  | "official_label"
  | "official_pdf"
  | "user_submitted"
  | "estimated"
  | "open_food_facts"
  | "usda"
  | "mext";

export type Confidence = "high" | "medium" | "low";

export interface NutritionInfo {
  /** Per the declared serving (not per 100g unless serving is 100g). */
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg: number;
  cholesterol_mg?: number;
  /** Salt equivalent (食塩相当量) — common on JP labels; sodium_mg is canonical. */
  salt_g?: number;
}

export interface ServingInfo {
  size_label: string;
  size_label_jp: string;
  size_g?: number;
  size_ml?: number;
}

export interface SizeVariant {
  size: RestaurantSize;
  size_label_jp?: string;
  size_g?: number;
  /** Multiplier applied to base nutrition. */
  modifier: number;
  /** Optional absolute overrides — when present, take precedence over the modifier. */
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  sodium_mg?: number;
}

export interface SourceInfo {
  url: string;
  type: SourceType;
  /** ISO date (YYYY-MM-DD). */
  verified_at: string;
  verified_by: string;
}

export interface FoodItem {
  id: string;
  name_en: string;
  name_jp: string;
  /** Optional katakana-only or hiragana-only search variant when the item has one. */
  name_jp_kana?: string;
  brand?: string;
  category: FoodCategory;
  chain?: Chain;
  subcategory?: Subcategory;
  /** JAN/EAN code, when known — enables future barcode lookup. */
  barcode?: string;
  serving: ServingInfo;
  nutrition: NutritionInfo;
  size_variants?: SizeVariant[];
  ingredients?: string[];
  allergens?: string[];
  tags: string[];
  source: SourceInfo;
  confidence: Confidence;
  notes_en?: string;
  notes_jp?: string;
  /** ISO date (YYYY-MM-DD) — last touched by the curator. */
  last_updated: string;
}

// ─── User profile (for analyze_meal + daily_targets) ───────────────────────

export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal =
  | "cut_aggressive"
  | "cut_moderate"
  | "maintain"
  | "bulk_slow"
  | "bulk_aggressive";
export type HealthCondition = "diabetes_risk" | "hypertension";

export interface UserProfile {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: Goal;
  conditions?: HealthCondition[];
}

// ─── Analyzer result types ────────────────────────────────────────────────

export interface ResolvedItem {
  query: string;
  resolved: FoodItem | null;
  quantity: number;
  unit: "serving" | "g" | "ml" | "piece";
  confidence: "exact" | "fuzzy" | "fallback" | "unresolved";
  source: "curated" | "open_food_facts" | "usda" | "mext" | "none";
  scaled_nutrition?: NutritionInfo;
  notes?: string[];
}

export interface MealTotals {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  sodium_mg: number;
}

export interface DailyTargets {
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_fiber_g: number;
  target_water_l: number;
  basis: {
    formula: string;
    multiplier: number;
    deficit: number;
    notes: string[];
  };
}
