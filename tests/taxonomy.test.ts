import { toSlug, buildAllTaxonomies, TAXONOMY_CONFIGS } from '../src/generator/taxonomy';
import { ParsedRecipe } from '../src/types';

describe('toSlug', () => {
  it('should convert spaces to hyphens', () => {
    expect(toSlug('Main Course')).toBe('main-course');
  });

  it('should lowercase the result', () => {
    expect(toSlug('Japanese-American')).toBe('japanese-american');
  });

  it('should collapse multiple special characters into a single hyphen', () => {
    expect(toSlug('foo & bar')).toBe('foo-bar');
  });

  it('should strip leading and trailing hyphens', () => {
    expect(toSlug('  Main Course  ')).toBe('main-course');
    expect(toSlug('--test--')).toBe('test');
  });

  it('should handle already-slugified strings', () => {
    expect(toSlug('side-dish')).toBe('side-dish');
  });

  it('should handle special characters', () => {
    expect(toSlug("Chef's Special!")).toBe('chef-s-special');
  });

  it('should return empty string for whitespace-only input', () => {
    expect(toSlug('   ')).toBe('');
  });
});

const makeRecipe = (overrides: Partial<ParsedRecipe['frontmatter']> = {}): ParsedRecipe => ({
  frontmatter: {
    title: 'Test Recipe',
    description: 'A test recipe.',
    author: 'Claude Chef Community',
    prep_time: 'PT10M',
    cook_time: 'PT20M',
    servings: 4,
    calories: 300,
    keywords: [],
    ...overrides,
  },
  ingredients: ['1 cup water'],
  instructions: ['Boil water.'],
  body: '',
  faqs: [],
  slug: 'test-recipe',
  sourceFile: 'test-recipe.md',
});

