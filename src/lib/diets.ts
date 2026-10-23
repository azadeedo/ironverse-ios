// Diet options (v10.2, owner request 23 Oct 2026). One choice in Settings → Food
// changes three things: the carb/fat guides on the Food tab, which foods the
// search shows (vegetarian, vegan, pescatarian, dairy-free, gluten-free) and a
// "high carb" flag for keto / low-carb. Protein always stays your own target.
// Stored in a settings key (no schema change). Works alongside Halal mode.
import type { FoodItem } from '@/db/types'

export type DietId = 'balanced' | 'high-protein' | 'low-carb' | 'keto' | 'mediterranean' | 'vegetarian' | 'vegan' | 'pescatarian' | 'dairy-free' | 'gluten-free'
export const DIET_KEY = 'diet:type'

export interface Diet {
  id: DietId
  label: string
  emoji: string
  blurb: string
  /** share of calories from fat (carbs fill what's left after protein) */
  fatPct: number
  /** daily carb ceiling in grams, when the diet has one */
  carbCapG?: number
  tips: string[]
}

export const DIETS: Diet[] = [
  { id: 'balanced', label: 'Balanced', emoji: '🍽️', blurb: 'No restrictions — protein first, carbs and fats balanced. The default.', fatPct: 0.25,
    tips: ['Build each meal around a palm or two of protein.', 'Fill half the plate with vegetables or fruit.', 'Carbs around training help performance.'] },
  { id: 'high-protein', label: 'High protein', emoji: '🥩', blurb: 'For building or keeping muscle while dieting. Protein at every meal, moderate fat.', fatPct: 0.25,
    tips: ['Spread protein over 3–5 meals (about 0.4 g per kg each).', 'Greek yoghurt, eggs, lean meat, fish, tofu and whey are easy wins.', 'Your protein target lives in Settings → Daily targets.'] },
  { id: 'low-carb', label: 'Low carb', emoji: '🥑', blurb: 'Carbs capped near 100 g a day, more fat. Some people find it easier to stick to.', fatPct: 0.4, carbCapG: 100,
    tips: ['Keep most carbs around training for better sessions.', 'Vegetables, berries and legumes are the carbs worth keeping.', 'Fat loss still comes down to total calories.'] },
  { id: 'keto', label: 'Keto', emoji: '🧈', blurb: 'Very low carb (about 30 g a day) so the body runs mainly on fat and ketones.', fatPct: 0.65, carbCapG: 30,
    tips: ['High-rep and conditioning work often feels harder for the first 2–4 weeks.', 'Salt, potassium and magnesium matter more — the first week can bring “keto flu”.', 'Not suitable with some medical conditions or medications — check with your GP.'] },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒', blurb: 'Olive oil, fish, legumes, whole grains, vegetables and fruit — the most studied pattern for long-term health.', fatPct: 0.35,
    tips: ['Olive oil as the main fat; fish twice a week.', 'Legumes, nuts and whole grains most days.', 'Red meat and sweets occasionally.'] },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥗', blurb: 'No meat or fish. Eggs and dairy are in. Food search hides meat and seafood.', fatPct: 0.27,
    tips: ['Eggs, dairy, tofu, tempeh, legumes and seitan cover protein.', 'Combine grains and legumes over the day.', 'Watch iron and B12 — get bloods checked yearly.'] },
  { id: 'vegan', label: 'Vegan', emoji: '🌱', blurb: 'Plants only — no meat, fish, eggs, dairy or honey. Food search shows plant foods.', fatPct: 0.27,
    tips: ['Tofu, tempeh, legumes, seitan and pea or soy protein make the target reachable.', 'Supplement B12; consider vitamin D, omega-3 (algae) and iodine.', 'Slightly more total protein helps (plant protein is a bit less digestible).'] },
  { id: 'pescatarian', label: 'Pescatarian', emoji: '🐟', blurb: 'Vegetarian plus fish and seafood. Food search hides meat.', fatPct: 0.27,
    tips: ['Oily fish (salmon, sardines) 2–3 times a week for omega-3.', 'Canned tuna and prawns are cheap, lean protein.'] },
  { id: 'dairy-free', label: 'Dairy free', emoji: '🥛', blurb: 'No milk, cheese, yoghurt or butter. Food search hides dairy.', fatPct: 0.25,
    tips: ['Calcium from fortified plant milks, tofu (set with calcium), sardines and greens.', 'Whey is dairy — use egg, beef, pea or soy protein instead.'] },
  { id: 'gluten-free', label: 'Gluten free', emoji: '🌾', blurb: 'No wheat, barley or rye. Food search hides the obvious gluten foods — always check labels.', fatPct: 0.25,
    tips: ['Rice, potatoes, oats labelled gluten-free, quinoa and corn are your carbs.', 'Coeliac? Cross-contamination matters — trust the label, not the dish name.'] },
]

