// ============================================================
// Seed food database — Australian foods & drinks, Middle Eastern / Lebanese
// staples, halal-friendly takeaway, supplements, and (v9) world foods with a
// cuisine sub-category: Italian, Greek, Turkish, Mexican, Indian, Chinese,
// Japanese, Korean, Thai, Vietnamese, Filipino, African, American, Australian.
//
// All macro values are PER 100g (drinks treated as ~1g/ml).
// servingName/servingGrams give a natural "1 serving" shortcut; `serves` adds
// extra named portions ("1 breast 180g", "1 wrap", "1 scoop").
//
// NOTHING IS EVER DELETED from this list. Items that halal mode hides (pork,
// alcohol) stay here and are TAGGED instead, so the data stays honest and the
// app still works with halal mode off. Genuinely ambiguous items (takeaway
// meat, gelatine, animal rennet) get 'unclear'/'gelatine' rather than a
// confident claim — packaging and shops vary.
//
// Static data — custom foods live in Dexie (db.foods) and override seed
// entries by id when merged.
// ============================================================

import type { DietTag, FoodItem } from '@/db/types'

export type FoodCategory =
  | 'protein' | 'carbs' | 'fruit-veg' | 'fats' | 'meals' | 'snacks' | 'drinks'
  | 'middle-eastern' | 'supplements'

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  'fruit-veg': 'Fruit & veg',
  fats: 'Fats & extras',
  meals: 'Meals',
  'middle-eastern': 'Middle Eastern',
  snacks: 'Snacks',
  drinks: 'Drinks',
  supplements: 'Supplements',
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  'protein', 'middle-eastern', 'carbs', 'fruit-veg', 'fats', 'meals',
  'snacks', 'drinks', 'supplements',
]

export interface SeedFood extends FoodItem {
  category: FoodCategory
  /** v9: cuisine sub-category (world foods). Optional — staples have none. */
  cuisine?: Cuisine
}

// ---------- cuisines (sub-categories across every food type) ----------
export type Cuisine =
  | 'australian' | 'middle-eastern' | 'turkish' | 'greek' | 'italian' | 'mexican' | 'indian'
  | 'chinese' | 'japanese' | 'korean' | 'thai' | 'vietnamese' | 'filipino' | 'african' | 'american'

export const CUISINE_LABELS: Record<Cuisine, string> = {
  australian: 'Australian', 'middle-eastern': 'Middle Eastern', turkish: 'Turkish', greek: 'Greek',
  italian: 'Italian', mexican: 'Mexican', indian: 'Indian', chinese: 'Chinese', japanese: 'Japanese',
  korean: 'Korean', thai: 'Thai', vietnamese: 'Vietnamese', filipino: 'Filipino', african: 'African',
  american: 'American',
}
export const CUISINES = Object.keys(CUISINE_LABELS) as Cuisine[]
export const CUISINE_FLAG: Record<Cuisine, string> = {
  australian: '🇦🇺', 'middle-eastern': '🧆', turkish: '🇹🇷', greek: '🇬🇷', italian: '🇮🇹', mexican: '🇲🇽', indian: '🇮🇳',
  chinese: '🇨🇳', japanese: '🇯🇵', korean: '🇰🇷', thai: '🇹🇭', vietnamese: '🇻🇳', filipino: '🇵🇭', african: '🌍', american: '🇺🇸',
}

/** Extra, optional detail for a seed food. */
export interface FoodOpts {
  brand?: string
  tags?: DietTag[]
  serves?: { name: string; grams: number }[]
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
  substituteIds?: string[]
  cuisine?: Cuisine
}

// ---------- tag shorthands ----------
const VG: DietTag[] = ['vegan', 'vegetarian']          // plant only
const V: DietTag[] = ['vegetarian']                     // no meat, may have egg
const DV: DietTag[] = ['dairy', 'vegetarian']           // dairy + vegetarian
const HK: DietTag[] = ['halal-ok']                      // plainly fine
const HKD: DietTag[] = ['halal-ok', 'dairy']
const PORK: DietTag[] = ['pork']
const ALC: DietTag[] = ['alcohol']
const UNSURE: DietTag[] = ['unclear']                   // depends on shop/brand
const GEL: DietTag[] = ['gelatine']

function make(
  id: string, name: string, category: FoodCategory,
  kcal: number, protein: number, carbs: number, fat: number,
  servingName?: string, servingGrams?: number, opts?: FoodOpts,
): SeedFood {
  const food: SeedFood = { id, name, category, kcal, protein, carbs, fat }
  if (servingName && servingGrams) {
    food.servingName = servingName
    food.servingGrams = servingGrams
  }
  if (opts) {
    if (opts.brand) food.brand = opts.brand
    if (opts.tags?.length) food.dietTags = [...new Set(opts.tags)]
    if (opts.serves?.length) food.serves = opts.serves
    if (opts.fibre !== undefined) food.fibre = opts.fibre
    if (opts.sugar !== undefined) food.sugar = opts.sugar
    if (opts.sodium !== undefined) food.sodium = opts.sodium
    if (opts.satFat !== undefined) food.satFat = opts.satFat
    if (opts.substituteIds?.length) food.substituteIds = opts.substituteIds
    if (opts.cuisine) food.cuisine = opts.cuisine
  }
  return food
}

/** Seed food with the historic `sf-` id prefix (never change existing ids). */
function f(
  id: string, name: string, category: FoodCategory,
  kcal: number, protein: number, carbs: number, fat: number,
  servingName?: string, servingGrams?: number, opts?: FoodOpts,
): SeedFood {
  return make(`sf-${id}`, name, category, kcal, protein, carbs, fat, servingName, servingGrams, opts)
}

/**
 * Seed food with an EXACT id — used for the halal substitute targets that
 * `@/lib/halal` references by bare id (beef-bacon, turkey-rashers, …).
 */
function fx(
  id: string, name: string, category: FoodCategory,
  kcal: number, protein: number, carbs: number, fat: number,
  servingName?: string, servingGrams?: number, opts?: FoodOpts,
): SeedFood {
  return make(id, name, category, kcal, protein, carbs, fat, servingName, servingGrams, opts)
}