describe('buildAllTaxonomies', () => {
  it('should return six taxonomies', () => {
    const taxonomies = buildAllTaxonomies([]);
    expect(taxonomies).toHaveLength(6);
    expect(taxonomies[0].type).toBe('category');
    expect(taxonomies[1].type).toBe('cuisine');
    expect(taxonomies[2].type).toBe('ingredient');
    expect(taxonomies[3].type).toBe('flavor');
    expect(taxonomies[4].type).toBe('tool');
    expect(taxonomies[5].type).toBe('skill_level');
  });

  it('should have correct labels', () => {
    const taxonomies = buildAllTaxonomies([]);
    expect(taxonomies[0].label).toBe('Categories');
    expect(taxonomies[0].labelSingular).toBe('Category');
    expect(taxonomies[1].label).toBe('Cuisines');
    expect(taxonomies[1].labelSingular).toBe('Cuisine');
    expect(taxonomies[2].label).toBe('Ingredients');
    expect(taxonomies[2].labelSingular).toBe('Ingredient');
    expect(taxonomies[3].label).toBe('Flavors');
    expect(taxonomies[3].labelSingular).toBe('Flavor');
    expect(taxonomies[4].label).toBe('Tools');
    expect(taxonomies[4].labelSingular).toBe('Tool');
    expect(taxonomies[5].label).toBe('Skill Levels');
    expect(taxonomies[5].labelSingular).toBe('Skill Level');
  });

  it('should return empty entries for empty input', () => {
    const taxonomies = buildAllTaxonomies([]);
    for (const t of taxonomies) {
      expect(t.entries).toHaveLength(0);
    }
  });

  it('should group recipes by category', () => {
    const r1 = makeRecipe({ title: 'Chicken', recipe_category: 'Main Course' });
    const r2 = makeRecipe({ title: 'Salad', recipe_category: 'Side Dish' });
    const r3 = makeRecipe({ title: 'Steak', recipe_category: 'Main Course' });

    const taxonomies = buildAllTaxonomies([r1, r2, r3]);
    const categories = taxonomies[0];
    expect(categories.entries).toHaveLength(2);
    const mainCourse = categories.entries.find(e => e.slug === 'main-course');
    expect(mainCourse).toBeDefined();
    expect(mainCourse!.recipes).toHaveLength(2);
    expect(mainCourse!.name).toBe('Main Course');
  });

  it('should group recipes by cuisine', () => {
    const r1 = makeRecipe({ title: 'Ramen', cuisine: 'Japanese' });
    const r2 = makeRecipe({ title: 'Teriyaki', cuisine: 'Japanese' });

    const taxonomies = buildAllTaxonomies([r1, r2]);
    const cuisines = taxonomies[1];
    expect(cuisines.entries).toHaveLength(1);
    expect(cuisines.entries[0].slug).toBe('japanese');
    expect(cuisines.entries[0].recipes).toHaveLength(2);
  });

  it('should handle missing category and cuisine fields', () => {
    const r = makeRecipe({ recipe_category: undefined, cuisine: undefined });
    const taxonomies = buildAllTaxonomies([r]);
    expect(taxonomies[0].entries).toHaveLength(0);
    expect(taxonomies[1].entries).toHaveLength(0);
  });

  it('should deduplicate by slug (case insensitive)', () => {
    const r1 = makeRecipe({ title: 'R1', recipe_category: 'Main Course' });
    const r2 = makeRecipe({ title: 'R2', recipe_category: 'main course' });

    const taxonomies = buildAllTaxonomies([r1, r2]);
    const categories = taxonomies[0];
    expect(categories.entries).toHaveLength(1);
    expect(categories.entries[0].name).toBe('Main Course'); // first-seen casing
    expect(categories.entries[0].recipes).toHaveLength(2);
  });

  it('should sort entries alphabetically by slug', () => {
    const r1 = makeRecipe({ title: 'R1', recipe_category: 'Side Dish' });
    const r2 = makeRecipe({ title: 'R2', recipe_category: 'Appetizer' });
    const r3 = makeRecipe({ title: 'R3', recipe_category: 'Main Course' });

    const taxonomies = buildAllTaxonomies([r1, r2, r3]);
    const slugs = taxonomies[0].entries.map(e => e.slug);
    expect(slugs).toEqual(['appetizer', 'main-course', 'side-dish']);
  });

  it('should group recipes by ingredient', () => {
    const r1 = makeRecipe({ title: 'R1', recipe_ingredients: ['Chicken', 'Butter'] });
    const r2 = makeRecipe({ title: 'R2', recipe_ingredients: ['Chicken', 'Rice'] });

    const taxonomies = buildAllTaxonomies([r1, r2]);
    const ingredients = taxonomies[2];
    const chicken = ingredients.entries.find(e => e.slug === 'chicken');
    expect(chicken).toBeDefined();
    expect(chicken!.recipes).toHaveLength(2);
    expect(ingredients.entries.find(e => e.slug === 'butter')).toBeDefined();
    expect(ingredients.entries.find(e => e.slug === 'rice')).toBeDefined();
  });

  it('should group recipes by flavor', () => {
    const r1 = makeRecipe({ title: 'R1', flavors: ['Sweet', 'Umami'] });
    const r2 = makeRecipe({ title: 'R2', flavors: ['Umami'] });

    const taxonomies = buildAllTaxonomies([r1, r2]);
    const flavors = taxonomies[3];
    const umami = flavors.entries.find(e => e.slug === 'umami');
    expect(umami).toBeDefined();
    expect(umami!.recipes).toHaveLength(2);
  });

  it('should group recipes by tool', () => {
    const r1 = makeRecipe({ title: 'R1', tools: ['Skillet', 'Oven'] });
    const r2 = makeRecipe({ title: 'R2', tools: ['Oven'] });

    const taxonomies = buildAllTaxonomies([r1, r2]);
    const tools = taxonomies[4];  // index 4 is tool
    const oven = tools.entries.find(e => e.slug === 'oven');
    expect(oven).toBeDefined();
    expect(oven!.recipes).toHaveLength(2);
  });

  it('should group recipes by skill level', () => {
    const r1 = makeRecipe({ title: 'R1', skill_level: 'Easy' });
    const r2 = makeRecipe({ title: 'R2', skill_level: 'Easy' });
    const r3 = makeRecipe({ title: 'R3', skill_level: 'Advanced' });

    const taxonomies = buildAllTaxonomies([r1, r2, r3]);
    const skill = taxonomies[5];  // index 5 is skill_level
    const easy = skill.entries.find(e => e.slug === 'easy');
    expect(easy).toBeDefined();
    expect(easy!.recipes).toHaveLength(2);
    const advanced = skill.entries.find(e => e.slug === 'advanced');
    expect(advanced).toBeDefined();
    expect(advanced!.recipes).toHaveLength(1);
  });

  it('should handle missing new taxonomy fields gracefully', () => {
    const r = makeRecipe({
      recipe_ingredients: undefined,
      flavors: undefined,
      tools: undefined,
      skill_level: undefined,
    });
    const taxonomies = buildAllTaxonomies([r]);
    // Indices 2-5 are ingredient, flavor, tool, skill_level
    for (let i = 2; i <= 5; i++) {
      expect(taxonomies[i].entries).toHaveLength(0);
    }
  });

  it('should deduplicate ingredients by slug (case insensitive)', () => {
    const r1 = makeRecipe({ title: 'R1', recipe_ingredients: ['Chicken'] });
    const r2 = makeRecipe({ title: 'R2', recipe_ingredients: ['chicken'] });

    const taxonomies = buildAllTaxonomies([r1, r2]);
    const ingredients = taxonomies[2];
    expect(ingredients.entries).toHaveLength(1);
    expect(ingredients.entries[0].name).toBe('Chicken');
    expect(ingredients.entries[0].recipes).toHaveLength(2);
  });
});

