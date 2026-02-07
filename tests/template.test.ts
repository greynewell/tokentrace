import { renderRecipePage, renderIndexPage, renderHubPage, renderTaxonomyIndexPage, renderAboutPage, renderContributePage, renderFavoritesPage, renderRecipeCard, RECIPES_PER_PAGE, computePagination, baseStyles, mainScript } from '../src/generator/template';
import { ParsedRecipe, RecipeJsonLd, Taxonomy, TaxonomyDescriptions, TaxonomyEntry } from '../src/types';
import { EnrichmentResult } from '../src/enrichment/types';
import { AffiliateLink } from '../src/affiliates/types';

const mockRecipe: ParsedRecipe = {
  frontmatter: {
    title: 'Test Recipe',
    description: 'A test recipe description.',
    author: 'Claude Chef Community',
    prep_time: 'PT10M',
    cook_time: 'PT20M',
    servings: 2,
    calories: 500,
    keywords: ['test'],
  },
  ingredients: ['100g flour', '200ml water'],
  instructions: ['Mix flour and water.', 'Bake at 200C.'],
  body: '## Ingredients\n\n- 100g flour\n- 200ml water\n\n## Instructions\n\n1. Mix flour and water.\n2. Bake at 200C.',
  faqs: [],
  slug: 'test-recipe',
  sourceFile: 'test-recipe.md',
};

const mockJsonLd: RecipeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Test Recipe',
  author: { '@type': 'Person', name: 'Claude Chef Community' },
  datePublished: '2024-01-15',
  description: 'A test recipe description.',
  prepTime: 'PT10M',
  cookTime: 'PT20M',
  totalTime: 'PT30M',
  recipeYield: '2 servings',
  nutrition: { '@type': 'NutritionInformation', calories: '500 calories' },
  recipeIngredient: ['100g flour', '200ml water'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Mix flour and water.', position: 1 },
    { '@type': 'HowToStep', text: 'Bake at 200C.', position: 2 },
  ],
  keywords: 'test, Claude Chef, AI Cooking, Home Cooking',
};

