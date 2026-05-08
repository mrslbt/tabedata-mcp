/**
 * Bilingual fuzzy matcher. Lightweight by design — runs in-process over the
 * curated set (~300 items at v1.0), so we don't need a search index.
 *
 * Scoring (higher = better):
 *   - Exact normalized match on any name field   → 1000
 *   - Substring on any name field                → 600 + length bonus
 *   - All query tokens hit any name field        → 300 + token-count bonus
 *   - Substring on tag or ingredient             → 100
 *   - Else                                       → 0 (filtered out)
 *
 * Normalization (apply to BOTH query and target before comparing):
 *   - lowercase
 *   - katakana → hiragana
 *   - full-width ASCII → half-width
 *   - strip whitespace and punctuation
 *
 * Bilingual rule: a query in either language matches across all language
 * fields (name_en, name_jp, name_jp_kana). The caller can restrict via the
 * `language` parameter.
 */

import type { FoodItem } from "../types.js";

export type LanguageFilter = "en" | "jp" | "both";

export interface ScoredMatch {
  item: FoodItem;
  score: number;
  matched_on: string;
}

/** Normalize text for substring comparison — strips whitespace. */
export function normalize(s: string): string {
  if (!s) return "";
  let out = s.toLowerCase();
  out = out.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
  out = out.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  out = out.replace(/[\s\-_,.()\[\]\/'"]+/g, "");
  return out;
}

/**
 * Normalize while preserving word boundaries — required for tokenization.
 * Without this, "boiled eggs" collapses to a single token and never matches
 * the multi-word field "Boiled Egg (Medium)".
 */
export function normalizeForTokens(s: string): string {
  if (!s) return "";
  let out = s.toLowerCase();
  out = out.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
  out = out.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  out = out.replace(/[,.()\[\]\/'"_\-]+/g, " ");
  return out;
}

function nameFields(item: FoodItem, lang: LanguageFilter): string[] {
  const fields: string[] = [];
  if (lang === "en" || lang === "both") fields.push(item.name_en);
  if (lang === "jp" || lang === "both") {
    fields.push(item.name_jp);
    if (item.name_jp_kana) fields.push(item.name_jp_kana);
  }
  if (item.brand) fields.push(item.brand);
  return fields.filter(Boolean);
}

function tokenize(s: string): string[] {
  // ASCII tokens by whitespace; CJK runs as a single token.
  const ascii = s.match(/[a-z0-9]+/g) ?? [];
  const cjk = s.match(/[぀-ヿ一-鿿]+/g) ?? [];
  return [...ascii, ...cjk].filter((t) => t.length > 0);
}

export function scoreMatch(
  query: string,
  item: FoodItem,
  lang: LanguageFilter = "both",
): ScoredMatch | null {
  const normQuery = normalize(query);
  if (!normQuery) return null;

  const queryTokens = tokenize(normalizeForTokens(query));
  const fields = nameFields(item, lang);

  let best: { score: number; matched_on: string } = { score: 0, matched_on: "" };

  for (const field of fields) {
    const normField = normalize(field);
    if (!normField) continue;

    if (normField === normQuery) {
      best = { score: 1000, matched_on: field };
      break;
    }

    // Prefix match: field starts with query. Coverage gates the score —
    // "Rice (Plain)" for query "rice" (high coverage) is a stronger match
    // than "Oyakodon (Chicken & Egg Rice Bowl)" for query "oyakodon"
    // (low coverage; the descriptive parens dilute the match).
    if (normField.startsWith(normQuery)) {
      const coverage = normQuery.length / normField.length;
      let score: number;
      if (coverage >= 0.7) score = 950;
      else if (coverage >= 0.4) score = 850;
      else score = 700;
      if (score > best.score) best = { score, matched_on: field };
    } else if (normField.includes(normQuery)) {
      // Substring (mid-field) match. Density-weighted.
      const density = normQuery.length / normField.length;
      const score = 600 + Math.round(density * 300);
      if (score > best.score) best = { score, matched_on: field };
    } else if (normQuery.includes(normField)) {
      // Field is contained in query. Weak signal — short field name happens
      // to be a substring of a longer query. Don't reward as if the field
      // were a strong match.
      const coverage = normField.length / normQuery.length;
      const score = 400 + Math.round(coverage * 100);
      if (score > best.score) best = { score, matched_on: field };
    }

    if (best.score < 600 && queryTokens.length > 0) {
      const fieldTokens = tokenize(normalizeForTokens(field));
      let hits = 0;
      for (const qt of queryTokens) {
        if (fieldTokens.some((ft) => ft.includes(qt) || qt.includes(ft))) hits++;
      }
      if (hits === queryTokens.length) {
        const score = 300 + hits * 20;
        if (score > best.score) best = { score, matched_on: field };
      }
    }

    // First-word bonus: when the field's first token equals the query's
    // first token, that signals the query IS the primary noun of the field
    // ("Oyakodon" wins over "Cheese Oyakodon" for query "oyakodon"). Only
    // applies when this field already produced any match.
    if (best.matched_on === field && best.score > 0) {
      const fieldTokens = tokenize(normalizeForTokens(field));
      const firstFieldToken = fieldTokens[0];
      const firstQueryToken = queryTokens[0];
      if (
        firstFieldToken &&
        firstQueryToken &&
        firstFieldToken === firstQueryToken
      ) {
        // Cap below 1000 so a true exact match always wins.
        best = { ...best, score: Math.min(best.score + 150, 999) };
      }
    }
  }

  // Tag / ingredient fallback.
  if (best.score < 100) {
    for (const tag of item.tags ?? []) {
      if (normalize(tag).includes(normQuery)) {
        best = { score: 100, matched_on: `tag:${tag}` };
        break;
      }
    }
  }
  if (best.score < 100) {
    for (const ing of item.ingredients ?? []) {
      if (normalize(ing).includes(normQuery)) {
        best = { score: 80, matched_on: `ingredient:${ing}` };
        break;
      }
    }
  }

  if (best.score === 0) return null;
  return { item, ...best };
}

export function search(
  query: string,
  items: readonly FoodItem[],
  options: {
    language?: LanguageFilter;
    max?: number;
    category?: FoodItem["category"];
  } = {},
): ScoredMatch[] {
  const lang = options.language ?? "both";
  const max = options.max ?? 10;
  const filtered = options.category
    ? items.filter((i) => i.category === options.category)
    : items;

  const queryMentionsBrand = mentionsBrand(query, items);

  const scored: ScoredMatch[] = [];
  for (const item of filtered) {
    const m = scoreMatch(query, item, lang);
    if (!m) continue;
    // Bias: when the query doesn't mention any brand/chain, prefer generic
    // (chain-less) items strongly. "200g rice" should map to generic white
    // rice, not Matsuya's restaurant rice. The bias is large enough to
    // overcome a chain item's tighter prefix match when the query is bare.
    if (!queryMentionsBrand) {
      if (!m.item.chain && !m.item.brand) {
        m.score += 100; // generic boost
      } else if (m.item.chain) {
        m.score -= 250; // de-prioritize chain-specific items for generic queries
      }
    }
    scored.push(m);
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max);
}

function mentionsBrand(query: string, items: readonly FoodItem[]): boolean {
  const normQuery = normalize(query);
  const seen = new Set<string>();
  for (const item of items) {
    if (item.brand) seen.add(normalize(item.brand));
    if (item.chain) seen.add(normalize(item.chain));
  }
  for (const token of seen) {
    if (token && normQuery.includes(token)) return true;
  }
  return false;
}
