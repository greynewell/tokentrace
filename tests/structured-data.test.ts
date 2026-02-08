import { generateJsonLd, computeTotalTime, generateBreadcrumbJsonLd, generateWebSiteJsonLd, generateItemListJsonLd, generateCollectionPageJsonLd, generateTaxonomyIndexJsonLd, generateHubBreadcrumbJsonLd } from '../src/generator/structured-data';
import { ParsedRecipe, TaxonomyDescriptions, TaxonomyEntry, Taxonomy } from '../src/types';

const mockRecipe: ParsedRecipe = {
  frontmatter: {
    title: 'Test Carbonara',
    description: 'A test carbonara recipe.',
    author: 'Claude Chef Community',
    prep_time: 'PT10M',
    cook_time: 'PT20M',
    servings: 2,
    calories: 680,
    keywords: ['pasta', 'Italian', 'high-protein'],
    recipe_category: 'Main Course',
    cuisine: 'Italian',
    image: 'https://claudechef.com/images/test-carbonara.jpg',
  },
  ingredients: ['200g spaghetti', '150g guanciale', '4 egg yolks'],
  instructions: ['Boil the pasta.', 'Render the guanciale.', 'Combine and serve.'],
  body: '',
  faqs: [],
  slug: 'test-carbonara',
  sourceFile: 'test-carbonara.md',
};

describe('Structured Data (JSON-LD)', () => {
  it('should generate valid JSON-LD with @context and @type', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Recipe');
  });

  it('should set the recipe name from frontmatter title', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.name).toBe('Test Carbonara');
  });

  it('should set author as a Person', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.author['@type']).toBe('Person');
    expect(jsonLd.author.name).toBe('Claude Chef Community');
  });

  it('should set datePublished from the provided date', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-06-20');
    expect(jsonLd.datePublished).toBe('2024-06-20');
  });

  it('should normalize invalid datePublished to a valid ISO 8601 date', () => {
    const jsonLd = generateJsonLd(mockRecipe, 'not-a-date');
    expect(jsonLd.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should include prep and cook times in ISO 8601 duration', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.prepTime).toBe('PT10M');
    expect(jsonLd.cookTime).toBe('PT20M');
  });

  it('should include nutrition information', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.nutrition['@type']).toBe('NutritionInformation');
    expect(jsonLd.nutrition.calories).toBe('680 calories');
  });

  it('should include all ingredients as an array', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.recipeIngredient).toEqual(['200g spaghetti', '150g guanciale', '4 egg yolks']);
  });

  it('should format instructions as HowToStep objects with positions, names, and urls', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15', 'https://claudechef.com');
    expect(jsonLd.recipeInstructions).toHaveLength(3);
    expect(jsonLd.recipeInstructions[0]).toEqual({
      '@type': 'HowToStep',
      text: 'Boil the pasta.',
      name: 'Boil the pasta.',
      url: 'https://claudechef.com/test-carbonara.html#step-1',
      position: 1,
    });
    expect(jsonLd.recipeInstructions[2].position).toBe(3);
    expect(jsonLd.recipeInstructions[2].url).toBe('https://claudechef.com/test-carbonara.html#step-3');
  });

  it('should truncate long instruction text for step name', () => {
    const longRecipe = {
      ...mockRecipe,
      instructions: ['In a large pot, bring water to a rolling boil then carefully add the pasta and cook until al dente, stirring occasionally to prevent sticking.'],
    };
    const jsonLd = generateJsonLd(longRecipe, '2024-01-15');
    expect(jsonLd.recipeInstructions[0].name.length).toBeLessThanOrEqual(81); // 80 + ellipsis
    expect(jsonLd.recipeInstructions[0].text).toBe(longRecipe.instructions[0]);
  });

  it('should include keywords with Claude Chef branding', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.keywords).toContain('Claude Chef');
    expect(jsonLd.keywords).toContain('AI Cooking');
    expect(jsonLd.keywords).toContain('pasta');
  });

  it('should set recipeYield from servings', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.recipeYield).toBe('2 servings');
  });

  it('should compute totalTime from prep + cook times', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.totalTime).toBe('PT30M');
  });

  it('should include recipeCategory and recipeCuisine when present', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.recipeCategory).toBe('Main Course');
    expect(jsonLd.recipeCuisine).toBe('Italian');
  });

  it('should include image array', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15');
    expect(jsonLd.image).toEqual(['https://claudechef.com/images/test-carbonara.jpg']);
  });

  it('should include url when baseUrl is provided', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15', 'https://claudechef.com');
    expect(jsonLd.url).toBe('https://claudechef.com/test-carbonara.html');
  });

  it('should include author url with profile path when baseUrl is provided', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15', 'https://claudechef.com');
    expect(jsonLd.author.url).toBe('https://claudechef.com/author/claude-chef-community.html');
  });

  it('should include isRelatedTo when pairings are provided', () => {
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
      body: '',
      faqs: [],
      slug: 'teriyaki-roasted-broccoli',
      sourceFile: 'teriyaki-roasted-broccoli.md',
    };
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15', 'https://claudechef.com', [pairedRecipe]);
    expect(jsonLd.isRelatedTo).toBeDefined();
    expect(jsonLd.isRelatedTo).toHaveLength(1);
    expect(jsonLd.isRelatedTo![0]['@type']).toBe('Recipe');
    expect(jsonLd.isRelatedTo![0].name).toBe('Roasted Broccoli');
    expect(jsonLd.isRelatedTo![0].url).toBe('https://claudechef.com/teriyaki-roasted-broccoli.html');
  });

  it('should not include isRelatedTo when no pairings', () => {
    const jsonLd = generateJsonLd(mockRecipe, '2024-01-15', 'https://claudechef.com');
    expect(jsonLd.isRelatedTo).toBeUndefined();
  });

  it('should use default image when frontmatter image is not set', () => {
    const noImageRecipe = { ...mockRecipe, frontmatter: { ...mockRecipe.frontmatter, image: undefined } };
    const jsonLd = generateJsonLd(noImageRecipe, '2024-01-15');
    expect(jsonLd.image).toEqual(['https://claudechef.com/images/og-default.jpg']);
  });
});