describe('Template Renderer', () => {
  describe('renderRecipePage', () => {
    it('should produce valid HTML with doctype', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toMatch(/^<!DOCTYPE html>/);
    });

    it('should include the recipe title in <title> and <h1>', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('<title>Test Recipe | Claude Chef</title>');
      expect(html).toContain('Test Recipe');
    });

    it('should include meta description tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('meta name="description"');
      expect(html).toContain('A test recipe description.');
    });

    it('should include og:site_name meta tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('og:site_name');
      expect(html).toContain('Claude Chef');
    });

    it('should inject JSON-LD structured data script block', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('application/ld+json');
      expect(html).toContain('"@context":"https://schema.org"');
    });

    it('should use serif + sans-serif font styling', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toMatch(/DM Serif Display|Inter/);
    });

    it('should include the footer CTA with install command', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('/plugin marketplace add greynewell/claude-chef');
      expect(html).toContain('Your AI Sous Chef, Ready When You Are');
    });

    it('should include footer-links with sitemap, llms.txt, and RSS feed hrefs', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('class="footer-links"');
      expect(html).toContain('href="/sitemap.xml"');
      expect(html).toContain('href="/llms.txt"');
      expect(html).toContain('href="/feed.xml"');
    });

    it('should include the git clone button', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('git clone');
    });

    it('should display the commit hash', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('abc123');
    });

    it('should render recipe body as HTML', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      // Should contain rendered HTML from markdown, not raw markdown
      expect(html).toContain('<li>');
    });

    it('should not render shop/gear/cook sections when no enrichment data', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).not.toContain('Shop Ingredients');
      expect(html).not.toContain('Gear');
      expect(html).not.toContain('Cook with AI');
    });

    it('should render Shop Ingredients section with affiliate links when enrichment is provided', () => {
      const enrichment: EnrichmentResult = {
        ingredients: [{ ingredient: '100g flour', searchTerm: 'flour', normalizedName: 'Flour' }],
        gear: [],
        cookingTips: ['Sift flour'],
        coachingPrompt: 'Guide me.',
      };
      const affiliateLinks: AffiliateLink[] = [
        { provider: 'Amazon', term: 'flour', url: 'https://amazon.com/s?k=flour&tag=test' },
      ];
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { enrichment, affiliateLinks });
      expect(html).toContain('Shop Ingredients');
      expect(html).toContain('Amazon');
      expect(html).toContain('https://amazon.com/s?k=flour&tag=test');
    });

    it('should render Gear section when enrichment has gear items', () => {
      const enrichment: EnrichmentResult = {
        ingredients: [{ ingredient: '100g flour', searchTerm: 'flour', normalizedName: 'Flour' }],
        gear: [{ name: 'Mixing Bowl', searchTerm: 'mixing bowl' }],
        cookingTips: ['Tip'],
        coachingPrompt: 'Guide.',
      };
      const affiliateLinks: AffiliateLink[] = [
        { provider: 'Amazon', term: 'flour', url: 'https://amazon.com/s?k=flour' },
        { provider: 'Amazon', term: 'mixing bowl', url: 'https://amazon.com/s?k=mixing+bowl' },
      ];
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { enrichment, affiliateLinks });
      expect(html).toContain('Gear');
      expect(html).toContain('Mixing Bowl');
    });

    it('should render buy-all actions in shop section when affiliate links exist', () => {
      const enrichment: EnrichmentResult = {
        ingredients: [
          { ingredient: '100g flour', searchTerm: 'flour', normalizedName: 'Flour' },
          { ingredient: '200ml water', searchTerm: 'water', normalizedName: 'Water' },
        ],
        gear: [],
        cookingTips: ['Tip'],
        coachingPrompt: 'Guide.',
      };
      const affiliateLinks: AffiliateLink[] = [
        { provider: 'Amazon', term: 'flour', url: 'https://amazon.com/s?k=flour&tag=test' },
        { provider: 'Walmart', term: 'flour', url: 'https://walmart.com/search?q=flour&affiliateId=test' },
        { provider: 'Amazon', term: 'water', url: 'https://amazon.com/s?k=water&tag=test' },
      ];
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { enrichment, affiliateLinks });
      expect(html).toContain('buy-all-actions');
      expect(html).toContain('data-copy-list');
      expect(html).toContain('data-buy-all');
      expect(html).toContain('Copy Amazon links');
      expect(html).toContain('Copy Walmart links');
      expect(html).toContain('data-urls');
    });

    it('should render copy list button in gear section even without affiliate links for gear', () => {
      const enrichment: EnrichmentResult = {
        ingredients: [{ ingredient: '100g flour', searchTerm: 'flour', normalizedName: 'Flour' }],
        gear: [{ name: 'Mixing Bowl', searchTerm: 'mixing bowl' }],
        cookingTips: ['Tip'],
        coachingPrompt: 'Guide.',
      };
      const affiliateLinks: AffiliateLink[] = [
        { provider: 'Amazon', term: 'flour', url: 'https://amazon.com/s?k=flour' },
      ];
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { enrichment, affiliateLinks });
      expect(html).toContain('gear-section');
      // Extract the gear section card from HTML
      const gearStart = html.indexOf('gear-section card');
      expect(gearStart).toBeGreaterThan(-1);
      // Find the closing </div> of the gear card
      const gearEnd = html.indexOf('</div>', html.indexOf('</ul>', gearStart));
      const gearCard = html.substring(gearStart, gearEnd);
      expect(gearCard).toContain('data-copy-list');
      expect(gearCard).not.toContain('data-buy-all');
    });

    it('should not render buy-all actions when no enrichment exists', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).not.toContain('data-copy-list');
      expect(html).not.toContain('data-buy-all');
    });

    it('should HTML-encode ampersands in data-urls attribute', () => {
      const enrichment: EnrichmentResult = {
        ingredients: [{ ingredient: '100g flour', searchTerm: 'flour', normalizedName: 'Flour' }],
        gear: [],
        cookingTips: ['Tip'],
        coachingPrompt: 'Guide.',
      };
      const affiliateLinks: AffiliateLink[] = [
        { provider: 'Amazon', term: 'flour', url: 'https://amazon.com/s?k=flour&tag=test-20' },
      ];
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { enrichment, affiliateLinks });
      expect(html).toContain('data-urls');
      // The data-urls attribute should contain &amp; not raw &
      const dataUrlsMatch = html.match(/data-urls="([^"]*)"/);
      expect(dataUrlsMatch).not.toBeNull();
      expect(dataUrlsMatch![1]).toContain('&amp;');
      // Verify the actual URL ampersand is encoded (not raw & between query params)
      expect(dataUrlsMatch![1]).not.toContain('&tag=');
    });

    it('should include external main.js script when shop or gear sections exist', () => {
      const enrichment: EnrichmentResult = {
        ingredients: [{ ingredient: '100g flour', searchTerm: 'flour', normalizedName: 'Flour' }],
        gear: [],
        cookingTips: ['Tip'],
        coachingPrompt: 'Guide.',
      };
      const affiliateLinks: AffiliateLink[] = [
        { provider: 'Amazon', term: 'flour', url: 'https://amazon.com/s?k=flour' },
      ];
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { enrichment, affiliateLinks });
      expect(html).toContain('<script src="/main.js"></script>');
      // buy-all and copy-list buttons should still be in the HTML via data attributes
      expect(html).toContain('data-buy-all');
      expect(html).toContain('data-copy-list');
    });

    it('should render Cook with AI section with copy button when cookModePrompt is provided', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', {
        cookModePrompt: 'Help me cook this recipe step by step.',
      });
      expect(html).toContain('Cook with AI');
      expect(html).toContain('Copy');
      expect(html).toContain('Help me cook this recipe step by step.');
    });

    it('should escape HTML in cook mode prompt', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', {
        cookModePrompt: 'Use <script>alert("xss")</script> carefully',
      });
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
    });

    it('should include canonical link tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('<link rel="canonical" href="https://claudechef.com/test-recipe.html">');
    });

    it('should include og:url meta tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('og:url');
      expect(html).toContain('https://claudechef.com/test-recipe.html');
    });

    it('should include og:image meta tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('og:image');
    });

    it('should include Twitter Card meta tags', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('twitter:card');
      expect(html).toContain('summary_large_image');
      expect(html).toContain('twitter:title');
      expect(html).toContain('twitter:description');
      expect(html).toContain('twitter:image');
    });

    it('should include robots meta tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('name="robots"');
      expect(html).toContain('index, follow');
    });

    it('should include theme-color meta tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('name="theme-color"');
      expect(html).toContain('#5B7B5E');
    });

    it('should include author meta tag', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('name="author"');
    });

    it('should render Suggested Pairings section when pairings are provided', () => {
      const pairedRecipe: ParsedRecipe = {
        frontmatter: {
          title: 'Roasted Broccoli',
          description: 'Crispy teriyaki roasted broccoli.',
          author: 'Claude Chef Community',
          prep_time: 'PT5M',
          cook_time: 'PT20M',
          servings: 4,
          calories: 120,
          keywords: ['broccoli'],
        },
        ingredients: ['1 head broccoli'],
        instructions: ['Roast broccoli.'],
        body: '## Ingredients\n\n- 1 head broccoli',
        faqs: [],
        slug: 'teriyaki-roasted-broccoli',
        sourceFile: 'teriyaki-roasted-broccoli.md',
      };
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { pairings: [pairedRecipe] });
      expect(html).toContain('Suggested Pairings');
      expect(html).toContain('Roasted Broccoli');
      expect(html).toContain('teriyaki-roasted-broccoli.html');
      expect(html).toContain('Crispy teriyaki roasted broccoli.');
    });

    it('should not render pairings section when no pairings provided', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).not.toContain('Suggested Pairings');
    });

    it('should not render pairings section when pairings is null', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { pairings: null });
      expect(html).not.toContain('Suggested Pairings');
    });

    it('should not render pairings section when pairings is empty array', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { pairings: [] });
      expect(html).not.toContain('Suggested Pairings');
    });

    it('should include BreadcrumbList JSON-LD when provided', () => {
      const breadcrumb = {
        '@context': 'https://schema.org' as const,
        '@type': 'BreadcrumbList' as const,
        itemListElement: [
          { '@type': 'ListItem' as const, position: 1, name: 'Home', item: 'https://claudechef.com/index.html' },
          { '@type': 'ListItem' as const, position: 2, name: 'Test Recipe' },
        ],
      };
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', { breadcrumbJsonLd: breadcrumb });
      expect(html).toContain('BreadcrumbList');
    });

    it('should include Install, About, and Contribute nav links', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('/install.html');
      expect(html).toContain('Install');
      expect(html).toContain('/about.html');
      expect(html).toContain('/contribute.html');
    });

    it('should include site brand link back to index', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('href="/index.html"');
    });

    it('should render visual breadcrumb when categoryBreadcrumb is provided', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123', {
        categoryBreadcrumb: { name: 'Main Course', slug: 'main-course' },
      });
      expect(html).toContain('class="breadcrumb"');
      expect(html).toContain('/category/main-course.html');
      expect(html).toContain('Main Course');
      expect(html).toContain('Home');
    });

    it('should not render visual breadcrumb when categoryBreadcrumb is not provided', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).not.toContain('class="breadcrumb"');
    });

    it('should include share bar with Share and Copy link buttons', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('share-bar');
      expect(html).toContain('Share this recipe');
      expect(html).toContain('data-share');
      expect(html).toContain('data-copy-link');
      expect(html).toContain('Copy link');
    });

    it('should include canonical URL in share button data attributes', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('data-url="https://claudechef.com/test-recipe.html"');
    });

    it('should include recipe title and description in share data attributes', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('data-title="Test Recipe"');
      expect(html).toContain('data-text="A test recipe description."');
    });

    it('should include external main.js for share functionality', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('<script src="/main.js"></script>');
      // Share buttons with data attributes should still be in the HTML
      expect(html).toContain('data-share');
      expect(html).toContain('data-copy-link');
    });

    it('should include About nav link', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Contribute nav link', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('Contribute');
    });

    it('should include Install nav link', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });

    it('should render skill badge when skill_level is present', () => {
      const recipeWithSkill = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, skill_level: 'Easy' },
      };
      const html = renderRecipePage(recipeWithSkill, mockJsonLd, 'abc123');
      expect(html).toContain('skill-badge');
      expect(html).toContain('easy');
      expect(html).toContain('/skill_level/easy.html');
      expect(html).toContain('Easy');
    });

    it('should not render skill badge element when skill_level is absent', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).not.toContain('class="skill-badge');
    });

    it('should render byline with author name and link', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('recipe-byline');
      expect(html).toContain('By <a href="/author/claude-chef-community.html">Claude Chef Community</a>');
    });

    it('should render linked category pill', () => {
      const recipeWithCat = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, recipe_category: 'Main Course' },
      };
      const html = renderRecipePage(recipeWithCat, mockJsonLd, 'abc123');
      expect(html).toContain('href="/category/main-course.html"');
      expect(html).toContain('Main Course');
      expect(html).toContain('class="meta-pill tax-category"');
    });

    it('should render linked cuisine pill', () => {
      const recipeWithCuisine = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, cuisine: 'Japanese' },
      };
      const html = renderRecipePage(recipeWithCuisine, mockJsonLd, 'abc123');
      expect(html).toContain('href="/cuisine/japanese.html"');
      expect(html).toContain('Japanese');
    });

    it('should render linked ingredient pills', () => {
      const recipeWithIngredients = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, recipe_ingredients: ['Chicken', 'Butter'] },
      };
      const html = renderRecipePage(recipeWithIngredients, mockJsonLd, 'abc123');
      expect(html).toContain('href="/ingredient/chicken.html"');
      expect(html).toContain('Chicken');
      expect(html).toContain('href="/ingredient/butter.html"');
      expect(html).toContain('Butter');
    });

    it('should render linked flavor pills', () => {
      const recipeWithFlavors = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, flavors: ['Sweet', 'Umami'] },
      };
      const html = renderRecipePage(recipeWithFlavors, mockJsonLd, 'abc123');
      expect(html).toContain('href="/flavor/sweet.html"');
      expect(html).toContain('href="/flavor/umami.html"');
    });

    it('should render linked tool pills', () => {
      const recipeWithTools = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, tools: ['Skillet', 'Oven'] },
      };
      const html = renderRecipePage(recipeWithTools, mockJsonLd, 'abc123');
      expect(html).toContain('href="/tool/skillet.html"');
      expect(html).toContain('href="/tool/oven.html"');
    });

    it('should render ingredient list with data-base-qty for scalable ingredients', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('class="ingredient-list"');
      expect(html).toContain('data-base-qty="100"');
      expect(html).toContain('data-base-qty="200"');
      expect(html).toContain('class="ingredient-qty"');
    });

    it('should render servings slider with range input, number input, and +/- buttons', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('servings-slider');
      expect(html).toContain('servings-range');
      expect(html).toContain('servings-input');
      expect(html).toContain('servings-btn');
      expect(html).toContain('data-dir="-"');
      expect(html).toContain('data-dir="+"');
    });

    it('should include data-base-servings and data-base-calories on article', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('data-base-servings="2"');
      expect(html).toContain('data-base-calories="500"');
    });

    it('should include calories-value span', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('class="calories-value"');
      expect(html).toContain('<span class="calories-value">500</span> cal');
    });

    it('should include portion scaling data attributes and external script', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).toContain('data-base-servings');
      expect(html).toContain('data-base-calories');
      expect(html).toContain('servings-range');
      expect(html).toContain('servings-input');
      expect(html).toContain('<script src="/main.js"></script>');
    });

    it('should render non-scalable ingredients without data-base-qty', () => {
      const recipeWithNonScalable = {
        ...mockRecipe,
        ingredients: ['100g flour', 'Salt, to taste'],
        body: '## Ingredients\n\n- 100g flour\n- Salt, to taste\n\n## Instructions\n\n1. Mix.',
      };
      const html = renderRecipePage(recipeWithNonScalable, mockJsonLd, 'abc123');
      expect(html).toContain('data-base-qty="100"');
      expect(html).toMatch(/<li class="ingredient">Salt, to taste<\/li>/);
    });

    it('should still render instructions and notes after splitting ingredients', () => {
      const recipeWithNotes = {
        ...mockRecipe,
        body: '## Ingredients\n\n- 100g flour\n\n## Instructions\n\n1. Mix flour.\n\n## Notes\n\n- Keep dry.',
      };
      const html = renderRecipePage(recipeWithNotes, mockJsonLd, 'abc123');
      expect(html).toContain('Instructions');
      expect(html).toContain('Notes');
      expect(html).toContain('Keep dry');
    });

    it('should not render linked taxonomy pills when fields are absent', () => {
      const html = renderRecipePage(mockRecipe, mockJsonLd, 'abc123');
      expect(html).not.toContain('a class="meta-pill"');
    });

    it('should include CSS for linked pill hover style in baseStyles', () => {
      const css = baseStyles();
      expect(css).toContain('a.meta-pill:hover');
    });

    it('should include CSS for skill badge variants in baseStyles', () => {
      const css = baseStyles();
      expect(css).toContain('.skill-badge.easy');
      expect(css).toContain('.skill-badge.intermediate');
      expect(css).toContain('.skill-badge.advanced');
    });

    it('should include share handlers in mainScript', () => {
      const js = mainScript();
      expect(js).toContain('[data-share]');
      expect(js).toContain('[data-copy-link]');
      expect(js).toContain('navigator.share');
      expect(js).toContain('navigator.clipboard.writeText');
    });

    it('should include servings slider logic in mainScript', () => {
      const js = mainScript();
      expect(js).toContain('data-base-servings');
      expect(js).toContain('snapFraction');
      expect(js).toContain('formatQty');
      expect(js).toContain('setServings');
      expect(js).toContain('.servings-btn');
    });

    it('should include buy-all and copy-list handlers in mainScript', () => {
      const js = mainScript();
      expect(js).toContain('[data-copy-list]');
      expect(js).toContain('[data-buy-all]');
      expect(js).toContain('navigator.clipboard');
    });
  });

  describe('renderIndexPage', () => {
    it('should show recipe in favorites section when marked as favorite', () => {
      const recipes = [mockRecipe];
      const html = renderIndexPage(recipes, { favoriteSlugs: ['test-recipe'] });
      expect(html).toContain('Test Recipe');
      expect(html).toContain('test-recipe');
    });

    it('should include site title', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('Claude Chef');
    });

    it('should include recipe count in page title', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('<title>1 Recipes with AI-Powered Cooking Guidance | Claude Chef</title>');
    });

    it('should include recipe count in hero heading', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('1 Recipes &amp; Counting');
    });

    it('should include recipe count in hero tagline', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('Explore 1 delicious, tested recipes');
    });

    it('should scale recipe count with multiple recipes', () => {
      const recipes = [mockRecipe, { ...mockRecipe, slug: 'recipe-2', frontmatter: { ...mockRecipe.frontmatter, title: 'Recipe 2' } }];
      const html = renderIndexPage(recipes);
      expect(html).toContain('2 Recipes &amp; Counting');
      expect(html).toContain('Explore 2 delicious, tested recipes');
    });

    it('should include recipe count in community nudge', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('Help us grow beyond 1!');
    });

    it('should include the footer CTA', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('/plugin marketplace add greynewell/claude-chef');
    });

    it('should include canonical link on index', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('<link rel="canonical" href="https://claudechef.com/index.html">');
    });

    it('should include og:type website on index', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('og:type');
      expect(html).toContain('website');
    });

    it('should include Twitter Card tags on index', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('twitter:card');
      expect(html).toContain('twitter:title');
    });

    it('should include WebSite JSON-LD when provided', () => {
      const webSiteJsonLd = {
        '@context': 'https://schema.org' as const,
        '@type': 'WebSite' as const,
        name: 'Claude Chef',
        url: 'https://claudechef.com',
        description: 'Recipes',
        publisher: { '@type': 'Organization' as const, name: 'Claude Chef Community', url: 'https://claudechef.com' },
      };
      const html = renderIndexPage([mockRecipe], { webSiteJsonLd });
      expect(html).toContain('WebSite');
      expect(html).toContain('application/ld+json');
    });

    it('should include ItemList JSON-LD when provided', () => {
      const itemListJsonLd = {
        '@context': 'https://schema.org' as const,
        '@type': 'ItemList' as const,
        name: 'Recipes',
        description: 'All recipes',
        numberOfItems: 1,
        itemListElement: [{ '@type': 'ListItem' as const, position: 1, url: 'https://claudechef.com/test-recipe.html', name: 'Test Recipe' }],
      };
      const html = renderIndexPage([mockRecipe], { itemListJsonLd });
      expect(html).toContain('ItemList');
    });

    it('should render Browse Recipes section when taxonomies are provided', () => {
      const stubDescriptions: TaxonomyDescriptions = {
        hubTitle: (name) => `${name} Recipes`,
        hubMetaDescription: (name) => `Browse ${name.toLowerCase()} recipes.`,
        hubSubheading: (name, count) => `${count} recipes`,
        indexDescription: 'Browse recipes.',
        collectionDescription: (name) => `Collection of ${name.toLowerCase()} recipes.`,
      };
      const taxonomies: Taxonomy[] = [
        { type: 'category', label: 'Categories', labelSingular: 'Category', entries: [{ name: 'Main Course', slug: 'main-course', recipes: [mockRecipe] }], descriptions: stubDescriptions },
        { type: 'cuisine', label: 'Cuisines', labelSingular: 'Cuisine', entries: [{ name: 'Italian', slug: 'italian', recipes: [mockRecipe] }], descriptions: stubDescriptions },
        { type: 'ingredient', label: 'Ingredients', labelSingular: 'Ingredient', entries: [{ name: 'Chicken', slug: 'chicken', recipes: [mockRecipe] }], descriptions: stubDescriptions },
        { type: 'flavor', label: 'Flavors', labelSingular: 'Flavor', entries: [{ name: 'Umami', slug: 'umami', recipes: [mockRecipe] }], descriptions: stubDescriptions },
        { type: 'tool', label: 'Tools', labelSingular: 'Tool', entries: [{ name: 'Skillet', slug: 'skillet', recipes: [mockRecipe] }], descriptions: stubDescriptions },
        { type: 'skill_level', label: 'Skill Levels', labelSingular: 'Skill Level', entries: [{ name: 'Easy', slug: 'easy', recipes: [mockRecipe] }], descriptions: stubDescriptions },
      ];
      const html = renderIndexPage([mockRecipe], { taxonomies });
      expect(html).toContain('Browse Recipes');
      expect(html).toContain('browse-pill');
      expect(html).toContain('/category/index.html');
      expect(html).toContain('Categories');
      expect(html).toContain('/cuisine/index.html');
      expect(html).toContain('Cuisines');
      expect(html).toContain('/ingredient/index.html');
      expect(html).toContain('Ingredients');
      expect(html).toContain('/flavor/index.html');
      expect(html).toContain('Flavors');
      expect(html).toContain('/tool/index.html');
      expect(html).toContain('Tools');
      expect(html).toContain('/skill_level/index.html');
      expect(html).toContain('Skill Levels');
    });

    it('should not render Browse Recipes section when taxonomies are empty', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).not.toContain('Browse Recipes');
    });

    it('should include Install, About, and Contribute nav links on index page', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('/install.html');
      expect(html).toContain('Install');
      expect(html).toContain('/about.html');
      expect(html).toContain('/contribute.html');
    });

    it('should include About nav link', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Contribute nav link', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('Contribute');
    });

    it('should include contribution mention in footer CTA', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('Contribute to Claude Chef');
      expect(html).toContain('/contribute.html');
    });

    it('should include contribution nudge after recipe grid', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('Share it with the community');
      expect(html).toContain('/contribute.html');
    });

    it('should include Install nav link', () => {
      const html = renderIndexPage([mockRecipe]);
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });

    it('should render Our Favorites section when favoriteSlugs match recipes', () => {
      const html = renderIndexPage([mockRecipe], { favoriteSlugs: ['test-recipe'] });
      expect(html).toContain('Our Favorites');
      expect(html).toContain('favorites-section');
    });

    it('should not render Our Favorites section when favoriteSlugs is null', () => {
      const html = renderIndexPage([mockRecipe], { favoriteSlugs: null });
      expect(html).not.toContain('Our Favorites');
      expect(html).not.toContain('<div class="favorites-section">');
    });

    it('should not render Our Favorites section when favoriteSlugs is empty', () => {
      const html = renderIndexPage([mockRecipe], { favoriteSlugs: [] });
      expect(html).not.toContain('Our Favorites');
      expect(html).not.toContain('<div class="favorites-section">');
    });

    it('should not render Our Favorites section when slugs do not match any recipe', () => {
      const html = renderIndexPage([mockRecipe], { favoriteSlugs: ['nonexistent-recipe'] });
      expect(html).not.toContain('Our Favorites');
      expect(html).not.toContain('<div class="favorites-section">');
    });

    it('should add .favorite class to matching recipe cards in main grid', () => {
      const html = renderIndexPage([mockRecipe], { favoriteSlugs: ['test-recipe'] });
      expect(html).toContain('recipe-card favorite');
    });

    it('should not add .favorite class to recipes not in favoriteSlugs', () => {
      // Create a recipe with a category so it appears in category showcase
      const recipeWithCategory: ParsedRecipe = {
        ...mockRecipe,
        frontmatter: { ...mockRecipe.frontmatter, recipe_category: 'Main Course' }
      };
      // Provide taxonomies so category showcase appears
      const taxonomies = [{
        type: 'category' as const,
        label: 'Categories',
        labelSingular: 'Category',
        entries: [{ name: 'Main Course', slug: 'main-course', recipes: [recipeWithCategory] }],
        descriptions: {
          hubTitle: () => '',
          hubMetaDescription: () => '',
          hubSubheading: () => '',
          indexDescription: '',
          collectionDescription: () => '',
        }
      }];
      const html = renderIndexPage([recipeWithCategory], { favoriteSlugs: ['other-recipe'], taxonomies });
      // The recipe should appear in category showcase without .favorite class
      expect(html).toContain('recipe-card');
      expect(html).not.toMatch(/recipe-card favorite">\s*\n\s*<a href="test-recipe/);
    });

    it('should show favorites in favorites section when favoriteSlugs present', () => {
      const html = renderIndexPage([mockRecipe], { favoriteSlugs: ['test-recipe'] });
      // Favorites section should contain the recipe
      expect(html).toContain('favorites-section');
      expect(html).toContain('Test Recipe');
    });

    it('should show recipe count in hero when no favorites', () => {
      const html = renderIndexPage([mockRecipe]);
      // When no favorites or categories, at least the count is shown
      expect(html).toContain('1 Recipes');
    });
  });

  describe('renderHubPage', () => {
    const entry: TaxonomyEntry = {
      name: 'Main Course',
      slug: 'main-course',
      recipes: [mockRecipe],
    };

    it('should produce valid HTML with doctype', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toMatch(/^<!DOCTYPE html>/);
    });

    it('should include entry name in title', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('<title>1 Main Course Recipes | Claude Chef</title>');
    });

    it('should include canonical URL', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('href="https://claudechef.com/category/main-course.html"');
    });

    it('should list recipes', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('Test Recipe');
      expect(html).toContain('/test-recipe.html');
    });

    it('should include visual breadcrumb', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('class="breadcrumb"');
      expect(html).toContain('Home');
      expect(html).toContain('Categories');
      expect(html).toContain('Main Course');
    });

    it('should use label parameter in breadcrumb when provided', () => {
      const html = renderHubPage('ingredient', 'Ingredient', entry, {}, 'Ingredients');
      expect(html).toContain('Ingredients');
      expect(html).toContain('/ingredient/index.html');
    });

    it('should include CollectionPage JSON-LD when provided', () => {
      const collectionPageJsonLd = {
        '@context': 'https://schema.org' as const,
        '@type': 'CollectionPage' as const,
        name: 'Main Course Recipes',
        url: 'https://claudechef.com/category/main-course.html',
        description: 'A collection of main course recipes.',
        mainEntity: {
          '@type': 'ItemList' as const,
          numberOfItems: 1,
          itemListElement: [{ '@type': 'ListItem' as const, position: 1, url: 'https://claudechef.com/test-recipe.html', name: 'Test Recipe' }],
        },
      };
      const html = renderHubPage('category', 'Category', entry, { collectionPageJsonLd });
      expect(html).toContain('CollectionPage');
    });

    it('should include nav links', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('/install.html');
      expect(html).toContain('Install');
      expect(html).toContain('/about.html');
      expect(html).toContain('href="/index.html"');
    });

    it('should include the footer CTA', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('/plugin marketplace add greynewell/claude-chef');
    });

    it('should show recipe count', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('1 recipe');
    });

    it('should include About nav link', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Contribute nav link', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('Contribute');
    });

    it('should include Install nav link', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });

    it('should add .favorite class to matching recipe cards', () => {
      const html = renderHubPage('category', 'Category', entry, { favoriteSlugs: ['test-recipe'] });
      expect(html).toContain('recipe-card favorite');
    });

    it('should not add .favorite class when slug does not match', () => {
      const html = renderHubPage('category', 'Category', entry, { favoriteSlugs: ['other-recipe'] });
      expect(html).not.toContain('recipe-card favorite');
    });

    it('should use descriptions for H1 when provided', () => {
      const descriptions: TaxonomyDescriptions = {
        hubTitle: (name) => `Recipes with ${name}`,
        hubMetaDescription: (name) => `Find recipes with ${name.toLowerCase()}.`,
        hubSubheading: (name, count) => `${count} recipes featuring ${name.toLowerCase()}`,
        indexDescription: 'Find recipes by ingredient.',
        collectionDescription: (name) => `Recipes featuring ${name.toLowerCase()}.`,
      };
      const html = renderHubPage('ingredient', 'Ingredient', entry, { descriptions }, 'Ingredients');
      expect(html).toContain('<h1>Recipes with Main Course</h1>');
      expect(html).toContain('Find recipes with main course.');
    });

    it('should fall back to generic title when descriptions not provided', () => {
      const html = renderHubPage('category', 'Category', entry);
      expect(html).toContain('<h1>Main Course Recipes</h1>');
    });

    it('should render pagination nav with 100 mock recipes across 3 pages', () => {
      const recipes = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecipe,
        slug: `recipe-${i}`,
        frontmatter: { ...mockRecipe.frontmatter, title: `Recipe ${i}` },
      }));
      const bigEntry: TaxonomyEntry = { name: 'Chicken', slug: 'chicken', recipes };
      const pagination = computePagination(100, 1, 'ingredient', 'chicken');
      const html = renderHubPage('ingredient', 'Ingredient', bigEntry, { pagination }, 'Ingredients');
      expect(html).toContain('class="pagination"');
      expect(html).toContain('pagination-current');
      expect(html).toContain('Next');
      expect(html).toContain('chicken-page-2.html');
    });

    it('should render 48 recipe cards on page 1 of paginated hub', () => {
      const recipes = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecipe,
        slug: `recipe-${i}`,
        frontmatter: { ...mockRecipe.frontmatter, title: `Recipe ${i}` },
      }));
      const bigEntry: TaxonomyEntry = { name: 'Chicken', slug: 'chicken', recipes };
      const pagination = computePagination(100, 1, 'ingredient', 'chicken');
      const html = renderHubPage('ingredient', 'Ingredient', bigEntry, { pagination }, 'Ingredients');
      const cardCount = (html.match(/class="recipe-card/g) || []).length;
      expect(cardCount).toBe(48);
    });

    it('should not render pagination when 48 or fewer recipes', () => {
      const recipes = Array.from({ length: 48 }, (_, i) => ({
        ...mockRecipe,
        slug: `recipe-${i}`,
        frontmatter: { ...mockRecipe.frontmatter, title: `Recipe ${i}` },
      }));
      const smallEntry: TaxonomyEntry = { name: 'Chicken', slug: 'chicken', recipes };
      const html = renderHubPage('ingredient', 'Ingredient', smallEntry, {}, 'Ingredients');
      expect(html).not.toContain('class="pagination"');
    });

    it('should use paginated canonical URL for page 2+', () => {
      const recipes = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecipe,
        slug: `recipe-${i}`,
        frontmatter: { ...mockRecipe.frontmatter, title: `Recipe ${i}` },
      }));
      const bigEntry: TaxonomyEntry = { name: 'Chicken', slug: 'chicken', recipes };
      const pagination = computePagination(100, 2, 'ingredient', 'chicken');
      const html = renderHubPage('ingredient', 'Ingredient', bigEntry, { pagination }, 'Ingredients');
      expect(html).toContain('href="https://claudechef.com/ingredient/chicken-page-2.html"');
    });

    it('should show paginated subheading with range when descriptions and pagination provided', () => {
      const recipes = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecipe,
        slug: `recipe-${i}`,
        frontmatter: { ...mockRecipe.frontmatter, title: `Recipe ${i}` },
      }));
      const bigEntry: TaxonomyEntry = { name: 'Chicken', slug: 'chicken', recipes };
      const descriptions: TaxonomyDescriptions = {
        hubTitle: (name) => `Recipes with ${name}`,
        hubMetaDescription: (name) => `Find recipes with ${name.toLowerCase()}.`,
        hubSubheading: (name, count, start?, end?) => {
          if (start !== undefined && end !== undefined) {
            return `Showing ${start}\u2013${end} of ${count} recipes with ${name.toLowerCase()}`;
          }
          return `${count} recipes with ${name.toLowerCase()}`;
        },
        indexDescription: 'Find recipes by ingredient.',
        collectionDescription: (name) => `Recipes featuring ${name.toLowerCase()}.`,
      };
      const pagination = computePagination(100, 1, 'ingredient', 'chicken');
      const html = renderHubPage('ingredient', 'Ingredient', bigEntry, { pagination, descriptions }, 'Ingredients');
      expect(html).toContain('Showing 1');
      expect(html).toContain('of 100 recipes with chicken');
    });
  });

  describe('computePagination', () => {
    it('should compute correct values for page 1', () => {
      const p = computePagination(100, 1, 'ingredient', 'chicken');
      expect(p.currentPage).toBe(1);
      expect(p.totalPages).toBe(3);
      expect(p.startIndex).toBe(0);
      expect(p.endIndex).toBe(48);
      expect(p.prevUrl).toBeNull();
      expect(p.nextUrl).toBe('/ingredient/chicken-page-2.html');
    });

    it('should compute correct values for page 2', () => {
      const p = computePagination(100, 2, 'ingredient', 'chicken');
      expect(p.currentPage).toBe(2);
      expect(p.startIndex).toBe(48);
      expect(p.endIndex).toBe(96);
      expect(p.prevUrl).toBe('/ingredient/chicken.html');
      expect(p.nextUrl).toBe('/ingredient/chicken-page-3.html');
    });

    it('should compute correct values for last page', () => {
      const p = computePagination(100, 3, 'ingredient', 'chicken');
      expect(p.currentPage).toBe(3);
      expect(p.startIndex).toBe(96);
      expect(p.endIndex).toBe(100);
      expect(p.prevUrl).toBe('/ingredient/chicken-page-2.html');
      expect(p.nextUrl).toBeNull();
    });

    it('should return 1 page for small sets', () => {
      const p = computePagination(10, 1, 'category', 'main-course');
      expect(p.totalPages).toBe(1);
      expect(p.prevUrl).toBeNull();
      expect(p.nextUrl).toBeNull();
    });
  });

  describe('RECIPES_PER_PAGE', () => {
    it('should be 48', () => {
      expect(RECIPES_PER_PAGE).toBe(48);
    });
  });

  describe('renderTaxonomyIndexPage', () => {
    const defaultDescriptions: TaxonomyDescriptions = {
      hubTitle: (name) => `${name} Recipes`,
      hubMetaDescription: (name) => `Browse ${name.toLowerCase()} recipes from Claude Chef.`,
      hubSubheading: (name, count) => `${count} recipes in ${name.toLowerCase()}`,
      indexDescription: 'Browse by meal type \u2014 main courses, sides, desserts, and more.',
      collectionDescription: (name) => `A collection of ${name.toLowerCase()} recipes from Claude Chef.`,
    };

    const taxonomy: Taxonomy = {
      type: 'category',
      label: 'Categories',
      labelSingular: 'Category',
      entries: [
        { name: 'Main Course', slug: 'main-course', recipes: [mockRecipe] },
        { name: 'Side Dish', slug: 'side-dish', recipes: [mockRecipe, mockRecipe] },
      ],
      descriptions: defaultDescriptions,
    };

    it('should produce valid HTML with doctype', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toMatch(/^<!DOCTYPE html>/);
    });

    it('should include taxonomy label in title', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('<title>2 Categories | Claude Chef</title>');
    });

    it('should include entry count in heading', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('<h1>2 Categories</h1>');
    });

    it('should include canonical URL', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('href="https://claudechef.com/category/index.html"');
    });

    it('should list entries with recipe counts', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('Main Course');
      expect(html).toContain('Side Dish');
      expect(html).toContain('/category/main-course.html');
      expect(html).toContain('/category/side-dish.html');
      expect(html).toContain('taxonomy-count');
    });

    it('should include visual breadcrumb', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('class="breadcrumb"');
      expect(html).toContain('Home');
      expect(html).toContain('Categories');
    });

    it('should include ItemList JSON-LD when provided', () => {
      const itemListJsonLd = {
        '@context': 'https://schema.org' as const,
        '@type': 'ItemList' as const,
        name: 'Claude Chef Categories',
        description: 'Browse all categories.',
        numberOfItems: 2,
        itemListElement: [
          { '@type': 'ListItem' as const, position: 1, url: 'https://claudechef.com/category/main-course.html', name: 'Main Course' },
          { '@type': 'ListItem' as const, position: 2, url: 'https://claudechef.com/category/side-dish.html', name: 'Side Dish' },
        ],
      };
      const html = renderTaxonomyIndexPage(taxonomy, { itemListJsonLd });
      expect(html).toContain('ItemList');
    });

    it('should include the footer CTA', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('/plugin marketplace add greynewell/claude-chef');
    });

    it('should include About nav link', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Contribute nav link', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('Contribute');
    });

    it('should include Install nav link', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });

    it('should use indexDescription from descriptions for meta and subheading', () => {
      const html = renderTaxonomyIndexPage(taxonomy);
      expect(html).toContain('Browse by meal type');
    });
  });

  describe('renderAboutPage', () => {
    it('should produce valid HTML with doctype', () => {
      const html = renderAboutPage();
      expect(html).toMatch(/^<!DOCTYPE html>/);
    });

    it('should include the page title', () => {
      const html = renderAboutPage();
      expect(html).toContain('<title>How Claude Chef Works | Claude Chef</title>');
    });

    it('should include meta description', () => {
      const html = renderAboutPage();
      expect(html).toContain('name="description"');
      expect(html).toContain('AI-powered cooking guidance');
    });

    it('should include canonical URL', () => {
      const html = renderAboutPage();
      expect(html).toContain('<link rel="canonical" href="https://claudechef.com/about.html">');
    });

    it('should include og:title meta tag', () => {
      const html = renderAboutPage();
      expect(html).toContain('og:title');
      expect(html).toContain('How Claude Chef Works');
    });

    it('should include og:url meta tag', () => {
      const html = renderAboutPage();
      expect(html).toContain('og:url');
      expect(html).toContain('https://claudechef.com/about.html');
    });

    it('should include og:image meta tag', () => {
      const html = renderAboutPage();
      expect(html).toContain('og:image');
    });

    it('should include og:site_name meta tag', () => {
      const html = renderAboutPage();
      expect(html).toContain('og:site_name');
      expect(html).toContain('Claude Chef');
    });

    it('should include Twitter Card meta tags', () => {
      const html = renderAboutPage();
      expect(html).toContain('twitter:card');
      expect(html).toContain('summary_large_image');
      expect(html).toContain('twitter:title');
      expect(html).toContain('twitter:description');
      expect(html).toContain('twitter:image');
    });

    it('should include AboutPage JSON-LD', () => {
      const html = renderAboutPage();
      expect(html).toContain('application/ld+json');
      expect(html).toContain('"@type":"AboutPage"');
    });

    it('should include BreadcrumbList JSON-LD', () => {
      const html = renderAboutPage();
      expect(html).toContain('"@type":"BreadcrumbList"');
    });

    it('should include visual breadcrumb', () => {
      const html = renderAboutPage();
      expect(html).toContain('class="breadcrumb"');
      expect(html).toContain('Home');
      expect(html).toContain('About');
    });

    it('should include the hero heading', () => {
      const html = renderAboutPage();
      expect(html).toContain('<h1>How Claude Chef Works</h1>');
    });

    it('should include the intro paragraph', () => {
      const html = renderAboutPage();
      expect(html).toContain('about-intro');
      expect(html).toContain('open-source recipe site powered by AI');
    });

    it('should include Cook with AI feature section', () => {
      const html = renderAboutPage();
      expect(html).toContain('Cook with AI');
      expect(html).toContain('about-feature');
    });

    it('should include Smart Ingredient Shopping feature section', () => {
      const html = renderAboutPage();
      expect(html).toContain('Smart Ingredient Shopping');
    });

    it('should include Gear Recommendations feature section', () => {
      const html = renderAboutPage();
      expect(html).toContain('Gear Recommendations');
    });

    it('should include Recipe Pairings feature section', () => {
      const html = renderAboutPage();
      expect(html).toContain('Recipe Pairings');
    });

    it('should include Browse by Category, Cuisine, Ingredients & More feature section', () => {
      const html = renderAboutPage();
      expect(html).toContain('Browse by Category, Cuisine, Ingredients');
    });

    it('should include CLI install command', () => {
      const html = renderAboutPage();
      expect(html).toContain('/plugin marketplace add greynewell/claude-chef');
      expect(html).toContain('about-install');
    });

    it('should include Open Source section with git clone, GitHub link, and contribute link', () => {
      const html = renderAboutPage();
      expect(html).toContain('Open Source');
      expect(html).toContain('git clone');
      expect(html).toContain('github.com/greynewell/claude-chef');
      expect(html).toContain('about-actions');
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('contribute back to the community');
    });

    it('should include the footer CTA', () => {
      const html = renderAboutPage();
      expect(html).toContain('Your AI Sous Chef, Ready When You Are');
    });

    it('should include site brand link back to index', () => {
      const html = renderAboutPage();
      expect(html).toContain('href="/index.html"');
    });

    it('should include About nav link', () => {
      const html = renderAboutPage();
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Contribute nav link', () => {
      const html = renderAboutPage();
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('Contribute');
    });

    it('should include Install nav link', () => {
      const html = renderAboutPage();
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });
  });

  describe('renderContributePage', () => {
    it('should produce valid HTML with doctype', () => {
      const html = renderContributePage();
      expect(html).toMatch(/^<!DOCTYPE html>/);
    });

    it('should include the page title', () => {
      const html = renderContributePage();
      expect(html).toContain('<title>Contribute a Recipe | Claude Chef</title>');
    });

    it('should include meta description', () => {
      const html = renderContributePage();
      expect(html).toContain('name="description"');
      expect(html).toContain('Submit your favorite recipes');
    });

    it('should include canonical URL', () => {
      const html = renderContributePage();
      expect(html).toContain('<link rel="canonical" href="https://claudechef.com/contribute.html">');
    });

    it('should include og:title meta tag', () => {
      const html = renderContributePage();
      expect(html).toContain('og:title');
      expect(html).toContain('Contribute a Recipe');
    });

    it('should include og:url meta tag', () => {
      const html = renderContributePage();
      expect(html).toContain('og:url');
      expect(html).toContain('https://claudechef.com/contribute.html');
    });

    it('should include og:image meta tag', () => {
      const html = renderContributePage();
      expect(html).toContain('og:image');
    });

    it('should include og:site_name meta tag', () => {
      const html = renderContributePage();
      expect(html).toContain('og:site_name');
      expect(html).toContain('Claude Chef');
    });

    it('should include Twitter Card meta tags', () => {
      const html = renderContributePage();
      expect(html).toContain('twitter:card');
      expect(html).toContain('summary_large_image');
      expect(html).toContain('twitter:title');
      expect(html).toContain('twitter:description');
      expect(html).toContain('twitter:image');
    });

    it('should include WebPage JSON-LD', () => {
      const html = renderContributePage();
      expect(html).toContain('application/ld+json');
      expect(html).toContain('"@type":"WebPage"');
    });

    it('should include BreadcrumbList JSON-LD', () => {
      const html = renderContributePage();
      expect(html).toContain('"@type":"BreadcrumbList"');
    });

    it('should include visual breadcrumb', () => {
      const html = renderContributePage();
      expect(html).toContain('class="breadcrumb"');
      expect(html).toContain('Home');
      expect(html).toContain('Contribute');
    });

    it('should include the hero heading', () => {
      const html = renderContributePage();
      expect(html).toContain('<h1>Contribute a Recipe</h1>');
    });

    it('should include the intro paragraph', () => {
      const html = renderContributePage();
      expect(html).toContain('contribute-intro');
      expect(html).toContain('Share your favorite recipes');
    });

    it('should include a recipe form element', () => {
      const html = renderContributePage();
      expect(html).toContain('<form id="recipe-form"');
      expect(html).toContain('class="recipe-form"');
    });

    it('should include Basic Info fields', () => {
      const html = renderContributePage();
      expect(html).toContain('Basic Info');
      expect(html).toContain('id="title"');
      expect(html).toContain('id="description"');
      expect(html).toContain('id="author"');
    });

    it('should include Time & Servings fields with hour/minute/second inputs', () => {
      const html = renderContributePage();
      expect(html).toContain('Time &amp; Servings');
      expect(html).toContain('id="prep_hours"');
      expect(html).toContain('id="prep_minutes"');
      expect(html).toContain('id="prep_seconds"');
      expect(html).toContain('id="cook_hours"');
      expect(html).toContain('id="cook_minutes"');
      expect(html).toContain('id="cook_seconds"');
      expect(html).toContain('id="servings"');
      expect(html).toContain('id="calories"');
      expect(html).toContain('class="time-inputs"');
    });

    it('should include Classification fields', () => {
      const html = renderContributePage();
      expect(html).toContain('Classification');
      expect(html).toContain('id="recipe_category"');
      expect(html).toContain('id="recipe_cuisine"');
      expect(html).toContain('id="skill_level"');
      expect(html).toContain('id="keywords"');
      expect(html).toContain('id="recipe_ingredients"');
    });

    it('should include category select options', () => {
      const html = renderContributePage();
      expect(html).toContain('Main Course');
      expect(html).toContain('Side Dish');
      expect(html).toContain('Dessert');
    });

    it('should include skill level select options', () => {
      const html = renderContributePage();
      expect(html).toContain('>Easy<');
      expect(html).toContain('>Intermediate<');
      expect(html).toContain('>Advanced<');
    });

    it('should include Allergens checkboxes', () => {
      const html = renderContributePage();
      expect(html).toContain('Allergens');
      expect(html).toContain('name="allergies"');
      expect(html).toContain('value="Dairy"');
      expect(html).toContain('value="Gluten"');
      expect(html).toContain('value="Soy"');
    });

    it('should include Flavors checkboxes', () => {
      const html = renderContributePage();
      expect(html).toContain('Flavors');
      expect(html).toContain('name="flavors"');
      expect(html).toContain('value="Sweet"');
      expect(html).toContain('value="Savory"');
      expect(html).toContain('value="Umami"');
    });

    it('should include Kitchen Tools checkboxes', () => {
      const html = renderContributePage();
      expect(html).toContain('Flavors &amp; Tools');
      expect(html).toContain('name="tools"');
      expect(html).toContain('value="Oven"');
      expect(html).toContain('value="Skillet"');
    });

    it('should include custom entry fields for allergens, flavors, and tools', () => {
      const html = renderContributePage();
      expect(html).toContain('id="custom_allergies"');
      expect(html).toContain('id="custom_flavors"');
      expect(html).toContain('id="custom_tools"');
      expect(html).toContain('Additional allergens');
      expect(html).toContain('Additional flavors');
      expect(html).toContain('Additional tools');
    });

    it('should include Recipe Content textareas', () => {
      const html = renderContributePage();
      expect(html).toContain('Recipe Content');
      expect(html).toContain('id="ingredients"');
      expect(html).toContain('id="instructions"');
      expect(html).toContain('id="notes"');
    });

    it('should include submit button', () => {
      const html = renderContributePage();
      expect(html).toContain('Submit Recipe via GitHub');
      expect(html).toContain('type="submit"');
    });

    it('should include form submission JavaScript', () => {
      const html = renderContributePage();
      expect(html).toContain('<script>');
      expect(html).toContain('recipe-form');
      expect(html).toContain('github.com/greynewell/claude-chef/issues/new');
      expect(html).toContain('recipe-submission');
      expect(html).toContain('buildDuration');
      expect(html).toContain('mergeWithCustom');
    });

    it('should include the footer CTA', () => {
      const html = renderContributePage();
      expect(html).toContain('Your AI Sous Chef, Ready When You Are');
      expect(html).toContain('Contribute to Claude Chef');
    });

    it('should include site brand link back to index', () => {
      const html = renderContributePage();
      expect(html).toContain('href="/index.html"');
    });

    it('should include Contribute nav link', () => {
      const html = renderContributePage();
      expect(html).toContain('href="/contribute.html"');
    });

    it('should include About nav link', () => {
      const html = renderContributePage();
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Install nav link', () => {
      const html = renderContributePage();
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });
  });

  describe('renderFavoritesPage', () => {
    it('should produce valid HTML with doctype', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toMatch(/^<!DOCTYPE html>/);
    });

    it('should include the page title with recipe count', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('<title>Our 1 Favorites | Claude Chef</title>');
    });

    it('should include meta description with recipe count', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('name="description"');
      expect(html).toContain('curated collection of our 1 favorite recipes');
    });

    it('should include canonical URL', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('<link rel="canonical" href="https://claudechef.com/favorites.html">');
    });

    it('should include og:title meta tag with recipe count', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('og:title');
      expect(html).toContain('Our 1 Favorites | Claude Chef');
    });

    it('should include og:url meta tag', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('og:url');
      expect(html).toContain('https://claudechef.com/favorites.html');
    });

    it('should include og:image meta tag', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('og:image');
    });

    it('should include og:site_name meta tag', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('og:site_name');
      expect(html).toContain('Claude Chef');
    });

    it('should include Twitter Card meta tags', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('twitter:card');
      expect(html).toContain('summary_large_image');
      expect(html).toContain('twitter:title');
      expect(html).toContain('twitter:description');
      expect(html).toContain('twitter:image');
    });

    it('should include visual breadcrumb', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('class="breadcrumb"');
      expect(html).toContain('Home');
      expect(html).toContain('Favorites');
    });

    it('should include the hero heading with recipe count', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('<h1>Our 1 Favorites</h1>');
    });

    it('should include the intro paragraph', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('favorites-intro');
      expect(html).toContain('hand-picked selection of recipes');
    });

    it('should render recipe cards with .favorite class', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('recipe-card favorite');
      expect(html).toContain('Test Recipe');
      expect(html).toContain('/test-recipe.html');
    });

    it('should include the footer CTA', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('Your AI Sous Chef, Ready When You Are');
      expect(html).toContain('/plugin marketplace add greynewell/claude-chef');
    });

    it('should include site brand link back to index', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('href="/index.html"');
    });

    it('should include Install nav link', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('href="/install.html"');
      expect(html).toContain('Install');
    });

    it('should include About nav link', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('href="/about.html"');
      expect(html).toContain('About');
    });

    it('should include Contribute nav link', () => {
      const html = renderFavoritesPage([mockRecipe]);
      expect(html).toContain('href="/contribute.html"');
      expect(html).toContain('Contribute');
    });

    it('should show empty state message when no recipes', () => {
      const html = renderFavoritesPage([]);
      expect(html).toContain('No favorites yet');
    });

    it('should not render recipe grid when no recipes', () => {
      const html = renderFavoritesPage([]);
      expect(html).not.toContain('<ul class="recipe-grid"');
      expect(html).not.toContain('<li class="recipe-card');
    });

    it('should include ItemList JSON-LD when provided', () => {
      const itemListJsonLd = {
        '@context': 'https://schema.org' as const,
        '@type': 'ItemList' as const,
        name: 'Favorites',
        description: 'Favorite recipes',
        numberOfItems: 1,
        itemListElement: [{ '@type': 'ListItem' as const, position: 1, url: 'https://claudechef.com/test-recipe.html', name: 'Test Recipe' }],
      };
      const html = renderFavoritesPage([mockRecipe], { itemListJsonLd });
      expect(html).toContain('ItemList');
    });

    it('should include BreadcrumbList JSON-LD when provided', () => {
      const breadcrumbJsonLd = {
        '@context': 'https://schema.org' as const,
        '@type': 'BreadcrumbList' as const,
        itemListElement: [
          { '@type': 'ListItem' as const, position: 1, name: 'Home', item: 'https://claudechef.com/index.html' },
          { '@type': 'ListItem' as const, position: 2, name: 'Favorites' },
        ],
      };
      const html = renderFavoritesPage([mockRecipe], { breadcrumbJsonLd });
      expect(html).toContain('BreadcrumbList');
    });
  });

  describe('renderRecipeCard', () => {
    const mockRecipeWithMeta: ParsedRecipe = {
      frontmatter: {
        title: 'Teriyaki Salmon',
        description: 'Glazed salmon with homemade teriyaki sauce.',
        author: 'Claude Chef Community',
        prep_time: 'PT15M',
        cook_time: 'PT1H30M',
        servings: 4,
        calories: 650,
        keywords: ['salmon', 'teriyaki'],
        skill_level: 'Intermediate',
        cuisine: 'Japanese',
        recipe_category: 'Main Course',
      },
      ingredients: ['400g salmon', '60ml soy sauce'],
      instructions: ['Marinate salmon.', 'Bake at 200C.'],
      body: '## Ingredients\n\n- 400g salmon\n- 60ml soy sauce\n\n## Instructions\n\n1. Marinate salmon.\n2. Bake at 200C.',
      faqs: [],
      slug: 'teriyaki-salmon',
      sourceFile: 'teriyaki-salmon.md',
    };

    it('should render an <li> with recipe-card class', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toMatch(/<li class="recipe-card">/);
    });

    it('should include the recipe title as a link', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<a href="teriyaki-salmon.html">Teriyaki Salmon</a>');
    });

    it('should include the description in a .desc div', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<div class="desc">Glazed salmon with homemade teriyaki sauce.</div>');
    });

    it('should include a .card-meta container', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<div class="card-meta">');
    });

    it('should use relative href by default', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('href="teriyaki-salmon.html"');
      expect(html).not.toContain('href="/teriyaki-salmon.html"');
    });

    it('should use absolute href when absoluteHref is true', () => {
      const html = renderRecipeCard(mockRecipeWithMeta, { absoluteHref: true });
      expect(html).toContain('href="/teriyaki-salmon.html"');
    });

    it('should not add favorite class by default', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<li class="recipe-card">');
      expect(html).not.toContain('favorite');
    });

    it('should add favorite class when favorite is true', () => {
      const html = renderRecipeCard(mockRecipeWithMeta, { favorite: true });
      expect(html).toContain('<li class="recipe-card favorite">');
    });

    it('should render prep time pill', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<span class="meta-pill meta-info">Prep 15min</span>');
    });

    it('should render cook time pill with hours and minutes', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<span class="meta-pill meta-info">Cook 1hr 30min</span>');
    });

    it('should render calories pill', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<span class="meta-pill meta-info">650 cal</span>');
    });

    it('should render skill level badge with correct class and link', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<a class="skill-badge intermediate" href="/skill_level/intermediate.html">Intermediate</a>');
    });

    it('should render cuisine pill with correct class and link', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<a class="meta-pill tax-cuisine" href="/cuisine/japanese.html">Japanese</a>');
    });

    it('should render category pill with correct class and link', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('<a class="meta-pill tax-category" href="/category/main-course.html">Main Course</a>');
    });

    it('should omit skill badge when skill_level is absent', () => {
      const html = renderRecipeCard(mockRecipe);
      expect(html).not.toContain('skill-badge');
    });

    it('should omit cuisine pill when cuisine is absent', () => {
      const html = renderRecipeCard(mockRecipe);
      expect(html).not.toContain('tax-cuisine');
    });

    it('should omit category pill when recipe_category is absent', () => {
      const html = renderRecipeCard(mockRecipe);
      expect(html).not.toContain('tax-category');
    });

    it('should still render prep, cook, and calories when optional fields are absent', () => {
      const html = renderRecipeCard(mockRecipe);
      expect(html).toContain('<span class="meta-pill meta-info">Prep 10min</span>');
      expect(html).toContain('<span class="meta-pill meta-info">Cook 20min</span>');
      expect(html).toContain('<span class="meta-pill meta-info">500 cal</span>');
    });

    it('should support both absoluteHref and favorite together', () => {
      const html = renderRecipeCard(mockRecipeWithMeta, { absoluteHref: true, favorite: true });
      expect(html).toContain('<li class="recipe-card favorite">');
      expect(html).toContain('href="/teriyaki-salmon.html"');
    });

    it('should format PT10M as 10min', () => {
      const html = renderRecipeCard(mockRecipe);
      expect(html).toContain('Prep 10min');
    });

    it('should format PT1H30M as 1hr 30min', () => {
      const html = renderRecipeCard(mockRecipeWithMeta);
      expect(html).toContain('Cook 1hr 30min');
    });
  });
});
