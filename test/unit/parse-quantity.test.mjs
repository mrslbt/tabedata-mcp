import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuantity } from "../../src/analyzer/parse-quantity.ts";

test("count + plural noun", () => {
  const p = parseQuantity("2 boiled eggs");
  assert.equal(p.count, 2);
  assert.equal(p.unit, "piece");
  assert.equal(p.query, "boiled eggs");
  assert.equal(p.explicit, true);
});

test("weight in grams", () => {
  const p = parseQuantity("200g rice");
  assert.equal(p.count, 200);
  assert.equal(p.unit, "g");
  assert.equal(p.query, "rice");
});

test("weight in kg converts to g", () => {
  const p = parseQuantity("0.5kg chicken breast");
  assert.equal(p.count, 500);
  assert.equal(p.unit, "g");
});

test("volume in ml", () => {
  const p = parseQuantity("350ml protein shake");
  assert.equal(p.count, 350);
  assert.equal(p.unit, "ml");
});

test("volume in liters converts to ml", () => {
  const p = parseQuantity("1.5l water");
  assert.equal(p.count, 1500);
  assert.equal(p.unit, "ml");
});

test("fraction word: half", () => {
  const p = parseQuantity("half avocado");
  assert.equal(p.count, 0.5);
  assert.equal(p.unit, "serving");
  assert.equal(p.query, "avocado");
});

test("fraction word: quarter", () => {
  const p = parseQuantity("quarter banana");
  assert.equal(p.count, 0.25);
});

test("numeric fraction 3/4", () => {
  const p = parseQuantity("3/4 portion oyakodon");
  assert.equal(p.count, 0.75);
  assert.equal(p.unit, "serving");
  assert.equal(p.query, "oyakodon");
});

test("numeric fraction 1/2 with banana", () => {
  const p = parseQuantity("1/2 banana");
  assert.equal(p.count, 0.5);
  assert.equal(p.query, "banana");
});

test("restaurant large size English", () => {
  const p = parseQuantity("Nakau large oyakodon");
  assert.equal(p.size, "large");
  assert.equal(p.query, "Nakau oyakodon");
});

test("restaurant size Japanese 大盛", () => {
  const p = parseQuantity("Sukiya 大盛 gyudon");
  assert.equal(p.size, "large");
  assert.match(p.query, /sukiya.*gyudon/i);
});

test("restaurant size 特盛 wins over 大盛", () => {
  const p = parseQuantity("特盛 oyakodon");
  assert.equal(p.size, "extra-large");
});

test("default falls back to 1 serving", () => {
  const p = parseQuantity("oikos plain");
  assert.equal(p.count, 1);
  assert.equal(p.unit, "serving");
  assert.equal(p.explicit, false);
  assert.equal(p.query, "oikos plain");
});

test("modification 'no rice' captured", () => {
  const p = parseQuantity("Nakau large oyakodon, no rice");
  assert.deepEqual(p.modifications, ["no rice"]);
  assert.equal(p.size, "large");
});

test("modification '玉子追加' (extra egg) captured", () => {
  const p = parseQuantity("親子丼 玉子追加");
  assert.deepEqual(p.modifications, ["玉子追加"]);
});

test("modification 'extra egg' captured", () => {
  const p = parseQuantity("oyakodon extra egg");
  assert.deepEqual(p.modifications, ["extra egg"]);
});

test("comma separation handled", () => {
  const p = parseQuantity("Nakau large oyakodon, 3/4 rice");
  assert.equal(p.size, "large");
  // 3/4 not adjacent to a unit, treated as a serving fraction
  assert.equal(p.count, 0.75);
});

test("Japanese fully-qualified: 200g 白米", () => {
  const p = parseQuantity("200g 白米");
  assert.equal(p.count, 200);
  assert.equal(p.unit, "g");
  assert.equal(p.query, "白米");
});

test("ingredient-only with no quantity", () => {
  const p = parseQuantity("salad chicken herb");
  assert.equal(p.count, 1);
  assert.equal(p.explicit, false);
  assert.equal(p.query, "salad chicken herb");
});
