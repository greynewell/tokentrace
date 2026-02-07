import * as path from 'path';
import { marked } from 'marked';
import { ParsedRecipe, RecipeJsonLd, BreadcrumbJsonLd, WebSiteJsonLd, ItemListJsonLd, CollectionPageJsonLd, Taxonomy, TaxonomyDescriptions, TaxonomyEntry, TaxonomyType, FAQ } from '../types';
import { generateFAQPageJsonLd } from './structured-data';
import { EnrichmentResult } from '../enrichment/types';
import { AffiliateLink } from '../affiliates/types';
import { sanitizeContent } from './sanitizer';
import { toSlug } from './taxonomy';
import { parseIngredient } from './ingredient-parser';

const BASE_URL = 'https://claudechef.com';
const DEFAULT_OG_IMAGE = 'https://claudechef.com/images/og-default.jpg';

const REPO_URL = 'https://github.com/greynewell/claude-chef.git';

// Read version from package.json at module load time
const pkg = require(path.resolve(__dirname, '../../package.json'));
export const VERSION: string = pkg.version;

export const RECIPES_PER_PAGE = 48;

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  prevUrl: string | null;
  nextUrl: string | null;
}

export function computePagination(totalRecipes: number, currentPage: number, type: string, slug: string): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(totalRecipes / RECIPES_PER_PAGE));
  const startIndex = (currentPage - 1) * RECIPES_PER_PAGE;
  const endIndex = Math.min(startIndex + RECIPES_PER_PAGE, totalRecipes);

  const pageUrl = (page: number) => {
    if (page === 1) return `/${type}/${slug}.html`;
    return `/${type}/${slug}-page-${page}.html`;
  };

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    prevUrl: currentPage > 1 ? pageUrl(currentPage - 1) : null,
    nextUrl: currentPage < totalPages ? pageUrl(currentPage + 1) : null,
  };
}

/** Escape a string for safe use inside HTML attribute values (double-quoted). */
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chefHatSvg(size: number = 28): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><ellipse cx="32" cy="18" rx="18" ry="14" fill="#fff" stroke="currentColor" stroke-width="2.5"/><circle cx="20" cy="16" r="7" fill="#EEF3EE"/><circle cx="44" cy="16" r="7" fill="#EEF3EE"/><circle cx="32" cy="11" r="8" fill="#EEF3EE"/><rect x="18" y="26" width="28" height="18" rx="3" fill="#fff" stroke="currentColor" stroke-width="2.5"/><line x1="24" y1="32" x2="24" y2="40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/><line x1="32" y1="32" x2="32" y2="40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/><line x1="40" y1="32" x2="40" y2="40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/></svg>`;
}

function faviconSvg(): string {
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 64 64\'><ellipse cx=\'32\' cy=\'18\' rx=\'18\' ry=\'14\' fill=\'%23fff\' stroke=\'%235B7B5E\' stroke-width=\'3\'/><circle cx=\'20\' cy=\'16\' r=\'7\' fill=\'%23EEF3EE\'/><circle cx=\'44\' cy=\'16\' r=\'7\' fill=\'%23EEF3EE\'/><circle cx=\'32\' cy=\'11\' r=\'8\' fill=\'%23EEF3EE\'/><rect x=\'18\' y=\'26\' width=\'28\' height=\'18\' rx=\'3\' fill=\'%23fff\' stroke=\'%235B7B5E\' stroke-width=\'3\'/></svg>')}">`;
}

export function googleFonts(): string {
  return `${faviconSvg()}<link rel="manifest" href="/manifest.json"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`;
}

