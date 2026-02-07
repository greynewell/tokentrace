import { parseIngredient } from '../src/generator/ingredient-parser';

describe('parseIngredient', () => {
  it('should parse pound unit with description', () => {
    const result = parseIngredient('1 lb boneless skinless chicken breasts');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('pound');
    expect(result.description).toBe('boneless skinless chicken breasts');
  });

  it('should parse cup unit with description', () => {
    const result = parseIngredient('1 cup teriyaki sauce (Kikkoman recommended)');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('teriyaki sauce (Kikkoman recommended)');
  });

  it('should parse fraction quantity with unit', () => {
    const result = parseIngredient('1/2 teaspoon salt');
    expect(result.quantity).toBe(0.5);
    expect(result.unit).toBe('teaspoon');
    expect(result.description).toBe('salt');
  });

  it('should parse number without unit when next word is not a unit', () => {
    const result = parseIngredient('1 large head broccoli');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('');
    expect(result.description).toBe('large head broccoli');
  });

  it('should parse tablespoons unit', () => {
    const result = parseIngredient('2 tablespoons Worcestershire sauce');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('tablespoon');
    expect(result.description).toBe('Worcestershire sauce');
  });

  it('should parse number with no unit for countable items', () => {
    const result = parseIngredient('4 egg yolks');
    expect(result.quantity).toBe(4);
    expect(result.unit).toBe('');
    expect(result.description).toBe('egg yolks');
  });

  it('should return null quantity for non-numeric start (to taste)', () => {
    const result = parseIngredient('Cracked black pepper, to taste');
    expect(result.quantity).toBeNull();
    expect(result.unit).toBe('');
    expect(result.description).toBe('Cracked black pepper, to taste');
  });

  it('should return null quantity for non-numeric start (for garnish)', () => {
    const result = parseIngredient('Sesame seeds, for garnish');
    expect(result.quantity).toBeNull();
    expect(result.unit).toBe('');
    expect(result.description).toBe('Sesame seeds, for garnish');
  });

  it('should handle empty string', () => {
    const result = parseIngredient('');
    expect(result.quantity).toBeNull();
    expect(result.unit).toBe('');
    expect(result.description).toBe('');
  });

  it('should handle just a number', () => {
    const result = parseIngredient('3');
    expect(result.quantity).toBe(3);
    expect(result.unit).toBe('');
    expect(result.description).toBe('');
  });

  it('should parse decimal quantity with unit', () => {
    const result = parseIngredient('0.5 oz cream cheese');
    expect(result.quantity).toBe(0.5);
    expect(result.unit).toBe('ounce');
    expect(result.description).toBe('cream cheese');
  });

  it('should parse mixed number', () => {
    const result = parseIngredient('1 1/2 cups water');
    expect(result.quantity).toBe(1.5);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('water');
  });

  it('should normalize abbreviated unit tbsp to tablespoon', () => {
    const result = parseIngredient('2 tbsp oil');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('tablespoon');
    expect(result.description).toBe('oil');
  });

  it('should normalize abbreviated unit tsp to teaspoon', () => {
    const result = parseIngredient('1 tsp vanilla');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('teaspoon');
    expect(result.description).toBe('vanilla');
  });

  it('should return null quantity for text starting with Salt', () => {
    const result = parseIngredient('Salt, to taste');
    expect(result.quantity).toBeNull();
    expect(result.unit).toBe('');
    expect(result.description).toBe('Salt, to taste');
  });

  it('should preserve original string', () => {
    const result = parseIngredient('1 cup flour');
    expect(result.original).toBe('1 cup flour');
  });

  it('should parse plural cups', () => {
    const result = parseIngredient('2 cups sugar');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('sugar');
  });

  it('should parse grams with g abbreviation', () => {
    const result = parseIngredient('100 g butter');
    expect(result.quantity).toBe(100);
    expect(result.unit).toBe('gram');
    expect(result.description).toBe('butter');
  });

  it('should parse pinch unit', () => {
    const result = parseIngredient('1 pinch cayenne');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('pinch');
    expect(result.description).toBe('cayenne');
  });

  it('should parse cloves unit', () => {
    const result = parseIngredient('3 cloves garlic');
    expect(result.quantity).toBe(3);
    expect(result.unit).toBe('clove');
    expect(result.description).toBe('garlic');
  });

  it('should parse Unicode fraction ½', () => {
    const result = parseIngredient('½ teaspoon salt');
    expect(result.quantity).toBe(0.5);
    expect(result.unit).toBe('teaspoon');
    expect(result.description).toBe('salt');
  });

  it('should parse Unicode fraction ¼', () => {
    const result = parseIngredient('¼ cup sugar');
    expect(result.quantity).toBe(0.25);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('sugar');
  });

  it('should parse Unicode fraction ¾', () => {
    const result = parseIngredient('¾ cup flour');
    expect(result.quantity).toBe(0.75);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('flour');
  });

  it('should parse mixed number with Unicode fraction 1 ½', () => {
    const result = parseIngredient('1 ½ cups water');
    expect(result.quantity).toBe(1.5);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('water');
  });

  it('should parse mixed number with Unicode fraction without space 1½', () => {
    const result = parseIngredient('1½ teaspoons cinnamon');
    expect(result.quantity).toBe(1.5);
    expect(result.unit).toBe('teaspoon');
    expect(result.description).toBe('cinnamon');
  });

  it('should parse Unicode fraction ⅓', () => {
    const result = parseIngredient('⅓ cup milk');
    expect(result.quantity).toBeCloseTo(0.333, 2);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('milk');
  });

  it('should parse mixed number with Unicode fraction 2 ¼', () => {
    const result = parseIngredient('2 ¼ cups flour');
    expect(result.quantity).toBe(2.25);
    expect(result.unit).toBe('cup');
    expect(result.description).toBe('flour');
  });
});
