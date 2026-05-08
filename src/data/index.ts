/**
 * Curated data registry. JSON files are imported statically so esbuild
 * inlines them into the bundle — zero runtime file IO, zero deployment hassle.
 *
 * Adding a new data file: import it here and push it into `allItems`.
 * The verify-data and stats scripts walk this single source of truth.
 */

import type { FoodItem } from "../types.js";

import sevenEleven from "./konbini/7eleven.json" with { type: "json" };
import lawson from "./konbini/lawson.json" with { type: "json" };
import familymart from "./konbini/familymart.json" with { type: "json" };
import ministop from "./konbini/ministop.json" with { type: "json" };

import nakau from "./restaurants/nakau.json" with { type: "json" };
import sukiya from "./restaurants/sukiya.json" with { type: "json" };
import yoshinoya from "./restaurants/yoshinoya.json" with { type: "json" };
import matsuya from "./restaurants/matsuya.json" with { type: "json" };
import cocoichi from "./restaurants/cocoichi.json" with { type: "json" };
import mosburger from "./restaurants/mosburger.json" with { type: "json" };
import subwayJp from "./restaurants/subway-jp.json" with { type: "json" };
import tenya from "./restaurants/tenya.json" with { type: "json" };
import marugame from "./restaurants/marugame.json" with { type: "json" };
import ootoya from "./restaurants/ootoya.json" with { type: "json" };
import yayoiken from "./restaurants/yayoiken.json" with { type: "json" };
import ichiran from "./restaurants/ichiran.json" with { type: "json" };
import mcdonaldsJp from "./restaurants/mcdonalds-jp.json" with { type: "json" };
import kfcJp from "./restaurants/kfc-jp.json" with { type: "json" };
import lotteria from "./restaurants/lotteria.json" with { type: "json" };
import freshnessBurger from "./restaurants/freshness-burger.json" with { type: "json" };
import dotour from "./restaurants/dotour.json" with { type: "json" };

import brands from "./brands.json" with { type: "json" };
import generic from "./generic.json" with { type: "json" };

export const allItems: FoodItem[] = [
  ...(sevenEleven as FoodItem[]),
  ...(lawson as FoodItem[]),
  ...(familymart as FoodItem[]),
  ...(ministop as FoodItem[]),
  ...(nakau as FoodItem[]),
  ...(sukiya as FoodItem[]),
  ...(yoshinoya as FoodItem[]),
  ...(matsuya as FoodItem[]),
  ...(cocoichi as FoodItem[]),
  ...(mosburger as FoodItem[]),
  ...(subwayJp as FoodItem[]),
  ...(tenya as FoodItem[]),
  ...(marugame as FoodItem[]),
  ...(ootoya as FoodItem[]),
  ...(yayoiken as FoodItem[]),
  ...(ichiran as FoodItem[]),
  ...(mcdonaldsJp as FoodItem[]),
  ...(kfcJp as FoodItem[]),
  ...(lotteria as FoodItem[]),
  ...(freshnessBurger as FoodItem[]),
  ...(dotour as FoodItem[]),
  ...(brands as FoodItem[]),
  ...(generic as FoodItem[]),
];

export const itemsByChain = new Map<string, FoodItem[]>();
for (const item of allItems) {
  if (item.chain) {
    const list = itemsByChain.get(item.chain) ?? [];
    list.push(item);
    itemsByChain.set(item.chain, list);
  }
}

export const itemsById = new Map<string, FoodItem>(
  allItems.map((item) => [item.id, item]),
);