describe('computeTotalTime', () => {
  it('should add minutes-only durations', () => {
    expect(computeTotalTime('PT10M', 'PT20M')).toBe('PT30M');
  });

  it('should handle hours and minutes', () => {
    expect(computeTotalTime('PT30M', 'PT4H')).toBe('PT4H30M');
  });

  it('should handle zero cook time', () => {
    expect(computeTotalTime('PT5M', 'PT0M')).toBe('PT5M');
  });

  it('should handle hours-only result', () => {
    expect(computeTotalTime('PT30M', 'PT1H30M')).toBe('PT2H');
  });
});

describe('BreadcrumbList JSON-LD', () => {
  it('should generate a valid BreadcrumbList', () => {
    const breadcrumb = generateBreadcrumbJsonLd(mockRecipe, 'https://claudechef.com');
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[0].name).toBe('Home');
    expect(breadcrumb.itemListElement[0].item).toBe('https://claudechef.com/index.html');
    expect(breadcrumb.itemListElement[1].name).toBe('Test Carbonara');
  });

  it('should generate 3-level breadcrumb when categoryBreadcrumb is provided', () => {
    const breadcrumb = generateBreadcrumbJsonLd(mockRecipe, 'https://claudechef.com', {
      name: 'Main Course',
      slug: 'main-course',
    });
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement[0].name).toBe('Home');
    expect(breadcrumb.itemListElement[1].name).toBe('Main Course');
    expect(breadcrumb.itemListElement[1].item).toBe('https://claudechef.com/category/main-course.html');
    expect(breadcrumb.itemListElement[2].name).toBe('Test Carbonara');
    expect(breadcrumb.itemListElement[2].position).toBe(3);
  });
});

