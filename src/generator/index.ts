import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { parseRecipeFile } from './parser';
import { generateJsonLd, generateBreadcrumbJsonLd, generateWebSiteJsonLd, generateItemListJsonLd, generateCollectionPageJsonLd, generateTaxonomyIndexJsonLd, generateHubBreadcrumbJsonLd } from './structured-data';
import { renderRecipePage, renderIndexPage, renderHubPage, renderContributorProfilePage, renderTaxonomyIndexPage, renderLetterPage, groupEntriesByLetter, renderAboutPage, renderContributePage, renderFavoritesPage, renderInstallPage, RECIPES_PER_PAGE, computePagination, generateManifestJson, baseStyles, mainScript } from './template';
import { loadContributors } from '../contributors';
import { buildAllTaxonomies, toSlug } from './taxonomy';
import { generateSitemapFiles } from './sitemap';
import { generateRobotsTxt } from './robots';
import { generateLlmsTxt } from './llms-txt';
import { generateAllRssFeeds } from './rss';
import { generateCookModePrompt } from './cook-mode';
import { renderDocsPage, renderChangelogPage } from './docs-pages';
import { ParsedRecipe, SitemapEntry } from '../types';
import { readCache } from '../enrichment/cache';
import { EnrichmentResult } from '../enrichment/types';
import { buildProviders } from '../affiliates/registry';
import { generateAffiliateLinks } from '../affiliates/link-generator';
import { AffiliateLink } from '../affiliates/types';
import { minify } from 'html-minifier-terser';

const BASE_URL = 'https://claudechef.com';
const BUILD_MANIFEST_FILE = '.build-manifest.json';

interface BuildManifest {
  /** Map of recipe slug to content hash */
  recipes: Record<string, string>;
}

function contentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

function readBuildManifest(outputDir: string): BuildManifest {
  const manifestPath = path.join(outputDir, BUILD_MANIFEST_FILE);
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { recipes: {} };
  }
}

