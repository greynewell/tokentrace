/**
 * Backfill missing `cuisine:` field in recipe frontmatter.
 * Uses keyword matching on title, description, ingredients, and existing metadata.
 *
 * Usage: npx ts-node scripts/backfill-cuisine.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const RECIPES_DIR = path.resolve(__dirname, '../recipes');
const DRY_RUN = process.argv.includes('--dry-run');

// Cuisine rules: checked in order, first match wins.
// Each rule has keywords to match against title, description, ingredients, and tags.
interface CuisineRule {
  cuisine: string;
  // Any match in title triggers this cuisine (strongest signal)
  titleKeywords?: RegExp[];
  // Ingredient-level keywords (need multiple matches for weaker signals)
  ingredientKeywords?: RegExp[];
  // Minimum ingredient keyword matches needed
  ingredientThreshold?: number;
  // Tag-level keywords (recipe_ingredients, keywords)
  tagKeywords?: RegExp[];
}

const CUISINE_RULES: CuisineRule[] = [
  // Japanese — check before Chinese since teriyaki/soy overlap
  {
    cuisine: 'Japanese',
    titleKeywords: [/\bjapan/i, /\bsushi\b/i, /\bramen\b/i, /\bmiso\b/i, /\bteriyaki\b/i, /\btempura\b/i, /\bedamame\b/i, /\budon\b/i, /\bsoba\b/i, /\btonkatsu\b/i, /\bonigiri\b/i, /\bgyoza\b/i, /\bmatcha\b/i, /\bponzu\b/i, /\byakitori\b/i, /\bdonburi\b/i, /\bbento\b/i, /\bokonomiyaki\b/i, /\btakoyaki\b/i],
    ingredientKeywords: [/\bmiso\b/i, /\bnori\b/i, /\bwasabi\b/i, /\bdashi\b/i, /\bmirin\b/i, /\bsake\b/i, /\bpanko\b/i, /\btofu\b/i, /\bmatcha\b/i, /\bponzu\b/i],
    ingredientThreshold: 2,
    tagKeywords: [/\bjapan/i, /\bsushi\b/i, /\bramen\b/i, /\bmiso\b/i, /\btempura\b/i],
  },
  // Korean
  {
    cuisine: 'Korean',
    titleKeywords: [/\bkorean\b/i, /\bkimchi\b/i, /\bbibimbap\b/i, /\bbulgogi\b/i, /\bgochujang\b/i, /\bjapchae\b/i, /\btteok/i, /\bkimbap\b/i, /\bssamjang\b/i, /\bjjigae\b/i],
    ingredientKeywords: [/\bgochujang\b/i, /\bkimchi\b/i, /\bgochugaru\b/i, /\bssamjang\b/i, /\bkorean\b/i],
    ingredientThreshold: 1,
    tagKeywords: [/\bkorean\b/i, /\bkimchi\b/i, /\bbulgogi\b/i],
  },
  // Thai
  {
    cuisine: 'Thai',
    titleKeywords: [/\bthai\b/i, /\bpad\s*thai\b/i, /\btom\s*yum\b/i, /\btom\s*kha\b/i, /\bgreen\s*curry\b/i, /\bred\s*curry\b/i, /\bmassaman\b/i, /\bsom\s*tam\b/i, /\bsatay\b/i, /\bpanang\b/i],
    ingredientKeywords: [/\blemongrass\b/i, /\bgalangal\b/i, /\bthai\s*basil\b/i, /\bfish\s*sauce\b/i, /\bkaffir\b/i, /\bthai\b/i],
    ingredientThreshold: 2,
    tagKeywords: [/\bthai\b/i, /\bpad\s*thai\b/i],
  },
  // Indian
  {
    cuisine: 'Indian',
    titleKeywords: [/\bindian\b/i, /\bcurry\b/i, /\btandoori\b/i, /\bmasala\b/i, /\bbiryani\b/i, /\bdal\b/i, /\bdaal\b/i, /\bsamosa\b/i, /\bnaan\b/i, /\bchapati\b/i, /\broti\b/i, /\bpaneer\b/i, /\btikka\b/i, /\bvindaloo\b/i, /\bkorma\b/i, /\baloo\b/i, /\bchana\b/i, /\bkabab\b/i, /\bkebab\b/i, /\bpalak\b/i, /\bsaag\b/i, /\bchutney\b/i, /\bpakora\b/i, /\bdhokla\b/i, /\bkofta\b/i, /\bkheer\b/i, /\bgulab\s*jamun\b/i, /\bpulao\b/i, /\bpilaf\b/i],
    ingredientKeywords: [/\bgaram\s*masala\b/i, /\bturmeric\b/i, /\bcardamom\b/i, /\bcumin\b/i, /\bcoriander\b/i, /\bfenugreek\b/i, /\bcurry\s*powder\b/i, /\bcurry\s*paste\b/i, /\bghee\b/i, /\bpaneer\b/i, /\byogurt\b/i],
    ingredientThreshold: 3,
    tagKeywords: [/\bindian\b/i, /\bcurry\b/i, /\bmasala\b/i, /\btandoori\b/i],
  },
  // Mexican
  {
    cuisine: 'Mexican',
    titleKeywords: [/\bmexican\b/i, /\btaco\b/i, /\bburrito\b/i, /\benchilada\b/i, /\bquesadilla\b/i, /\bnacho\b/i, /\bfajita\b/i, /\bguacamole\b/i, /\bchilaquile/i, /\btamale/i, /\bempanada\b/i, /\bmole\b/i, /\bpozole\b/i, /\bcarnitas\b/i, /\bbarbacoa\b/i, /\bchorizo\b/i, /\bchipotle\b/i, /\bsalsa\b/i, /\btex[\s-]*mex\b/i, /\bhuevos\s*rancheros\b/i, /\bchurro/i, /\btostada/i, /\bsopes\b/i, /\bpico\s*de\s*gallo\b/i, /\bchile\s*relleno/i, /\bsouthwest/i, /\bal\s*pastor\b/i, /\bceviche\b/i, /\bjalape[nñ]o\b/i],
    ingredientKeywords: [/\btortilla\b/i, /\bjalape[nñ]o\b/i, /\bchipotle\b/i, /\bcilantro\b/i, /\bcumin\b/i, /\bchili\s*powder\b/i, /\btaco\s*seasoning\b/i, /\bblack\s*beans?\b/i, /\bavocado\b/i, /\blime\b/i, /\bsalsa\b/i, /\bqueso\b/i, /\bcotija\b/i],
    ingredientThreshold: 3,
    tagKeywords: [/\bmexican\b/i, /\btaco\b/i, /\bburrito\b/i, /\benchilada\b/i, /\bfajita\b/i, /\bsouthwest/i],
  },
  // Chinese
  {
    cuisine: 'Chinese',
    titleKeywords: [/\bchinese\b/i, /\bstir[\s-]*fr/i, /\bkung\s*pao\b/i, /\bchow\s*mein\b/i, /\blo\s*mein\b/i, /\bfried\s*rice\b/i, /\begg\s*roll/i, /\bspring\s*roll/i, /\bdumpling/i, /\bwonton\b/i, /\bszechuan\b/i, /\bsichuan\b/i, /\bhoisin\b/i, /\bpeking\b/i, /\bmapo\b/i, /\bgeneral\s*tso/i, /\borange\s*chicken\b/i, /\bsweet\s*and\s*sour\b/i, /\basian\b/i, /\bmongolian\b/i, /\bchar\s*siu\b/i, /\bcanton/i, /\bdim\s*sum\b/i, /\bpot\s*sticker/i, /\bbok\s*choy\b/i, /\bsesame\s*chicken\b/i],
    ingredientKeywords: [/\bsoy\s*sauce\b/i, /\bsesame\s*oil\b/i, /\bginger\b/i, /\bhoisin\b/i, /\brice\s*vinegar\b/i, /\bbok\s*choy\b/i, /\bfive[\s-]*spice\b/i, /\bwok\b/i, /\bstar\s*anise\b/i, /\bbean\s*sprout/i, /\bwater\s*chestnut/i, /\bbamboo\s*shoot/i, /\boyster\s*sauce\b/i],
    ingredientThreshold: 3,
    tagKeywords: [/\bchinese\b/i, /\basian\b/i, /\bstir[\s-]*fr/i, /\bwok\b/i],
  },
  // Italian
  {
    cuisine: 'Italian',
    titleKeywords: [/\bitalian\b/i, /\bpasta\b/i, /\blasagna\b/i, /\brisotto\b/i, /\bcarbonara\b/i, /\bpesto\b/i, /\bbruschetta\b/i, /\bfocaccia\b/i, /\bmanicotti\b/i, /\bravioli\b/i, /\bgnocchi\b/i, /\bbolognese\b/i, /\bprimavera\b/i, /\balfredo\b/i, /\bparmigiana\b/i, /\bparmesan\b/i, /\btiramisu\b/i, /\bannini\b/i, /\bpanzanella\b/i, /\bcaprese\b/i, /\bantipast/i, /\bminestrone\b/i, /\bpenne\b/i, /\bspaghetti\b/i, /\bfettuccine\b/i, /\blinguine\b/i, /\brigatoni\b/i, /\bfarfalle\b/i, /\brotini\b/i, /\borzo\b/i, /\bmacaroni\b/i, /\bpizza\b/i, /\bcalzone\b/i, /\bmeatball/i, /\barancini\b/i, /\bprosciutto\b/i, /\bpancetta\b/i, /\bfocaccia\b/i, /\bciabatta\b/i, /\bpanini\b/i, /\beggplant\s*parm/i, /\bchicken\s*parm/i, /\bveal\s*parm/i, /\bmarsala\b/i, /\bputtanesca\b/i, /\bamatriciana\b/i, /\baglio\b/i, /\be\s*olio\b/i, /\bfazool\b/i, /\bfagioli\b/i, /\bcacciatore\b/i, /\bpiccat/i, /\bscaloppine\b/i, /\bscampi\b/i, /\bziti\b/i, /\btortellini\b/i, /\bcannoli\b/i, /\bgelato\b/i, /\bpanna\s*cotta\b/i],
    ingredientKeywords: [/\bparmesan\b/i, /\bmozzarella\b/i, /\bricotta\b/i, /\bbasil\b/i, /\bmarinara\b/i, /\bolive\s*oil\b/i, /\bitalian\s*seasoning\b/i, /\borgano\b/i, /\bprosciutto\b/i, /\bpancetta\b/i, /\bpecorino\b/i],
    ingredientThreshold: 3,
    tagKeywords: [/\bitalian\b/i, /\bpasta\b/i, /\bpizza\b/i],
  },
  // Mediterranean
  {
    cuisine: 'Mediterranean',
    titleKeywords: [/\bmediterranean\b/i, /\bgreek\b/i, /\bhummus\b/i, /\bfalafel\b/i, /\btabbouleh\b/i, /\bcouscous\b/i, /\bgyro/i, /\btzatziki\b/i, /\bshawarma\b/i, /\bbaklava\b/i, /\bdolma/i, /\bspanakopita\b/i, /\bmoussaka\b/i, /\bsouvlaki\b/i, /\bpita\b/i, /\bkebab\b/i, /\bkabob\b/i, /\bfattoush\b/i],
    ingredientKeywords: [/\bfeta\b/i, /\btahini\b/i, /\bolive\b/i, /\bchickpea/i, /\bgarbanzo\b/i, /\bpomegranate\b/i, /\bsumac\b/i, /\bza'atar\b/i, /\bzaatar\b/i, /\bharissa\b/i, /\bpita\b/i, /\blemon\b/i, /\bkalamata\b/i, /\bhummus\b/i],
    ingredientThreshold: 3,
    tagKeywords: [/\bmediterranean\b/i, /\bgreek\b/i, /\bmiddle\s*east/i],
  },
  // French
  {
    cuisine: 'French',
    titleKeywords: [/\bfrench\b/i, /\bcroissant\b/i, /\bquiche\b/i, /\bsouffl[eé]\b/i, /\bbourguignon\b/i, /\bratatouille\b/i, /\bcr[eê]pe/i, /\bb[eé]chamel\b/i, /\bbrioche\b/i, /\bmadeline\b/i, /\bgratin\b/i, /\bbeignet/i, /\bprov[eé]n[cç]al/i, /\bhollandaise\b/i, /\bbeurre\b/i, /\bbernaise\b/i, /\bvichyssoise\b/i, /\bbouillabaisse\b/i, /\blorraine\b/i, /\bcordon\s*bleu\b/i, /\bprofiterole\b/i, /\bcl[aà]fout/i, /\bcr[eè]me\s*br[uû]l[eé]/i],
    ingredientKeywords: [/\bherbes\s*de\s*provence\b/i, /\bdijon\b/i, /\bbrie\b/i, /\bcamembert\b/i, /\bgruy[eè]re\b/i, /\bcognac\b/i, /\bbrandy\b/i, /\bshallot/i, /\btarragon\b/i, /\bchervil\b/i],
    ingredientThreshold: 2,
    tagKeywords: [/\bfrench\b/i],
  },
  // Southern (US)
  {
    cuisine: 'Southern',
    titleKeywords: [/\bsouthern\b/i, /\bgumbo\b/i, /\bjambalaya\b/i, /\bblackened\b/i, /\bcajun\b/i, /\bcreole\b/i, /\bcornbread\b/i, /\bbiscuits?\s*and\s*gravy\b/i, /\bcollard/i, /\bgrits\b/i, /\bhush\s*pupp/i, /\bpo[\s']?boy\b/i, /\bbourbon\b/i, /\bbbq\b/i, /\bpraline/i, /\bpecan\s*pie\b/i, /\bsweet\s*tea\b/i, /\bpimento\s*cheese\b/i, /\bbanana\s*pudding\b/i, /\bdeviled\s*egg/i, /\bfried\s*chicken\b/i, /\bfried\s*catfish\b/i, /\bfried\s*okra\b/i, /\bcountry[\s-]*fried\b/i, /\bchicken[\s-]*fried\b/i],
    ingredientKeywords: [/\bandouille\b/i, /\bokra\b/i, /\bcollard/i, /\bcornmeal\b/i, /\bbuttermilk\b/i, /\bcajun\b/i, /\bcreole\b/i, /\bgrits\b/i, /\bfile\s*powder\b/i],
    ingredientThreshold: 2,
    tagKeywords: [/\bsouthern\b/i, /\bcajun\b/i, /\bcreole\b/i, /\bbbq\b/i],
  },
];

function inferCuisine(title: string, description: string, ingredients: string, tags: string): string | null {
  const combined = `${title} ${description}`.toLowerCase();

  for (const rule of CUISINE_RULES) {
    // Check title keywords (strongest signal)
    if (rule.titleKeywords) {
      for (const kw of rule.titleKeywords) {
        if (kw.test(title)) return rule.cuisine;
      }
    }

    // Check tag keywords
    if (rule.tagKeywords) {
      for (const kw of rule.tagKeywords) {
        if (kw.test(tags)) return rule.cuisine;
      }
    }

    // Check ingredient keywords (need threshold matches)
    if (rule.ingredientKeywords) {
      const threshold = rule.ingredientThreshold || 2;
      let matches = 0;
      const searchText = `${ingredients} ${combined}`;
      for (const kw of rule.ingredientKeywords) {
        if (kw.test(searchText)) matches++;
      }
      if (matches >= threshold) return rule.cuisine;
    }
  }

  return 'American';
}

function processRecipe(filePath: string): { changed: boolean; cuisine: string | null } {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if cuisine already exists
  if (/^cuisine:/m.test(content)) {
    return { changed: false, cuisine: null };
  }

  // Extract frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { changed: false, cuisine: null };

  const frontmatter = fmMatch[1];

  // Extract fields for analysis
  const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1] : '';
  const description = descMatch ? descMatch[1] : '';

  // Extract recipe_ingredients array
  const ingredientsMatch = frontmatter.match(/^recipe_ingredients:\s*\n((?:\s+-\s+.+\n?)*)/m);
  const ingredients = ingredientsMatch ? ingredientsMatch[1] : '';

  // Extract keywords array
  const keywordsMatch = frontmatter.match(/^keywords:\s*\n((?:\s+-\s+.+\n?)*)/m);
  const keywords = keywordsMatch ? keywordsMatch[1] : '';

  // Also grab the body ingredients section
  const bodyIngMatch = content.match(/## Ingredients\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  const bodyIngredients = bodyIngMatch ? bodyIngMatch[1] : '';

  const allIngredients = `${ingredients} ${bodyIngredients}`;
  const allTags = `${ingredients} ${keywords}`;

  const cuisine = inferCuisine(title, description, allIngredients, allTags);
  if (!cuisine) return { changed: false, cuisine: null };

  // Insert cuisine after recipe_category or after cuisine-adjacent fields
  let newFrontmatter: string;
  if (/^recipe_category:/m.test(frontmatter)) {
    newFrontmatter = frontmatter.replace(
      /^(recipe_category:\s*.+)$/m,
      `$1\ncuisine: ${cuisine}`
    );
  } else if (/^keywords:/m.test(frontmatter)) {
    // Find end of keywords block and insert after
    newFrontmatter = frontmatter.replace(
      /^(keywords:\s*(?:\n\s+-\s+.+)*)/m,
      `$1\ncuisine: ${cuisine}`
    );
  } else {
    // Append before end of frontmatter
    newFrontmatter = frontmatter + `\ncuisine: ${cuisine}`;
  }

  const newContent = content.replace(
    /^---\n[\s\S]*?\n---/,
    `---\n${newFrontmatter}\n---`
  );

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return { changed: true, cuisine };
}

// Main
const files = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.md'));
const stats: Record<string, number> = {};
let changed = 0;
let skipped = 0;

for (const file of files) {
  const result = processRecipe(path.join(RECIPES_DIR, file));
  if (result.changed && result.cuisine) {
    changed++;
    stats[result.cuisine] = (stats[result.cuisine] || 0) + 1;
  } else {
    skipped++;
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Cuisine backfill complete:`);
console.log(`  Updated: ${changed}`);
console.log(`  Skipped (already had cuisine): ${skipped}`);
console.log(`\nCuisine distribution of updates:`);
const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
for (const [cuisine, count] of sorted) {
  console.log(`  ${cuisine}: ${count}`);
}
