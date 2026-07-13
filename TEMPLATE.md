# Astro Site-Template — engine for all 11 sites

Built 2026-07-13. Proven on ClearCove (engine/sites/07-clearcove): builds clean, all invariants verified.

## What it does
- **Stealth by default:** `site.config.json → stealth: true` renders the coming-soon index and puts `noindex,nofollow` on EVERY page. robots.txt = Allow (on purpose — see comment in file). Sitemap withheld (no integration until un-stealth; add @astrojs/sitemap then). Flip `stealth: false` → full landing renders, robots become `index, follow`.
- **Markdown-native articles:** content collection at `src/content/articles/*.md`. Front-matter contract: `title, description, publishDate` (+ optional `updatedDate, author, keyword, draft`).
- **Article layout:** breadcrumb, byline + visible updated date, Article + FAQPage JSON-LD `@graph` (FAQ auto-extracted from `## FAQ` + `### question` blocks), in-article tool/guide CTA, related-articles grid.
- **BRAND link rewrite** (remark plugin, no deps): `BRAND/calculator|tool|quiz → /#tool`, `BRAND/guide|guides → /guides/`, `BRAND/<slug> → /<slug>/`. The pilot's soft-404 lesson is structural now.
- **Two tool archetypes**, config-driven, mounted via `<Tool/>` per `toolArchetype`:
  - **Calculator** (`Calculator.astro`): fields/outputs/statuses in `src/config/tool.json`; math in `src/tools/compute.js` (per-site). ClearCove's dosing math ported verbatim and verified (38.4 fl oz on design defaults).
  - **Quiz** (`Quiz.astro`): question banks + categories in `tool.json`; modes `quiz` / `flashcard` / `both` (Liberty Lane = both). 10-question rounds, explanations, score summary.
  - Components ship neutral CSS; each site skins them in its Landing (see ClearCove's glass skin).
- **404** on-brand from theme tokens. **/guides/** index auto-lists articles.
- **/api/subscribe** CF Pages Function → D1 `subscribers` (binding `DB`), same contract as pilot.
- **CF Web Analytics** beacon auto-injected when `cfBeaconToken` set.

## Per-site instantiation (the only files that change)
1. `site.config.json` — SITE/BRAND/niche/stealth/toolArchetype/theme/mailerlite/lemonsqueezy/beacon.
2. `src/components/Landing.astro` — the flattened design (own CSS + tool skin).
3. `src/config/tool.json` + `src/tools/compute.js` (calculators only).
4. Articles into `src/content/articles/`.

## Build
`npm install && npm run build` → `dist/`. CF Pages: build command `npm run build`, output `dist`, D1 binding `DB` → panel-queue.
Sandbox note: npm install needs a primed cache (first call may time out at 45s; re-run — it's resumable).

## DRIP PUBLISHER — ASTRO CONTRACT: **IMPLEMENTED + DEPLOYED 2026-07-13**
The lupela-panel worker now publishes every article as `src/content/articles/<slug>.md`
(slug from `repo_path` basename, else keyword), prepending front-matter at publish time
(`title`, `description`, `keyword`, `publishDate` — quotes escaped; skipped if the body
already starts with `---`). `{{BRAND}}` resolution unchanged. Deployed to the live worker
via CF API multipart PUT (secrets + D1 binding kept, verified) and committed to
rsteitiyeh/lupela-panel `src/index.js`. Old-format 