describe('TAXONOMY_CONFIGS', () => {
  it('should have 6 configs', () => {
    expect(TAXONOMY_CONFIGS).toHaveLength(6);
  });

  it('should have unique types', () => {
    const types = TAXONOMY_CONFIGS.map(c => c.type);
    expect(new Set(types).size).toBe(6);
  });
});

describe('taxonomy descriptions', () => {
  it('should include descriptions on every taxonomy from buildAllTaxonomies', () => {
    const taxonomies = buildAllTaxonomies([]);
    for (const t of taxonomies) {
      expect(t.descriptions).toBeDefined();
      expect(typeof t.descriptions.hubTitle).toBe('function');
      expect(typeof t.descriptions.hubMetaDescription).toBe('function');
      expect(typeof t.descriptions.hubSubheading).toBe('function');
      expect(typeof t.descriptions.indexDescription).toBe('string');
      expect(typeof t.descriptions.collectionDescription).toBe('function');
    }
  });

  it('should produce type-specific hub titles', () => {
    const taxonomies = buildAllTaxonomies([]);
    const byType = new Map(taxonomies.map(t => [t.type, t]));

    expect(byType.get('category')!.descriptions.hubTitle('Main Course')).toBe('Main Course Recipes');
    expect(byType.get('cuisine')!.descriptions.hubTitle('Japanese')).toBe('Japanese Recipes');
    expect(byType.get('ingredient')!.descriptions.hubTitle('Chicken')).toBe('Recipes with Chicken');
    expect(byType.get('flavor')!.descriptions.hubTitle('Umami')).toBe('Umami Recipes');
    expect(byType.get('tool')!.descriptions.hubTitle('Skillet')).toBe('Recipes Using a Skillet');
    expect(byType.get('skill_level')!.descriptions.hubTitle('Easy')).toBe('Easy Recipes');
  });

  it('should produce subheading without pagination range', () => {
    const taxonomies = buildAllTaxonomies([]);
    const ingredient = taxonomies.find(t => t.type === 'ingredient')!;
    expect(ingredient.descriptions.hubSubheading('Chicken', 42)).toBe('42 recipes with chicken');
  });

  it('should produce subheading with pagination range', () => {
    const taxonomies = buildAllTaxonomies([]);
    const ingredient = taxonomies.find(t => t.type === 'ingredient')!;
    const result = ingredient.descriptions.hubSubheading('Chicken', 5000, 1, 48);
    expect(result).toContain('Showing');
    expect(result).toContain('5,000');
    expect(result).toContain('chicken');
  });

  it('should have non-empty indexDescription for all taxonomies', () => {
    const taxonomies = buildAllTaxonomies([]);
    for (const t of taxonomies) {
      expect(t.descriptions.indexDescription.length).toBeGreaterThan(0);
    }
  });
});
