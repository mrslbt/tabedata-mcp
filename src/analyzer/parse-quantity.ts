/**
 * Parse free-form meal-item strings into a structured quantity + remaining
 * search query.
 *
 * v0.1 supported forms:
 *   - "2 eggs"               → { count: 2, unit: 'piece', query: 'eggs' }
 *   - "200g rice"            → { count: 200, unit: 'g', query: 'rice' }
 *   - "300ml milk"           → { count: 300, unit: 'ml', query: 'milk' }
 *   - "half avocado"         → { count: 0.5, unit: 'serving', query: 'avocado' }
 *   - "1/2 banana"           → { count: 0.5, unit: 'serving', query: 'banana' }
 *   - "3/4 portion oyakodon" → { count: 0.75, unit: 'serving', query: 'oyakodon' }
 *   - "Nakau large oyakodon" → { count: 1, unit: 'serving', size: 'large', query: 'Nakau oyakodon' }
 *   - "Sukiya 大盛 gyudon"   → { count: 1, unit: 'serving', size: 'large', query: 'Sukiya gyudon' }
 *
 * Falls back to count: 1, unit: 'serving' when no quantity is detected.
 *
 * v0.3 will add modifications ("no rice", "extra egg", "玉子追加"). The
 * modifications field is captured but not yet applied.
 */

import type { RestaurantSize } from "../types.js";

export interface ParsedQuantity {
  count: number;
  unit: "g" | "ml" | "piece" | "serving";
  size?: RestaurantSize;
  query: string;
  modifications: string[];
  /** True when the parser found explicit quantity tokens. */
  explicit: boolean;
}

const FRACTION_WORDS: Record<string, number> = {
  half: 0.5,
  quarter: 0.25,
  third: 1 / 3,
};

/**
 * Restaurant-size keywords. Order matters: extra-large must beat large.
 *
 * `\b` word boundaries don't fire on CJK characters, so JP tokens use bare
 * literal matching (they are unambiguous enough to not need boundaries).
 */
const SIZE_TOKENS: ReadonlyArray<readonly [RegExp, RestaurantSize]> = [
  [/特盛/, "extra-large"],
  [/\b(?:extra[\s-]?large|tokumori)\b/i, "extra-large"],
  [/大盛り?/, "large"],
  [/\b(?:large|oomori)\b/i, "large"],
  [/並盛?/, "regular"],
  [/\b(?:regular|namimori|nami)\b/i, "regular"],
  [/小盛り?/, "small"],
  [/\b(?:small|komori)\b/i, "small"],
  [/ミニ/, "mini"],
  [/\bmini\b/i, "mini"],
];

const MODIFICATION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bno\s+\w+\b/gi,
  /\bextra\s+\w+\b/gi,
  /[^\s]+追加/g,
  /[^\s]+抜き/g,
];

export function parseQuantity(raw: string): ParsedQuantity {
  let s = raw.trim();
  const modifications: string[] = [];

  // Strip modifications first so they don't pollute the quantity scan.
  for (const pattern of MODIFICATION_PATTERNS) {
    const matches = s.match(pattern);
    if (matches) {
      modifications.push(...matches.map((m) => m.trim()));
      s = s.replace(pattern, " ");
    }
  }

  let count = 1;
  let unit: ParsedQuantity["unit"] = "serving";
  let explicit = false;

  // 1. Weight (g/kg) and volume (ml/l). Match number then unit.
  const weightMatch = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i);
  if (weightMatch) {
    const value = Number.parseFloat(weightMatch[1]!);
    const u = weightMatch[2]!.toLowerCase();
    if (u === "kg") {
      count = value * 1000;
      unit = "g";
    } else if (u === "g") {
      count = value;
      unit = "g";
    } else if (u === "l") {
      count = value * 1000;
      unit = "ml";
    } else {
      count = value;
      unit = "ml";
    }
    s = s.replace(weightMatch[0]!, " ");
    explicit = true;
  } else {
    // 2. Fractional words.
    for (const [word, value] of Object.entries(FRACTION_WORDS)) {
      const re = new RegExp(`\\b${word}\\b`, "i");
      if (re.test(s)) {
        count = value;
        unit = "serving";
        s = s.replace(re, " ");
        explicit = true;
        break;
      }
    }

    if (!explicit) {
      // 3. Numeric fraction "3/4", "1/2" — but only when whitespace-bounded.
      const fractionMatch = s.match(/(?:^|\s)(\d+)\/(\d+)(?=\s|$)/);
      if (fractionMatch) {
        const numerator = Number.parseInt(fractionMatch[1]!, 10);
        const denominator = Number.parseInt(fractionMatch[2]!, 10);
        if (denominator > 0) {
          count = numerator / denominator;
          unit = "serving";
          s = s.replace(fractionMatch[0]!, " ");
          explicit = true;
        }
      }
    }

    if (!explicit) {
      // 4. Plain leading count "2 eggs", "3 onigiri".
      const countMatch = s.match(/^\s*(\d+(?:\.\d+)?)\b/);
      if (countMatch) {
        count = Number.parseFloat(countMatch[1]!);
        unit = "piece";
        s = s.replace(countMatch[0]!, " ");
        explicit = true;
      }
    }
  }

  // 5. Restaurant size tokens. Only meaningful when unit is serving/piece.
  let size: RestaurantSize | undefined;
  for (const [pattern, sizeName] of SIZE_TOKENS) {
    if (pattern.test(s)) {
      size = sizeName;
      s = s.replace(pattern, " ");
      break;
    }
  }

  // Normalize whitespace and connector words ("portion", "of", "serving").
  const query = s
    .replace(/\b(?:portion|portions|serving|servings|of)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/[,，]/g, " ")
    .trim();

  return { count, unit, size, query, modifications, explicit };
}
