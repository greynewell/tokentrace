# Claude Chef - Architecture & Development Notes

## What This Project Is

Claude Chef is two things in one repo:

1. **A static recipe site generator** that builds claudechef.com from markdown recipe files
2. **A Claude Code CLI plugin** (`/chef`) for creating, enriching, and submitting recipes

The site is fully static HTML with zero runtime dependencies — no React, no framework, no client-side JS libraries. All HTML, CSS, and inline JS is generated from `src/generator/template.ts`.

## Quick Commands

```bash
npm run build      # Compile TypeScript (must run before test or generate)
npm test           # 459 tests across 22 suites, ~3s
npm run generate   # Build static site into docs/
```

For affiliate links in generated output, set env vars:
```bash
AMAZON_AFFILIATE_TAG=tag-20 WALMART_AFFILIATE_ID=id123 npm run generate
```

## Project Layout

```
src/
  types.ts              # All shared interfaces (ParsedRecipe, Taxonomy, etc.)
  cli/                  # CLI commands: create, submit (lint), enrich
  generator/
    index.ts            # Build orchestrator — buildSite() is the entry point
    template.ts         # THE BIG FILE (~2400 lines) — all HTML/CSS/JS generation
    parser.ts           # Markdown + YAML frontmatter parsing (uses gray-matter)
    taxonomy.ts         # Builds 9 taxonomy types from recipe metadata
    structured-data.ts  # JSON-LD schema.org structured data
    rss.ts              # RSS 2.0 feeds (main + per-category)
    llms-txt.ts         # llms.txt generation (llmstxt.org standard)
    sitemap.ts          # XML sitemap
    robots.ts           # robots.txt
    cook-mode.ts        # AI coaching prompt builder
    ingredient-parser.ts # Parses "1.5 cups flour" into {qty, unit, name}
    sanitizer.ts        # Strips dangerous HTML
    docs-pages.ts       # Developer docs and changelog pages
  enrichment/           # LLM-powered recipe enrichment (cached per recipe)
  affiliates/           # Amazon/Walmart shopping link generation
recipes/                # Source markdown recipe files
docs/                   # Generated static site (deployed to GitHub Pages)
tests/                  # Jest tests mirroring src/ structure
.claude/commands/       # /chef command definition for Claude Code plugin
.github/workflows/      # CI: test -> build -> generate -> deploy to Pages
```

## How the Build Pipeline Works

`buildSite()` in `src/generator/index.ts` runs this sequence:

1. Parse all `recipes/*.md` files into `ParsedRecipe` objects
2. Build a slug lookup map for recipe pairing resolution
3. Read `favorites.json` for curated favorites list
4. Build all taxonomies (9 types) from recipe metadata
5. Render each recipe page with JSON-LD, enrichment data, affiliate links
6. Render taxonomy hub pages with pagination (48 recipes per page)
7. Render taxonomy index pages (listing all entries per type)
8. Render index, about, contribute, favorites, docs, changelog pages
9. Generate sitemap.xml, robots.txt, llms.txt, CNAME
10. Generate RSS feeds (main feed + one per category)

Everything writes to the `docs/` directory.

## template.ts — The Monster File

This is by far the largest file. It contains:

- **`baseStyles()`** — All CSS as a template literal (no external stylesheets)
- **`footerCta()`** — Shared footer across all pages
- **`renderHeader()`** — Site navigation bar
- **`renderRecipePage()`** — Full recipe page HTML
- **`renderIndexPage()`** — Homepage with recipe grid
- **`renderHubPage()`** — Taxonomy category pages (e.g., "Main Course Recipes")
- **`renderContributorProfilePage()`** — Enhanced author pages with profile cards
- **`renderTaxonomyIndexPage()`** — Taxonomy listing pages
- **`renderAboutPage()`**, **`renderContributePage()`**, **`renderFavoritesPage()`**
- **`renderRecipeCard()`** — Reusable recipe card component
- **Inline `<script>` blocks** — servings slider, share buttons, copy-to-clipboard, buy-all

Key CSS architecture:
- Uses CSS custom properties (`:root` vars) for theming
- No CSS framework — everything is hand-written
- Responsive via single `@media (max-width: 640px)` breakpoint
- Google Fonts: DM Serif Display (headings) + Inter (body)

### Recipe Page Layout (top to bottom)

```
[Breadcrumb]
[H1 Title]
[Byline: author · prep · cook · calories]
[Tag pills: skill badge + taxonomy pills in a flex row]
[Servings slider: label, -, range, +, number input]
[Article: ingredients list, instructions, notes]
[Shop Ingredients section] (if enrichment exists)
[Gear section] (if enrichment exists)
[Cook with AI section] (if enrichment exists)
[Suggested Pairings] (if pairings exist)
[Share bar]
[Git clone badge]
[Footer CTA]
[Footer links: Sitemap · llms.txt · RSS Feed]
```

## Taxonomy System

Defined in `src/generator/taxonomy.ts` via `TAXONOMY_CONFIGS` array. Each config specifies:
- Type name, labels, extraction function, description templates
- The `allergy` type is *inverted* — it collects recipes that do NOT have a given allergen

Current types: `category`, `cuisine`, `ingredient`, `allergy`, `flavor`, `sauce`, `tool`, `skill_level`, `author`

Adding a new taxonomy: add a new entry to `TAXONOMY_CONFIGS` and add the corresponding frontmatter field to `RecipeFrontmatter` in `types.ts`.

## Contributor Profiles

