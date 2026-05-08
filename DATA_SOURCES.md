# Data Sources and Verification Methodology

Every item in the curated database passes three gates before merge.

## Gate 1: Source verification

| `source.type` | Acceptance |
|---|---|
| `official_label` | Manufacturer or restaurant nutrition label transcribed from product packaging or product page. |
| `official_pdf` | Official chain nutrition PDF (e.g. Nakau, Matsuya, Tenya, MOS Burger, KFC). |
| `mext` | Japan MEXT *Standard Tables of Food Composition in Japan* (日本食品標準成分表). Public-domain, the authoritative source for generic Japanese ingredients. |
| `open_food_facts` | Accepted when the product has a high OFF data quality score. |
| `usda` | Generic non-Japanese foods only. |
| `estimated` | Marked `confidence: "low"` or `"medium"`. Estimation method is documented in `notes_en`. |
| `user_submitted` | Rejected without verification against one of the above. |

## Gate 2: Bilingual completeness

`name_en` and `name_jp` are both mandatory. Names match what a real user would search (e.g. "salad chicken" rather than "chicken salad pouch"). The Japanese name matches what is on the actual package or menu. `name_jp_kana` is optional and used only when the canonical search term is the kana-only variant.

## Gate 3: Source citation

`source.url` links to the page or PDF the data came from. `source.verified_at` is the ISO date of verification. `source.verified_by` records the curator. Items older than 365 days are flagged stale by `npm run verify-data`.

## Held back per integrity gates

A few well-known chains were excluded because their public disclosure does not meet Gate 1.

- **Saizeriya** publishes only calories and salt, not full macros (no protein, fat, or carbohydrates).
- **Starbucks Japan** publishes only calories on the public site.
- **Pepper Lunch** does not publish nutrition publicly.

Returning fabricated values for these would have violated Gate 1, so the database currently has zero items for these chains. Contributions with verified in-store label photos are welcome.

## Confidence ratings

| Confidence | Meaning |
|---|---|
| `high` | Values transcribed directly from a chain-published or manufacturer-published source. |
| `medium` | Best estimate from secondary aggregators citing chain data, or partial label transcription. |
| `low` | Estimated from analogous items or per-100g reference tables. Method documented in notes. |

## Legal note

Nutrition facts are not copyrightable in most jurisdictions. We transcribe facts (numbers, ingredient lists, standard category labels) and cite the source URL. We do not reproduce marketing copy or proprietary recipe details. This is the same legal posture used by Open Food Facts, FatSecret, and MyFitnessPal.

## CI

`npm run verify-data` checks every item's required fields, id uniqueness, and source URL liveness. The script accepts HTTP responses 200/2xx, 403, 405, and 429 as "page exists" (some Japanese corporate sites bot-block HEAD requests). Stale items emit warnings but do not fail the build.