export const dietById = (id?: string | null): Diet => DIETS.find((d) => d.id === id) ?? DIETS[0]

/** carb / fat guides in grams for a calorie target, after protein */
export function dietMacros(targetKcal: number, proteinG: number, diet: Diet): { protein: number; carbs: number; fat: number } {
  const afterProtein = Math.max(0, targetKcal - proteinG * 4)
  if (diet.carbCapG !== undefined) {
    const carbs = Math.min(diet.carbCapG, Math.round(afterProtein / 4))
    const fat = Math.max(0, Math.round((afterProtein - carbs * 4) / 9))
    return { protein: proteinG, carbs, fat }
  }
  const fat = Math.round((targetKcal * diet.fatPct) / 9)
  const carbs = Math.max(0, Math.round((targetKcal - proteinG * 4 - fat * 9) / 4))
  return { protein: proteinG, carbs, fat }
}

const MEAT = /\b(chicken|beef|lamb|pork|bacon|ham|turkey|sausages?|snags?|mince|steak|kebabs?|doner|shawarma|meat(balls?)?|salami|prosciutto|pancetta|veal|duck|goat|chorizo|pepperoni|brisket|ribs?|wings?|burger|kofte?|kofta|souvlaki|gyros|bulgogi|galbi|lechon|sisig|adobo|suya|boerewors|bobotie|biltong|jerky|liver|schnitzel|parma|nuggets?|hot dog|tapa|char siu|pastrami|corned)\b/i
const FISH = /\b(fish|salmon|tuna|prawns?|shrimp|barramundi|cod|squid|calamari|octopus|crab|lobster|sardines?|anchov(y|ies)|mussels?|oysters?|seafood|scallops?|snapper|trout|mackerel|sashimi|sushi|tempura)\b/i
const DAIRY = /\b(milk|cheese|yoghurt|yogurt|butter|cream|whey|ghee|paneer|feta|halloumi|labneh|ricotta|mozzarella|parmesan|cheddar|custard|ice cream|gelato|latte|cappuccino|tzatziki|raita|lassi|ayran|kunefe|alfredo|carbonara|mac and cheese|quesadilla|saganaki)\b/i
const EGG = /\b(eggs?|omelette|frittata|mayo|mayonnaise|aioli|shakshuka|menemen)\b/i
const HONEY = /\bhoney\b/i
const GLUTEN = /\b(bread|toast|wheat|pasta|spaghetti|penne|fettuccine|lasagne|lasagna|noodles?|ramen|udon|naan|roti|paratha|chapati|pizza|beer|couscous|barley|bagels?|wraps?|pita|pide|gozleme|lahmacun|burger|bun|croissant|cake|biscuits?|cookies?|muffin|pancakes?|crackers?|cereal|weet-?bix|crumbed|schnitzel|parma|pie|pastry|baklava|borek|simit|pretzel|tortilla|dumplings?|gyoza|bao|spring roll|samosa|calzone|lamington|anzac|churros?|seitan)\b/i
const GLUTEN_SAFE = /\b(rice noodles?|gluten[- ]free|corn tortilla|rice paper)\b/i

/** is this food OK for the chosen diet? (unknown foods stay visible) */
export function fitsDiet(f: Partial<FoodItem> & { name?: string }, diet: Diet): boolean {
  const name = `${f.name ?? ''} ${f.brand ?? ''}`
  const tags = f.dietTags ?? []
  switch (diet.id) {
    case 'vegetarian': return tags.includes('vegetarian') || tags.includes('vegan') || (!MEAT.test(name) && !FISH.test(name) && !tags.includes('pork'))
    case 'vegan': return tags.includes('vegan') || (!MEAT.test(name) && !FISH.test(name) && !DAIRY.test(name) && !EGG.test(name) && !HONEY.test(name) && !tags.includes('dairy') && !tags.includes('pork') && !tags.includes('gelatine'))
    case 'pescatarian': return tags.includes('vegetarian') || tags.includes('vegan') || FISH.test(name) || (!MEAT.test(name) && !tags.includes('pork'))
    case 'dairy-free': return !tags.includes('dairy') && !DAIRY.test(name)
    case 'gluten-free': return GLUTEN_SAFE.test(name) || !GLUTEN.test(name)
    default: return true
  }
}

export function filterDiet<T extends Partial<FoodItem> & { name?: string }>(items: T[], diet: Diet): T[] {
  return diet.id === 'balanced' || diet.id === 'high-protein' || diet.id === 'low-carb' || diet.id === 'keto' || diet.id === 'mediterranean'
    ? items : items.filter((f) => fitsDiet(f, diet))
}

/** keto / low-carb: per-100 g carbs worth flagging */
export function highCarbFor(diet: Diet, carbsPer100: number | undefined): boolean {
  if (carbsPer100 === undefined) return false
  return diet.id === 'keto' ? carbsPer100 > 10 : diet.id === 'low-carb' ? carbsPer100 > 30 : false
}
