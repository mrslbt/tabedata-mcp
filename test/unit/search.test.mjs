import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, scoreMatch, search } from "../../src/search/fuzzy.ts";

const oyakodon = {
  id: "nakau-oyakodon",
  name_en: "Oyakodon (Chicken & Egg Rice Bowl)",
  name_jp: "親子丼",
  name_jp_kana: "オヤコドン",
  brand: "Nakau",
  category: "restaurant",
  chain: "nakau",
  serving: { size_label: "regular", size_label_jp: "並盛" },
  nutrition: {
    calories: 620,
    protein_g: 28.9,
    fat_g: 12.1,
    carbs_g: 94.9,
    sodium_mg: 1457,
  },
  tags: ["high_protein", "balanced_macros"],
  ingredients: ["chicken thigh", "egg", "rice"],
  source: { url: "x", type: "official_pdf", verified_at: "2026-05-09", verified_by: "@mrslbt" },
  confidence: "high",
  last_updated: "2026-05-09",
};

const saladChicken = {
  id: "7eleven-salad-chicken-herb",
  name_en: "Salad Chicken (Herb)",
  name_jp: "サラダチキン ハーブ",
  brand: "7-Eleven",
  category: "konbini",
  chain: "7-eleven",
  serving: { size_label: "1 pouch", size_label_jp: "1袋" },
  nutrition: { calories: 94, protein_g: 17.5, fat_g: 2, carbs_g: 0, sodium_mg: 700 },
  tags: ["high_protein", "low_carb", "low_fat"],
  ingredients: ["chicken breast", "herbs"],
  source: { url: "x", type: "official_label", verified_at: "2026-05-09", verified_by: "@mrslbt" },
  confidence: "high",
  last_updated: "2026-05-09",
};

const items = [oyakodon, saladChicken];

test("normalize: katakana to hiragana", () => {
  // サラダチキン → さらだちきん
  assert.equal(normalize("サラダチキン"), "さらだちきん");
});

test("normalize: full-width to half-width", () => {
  assert.equal(normalize("ＡＢＣ"), "abc");
});

test("normalize: lowercases and strips whitespace", () => {
  assert.equal(normalize("  Hello World  "), "helloworld");
});

test("scoreMatch: exact English match scores highest", () => {
  const m = scoreMatch("Salad Chicken (Herb)", saladChicken);
  assert.ok(m);
  assert.equal(m.score, 1000);
});

test("scoreMatch: Japanese kana query matches kanji item via kana field", () => {
  // "おやこどん" (hiragana) should match name_jp_kana "オヤコドン" via katakana→hiragana norm
  const m = scoreMatch("おやこどん", oyakodon);
  assert.ok(m, "expected hiragana query to match katakana variant");
  assert.ok(m.score >= 600);
});

test("scoreMatch: Japanese kanji query matches kanji name", () => {
  const m = scoreMatch("親子丼", oyakodon);
  assert.ok(m);
  assert.equal(m.score, 1000);
});

test("scoreMatch: English query matches Japanese item via name_en", () => {
  const m = scoreMatch("oyakodon", oyakodon);
  assert.ok(m);
  assert.ok(m.score >= 600);
});

test("scoreMatch: substring match scores below exact", () => {
  const m = scoreMatch("salad chicken", saladChicken);
  assert.ok(m);
  assert.ok(m.score >= 600 && m.score < 1000);
});

test("scoreMatch: tag fallback when no name match", () => {
  const m = scoreMatch("low_fat", saladChicken);
  assert.ok(m);
  assert.equal(m.score, 100);
  assert.ok(m.matched_on.startsWith("tag:"));
});

test("scoreMatch: ingredient fallback", () => {
  const m = scoreMatch("chicken breast", saladChicken);
  assert.ok(m);
  // 'chicken' alone won't match the name as a substring of "Salad Chicken (Herb)" only partially…
  // but "chicken breast" should hit the ingredient list at minimum.
  assert.ok(m.score >= 80);
});

test("scoreMatch: no match returns null", () => {
  const m = scoreMatch("xylophone", saladChicken);
  assert.equal(m, null);
});

test("search: returns ranked results", () => {
  const results = search("chicken", items);
  assert.ok(results.length >= 1);
  assert.equal(results[0].item.id, "7eleven-salad-chicken-herb");
});

test("search: respects category filter", () => {
  const results = search("chicken", items, { category: "restaurant" });
  // saladChicken is konbini; oyakodon mentions chicken thigh in ingredients
  assert.ok(results.every((r) => r.item.category === "restaurant"));
});

test("search: language=jp ignores English-only matches", () => {
  // "salad" is English-only; in jp mode it should not match name_en
  const results = search("salad", items, { language: "jp" });
  assert.equal(results.length, 0, "jp-only search should not return English-name matches");
});

test("search: max limits result count", () => {
  const results = search("a", items, { max: 1 });
  assert.ok(results.length <= 1);
});
