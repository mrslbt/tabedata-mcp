#!/usr/bin/env node
/**
 * Live demo of the MCP server. Run after `npm run build`.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, TABEDATA_DISABLE_EXTERNAL: "true" },
});
const client = new Client({ name: "demo", version: "1" }, { capabilities: {} });
await client.connect(transport);

const userProfile = {
  weight_kg: 93,
  height_cm: 170.7,
  age: 34,
  sex: "male",
  activity: "moderate",
  goal: "cut_moderate",
};

console.log("\n────────────────────────────────────────");
console.log(" Scenario 1: Konbini lunch macros");
console.log("────────────────────────────────────────");
const lunch = await client.callTool({
  name: "analyze_meal",
  arguments: {
    items: ["2 7-Eleven salad chicken plain", "1 oikos plain"],
    user_profile: userProfile,
  },
});
console.log(lunch.content[0].text);

console.log("\n────────────────────────────────────────");
console.log(" Scenario 2: Nakau oyakodon (large) macros");
console.log("────────────────────────────────────────");
const dinner = await client.callTool({
  name: "analyze_meal",
  arguments: {
    items: ["Nakau large oyakodon"],
    user_profile: userProfile,
  },
});
console.log(dinner.content[0].text);

console.log("\n────────────────────────────────────────");
console.log(" Scenario 3: Lower-calorie swap for tuna mayo onigiri");
console.log("────────────────────────────────────────");
const swap = await client.callTool({
  name: "find_alternatives",
  arguments: {
    current_food: "tuna mayo onigiri",
    optimize_for: "lower_calorie",
    constraint: "same_chain",
    max_results: 3,
  },
});
console.log(swap.content[0].text);

await client.close();