describe('WebSite JSON-LD', () => {
  it('should generate a valid WebSite schema', () => {
    const schema = generateWebSiteJsonLd('https://claudechef.com');
    expect(schema['@type']).toBe('WebSite');
    expect(schema.name).toBe('Claude Chef');
    expect(schema.url).toBe('https://claudechef.com');
    expect(schema.publisher['@type']).toBe('Organization');
  });
});

describe('ItemList JSON-LD', () => {
  it('should generate an ItemList with all recipes', () => {
    const list = generateItemListJsonLd([mockRecipe], 'https://claudechef.com');
    expect(list['@type']).toBe('ItemList');
    expect(list.numberOfItems).toBe(1);
    expect(list.itemListElement[0].name).toBe('Test Carbonara');
    expect(list.itemListElement[0].url).toBe('https://claudechef.com/test-carbonara.html');
  });
});

describe('CollectionPage JSON-LD', () => {
  const entry: TaxonomyEntry = {
    name: 'Main Course',
    slug: 'main-course',
    recipes: [mockRecipe],
  };

  it('should generate a CollectionPage with correct type', () => {
    const jsonLd = generateCollectionPageJsonLd('category', entry, 'https://claudechef.com');
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('CollectionPage');
  });

  it('should include the correct URL', () => {
    const jsonLd = generateCollectionPageJsonLd('category', entry, 'https://claudechef.com');
    expect(jsonLd.url).toBe('https://claudechef.com/category/main-course.html');
  });

  it('should include mainEntity ItemList with recipes', () => {
    const jsonLd = generateCollectionPageJsonLd('category', entry, 'https://claudechef.com');
    expect(jsonLd.mainEntity['@type']).toBe('ItemList');
    expect(jsonLd.mainEntity.numberOfItems).toBe(1);
    expect(jsonLd.mainEntity.itemListElement[0].name).toBe('Test Carbonara');
    expect(jsonLd.mainEntity.itemListElement[0].url).toBe('https://claudechef.com/test-carbonara.html');
  });

  it('should work for cuisine type', () => {
    const jsonLd = generateCollectionPageJsonLd('cuisine', { name: 'Italian', slug: 'italian', recipes: [mockRecipe] }, 'https://claudechef.com');
    expect(jsonLd.url).toBe('https://claudechef.com/cuisine/italian.html');
    expect(jsonLd.name).toBe('Italian Recipes');
  });

  it('should work for ingredient type', () => {
    const jsonLd = generateCollectionPageJsonLd('ingredient', { name: 'Chicken', slug: 'chicken', recipes: [mockRecipe] }, 'https://claudechef.com');
    expect(jsonLd.url).toBe('https://claudechef.com/ingredient/chicken.html');
    expect(jsonLd.name).toBe('Chicken Recipes');
  });

  it('should work for skill_level type', () => {
    const jsonLd = generateCollectionPageJsonLd('skill_level', { name: 'Easy', slug: 'easy', recipes: [mockRecipe] }, 'https://claudechef.com');
    expect(jsonLd.url).toBe('https://claudechef.com/skill_level/easy.html');
    expect(jsonLd.name).toBe('Easy Recipes');
  });

  it('should use descriptions for name and description when provided', () => {
    const descriptions: TaxonomyDescriptions = {
      hubTitle: (name) => `Recipes with ${name}`,
      hubMetaDescription: (name) => `Find recipes with ${name.toLowerCase()}.`,
      hubSubheading: (name, count) => `${count} recipes`,
      indexDescription: 'Find recipes by ingredient.',
      collectionDescription: (name) => `Recipes featuring ${name.toLowerCase()} from Claude Chef.`,
    };
    const jsonLd = generateCollectionPageJsonLd('ingredient', entry, 'https://claudechef.com', descriptions);
    expect(jsonLd.name).toBe('Recipes with Main Course');
    expect(jsonLd.description).toBe('Recipes featuring main course from Claude Chef.');
  });

  it('should use totalRecipeCount for numberOfItems when provided', () => {
    const jsonLd = generateCollectionPageJsonLd('category', entry, 'https://claudechef.com', null, 500);
    expect(jsonLd.mainEntity.numberOfItems).toBe(500);
    expect(jsonLd.mainEntity.itemListElement).toHaveLength(1); // only current page recipes
  });

  it('should fall back to entry.recipes.length when totalRecipeCount is not provided', () => {
    const jsonLd = generateCollectionPageJsonLd('category', entry, 'https://claudechef.com');
    expect(jsonLd.mainEntity.numberOfItems).toBe(1);
  });
});