export const SEED_FOODS: SeedFood[] = [
  // ================= protein =================
  f('chicken-breast', 'Chicken breast, grilled', 'protein', 165, 31, 0, 3.6, 'small breast', 150, {
    tags: HK, satFat: 1, sodium: 74,
    serves: [{ name: '1 breast', grams: 180 }, { name: 'half breast', grams: 90 }],
  }),
  f('chicken-thigh', 'Chicken thigh, grilled', 'protein', 177, 24, 0, 8.7, 'thigh', 100, {
    tags: HK, satFat: 2.4,
    serves: [{ name: '2 thighs', grams: 200 }],
  }),
  f('chicken-wings', 'Chicken wings, roasted', 'protein', 216, 24, 0, 13, 'wing', 50, { tags: HK }),
  f('bbq-chicken', 'BBQ shop chicken, no skin', 'protein', 165, 28, 0, 6, 'quarter', 180, {
    tags: UNSURE, serves: [{ name: 'half chicken', grams: 360 }],
  }),
  f('beef-mince-5star', 'Beef mince 5★ lean (5% fat), cooked', 'protein', 170, 26, 0, 7, '100g', 100, {
    tags: HK, satFat: 3,
    serves: [{ name: 'burger patty', grams: 125 }, { name: 'big serve', grams: 200 }],
  }),
  f('beef-mince-reg', 'Beef mince regular (20% fat), cooked', 'protein', 250, 24, 0, 17, '100g', 100, {
    tags: HK, satFat: 7,
    serves: [{ name: 'burger patty', grams: 125 }, { name: 'big serve', grams: 200 }],
  }),
  f('rump-steak', 'Rump steak, grilled', 'protein', 200, 29, 0, 9, 'steak', 200, { tags: HK }),
  f('scotch-fillet', 'Scotch fillet steak, grilled', 'protein', 240, 26, 0, 15, 'steak', 250, { tags: HK }),
  f('lamb-chop', 'Lamb chop, grilled', 'protein', 260, 25, 0, 18, 'chop', 80, { tags: HK }),
  f('lamb-leg', 'Lamb leg roast', 'protein', 210, 28, 0, 11, '100g', 100, { tags: HK }),
  f('kangaroo', 'Kangaroo fillet, grilled', 'protein', 98, 22, 0, 1, 'fillet', 150, { tags: HK }),
  // --- pork & cured pork: kept, tagged, with halal substitutes attached ---
  f('pork-chop', 'Pork chop, grilled', 'protein', 220, 27, 0, 12, 'chop', 150, {
    tags: PORK, substituteIds: ['beef-scotch-fillet', 'lamb-loin-chop', 'chicken-thigh'],
  }),
  f('bacon', 'Bacon, grilled', 'protein', 300, 30, 1, 20, 'rasher', 34, {
    tags: PORK, substituteIds: ['beef-bacon', 'turkey-rashers', 'halal-beef-sausage'],
  }),
  f('ham', 'Ham, sliced', 'protein', 110, 18, 1.5, 3.5, 'slice', 25, {
    tags: PORK, substituteIds: ['turkey-breast-sliced', 'beef-pastrami', 'chicken-breast-sliced'],
  }),
  f('turkey-breast', 'Turkey breast, sliced', 'protein', 104, 22, 1, 1.5, 'slice', 25, { tags: HK }),
  f('egg', 'Egg, whole', 'protein', 143, 12.6, 0.7, 9.5, 'large egg', 50, {
    tags: ['vegetarian', 'halal-ok'], satFat: 3.1,
    serves: [{ name: '2 eggs', grams: 100 }, { name: '3 eggs', grams: 150 }],
  }),
  f('egg-white', 'Egg white', 'protein', 52, 11, 0.7, 0.2, 'egg white', 33, { tags: V }),
  f('tuna-springwater', 'Tuna in springwater, drained', 'protein', 109, 25, 0, 1, 'can', 95, {
    tags: HK, sodium: 320, serves: [{ name: 'large can', grams: 185 }],
  }),
  f('tuna-oil', 'Tuna in oil, drained', 'protein', 190, 27, 0, 9, 'can', 95, { tags: HK }),
  f('salmon', 'Salmon fillet, grilled', 'protein', 208, 22, 0, 13, 'fillet', 150, { tags: HK }),
  f('smoked-salmon', 'Smoked salmon', 'protein', 142, 23, 0, 5.5, 'slice', 30, { tags: HK, sodium: 670 }),
  f('barramundi', 'Barramundi, grilled', 'protein', 110, 23, 0, 2, 'fillet', 150, { tags: HK }),
  f('prawns', 'Prawns, cooked', 'protein', 99, 24, 0.2, 0.3, 'prawn', 15, {
    tags: HK, serves: [{ name: '10 prawns', grams: 150 }],
  }),
  f('tofu', 'Tofu, firm', 'protein', 116, 12, 2, 7, 'half block', 150, { tags: VG }),
  f('tempeh', 'Tempeh', 'protein', 192, 20, 8, 11, '100g', 100, { tags: VG }),
  f('whey', 'Whey protein powder', 'protein', 380, 78, 6, 5, 'scoop', 32, {
    tags: ['dairy', 'vegetarian'], serves: [{ name: '2 scoops', grams: 64 }],
  }),
  f('greek-yog', 'Greek yogurt, full fat', 'protein', 100, 9, 4, 5, 'tub', 170, {
    tags: DV, serves: [{ name: 'big bowl', grams: 250 }],
  }),
  f('greek-yog-lite', 'Greek yogurt, low fat', 'protein', 57, 10, 3.5, 0.2, 'tub', 170, { tags: DV }),
  f('protein-yog', 'Protein yogurt (YoPro style)', 'protein', 60, 10, 4, 0.3, 'tub', 160, { tags: DV }),
  f('cottage', 'Cottage cheese', 'protein', 98, 12, 3.5, 4, 'half cup', 110, {
    tags: DV, serves: [{ name: 'full cup', grams: 220 }],
  }),
  f('beef-jerky', 'Beef jerky', 'protein', 280, 45, 8, 6, 'pack', 25, { tags: UNSURE, sodium: 1400 }),

  // --- halal substitute targets (referenced by @/lib/halal, exact ids) ---
  fx('beef-bacon', 'Beef bacon rashers, grilled', 'protein', 230, 28, 1, 13, 'rasher', 30, {
    tags: ['halal-ok'], sodium: 1100, serves: [{ name: '3 rashers', grams: 90 }],
  }),
  fx('turkey-rashers', 'Turkey rashers, grilled', 'protein', 150, 22, 1.5, 6, 'rasher', 28, {
    tags: ['halal-ok'], sodium: 950, serves: [{ name: '3 rashers', grams: 84 }],
  }),
  fx('halal-beef-sausage', 'Beef sausage (halal), grilled', 'protein', 265, 17, 3, 20, 'sausage', 75, {
    tags: ['halal-ok'], serves: [{ name: '2 sausages', grams: 150 }],
  }),
  fx('chicken-sausage', 'Chicken sausage, grilled', 'protein', 195, 18, 2.5, 12, 'sausage', 70, {
    tags: ['halal-ok'], serves: [{ name: '2 sausages', grams: 140 }],
  }),
  fx('beef-pepperoni', 'Beef pepperoni, sliced', 'protein', 430, 22, 3, 37, '10 slices', 30, {
    tags: ['halal-ok'], sodium: 1600,
  }),
  fx('beef-pastrami', 'Beef pastrami, sliced', 'protein', 133, 21, 1.5, 5, 'slice', 28, {
    tags: ['halal-ok'], sodium: 1100, serves: [{ name: '4 slices', grams: 112 }],
  }),
  fx('turkey-breast-sliced', 'Turkey breast, deli sliced', 'protein', 104, 22, 1, 1.5, 'slice', 25, {
    tags: ['halal-ok'], sodium: 900, serves: [{ name: '4 slices', grams: 100 }],
  }),
  fx('chicken-breast-sliced', 'Chicken breast, deli sliced', 'protein', 110, 21, 1.5, 2, 'slice', 25, {
    tags: ['halal-ok'], sodium: 880, serves: [{ name: '4 slices', grams: 100 }],
  }),
  fx('beef-scotch-fillet', 'Beef scotch fillet, grilled', 'protein', 240, 26, 0, 15, 'steak', 250, {
    tags: ['halal-ok'], serves: [{ name: 'small steak', grams: 180 }],
  }),
  fx('lamb-loin-chop', 'Lamb loin chop, grilled', 'protein', 255, 26, 0, 17, 'chop', 90, {
    tags: ['halal-ok'], serves: [{ name: '3 chops', grams: 270 }],
  }),

  // --- more AU protein staples ---
  f('chicken-breast-raw', 'Chicken breast, raw', 'protein', 120, 23, 0, 2.6, '100g', 100, {
    tags: HK, serves: [{ name: '1 breast', grams: 200 }],
  }),
  f('chicken-drumstick', 'Chicken drumstick, baked', 'protein', 175, 25, 0, 8, 'drumstick', 90, { tags: HK }),
  f('beef-brisket', 'Beef brisket, slow cooked', 'protein', 240, 27, 0, 14, '100g', 100, { tags: HK }),
  f('lamb-mince', 'Lamb mince, cooked', 'protein', 255, 24, 0, 17, '100g', 100, { tags: HK }),
  f('canned-salmon', 'Salmon, canned in springwater', 'protein', 140, 22, 0, 6, 'can', 95, { tags: HK }),
  f('sardines', 'Sardines in springwater', 'protein', 165, 22, 0, 8.5, 'can', 106, { tags: HK }),
  f('haloumi', 'Haloumi, pan fried', 'protein', 330, 22, 2.5, 26, 'slice', 35, {
    tags: DV, sodium: 1200, serves: [{ name: '3 slices', grams: 105 }],
  }),
  f('labneh', 'Labneh', 'protein', 174, 8, 6, 13, 'tbsp', 30, {
    tags: DV, serves: [{ name: 'small bowl', grams: 100 }],
  }),
  f('feta-danish', 'Danish feta', 'protein', 290, 13, 2, 26, '30g serve', 30, { tags: DV }),
  f('ricotta', 'Ricotta', 'protein', 174, 11, 3, 13, 'half cup', 120, { tags: DV }),

  // ================= Middle Eastern / Lebanese =================
  f('chicken-shawarma', 'Chicken shawarma, meat only', 'middle-eastern', 205, 25, 3, 10, '100g', 100, {
    tags: HK, serves: [{ name: 'wrap fill', grams: 150 }],
  }),
  f('chicken-shawarma-wrap', 'Chicken shawarma wrap', 'middle-eastern', 205, 12, 22, 8, 'wrap', 320, {
    tags: HK, serves: [{ name: 'small wrap', grams: 240 }, { name: 'large wrap', grams: 420 }],
  }),
  f('beef-shawarma', 'Beef shawarma, meat only', 'middle-eastern', 230, 24, 3, 13, '100g', 100, { tags: HK }),
  f('beef-shawarma-wrap', 'Beef shawarma wrap', 'middle-eastern', 220, 12, 21, 10, 'wrap', 320, { tags: HK }),
  f('mixed-grill', 'Lebanese mixed grill plate', 'middle-eastern', 195, 19, 6, 11, 'plate', 450, {
    tags: HK, serves: [{ name: 'half plate', grams: 225 }],
  }),
  f('shish-tawook', 'Shish tawook (chicken skewer)', 'middle-eastern', 175, 26, 2, 7, 'skewer', 110, {
    tags: HK, serves: [{ name: '2 skewers', grams: 220 }, { name: '3 skewers', grams: 330 }],
  }),
  f('kafta', 'Kafta skewer (beef & lamb)', 'middle-eastern', 250, 19, 3, 18, 'skewer', 100, {
    tags: HK, serves: [{ name: '2 skewers', grams: 200 }],
  }),
  f('kibbeh', 'Kibbeh, fried', 'middle-eastern', 280, 13, 24, 15, 'kibbeh', 70, {
    tags: HK, serves: [{ name: '2 kibbeh', grams: 140 }],
  }),
  f('kibbeh-nayyeh', 'Kibbeh nayyeh', 'middle-eastern', 190, 20, 11, 7, 'small serve', 120, { tags: HK }),
  f('falafel', 'Falafel balls, fried', 'middle-eastern', 333, 13, 32, 18, 'ball', 30, {
    tags: VG, fibre: 5, serves: [{ name: '4 balls', grams: 120 }, { name: '6 balls', grams: 180 }],
  }),
  f('tabbouleh', 'Tabbouleh', 'middle-eastern', 120, 3, 12, 7, 'cup', 130, { tags: VG, fibre: 3 }),
  f('fattoush', 'Fattoush salad', 'middle-eastern', 110, 2.5, 11, 6.5, 'bowl', 180, { tags: VG }),
  f('toum', 'Garlic toum', 'middle-eastern', 600, 1, 5, 64, 'tbsp', 15, {
    tags: VG, satFat: 6, serves: [{ name: 'small pot', grams: 40 }],
  }),
  f('laban', 'Laban (drinking yoghurt)', 'middle-eastern', 62, 3.5, 4.7, 3.3, 'cup', 250, { tags: DV }),
  f('laban-ayran', 'Ayran / salted laban', 'middle-eastern', 40, 2.4, 3.2, 1.8, 'cup', 250, { tags: DV, sodium: 200 }),
  f('mujadara', 'Mujadara (lentils & rice)', 'middle-eastern', 155, 5, 24, 4.5, 'cup', 200, { tags: VG, fibre: 4 }),
  f('rice-vermicelli', 'Lebanese rice with vermicelli', 'middle-eastern', 160, 3.2, 30, 3, 'cup', 180, {
    tags: V, serves: [{ name: 'big serve', grams: 300 }],
  }),
  f('vine-leaves', 'Stuffed vine leaves (warak enab)', 'middle-eastern', 150, 3, 20, 6.5, 'roll', 30, {
    tags: VG, serves: [{ name: '5 rolls', grams: 150 }],
  }),
  f('manakish-zaatar', "Manakish za'atar", 'middle-eastern', 300, 7, 38, 13, 'manakish', 130, {
    tags: VG, serves: [{ name: 'half', grams: 65 }],
  }),
  f('manakish-cheese', 'Manakish cheese', 'middle-eastern', 315, 12, 34, 14, 'manakish', 140, { tags: DV }),
  f('manakish-lahm', 'Lahm bi ajin (meat manakish)', 'middle-eastern', 270, 11, 30, 11, 'piece', 110, { tags: HK }),
  f('knafeh', 'Knafeh', 'middle-eastern', 350, 7, 40, 18, 'piece', 150, { tags: DV, sugar: 26 }),
  f('baklava', 'Baklava', 'middle-eastern', 430, 6, 48, 24, 'piece', 40, {
    tags: V, sugar: 30, serves: [{ name: '2 pieces', grams: 80 }],
  }),
  f('maamoul', 'Maamoul (date biscuit)', 'middle-eastern', 400, 6, 58, 16, 'biscuit', 35, { tags: V }),
  f('hummus-leb', 'Hummus, Lebanese style', 'middle-eastern', 180, 8, 14, 11, 'tbsp', 30, {
    tags: VG, fibre: 4, serves: [{ name: 'small bowl', grams: 100 }],
  }),
  f('baba-ghanoush', 'Baba ghanoush', 'middle-eastern', 140, 3, 9, 11, 'tbsp', 30, { tags: VG }),
  f('lebanese-bread', 'Lebanese bread (flat)', 'middle-eastern', 275, 9, 55, 1.5, 'loaf', 60, {
    tags: VG, fibre: 2.5, serves: [{ name: 'half loaf', grams: 30 }, { name: 'large loaf', grams: 90 }],
  }),
  f('pita-bread', 'Pita pocket bread', 'middle-eastern', 275, 9, 53, 2, 'pita', 65, { tags: VG }),
  f('markouk', 'Markouk (mountain bread)', 'middle-eastern', 290, 9.5, 58, 1.5, 'sheet', 45, { tags: VG }),
  f('tahini', 'Tahini', 'middle-eastern', 595, 17, 21, 54, 'tbsp', 15, { tags: VG, fibre: 9 }),
  f('zaatar-oil', "Za'atar with olive oil", 'middle-eastern', 480, 6, 22, 42, 'tbsp', 15, { tags: VG }),
  f('pickled-turnip', 'Pickled turnip', 'middle-eastern', 20, 0.8, 4, 0.1, 'serve', 40, { tags: VG, sodium: 900 }),
  f('lentil-soup', 'Lebanese lentil soup', 'middle-eastern', 85, 5, 13, 1.5, 'bowl', 300, { tags: VG, fibre: 4 }),
  f('foul-medames', 'Foul medames', 'middle-eastern', 110, 6.5, 14, 3.5, 'bowl', 250, { tags: VG, fibre: 5 }),
  f('sambousek', 'Sambousek (meat pastry)', 'middle-eastern', 300, 11, 28, 16, 'piece', 60, { tags: HK }),
  f('chicken-musakhan', 'Musakhan (sumac chicken & bread)', 'middle-eastern', 215, 15, 20, 9, 'serve', 350, { tags: HK }),

  // ================= carbs =================
  f('white-rice', 'White rice, cooked', 'carbs', 130, 2.7, 28, 0.3, 'cup', 160, {
    tags: VG, serves: [{ name: 'big serve', grams: 300 }],
  }),
  f('brown-rice', 'Brown rice, cooked', 'carbs', 123, 2.7, 25.5, 1, 'cup', 155, { tags: VG, fibre: 1.8 }),
  f('basmati-rice', 'Basmati rice, cooked', 'carbs', 121, 3.5, 25, 0.4, 'cup', 160, {
    tags: VG, serves: [{ name: 'big serve', grams: 300 }],
  }),
  f('jasmine-rice', 'Jasmine rice, cooked', 'carbs', 129, 2.7, 28, 0.3, 'cup', 160, { tags: VG }),
  f('pasta', 'Pasta, cooked', 'carbs', 158, 5.8, 31, 0.9, 'cup', 140, {
    tags: VG, fibre: 1.8, serves: [{ name: 'big bowl', grams: 280 }],
  }),
  f('pasta-wholemeal', 'Wholemeal pasta, cooked', 'carbs', 149, 6, 30, 1.3, 'cup', 140, { tags: VG, fibre: 4 }),
  f('instant-noodles', 'Instant noodles, prepared', 'carbs', 138, 3, 18, 6, 'packet', 270, { tags: UNSURE }),
  f('bread-multigrain', 'Multigrain bread', 'carbs', 250, 9.5, 41, 3.5, 'slice', 35, { tags: VG, fibre: 5 }),
  f('bread-white', 'White bread', 'carbs', 265, 8.5, 49, 3, 'slice', 35, { tags: VG }),
  f('bread-wholemeal', 'Wholemeal bread', 'carbs', 240, 10, 39, 3, 'slice', 35, {
    tags: VG, fibre: 6, serves: [{ name: '2 slices', grams: 70 }],
  }),
  f('sourdough', 'Sourdough bread', 'carbs', 240, 9, 47, 1.5, 'slice', 50, { tags: VG }),
  f('wrap', 'Wholemeal wrap', 'carbs', 300, 9, 48, 6.5, 'wrap', 64, {
    tags: VG, serves: [{ name: 'large wrap', grams: 90 }],
  }),
  f('wrap-white', 'Plain flour wrap', 'carbs', 305, 8, 51, 7, 'wrap', 62, { tags: VG }),
  f('english-muffin', 'English muffin', 'carbs', 235, 9, 44, 1.8, 'muffin', 60, { tags: VG }),
  f('crumpet', 'Crumpet', 'carbs', 180, 5, 35, 0.8, 'crumpet', 50, { tags: VG }),
  f('bagel', 'Bagel', 'carbs', 260, 10, 50, 1.5, 'bagel', 95, { tags: VG }),
  f('oats', 'Rolled oats, dry', 'carbs', 380, 13, 58, 8.5, 'half cup', 45, {
    tags: VG, fibre: 10, serves: [{ name: '1 cup dry', grams: 90 }, { name: '30g serve', grams: 30 }],
  }),
  f('weetbix', 'Weet-Bix', 'carbs', 357, 12, 67, 2.7, 'biscuit', 15, {
    brand: 'Sanitarium', tags: VG, fibre: 11,
    serves: [{ name: '2 biscuits', grams: 30 }, { name: '3 biscuits', grams: 45 }],
  }),
  f('muesli', 'Natural muesli', 'carbs', 375, 9.5, 58, 9, 'half cup', 55, { tags: VG, fibre: 7 }),
  f('granola', 'Granola', 'carbs', 450, 10, 60, 16, 'half cup', 55, { tags: VG }),
  f('potato-boiled', 'Potato, boiled', 'carbs', 87, 1.9, 19, 0.1, 'medium', 180, { tags: VG, fibre: 2 }),
  f('potato-roast', 'Potato, roasted', 'carbs', 149, 2.5, 26, 4, 'medium', 160, { tags: VG }),
  f('potato-mash', 'Mashed potato with butter', 'carbs', 110, 2, 16, 4, 'cup', 210, { tags: DV }),
  f('sweet-potato', 'Sweet potato, baked', 'carbs', 90, 2, 20, 0.2, 'medium', 150, {
    tags: VG, fibre: 3.3, serves: [{ name: 'large', grams: 250 }],
  }),
  f('quinoa', 'Quinoa, cooked', 'carbs', 120, 4.4, 21, 1.9, 'cup', 185, { tags: VG, fibre: 2.8 }),
  f('couscous', 'Couscous, cooked', 'carbs', 112, 3.8, 23, 0.2, 'cup', 160, { tags: VG }),
  f('burghul', 'Burghul (cracked wheat), cooked', 'carbs', 83, 3, 18, 0.2, 'cup', 180, { tags: VG, fibre: 4.5 }),
  f('freekeh', 'Freekeh, cooked', 'carbs', 115, 5, 21, 1, 'cup', 180, { tags: VG, fibre: 4 }),
  f('corn', 'Corn on the cob', 'carbs', 86, 3.2, 19, 1.2, 'cob', 90, { tags: VG }),
  f('baked-beans', 'Baked beans', 'carbs', 91, 4.7, 15, 0.4, 'can', 220, { tags: VG, fibre: 4 }),
  f('chickpeas', 'Chickpeas, canned & drained', 'carbs', 139, 7.5, 18, 2.6, 'can', 240, { tags: VG, fibre: 6 }),
  f('lentils-cooked', 'Brown lentils, cooked', 'carbs', 116, 9, 20, 0.4, 'cup', 200, { tags: VG, fibre: 8 }),
  f('kidney-beans', 'Red kidney beans, canned', 'carbs', 105, 7, 15, 0.5, 'can', 240, { tags: VG, fibre: 6 }),
  f('rice-cakes', 'Rice cakes', 'carbs', 387, 8, 80, 3, 'cake', 9, { tags: VG }),

  // ================= fruit & veg =================
  f('banana', 'Banana', 'fruit-veg', 89, 1.1, 23, 0.3, 'medium', 118, {
    tags: VG, fibre: 2.6, sugar: 12,
    serves: [{ name: 'small', grams: 90 }, { name: 'large', grams: 150 }],
  }),
  f('apple', 'Apple', 'fruit-veg', 52, 0.3, 14, 0.2, 'medium', 180, { tags: VG, fibre: 2.4 }),
  f('strawberries', 'Strawberries', 'fruit-veg', 32, 0.7, 7.7, 0.3, 'cup', 150, { tags: VG }),
  f('blueberries', 'Blueberries', 'fruit-veg', 57, 0.7, 14.5, 0.3, 'cup', 150, { tags: VG }),
  f('raspberries', 'Raspberries', 'fruit-veg', 52, 1.2, 12, 0.7, 'cup', 125, { tags: VG }),
  f('orange', 'Orange', 'fruit-veg', 47, 0.9, 12, 0.1, 'medium', 130, { tags: VG }),
  f('mandarin', 'Mandarin', 'fruit-veg', 53, 0.8, 13, 0.3, 'mandarin', 90, { tags: VG }),
  f('mango', 'Mango', 'fruit-veg', 60, 0.8, 15, 0.4, 'cheek', 100, { tags: VG }),
  f('watermelon', 'Watermelon', 'fruit-veg', 30, 0.6, 7.6, 0.2, 'cup', 150, { tags: VG }),
  f('grapes', 'Grapes', 'fruit-veg', 69, 0.7, 18, 0.2, 'cup', 150, { tags: VG }),
  f('pineapple', 'Pineapple', 'fruit-veg', 50, 0.5, 13, 0.1, 'cup', 165, { tags: VG }),
  f('kiwi', 'Kiwifruit', 'fruit-veg', 61, 1.1, 15, 0.5, 'kiwi', 75, { tags: VG }),
  f('pear', 'Pear', 'fruit-veg', 57, 0.4, 15, 0.1, 'medium', 180, { tags: VG }),
  f('dates', 'Medjool dates', 'fruit-veg', 277, 1.8, 75, 0.2, 'date', 24, {
    tags: VG, fibre: 6.7, sugar: 66, serves: [{ name: '3 dates', grams: 72 }],
  }),
  f('dates-dried', 'Dried dates (deglet)', 'fruit-veg', 282, 2.5, 75, 0.4, 'date', 8, { tags: VG, fibre: 8 }),
  f('sultanas', 'Sultanas', 'fruit-veg', 300, 3, 72, 0.5, 'small box', 40, { tags: VG }),
  f('figs-dried', 'Dried figs', 'fruit-veg', 249, 3.3, 64, 0.9, 'fig', 20, { tags: VG, fibre: 9.8 }),
  f('broccoli', 'Broccoli, steamed', 'fruit-veg', 34, 2.8, 7, 0.4, 'cup', 90, { tags: VG, fibre: 2.6 }),
  f('salad-leaves', 'Mixed salad leaves', 'fruit-veg', 17, 1.5, 2.5, 0.3, 'bowl', 60, { tags: VG }),
  f('carrot', 'Carrot', 'fruit-veg', 41, 0.9, 10, 0.2, 'carrot', 60, { tags: VG }),
  f('cucumber', 'Cucumber', 'fruit-veg', 15, 0.7, 3.6, 0.1, 'cup', 100, { tags: VG }),
  f('tomato', 'Tomato', 'fruit-veg', 18, 0.9, 3.9, 0.2, 'tomato', 120, { tags: VG }),
  f('mixed-veg', 'Frozen mixed veg, cooked', 'fruit-veg', 55, 2.8, 9, 0.5, 'cup', 120, { tags: VG }),
  f('green-beans', 'Green beans, steamed', 'fruit-veg', 31, 1.8, 7, 0.2, 'cup', 100, { tags: VG }),
  f('zucchini', 'Zucchini, cooked', 'fruit-veg', 17, 1.2, 3.1, 0.3, 'zucchini', 150, { tags: VG }),
  f('mushrooms', 'Mushrooms, cooked', 'fruit-veg', 22, 3.1, 3.3, 0.3, 'cup', 70, { tags: VG }),
  f('capsicum', 'Capsicum', 'fruit-veg', 26, 1, 6, 0.3, 'capsicum', 120, { tags: VG }),
  f('onion', 'Onion, cooked', 'fruit-veg', 40, 1.1, 9.3, 0.1, 'onion', 100, { tags: VG }),
  f('avocado', 'Avocado', 'fruit-veg', 160, 2, 8.5, 15, 'half', 100, {
    tags: VG, fibre: 6.7, serves: [{ name: 'whole', grams: 200 }, { name: 'quarter', grams: 50 }],
  }),
  f('eggplant-grilled', 'Eggplant, grilled', 'fruit-veg', 60, 1, 7, 3.5, 'cup', 100, { tags: VG }),
  f('spinach-cooked', 'Spinach, cooked', 'fruit-veg', 23, 3, 3.8, 0.4, 'cup', 180, { tags: VG }),
  f('parsley', 'Flat-leaf parsley', 'fruit-veg', 36, 3, 6.3, 0.8, 'bunch', 60, { tags: VG }),

  // ================= fats, dairy & extras =================
  f('milk-full', 'Milk, full cream', 'fats', 64, 3.4, 4.8, 3.5, 'cup', 250, { tags: DV }),
  f('milk-lite', 'Milk, lite', 'fats', 47, 3.5, 5, 1.4, 'cup', 250, { tags: DV }),
  f('milk-skim', 'Milk, skim', 'fats', 35, 3.5, 5, 0.1, 'cup', 250, { tags: DV }),
  f('oat-milk', 'Oat milk', 'fats', 45, 1, 6.5, 1.5, 'cup', 250, { tags: VG }),
  f('almond-milk', 'Almond milk, unsweetened', 'fats', 24, 0.5, 3, 1.1, 'cup', 250, { tags: VG }),
  f('cheese-tasty', 'Tasty cheese', 'fats', 400, 25, 1, 33, 'slice', 21, { tags: DV, satFat: 21 }),
  f('cheese-lite', 'Light tasty cheese', 'fats', 310, 28, 1, 21, 'slice', 21, { tags: DV }),
  f('feta', 'Feta', 'fats', 265, 14, 2, 22, '30g serve', 30, { tags: DV }),
  f('mozzarella', 'Mozzarella', 'fats', 280, 22, 2.2, 20, '30g serve', 30, { tags: DV }),
  // Hard Italian-style cheeses are commonly made with animal rennet — flag it,
  // don't hide it. The label decides.
  f('parmesan', 'Parmesan, grated', 'fats', 420, 38, 0, 30, 'tbsp', 8, { tags: ['dairy', 'unclear'] }),
  f('cream-cheese', 'Cream cheese', 'fats', 342, 6, 4, 34, 'tbsp', 20, { tags: DV }),
  fx('butter', 'Butter', 'fats', 717, 0.9, 0.1, 81, 'tsp', 5, {
    tags: DV, satFat: 51, serves: [{ name: 'tbsp', grams: 14 }],
  }),
  fx('olive-oil', 'Olive oil', 'fats', 884, 0, 0, 100, 'tbsp', 18, {
    tags: VG, satFat: 14, serves: [{ name: 'tsp', grams: 5 }, { name: 'drizzle', grams: 10 }],
  }),
  f('olive-oil', 'Extra virgin olive oil', 'fats', 884, 0, 0, 100, 'tbsp', 18, { tags: VG }),
  f('butter', 'Butter, salted', 'fats', 717, 0.9, 0.1, 81, 'tsp', 5, { tags: DV }),
  f('ghee', 'Ghee', 'fats', 900, 0, 0, 100, 'tbsp', 14, { tags: DV }),
  f('canola-oil', 'Canola oil', 'fats', 884, 0, 0, 100, 'tbsp', 18, { tags: VG }),
  f('almonds', 'Almonds', 'fats', 579, 21, 22, 50, 'handful', 30, { tags: VG, fibre: 12.5 }),
  f('cashews', 'Cashews', 'fats', 553, 18, 30, 44, 'handful', 30, { tags: VG }),
  f('peanuts', 'Peanuts, roasted', 'fats', 599, 25, 16, 50, 'handful', 30, { tags: VG }),
  f('walnuts', 'Walnuts', 'fats', 654, 15, 14, 65, 'handful', 30, { tags: VG }),
  f('pistachios', 'Pistachios', 'fats', 560, 20, 28, 45, 'handful', 30, { tags: VG }),
  f('mixed-nuts', 'Mixed nuts', 'fats', 607, 20, 19, 54, 'handful', 30, { tags: VG }),
  f('peanut-butter', 'Peanut butter', 'fats', 588, 25, 20, 50, 'tbsp', 20, { tags: VG }),
  f('chia', 'Chia seeds', 'fats', 486, 17, 42, 31, 'tbsp', 12, { tags: VG, fibre: 34 }),
  f('hummus', 'Hummus', 'fats', 166, 8, 14, 10, 'tbsp', 25, { tags: VG, fibre: 6 }),
  f('mayo', 'Mayonnaise', 'fats', 680, 1, 2.5, 75, 'tbsp', 15, { tags: V }),
  f('tomato-sauce', 'Tomato sauce', 'fats', 100, 1.3, 23, 0.2, 'tbsp', 20, { tags: VG }),
  f('bbq-sauce', 'BBQ sauce', 'fats', 165, 1, 39, 0.3, 'tbsp', 20, { tags: VG }),
  f('honey', 'Honey', 'fats', 304, 0.3, 82, 0, 'tsp', 7, { tags: V }),
  f('vegemite', 'Vegemite', 'fats', 180, 25, 15, 0.9, 'tsp', 5, {
    brand: 'Bega', tags: VG, sodium: 3300,
  }),
  f('chilli-sauce', 'Chilli sauce', 'fats', 95, 1.5, 20, 0.5, 'tbsp', 18, { tags: VG }),
  f('yoghurt-dressing', 'Yoghurt & garlic dressing', 'fats', 130, 4, 6, 10, 'tbsp', 20, { tags: DV }),

  // ================= meals =================
  f('chicken-kebab', 'Chicken kebab, small', 'meals', 180, 13, 17, 7, 'kebab', 350, {
    tags: HK, serves: [{ name: 'large kebab', grams: 500 }],
  }),
  f('lamb-kebab', 'Lamb kebab, small', 'meals', 200, 13, 17, 9, 'kebab', 350, {
    tags: HK, serves: [{ name: 'large kebab', grams: 500 }],
  }),
  f('hsp', 'HSP, small', 'meals', 218, 9, 18, 12, 'small HSP', 550, {
    tags: HK, serves: [{ name: 'large HSP', grams: 900 }, { name: 'half a small', grams: 275 }],
  }),
  f('hsp-chicken', 'Chicken HSP', 'meals', 205, 10, 18, 10, 'small HSP', 550, { tags: HK }),
  f('charcoal-chicken-quarter', 'Charcoal chicken, quarter', 'meals', 195, 26, 0, 10, 'quarter', 250, {
    tags: HK, serves: [{ name: 'quarter, skin off', grams: 200 }],
  }),
  f('charcoal-chicken-half', 'Charcoal chicken, half', 'meals', 195, 26, 0, 10, 'half', 500, { tags: HK }),
  f('grilled-chicken-peri', 'Grilled peri-peri chicken breast', 'meals', 165, 30, 1.5, 4, 'breast', 180, {
    tags: HK, serves: [{ name: 'quarter chicken', grams: 250 }],
  }),
  f('pizza-pepperoni', 'Pizza slice, pepperoni', 'meals', 266, 11, 33, 10, 'slice', 107, {
    tags: PORK, substituteIds: ['beef-pepperoni', 'halal-beef-sausage'],
  }),
  f('pizza-margherita', 'Pizza slice, margherita', 'meals', 240, 10, 30, 9, 'slice', 105, { tags: DV }),
  // AU meat pies / sausage rolls are usually beef but the pastry and fillers
  // vary by bakery — flag rather than claim.
  f('meat-pie', 'Meat pie', 'meals', 259, 9, 22, 15, 'pie', 175, { tags: UNSURE }),
  f('sausage-roll', 'Sausage roll', 'meals', 305, 8.5, 24, 19, 'roll', 120, { tags: UNSURE }),
  f('beef-burger', 'Beef burger, takeaway', 'meals', 250, 13, 23, 12, 'burger', 220, { tags: UNSURE }),
  f('chicken-burger', 'Chicken burger, takeaway', 'meals', 230, 14, 24, 9, 'burger', 230, { tags: UNSURE }),
  f('schnitzel', 'Chicken schnitzel', 'meals', 260, 17, 16, 14, 'schnitzel', 180, { tags: UNSURE }),
  // Pub parmas are built with ham under the cheese.
  f('parma', 'Chicken parmigiana, pub', 'meals', 210, 15, 12, 11, 'parma', 350, {
    tags: PORK, substituteIds: ['turkey-breast-sliced', 'beef-pastrami'],
  }),
  f('fried-rice', 'Fried rice', 'meals', 163, 5.5, 23, 5.5, 'cup', 180, { tags: UNSURE }),
  f('butter-chicken', 'Butter chicken with rice', 'meals', 155, 9, 16, 6.5, 'serve', 450, { tags: ['dairy', 'unclear'] }),
  f('spag-bol', 'Spaghetti bolognese', 'meals', 129, 7.5, 14, 4.8, 'bowl', 400, { tags: UNSURE }),
  f('lasagna', 'Lasagna', 'meals', 150, 9, 13, 7, 'piece', 300, { tags: ['dairy', 'unclear'] }),
  f('pho', 'Pho, beef', 'meals', 55, 4.5, 7, 0.8, 'large bowl', 700, { tags: UNSURE }),
  f('sushi-roll', 'Sushi roll, chicken avocado', 'meals', 165, 6, 26, 3.5, 'roll', 160, {
    tags: UNSURE, serves: [{ name: '2 rolls', grams: 320 }],
  }),
  f('sushi-salmon', 'Sushi roll, salmon avocado', 'meals', 170, 6.5, 25, 4.5, 'roll', 160, { tags: HK }),
  f('sashimi-salmon', 'Salmon sashimi', 'meals', 180, 21, 0, 11, '5 pieces', 90, { tags: HK }),
  f('banh-mi', 'Banh mi, pork', 'meals', 215, 10, 26, 8, 'roll', 260, {
    tags: PORK, substituteIds: ['chicken-breast-sliced', 'beef-pastrami', 'turkey-breast-sliced'],
  }),
  f('banh-mi-chicken', 'Banh mi, grilled chicken', 'meals', 205, 11, 27, 6, 'roll', 260, { tags: UNSURE }),
  f('falafel-wrap', 'Falafel wrap', 'meals', 200, 7.5, 24, 8.5, 'wrap', 300, { tags: V }),
  f('burrito', 'Chicken burrito', 'meals', 180, 10, 20, 7, 'burrito', 320, { tags: UNSURE }),
  f('caesar-salad', 'Chicken caesar salad', 'meals', 150, 10, 6, 10, 'bowl', 300, {
    tags: PORK, substituteIds: ['turkey-rashers', 'beef-bacon'],
  }),
  f('pad-thai', 'Pad thai, chicken', 'meals', 150, 8, 19, 5, 'serve', 400, { tags: UNSURE }),
  f('fish-chips', 'Fish and chips', 'meals', 220, 11, 23, 10, 'serve', 400, { tags: UNSURE }),
  f('hot-chips', 'Hot chips', 'meals', 290, 3.5, 36, 14, 'small serve', 200, {
    tags: VG, serves: [{ name: 'large serve', grams: 350 }],
  }),
  f('fried-chicken', 'Fried chicken', 'meals', 290, 18, 11, 20, 'piece', 95, { tags: UNSURE }),
  f('dim-sim', 'Dim sim, fried', 'meals', 220, 8, 20, 12, 'dim sim', 55, {
    tags: PORK, substituteIds: ['halal-beef-sausage'],
  }),
  f('spring-roll', 'Spring roll', 'meals', 200, 5, 24, 9, 'roll', 60, { tags: UNSURE }),
  f('toastie', 'Ham & cheese toastie', 'meals', 265, 13, 26, 12, 'toastie', 150, {
    tags: ['pork', 'dairy'], substituteIds: ['turkey-breast-sliced', 'chicken-breast-sliced', 'beef-pastrami'],
  }),
  f('toastie-chicken', 'Chicken & cheese toastie', 'meals', 260, 15, 26, 10, 'toastie', 150, { tags: DV }),
  f('souvlaki', 'Lamb souvlaki', 'meals', 200, 14, 16, 9, 'souvlaki', 350, { tags: UNSURE }),
  f('poke-bowl', 'Poke bowl, salmon', 'meals', 130, 8, 15, 4.5, 'bowl', 400, {
    tags: HK, serves: [{ name: 'large bowl', grams: 550 }],
  }),
  f('poke-chicken', 'Poke bowl, chicken', 'meals', 125, 9, 16, 3.5, 'bowl', 400, { tags: UNSURE }),
  f('bacon-egg-roll', 'Bacon & egg roll', 'meals', 235, 12, 23, 11, 'roll', 200, {
    tags: PORK, substituteIds: ['beef-bacon', 'turkey-rashers'],
  }),
  f('egg-roll-halal', 'Egg & cheese roll', 'meals', 225, 12, 24, 9, 'roll', 200, { tags: DV }),
  f('steak-sandwich', 'Steak sandwich', 'meals', 210, 13, 20, 9, 'sandwich', 300, { tags: UNSURE }),
  f('sausage-in-bread', 'Sausage in bread', 'meals', 250, 9, 22, 14, 'sanga', 130, { tags: UNSURE }),
  f('chicken-rice-bowl', 'Chicken & rice bowl, home', 'meals', 145, 12, 17, 3, 'bowl', 450, {
    tags: HK, serves: [{ name: 'big bowl', grams: 600 }],
  }),
  f('shawarma-bowl', 'Shawarma bowl (rice, chicken, salad)', 'meals', 150, 11, 16, 4.5, 'bowl', 480, { tags: HK }),

  // ================= supplements =================
  f('whey-isolate', 'Whey protein isolate', 'supplements', 375, 88, 3, 1.5, 'scoop', 30, {
    tags: ['dairy', 'vegetarian'],
    serves: [{ name: '1 scoop', grams: 30 }, { name: '2 scoops', grams: 60 }, { name: 'half scoop', grams: 15 }],
  }),
  f('whey-concentrate', 'Whey protein concentrate', 'supplements', 400, 75, 8, 6, 'scoop', 33, {
    tags: ['dairy', 'vegetarian'], serves: [{ name: '2 scoops', grams: 66 }],
  }),
  f('casein', 'Casein protein powder', 'supplements', 370, 78, 6, 2, 'scoop', 33, {
    tags: ['dairy', 'vegetarian'], serves: [{ name: '2 scoops', grams: 66 }],
  }),
  f('plant-protein', 'Plant protein powder', 'supplements', 385, 72, 9, 6, 'scoop', 33, { tags: VG }),
  f('creatine', 'Creatine monohydrate', 'supplements', 0, 0, 0, 0, '5g serve', 5, {
    tags: VG, serves: [{ name: '1 tsp (5g)', grams: 5 }, { name: '10g loading', grams: 10 }],
  }),
  f('pre-workout', 'Pre-workout powder', 'supplements', 40, 1, 8, 0, 'scoop', 10, {
    tags: VG, serves: [{ name: 'half scoop', grams: 5 }],
  }),
  f('eaa-bcaa', 'EAA / BCAA powder', 'supplements', 30, 6, 1, 0, 'scoop', 10, { tags: UNSURE }),
  f('protein-bar-supp', 'Protein bar, high protein', 'supplements', 345, 32, 32, 10, 'bar', 60, {
    tags: ['dairy', 'unclear'], serves: [{ name: 'half bar', grams: 30 }],
  }),
  f('protein-cookie', 'Protein cookie', 'supplements', 380, 22, 40, 14, 'cookie', 75, { tags: ['dairy', 'unclear'] }),
  f('electrolyte', 'Electrolyte powder, sugar free', 'supplements', 10, 0, 2, 0, 'sachet', 6, { tags: VG }),
  f('fish-oil', 'Fish oil capsules', 'supplements', 900, 0, 0, 100, 'capsule', 1, { tags: HK }),
  f('multivitamin', 'Multivitamin tablet', 'supplements', 0, 0, 0, 0, 'tablet', 1, { tags: UNSURE }),

  // ================= snacks =================
  f('tim-tam', 'Tim Tam', 'snacks', 502, 4.5, 62, 26, 'biscuit', 18, { brand: 'Arnott\'s', tags: DV }),
  f('chips-25', 'Potato chips', 'snacks', 520, 6.5, 50, 33, 'small bag', 25, { tags: VG }),
  f('choc-row', 'Milk chocolate (Dairy Milk)', 'snacks', 530, 7.5, 57, 30, 'row', 25, { tags: DV }),
  f('dark-choc', 'Dark chocolate 70%', 'snacks', 579, 7.8, 46, 43, 'square', 10, { tags: V }),
  f('snickers', 'Snickers bar', 'snacks', 500, 8.5, 60, 24, 'bar', 50, { tags: DV }),
  f('muesli-bar', 'Muesli bar', 'snacks', 430, 7, 60, 17, 'bar', 31, { tags: V }),
  f('protein-bar', 'Protein bar', 'snacks', 350, 33, 30, 11, 'bar', 60, { tags: ['dairy', 'unclear'] }),
  f('ice-cream', 'Vanilla ice cream', 'snacks', 207, 3.5, 24, 11, 'scoop', 50, { tags: DV }),
  f('choc-ice-stick', 'Chocolate ice cream stick', 'snacks', 330, 4, 30, 21, 'stick', 79, { tags: DV }),
  f('zooper-dooper', 'Zooper Dooper', 'snacks', 47, 0, 12, 0, 'tube', 70, { tags: VG }),
  f('popcorn', 'Popcorn, buttered', 'snacks', 480, 9, 56, 23, 'cup', 11, { tags: DV }),
  f('rice-crackers', 'Rice crackers', 'snacks', 390, 7, 80, 3, 'cracker', 3, { tags: VG }),
  f('jatz', 'Jatz crackers', 'snacks', 480, 8, 62, 21, 'cracker', 3, { tags: V }),
  f('corn-thins', 'Corn thins', 'snacks', 380, 9, 72, 4, 'thin', 6, { tags: VG }),
  // Lolly snakes and most gummies are set with gelatine — halal versions exist,
  // so flag the label rather than hide the item.
  f('snakes', 'Lolly snakes', 'snacks', 330, 4, 78, 0.3, 'snake', 7, { tags: GEL }),
  f('marshmallows', 'Marshmallows', 'snacks', 318, 1.8, 81, 0.2, 'marshmallow', 7, { tags: GEL }),
  f('jelly-cup', 'Jelly cup', 'snacks', 62, 1, 14, 0, 'cup', 120, { tags: GEL }),
  f('banana-bread', 'Banana bread, cafe', 'snacks', 350, 5, 50, 14, 'slice', 110, { tags: V }),
  f('lamington', 'Lamington', 'snacks', 370, 5, 55, 14, 'lamington', 75, { tags: V }),
  f('anzac', 'Anzac biscuit', 'snacks', 470, 5.5, 62, 22, 'biscuit', 25, { tags: V }),
  f('croissant', 'Croissant', 'snacks', 406, 8, 45, 21, 'croissant', 65, { tags: DV }),
  f('cafe-muffin', 'Choc chip muffin, cafe', 'snacks', 400, 5.5, 50, 20, 'muffin', 110, { tags: DV }),
  f('hot-cross-bun', 'Hot cross bun', 'snacks', 290, 7.5, 54, 5, 'bun', 70, { tags: V }),
  f('vegemite-toast', 'Vegemite toast with butter', 'snacks', 270, 8, 38, 9, 'slice', 45, { tags: DV }),
  f('yoghurt-fruit', 'Fruit yoghurt tub', 'snacks', 95, 4, 14, 2.5, 'tub', 170, { tags: DV }),
  f('trail-mix', 'Trail mix', 'snacks', 480, 13, 45, 28, 'handful', 40, { tags: VG }),

  // ================= drinks =================
  f('coke', 'Soft drink (cola)', 'drinks', 42.5, 0, 10.6, 0, 'can', 375, { tags: VG, sugar: 10.6 }),
  f('zero-cola', 'Zero sugar cola', 'drinks', 0.4, 0, 0.1, 0, 'can', 375, { tags: VG }),
  fx('diet-cola', 'Diet cola', 'drinks', 0.4, 0, 0.1, 0, 'can', 375, {
    tags: VG, serves: [{ name: 'bottle 600ml', grams: 600 }, { name: 'glass', grams: 250 }],
  }),
  fx('soda-water', 'Soda water', 'drinks', 0, 0, 0, 0, 'glass', 250, {
    tags: VG, serves: [{ name: 'can', grams: 375 }, { name: 'bottle', grams: 600 }],
  }),
  f('lemonade', 'Lemonade', 'drinks', 40, 0, 9.8, 0, 'can', 375, { tags: VG }),
  f('oj', 'Orange juice', 'drinks', 45, 0.6, 10, 0.1, 'glass', 250, { tags: VG }),
  f('apple-juice', 'Apple juice', 'drinks', 46, 0.1, 11, 0.1, 'glass', 250, { tags: VG }),
  f('flat-white', 'Flat white, full cream', 'drinks', 43, 2.2, 3.4, 2.3, 'regular', 250, {
    tags: DV, serves: [{ name: 'large', grams: 350 }],
  }),
  f('flat-white-skim', 'Flat white, skim', 'drinks', 27, 2.7, 4, 0.1, 'regular', 250, { tags: DV }),
  f('cappuccino', 'Cappuccino', 'drinks', 40, 2, 3.2, 2.1, 'regular', 250, { tags: DV }),
  f('long-black', 'Long black', 'drinks', 1, 0.1, 0.2, 0, 'regular', 250, { tags: VG }),
  f('arabic-coffee', 'Arabic coffee', 'drinks', 2, 0.1, 0.3, 0, 'small cup', 60, { tags: VG }),
  f('mint-tea', 'Mint tea, no sugar', 'drinks', 1, 0, 0.2, 0, 'cup', 250, { tags: VG }),
  f('iced-coffee', 'Iced coffee, bottled', 'drinks', 62, 3.5, 8, 2, 'bottle', 500, { tags: DV }),
  f('milo', 'Milo made with milk', 'drinks', 79, 3.9, 9.9, 2.7, 'mug', 250, { tags: DV }),
  f('choc-milk', 'Chocolate milk', 'drinks', 81, 3.4, 10.5, 2.9, 'popper', 300, { tags: DV }),
  f('up-and-go', 'Up&Go', 'drinks', 74, 3.4, 11.4, 1.6, 'popper', 250, { brand: 'Sanitarium', tags: DV }),
  f('protein-shake', 'Protein shake, pre-made', 'drinks', 64, 8, 4.5, 1.5, 'bottle', 375, { tags: DV }),
  f('smoothie', 'Banana smoothie', 'drinks', 70, 3, 12, 1.2, 'cup', 350, { tags: DV }),
  // Alcohol: kept and tagged. Halal mode hides these; substitutes are offered.
  f('beer', 'Beer, full strength', 'drinks', 43, 0.4, 3, 0, 'stubbie', 375, {
    tags: ALC, substituteIds: ['kombucha', 'soda-water', 'diet-cola'],
  }),
  f('beer-light', 'Beer, light', 'drinks', 27, 0.3, 1.8, 0, 'stubbie', 375, {
    tags: ALC, substituteIds: ['kombucha', 'soda-water', 'diet-cola'],
  }),
  f('red-wine', 'Red wine', 'drinks', 85, 0.1, 2.6, 0, 'glass', 150, {
    tags: ALC, substituteIds: ['kombucha', 'soda-water'],
  }),
  f('white-wine', 'White wine', 'drinks', 82, 0.1, 2.6, 0, 'glass', 150, {
    tags: ALC, substituteIds: ['kombucha', 'soda-water'],
  }),
  f('spirits', 'Spirits (vodka, whisky)', 'drinks', 222, 0, 0, 0, 'shot', 30, {
    tags: ALC, substituteIds: ['soda-water', 'diet-cola'],
  }),
  fx('kombucha', 'Kombucha', 'drinks', 19, 0, 4.5, 0, 'bottle', 330, {
    tags: VG, serves: [{ name: 'glass', grams: 250 }],
  }),
  f('kombucha', 'Kombucha, bottled', 'drinks', 19, 0, 4.5, 0, 'bottle', 330, { tags: VG }),
  f('sports-drink', 'Sports drink', 'drinks', 24, 0, 6, 0, 'bottle', 600, { tags: VG }),
  f('red-bull', 'Red Bull', 'drinks', 45, 0.4, 11, 0, 'can', 250, { tags: V }),
  f('energy-zero', 'Energy drink, sugar free', 'drinks', 3, 0, 0.7, 0, 'can', 500, { tags: V }),
  f('coconut-water', 'Coconut water', 'drinks', 19, 0.7, 3.7, 0.2, 'bottle', 330, { tags: VG }),
  f('cordial', 'Cordial, made up', 'drinks', 20, 0, 5, 0, 'glass', 250, { tags: VG }),
  f('water-sparkling', 'Sparkling mineral water', 'drinks', 0, 0, 0, 0, 'bottle', 500, { tags: VG }),
  f('jallab', 'Jallab', 'drinks', 70, 0.2, 17, 0.2, 'glass', 250, { tags: VG }),
  // ============================================================
  // v9 — WORLD FOODS by cuisine. Typical values per 100 g for home-style or
  // takeaway versions (AUSNUT / USDA-style averages). Restaurant portions vary,
  // so these are estimates. Takeaway meat is 'unclear' for halal, as above.
  // ============================================================
  // Italian
  f('w-carbonara', 'Spaghetti carbonara', 'meals', 190, 8, 20, 9, 'bowl', 350, { tags: ['pork', 'dairy'], cuisine: 'italian' }),
  f('w-risotto-mushroom', 'Mushroom risotto', 'meals', 140, 3.5, 20, 5, 'bowl', 350, { tags: DV, cuisine: 'italian' }),
  f('w-minestrone', 'Minestrone soup', 'meals', 35, 1.5, 6, 0.8, 'bowl', 300, { tags: VG, cuisine: 'italian' }),
  f('w-gnocchi-napoli', 'Gnocchi, napoli sauce', 'meals', 130, 3, 25, 2, 'bowl', 300, { tags: V, cuisine: 'italian' }),
  f('w-penne-arrabbiata', 'Penne arrabbiata', 'meals', 125, 4, 23, 2, 'bowl', 350, { tags: VG, cuisine: 'italian' }),
  f('w-chicken-pesto-pasta', 'Chicken pesto pasta', 'meals', 175, 10, 18, 7, 'bowl', 350, { tags: UNSURE, cuisine: 'italian' }),
  f('w-bruschetta', 'Bruschetta', 'snacks', 170, 5, 25, 5.5, 'piece', 60, { tags: VG, cuisine: 'italian' }),
  f('w-tiramisu', 'Tiramisu', 'snacks', 283, 4.5, 30, 16, 'slice', 100, { tags: ['dairy', 'unclear'], cuisine: 'italian' }),
  f('w-calzone', 'Calzone, ham & cheese', 'meals', 245, 11, 28, 10, 'calzone', 300, { tags: ['pork', 'dairy'], cuisine: 'italian' }),
  f('w-arancini', 'Arancini ball', 'snacks', 230, 6, 28, 10, 'ball', 90, { tags: V, cuisine: 'italian' }),
  // Greek
  f('w-gyros-wrap', 'Gyros wrap, lamb', 'meals', 215, 11, 20, 10, 'wrap', 330, { tags: UNSURE, cuisine: 'greek' }),
  f('w-chicken-souvlaki-wrap', 'Chicken souvlaki wrap', 'meals', 190, 13, 18, 7, 'wrap', 300, { tags: UNSURE, cuisine: 'greek' }),
  f('w-moussaka', 'Moussaka', 'meals', 130, 6, 8, 8, 'serve', 350, { tags: ['dairy', 'unclear'], cuisine: 'greek' }),
  f('w-greek-salad', 'Greek salad', 'fruit-veg', 80, 3, 4, 6, 'bowl', 250, { tags: DV, cuisine: 'greek' }),
  f('w-tzatziki', 'Tzatziki', 'fats', 95, 4, 4, 7, 'tbsp', 30, { tags: DV, cuisine: 'greek' }),
  f('w-spanakopita', 'Spanakopita', 'snacks', 300, 8, 25, 19, 'piece', 120, { tags: DV, cuisine: 'greek' }),
  f('w-dolmades', 'Dolmades', 'snacks', 130, 2.5, 18, 5.5, 'piece', 30, { tags: VG, cuisine: 'greek' }),
  f('w-lamb-skewer', 'Lamb souvlaki skewer', 'protein', 230, 22, 2, 15, 'skewer', 120, { tags: UNSURE, cuisine: 'greek' }),
  // Turkish
  f('w-gozleme-spinach', 'Gozleme, spinach & cheese', 'meals', 230, 9, 28, 9, 'gozleme', 250, { tags: DV, cuisine: 'turkish' }),
  f('w-gozleme-lamb', 'Gozleme, lamb', 'meals', 245, 11, 27, 10, 'gozleme', 250, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-pide-lamb', 'Turkish pide, lamb', 'meals', 250, 12, 30, 9, 'pide', 300, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-lahmacun', 'Lahmacun', 'meals', 220, 10, 30, 6.5, 'piece', 180, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-adana-kebab', 'Adana kebab', 'protein', 250, 18, 2, 19, 'skewer', 120, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-turkish-delight', 'Turkish delight', 'snacks', 380, 0.5, 92, 1, 'piece', 15, { tags: ['gelatine', 'vegetarian'], cuisine: 'turkish' }),
  f('w-mercimek', 'Red lentil soup (mercimek)', 'meals', 75, 4.5, 11, 1.5, 'bowl', 300, { tags: VG, cuisine: 'turkish' }),
  // Mexican
  f('w-quesadilla-chicken', 'Chicken quesadilla', 'meals', 260, 14, 22, 13, 'serve', 250, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-beef-tacos', 'Beef tacos, hard shell', 'meals', 220, 10, 17, 12, 'taco', 90, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-fish-tacos', 'Fish tacos, soft', 'meals', 190, 10, 20, 8, 'taco', 120, { cuisine: 'mexican' }),
  f('w-burrito-bowl', 'Chicken burrito bowl', 'meals', 140, 10, 15, 4.5, 'bowl', 450, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-nachos', 'Nachos, beef & cheese', 'meals', 250, 9, 23, 14, 'plate', 300, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-enchiladas', 'Chicken enchiladas', 'meals', 165, 11, 14, 7.5, 'enchilada', 180, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-guacamole', 'Guacamole', 'fats', 160, 2, 8.5, 14.5, 'tbsp', 30, { tags: VG, cuisine: 'mexican' }),
  f('w-salsa', 'Tomato salsa', 'fruit-veg', 30, 1.5, 6.5, 0.2, 'tbsp', 30, { tags: VG, cuisine: 'mexican' }),
  f('w-refried-beans', 'Refried beans', 'carbs', 90, 5.5, 13, 1.5, 'half cup', 120, { tags: VG, cuisine: 'mexican' }),
  f('w-churros', 'Churros', 'snacks', 380, 5, 45, 20, 'churro', 40, { tags: V, cuisine: 'mexican' }),
  // Indian
  f('w-tikka-masala', 'Chicken tikka masala', 'meals', 140, 12, 6, 8, 'serve', 300, { tags: UNSURE, cuisine: 'indian' }),
  f('w-dal-tadka', 'Dal tadka', 'meals', 110, 6, 14, 3.5, 'bowl', 250, { tags: V, cuisine: 'indian' }),
  f('w-palak-paneer', 'Palak paneer', 'meals', 150, 7, 6, 11, 'serve', 250, { tags: DV, cuisine: 'indian' }),
  f('w-chana-masala', 'Chana masala', 'meals', 130, 6, 18, 4.5, 'serve', 250, { tags: VG, cuisine: 'indian' }),
  f('w-rogan-josh', 'Lamb rogan josh', 'meals', 150, 13, 5, 9, 'serve', 300, { tags: UNSURE, cuisine: 'indian' }),
  f('w-chicken-biryani', 'Chicken biryani', 'meals', 165, 9, 22, 4.5, 'plate', 400, { tags: UNSURE, cuisine: 'indian' }),
  f('w-tandoori-chicken', 'Tandoori chicken', 'protein', 150, 25, 3, 4.5, 'piece', 120, { tags: UNSURE, cuisine: 'indian' }),
  f('w-garlic-naan', 'Garlic naan', 'carbs', 300, 8.5, 48, 8.5, 'naan', 90, { tags: DV, cuisine: 'indian' }),
  f('w-samosa', 'Vegetable samosa', 'snacks', 260, 5, 30, 13, 'samosa', 80, { tags: VG, cuisine: 'indian' }),
  f('w-raita', 'Raita', 'fats', 65, 3, 5, 3.5, 'tbsp', 40, { tags: DV, cuisine: 'indian' }),
  // Chinese
  f('w-honey-chicken', 'Honey chicken', 'meals', 250, 11, 30, 9.5, 'serve', 300, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-sweet-sour-pork', 'Sweet and sour pork', 'meals', 230, 9, 25, 10.5, 'serve', 300, { tags: PORK, cuisine: 'chinese' }),
  f('w-beef-black-bean', 'Beef and black bean', 'meals', 130, 11, 7, 6.5, 'serve', 300, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-kung-pao', 'Kung pao chicken', 'meals', 165, 14, 8, 9, 'serve', 300, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-chow-mein', 'Chicken chow mein', 'meals', 140, 8, 16, 5, 'serve', 350, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-dumplings-pork', 'Pork dumplings, steamed', 'meals', 190, 8, 22, 7.5, 'dumpling', 25, { tags: PORK, cuisine: 'chinese' }),
  f('w-san-choy-bow', 'San choy bow', 'meals', 110, 10, 5, 5.5, 'cup', 120, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-mapo-tofu', 'Mapo tofu', 'meals', 110, 7, 5, 7, 'serve', 300, { tags: UNSURE, cuisine: 'chinese' }),
  // Japanese
  f('w-katsu-curry', 'Chicken katsu curry with rice', 'meals', 175, 8, 22, 6, 'plate', 450, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-ramen-tonkotsu', 'Ramen, tonkotsu', 'meals', 95, 5, 11, 3.5, 'bowl', 600, { tags: PORK, cuisine: 'japanese' }),
  f('w-teriyaki-don', 'Teriyaki chicken don', 'meals', 160, 10, 22, 3.5, 'bowl', 450, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-miso-soup', 'Miso soup', 'meals', 30, 2, 3, 1, 'bowl', 250, { tags: VG, cuisine: 'japanese' }),
  f('w-edamame', 'Edamame', 'protein', 120, 11, 9, 5, 'half cup', 80, { tags: VG, cuisine: 'japanese' }),
  f('w-gyoza', 'Gyoza, pork', 'snacks', 200, 8, 22, 9, 'piece', 25, { tags: PORK, cuisine: 'japanese' }),
  f('w-onigiri', 'Onigiri, tuna mayo', 'carbs', 180, 5, 33, 3, 'onigiri', 110, { cuisine: 'japanese' }),
  // Korean
  f('w-bibimbap', 'Bibimbap', 'meals', 130, 6, 20, 3.5, 'bowl', 500, { tags: UNSURE, cuisine: 'korean' }),
  f('w-korean-fried-chicken', 'Korean fried chicken', 'meals', 290, 17, 18, 17, 'piece', 60, { tags: UNSURE, cuisine: 'korean' }),
  f('w-bulgogi', 'Beef bulgogi', 'protein', 190, 16, 9, 10, 'serve', 200, { tags: UNSURE, cuisine: 'korean' }),
  f('w-kimchi', 'Kimchi', 'fruit-veg', 20, 1.5, 3.5, 0.5, 'serve', 50, { tags: UNSURE, cuisine: 'korean' }),
  f('w-japchae', 'Japchae', 'meals', 150, 3.5, 25, 4.5, 'serve', 250, { tags: UNSURE, cuisine: 'korean' }),
  f('w-tteokbokki', 'Tteokbokki', 'meals', 160, 3, 33, 1.5, 'serve', 250, { tags: UNSURE, cuisine: 'korean' }),
  // Thai
  f('w-green-curry', 'Green curry, chicken', 'meals', 130, 9, 5, 8.5, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-massaman', 'Massaman beef curry', 'meals', 160, 10, 9, 9.5, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-tom-yum', 'Tom yum soup, prawn', 'meals', 40, 4, 3, 1.5, 'bowl', 350, { cuisine: 'thai' }),
  f('w-pad-see-ew', 'Pad see ew, chicken', 'meals', 180, 7, 24, 6.5, 'plate', 400, { tags: UNSURE, cuisine: 'thai' }),
  f('w-basil-chicken', 'Thai basil chicken', 'meals', 150, 13, 6, 8.5, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-som-tam', 'Green papaya salad (som tam)', 'fruit-veg', 60, 2, 12, 1, 'serve', 200, { cuisine: 'thai' }),
  f('w-satay-skewer', 'Chicken satay skewer', 'protein', 220, 20, 6, 13, 'skewer', 50, { tags: UNSURE, cuisine: 'thai' }),
  f('w-mango-sticky-rice', 'Mango sticky rice', 'snacks', 250, 3, 45, 7, 'serve', 200, { tags: VG, cuisine: 'thai' }),
  // Vietnamese
  f('w-rice-paper-rolls', 'Rice paper rolls, prawn', 'meals', 110, 6, 18, 1.5, 'roll', 70, { cuisine: 'vietnamese' }),
  f('w-vermicelli-chicken', 'Lemongrass chicken vermicelli bowl', 'meals', 140, 9, 18, 4, 'bowl', 450, { tags: UNSURE, cuisine: 'vietnamese' }),
  f('w-bun-cha', 'Bun cha', 'meals', 150, 9, 18, 4.5, 'bowl', 450, { tags: PORK, cuisine: 'vietnamese' }),
  f('w-com-tam', 'Broken rice, pork chop', 'meals', 190, 10, 25, 5.5, 'plate', 450, { tags: PORK, cuisine: 'vietnamese' }),
  // Filipino
  f('w-chicken-adobo', 'Chicken adobo', 'protein', 190, 18, 3, 12, 'serve', 250, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-pancit', 'Pancit canton', 'meals', 150, 7, 20, 4.5, 'plate', 300, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-lumpia', 'Lumpia', 'snacks', 240, 7, 23, 13, 'roll', 40, { tags: UNSURE, cuisine: 'filipino' }),
  // African
  f('w-jollof-rice', 'Jollof rice', 'carbs', 150, 3, 25, 4.5, 'cup', 200, { tags: VG, cuisine: 'african' }),
  f('w-bobotie', 'Bobotie', 'meals', 170, 11, 10, 9.5, 'serve', 300, { tags: UNSURE, cuisine: 'african' }),
  f('w-injera', 'Injera', 'carbs', 130, 4, 26, 1, 'piece', 100, { tags: VG, cuisine: 'african' }),
  f('w-doro-wat', 'Doro wat (chicken stew)', 'meals', 150, 13, 6, 8, 'serve', 300, { tags: UNSURE, cuisine: 'african' }),
  f('w-shakshuka', 'Shakshuka', 'meals', 100, 6, 6, 6, 'serve', 300, { tags: V, cuisine: 'african' }),
  // American
  f('w-mac-cheese', 'Mac and cheese', 'meals', 165, 7, 18, 7, 'bowl', 300, { tags: DV, cuisine: 'american' }),
  f('w-buffalo-wings', 'Buffalo wings', 'protein', 250, 20, 3, 18, 'wing', 45, { tags: UNSURE, cuisine: 'american' }),
  f('w-hot-dog', 'Hot dog, beef', 'meals', 250, 10, 20, 15, 'hot dog', 150, { tags: UNSURE, cuisine: 'american' }),
  f('w-pancakes-syrup', 'Pancakes with maple syrup', 'snacks', 230, 5, 40, 6, 'stack of 3', 200, { tags: V, cuisine: 'american' }),
  f('w-bagel-cream-cheese', 'Bagel with cream cheese', 'carbs', 290, 9, 40, 10, 'bagel', 120, { tags: DV, cuisine: 'american' }),
  f('w-pulled-beef-burger', 'BBQ pulled beef burger', 'meals', 240, 13, 24, 10, 'burger', 250, { tags: UNSURE, cuisine: 'american' }),
  // Australian
  f('w-barramundi', 'Barramundi, grilled', 'protein', 110, 21, 0, 2.5, 'fillet', 180, { tags: HK, cuisine: 'australian' }),
  f('w-lamb-roast', 'Roast lamb, lean', 'protein', 230, 25, 0, 14.5, 'serve', 150, { tags: UNSURE, cuisine: 'australian' }),
  f('w-pavlova', 'Pavlova with cream & fruit', 'snacks', 260, 3, 50, 6, 'slice', 100, { tags: DV, cuisine: 'australian' }),
  f('w-lamington', 'Lamington', 'snacks', 370, 4.5, 50, 17, 'lamington', 70, { tags: V, cuisine: 'australian' }),
  f('w-vegemite-toast', 'Vegemite on buttered toast', 'carbs', 260, 10, 40, 6.5, 'slice', 45, { tags: V, cuisine: 'australian' }),
  f('w-smashed-avo', 'Smashed avo on toast', 'meals', 220, 6, 22, 12, 'serve', 200, { tags: VG, cuisine: 'australian' }),
  f('w-anzac-biscuit', 'Anzac biscuit', 'snacks', 470, 5.5, 63, 22, 'biscuit', 25, { tags: V, cuisine: 'australian' }),
  f('w-snag-sizzle', 'Sausage sizzle (beef snag in bread)', 'meals', 250, 9, 22, 14, 'sanga', 130, { tags: UNSURE, cuisine: 'australian' }),
  // ============================================================
  // v10 — more world foods, so every cuisine chip lists 20+ dishes.
  // Same basis as v9: typical per-100 g values for home-style / takeaway.
  // ============================================================
  // Italian
  f('w-lasagne-beef', 'Lasagne, beef (lasagna)', 'meals', 150, 8.5, 12, 7.5, 'slice', 350, { tags: ['dairy', 'unclear'], cuisine: 'italian' }),
  f('w-chicken-parmigiana', 'Chicken parmigiana (parma)', 'meals', 210, 17, 9, 11.5, 'parma', 350, { tags: ['dairy', 'unclear'], cuisine: 'italian' }),
  f('w-marinara-pasta', 'Seafood marinara pasta', 'meals', 140, 9, 19, 3.5, 'bowl', 400, { cuisine: 'italian' }),
  f('w-fettuccine-alfredo', 'Fettuccine alfredo', 'meals', 200, 6.5, 21, 10, 'bowl', 350, { tags: DV, cuisine: 'italian' }),
  f('w-caprese-salad', 'Caprese salad', 'fruit-veg', 150, 8, 3.5, 11.5, 'serve', 200, { tags: DV, cuisine: 'italian' }),
  f('w-panna-cotta', 'Panna cotta', 'snacks', 230, 3, 20, 15.5, 'serve', 120, { tags: ['dairy', 'gelatine'], cuisine: 'italian' }),
  f('w-gelato', 'Gelato', 'snacks', 190, 3.5, 26, 8, 'scoop', 80, { tags: DV, cuisine: 'italian' }),
  // Greek
  f('w-pastitsio', 'Pastitsio', 'meals', 170, 9, 14, 8.5, 'serve', 350, { tags: ['dairy', 'unclear'], cuisine: 'greek' }),
  f('w-keftedes', 'Keftedes (meatballs)', 'protein', 240, 16, 8, 16, 'meatball', 30, { tags: UNSURE, cuisine: 'greek' }),
  f('w-grilled-octopus', 'Grilled octopus', 'protein', 160, 25, 4, 4.5, 'serve', 150, { cuisine: 'greek' }),
  f('w-saganaki', 'Saganaki (fried cheese)', 'snacks', 330, 18, 6, 26, 'serve', 100, { tags: DV, cuisine: 'greek' }),
  f('w-avgolemono', 'Avgolemono soup', 'meals', 60, 4.5, 6, 2, 'bowl', 350, { tags: UNSURE, cuisine: 'greek' }),
  f('w-fasolada', 'Fasolada (bean soup)', 'meals', 85, 4.5, 11, 2.5, 'bowl', 350, { tags: VG, cuisine: 'greek' }),
  f('w-galaktoboureko', 'Galaktoboureko', 'snacks', 280, 5, 38, 12, 'piece', 120, { tags: DV, cuisine: 'greek' }),
  f('w-loukoumades', 'Loukoumades', 'snacks', 330, 4.5, 50, 12.5, 'serve', 100, { tags: V, cuisine: 'greek' }),
  f('w-greek-yoghurt-honey', 'Greek yoghurt with honey', 'snacks', 160, 7.5, 16, 7.5, 'bowl', 170, { tags: DV, cuisine: 'greek' }),
  f('w-horiatiki-pita', 'Pita bread, Greek', 'carbs', 275, 9, 55, 1.5, 'pita', 80, { tags: VG, cuisine: 'greek' }),
  f('w-tirokafteri', 'Tirokafteri (spicy feta dip)', 'fats', 230, 9, 4, 20, 'tbsp', 30, { tags: DV, cuisine: 'greek' }),
  // Turkish
  f('w-doner-kebab', 'Doner kebab, lamb', 'meals', 220, 12, 20, 10.5, 'kebab', 400, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-iskender', 'Iskender kebab', 'meals', 180, 11, 12, 10, 'plate', 400, { tags: ['dairy', 'unclear'], cuisine: 'turkish' }),
  f('w-kofte', 'Turkish kofte', 'protein', 250, 17, 6, 18, 'kofte', 40, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-manti', 'Manti (Turkish dumplings)', 'meals', 180, 8, 22, 6.5, 'serve', 300, { tags: ['dairy', 'unclear'], cuisine: 'turkish' }),
  f('w-menemen', 'Menemen (Turkish eggs)', 'meals', 110, 6.5, 5, 7.5, 'serve', 250, { tags: V, cuisine: 'turkish' }),
  f('w-simit', 'Simit (sesame bread ring)', 'carbs', 300, 10, 52, 6, 'simit', 110, { tags: VG, cuisine: 'turkish' }),
  f('w-borek-cheese', 'Borek, cheese', 'snacks', 310, 10, 28, 17.5, 'piece', 120, { tags: DV, cuisine: 'turkish' }),
  f('w-imam-bayildi', 'Imam bayildi (stuffed eggplant)', 'fruit-veg', 110, 2, 9, 7.5, 'serve', 250, { tags: VG, cuisine: 'turkish' }),
  f('w-turkish-baklava', 'Baklava, pistachio', 'snacks', 430, 7, 47, 24, 'piece', 30, { tags: V, cuisine: 'turkish' }),
  f('w-ayran', 'Ayran (yoghurt drink)', 'drinks', 36, 1.7, 2.5, 2, 'glass', 250, { tags: DV, cuisine: 'turkish' }),
  f('w-kunefe', 'Kunefe', 'snacks', 320, 7, 40, 15, 'serve', 150, { tags: DV, cuisine: 'turkish' }),
  f('w-tavuk-sis', 'Tavuk sis (chicken skewer)', 'protein', 165, 26, 2, 6, 'skewer', 120, { tags: UNSURE, cuisine: 'turkish' }),
  f('w-ezme', 'Ezme (spicy tomato salad)', 'fruit-veg', 60, 1.5, 6, 3.5, 'serve', 80, { tags: VG, cuisine: 'turkish' }),
  // Mexican
  f('w-beef-burrito', 'Beef burrito', 'meals', 200, 10, 23, 7.5, 'burrito', 350, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-chicken-fajitas', 'Chicken fajitas', 'meals', 150, 11, 13, 6, 'fajita', 180, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-carnitas-taco', 'Carnitas taco', 'meals', 230, 13, 16, 12.5, 'taco', 110, { tags: PORK, cuisine: 'mexican' }),
  f('w-chicken-tacos-soft', 'Chicken tacos, soft', 'meals', 190, 12, 18, 7.5, 'taco', 120, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-chilli-con-carne', 'Chilli con carne', 'meals', 115, 9, 9, 5, 'bowl', 350, { tags: UNSURE, cuisine: 'mexican' }),
  f('w-mexican-rice', 'Mexican rice', 'carbs', 150, 3, 27, 3.5, 'cup', 180, { tags: VG, cuisine: 'mexican' }),
  f('w-elote', 'Elote (Mexican street corn)', 'fruit-veg', 170, 4.5, 20, 9, 'cob', 150, { tags: DV, cuisine: 'mexican' }),
  f('w-tortilla-chips', 'Corn tortilla chips', 'snacks', 490, 7, 63, 23, 'handful', 30, { tags: VG, cuisine: 'mexican' }),
  f('w-tamales', 'Tamales, chicken', 'meals', 200, 8, 20, 10, 'tamale', 130, { tags: UNSURE, cuisine: 'mexican' }),
  // Indian
  f('w-lamb-korma', 'Lamb korma', 'meals', 190, 12, 7, 13, 'serve', 300, { tags: ['dairy', 'unclear'], cuisine: 'indian' }),
  f('w-chicken-vindaloo', 'Chicken vindaloo', 'meals', 140, 13, 5, 7.5, 'serve', 300, { tags: UNSURE, cuisine: 'indian' }),
  f('w-chicken-madras', 'Beef madras', 'meals', 155, 13, 6, 9, 'serve', 300, { tags: UNSURE, cuisine: 'indian' }),
  f('w-aloo-gobi', 'Aloo gobi', 'meals', 95, 2.5, 12, 4.5, 'serve', 250, { tags: VG, cuisine: 'indian' }),
  f('w-paneer-tikka', 'Paneer tikka', 'protein', 250, 14, 7, 18.5, 'serve', 150, { tags: DV, cuisine: 'indian' }),
  f('w-plain-paratha', 'Paratha', 'carbs', 320, 7, 45, 12.5, 'paratha', 80, { tags: V, cuisine: 'indian' }),
  f('w-roti', 'Roti / chapati', 'carbs', 260, 8.5, 48, 4, 'roti', 45, { tags: VG, cuisine: 'indian' }),
  f('w-masala-dosa', 'Masala dosa', 'meals', 170, 4, 26, 5.5, 'dosa', 250, { tags: VG, cuisine: 'indian' }),
  f('w-onion-bhaji', 'Onion bhaji', 'snacks', 280, 6, 27, 16.5, 'bhaji', 50, { tags: VG, cuisine: 'indian' }),
  f('w-mango-lassi', 'Mango lassi', 'drinks', 90, 3, 16, 2, 'glass', 300, { tags: DV, cuisine: 'indian' }),
  f('w-gulab-jamun', 'Gulab jamun', 'snacks', 320, 5, 50, 11, 'piece', 40, { tags: DV, cuisine: 'indian' }),
  // Chinese
  f('w-lemon-chicken', 'Lemon chicken', 'meals', 230, 12, 24, 9.5, 'serve', 300, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-mongolian-beef', 'Mongolian beef', 'meals', 160, 12, 10, 8, 'serve', 300, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-salt-pepper-squid', 'Salt and pepper squid', 'protein', 240, 14, 16, 13, 'serve', 200, { cuisine: 'chinese' }),
  f('w-char-siu', 'Char siu pork', 'protein', 250, 22, 10, 13.5, 'serve', 150, { tags: PORK, cuisine: 'chinese' }),
  f('w-peking-duck-pancake', 'Peking duck pancake', 'meals', 250, 12, 22, 12.5, 'pancake', 60, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-hot-sour-soup', 'Hot and sour soup', 'meals', 45, 3, 5, 1.5, 'bowl', 300, { tags: UNSURE, cuisine: 'chinese' }),
  f('w-wonton-soup', 'Wonton soup', 'meals', 60, 4, 7, 1.5, 'bowl', 400, { tags: PORK, cuisine: 'chinese' }),
  f('w-steamed-pork-bun', 'BBQ pork bun (char siu bao)', 'snacks', 250, 8, 40, 6.5, 'bun', 70, { tags: PORK, cuisine: 'chinese' }),
  f('w-har-gow', 'Har gow (prawn dumpling)', 'snacks', 170, 8, 22, 5, 'dumpling', 25, { cuisine: 'chinese' }),
  f('w-xiao-long-bao', 'Xiao long bao', 'snacks', 210, 9, 22, 9, 'dumpling', 30, { tags: PORK, cuisine: 'chinese' }),
  f('w-egg-fried-rice', 'Egg fried rice', 'carbs', 170, 4.5, 26, 5, 'cup', 200, { tags: V, cuisine: 'chinese' }),
  f('w-singapore-noodles', 'Singapore noodles', 'meals', 160, 7, 20, 5.5, 'plate', 400, { tags: UNSURE, cuisine: 'chinese' }),
  // Japanese
  f('w-udon-soup', 'Udon noodle soup', 'meals', 70, 3, 13, 0.6, 'bowl', 550, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-prawn-tempura', 'Prawn tempura', 'protein', 250, 12, 18, 14.5, 'piece', 30, { cuisine: 'japanese' }),
  f('w-chicken-karaage', 'Chicken karaage', 'protein', 260, 18, 11, 16, 'piece', 30, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-salmon-teriyaki', 'Salmon teriyaki', 'protein', 200, 20, 7, 10, 'fillet', 150, { cuisine: 'japanese' }),
  f('w-yakitori', 'Yakitori chicken skewer', 'protein', 190, 19, 8, 9, 'skewer', 40, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-okonomiyaki', 'Okonomiyaki', 'meals', 180, 7, 18, 9, 'pancake', 250, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-gyudon', 'Gyudon (beef rice bowl)', 'meals', 160, 7.5, 22, 4.5, 'bowl', 450, { tags: UNSURE, cuisine: 'japanese' }),
  f('w-tuna-sashimi', 'Tuna sashimi', 'protein', 130, 29, 0, 1, 'piece', 15, { cuisine: 'japanese' }),
  f('w-california-roll', 'California roll', 'carbs', 150, 4, 25, 3.5, 'piece', 30, { cuisine: 'japanese' }),
  f('w-mochi', 'Mochi', 'snacks', 240, 3, 52, 1.5, 'piece', 40, { tags: VG, cuisine: 'japanese' }),
  // Korean
  f('w-kimchi-jjigae', 'Kimchi jjigae (stew)', 'meals', 60, 4.5, 3.5, 3, 'bowl', 400, { tags: PORK, cuisine: 'korean' }),
  f('w-sundubu', 'Sundubu jjigae (soft tofu stew)', 'meals', 55, 4.5, 3, 3, 'bowl', 450, { tags: UNSURE, cuisine: 'korean' }),
  f('w-dakgalbi', 'Dakgalbi (spicy chicken)', 'meals', 150, 13, 10, 6.5, 'serve', 350, { tags: UNSURE, cuisine: 'korean' }),
  f('w-galbi', 'Galbi (BBQ short ribs)', 'protein', 290, 19, 8, 20, 'serve', 200, { tags: UNSURE, cuisine: 'korean' }),
  f('w-samgyeopsal', 'Samgyeopsal (pork belly)', 'protein', 500, 9.5, 0, 51, 'serve', 150, { tags: PORK, cuisine: 'korean' }),
  f('w-kimbap', 'Kimbap', 'meals', 160, 5, 26, 4, 'roll', 230, { tags: UNSURE, cuisine: 'korean' }),
  f('w-kimchi-fried-rice', 'Kimchi fried rice', 'meals', 170, 5, 25, 5.5, 'plate', 350, { tags: UNSURE, cuisine: 'korean' }),
  f('w-japchae-beef', 'Bibim naengmyeon (cold noodles)', 'meals', 120, 4, 24, 1.5, 'bowl', 450, { tags: UNSURE, cuisine: 'korean' }),
  f('w-korean-pancake', 'Haemul pajeon (seafood pancake)', 'meals', 190, 8, 22, 8, 'slice', 100, { cuisine: 'korean' }),
  f('w-mandu', 'Mandu (dumplings)', 'snacks', 200, 8, 23, 8.5, 'dumpling', 30, { tags: UNSURE, cuisine: 'korean' }),
  f('w-jajangmyeon', 'Jajangmyeon (black bean noodles)', 'meals', 150, 5, 24, 4, 'bowl', 550, { tags: PORK, cuisine: 'korean' }),
  f('w-bossam', 'Bossam (boiled pork)', 'protein', 280, 20, 2, 21.5, 'serve', 150, { tags: PORK, cuisine: 'korean' }),
  f('w-hotteok', 'Hotteok (sweet pancake)', 'snacks', 300, 5, 50, 9, 'hotteok', 80, { tags: VG, cuisine: 'korean' }),
  f('w-seaweed-soup', 'Miyeok guk (seaweed soup)', 'meals', 30, 2.5, 1.5, 1.5, 'bowl', 400, { tags: UNSURE, cuisine: 'korean' }),
  // Thai
  f('w-red-curry', 'Red curry, chicken', 'meals', 135, 9, 6, 8.5, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-panang', 'Panang curry, beef', 'meals', 165, 11, 6, 11, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-yellow-curry', 'Yellow curry, chicken', 'meals', 125, 8, 8, 7, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-tom-kha', 'Tom kha gai (coconut chicken soup)', 'meals', 90, 6, 4, 6, 'bowl', 350, { tags: UNSURE, cuisine: 'thai' }),
  f('w-larb', 'Larb gai (chicken mince salad)', 'protein', 130, 16, 4, 5.5, 'serve', 200, { tags: UNSURE, cuisine: 'thai' }),
  f('w-pad-kee-mao', 'Pad kee mao (drunken noodles)', 'meals', 165, 7, 23, 5.5, 'plate', 400, { tags: UNSURE, cuisine: 'thai' }),
  f('w-thai-fried-rice', 'Thai fried rice, chicken', 'meals', 165, 7, 24, 4.5, 'plate', 350, { tags: UNSURE, cuisine: 'thai' }),
  f('w-thai-fish-cakes', 'Thai fish cakes', 'snacks', 200, 13, 12, 11, 'cake', 40, { cuisine: 'thai' }),
  f('w-thai-beef-salad', 'Thai beef salad', 'protein', 110, 12, 5, 4.5, 'serve', 250, { tags: UNSURE, cuisine: 'thai' }),
  f('w-chicken-cashew', 'Cashew chicken stir-fry', 'meals', 175, 13, 9, 10, 'serve', 300, { tags: UNSURE, cuisine: 'thai' }),
  f('w-thai-iced-tea', 'Thai milk tea', 'drinks', 70, 1, 13, 1.5, 'glass', 350, { tags: DV, cuisine: 'thai' }),
  // Vietnamese
  f('w-pho-chicken', 'Pho ga (chicken pho)', 'meals', 60, 4.5, 8, 1, 'bowl', 650, { tags: UNSURE, cuisine: 'vietnamese' }),
  f('w-bun-bo-hue', 'Bun bo Hue (spicy beef noodle soup)', 'meals', 75, 5, 8, 2.5, 'bowl', 650, { tags: PORK, cuisine: 'vietnamese' }),
  f('w-banh-xeo', 'Banh xeo (sizzling pancake)', 'meals', 190, 7, 20, 9, 'pancake', 250, { tags: PORK, cuisine: 'vietnamese' }),
  f('w-spring-roll-viet', 'Cha gio (fried spring roll)', 'snacks', 250, 8, 20, 15.5, 'roll', 40, { tags: PORK, cuisine: 'vietnamese' }),
  f('w-shaking-beef', 'Bo luc lac (shaking beef)', 'protein', 200, 18, 6, 11.5, 'serve', 250, { tags: UNSURE, cuisine: 'vietnamese' }),
  f('w-lemongrass-beef', 'Lemongrass beef vermicelli', 'meals', 145, 9, 18, 4.5, 'bowl', 450, { tags: UNSURE, cuisine: 'vietnamese' }),
  f('w-viet-chicken-salad', 'Vietnamese chicken salad', 'protein', 110, 12, 6, 4, 'serve', 250, { tags: UNSURE, cuisine: 'vietnamese' }),
  f('w-caramel-pork', 'Thit kho (caramel pork)', 'protein', 260, 15, 8, 19, 'serve', 200, { tags: PORK, cuisine: 'vietnamese' }),
  f('w-viet-iced-coffee', 'Vietnamese iced coffee', 'drinks', 95, 2, 16, 2.5, 'glass', 250, { tags: DV, cuisine: 'vietnamese' }),
  f('w-che', 'Che (sweet bean dessert)', 'snacks', 150, 3, 28, 3.5, 'cup', 250, { tags: VG, cuisine: 'vietnamese' }),
  f('w-com-ga', 'Com ga (chicken rice)', 'meals', 165, 10, 22, 4, 'plate', 450, { tags: UNSURE, cuisine: 'vietnamese' }),
  f('w-banh-cuon', 'Banh cuon (steamed rice rolls)', 'meals', 140, 5.5, 22, 3.5, 'serve', 300, { tags: PORK, cuisine: 'vietnamese' }),
  f('w-viet-sugarcane-prawn', 'Chao tom (sugarcane prawn)', 'protein', 180, 15, 8, 9.5, 'stick', 60, { cuisine: 'vietnamese' }),
  // Filipino
  f('w-pork-adobo', 'Pork adobo', 'protein', 260, 17, 3, 20, 'serve', 250, { tags: PORK, cuisine: 'filipino' }),
  f('w-sinigang', 'Sinigang na baboy (sour pork soup)', 'meals', 55, 4.5, 3, 2.5, 'bowl', 450, { tags: PORK, cuisine: 'filipino' }),
  f('w-sinigang-hipon', 'Sinigang na hipon (prawn)', 'meals', 35, 4, 3, 0.8, 'bowl', 450, { cuisine: 'filipino' }),
  f('w-kare-kare', 'Kare-kare (oxtail peanut stew)', 'meals', 190, 13, 6, 13, 'serve', 300, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-lechon', 'Lechon (roast pork)', 'protein', 330, 22, 0, 27, 'serve', 150, { tags: PORK, cuisine: 'filipino' }),
  f('w-sisig', 'Sisig', 'protein', 280, 15, 4, 23, 'serve', 200, { tags: PORK, cuisine: 'filipino' }),
  f('w-tapsilog', 'Tapsilog (beef, egg & garlic rice)', 'meals', 190, 11, 20, 7, 'plate', 400, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-longsilog', 'Longsilog (sausage, egg & rice)', 'meals', 220, 9, 22, 11, 'plate', 400, { tags: PORK, cuisine: 'filipino' }),
  f('w-garlic-rice', 'Garlic fried rice (sinangag)', 'carbs', 180, 3.5, 30, 5, 'cup', 180, { tags: VG, cuisine: 'filipino' }),
  f('w-chicken-inasal', 'Chicken inasal', 'protein', 200, 22, 3, 11, 'piece', 200, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-tinola', 'Tinola (chicken ginger soup)', 'meals', 55, 6, 2.5, 2.5, 'bowl', 450, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-bistek', 'Bistek Tagalog', 'protein', 200, 20, 6, 10.5, 'serve', 200, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-menudo-ph', 'Pork menudo', 'meals', 150, 10, 8, 8.5, 'serve', 300, { tags: PORK, cuisine: 'filipino' }),
  f('w-arroz-caldo', 'Arroz caldo (chicken congee)', 'meals', 80, 4.5, 11, 2, 'bowl', 450, { tags: UNSURE, cuisine: 'filipino' }),
  f('w-pandesal', 'Pandesal', 'carbs', 290, 8.5, 52, 5, 'roll', 40, { tags: V, cuisine: 'filipino' }),
  f('w-halo-halo', 'Halo-halo', 'snacks', 150, 3, 28, 3, 'glass', 350, { tags: DV, cuisine: 'filipino' }),
  f('w-leche-flan', 'Leche flan', 'snacks', 280, 7, 40, 10, 'slice', 100, { tags: DV, cuisine: 'filipino' }),
  f('w-turon', 'Turon (banana spring roll)', 'snacks', 260, 2, 42, 10, 'turon', 80, { tags: VG, cuisine: 'filipino' }),
  // African
  f('w-peri-peri-chicken', 'Peri-peri chicken, quarter', 'protein', 200, 24, 1, 11, 'quarter', 250, { tags: UNSURE, cuisine: 'african' }),
  f('w-bunny-chow', 'Bunny chow (curry in bread)', 'meals', 190, 8, 24, 7, 'quarter loaf', 450, { tags: UNSURE, cuisine: 'african' }),
  f('w-bobotie-lamb', 'Bobotie, lamb', 'meals', 180, 12, 9, 10.5, 'serve', 300, { tags: UNSURE, cuisine: 'african' }),
  f('w-chakalaka', 'Chakalaka (spicy veg relish)', 'fruit-veg', 70, 2.5, 10, 2.5, 'serve', 100, { tags: VG, cuisine: 'african' }),
  f('w-pap', 'Pap (maize porridge)', 'carbs', 70, 1.5, 15, 0.4, 'cup', 250, { tags: VG, cuisine: 'african' }),
  f('w-ugali', 'Ugali', 'carbs', 110, 2.5, 24, 0.5, 'serve', 250, { tags: VG, cuisine: 'african' }),
  f('w-sukuma-wiki', 'Sukuma wiki (braised greens)', 'fruit-veg', 60, 3, 6, 3, 'serve', 150, { tags: VG, cuisine: 'african' }),
  f('w-egusi-soup', 'Egusi soup', 'meals', 200, 11, 6, 15, 'bowl', 300, { tags: UNSURE, cuisine: 'african' }),
  f('w-suya', 'Suya (spiced beef skewer)', 'protein', 230, 25, 4, 12.5, 'skewer', 100, { tags: UNSURE, cuisine: 'african' }),
  f('w-puff-puff', 'Puff-puff (fried dough)', 'snacks', 340, 5.5, 45, 15.5, 'piece', 30, { tags: VG, cuisine: 'african' }),
  f('w-misir-wat', 'Misir wat (spiced red lentils)', 'meals', 120, 7, 16, 3.5, 'serve', 250, { tags: VG, cuisine: 'african' }),
  f('w-tagine-chicken', 'Chicken tagine with olives', 'meals', 140, 13, 6, 7, 'serve', 350, { tags: UNSURE, cuisine: 'african' }),
  f('w-couscous', 'Couscous, cooked', 'carbs', 112, 3.8, 23, 0.2, 'cup', 160, { tags: VG, cuisine: 'african' }),
  f('w-boerewors', 'Boerewors (sausage)', 'protein', 290, 15, 3, 24, 'link', 100, { tags: UNSURE, cuisine: 'african' }),
  f('w-koeksister', 'Koeksister', 'snacks', 400, 4, 60, 16, 'piece', 50, { tags: V, cuisine: 'african' }),
  // American
  f('w-cheeseburger', 'Cheeseburger', 'meals', 265, 14, 22, 13.5, 'burger', 200, { tags: ['dairy', 'unclear'], cuisine: 'american' }),
  f('w-bbq-ribs', 'BBQ pork ribs', 'protein', 290, 20, 8, 20, 'serve', 300, { tags: PORK, cuisine: 'american' }),
  f('w-brisket', 'Smoked beef brisket', 'protein', 250, 24, 0, 17, 'serve', 150, { tags: UNSURE, cuisine: 'american' }),
  f('w-philly-cheesesteak', 'Philly cheesesteak', 'meals', 230, 13, 20, 11, 'sub', 300, { tags: ['dairy', 'unclear'], cuisine: 'american' }),
  f('w-clam-chowder', 'Clam chowder', 'meals', 90, 4, 8, 4.5, 'bowl', 350, { tags: DV, cuisine: 'american' }),
  f('w-cobb-salad', 'Cobb salad', 'protein', 160, 12, 3, 11, 'bowl', 350, { tags: PORK, cuisine: 'american' }),
  f('w-chicken-tenders', 'Chicken tenders', 'protein', 270, 17, 15, 16, 'tender', 45, { tags: UNSURE, cuisine: 'american' }),
  f('w-mashed-gravy', 'Mashed potato with gravy', 'carbs', 105, 2, 15, 4, 'cup', 240, { tags: UNSURE, cuisine: 'american' }),
  f('w-cornbread', 'Cornbread', 'carbs', 330, 7, 43, 14, 'piece', 65, { tags: V, cuisine: 'american' }),
  f('w-apple-pie', 'Apple pie', 'snacks', 265, 2.5, 37, 12.5, 'slice', 125, { tags: V, cuisine: 'american' }),
  f('w-brownie', 'Chocolate brownie', 'snacks', 440, 5, 55, 23, 'brownie', 60, { tags: V, cuisine: 'american' }),
  f('w-milkshake', 'Chocolate milkshake', 'drinks', 120, 3.5, 19, 3.5, 'cup', 400, { tags: DV, cuisine: 'american' }),
  // Australian
  f('w-chicken-parma-pub', 'Pub chicken parma with chips', 'meals', 210, 14, 17, 10, 'plate', 550, { tags: ['dairy', 'unclear'], cuisine: 'australian' }),
  f('w-chiko-roll', 'Chiko roll', 'snacks', 250, 6, 31, 11, 'roll', 170, { tags: UNSURE, cuisine: 'australian' }),
  f('w-laksa', 'Laksa, chicken', 'meals', 110, 6, 9, 6, 'bowl', 600, { tags: UNSURE, cuisine: 'australian' }),
]

// cuisine for dishes that were already in the list (ids never change)
const EXISTING_CUISINE: Record<string, Cuisine> = {
  'sf-spag-bol': 'italian', 'sf-lasagna': 'italian', 'sf-pizza-margherita': 'italian', 'sf-pizza-pepperoni': 'italian', 'sf-parma': 'australian',
  'sf-pho': 'vietnamese', 'sf-banh-mi': 'vietnamese', 'sf-banh-mi-chicken': 'vietnamese',
  'sf-pad-thai': 'thai', 'sf-butter-chicken': 'indian', 'sf-burrito': 'mexican',
  'sf-sushi-roll': 'japanese', 'sf-sushi-salmon': 'japanese', 'sf-sashimi-salmon': 'japanese',
  'sf-souvlaki': 'greek', 'sf-meat-pie': 'australian', 'sf-sausage-roll': 'australian', 'sf-fish-chips': 'australian',
  'sf-schnitzel': 'australian', 'sf-fried-rice': 'chinese', 'sf-dim-sim': 'australian', 'sf-spring-roll': 'chinese',
  'sf-chicken-kebab': 'middle-eastern', 'sf-lamb-kebab': 'middle-eastern', 'sf-hsp': 'australian', 'sf-hsp-chicken': 'australian',
  'sf-falafel-wrap': 'middle-eastern', 'sf-shawarma-bowl': 'middle-eastern', 'sf-beef-burger': 'american', 'sf-chicken-burger': 'american',
  'sf-steak-sandwich': 'australian', 'sf-sausage-in-bread': 'australian', 'sf-grilled-chicken-peri': 'african',
}
for (const food of SEED_FOODS) {
  if (food.cuisine) continue
  if (food.category === 'middle-eastern') food.cuisine = 'middle-eastern'
  else if (EXISTING_CUISINE[food.id]) food.cuisine = EXISTING_CUISINE[food.id]
}

export const seedFoodById: Map<string, SeedFood> = new Map(SEED_FOODS.map((x) => [x.id, x]))

/**
 * Resolve an id that may be written either bare ('beef-bacon', as the halal
 * substitute map does) or with the historic seed prefix ('sf-beef-bacon').
 */
export function findSeedFood(id: string): SeedFood | undefined {
  return seedFoodById.get(id) ?? seedFoodById.get(`sf-${id}`)
}

/** Every id form a food might be referenced by, best first. */
export function foodIdCandidates(id: string): string[] {
  return id.startsWith('sf-') ? [id, id.slice(3)] : [id, `sf-${id}`]
}