export function generateManifestJson(): string {
  return JSON.stringify({
    name: 'Claude Chef',
    short_name: 'Claude Chef',
    description: 'Delicious recipes with AI-powered cooking guidance.',
    start_url: '/index.html',
    display: 'standalone',
    background_color: '#FAFAF7',
    theme_color: '#5B7B5E',
    orientation: 'any',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2);
}

export function baseStyles(): string {
  return `
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --color-bg: #FAFAF7;
      --color-surface: #FFFFFF;
      --color-text: #2D2D2D;
      --color-text-secondary: #6B6B6B;
      --color-text-light: #8A8A8A;
      --color-primary: #5B7B5E;
      --color-primary-hover: #4A6A4D;
      --color-primary-light: #EEF3EE;
      --color-accent: #C4956A;
      --color-border: #E8E5E0;
      --color-border-light: #F0EDE8;
      --font-heading: 'DM Serif Display', Georgia, 'Times New Roman', serif;
      --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --max-width: 740px;
      --radius: 12px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
    }

    body {
      font-family: var(--font-body);
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.75;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .skip-link {
      position: absolute;
      top: -100%;
      left: 1rem;
      background: var(--color-primary);
      color: #fff;
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      z-index: 100;
      font-size: 0.875rem;
    }
    .skip-link:focus { top: 1rem; }

    .site-header {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 1.5rem 1.5rem 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .site-header .site-brand {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      color: var(--color-primary);
      text-decoration: none;
      letter-spacing: -0.01em;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .site-header .site-brand:hover { color: var(--color-primary-hover); }
    .site-header a {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      color: var(--color-primary);
      text-decoration: none;
      letter-spacing: -0.01em;
    }
    .site-header a:hover { color: var(--color-primary-hover); }
    .site-header nav a {
      font-family: var(--font-body);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-left: 1.5rem;
    }
    .site-header nav a:hover { color: var(--color-primary); }
    main {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }

    h1 {
      font-family: var(--font-heading);
      font-size: 2.25rem;
      font-weight: 400;
      line-height: 1.2;
      color: var(--color-text);
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
    }

    h2 {
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--color-text);
      margin: 2.5rem 0 1rem;
      letter-spacing: -0.01em;
    }

    h3 {
      font-family: var(--font-body);
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-secondary);
      margin: 2rem 0 0.75rem;
    }

    p { margin: 0.75rem 0; color: var(--color-text); }

    ul, ol { padding-left: 1.5rem; margin: 0.75rem 0; }
    li { margin: 0.4rem 0; }

    a { color: var(--color-primary); text-decoration: none; transition: color 0.15s ease; }
    a:hover { color: var(--color-primary-hover); }
    a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 2px; }

    .recipe-byline {
      font-size: 0.9375rem;
      color: var(--color-text-secondary);
      margin-bottom: 0.75rem;
      line-height: 1.5;
    }
    .recipe-byline a {
      color: var(--color-primary);
      font-weight: 500;
      text-decoration: none;
    }
    .recipe-byline a:hover {
      color: var(--color-primary-hover);
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: var(--color-primary-light);
      color: var(--color-primary);
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.35rem 0.75rem;
      border-radius: 100px;
    }
    a.meta-pill { text-decoration: none; transition: all 0.15s ease; }
    a.meta-pill:hover { background: var(--color-primary); color: #fff; }

    .recipe-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-bottom: 1.5rem;
      align-items: center;
    }
    .recipe-tags .meta-pill {
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      line-height: 1;
    }

    /* Taxonomy-type shading — darkest to lightest conveys hierarchy */
    .tax-category { background: #D2E0D3; color: #3A5C3D; }
    .tax-category:hover { background: #3A5C3D; color: #fff; }
    .tax-cuisine { background: #D9E4DA; color: #426645; }
    .tax-cuisine:hover { background: #426645; color: #fff; }
    .tax-ingredient { background: #E0E9E1; color: #4A6F4D; }
    .tax-ingredient:hover { background: #4A6F4D; color: #fff; }
    .tax-allergy { background: #F2E0D9; color: #8B5E3C; }
    .tax-allergy:hover { background: #8B5E3C; color: #fff; }
    .tax-flavor { background: #ECE6F0; color: #6B5B7B; }
    .tax-flavor:hover { background: #6B5B7B; color: #fff; }
    .tax-sauce { background: #E8E3DE; color: #6B5F52; }
    .tax-sauce:hover { background: #6B5F52; color: #fff; }
    .tax-tool { background: #DEE4E8; color: #4A5B68; }
    .tax-tool:hover { background: #4A5B68; color: #fff; }
    .tax-skill_level { background: #E6DDE6; color: #6B4F6B; }
    .tax-skill_level:hover { background: #6B4F6B; color: #fff; }
    .tax-author { background: #DDE3E8; color: #4A5668; }
    .tax-author:hover { background: #4A5668; color: #fff; }

    .skill-badge {
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }
    .skill-badge:hover { opacity: 0.85; }
    .skill-badge.easy { background: #E8F5E9; color: #2E7D32; }
    .skill-badge.intermediate { background: #FFF3E0; color: #E65100; }
    .skill-badge.advanced { background: #FFEBEE; color: #C62828; }

    article { font-size: 1.0625rem; }
    article h2 { font-size: 1.375rem; margin-top: 2.5rem; }
    article ul, article ol { margin: 0.75rem 0; }
    article li { line-height: 1.7; }

    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 1.5rem;
      margin: 1.5rem 0;
      box-shadow: var(--shadow-sm);
    }

    .card h2 { margin-top: 0; margin-bottom: 0.75rem; font-size: 1.25rem; }

    .pairings-section ul { list-style: none; padding-left: 0; }
    .pairing-item { padding: 0.6rem 0; border-bottom: 1px solid var(--color-border-light); }
    .pairing-item:last-child { border-bottom: none; }
    .pairing-item a { display: block; text-decoration: none; }
    .pairing-title { font-weight: 500; color: var(--color-text); display: block; }
    .pairing-item a:hover .pairing-title { color: var(--color-primary); }
    .pairing-desc { font-size: 0.875rem; color: var(--color-text-secondary); display: block; margin-top: 0.15rem; }

    .shop-section ul, .gear-section ul { list-style: none; padding-left: 0; }
    .shop-section li, .gear-section li {
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--color-border-light);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .shop-section li:last-child, .gear-section li:last-child { border-bottom: none; }

    .ingredient-name, .gear-name {
      font-weight: 500;
      color: var(--color-text);
    }

    .affiliate-links { display: inline-flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }
    .affiliate-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 4px;
      opacity: 0.45;
      transition: opacity 0.15s ease;
    }
    .affiliate-link:hover { opacity: 1; }
    .affiliate-link img { width: 16px; height: 16px; display: block; }

    .buy-all-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .buy-all-actions .share-btn img {
      width: 14px;
      height: 14px;
      display: block;
    }

    .servings-slider {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      user-select: none;
    }
    .servings-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      white-space: nowrap;
    }
    .servings-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 1px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      transition: all 0.15s ease;
      font-family: var(--font-body);
      flex-shrink: 0;
    }
    .servings-btn:hover {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
    }
    .servings-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    .servings-range {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      background: var(--color-border);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .servings-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-primary);
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .servings-range::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }
    .servings-range::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-primary);
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      cursor: pointer;
    }
    .servings-range::-moz-range-track {
      height: 4px;
      background: var(--color-border);
      border-radius: 2px;
    }
    .servings-input {
      width: 3.25rem;
      text-align: center;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: var(--font-body);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 0.3rem 0.25rem;
      background: var(--color-surface);
      -moz-appearance: textfield;
      flex-shrink: 0;
    }
    .servings-input::-webkit-outer-spin-button,
    .servings-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .servings-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(91,123,94,0.15);
    }
    .ingredient-qty {
      font-weight: 600;
    }
    .ingredient-list {
      list-style: disc;
      padding-left: 1.5rem;
      margin: 0.75rem 0;
    }

    .cook-mode-box {
      position: relative;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1.25rem;
      margin-top: 0.75rem;
    }
    .cook-mode-prompt {
      white-space: pre-wrap;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--color-text-secondary);
      max-height: 220px;
      overflow-y: auto;
    }
    .copy-btn {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: var(--color-primary);
      border: none;
      color: #fff;
      padding: 0.4rem 1rem;
      border-radius: 100px;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 0.8125rem;
      font-weight: 500;
      transition: background 0.15s ease;
    }
    .copy-btn:hover { background: var(--color-primary-hover); }
    .copy-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

    .git-meta {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border);
      color: var(--color-text-light);
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .git-btn {
      display: inline-flex;
      align-items: center;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 0.35rem 0.85rem;
      border-radius: 100px;
      color: var(--color-text-secondary);
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .git-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .recipe-source {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
      color: var(--color-text-light);
    }
    .recipe-source sup { color: var(--color-primary); font-weight: 600; margin-right: 0.25rem; }
    .recipe-source a { color: var(--color-text-light); word-break: break-all; }
    .recipe-source a:hover { color: var(--color-primary); }

    /* Index page */
    .hero {
      text-align: center;
      padding: 2rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      margin-bottom: 2rem;
    }
    .hero h1 { font-size: 2.75rem; margin-bottom: 1rem; }
    .hero-tagline {
      font-size: 1.125rem;
      color: var(--color-text-secondary);
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.7;
    }
    .hero-cta {
      margin-top: 1.5rem;
    }
    .hero-cta a {
      display: inline-block;
      background: var(--color-primary);
      color: #fff;
      font-weight: 600;
      font-size: 1rem;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      text-decoration: none;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .hero-cta a:hover { background: #4a6a4d; transform: translateY(-1px); }

    .recipe-grid {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 1rem;
    }
    .recipe-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .recipe-card:hover { box-shadow: var(--shadow-md); border-color: var(--color-primary); }
    .recipe-card a {
      font-family: var(--font-heading);
      font-size: 1.25rem;
      color: var(--color-text);
      text-decoration: none;
      display: block;
      margin-bottom: 0.35rem;
    }
    .recipe-card a:hover { color: var(--color-primary); }
    .recipe-card .desc {
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
      line-height: 1.6;
    }

    .recipe-card.favorite { border-left: 3px solid var(--color-primary); }

    .card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.5rem;
      align-items: center;
    }
    .card-meta .meta-pill,
    .card-meta .skill-badge {
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1;
      padding: 0.3rem 0.55rem;
      margin: 0;
    }
    .card-meta .meta-pill.meta-info {
      background: #E8EAEC;
      color: #555;
    }
    .card-meta .meta-pill.tax-category,
    .card-meta .meta-pill.tax-cuisine {
      background: #E6EDE7;
      color: #4A6F4D;
    }

    .favorites-section { margin-bottom: 2.5rem; }
    .favorites-section h2 { text-align: center; margin-bottom: 1rem; }

    .category-showcase { margin-bottom: 3rem; }
    .category-showcase h2 { margin-bottom: 1rem; }
    .category-showcase h2 a { color: var(--color-heading); text-decoration: none; }
    .category-showcase h2 a:hover { color: var(--color-primary); }
    .category-count { font-size: 0.85rem; color: var(--color-text-secondary); font-weight: 400; font-family: var(--font-body); }
    .section-link { text-align: right; margin-top: 0.5rem; }
    .section-link a { color: var(--color-primary); text-decoration: none; font-weight: 500; }
    .section-link a:hover { text-decoration: underline; }
    .cuisine-highlights { margin-bottom: 2.5rem; }
    .cuisine-highlights h2 { text-align: center; margin-bottom: 1rem; }
    .cuisine-count { font-size: 0.8rem; opacity: 0.7; }

    /* Footer CTA */
    .cta {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid var(--color-border);
    }
    .cta-box {
      background: var(--color-primary-light);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 2rem;
      text-align: center;
    }
    .cta-title {
      font-family: var(--font-heading);
      font-size: 1.5rem;
      color: var(--color-text);
      margin-bottom: 0.5rem;
    }
    .cta-body {
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
      margin-bottom: 1.25rem;
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    .cta pre {
      display: inline-block;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.8125rem;
      color: var(--color-primary);
    }

    .created-by {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.8125rem;
      color: var(--color-text-light);
    }
    .created-by a { color: var(--color-text-secondary); }
    .created-by a:hover { color: var(--color-primary); }
    .footer-links {
      text-align: center;
      margin-top: 0.5rem;
      font-size: 0.8125rem;
      color: var(--color-text-light);
    }
    .footer-links a { color: var(--color-text-secondary); }
    .footer-links a:hover { color: var(--color-primary); }
    .affiliate-statement {
      text-align: center;
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--color-text-light);
    }
    .affiliate-disclosure {
      font-size: 0.75rem;
      color: var(--color-text-light);
      margin: 0.25rem 0 0.5rem;
    }
    .footer-gh {
      text-align: center;
      margin-top: 0.6rem;
      display: flex;
      justify-content: center;
      gap: 0.5rem;
    }
    .footer-gh a {
      display: inline-flex; align-items: center; gap: 0.3rem;
      font-size: 0.75rem; font-weight: 500; font-family: var(--font-body);
      color: var(--color-text-light); text-decoration: none;
      border: 1px solid var(--color-border-light); border-radius: 5px;
      padding: 0.2rem 0.55rem; line-height: 1;
      transition: color 0.15s, border-color 0.15s;
    }
    .footer-gh a:hover { color: var(--color-primary); border-color: var(--color-primary); }
    .footer-gh svg { width: 13px; height: 13px; fill: currentColor; }

    /* Taxonomy hub pages */
    .taxonomy-header {
      margin-bottom: 2rem;
    }
    .taxonomy-header h1 { margin-bottom: 0.5rem; }
    .taxonomy-header p {
      color: var(--color-text-secondary);
      font-size: 1.0625rem;
    }

    .taxonomy-grid {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .taxonomy-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 1.25rem 1.5rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .taxonomy-card:hover { box-shadow: var(--shadow-md); border-color: var(--color-primary); }
    .taxonomy-card a {
      font-family: var(--font-heading);
      font-size: 1.125rem;
      color: var(--color-text);
      text-decoration: none;
    }
    .taxonomy-card a:hover { color: var(--color-primary); }
    .taxonomy-count {
      display: inline-flex;
      align-items: center;
      background: var(--color-primary-light);
      color: var(--color-primary);
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.25rem 0.6rem;
      border-radius: 100px;
    }

    /* Large taxonomy index (alphabetical directory) */
    .popular-section { margin-bottom: 3rem; }
    .popular-section h2 { margin-bottom: 1rem; }
    .alpha-directory h2 { margin-bottom: 1rem; }
    .letter-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-bottom: 1.5rem;
      padding: 0.75rem;
      background: var(--color-surface);
      border-radius: var(--radius);
      border: 1px solid var(--color-border);
    }
    .letter-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.4rem 0.75rem;
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--color-text);
      text-decoration: none;
      border-radius: 4px;
      transition: background 0.15s ease, color 0.15s ease;
      white-space: nowrap;
    }
    .letter-link:hover { background: var(--color-primary); color: #fff; }
    .letter-link.current { background: var(--color-primary); color: #fff; }
    .letter-count { font-size: 0.75rem; opacity: 0.7; margin-left: 0.25rem; font-weight: 400; }
    .alpha-group { margin-bottom: 1.5rem; }
    .alpha-letter {
      font-size: 1.25rem;
      color: var(--color-primary);
      border-bottom: 2px solid var(--color-primary);
      padding-bottom: 0.25rem;
      margin-bottom: 0.75rem;
      display: inline-block;
    }
    .alpha-list {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.375rem 1rem;
    }
    .alpha-list li { font-size: 0.9375rem; }
    .alpha-list a { color: var(--color-text); text-decoration: none; }
    .alpha-list a:hover { color: var(--color-primary); text-decoration: underline; }
    .alpha-count { color: var(--color-text-secondary); font-size: 0.8125rem; }

    /* Browse section on index */
    .browse-section {
      margin-bottom: 2.5rem;
    }
    .browse-section h2 {
      text-align: center;
      margin-bottom: 1rem;
    }
    .browse-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }
    .browse-pill {
      display: inline-flex;
      align-items: center;
      border: none;
      padding: 0.45rem 1rem;
      border-radius: 100px;
      font-size: 0.9375rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    /* Breadcrumb trail */
    .breadcrumb {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      margin-bottom: 0.75rem;
    }
    .breadcrumb a { color: var(--color-primary); text-decoration: none; }
    .breadcrumb a:hover { color: var(--color-primary-hover); }
    .breadcrumb-sep { color: var(--color-text-light); }

    /* FAQ Section */
    .faq-section {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border);
    }
    .faq-section h2 {
      font-family: var(--font-heading);
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    .faq-item {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      margin-bottom: 0.5rem;
      overflow: hidden;
    }
    .faq-item[open] {
      border-color: var(--color-primary);
    }
    .faq-question {
      padding: 1rem 1.25rem;
      font-weight: 600;
      cursor: pointer;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.95rem;
      color: var(--color-text-primary);
    }
    .faq-question::-webkit-details-marker { display: none; }
    .faq-question::after {
      content: '+';
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--color-text-light);
      transition: transform 0.2s;
      flex-shrink: 0;
      margin-left: 1rem;
    }
    .faq-item[open] .faq-question::after {
      content: '\\2212';
      color: var(--color-primary);
    }
    .faq-answer {
      padding: 0 1.25rem 1rem;
      font-size: 0.9rem;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    /* Share bar */
    .share-bar {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .share-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 0.4rem 0.85rem;
      border-radius: 100px;
      color: var(--color-text-secondary);
      font-family: var(--font-body);
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .share-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .share-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .share-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }
    .pagination a, .pagination span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.25rem;
      height: 2.25rem;
      padding: 0.25rem 0.75rem;
      border-radius: 100px;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .pagination-link {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }
    .pagination-link:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .pagination-current {
      background: var(--color-primary);
      color: #fff;
      border: 1px solid var(--color-primary);
    }
    .pagination-link.disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    /* Responsive */
    @media (max-width: 640px) {
      h1 { font-size: 1.75rem; }
      .hero h1 { font-size: 2rem; }
      .hero-tagline { font-size: 1rem; }
      main { padding: 1.5rem 1rem 3rem; }
      .site-header { padding: 1rem 1rem 0; }
      .card { padding: 1.25rem; }
      .meta-pill { font-size: 0.75rem; padding: 0.3rem 0.6rem; }
      .card-meta .meta-pill,
      .card-meta .skill-badge {
        font-size: 0.6875rem;
        padding: 0.2rem 0.45rem;
      }
    }
  `;
}

/**
 * Shared JavaScript for all pages. Written to /main.js by the build pipeline.
 * Contains: share/copy-link handlers, servings slider, copy-list & buy-all handlers.
 * Each block uses querySelector on data attributes so it safely no-ops on pages
 * that don't have the relevant DOM elements.
 */
export function mainScript(): string {
  return `
// --- Share & Copy-link handlers ---
document.querySelectorAll('[data-share]').forEach(function(btn){
  if(!navigator.share){btn.style.display='none';return}
  btn.addEventListener('click',function(){
    navigator.share({title:btn.dataset.title,text:btn.dataset.text,url:btn.dataset.url}).catch(function(){})
  })
});
document.querySelectorAll('[data-copy-link]').forEach(function(btn){
  btn.addEventListener('click',function(){
    navigator.clipboard.writeText(btn.dataset.url).then(function(){
      var s=btn.querySelector('span');var o=s.textContent;s.textContent='Copied!';setTimeout(function(){s.textContent=o},2000)
    })
  })
});

// --- Servings slider ---
(function(){
  var article = document.querySelector('article[data-base-servings]');
  if (!article) return;
  var baseServings = parseInt(article.dataset.baseServings, 10);
  var currentServings = baseServings;
  var slider = document.querySelector('.servings-range');
  var numInput = document.querySelector('.servings-input');
  var ingredients = article.querySelectorAll('.ingredient[data-base-qty]');
  var FRAC = {
    '0.125':'\\u215B','0.2':'\\u2155','0.25':'\\u00BC',
    '0.333':'\\u2153','0.5':'\\u00BD','0.667':'\\u2154','0.75':'\\u00BE'
  };
  function snapFraction(f) {
    if (f < 0.0625) return 0;
    var targets = [0.125,0.2,0.25,0.333,0.5,0.667,0.75,1];
    var best = 0, bestDist = Math.abs(f);
    for (var i = 0; i < targets.length; i++) {
      var d = Math.abs(f - targets[i]);
      if (d < bestDist) { bestDist = d; best = targets[i]; }
    }
    return bestDist < 0.05 ? best : f;
  }
  function formatQty(n) {
    if (n === 0) return '0';
    var whole = Math.floor(n);
    var frac = snapFraction(n - whole);
    var key = frac.toFixed(3).replace(/0+$/,'').replace(/\\.$/,'');
    var sym = FRAC[key] || '';
    if (whole === 0 && sym) return sym;
    if (whole > 0 && sym) return whole + sym;
    if (frac === 0) return '' + whole;
    var r = Math.round(n * 10) / 10;
    return r === Math.floor(r) ? '' + r : r.toFixed(1);
  }
  function setServings(n) {
    n = Math.max(1, Math.min(99, Math.round(n)));
    currentServings = n;
    slider.value = Math.min(n, parseInt(slider.max, 10));
    numInput.value = n;
    var pct = ((n - 1) / (parseInt(slider.max, 10) - 1)) * 100;
    slider.style.background = 'linear-gradient(to right, var(--color-primary) ' + pct + '%, var(--color-border) ' + pct + '%)';
    var ratio = n / baseServings;
    // Note: calories per serving stays constant (it's a unit rate)
    for (var i = 0; i < ingredients.length; i++) {
      var el = ingredients[i];
      el.querySelector('.ingredient-qty').textContent = formatQty(parseFloat(el.dataset.baseQty) * ratio);
    }
  }
  slider.addEventListener('input', function() { setServings(parseInt(slider.value, 10)); });
  numInput.addEventListener('input', function() {
    var v = parseInt(numInput.value, 10);
    if (!isNaN(v) && v >= 1) setServings(v);
  });
  numInput.addEventListener('blur', function() { numInput.value = currentServings; });
  document.querySelectorAll('.servings-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.dir === '+') setServings(currentServings + 1);
      else setServings(currentServings - 1);
    });
  });
  setServings(baseServings);
})();

// --- Copy-list & Buy-all handlers ---
document.querySelectorAll('[data-copy-list]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var card = btn.closest('.card');
    if (!card) return;
    var names = Array.from(card.querySelectorAll('.ingredient-name, .gear-name'))
      .map(function(el) { return el.textContent.trim(); });
    if (names.length === 0) return;
    navigator.clipboard.writeText(names.join('\\n')).then(function() {
      var s = btn.querySelector('span');
      var o = s.textContent;
      s.textContent = 'Copied!';
      setTimeout(function() { s.textContent = o; }, 2000);
    });
  });
});
document.querySelectorAll('[data-buy-all]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var urls;
    try { urls = JSON.parse(btn.dataset.urls); } catch(e) { return; }
    if (!urls || urls.length === 0) return;
    var provider = btn.dataset.provider || 'this store';
    if (urls.length > 5) {
      if (!confirm('This will open ' + urls.length + ' tabs on ' + provider + '. Continue?')) return;
    }
    var blocked = 0;
    for (var i = 0; i < urls.length; i++) {
      var w = window.open(urls[i], '_blank', 'noopener');
      if (!w) blocked++;
    }
    var s = btn.querySelector('span');
    var o = s.textContent;
    if (blocked > 0) {
      s.textContent = blocked + ' blocked \\u2014 allow popups';
      setTimeout(function() { s.textContent = o; }, 4000);
    } else {
      s.textContent = 'Opened!';
      setTimeout(function() { s.textContent = o; }, 2000);
    }
  });
});
`;
}

export function footerCta(): string {
  return `
<footer class="cta">
  <div class="cta-box">
    <p class="cta-title">Your AI Sous Chef, Ready When You Are</p>
    <p class="cta-body">Get real-time cooking guidance, ingredient swaps, and step-by-step coaching from Claude Chef.</p>
    <pre><code>/plugin marketplace add greynewell/claude-chef</code></pre>
    <p class="cta-body">Have a recipe to share? <a href="/contribute.html">Contribute to Claude Chef</a></p>
  </div>
  <p class="created-by"><a href="/changelog.html">v${VERSION}</a> · <a href="https://github.com/greynewell/claude-chef/blob/main/LICENSE">Public Domain (CC0)</a> · Created by <a href="https://greynewell.com">Grey Newell</a> · <a href="/docs.html">Developer Docs</a> · <a href="https://github.com/greynewell/claude-chef/issues/new?template=bug_report.md">Report a bug</a> · <a href="https://github.com/greynewell/claude-chef/issues/new?template=feature_request.md">Request a feature</a></p>
  <p class="affiliate-statement">As an Amazon Associate I earn from qualifying purchases.</p>
  <p class="footer-links"><a href="/sitemap.xml">Sitemap</a> · <a href="/llms.txt">llms.txt</a> · <a href="/feed.xml">RSS Feed</a></p>
  <div class="footer-gh"><a href="https://github.com/greynewell/claude-chef" target="_blank" rel="noopener" aria-label="Star on GitHub"><svg viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/></svg>Star</a><a href="https://github.com/greynewell/claude-chef/fork" target="_blank" rel="noopener" aria-label="Fork on GitHub"><svg viewBox="0 0 16 16"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/></svg>Fork</a></div>
</footer>`;
}

export function renderHeader(context?: string): string {
  return `<header class="site-header">
    <a class="site-brand" href="/index.html">${chefHatSvg(28)} Claude Chef</a>
    <nav><a href="/install.html">Install</a><a href="/about.html">About</a><a href="/contribute.html">Contribute</a></nav>
  </header>`;
}

export interface RecipePageOptions {
  enrichment?: EnrichmentResult | null;
  affiliateLinks?: AffiliateLink[] | null;
  cookModePrompt?: string | null;
  breadcrumbJsonLd?: BreadcrumbJsonLd | null;
  pairings?: ParsedRecipe[] | null;
  categoryBreadcrumb?: { name: string; slug: string } | null;
}

function formatQuantityDisplay(qty: number): string {
  const FRACTIONS: Record<string, string> = {
    '0.125': '\u215B', '0.2': '\u2155', '0.25': '\u00BC',
    '0.333': '\u2153', '0.5': '\u00BD', '0.667': '\u2154', '0.75': '\u00BE',
  };
  const whole = Math.floor(qty);
  const frac = qty - whole;
  const key = frac.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const sym = FRACTIONS[key] || '';
  if (whole === 0 && sym) return sym;
  if (whole > 0 && sym) return `${whole}${sym}`;
  if (frac === 0) return `${whole}`;
  return qty % 1 === 0 ? `${qty}` : qty.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function renderIngredientsHtml(ingredients: string[]): string {
  const items = ingredients.map(line => {
    const parsed = parseIngredient(line);
    if (parsed.quantity !== null) {
      const qtyDisplay = formatQuantityDisplay(parsed.quantity);
      const unitPart = parsed.unit ? ` ${parsed.unit}` : '';
      const descPart = parsed.description ? ` ${parsed.description}` : '';
      return `  <li class="ingredient" data-base-qty="${parsed.quantity}" data-unit="${parsed.unit}"><span class="ingredient-qty">${qtyDisplay}</span>${unitPart}${descPart}</li>`;
    }
    return `  <li class="ingredient">${parsed.original}</li>`;
  }).join('\n');
  return `<h2>Ingredients</h2>\n<ul class="ingredient-list">\n${items}\n</ul>`;
}

function renderBodyWithoutIngredients(body: string): string {
  let stripped = body.replace(/##\s+Ingredients\s*\n[\s\S]*?(?=\n##\s|$)/, '');
  // Also strip FAQ section — it's rendered separately with structured data
  stripped = stripped.replace(/##\s+Frequently Asked Questions\s*\n[\s\S]*?(?=\n##\s(?!#)|$)/, '');
  return marked.parse(sanitizeContent(stripped)) as string;
}

/**
 * Render FAQ section with accordion-style Q&A pairs.
 */
function renderFAQSection(faqs: FAQ[]): string {
  if (!faqs || faqs.length === 0) return '';

  const items = faqs.map(faq => `
      <details class="faq-item">
        <summary class="faq-question">${faq.question}</summary>
        <div class="faq-answer">${faq.answer}</div>
      </details>`).join('');

  return `
    <section class="faq-section" aria-label="Frequently Asked Questions">
      <h2>Frequently Asked Questions</h2>${items}
    </section>`;
}

/**
 * Render a single recipe page as full HTML.
 */
export function renderRecipePage(
  recipe: ParsedRecipe,
  jsonLd: RecipeJsonLd,
  commitHash: string,
  options: RecipePageOptions = {}
): string {
  const { enrichment = null, affiliateLinks = null, cookModePrompt = null, breadcrumbJsonLd = null, pairings = null, categoryBreadcrumb = null } = options;
  const ingredientsHtml = renderIngredientsHtml(recipe.ingredients);
  const restBodyHtml = renderBodyWithoutIngredients(recipe.body);
  const jsonLdString = JSON.stringify(jsonLd);

  const shopSection = renderShopSection(enrichment, affiliateLinks);
  const gearSection = renderGearSection(enrichment, affiliateLinks);
  const cookModeSection = renderCookModeSection(cookModePrompt);
  const pairingsSection = renderPairingsSection(pairings);
  const faqSection = renderFAQSection(recipe.faqs);
  const faqJsonLd = generateFAQPageJsonLd(recipe.faqs);

  const canonicalUrl = `${BASE_URL}/${recipe.slug}.html`;
  const ogImage = recipe.frontmatter.image || DEFAULT_OG_IMAGE;

  const breadcrumbScript = breadcrumbJsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>`
    : '';
  const faqScript = faqJsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>`
    : '';

  const prepDisplay = formatDuration(recipe.frontmatter.prep_time);
  const cookDisplay = formatDuration(recipe.frontmatter.cook_time);

  let visualBreadcrumb = '';
  if (categoryBreadcrumb) {
    visualBreadcrumb = `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <a href="/category/${categoryBreadcrumb.slug}.html">${categoryBreadcrumb.name}</a> <span class="breadcrumb-sep">/</span> <span>${recipe.frontmatter.title}</span></nav>`;
  }

  // Build byline with author + quick stats
  const authorSlug = toSlug(recipe.frontmatter.author);
  const authorLink = authorSlug
    ? `By <a href="/author/${authorSlug}.html">${recipe.frontmatter.author}</a>`
    : `By ${recipe.frontmatter.author}`;
  const bylineHtml = `<p class="recipe-byline">${authorLink} · Prep ${prepDisplay} · Cook ${cookDisplay} · <span class="calories-value">${recipe.frontmatter.calories}</span> cal/serving</p>`;

  // Build linked taxonomy pills grouped by type, with skill badge first
  const tagPills: string[] = [];
  if (recipe.frontmatter.skill_level) {
    const skillSlug = toSlug(recipe.frontmatter.skill_level);
    tagPills.push(`<a class="meta-pill skill-badge ${skillSlug}" href="/skill_level/${skillSlug}.html">${recipe.frontmatter.skill_level}</a>`);
  }
  const pillConfigs: { type: string; values: string[] }[] = [
    { type: 'category', values: recipe.frontmatter.recipe_category ? [recipe.frontmatter.recipe_category] : [] },
    { type: 'cuisine', values: recipe.frontmatter.cuisine ? [recipe.frontmatter.cuisine] : [] },
    { type: 'ingredient', values: recipe.frontmatter.recipe_ingredients || [] },
    { type: 'allergy', values: recipe.frontmatter.allergies || [] },
    { type: 'flavor', values: recipe.frontmatter.flavors || [] },
    { type: 'sauce', values: recipe.frontmatter.sauces || [] },
    { type: 'tool', values: recipe.frontmatter.tools || [] },
  ];
  for (const { type, values } of pillConfigs) {
    for (const value of values) {
      const slug = toSlug(value);
      if (slug) {
        tagPills.push(`<a class="meta-pill tax-${type}" href="/${type}/${slug}.html">${value}</a>`);
      }
    }
  }
  const taxonomyPillsHtml = tagPills.length > 0 ? '\n    ' + tagPills.join('\n    ') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(recipe.frontmatter.title)} | Claude Chef</title>
  <meta name="description" content="${escapeAttr(recipe.frontmatter.description)}">
  <meta name="robots" content="index, follow">
  <meta name="author" content="${escapeAttr(recipe.frontmatter.author)}">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="Claude Chef">
  <meta property="og:title" content="${escapeAttr(recipe.frontmatter.title)}">
  <meta property="og:description" content="${escapeAttr(recipe.frontmatter.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${ogImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(recipe.frontmatter.title)}">
  <meta name="twitter:description" content="${escapeAttr(recipe.frontmatter.description)}">
  <meta name="twitter:image" content="${ogImage}">
  ${googleFonts()}
  <script type="application/ld+json">${jsonLdString}</script>${breadcrumbScript}${faqScript}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to recipe</a>
  ${renderHeader('recipe')}
  <main id="main-content">
    ${visualBreadcrumb}<h1>${recipe.frontmatter.title}</h1>${bylineHtml}${taxonomyPillsHtml ? `\n    <div class="recipe-tags">${taxonomyPillsHtml}\n    </div>` : ``}
    <div class="servings-slider" aria-label="Adjust servings">
      <label class="servings-label" for="servings-range">Servings</label>
      <button class="servings-btn" data-dir="-" aria-label="Decrease servings">&minus;</button>
      <input type="range" id="servings-range" class="servings-range" min="1" max="${Math.max(recipe.frontmatter.servings * 4, 20)}" value="${recipe.frontmatter.servings}">
      <button class="servings-btn" data-dir="+" aria-label="Increase servings">&plus;</button>
      <input type="number" class="servings-input" min="1" max="99" value="${recipe.frontmatter.servings}" aria-label="Servings count">
    </div>
    <article data-base-servings="${recipe.frontmatter.servings}" data-base-calories="${recipe.frontmatter.calories}">
  ${ingredientsHtml}
  ${restBodyHtml}</article>${shopSection}${gearSection}${cookModeSection}${pairingsSection}${faqSection}
    <div class="share-bar">
      <span class="share-label">Share this recipe</span>
      <button class="share-btn" data-share aria-label="Share recipe" data-url="${canonicalUrl}" data-title="${escapeAttr(recipe.frontmatter.title)}" data-text="${escapeAttr(recipe.frontmatter.description)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span>Share</span></button>
      <button class="share-btn" data-copy-link aria-label="Copy link to recipe" data-url="${canonicalUrl}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>Copy link</span></button>
    </div>
    <div class="git-meta">
      <a class="git-btn" href="${REPO_URL}">git clone</a>
      <span>${commitHash}</span>
    </div>${recipe.frontmatter.source_url ? `
    <footer class="recipe-source">
      <sup>[1]</sup> Original recipe: <a href="${escapeAttr(recipe.frontmatter.source_url)}" rel="noopener" target="_blank">${escapeAttr(recipe.frontmatter.source_url)}</a>
    </footer>` : ''}
  </main>
${footerCta()}
<script src="/main.js"></script>
</body>
</html>`;
}

export function formatDuration(iso: string): string {
  const hours = iso.match(/(\d+)H/);
  const minutes = iso.match(/(\d+)M/);
  const parts: string[] = [];
  if (hours) parts.push(`${hours[1]}hr`);
  if (minutes && minutes[1] !== '0') parts.push(`${minutes[1]}min`);
  if (parts.length === 0) return '0min';
  return parts.join(' ');
}

export interface RecipeCardOptions {
  absoluteHref?: boolean;
  favorite?: boolean;
}

export function renderRecipeCard(recipe: ParsedRecipe, options: RecipeCardOptions = {}): string {
  const { absoluteHref = false, favorite = false } = options;
  const href = absoluteHref ? `/${recipe.slug}.html` : `${recipe.slug}.html`;
  const favoriteClass = favorite ? ' favorite' : '';

  const metaPills: string[] = [];

  // Conditional: skill level badge
  if (recipe.frontmatter.skill_level) {
    const level = recipe.frontmatter.skill_level;
    const levelSlug = toSlug(level);
    metaPills.push(`<a class="skill-badge ${levelSlug}" href="/skill_level/${levelSlug}.html">${level}</a>`);
  }

  // Conditional: cuisine pill
  if (recipe.frontmatter.cuisine) {
    const cuisine = recipe.frontmatter.cuisine;
    const cuisineSlug = toSlug(cuisine);
    metaPills.push(`<a class="meta-pill tax-cuisine" href="/cuisine/${cuisineSlug}.html">${cuisine}</a>`);
  }

  // Conditional: category pill
  if (recipe.frontmatter.recipe_category) {
    const category = recipe.frontmatter.recipe_category;
    const categorySlug = toSlug(category);
    metaPills.push(`<a class="meta-pill tax-category" href="/category/${categorySlug}.html">${category}</a>`);
  }

  // Always-present: prep time, cook time, calories
  metaPills.push(`<span class="meta-pill meta-info">Prep ${formatDuration(recipe.frontmatter.prep_time)}</span>`);
  metaPills.push(`<span class="meta-pill meta-info">Cook ${formatDuration(recipe.frontmatter.cook_time)}</span>`);
  metaPills.push(`<span class="meta-pill meta-info">${recipe.frontmatter.calories} cal</span>`);

  return `<li class="recipe-card${favoriteClass}">
        <a href="${href}">${recipe.frontmatter.title}</a>
        <div class="desc">${recipe.frontmatter.description}</div>
        <div class="card-meta">
          ${metaPills.join('\n          ')}
        </div>
      </li>`;
}

const PROVIDER_DOMAINS: Record<string, string> = {
  Amazon: 'amazon.com',
  Walmart: 'walmart.com',
};

function affiliateLinkHtml(l: AffiliateLink): string {
  const domain = PROVIDER_DOMAINS[l.provider] || new URL(l.url).hostname;
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  return `<a class="affiliate-link" href="${l.url}" target="_blank" rel="noopener" title="Buy on ${l.provider}"><img src="${favicon}" alt="${l.provider}" width="16" height="16"></a>`;
}

function renderBuyAllActions(links: AffiliateLink[], listLabel: string): string {
  const providerUrls = new Map<string, string[]>();
  for (const link of links) {
    const urls = providerUrls.get(link.provider) || [];
    urls.push(link.url);
    providerUrls.set(link.provider, urls);
  }

  const buyAllButtons = Array.from(providerUrls.entries())
    .map(([provider, urls]) => {
      const domain = PROVIDER_DOMAINS[provider] || provider.toLowerCase() + '.com';
      const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      const urlsAttr = JSON.stringify(urls).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return `<button class="share-btn" data-buy-all data-provider="${provider}" data-urls="${urlsAttr}"><img src="${favicon}" alt="" width="14" height="14"><span>Buy all on ${provider}</span></button>`;
    })
    .join('\n        ');

  return `
      <div class="buy-all-actions">
        <button class="share-btn" data-copy-list aria-label="Copy ${listLabel} to clipboard"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy list</span></button>
        ${buyAllButtons}
      </div>`;
}

function renderShopSection(
  enrichment: EnrichmentResult | null,
  affiliateLinks: AffiliateLink[] | null
): string {
  if (!enrichment || !affiliateLinks || affiliateLinks.length === 0) return '';

  const ingredientTerms = new Set(enrichment.ingredients.map(i => i.searchTerm));
  const ingredientLinks = affiliateLinks.filter(l => ingredientTerms.has(l.term));
  if (ingredientLinks.length === 0) return '';

  const byTerm = new Map<string, AffiliateLink[]>();
  for (const link of ingredientLinks) {
    const existing = byTerm.get(link.term) || [];
    existing.push(link);
    byTerm.set(link.term, existing);
  }

  const termToIngredient = new Map<string, string>();
  for (const ing of enrichment.ingredients) {
    termToIngredient.set(ing.searchTerm, ing.ingredient);
  }

  const items = Array.from(byTerm.entries())
    .map(([term, links]) => {
      const name = termToIngredient.get(term) || term;
      const linkHtml = links.map(affiliateLinkHtml).join(' ');
      return `<li><span class="ingredient-name">${name}</span><div class="affiliate-links">${linkHtml}</div></li>`;
    })
    .join('\n      ');

  const buyAllActions = renderBuyAllActions(ingredientLinks, 'ingredient list');

  return `
    <div class="shop-section card">
      <h2>Shop Ingredients</h2><p class="affiliate-disclosure">(paid links)</p>${buyAllActions}
      <ul>
      ${items}
      </ul>
    </div>`;
}

function renderGearSection(
  enrichment: EnrichmentResult | null,
  affiliateLinks: AffiliateLink[] | null
): string {
  if (!enrichment || !enrichment.gear || enrichment.gear.length === 0) return '';

  const gearTerms = new Set(enrichment.gear.map(g => g.searchTerm));
  const gearLinks = affiliateLinks ? affiliateLinks.filter(l => gearTerms.has(l.term)) : [];

  const byTerm = new Map<string, AffiliateLink[]>();
  for (const link of gearLinks) {
    const existing = byTerm.get(link.term) || [];
    existing.push(link);
    byTerm.set(link.term, existing);
  }

  const items = enrichment.gear
    .map(g => {
      const links = byTerm.get(g.searchTerm) || [];
      const linkHtml = links.map(affiliateLinkHtml).join(' ');
      return `<li><span class="gear-name">${g.name}</span>${linkHtml ? `<div class="affiliate-links">${linkHtml}</div>` : ''}</li>`;
    })
    .join('\n      ');

  const buyAllActions = renderBuyAllActions(gearLinks, 'gear list');

  return `
    <div class="gear-section card">
      <h2>Gear</h2><p class="affiliate-disclosure">(paid links)</p>${buyAllActions}
      <ul>
      ${items}
      </ul>
    </div>`;
}

function renderCookModeSection(cookModePrompt: string | null): string {
  if (!cookModePrompt) return '';

  const escaped = cookModePrompt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `
    <div class="cook-mode card">
      <h2>Cook with AI</h2>
      <p>Copy this prompt into Claude or your favorite AI assistant for hands-free, step-by-step guidance while you cook.</p>
      <div class="cook-mode-box">
        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent).then(()=>{this.textContent='Copied!'})">Copy</button>
        <div class="cook-mode-prompt">${escaped}</div>
      </div>
    </div>`;
}

function renderPairingsSection(pairings: ParsedRecipe[] | null): string {
  if (!pairings || pairings.length === 0) return '';

  const items = pairings
    .map(p => `<li class="pairing-item"><a href="${p.slug}.html"><span class="pairing-title">${p.frontmatter.title}</span><span class="pairing-desc">${p.frontmatter.description}</span></a></li>`)
    .join('\n      ');

  return `
    <div class="pairings-section card">
      <h2>Suggested Pairings</h2>
      <ul>
      ${items}
      </ul>
    </div>`;
}

export interface IndexPageOptions {
  webSiteJsonLd?: WebSiteJsonLd | null;
  itemListJsonLd?: ItemListJsonLd | null;
  taxonomies?: Taxonomy[] | null;
  favoriteSlugs?: string[] | null;
}

/**
 * Render the index page listing all recipes.
 */
export function renderIndexPage(recipes: ParsedRecipe[], options: IndexPageOptions = {}): string {
  const { webSiteJsonLd = null, itemListJsonLd = null, taxonomies = null, favoriteSlugs = null } = options;

  const favoriteSet = new Set(favoriteSlugs || []);
  const CARDS_PER_CATEGORY = 4;

  const indexDescription = 'Delicious recipes with AI-powered cooking guidance. Step-by-step technique, smart substitutions, and real-time coaching from Claude Chef.';
  const canonicalUrl = `${BASE_URL}/index.html`;

  let structuredDataScripts = '';
  if (webSiteJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(webSiteJsonLd)}</script>`;
  }
  if (itemListJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>`;
  }

  // Build "Browse by" pill section for all taxonomy types
  let browseSection = '';
  if (taxonomies && taxonomies.length > 0) {
    const browseOrder = ['category', 'cuisine', 'ingredient', 'allergy', 'flavor', 'sauce', 'tool', 'skill_level', 'author'];
    const sorted = [...taxonomies].sort((a, b) => {
      const ai = browseOrder.indexOf(a.type);
      const bi = browseOrder.indexOf(b.type);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    const pills = sorted
      .filter(t => t.entries.length > 0)
      .map(t => `<a class="browse-pill tax-${t.type}" href="/${t.type}/index.html">${t.label}</a>`)
      .join('\n        ');
    if (pills) {
      browseSection = `
    <div class="browse-section">
      <h2>Browse Recipes</h2>
      <div class="browse-pills">
        ${pills}
      </div>
    </div>`;
    }
  }

  // Build favorites section
  const favoriteRecipes = recipes.filter(r => favoriteSet.has(r.slug));
  let favoritesSection = '';
  if (favoriteRecipes.length > 0) {
    const favItems = favoriteRecipes
      .map(r => renderRecipeCard(r, { favorite: true }))
      .join('\n      ');
    favoritesSection = `
    <section class="favorites-section">
      <h2>Our Favorites</h2>
      <ul class="recipe-grid">
        ${favItems}
      </ul>
      <p class="section-link"><a href="/favorites.html">View all favorites &rarr;</a></p>
    </section>`;
  }

  // Build category showcase sections — show top N recipes per category
  let categorySections = '';
  if (taxonomies) {
    const categoryTax = taxonomies.find(t => t.type === 'category');
    if (categoryTax) {
      // Sort categories by recipe count descending
      const sortedEntries = [...categoryTax.entries].sort((a, b) => b.recipes.length - a.recipes.length);
      categorySections = sortedEntries.map(entry => {
        const preview = entry.recipes.slice(0, CARDS_PER_CATEGORY);
        const cards = preview
          .map(r => renderRecipeCard(r, { absoluteHref: true, favorite: favoriteSet.has(r.slug) }))
          .join('\n        ');
        return `
    <section class="category-showcase">
      <h2><a href="/category/${entry.slug}.html">${entry.name}</a> <span class="category-count">${entry.recipes.length} recipes</span></h2>
      <ul class="recipe-grid">
        ${cards}
      </ul>
      <p class="section-link"><a href="/category/${entry.slug}.html">See all ${entry.name} recipes &rarr;</a></p>
    </section>`;
      }).join('\n');
    }
  }

  // Build cuisine highlights — top 6 cuisines as pills with counts
  let cuisineHighlights = '';
  if (taxonomies) {
    const cuisineTax = taxonomies.find(t => t.type === 'cuisine');
    if (cuisineTax && cuisineTax.entries.length > 0) {
      const topCuisines = [...cuisineTax.entries]
        .sort((a, b) => b.recipes.length - a.recipes.length)
        .slice(0, 8);
      const cuisinePills = topCuisines
        .map(e => `<a class="browse-pill tax-cuisine" href="/cuisine/${e.slug}.html">${e.name} <span class="cuisine-count">(${e.recipes.length})</span></a>`)
        .join('\n        ');
      cuisineHighlights = `
    <section class="cuisine-highlights">
      <h2>Popular Cuisines</h2>
      <div class="browse-pills">
        ${cuisinePills}
      </div>
      <p class="section-link"><a href="/cuisine/index.html">View all cuisines &rarr;</a></p>
    </section>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${recipes.length.toLocaleString()} Recipes with AI-Powered Cooking Guidance | Claude Chef</title>
  <meta name="description" content="${indexDescription}">
  <meta name="robots" content="index, follow">
  <meta name="author" content="Claude Chef Community">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="Claude Chef">
  <meta property="og:title" content="${recipes.length.toLocaleString()} Recipes with AI-Powered Cooking Guidance | Claude Chef">
  <meta property="og:description" content="${indexDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${recipes.length.toLocaleString()} Recipes with AI-Powered Cooking Guidance | Claude Chef">
  <meta name="twitter:description" content="${indexDescription}">
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">${structuredDataScripts}
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('index')}
  <main id="main-content">
    <div class="hero">
      <h1>${recipes.length.toLocaleString()} Recipes &amp; Counting</h1>
      <p class="hero-tagline">Explore ${recipes.length.toLocaleString()} delicious, tested recipes with AI-powered cooking guidance. Every dish comes with step-by-step coaching so your next meal is your best one yet.</p>
      <p class="hero-cta"><a href="/contribute.html">Contribute a recipe!</a></p>
    </div>${browseSection}${favoritesSection}${categorySections}${cuisineHighlights}
    <p style="text-align:center;margin-top:2rem;color:var(--color-text-secondary)">Have a favorite recipe? Help us grow beyond ${recipes.length.toLocaleString()}! <a href="/contribute.html">Share it with the community</a></p>
  </main>
${footerCta()}
</body>
</html>`;
}

export interface HubPageOptions {
  collectionPageJsonLd?: CollectionPageJsonLd | null;
  breadcrumbJsonLd?: BreadcrumbJsonLd | null;
  favoriteSlugs?: string[] | null;
  pagination?: PaginationInfo | null;
  descriptions?: TaxonomyDescriptions | null;
}

/**
 * Render a hub page for a single taxonomy entry (e.g., /category/main-course.html).
 */
export function renderHubPage(
  type: TaxonomyType,
  labelSingular: string,
  entry: TaxonomyEntry,
  options: HubPageOptions = {},
  label?: string
): string {
  const { collectionPageJsonLd = null, breadcrumbJsonLd = null, favoriteSlugs = null, pagination = null, descriptions = null } = options;

  const favoriteSet = new Set(favoriteSlugs || []);

  // Determine canonical URL (page 2+ gets -page-N suffix)
  const canonicalSlug = pagination && pagination.currentPage > 1
    ? `${entry.slug}-page-${pagination.currentPage}`
    : entry.slug;
  const canonicalUrl = `${BASE_URL}/${type}/${canonicalSlug}.html`;

  const totalCount = entry.recipes.length;

  // Use descriptions when available, with generic fallbacks
  const h1Title = descriptions ? descriptions.hubTitle(entry.name) : `${entry.name} Recipes`;
  const pageTitle = `${totalCount} ${h1Title} | Claude Chef`;
  const pageDescription = descriptions
    ? descriptions.hubMetaDescription(entry.name)
    : `Browse ${totalCount} ${entry.name.toLowerCase()} recipes from Claude Chef.`;

  // Subheading
  let subheading: string;
  if (descriptions && pagination && pagination.totalPages > 1) {
    subheading = descriptions.hubSubheading(entry.name, totalCount, pagination.startIndex + 1, pagination.endIndex);
  } else if (descriptions) {
    subheading = descriptions.hubSubheading(entry.name, totalCount);
  } else {
    subheading = `${totalCount} recipe${totalCount === 1 ? '' : 's'}`;
  }

  let structuredDataScripts = '';
  if (collectionPageJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(collectionPageJsonLd)}</script>`;
  }
  if (breadcrumbJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>`;
  }

  // Slice recipes for current page when paginated
  const displayRecipes = pagination
    ? entry.recipes.slice(pagination.startIndex, pagination.endIndex)
    : entry.recipes;

  const recipeItems = displayRecipes
    .map(r => renderRecipeCard(r, { absoluteHref: true, favorite: favoriteSet.has(r.slug) }))
    .join('\n    ');

  // Pagination nav
  let paginationNav = '';
  if (pagination && pagination.totalPages > 1) {
    const prevLink = pagination.prevUrl
      ? `<a class="pagination-link" href="${pagination.prevUrl}">&laquo; Prev</a>`
      : `<span class="pagination-link disabled">&laquo; Prev</span>`;
    const nextLink = pagination.nextUrl
      ? `<a class="pagination-link" href="${pagination.nextUrl}">Next &raquo;</a>`
      : `<span class="pagination-link disabled">Next &raquo;</span>`;

    const pageLinks: string[] = [];
    for (let p = 1; p <= pagination.totalPages; p++) {
      if (p === pagination.currentPage) {
        pageLinks.push(`<span class="pagination-current">${p}</span>`);
      } else {
        const url = p === 1 ? `/${type}/${entry.slug}.html` : `/${type}/${entry.slug}-page-${p}.html`;
        pageLinks.push(`<a class="pagination-link" href="${url}">${p}</a>`);
      }
    }

    paginationNav = `
    <nav class="pagination" aria-label="Pagination">
      ${prevLink}
      ${pageLinks.join('\n      ')}
      ${nextLink}
    </nav>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">${structuredDataScripts}
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('hub')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <a href="/${type}/index.html">${label || (labelSingular === 'Category' ? 'Categories' : labelSingular === 'Cuisine' ? 'Cuisines' : labelSingular)}</a> <span class="breadcrumb-sep">/</span> <span>${entry.name}</span></nav>
    <div class="taxonomy-header">
      <h1>${h1Title}</h1>
      <p>${subheading}</p>
    </div>
    <ul class="recipe-grid">
      ${recipeItems}
    </ul>${paginationNav}
  </main>
${footerCta()}
</body>
</html>`;
}

export interface TaxonomyIndexPageOptions {
  itemListJsonLd?: ItemListJsonLd | null;
  breadcrumbJsonLd?: BreadcrumbJsonLd | null;
}

/**
 * Render a taxonomy index page (e.g., /category/index.html).
 */
export function renderTaxonomyIndexPage(
  taxonomy: Taxonomy,
  options: TaxonomyIndexPageOptions = {}
): string {
  const { itemListJsonLd = null, breadcrumbJsonLd = null } = options;

  const canonicalUrl = `${BASE_URL}/${taxonomy.type}/index.html`;
  const totalEntries = taxonomy.entries.length;
  const pageTitle = `${totalEntries} ${taxonomy.label} | Claude Chef`;
  const pageDescription = taxonomy.descriptions
    ? taxonomy.descriptions.indexDescription
    : `Browse all ${totalEntries} ${taxonomy.label.toLowerCase()} on Claude Chef.`;

  let structuredDataScripts = '';
  if (itemListJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>`;
  }
  if (breadcrumbJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>`;
  }

  // For large taxonomies (100+ entries), use alphabetical directory layout
  const LARGE_THRESHOLD = 50;
  const isLarge = totalEntries > LARGE_THRESHOLD;

  let bodyContent: string;

  if (isLarge) {
    // Sort entries by recipe count for "popular" section
    const byCount = [...taxonomy.entries].sort((a, b) => b.recipes.length - a.recipes.length);
    const popular = byCount.slice(0, 12);
    const popularItems = popular
      .map(e => `<li class="taxonomy-card">
          <a href="/${taxonomy.type}/${e.slug}.html">${e.name}</a>
          <span class="taxonomy-count">${e.recipes.length}</span>
        </li>`)
      .join('\n      ');

    // Group entries by letter to get counts
    const byLetter = new Map<string, number>();
    for (const e of taxonomy.entries) {
      const letter = (e.name[0] || '#').toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      byLetter.set(key, (byLetter.get(key) || 0) + 1);
    }
    const sortedLetters = [...byLetter.keys()].sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b));

    // Letter nav linking to separate letter pages
    const letterNav = sortedLetters
      .map(l => {
        const slug = l === '#' ? 'other' : l.toLowerCase();
        const count = byLetter.get(l) || 0;
        return `<a href="/${taxonomy.type}/letter-${slug}.html" class="letter-link">${l} <span class="letter-count">(${count})</span></a>`;
      })
      .join('');

    bodyContent = `
    <section class="popular-section">
      <h2>Most Popular</h2>
      <ul class="taxonomy-grid">
        ${popularItems}
      </ul>
    </section>
    <section class="alpha-directory">
      <h2>Browse by Letter</h2>
      <nav class="letter-nav" aria-label="Browse by letter">${letterNav}</nav>
    </section>`;
  } else {
    // Small taxonomy: use the original card grid
    const entryItems = taxonomy.entries
      .map(
        e => `<li class="taxonomy-card">
          <a href="/${taxonomy.type}/${e.slug}.html">${e.name}</a>
          <span class="taxonomy-count">${e.recipes.length}</span>
        </li>`
      )
      .join('\n      ');
    bodyContent = `
    <ul class="taxonomy-grid">
      ${entryItems}
    </ul>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">${structuredDataScripts}
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('hub')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <span>${taxonomy.label}</span></nav>
    <div class="taxonomy-header">
      <h1>${totalEntries.toLocaleString()} ${taxonomy.label}</h1>
      <p>${pageDescription}</p>
    </div>${bodyContent}
  </main>
${footerCta()}
</body>
</html>`;
}

/** Group taxonomy entries by first letter. Returns sorted Map. */
export function groupEntriesByLetter(entries: TaxonomyEntry[]): Map<string, TaxonomyEntry[]> {
  const byLetter = new Map<string, TaxonomyEntry[]>();
  for (const e of entries) {
    const letter = (e.name[0] || '#').toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!byLetter.has(key)) byLetter.set(key, []);
    byLetter.get(key)!.push(e);
  }
  // Sort each group by name
  for (const group of byLetter.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byLetter;
}

export interface LetterPageOptions {
  favoriteSlugs?: string[] | null;
}

/**
 * Render a letter page for a large taxonomy (e.g., /ingredient/letter-a.html).
 * Shows all entries starting with that letter as taxonomy cards.
 */
export function renderLetterPage(
  taxonomy: Taxonomy,
  letter: string,
  entries: TaxonomyEntry[],
  allLetters: string[],
  options: LetterPageOptions = {}
): string {
  const { favoriteSlugs = null } = options;
  const favoriteSet = new Set(favoriteSlugs || []);

  const letterSlug = letter === '#' ? 'other' : letter.toLowerCase();
  const letterDisplay = letter === '#' ? 'Other' : letter;
  const canonicalUrl = `${BASE_URL}/${taxonomy.type}/letter-${letterSlug}.html`;
  const pageTitle = `${taxonomy.labelSingular} starting with ${letterDisplay} | Claude Chef`;
  const pageDescription = `Browse ${entries.length} ${taxonomy.label.toLowerCase()} starting with "${letterDisplay}" on Claude Chef.`;

  // Letter nav
  const letterNav = allLetters
    .map(l => {
      const slug = l === '#' ? 'other' : l.toLowerCase();
      const isCurrent = l === letter;
      const cls = isCurrent ? 'letter-link current' : 'letter-link';
      return `<a href="/${taxonomy.type}/letter-${slug}.html" class="${cls}">${l}</a>`;
    })
    .join('');

  // Entry cards
  const entryItems = entries
    .map(e => `<li class="taxonomy-card">
        <a href="/${taxonomy.type}/${e.slug}.html">${e.name}</a>
        <span class="taxonomy-count">${e.recipes.length}</span>
      </li>`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('hub')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <a href="/${taxonomy.type}/index.html">${taxonomy.label}</a> <span class="breadcrumb-sep">/</span> <span>${letterDisplay}</span></nav>
    <div class="taxonomy-header">
      <h1>${taxonomy.label}: ${letterDisplay}</h1>
      <p>${entries.length} ${taxonomy.label.toLowerCase()} starting with "${letterDisplay}"</p>
    </div>
    <nav class="letter-nav" aria-label="Browse by letter">${letterNav}</nav>
    <ul class="taxonomy-grid">
      ${entryItems}
    </ul>
  </main>
${footerCta()}
</body>
</html>`;
}

function aboutStyles(): string {
  return `
    .about-hero {
      text-align: center;
      padding: 2rem 0 3rem;
    }
    .about-hero h1 { font-size: 2.75rem; margin-bottom: 1rem; }
    .about-intro {
      font-size: 1.125rem;
      color: var(--color-text-secondary);
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.7;
    }
    .about-section {
      margin: 2.5rem 0;
    }
    .about-feature p {
      color: var(--color-text-secondary);
    }
    .about-install {
      text-align: center;
      margin: 1.5rem 0;
    }
    .about-install pre {
      display: inline-block;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.8125rem;
      color: var(--color-primary);
    }
    .about-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1rem;
    }
  `;
}

/**
 * Render the About / How It Works page.
 */
export function renderAboutPage(): string {
  const canonicalUrl = `${BASE_URL}/about.html`;
  const pageTitle = 'How Claude Chef Works | Claude Chef';
  const pageDescription = 'Learn how Claude Chef provides AI-powered cooking guidance, smart ingredient shopping, gear recommendations, and recipe pairings.';

  const aboutPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: pageTitle,
    url: canonicalUrl,
    description: pageDescription,
    isPartOf: { '@type': 'WebSite', name: 'Claude Chef', url: BASE_URL },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/index.html` },
      { '@type': 'ListItem', position: 2, name: 'About' },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="Claude Chef">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">
  <script type="application/ld+json">${JSON.stringify(aboutPageJsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
  <style>${aboutStyles()}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('about')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <span>About</span></nav>
    <div class="about-hero">
      <h1>How Claude Chef Works</h1>
      <p class="about-intro">Claude Chef is an open-source recipe site powered by AI. Every recipe includes smart features to make your time in the kitchen easier and more enjoyable.</p>
    </div>
    <div class="about-section">
      <h2>Features</h2>
      <div class="card about-feature">
        <h2>Cook with AI</h2>
        <p>Each recipe includes a ready-made prompt you can paste into Claude or any AI assistant for hands-free, step-by-step cooking guidance.</p>
      </div>
      <div class="card about-feature">
        <h2>Smart Ingredient Shopping</h2>
        <p>Ingredient lists are enriched with one-click shopping links so you can order everything you need without leaving the page.</p>
      </div>
      <div class="card about-feature">
        <h2>Gear Recommendations</h2>
        <p>Recipes surface the tools and equipment you need, with links to trusted retailers.</p>
      </div>
      <div class="card about-feature">
        <h2>Recipe Pairings</h2>
        <p>Every dish suggests complementary recipes — sides, sauces, and desserts — so you can plan a complete meal.</p>
      </div>
      <div class="card about-feature">
        <h2>Browse by Category, Cuisine, Ingredients &amp; More</h2>
        <p>Recipes are organized into categories, cuisines, ingredients, allergies, flavors, sauces, tools, and skill levels so you can find exactly what you're craving.</p>
      </div>
    </div>
    <div class="about-section">
      <h2>CLI Plugin</h2>
      <p>Install Claude Chef as a Claude Code plugin for AI-powered cooking assistance right in your terminal.</p>
      <div class="about-install">
        <pre><code>/plugin marketplace add greynewell/claude-chef
/plugin install claude-chef</code></pre>
      </div>
    </div>
    <div class="about-section">
      <h2>Open Source</h2>
      <p>Claude Chef is fully open source. Clone the repo, add your own recipes, and <a href="/contribute.html">contribute back to the community</a>. Read the <a href="/docs.html">developer documentation</a> to understand the architecture, or check the <a href="/changelog.html">changelog</a> for what's new.</p>
      <div class="about-actions">
        <a class="git-btn" href="${REPO_URL}">git clone</a>
        <a class="git-btn" href="https://github.com/greynewell/claude-chef">GitHub</a>
        <a class="git-btn" href="/contribute.html">Contribute</a>
        <a class="git-btn" href="/docs.html">Developer Docs</a>
        <a class="git-btn" href="/changelog.html">Changelog</a>
      </div>
    </div>
    <div class="about-section">
      <h2>Recipe Data Attribution</h2>
      <p>A portion of the recipes on Claude Chef are sourced from the <a href="https://huggingface.co/datasets/Shengtao/recipe">Shengtao/recipe</a> dataset on HuggingFace, available under the <a href="https://opensource.org/licenses/MIT">MIT License</a>. We are grateful for open datasets that make projects like this possible.</p>
    </div>
  </main>
${footerCta()}
</body>
</html>`;
}

function contributeStyles(): string {
  return `
    .contribute-hero {
      text-align: center;
      padding: 2rem 0 3rem;
    }
    .contribute-hero h1 { font-size: 2.75rem; margin-bottom: 1rem; }
    .contribute-intro {
      font-size: 1.125rem;
      color: var(--color-text-secondary);
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.7;
    }
    .recipe-form {
      max-width: 720px;
      margin: 0 auto 2rem;
    }
    .form-section {
      margin-bottom: 2rem;
    }
    .form-section h2 {
      font-size: 1.375rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--color-border-light);
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-group label {
      display: block;
      font-weight: 600;
      font-size: 0.9375rem;
      margin-bottom: 0.35rem;
      color: var(--color-text);
    }
    .form-group .field-hint {
      display: block;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      margin-bottom: 0.35rem;
    }
    .form-group input[type="text"],
    .form-group input[type="number"],
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 0.6rem 0.75rem;
      font-size: 0.9375rem;
      font-family: inherit;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      color: var(--color-text);
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(91, 123, 94, 0.15);
    }
    .form-group textarea {
      resize: vertical;
      min-height: 100px;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
    }
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
    }
    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-weight: 400;
      font-size: 0.9375rem;
      cursor: pointer;
    }
    .checkbox-group input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color-primary);
    }
    .custom-entry {
      margin-top: 0.75rem;
    }
    .custom-entry input[type="text"] {
      width: 100%;
      padding: 0.6rem 0.75rem;
      font-size: 0.9375rem;
      font-family: inherit;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      color: var(--color-text);
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .custom-entry input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(91, 123, 94, 0.15);
    }
    .custom-entry .field-hint {
      display: block;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      margin-bottom: 0.35rem;
    }
    .time-inputs {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.5rem;
    }
    .time-inputs label {
      font-weight: 400;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      margin-bottom: 0.2rem;
    }
    .time-inputs input[type="number"] {
      width: 100%;
      padding: 0.6rem 0.75rem;
      font-size: 0.9375rem;
      font-family: inherit;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface);
      color: var(--color-text);
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .time-inputs input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(91, 123, 94, 0.15);
    }
    .optional-details {
      margin-bottom: 2rem;
    }
    .optional-details summary {
      font-family: 'DM Serif Display', serif;
      font-size: 1.375rem;
      cursor: pointer;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--color-border-light);
      margin-bottom: 1rem;
      color: var(--color-text);
      list-style: none;
    }
    .optional-details summary::-webkit-details-marker { display: none; }
    .optional-details summary::before {
      content: '\\25B6';
      display: inline-block;
      margin-right: 0.5rem;
      font-size: 0.75rem;
      transition: transform 0.15s;
    }
    .optional-details[open] summary::before {
      transform: rotate(90deg);
    }
    .optional-details .compact-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    @media (max-width: 600px) {
      .optional-details .compact-row { grid-template-columns: 1fr; }
    }
    .optional-details .form-section {
      margin-bottom: 1.25rem;
    }
    .optional-details .form-section h3 {
      font-family: 'Inter', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--color-text-secondary);
    }
    .optional-details .form-group {
      margin-bottom: 0.75rem;
    }
    .optional-details .checkbox-group {
      gap: 0.35rem 0.75rem;
    }
    .optional-details .custom-entry {
      margin-top: 0.5rem;
    }
    .form-submit {
      text-align: center;
      margin: 2rem 0;
    }
    .form-submit button {
      display: inline-block;
      background: var(--color-primary);
      color: #fff;
      border: none;
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .form-submit button:hover {
      background: var(--color-primary-dark);
    }
    .form-submit .submit-hint {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
    }
  `;
}

/**
 * Render the Contribute a Recipe page with a web form.
 * On submit, the form builds a GitHub issue URL with the recipe data pre-filled and redirects.
 */
export function renderContributePage(): string {
  const canonicalUrl = `${BASE_URL}/contribute.html`;
  const pageTitle = 'Contribute a Recipe | Claude Chef';
  const pageDescription = 'Submit your favorite recipes to Claude Chef using our easy recipe form.';

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageTitle,
    url: canonicalUrl,
    description: pageDescription,
    isPartOf: { '@type': 'WebSite', name: 'Claude Chef', url: BASE_URL },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/index.html` },
      { '@type': 'ListItem', position: 2, name: 'Contribute' },
    ],
  };

  const formScript = `
    document.getElementById('recipe-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var f = e.target;
      var val = function(id) { return (f.querySelector('#' + id) || {}).value || ''; };
      var numVal = function(id) { return parseInt((f.querySelector('#' + id) || {}).value, 10) || 0; };
      var checked = function(name) {
        var boxes = f.querySelectorAll('input[name="' + name + '"]:checked');
        var result = [];
        for (var i = 0; i < boxes.length; i++) result.push(boxes[i].value);
        return result;
      };
      var parseCustom = function(str) {
        if (!str) return [];
        return str.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      };
      var mergeWithCustom = function(checkedVals, customStr) {
        var custom = parseCustom(customStr);
        var seen = {};
        var result = [];
        for (var i = 0; i < checkedVals.length; i++) {
          var lower = checkedVals[i].toLowerCase();
          if (!seen[lower]) { seen[lower] = true; result.push(checkedVals[i]); }
        }
        for (var j = 0; j < custom.length; j++) {
          var lc = custom[j].toLowerCase();
          if (!seen[lc]) { seen[lc] = true; result.push(custom[j]); }
        }
        return result;
      };

      var buildDuration = function(h, m, s) {
        var parts = 'PT';
        if (h > 0) parts += h + 'H';
        if (m > 0) parts += m + 'M';
        if (s > 0) parts += s + 'S';
        if (parts === 'PT') parts = 'PT0M';
        return parts;
      };

      var title = val('title');
      var description = val('description');
      var author = val('author') || 'Claude Chef Community';
      var prepTime = buildDuration(numVal('prep_hours'), numVal('prep_minutes'), numVal('prep_seconds'));
      var cookTime = buildDuration(numVal('cook_hours'), numVal('cook_minutes'), numVal('cook_seconds'));
      var servings = val('servings');
      var calories = val('calories');
      var category = val('recipe_category');
      var cuisine = val('recipe_cuisine');
      var skillLevel = val('skill_level');
      var keywords = val('keywords');
      var recipeIngredients = val('recipe_ingredients');
      var ingredients = val('ingredients');
      var instructions = val('instructions');
      var notes = val('notes');
      var allergies = mergeWithCustom(checked('allergies'), val('custom_allergies'));
      var flavors = mergeWithCustom(checked('flavors'), val('custom_flavors'));
      var tools = mergeWithCustom(checked('tools'), val('custom_tools'));

      var toYamlArray = function(str) {
        if (!str) return '[]';
        var items = str.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        if (items.length === 0) return '[]';
        return '[' + items.map(function(s) { return '"' + s + '"'; }).join(', ') + ']';
      };
      var checkedToYaml = function(arr) {
        if (arr.length === 0) return '[]';
        return '[' + arr.map(function(s) { return '"' + s + '"'; }).join(', ') + ']';
      };

      var frontmatter = '---\\n';
      frontmatter += 'title: "' + title.replace(/"/g, '\\\\"') + '"\\n';
      frontmatter += 'description: "' + description.replace(/"/g, '\\\\"') + '"\\n';
      frontmatter += 'author: "' + author.replace(/"/g, '\\\\"') + '"\\n';
      frontmatter += 'prep_time: "' + prepTime + '"\\n';
      frontmatter += 'cook_time: "' + cookTime + '"\\n';
      frontmatter += 'servings: ' + (parseInt(servings, 10) || 4) + '\\n';
      frontmatter += 'calories: ' + (parseInt(calories, 10) || 0) + '\\n';
      if (category) frontmatter += 'recipe_category: "' + category + '"\\n';
      if (cuisine) frontmatter += 'recipe_cuisine: "' + cuisine + '"\\n';
      frontmatter += 'keywords: ' + toYamlArray(keywords) + '\\n';
      frontmatter += 'pairings: []\\n';
      frontmatter += 'recipe_ingredients: ' + toYamlArray(recipeIngredients) + '\\n';
      if (allergies.length > 0) frontmatter += 'allergies: ' + checkedToYaml(allergies) + '\\n';
      if (flavors.length > 0) frontmatter += 'flavors: ' + checkedToYaml(flavors) + '\\n';
      frontmatter += 'sauces: []\\n';
      if (tools.length > 0) frontmatter += 'tools: ' + checkedToYaml(tools) + '\\n';
      if (skillLevel) frontmatter += 'skill_level: "' + skillLevel + '"\\n';
      frontmatter += '---\\n';

      var body = '\\n## Ingredients\\n\\n';
      var ingredientLines = ingredients.split('\\n').filter(function(l) { return l.trim(); });
      for (var i = 0; i < ingredientLines.length; i++) {
        var line = ingredientLines[i].trim();
        body += (line.startsWith('-') ? line : '- ' + line) + '\\n';
      }

      body += '\\n## Instructions\\n\\n';
      var stepLines = instructions.split('\\n').filter(function(l) { return l.trim(); });
      for (var j = 0; j < stepLines.length; j++) {
        var step = stepLines[j].trim().replace(/^\\d+[\\.\\)]\\s*/, '');
        body += (j + 1) + '. ' + step + '\\n';
      }

      if (notes.trim()) {
        body += '\\n## Notes\\n\\n';
        var noteLines = notes.split('\\n').filter(function(l) { return l.trim(); });
        for (var k = 0; k < noteLines.length; k++) {
          var note = noteLines[k].trim();
          body += (note.startsWith('-') ? note : '- ' + note) + '\\n';
        }
      }

      var recipeMarkdown = frontmatter + body;

      var labels = ['recipe-submission'];
      if (category) labels.push(category.toLowerCase().replace(/\\s+/g, '-'));
      if (skillLevel) labels.push(skillLevel.toLowerCase());

      var issueTitle = 'Recipe Submission: ' + title;
      var issueBody = '## New Recipe Submission\\n\\n';
      issueBody += '**Submitted by:** ' + author + '\\n\\n';
      issueBody += '### Recipe File Content\\n\\n';
      issueBody += '\`\`\`markdown\\n' + recipeMarkdown + '\`\`\`\\n';

      var url = 'https://github.com/greynewell/claude-chef/issues/new';
      url += '?title=' + encodeURIComponent(issueTitle);
      url += '&body=' + encodeURIComponent(issueBody);
      url += '&labels=' + encodeURIComponent(labels.join(','));

      window.open(url, '_blank');
    });
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="Claude Chef">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">
  <script type="application/ld+json">${JSON.stringify(webPageJsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
  <style>${contributeStyles()}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('contribute')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <span>Contribute</span></nav>
    <div class="contribute-hero">
      <h1>Contribute a Recipe</h1>
      <p class="contribute-intro">Share your favorite recipes with the Claude Chef community. Fill out the form below and we'll open a GitHub issue with your recipe.</p>
      <div class="share-bar" style="justify-content:center;margin-top:1rem">
        <span class="share-label">Ask someone to share a recipe!</span>
        <button class="share-btn" data-share aria-label="Share contribute page" data-url="${canonicalUrl}" data-title="Contribute a Recipe to Claude Chef" data-text="Share your favorite recipes with the Claude Chef community."><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span>Share</span></button>
        <button class="share-btn" data-copy-link aria-label="Copy link to contribute page" data-url="${canonicalUrl}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>Copy link</span></button>
      </div>
    </div>
    <form id="recipe-form" class="recipe-form" novalidate>
      <div class="form-section">
        <h2>Basic Info</h2>
        <div class="form-group">
          <label for="title">Recipe Title</label>
          <input type="text" id="title" name="title" required placeholder="e.g. Teriyaki Chicken">
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <input type="text" id="description" name="description" required placeholder="A brief description of the dish">
        </div>
        <div class="form-group">
          <label for="author">Author</label>
          <input type="text" id="author" name="author" placeholder="Your name (defaults to Claude Chef Community)">
        </div>
      </div>
      <div class="form-section">
        <h2>Recipe Content</h2>
        <div class="form-group">
          <label for="ingredients">Ingredients</label>
          <span class="field-hint">One ingredient per line, e.g. "1 cup flour"</span>
          <textarea id="ingredients" name="ingredients" required rows="6" placeholder="1 cup flour&#10;2 tbsp butter&#10;1 tsp salt"></textarea>
        </div>
        <div class="form-group">
          <label for="instructions">Instructions</label>
          <span class="field-hint">One step per line</span>
          <textarea id="instructions" name="instructions" required rows="6" placeholder="Preheat oven to 375°F.&#10;Mix dry ingredients in a bowl.&#10;Bake for 25 minutes."></textarea>
        </div>
        <div class="form-group">
          <label for="notes">Notes</label>
          <span class="field-hint">Optional tips, variations, or storage instructions</span>
          <textarea id="notes" name="notes" rows="3" placeholder="Store in an airtight container for up to 3 days."></textarea>
        </div>
      </div>
      <details class="optional-details">
        <summary>Optional Details</summary>
        <div class="form-section">
          <h3>Time &amp; Servings</h3>
          <div class="compact-row">
            <div class="form-group">
              <label>Prep Time</label>
              <div class="time-inputs">
                <div><label for="prep_hours">H</label><input type="number" id="prep_hours" name="prep_hours" min="0" max="72" value="0"></div>
                <div><label for="prep_minutes">M</label><input type="number" id="prep_minutes" name="prep_minutes" min="0" max="59" value="15"></div>
                <div><label for="prep_seconds">S</label><input type="number" id="prep_seconds" name="prep_seconds" min="0" max="59" value="0"></div>
              </div>
            </div>
            <div class="form-group">
              <label>Cook Time</label>
              <div class="time-inputs">
                <div><label for="cook_hours">H</label><input type="number" id="cook_hours" name="cook_hours" min="0" max="72" value="0"></div>
                <div><label for="cook_minutes">M</label><input type="number" id="cook_minutes" name="cook_minutes" min="0" max="59" value="30"></div>
                <div><label for="cook_seconds">S</label><input type="number" id="cook_seconds" name="cook_seconds" min="0" max="59" value="0"></div>
              </div>
            </div>
          </div>
          <div class="compact-row">
            <div class="form-group">
              <label for="servings">Servings</label>
              <input type="number" id="servings" name="servings" min="1" placeholder="4">
            </div>
            <div class="form-group">
              <label for="calories">Calories per Serving</label>
              <input type="number" id="calories" name="calories" min="0" placeholder="350">
            </div>
          </div>
        </div>
        <div class="form-section">
          <h3>Classification</h3>
          <div class="compact-row">
            <div class="form-group">
              <label for="recipe_category">Category</label>
              <select id="recipe_category" name="recipe_category">
                <option value="">Select a category</option>
                <option value="Main Course">Main Course</option>
                <option value="Side Dish">Side Dish</option>
                <option value="Appetizer">Appetizer</option>
                <option value="Dessert">Dessert</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Snack">Snack</option>
                <option value="Beverage">Beverage</option>
                <option value="Soup">Soup</option>
                <option value="Salad">Salad</option>
              </select>
            </div>
            <div class="form-group">
              <label for="skill_level">Skill Level</label>
              <select id="skill_level" name="skill_level">
                <option value="">Select difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div class="compact-row">
            <div class="form-group">
              <label for="recipe_cuisine">Cuisine</label>
              <input type="text" id="recipe_cuisine" name="recipe_cuisine" placeholder="e.g. Italian, Japanese">
            </div>
            <div class="form-group">
              <label for="keywords">Keywords</label>
              <input type="text" id="keywords" name="keywords" placeholder="e.g. quick, weeknight">
            </div>
          </div>
          <div class="form-group">
            <label for="recipe_ingredients">Key Ingredients</label>
            <span class="field-hint">Comma-separated main ingredients for categorization</span>
            <input type="text" id="recipe_ingredients" name="recipe_ingredients" placeholder="e.g. Chicken, Teriyaki Sauce, Sesame Seeds">
          </div>
        </div>
        <div class="form-section">
          <h3>Allergens</h3>
          <div class="checkbox-group" data-field="allergies">
            <label><input type="checkbox" name="allergies" value="Dairy"> Dairy</label>
            <label><input type="checkbox" name="allergies" value="Gluten"> Gluten</label>
            <label><input type="checkbox" name="allergies" value="Soy"> Soy</label>
            <label><input type="checkbox" name="allergies" value="Sesame"> Sesame</label>
            <label><input type="checkbox" name="allergies" value="Nuts"> Nuts</label>
            <label><input type="checkbox" name="allergies" value="Eggs"> Eggs</label>
            <label><input type="checkbox" name="allergies" value="Shellfish"> Shellfish</label>
            <label><input type="checkbox" name="allergies" value="Fish"> Fish</label>
          </div>
          <div class="custom-entry"><span class="field-hint">Additional allergens (comma-separated)</span><input type="text" id="custom_allergies" name="custom_allergies" placeholder="e.g. Wheat, Peanuts"></div>
        </div>
        <div class="form-section">
          <h3>Flavors &amp; Tools</h3>
          <div class="checkbox-group" data-field="flavors">
            <label><input type="checkbox" name="flavors" value="Sweet"> Sweet</label>
            <label><input type="checkbox" name="flavors" value="Savory"> Savory</label>
            <label><input type="checkbox" name="flavors" value="Umami"> Umami</label>
            <label><input type="checkbox" name="flavors" value="Smoky"> Smoky</label>
            <label><input type="checkbox" name="flavors" value="Spicy"> Spicy</label>
            <label><input type="checkbox" name="flavors" value="Tangy"> Tangy</label>
            <label><input type="checkbox" name="flavors" value="Bitter"> Bitter</label>
          </div>
          <div class="custom-entry"><span class="field-hint">Additional flavors (comma-separated)</span><input type="text" id="custom_flavors" name="custom_flavors" placeholder="e.g. Citrusy, Herby"></div>
          <div class="checkbox-group" data-field="tools" style="margin-top:0.75rem">
            <label><input type="checkbox" name="tools" value="Oven"> Oven</label>
            <label><input type="checkbox" name="tools" value="Skillet"> Skillet</label>
            <label><input type="checkbox" name="tools" value="Baking Sheet"> Baking Sheet</label>
            <label><input type="checkbox" name="tools" value="Cutting Board"> Cutting Board</label>
            <label><input type="checkbox" name="tools" value="Mixing Bowl"> Mixing Bowl</label>
            <label><input type="checkbox" name="tools" value="Grill"> Grill</label>
            <label><input type="checkbox" name="tools" value="Blender"> Blender</label>
            <label><input type="checkbox" name="tools" value="Slow Cooker"> Slow Cooker</label>
          </div>
          <div class="custom-entry"><span class="field-hint">Additional tools (comma-separated)</span><input type="text" id="custom_tools" name="custom_tools" placeholder="e.g. Wok, Instant Pot"></div>
        </div>
      </details>
      <div class="form-submit">
        <button type="submit">Submit Recipe via GitHub</button>
        <span class="submit-hint">You'll be taken to GitHub to review and submit the issue.</span>
      </div>
    </form>
  </main>
${footerCta()}
  <script>${formScript}</script>
<script src="/main.js"></script>
</body>
</html>`;
}

function installStyles(): string {
  return `
    .install-hero {
      text-align: center;
      padding: 2rem 0 3rem;
    }
    .install-hero h1 { font-size: 2.75rem; margin-bottom: 1rem; }
    .install-intro {
      font-size: 1.125rem;
      color: var(--color-text-secondary);
      max-width: 560px;
      margin: 0 auto;
      line-height: 1.7;
    }
    .install-section {
      max-width: 720px;
      margin: 0 auto 2.5rem;
    }
    .install-section h2 {
      margin-bottom: 0.75rem;
    }
    .install-section h3 {
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      font-family: 'Inter', sans-serif;
      font-size: 1.0625rem;
      font-weight: 600;
    }
    .install-section p, .install-section li {
      line-height: 1.7;
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
    }
    .install-section ol {
      padding-left: 1.5rem;
      margin: 0.5rem 0;
    }
    .install-section li {
      margin-bottom: 0.35rem;
    }
    .install-section code {
      background: var(--color-bg);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    .install-section pre {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      margin: 0.75rem 0;
    }
    .install-section pre code {
      background: none;
      padding: 0;
      font-size: 0.8125rem;
    }
    .install-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .install-card h3:first-child { margin-top: 0; }
  `;
}

export function renderInstallPage(): string {
  const canonicalUrl = `${BASE_URL}/install.html`;
  const pageTitle = 'Install | Claude Chef';
  const pageDescription = 'Add Claude Chef to your phone as an app or install the Claude Code CLI plugin for terminal-based cooking assistance.';

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/index.html` },
      { '@type': 'ListItem', position: 2, name: 'Install' },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="Claude Chef">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">
  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
  <style>${installStyles()}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('install')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <span>Install</span></nav>
    <div class="install-hero">
      <h1>Install Claude Chef</h1>
      <p class="install-intro">Use Claude Chef as a mobile app on your phone or as a CLI plugin in your terminal.</p>
    </div>

    <div class="install-section">
      <h2>Mobile App (PWA)</h2>
      <p>Claude Chef works as a Progressive Web App \u2014 you can add it to your home screen and use it like a native app, complete with offline recipe browsing.</p>

      <div class="install-card">
        <h3>iPhone &amp; iPad (Safari)</h3>
        <ol>
          <li>Open <a href="https://claudechef.com">claudechef.com</a> in <strong>Safari</strong></li>
          <li>Tap the <strong>Share</strong> button (square with arrow) in the toolbar</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Tap <strong>"Add"</strong> in the top-right corner</li>
        </ol>
        <p>Claude Chef will appear on your home screen as a standalone app.</p>
      </div>

      <div class="install-card">
        <h3>Android (Chrome)</h3>
        <ol>
          <li>Open <a href="https://claudechef.com">claudechef.com</a> in <strong>Chrome</strong></li>
          <li>Tap the <strong>three-dot menu</strong> in the top-right corner</li>
          <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
          <li>Confirm by tapping <strong>"Install"</strong></li>
        </ol>
        <p>Chrome may also show an install banner automatically at the bottom of the screen.</p>
      </div>

      <div class="install-card">
        <h3>Desktop (Chrome, Edge)</h3>
        <ol>
          <li>Visit <a href="https://claudechef.com">claudechef.com</a></li>
          <li>Click the <strong>install icon</strong> in the address bar (right side)</li>
          <li>Click <strong>"Install"</strong> in the prompt</li>
        </ol>
        <p>The app will open in its own window and appear in your system's app launcher.</p>
      </div>
    </div>

    <div class="install-section">
      <h2>Claude Code CLI Plugin</h2>
      <p>If you use <a href="https://docs.anthropic.com/en/docs/claude-code">Claude Code</a>, you can install Claude Chef as a terminal plugin for recipe creation, enrichment, and submission.</p>

      <div class="install-card">
        <h3>Installation</h3>
        <pre><code># Add the Claude Chef marketplace
/plugin marketplace add greynewell/claude-chef

# Install the plugin
/plugin install claude-chef</code></pre>
        <p>Once installed, use the <code>/chef</code> command:</p>
        <pre><code># Create a new recipe interactively
/chef create "Teriyaki Chicken"

# Enrich a recipe with AI-generated tips and shopping data
/chef enrich teriyaki-chicken

# Submit/validate a recipe for contribution
/chef submit</code></pre>
      </div>

      <div class="install-card">
        <h3>From Source</h3>
        <pre><code>git clone https://github.com/greynewell/claude-chef.git
cd claude-chef
npm install
npm run build</code></pre>
        <p>See the <a href="/docs.html">developer docs</a> for the full build and contribution workflow.</p>
      </div>
    </div>
  </main>
${footerCta()}
</body>
</html>`;
}

function favoritesStyles(): string {
  return `
    .favorites-hero {
      text-align: center;
      padding: 2rem 0 3rem;
    }
    .favorites-hero h1 { font-size: 2.75rem; margin-bottom: 1rem; }
    .favorites-intro {
      font-size: 1.125rem;
      color: var(--color-text-secondary);
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.7;
    }
  `;
}

export interface FavoritesPageOptions {
  itemListJsonLd?: ItemListJsonLd | null;
  breadcrumbJsonLd?: BreadcrumbJsonLd | null;
}

/**
 * Render the Favorites page.
 */
export function renderFavoritesPage(recipes: ParsedRecipe[], options: FavoritesPageOptions = {}): string {
  const { itemListJsonLd = null, breadcrumbJsonLd = null } = options;

  const canonicalUrl = `${BASE_URL}/favorites.html`;
  const favCount = recipes.length;
  const pageTitle = favCount > 0 ? `Our ${favCount} Favorites | Claude Chef` : 'Our Favorites | Claude Chef';
  const pageDescription = favCount > 0
    ? `A curated collection of our ${favCount} favorite recipes from Claude Chef.`
    : 'A curated collection of our favorite recipes from Claude Chef.';

  let structuredDataScripts = '';
  if (itemListJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(itemListJsonLd)}</script>`;
  }
  if (breadcrumbJsonLd) {
    structuredDataScripts += `\n  <script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>`;
  }

  let recipeGrid: string;
  if (recipes.length === 0) {
    recipeGrid = `<p style="text-align:center;color:var(--color-text-secondary)">No favorites yet. Check back soon!</p>`;
  } else {
    const recipeItems = recipes
      .map(r => renderRecipeCard(r, { absoluteHref: true, favorite: true }))
      .join('\n    ');
    recipeGrid = `<ul class="recipe-grid">
      ${recipeItems}
    </ul>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#5B7B5E">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="Claude Chef">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}">${structuredDataScripts}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">
  ${googleFonts()}
  <link rel="stylesheet" href="/styles.css">
  <style>${favoritesStyles()}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader('favorites')}
  <main id="main-content">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/index.html">Home</a> <span class="breadcrumb-sep">/</span> <span>Favorites</span></nav>
    <div class="favorites-hero">
      <h1>Our ${favCount > 0 ? favCount + ' ' : ''}Favorites</h1>
      <p class="favorites-intro">A hand-picked selection of recipes we love. These are the dishes we come back to again and again.</p>
    </div>
    ${recipeGrid}
  </main>
${footerCta()}
</body>
</html>`;
}