describe('Taxonomy Index JSON-LD', () => {
  const taxonomy: Taxonomy = {
    type: 'category',
    label: 'Categories',
    labelSingular: 'Category',
    entries: [
      { name: 'Main Course', slug: 'main-course', recipes: [mockRecipe] },
      { name: 'Side Dish', slug: 'side-dish', recipes: [] },
    ],
    descriptions: {
      hubTitle: (name) => `${name} Recipes`,
      hubMetaDescription: (name) => `Browse ${name.toLowerCase()} recipes.`,
      hubSubheading: (name, count) => `${count} recipes`,
      indexDescription: 'Browse by meal type.',
      collectionDescription: (name) => `A collection of ${name.toLowerCase()} recipes.`,
    },
  };

  it('should generate an ItemList with taxonomy entries', () => {
    const jsonLd = generateTaxonomyIndexJsonLd(taxonomy, 'https://claudechef.com');
    expect(jsonLd['@type']).toBe('ItemList');
    expect(jsonLd.numberOfItems).toBe(2);
  });

  it('should include correct entry URLs', () => {
    const jsonLd = generateTaxonomyIndexJsonLd(taxonomy, 'https://claudechef.com');
    expect(jsonLd.itemListElement[0].url).toBe('https://claudechef.com/category/main-course.html');
    expect(jsonLd.itemListElement[1].url).toBe('https://claudechef.com/category/side-dish.html');
  });
});

describe('Hub Breadcrumb JSON-LD', () => {
  it('should generate 2-level breadcrumb for index pages', () => {
    const breadcrumb = generateHubBreadcrumbJsonLd('category', 'Categories', null, 'https://claudechef.com');
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[0].name).toBe('Home');
    expect(breadcrumb.itemListElement[1].name).toBe('Categories');
    expect(breadcrumb.itemListElement[1].item).toBeUndefined();
  });

  it('should generate 3-level breadcrumb for hub pages', () => {
    const breadcrumb = generateHubBreadcrumbJsonLd('category', 'Categories', 'Main Course', 'https://claudechef.com');
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement[0].name).toBe('Home');
    expect(breadcrumb.itemListElement[1].name).toBe('Categories');
    expect(breadcrumb.itemListElement[1].item).toBe('https://claudechef.com/category/index.html');
    expect(breadcrumb.itemListElement[2].name).toBe('Main Course');
    expect(breadcrumb.itemListElement[2].item).toBeUndefined();
  });

  it('should generate breadcrumb for ingredient hub page', () => {
    const breadcrumb = generateHubBreadcrumbJsonLd('ingredient', 'Ingredients', 'Chicken', 'https://claudechef.com');
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement[1].name).toBe('Ingredients');
    expect(breadcrumb.itemListElement[1].item).toBe('https://claudechef.com/ingredient/index.html');
    expect(breadcrumb.itemListElement[2].name).toBe('Chicken');
  });

  it('should generate breadcrumb for skill_level hub page', () => {
    const breadcrumb = generateHubBreadcrumbJsonLd('skill_level', 'Skill Levels', 'Easy', 'https://claudechef.com');
    expect(breadcrumb.itemListElement).toHaveLength(3);
    expect(breadcrumb.itemListElement[1].name).toBe('Skill Levels');
    expect(breadcrumb.itemListElement[1].item).toBe('https://claudechef.com/skill_level/index.html');
    expect(breadcrumb.itemListElement[2].name).toBe('Easy');
  });
});
