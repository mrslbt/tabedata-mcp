# Contributing

tabedata-mcp accepts contributions of new curated items.

## Submitting an item

Open a PR adding an entry to the appropriate JSON file under `src/data/`:

- Konbini items go to `src/data/konbini/{chain}.json`
- Restaurant chains go to `src/data/restaurants/{chain}.json`
- Branded products (Oikos, SAVAS, Meiji etc.) go to `src/data/brands.json`
- Generic Japanese foods go to `src/data/generic.json`

Every item must pass the three gates documented in [DATA_SOURCES.md](DATA_SOURCES.md).

## Required fields

```json
{
  "id": "kebab-case-unique-id",
  "name_en": "English search-friendly name",
  "name_jp": "商品名(パッケージに記載のもの)",
  "category": "konbini | restaurant | generic | supplement | drink",
  "serving": {
    "size_label": "1 pouch",
    "size_label_jp": "1袋",
    "size_g": 75
  },
  "nutrition": {
    "calories": 0,
    "protein_g": 0,
    "fat_g": 0,
    "carbs_g": 0,
    "sodium_mg": 0
  },
  "tags": [],
  "source": {
    "url": "https://...",
    "type": "official_label | official_pdf | mext | open_food_facts | usda | estimated",
    "verified_at": "YYYY-MM-DD",
    "verified_by": "@your-github-handle"
  },
  "confidence": "high | medium | low",
  "last_updated": "YYYY-MM-DD"
}
```

If the source provides only `salt_g` (the Japanese label convention), calculate `sodium_mg = round(salt_g * 393.4)` and include both fields.

## Pre-submission checks

```bash
npm run verify-data   # required fields, id uniqueness, URL liveness
npm run stats         # DB coverage by chain and category
npm run typecheck
npm run test:unit
npm test              # build + integration tests
```

## Commit style

[Conventional commits](https://www.conventionalcommits.org/):

- `feat: add 5 Lawson onigiri items`
- `fix: correct sodium calculation for sukiya gyudon`
- `docs: clarify gate 3 citation requirement`

## What we will not accept

- Fabricated values when no source can be found (return `[]` and document the gap instead).
- Items copied from third-party aggregators with no verifiable origin.
- Items missing `name_en` or `name_jp`.
- Source URLs that 404 at the time of submission.

## Credit

Contributors are listed in `CONTRIBUTORS.md` (created on first external PR). Each item retains its `source.verified_by` handle so individual contributions stay attributable forever.