function writeBuildManifest(outputDir: string, manifest: BuildManifest): void {
  const manifestPath = path.join(outputDir, BUILD_MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getCommitDate(): string {
  try {
    return execSync('git log -1 --format=%cs', { encoding: 'utf-8' }).trim();
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  conservativeCollapse: false,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  collapseBooleanAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  minifyCSS: true,
  minifyJS: true,
};

async function writeMinifiedHtml(filePath: string, html: string): Promise<void> {
  try {
    const minified = await minify(html, MINIFY_OPTIONS);
    fs.writeFileSync(filePath, minified, 'utf-8');
  } catch {
    // Fallback: write unminified if minifier chokes (e.g., unescaped quotes in attributes)
    fs.writeFileSync(filePath, html, 'utf-8');
  }
}

function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function minifyJs(js: string): string {
  // Basic JS minification: collapse whitespace around operators, remove comments
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Build the full static site from a recipes directory into an output directory.
 * When force is false (default), only recipe pages whose markdown changed are regenerated.
 * Aggregate pages (index, taxonomy, sitemap, etc.) are always rebuilt.
 */
export async function buildSite(recipesDir: string, outputDir: string, force: boolean = false): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write shared CSS stylesheet (minified, extracted to avoid duplication per page)
  fs.writeFileSync(path.join(outputDir, 'styles.css'), minifyCss(baseStyles()), 'utf-8');

  // Write shared JavaScript (minified, extracted to avoid duplication per page)
  fs.writeFileSync(path.join(outputDir, 'main.js'), minifyJs(mainScript()), 'utf-8');

  // Load previous build manifest for incremental builds
  const prevManifest = force ? { recipes: {} } : readBuildManifest(outputDir);
  const newManifest: BuildManifest = { recipes: {} };

  // Find all .md files in recipes directory
  const files = fs.readdirSync(recipesDir).filter(f => f.endsWith('.md'));

  const commitHash = getCommitHash();
  const commitDate = getCommitDate();
  const sitemapEntries: SitemapEntry[] = [];
  const allRecipes: ParsedRecipe[] = [];

  // Cache directory lives alongside recipes
  const cacheDir = path.join(recipesDir, '.cache');

  // Compute content hashes for each recipe file (including enrichment cache)
  const recipeHashes = new Map<string, string>();
  for (const file of files) {
    const filePath = path.join(recipesDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const slug = path.basename(file, '.md');
    // Include enrichment cache in hash so pages regenerate when enrichment changes
    const enrichmentPath = path.join(cacheDir, `${slug}.json`);
    let enrichmentContent = '';
    try {
      enrichmentContent = fs.readFileSync(enrichmentPath, 'utf-8');
    } catch {
      // No enrichment cache yet
    }
    recipeHashes.set(slug, contentHash(raw + enrichmentContent));
  }

  // Load affiliate providers from env
  const providers = buildProviders(process.env as Record<string, string | undefined>);

  // First pass: parse all recipes
  for (const file of files) {
    const filePath = path.join(recipesDir, file);
    allRecipes.push(parseRecipeFile(filePath));
  }

  // Build slug lookup map for pairing resolution
  const recipeBySlug = new Map<string, ParsedRecipe>();
  for (const recipe of allRecipes) {
    recipeBySlug.set(recipe.slug, recipe);
  }

  // Read favorites.json from project root
  let favoriteSlugs: string[] = [];
  try {
    const favoritesPath = path.resolve(recipesDir, '..', 'favorites.json');
    const favoritesRaw = fs.readFileSync(favoritesPath, 'utf-8');
    const parsed = JSON.parse(favoritesRaw);
    if (Array.isArray(parsed)) {
      favoriteSlugs = parsed.filter(s => typeof s === 'string' && recipeBySlug.has(s));
    }
  } catch {
    // Missing file or bad JSON — treat as empty
  }

  // Load contributor profiles from contributors.json
  const projectRoot = path.resolve(recipesDir, '..');
  const contributors = loadContributors(projectRoot);

  // Load enrichment data for ingredient normalization
  // This allows the LLM-normalized ingredient names to be used for taxonomy
  const ingredientOverrides = new Map<string, string[]>();
  for (const recipe of allRecipes) {
    const cached = readCache(cacheDir, recipe.slug);
    if (cached?.enrichment?.ingredients) {
      // Extract normalized names from enrichment, filtering out undefined
      const normalizedNames = cached.enrichment.ingredients
        .map(ing => ing.normalizedName)
        .filter((name): name is string => !!name);
      if (normalizedNames.length > 0) {
        ingredientOverrides.set(recipe.slug, normalizedNames);
      }
    }
  }

  // Build taxonomies with ingredient overrides from enrichment
  // Only create ingredient pages for ingredients with 3+ recipes
  const taxonomies = buildAllTaxonomies(allRecipes, { ingredientOverrides, ingredientMinRecipes: 3 });

  // Build a lookup of valid taxonomy slugs so recipe pills only link to existing pages
  const validTaxonomySlugs = new Map<string, Set<string>>();
  for (const taxonomy of taxonomies) {
    const slugs = new Set<string>();
    for (const entry of taxonomy.entries) {
      slugs.add(entry.slug);
    }
    validTaxonomySlugs.set(taxonomy.type, slugs);
  }

  // Second pass: render each recipe with resolved pairings
  let skippedCount = 0;
  let generatedCount = 0;

  for (const recipe of allRecipes) {
    const hash = recipeHashes.get(recipe.slug) || '';
    newManifest.recipes[recipe.slug] = hash;

    // Add sitemap entry (always — even for skipped pages)
    sitemapEntries.push({
      loc: `${BASE_URL}/${recipe.slug}.html`,
      lastmod: commitDate,
      priority: '0.8',
      changefreq: 'weekly',
    });

    // Skip rendering if content hasn't changed and the HTML file exists
    const outputFile = path.join(outputDir, `${recipe.slug}.html`);
    if (prevManifest.recipes[recipe.slug] === hash && fs.existsSync(outputFile)) {
      skippedCount++;
      continue;
    }

    // Resolve pairings slugs to actual recipes
    const pairings: ParsedRecipe[] = [];
    if (recipe.frontmatter.pairings) {
      for (const slug of recipe.frontmatter.pairings) {
        const paired = recipeBySlug.get(slug);
        if (paired) {
          pairings.push(paired);
        }
      }
    }

    // Generate JSON-LD with baseUrl for canonical URL and category/cuisine
    const jsonLd = generateJsonLd(recipe, commitDate, BASE_URL, pairings.length > 0 ? pairings : undefined);

    // Compute category breadcrumb for recipe
    const categoryBreadcrumb = recipe.frontmatter.recipe_category
      ? { name: recipe.frontmatter.recipe_category, slug: toSlug(recipe.frontmatter.recipe_category) }
      : undefined;

    // Generate BreadcrumbList JSON-LD
    const breadcrumbJsonLd = generateBreadcrumbJsonLd(recipe, BASE_URL, categoryBreadcrumb);

    // Load enrichment from cache (build never calls LLM)
    let enrichment: EnrichmentResult | null = null;
    let affiliateLinks: AffiliateLink[] | null = null;
    let cookModePrompt: string | null = null;

    const cached = readCache(cacheDir, recipe.slug);
    if (cached) {
      enrichment = cached.enrichment;

      if (providers.length > 0) {
        affiliateLinks = generateAffiliateLinks(enrichment, providers);
      }

      cookModePrompt = generateCookModePrompt(enrichment, affiliateLinks || [], recipe);
    }

    // Render HTML
    const html = renderRecipePage(recipe, jsonLd, commitHash, {
      enrichment,
      affiliateLinks,
      cookModePrompt,
      breadcrumbJsonLd,
      pairings: pairings.length > 0 ? pairings : null,
      categoryBreadcrumb: categoryBreadcrumb || null,
      validTaxonomySlugs,
    });

    // Write minified HTML to output
    await writeMinifiedHtml(outputFile, html);
    generatedCount++;
  }

  // Generate taxonomy hub pages and index pages
  for (const taxonomy of taxonomies) {
    const typeDir = path.join(outputDir, taxonomy.type);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    // Generate individual hub pages (with pagination)
    for (const entry of taxonomy.entries) {
      const totalRecipes = entry.recipes.length;
      const totalPages = Math.max(1, Math.ceil(totalRecipes / RECIPES_PER_PAGE));

      for (let page = 1; page <= totalPages; page++) {
        const pagination = computePagination(totalRecipes, page, taxonomy.type, entry.slug);
        const pageRecipes = entry.recipes.slice(pagination.startIndex, pagination.endIndex);
        const pageEntry = { ...entry, recipes: pageRecipes };

        const collectionPageJsonLd = generateCollectionPageJsonLd(
          taxonomy.type, pageEntry, BASE_URL, taxonomy.descriptions, totalRecipes
        );
        const hubBreadcrumbJsonLd = generateHubBreadcrumbJsonLd(taxonomy.type, taxonomy.label, entry.name, BASE_URL);

        // Use contributor profile page for author taxonomy, standard hub page for others
        let hubHtml: string;
        if (taxonomy.type === 'author') {
          const profile = contributors.get(entry.slug) || null;
          hubHtml = renderContributorProfilePage(entry, {
            collectionPageJsonLd,
            breadcrumbJsonLd: hubBreadcrumbJsonLd,
            favoriteSlugs,
            pagination: totalPages > 1 ? pagination : null,
            descriptions: taxonomy.descriptions,
            profile,
          });
        } else {
          hubHtml = renderHubPage(taxonomy.type, taxonomy.labelSingular, entry, {
            collectionPageJsonLd,
            breadcrumbJsonLd: hubBreadcrumbJsonLd,
            favoriteSlugs,
            pagination: totalPages > 1 ? pagination : null,
            descriptions: taxonomy.descriptions,
          }, taxonomy.label);
        }

        const fileName = page === 1 ? `${entry.slug}.html` : `${entry.slug}-page-${page}.html`;
        await writeMinifiedHtml(path.join(typeDir, fileName), hubHtml);

        sitemapEntries.push({
          loc: `${BASE_URL}/${taxonomy.type}/${fileName}`,
          lastmod: commitDate,
          priority: page === 1 ? '0.6' : '0.4',
          changefreq: 'weekly',
        });
      }
    }

    // Generate taxonomy index page
    const taxIndexJsonLd = generateTaxonomyIndexJsonLd(taxonomy, BASE_URL);
    const taxBreadcrumbJsonLd = generateHubBreadcrumbJsonLd(taxonomy.type, taxonomy.label, null, BASE_URL);
    const taxIndexHtml = renderTaxonomyIndexPage(taxonomy, {
      itemListJsonLd: taxIndexJsonLd,
      breadcrumbJsonLd: taxBreadcrumbJsonLd,
    });
    await writeMinifiedHtml(path.join(typeDir, 'index.html'), taxIndexHtml);

    sitemapEntries.push({
      loc: `${BASE_URL}/${taxonomy.type}/index.html`,
      lastmod: commitDate,
      priority: '0.7',
      changefreq: 'weekly',
    });

    // Generate letter pages for large taxonomies (50+ entries)
    const LARGE_THRESHOLD = 50;
    if (taxonomy.entries.length > LARGE_THRESHOLD) {
      const byLetter = groupEntriesByLetter(taxonomy.entries);
      const sortedLetters = [...byLetter.keys()].sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b));

      for (const letter of sortedLetters) {
        const entries = byLetter.get(letter)!;
        const letterSlug = letter === '#' ? 'other' : letter.toLowerCase();
        const letterHtml = renderLetterPage(taxonomy, letter, entries, sortedLetters, { favoriteSlugs });
        await writeMinifiedHtml(path.join(typeDir, `letter-${letterSlug}.html`), letterHtml);

        sitemapEntries.push({
          loc: `${BASE_URL}/${taxonomy.type}/letter-${letterSlug}.html`,
          lastmod: commitDate,
          priority: '0.5',
          changefreq: 'weekly',
        });
      }
    }
  }

  // Generate index page with structured data
  const webSiteJsonLd = generateWebSiteJsonLd(BASE_URL);
  // Only include favorited recipes in the ItemList JSON-LD (not all 10K+)
  const indexFavRecipes = favoriteSlugs.map(s => recipeBySlug.get(s)!).filter(Boolean);
  const indexListRecipes = indexFavRecipes.length > 0 ? indexFavRecipes : allRecipes.slice(0, 20);
  const itemListJsonLd = generateItemListJsonLd(indexListRecipes, BASE_URL);
  const indexHtml = renderIndexPage(allRecipes, { webSiteJsonLd, itemListJsonLd, taxonomies, favoriteSlugs });
  await writeMinifiedHtml(path.join(outputDir, 'index.html'), indexHtml);

  // Generate about page
  const aboutHtml = renderAboutPage();
  await writeMinifiedHtml(path.join(outputDir, 'about.html'), aboutHtml);

  sitemapEntries.push({
    loc: `${BASE_URL}/about.html`,
    lastmod: commitDate,
    priority: '0.5',
    changefreq: 'monthly',
  });

  // Generate contribute page
  const contributeHtml = renderContributePage();
  await writeMinifiedHtml(path.join(outputDir, 'contribute.html'), contributeHtml);

  sitemapEntries.push({
    loc: `${BASE_URL}/contribute.html`,
    lastmod: commitDate,
    priority: '0.5',
    changefreq: 'monthly',
  });

  // Generate install page
  const installHtml = renderInstallPage();
  await writeMinifiedHtml(path.join(outputDir, 'install.html'), installHtml);

  sitemapEntries.push({
    loc: `${BASE_URL}/install.html`,
    lastmod: commitDate,
    priority: '0.5',
    changefreq: 'monthly',
  });

  // Generate favorites page
  const favoriteRecipes = favoriteSlugs.map(s => recipeBySlug.get(s)!).filter(Boolean);
  const favoritesItemListJsonLd = favoriteRecipes.length > 0 ? generateItemListJsonLd(favoriteRecipes, BASE_URL) : null;
  const favoritesBreadcrumbJsonLd = {
    '@context': 'https://schema.org' as const,
    '@type': 'BreadcrumbList' as const,
    itemListElement: [
      { '@type': 'ListItem' as const, position: 1, name: 'Home', item: `${BASE_URL}/index.html` },
      { '@type': 'ListItem' as const, position: 2, name: 'Favorites' },
    ],
  };
  const favoritesHtml = renderFavoritesPage(favoriteRecipes, {
    itemListJsonLd: favoritesItemListJsonLd,
    breadcrumbJsonLd: favoritesBreadcrumbJsonLd,
  });
  await writeMinifiedHtml(path.join(outputDir, 'favorites.html'), favoritesHtml);

  sitemapEntries.push({
    loc: `${BASE_URL}/favorites.html`,
    lastmod: commitDate,
    priority: '0.7',
    changefreq: 'weekly',
  });

  // Generate developer docs page
  const docsHtml = renderDocsPage();
  await writeMinifiedHtml(path.join(outputDir, 'docs.html'), docsHtml);

  sitemapEntries.push({
    loc: `${BASE_URL}/docs.html`,
    lastmod: commitDate,
    priority: '0.4',
    changefreq: 'monthly',
  });

  // Generate changelog page
  const changelogHtml = renderChangelogPage();
  await writeMinifiedHtml(path.join(outputDir, 'changelog.html'), changelogHtml);

  sitemapEntries.push({
    loc: `${BASE_URL}/changelog.html`,
    lastmod: commitDate,
    priority: '0.3',
    changefreq: 'monthly',
  });

  // Add index to sitemap with highest priority
  sitemapEntries.unshift({
    loc: `${BASE_URL}/index.html`,
    lastmod: commitDate,
    priority: '1.0',
    changefreq: 'daily',
  });

  // Generate sitemap file(s) — splits into multiple files with an index if over 50k URLs
  const sitemapFiles = generateSitemapFiles(sitemapEntries, BASE_URL);
  for (const file of sitemapFiles) {
    fs.writeFileSync(path.join(outputDir, file.filename), file.content, 'utf-8');
  }

  // Generate robots.txt
  const robots = generateRobotsTxt(`${BASE_URL}/sitemap.xml`);
  fs.writeFileSync(path.join(outputDir, 'robots.txt'), robots, 'utf-8');

  // Generate llms.txt
  const llmsTxt = generateLlmsTxt(allRecipes, taxonomies, BASE_URL);
  fs.writeFileSync(path.join(outputDir, 'llms.txt'), llmsTxt, 'utf-8');

  // Generate RSS feeds (main + per-category)
  const rssFeeds = generateAllRssFeeds(allRecipes, taxonomies, BASE_URL, commitDate);
  for (const feed of rssFeeds) {
    const feedPath = path.join(outputDir, feed.relativePath);
    const feedDir = path.dirname(feedPath);
    if (!fs.existsSync(feedDir)) {
      fs.mkdirSync(feedDir, { recursive: true });
    }
    fs.writeFileSync(feedPath, feed.content, 'utf-8');
  }

  // Generate manifest.json for PWA
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), generateManifestJson(), 'utf-8');

  // Generate CNAME for GitHub Pages custom domain
  fs.writeFileSync(path.join(outputDir, 'CNAME'), 'claudechef.com\n', 'utf-8');

  // Write build manifest for next incremental build
  writeBuildManifest(outputDir, newManifest);

  // Log build summary
  if (skippedCount > 0) {
    console.log(`  Recipes: ${generatedCount} generated, ${skippedCount} unchanged (skipped)`);
  }
}

// CLI entry point
if (require.main === module) {
  const recipesDir = path.resolve(__dirname, '../../recipes');
  const outputDir = path.resolve(__dirname, '../../docs');
  const force = process.argv.includes('--force');
  console.log(`Building site from ${recipesDir} -> ${outputDir}${force ? ' (full rebuild)' : ''}`);
  buildSite(recipesDir, outputDir, force).then(() => {
    console.log('Site built successfully.');
  }).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
