# Build Log

A record of how tabedata-mcp went from empty directory to v1.0.0 in a single session, and why each integrity decision was made the way it was. Kept in the repo so future contributors can see what passed which gate.

## Session goal

Ship the most accurate, AI-native Japanese food nutrition database with first-class English access. Pure-curated, every item cited, no third-party aggregation in the runtime.

## Phase 1: Scaffold

Mirrored the modular layout from [paypay-mcp](https://github.com/mrslbt/paypay-mcp) so HTTP transport, stdio transport, and the tool registry can all share the same `buildServer(config)` shape:

```
src/
  index.ts          transport dispatch
  config.ts         env parsing
  server.ts         McpServer + zod-validated tool registry
  logger.ts         stderr-only (stdout reserved for MCP framing)
  types.ts          FoodItem, NutritionInfo, UserProfile
  tools/            6 tool files + registry
  transports/       stdio + Streamable HTTP
  data/             JSON files imported with `with { type: "json" }`
  search/           bilingual fuzzy matcher
  analyzer/         parse-quantity, meal-totals, daily-targets, resolver
test/
  unit/*.test.mjs   49 unit tests
  integration.test.mjs   end-to-end MCP client
scripts/
  verify-data.ts    CI gate
  stats.ts          coverage progress
```

Build with `tsup`, target Node 18+, ESM only. JSON data is inlined into the bundle by esbuild, so the package ships frozen per version with zero runtime file IO.

## Phase 2: Tool implementations

| Tool | Logic |
|---|---|
| `daily_targets` | Mifflin-St Jeor BMR x activity multiplier x goal-driven deficit/surplus. Diabetes risk shifts the macro split toward fat. Hypertension surfaces a sodium guidance note. |
| `analyze_meal` | Parses free-form items via `parse-quantity.ts` (counts, weights in g/ml, fractions, restaurant size names), resolves each via fuzzy search, applies size variants, scales nutrition by quantity, sums totals. |
| `find_alternatives` | Filters the curated set by chain or category constraint, sorts by the chosen optimization axis, returns top N with delta and tradeoff annotations. |
| `search_food` | Delegates to `src/search/fuzzy.ts`. Bilingual normalizer (kana to hiragana, full-width to half-width). Density-weighted substring scoring with a first-word-match bonus and chain-mention bias. |
| `konbini_item` | Chain-scoped wrapper around fuzzy search. |
| `restaurant_meal` | Chain-scoped fuzzy search plus size variant resolution from `size_variants[]`. |

Schema invariants: every food item has `name_en` and `name_jp`. Every restaurant item with sized portions declares absolute overrides per size in `size_variants[]`. Salt-to-sodium converted at `1g salt = 393.4mg sodium` (Japan label convention) and both fields stored.

## Phase 3: Curation

Items added in three waves of parallel agent research, each agent handed:
- The exact `FoodItem` interface
- A working example item (Nakau oyakodon)
- Strict integrity rules (no fabrication, return `[]` if unreachable)
- Chain-specific URL hints

All items returned through the same merge script (Node `JSON.parse + concat`) so the canonical files in `src/data/` stay the single source of truth.

### Wave 1: Restaurant chains with public PDFs

Eight parallel agents covering Saizeriya, MOS Burger, Subway Japan, Matsuya, Tenya, Marugame, Yoshinoya, Sukiya, CoCo Ichi. Result: 149 items across 8 chains. **Saizeriya correctly returned `[]`** because their public disclosure stops at calories and salt (no protein, fat, or carbs), and the integrity rule forbids fabrication.

### Wave 2: Konbini SKU deep dive plus expansions

Six parallel agents: 7-Eleven, Lawson, FamilyMart, Ministop, Nakau expansion, restaurant residuals (Pepper Lunch, Ootoya, Yayoiken, Ichiran, Nakau full PDF), plus MEXT generic foods and brand items.

Result: 212 items across konbini SKUs, MEXT, brand products, and remaining restaurants. Pepper Lunch correctly skipped (no public nutrition).

### Wave 3: Western and global chains

Four parallel agents: McDonald's Japan, KFC Japan, Starbucks Japan, plus a combined Lotteria + Freshness Burger + Doutor agent. Result: 75 items. **Starbucks Japan correctly returned `[]`** because their public site publishes only calories, not full macros.

## Integrity gates that held during research

Three chains were excluded for failing Gate 1 (source verification):

- **Saizeriya**: only kcal + salt published, no full macros.
- **Starbucks Japan**: only calories on the public allergen page.
- **Pepper Lunch**: no public nutrition.

Returning fabricated numbers for these would have inflated the item count at the cost of integrity. The agents held the line.

The Nakau dataset surfaced a real-world correction: the original brief claimed `親子丼 大盛 = 834 kcal / 33.1g protein`, but the official Nakau PDF (rev 2022-04-21) gives `738 / 30.6`. Caught at curation time and reverified before any Nakau item shipped.

## Phase 4: Search ranking

The naive density-weighted substring scoring picked the wrong winners once the dataset grew past ~200 items. Three failure modes:

| Query | Wrong winner | Why |
|---|---|---|
| `oyakodon` (within Nakau) | `cheese-oyakodon` | Long descriptive parens dilute density on the canonical entry. |
| `200g rice` | `matsuya-rice` (no `size_g` declared) | Density was higher than `rice-white-cooked`. |
| `2 boiled eggs` | `subway-jp-egg-rg` (Subway Egg sandwich) | Query "boiled eggs" includes the field "egg", which scored as a strong match incorrectly. |

Fixes:

1. Substring scoring is now asymmetric. When the query is contained in the field, density-weighted bonus applies (this is the typical case). When the field is contained in the query (rare, signals a short field name accidentally inside a longer query), score weakly with the inverse coverage ratio.
2. Prefix matches are coverage-gated. A field that starts with the query gets 950 / 850 / 700 depending on what fraction of the field the query covers.
3. First-word match bonus: when the field's first token equals the query's first token, add 150 (capped at 999 to keep exact match at 1000).
4. When the query mentions no chain or brand, generic items get +100 and chain-specific items get -250. This means `200g rice` resolves to generic white rice rather than a chain's rice-side item.

All 49 unit tests and the full integration suite pass under the new scoring.

## Phase 5: Verification

`npm run verify-data` HEAD-checks every `source.url`. Three variants of "page exists, blocking HEAD" are accepted: 403 (bot-blocked), 405 (HEAD not allowed), 429 (rate-limited). Anything else fails the build.

Final v1.0.0 sweep:

```
typecheck            clean
build                380 KB ESM bundle (data inlined)
unit tests           49 / 49
integration tests    all pass
verify-data          460 / 460, 0 errors, 0 warnings
```

## Final stats

- 460 items
- 21 chains (4 konbini, 17 restaurant)
- Confidence: 402 high, 58 medium
- Source type: 213 official_label, 160 official_pdf, 45 estimated, 42 mext

## What changed mid-build (and why)

Two scope decisions worth recording:

**Purine and gout-risk feature removed.** Initial design carried `purine_mg` on every item, with a `gout` health condition affecting `daily_targets` (purine ceiling, water bump, deficit softening) and a `gout_risk` field on `analyze_meal`. The estimates were defensible but secondary: Japanese food labels do not publish purine. Every value was estimated from per-100g reference tables. For a public MCP, that is a layer of speculation users should opt into separately, not have baked into the core. Stripped from schema, analyzer, tools, data, and docs.

**External fallback removed.** The plan was to fall back to Open Food Facts, USDA, and MEXT at runtime when the curated set missed. After looking at OFF data quality for Japanese products (poor) and USDA values for Japanese restaurant items (wrong), the cleaner story is curated-only with MEXT items merged directly into the seed set. Aggregation muddies trust. The most respected nutrition databases (USDA FoodData Central, MEXT itself, NEVO Netherlands) are pure-curated for the same reason.

## What is not in v1.0.0

- Burger King Japan (chain enum reserved, no items yet).
- Saizeriya, Starbucks Japan, Pepper Lunch, Kichiri-Misshoku (held back per Gate 1).
- HTTP transport is wired in code but untested live. The first user-served HTTP request will be the first end-to-end run.

These are the honest gaps. Contributions welcome via [CONTRIBUTING.md](CONTRIBUTING.md).
