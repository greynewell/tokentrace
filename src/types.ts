export interface RecipeFrontmatter {
  title: string;
  description: string;
  author: string;
  prep_time: string;
  cook_time: string;
  servings: number;
  calories: number;
  keywords: string[];
  recipe_category?: string;
  cuisine?: string;
  image?: string;
  pairings?: string[];
  recipe_ingredients?: string[];
  allergies?: string[];
  flavors?: string[];
  sauces?: string[];
  tools?: string[];
  skill_level?: string;
  source_url?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface ParsedRecipe {
  frontmatter: RecipeFrontmatter;
  ingredients: string[];
  instructions: string[];
  faqs: FAQ[];
  body: string;
  slug: string;
  sourceFile: string;
}

export interface HowToStep {
  '@type': 'HowToStep';
  text: string;
  position: number;
}

export interface RecipeJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Recipe';
  name: string;
  url?: string;
  author: { '@type': 'Person' | 'Organization'; name: string; url?: string };
  datePublished: string;
  description: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  recipeYield: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  image?: string[];
  nutrition: { '@type': 'NutritionInformation'; calories: string };
  recipeIngredient: string[];
  recipeInstructions: HowToStep[];
  keywords: string;
  isRelatedTo?: { '@type': 'Recipe'; name: string; url: string }[];
}

export interface BreadcrumbJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: {
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }[];
}

export interface WebSiteJsonLd {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  description: string;
  publisher: { '@type': 'Organization'; name: string; url: string };
}

export interface ItemListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  name: string;
  description: string;
  numberOfItems: number;
  itemListElement: {
    '@type': 'ListItem';
    position: number;
    url: string;
    name: string;
  }[];
}

export type TaxonomyType = 'category' | 'cuisine' | 'ingredient' | 'flavor' | 'sauce' | 'tool' | 'skill_level' | 'author';

export interface TaxonomyDescriptions {
  hubTitle: (name: string) => string;
  hubMetaDescription: (name: string) => string;
  hubSubheading: (name: string, count: number, start?: number, end?: number) => string;
  indexDescription: string;
  collectionDescription: (name: string) => string;
}

export interface TaxonomyEntry {
  name: string;
  slug: string;
  recipes: ParsedRecipe[];
}

export interface Taxonomy {
  type: TaxonomyType;
  label: string;
  labelSingular: string;
  entries: TaxonomyEntry[];
  descriptions: TaxonomyDescriptions;
}

export interface CollectionPageJsonLd {
  '@context': 'https://schema.org';
  '@type': 'CollectionPage';
  name: string;
  url: string;
  description: string;
  mainEntity: {
    '@type': 'ItemList';
    numberOfItems: number;
    itemListElement: {
      '@type': 'ListItem';
      position: number;
      url: string;
      name: string;
    }[];
  };
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  priority: string;
  changefreq?: string;
}

export interface LintResult {
  file: string;
  errors: string[];
  warnings: string[];
}

export interface EnrichedRecipe extends ParsedRecipe {
  enrichment?: import('./enrichment/types').EnrichmentResult | null;
  affiliateLinks?: import('./affiliates/types').AffiliateLink[] | null;
}
