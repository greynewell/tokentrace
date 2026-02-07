export interface ParsedIngredient {
  quantity: number | null;
  unit: string;
  description: string;
  original: string;
}

const UNIT_MAP: Record<string, string> = {
  cup: 'cup', cups: 'cup',
  tablespoon: 'tablespoon', tablespoons: 'tablespoon', tbsp: 'tablespoon',
  teaspoon: 'teaspoon', teaspoons: 'teaspoon', tsp: 'teaspoon',
  pound: 'pound', pounds: 'pound', lb: 'pound', lbs: 'pound',
  ounce: 'ounce', ounces: 'ounce', oz: 'ounce',
  gram: 'gram', grams: 'gram', g: 'gram',
  kg: 'kilogram', kilogram: 'kilogram', kilograms: 'kilogram',
  ml: 'milliliter', milliliter: 'milliliter', milliliters: 'milliliter',
  liter: 'liter', liters: 'liter', l: 'liter',
  quart: 'quart', quarts: 'quart', qt: 'quart',
  pint: 'pint', pints: 'pint', pt: 'pint',
  gallon: 'gallon', gallons: 'gallon', gal: 'gallon',
  bunch: 'bunch', bunches: 'bunch',
  clove: 'clove', cloves: 'clove',
  head: 'head', heads: 'head',
  can: 'can', cans: 'can',
  package: 'package', packages: 'package', pkg: 'package',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece',
  stick: 'stick', sticks: 'stick',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  sprig: 'sprig', sprigs: 'sprig',
};

// Unicode fraction characters to decimal values
const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1/3,
  '⅔': 2/3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1/6,
  '⅚': 5/6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

function parseQuantity(text: string): { quantity: number | null; rest: string } {
  let rest = text.trimStart();

  // Try mixed number with Unicode fraction: "1 ½" or "1½"
  const unicodeMixedMatch = rest.match(/^(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?=\s|$)/);
  if (unicodeMixedMatch) {
    const whole = parseInt(unicodeMixedMatch[1], 10);
    const frac = UNICODE_FRACTIONS[unicodeMixedMatch[2]] || 0;
    return { quantity: whole + frac, rest: rest.slice(unicodeMixedMatch[0].length).trimStart() };
  }

  // Try standalone Unicode fraction: "½"
  const unicodeFracMatch = rest.match(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?=\s|$)/);
  if (unicodeFracMatch) {
    const frac = UNICODE_FRACTIONS[unicodeFracMatch[1]] || 0;
    return { quantity: frac, rest: rest.slice(unicodeFracMatch[0].length).trimStart() };
  }

  // Try mixed number: "1 1/2" (whole space fraction)
  const mixedMatch = rest.match(/^(\d+)\s+(\d+)\/(\d+)(?=\s|$)/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) {
      return { quantity: whole + num / den, rest: rest.slice(mixedMatch[0].length).trimStart() };
    }
  }

  // Try fraction: "1/2"
  const fracMatch = rest.match(/^(\d+)\/(\d+)(?=\s|$)/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const den = parseInt(fracMatch[2], 10);
    if (den !== 0) {
      return { quantity: num / den, rest: rest.slice(fracMatch[0].length).trimStart() };
    }
  }

  // Try decimal or integer: "1.5" or "1" or "100g" (number possibly followed by unit letters)
  const numMatch = rest.match(/^(\d+(?:\.\d+)?)(?=\s|[a-zA-Z]|$)/);
  if (numMatch) {
    return { quantity: parseFloat(numMatch[1]), rest: rest.slice(numMatch[0].length).trimStart() };
  }

  return { quantity: null, rest };
}

export function parseIngredient(line: string): ParsedIngredient {
  const original = line;
  const trimmed = line.trim();

  if (!trimmed) {
    return { quantity: null, unit: '', description: '', original };
  }

  const { quantity, rest } = parseQuantity(trimmed);

  if (quantity === null) {
    return { quantity: null, unit: '', description: trimmed, original };
  }

  if (!rest) {
    return { quantity, unit: '', description: '', original };
  }

  // Check if the next word is a known unit
  const wordMatch = rest.match(/^(\S+)/);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    const canonical = UNIT_MAP[word];
    if (canonical) {
      const desc = rest.slice(wordMatch[0].length).trimStart();
      return { quantity, unit: canonical, description: desc, original };
    }
  }

  return { quantity, unit: '', description: rest, original };
}