Contributors (recipe authors) can have enhanced profile pages with bios, avatars, and social links. Profile data is stored in `contributors.json` at the project root.

```json
{
  "profiles": {
    "author-slug": {
      "name": "Display Name",
      "bio": "Short bio or description",
      "github": "username",
      "twitter": "handle",
      "instagram": "handle",
      "website": "https://example.com",
      "avatar": "https://example.com/photo.jpg"
    }
  }
}
```

- The key (`author-slug`) must match the slugified author name from recipe frontmatter
- If `avatar` is omitted but `github` is provided, the GitHub profile picture is used
- Authors without a profile entry get a simple fallback header
- Profile pages are generated at `/author/{slug}.html`

Related files:
- `contributors.json` — Profile data
- `src/contributors/` — Profile loader and types
- `src/generator/template.ts` — `renderContributorProfilePage()` function

## Recipe Format

Recipes are markdown files in `recipes/` with YAML frontmatter:

```yaml
---
title: Recipe Name
description: One-line description
author: Author Name
prep_time: PT20M          # ISO 8601 duration
cook_time: PT30M
servings: 4
calories: 500             # Per serving
recipe_category: Main Course
cuisine: Japanese-American
keywords: [chicken, teriyaki]
pairings: [other-recipe-slug]
recipe_ingredients: [Chicken, Teriyaki Sauce]  # Tag-level ingredients
allergies: [Soy, Gluten]
flavors: [Sweet, Umami]
sauces: [Teriyaki]
tools: [Skillet]
skill_level: Easy
---

## Ingredients
- 1 lb chicken breasts
- 1 cup teriyaki sauce

## Instructions
1. Slice chicken...
2. Cook in skillet...

## Notes
Optional notes...
```

The slug is derived from the filename (not the title).

## Enrichment & Affiliates

Enrichment is an optional LLM-powered step that analyzes recipes and produces:
- Normalized shopping search terms for each ingredient
- Gear/tool recommendations
- Cooking tips
- An AI coaching prompt for "Cook with AI" mode

Results are cached in `recipes/.cache/{slug}.json` with a content hash. Cache invalidates when the recipe markdown changes.

Affiliate providers (Amazon, Walmart) are initialized from env vars. The `link-generator.ts` converts enrichment search terms into shopping URLs.

## Servings Slider

The servings control is a range slider + number input beneath the tags on recipe pages. All three inputs (slider, +/- buttons, text field) stay synced. When servings change:
- All ingredient quantities update using fraction-aware formatting (renders 0.5 as 1/2)
- Calories per serving in the byline update proportionally

The JS is inline in `template.ts`, not in a separate file.

## Testing Patterns

- Tests live in `tests/` and mirror source structure
- `generator.test.ts` — Integration tests that call `buildSite()` and inspect output files
- `template.test.ts` — Unit tests that call render functions and check HTML strings
- Mock recipes are constructed inline in test files (no shared fixtures)
- The test recipe directory is `recipes/` (the real one — tests use actual recipe files)
- Integration tests clean up `.test-output` directories in afterAll

Common test pattern:
```typescript
const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
expect(html).toContain('expected-class-or-content');
```

## Things to Know

- **No external CSS/JS files** — everything is inlined in the HTML. This means CSS changes go in `baseStyles()` in template.ts.
- **The site name is "Claude Chef"** (not "Chef Claude"). The linter enforces this.
- **`docs/` is the deploy target** — GitHub Pages serves from this directory.
- **`dist/` is the compiled JS** — never edit these files directly.
- **RSS feeds** are only generated for the `category` taxonomy, not all 9 types.
- **llms.txt** only includes `category` and `cuisine` taxonomies (the primary navigation ones).
- **The footer links row** (`Sitemap · llms.txt · RSS Feed`) is in `footerCta()` and appears on every page.
- **Popup blocking** — The "Buy all" buttons open multiple tabs via `window.open()`. Browsers block all but the first. The button shows "N blocked — allow popups" when this happens.
- **No hot reload** — you must `npm run build && npm run generate` to see changes.
- **Git has no commits yet on main** — the `fatal: Needed a single revision` messages during tests are from `getCommitHash()`/`getCommitDate()` in index.ts and are harmless.

## Common Tasks

### Add a new page type
1. Add render function in `template.ts`
2. Call it from `buildSite()` in `index.ts`
3. Add sitemap entry
4. Add integration test in `generator.test.ts`
5. Add unit test in `template.test.ts`

### Change CSS styling
Edit the `baseStyles()` function in `template.ts`. All styles are in one long template literal. Use the CSS custom properties in `:root` for colors/spacing.

### Add a new taxonomy type
1. Add field to `RecipeFrontmatter` in `types.ts`
2. Add config to `TAXONOMY_CONFIGS` in `taxonomy.ts`
3. Add to `pillConfigs` in `renderRecipePage()` in `template.ts`
4. Tests in `taxonomy.test.ts`

### Add a new recipe
```bash
npm run build
node dist/cli/index.js create "Recipe Name"
# Edit the generated file in recipes/
node dist/cli/index.js submit  # Lint it
npm run generate               # Build site
```

Or use the Claude Code plugin: `/chef create Recipe Name`

## Roadmap

Planned features and milestones are tracked in the [Claude Chef Roadmap](https://github.com/users/greynewell/projects/3) GitHub Project. Issues are organized across four milestones: v0.2 (Dataset), v0.3 (Social), v0.4 (Integrations), v0.5 (Branding & Launch).
