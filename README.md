# tabedata-mcp

[![npm version](https://img.shields.io/npm/v/@mrslbt/tabedata-mcp.svg)](https://www.npmjs.com/package/@mrslbt/tabedata-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Model Context Protocol server for Japanese food nutrition data. Bilingual (JP/EN) tools covering konbini items, restaurant chain meals, generic Japanese foods, and personalized macro targets. Built for AI assistants and Tokyo expats.

460 curated items across 21 chains, all with cited official sources.

## Install

```bash
npm install -g @mrslbt/tabedata-mcp
```

Or run on demand with `npx -y @mrslbt/tabedata-mcp`.

## Configuration

No API keys needed. Curated database ships with the package.

| Variable | Required | Description |
|---|---|---|
| `MCP_TRANSPORT` | no | `stdio` (default) or `http`. |
| `MCP_AUTH_TOKEN` | http only | Bearer token. HTTP transport refuses to start without it. |
| `MCP_HTTP_PORT` | no | Default `8787`. |
| `MCP_HTTP_HOST` | no | Default `127.0.0.1`. |
| `MCP_HTTP_ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist for HTTP transport. |

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tabedata": {
      "command": "npx",
      "args": ["-y", "@mrslbt/tabedata-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add tabedata -- npx -y @mrslbt/tabedata-mcp
```

### Cursor / Windsurf

Add to `~/.cursor/mcp.json` with the same shape as Claude Desktop.

## Tools

| Tool | Description |
|---|---|
| `search_food` | Bilingual fuzzy search across the curated DB. Accepts JP or EN queries (e.g. `salad chicken` or `サラダチキン`). |
| `konbini_item` | Chain-scoped lookup for 7-Eleven, Lawson, FamilyMart, Ministop. |
| `restaurant_meal` | Chain meal lookup with size variants (並 / 大盛 / 特盛). |
| `analyze_meal` | Natural-language meal analyzer. Recognizes counts, weights (`200g rice`), fractions (`half avocado`), and restaurant size names (`Nakau large oyakodon`). Returns macro totals plus optional comparison to personalized targets. |
| `find_alternatives` | Swap an item for a better one along a chosen axis (higher protein, lower calorie, lower sodium). Returns each alternative with its improvement and tradeoff. |
| `daily_targets` | Mifflin-St Jeor BMR x activity multiplier x goal-driven deficit/surplus. Diabetes risk shifts the macro split. Hypertension surfaces a sodium guidance note. |

## Coverage

### Konbini (122 items)
| Chain | Items |
|---|---|
| 7-Eleven | 46 |
| Lawson | 34 |
| FamilyMart | 29 |
| Ministop | 13 |

### Restaurant chains (272 items)
Japanese chains: Nakau, Sukiya, Yoshinoya, Matsuya, CoCo Ichibanya, Marugame Seimen, Tenya, MOS Burger, Yayoiken, Ootoya, Ichiran.

Western and global chains: McDonald's Japan, KFC Japan, Subway Japan, Lotteria, Freshness Burger, Doutor.

### Generic and brand items (66 items)
- 42 generic Japanese foods sourced from Japan MEXT *Standard Tables of Food Composition*.
- 24 brand products: Oikos, SAVAS Milk Protein line, Meiji R-1 / Bulgaria / LG21 / TANPACT, Glico, Calbee, Ito En, Asahi, Kirin, Suntory, Fuji Pan, Snow Brand, Morinaga inZeri.

## Example queries

```
What are the macros of a Nakau large oyakodon?
なか卯の親子丼大盛のカロリーと糖質を教えて

Analyze my lunch: 1 oikos plain, 2 boiled eggs, 200g rice
私のランチを分析して: オイコスプレーン1個、ゆで卵2個、白米200g

Find a higher-protein swap for a tuna mayo onigiri at 7-Eleven
セブンイレブンのツナマヨおにぎりよりたんぱく質が高い代替品を探して

Calculate my daily targets: 80kg, 175cm, 30, male, moderate activity, cut moderate
```

## Data integrity

Every item passes three gates before merge:

1. **Source verification.** Each entry cites an official manufacturer or restaurant nutrition label, an official PDF, or an entry from the Japan MEXT *Standard Tables of Food Composition*. Estimated values are marked with `confidence: "medium"` or `"low"` and document the estimation method.
2. **Bilingual completeness.** `name_en` and `name_jp` are mandatory.
3. **Source citation.** Every item includes `source.url`, `source.type`, and an ISO `verified_at` date.

CI runs `npm run verify-data` to check required fields, id uniqueness, and URL liveness on every item. Items older than 365 days are flagged stale.

See [DATA_SOURCES.md](DATA_SOURCES.md) for the full methodology.

## Disclaimer

This is an unofficial, community-built MCP server. Not affiliated with, endorsed by, or sponsored by any of the listed restaurants, konbini chains, or product manufacturers. Their names and trademarks belong to their respective owners. Nutrition values are transcribed from publicly published sources (which can change), so treat them as a reference rather than a guarantee. The author accepts no liability for decisions made on the basis of this data.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests for new items welcome, provided each item passes the three integrity gates above.

## License

[MIT](LICENSE)
