/**
 * Tool registry. The full set of 6 tools is always exposed; nothing here is
 * gated on external sources because the curated DB always answers first and
 * external fallbacks degrade gracefully when disabled.
 */

import type { Config } from "../config.js";
import { analyzeMealTool } from "./analyze-meal.js";
import { dailyTargetsTool } from "./daily-targets.js";
import { findAlternativesTool } from "./find-alternatives.js";
import { konbiniItemTool } from "./konbini-item.js";
import { restaurantMealTool } from "./restaurant-meal.js";
import { searchFoodTool } from "./search-food.js";
import type { ToolDefinition } from "./types.js";

export function getTools(_config: Config): ToolDefinition<any>[] {
  return [
    searchFoodTool,
    konbiniItemTool,
    restaurantMealTool,
    analyzeMealTool,
    findAlternativesTool,
    dailyTargetsTool,
  ];
}

/** Every tool. Used by tests. */
export const tools: ToolDefinition<any>[] = [
  searchFoodTool,
  konbiniItemTool,
  restaurantMealTool,
  analyzeMealTool,
  findAlternativesTool,
  dailyTargetsTool,
];

export type { ToolDefinition } from "./types.js";
