// Food health score out of 100 — a separate scanner from the calorie logger.
//
// How it is scored (modelled on how Yuka publicly describes its method):
//   60% nutrition · 30% additives · 10% organic
//   and any HIGH-risk additive caps the whole product at 49.
// Extra: ultra-processed food (NOVA group 4) loses 10 points.
//
// Nutrition uses the official Nutri-Score grade from Open Food Facts when the
// product has one; otherwise it is estimated from the label with the UK Food
// Standards Agency "traffic light" thresholds (per 100 g).
//
// Additive risk levels summarise public assessments — EFSA re-evaluations,
// IARC classifications, the 2007 Southampton study on colours (which led to the
// EU "may affect activity and attention in children" warning), and newer
// cohort / lab studies where flagged. "Risk" here means the strength of concern
// in the evidence, not that one serve will hurt you. Every entry says why.

export type Risk = 'high' | 'moderate' | 'limited' | 'none'

export interface Additive { code: string; name: string; role: string; risk: Risk; why: string }

const A = (code: string, name: string, role: string, risk: Risk, why: string): Additive => ({ code, name, role, risk, why })

export const ADDITIVES: Record<string, Additive> = Object.fromEntries([
  // ---- colours ----
  A('e100', 'Curcumin', 'colour (yellow, from turmeric)', 'none', 'Natural turmeric colour. No safety concern at food levels (EFSA).'),
  A('e101', 'Riboflavin', 'colour (vitamin B2)', 'none', 'It is vitamin B2.'),
  A('e102', 'Tartrazine', 'artificial yellow colour', 'moderate', 'One of the "Southampton six" colours linked to hyperactivity in some children; EU products must carry a warning. Can trigger reactions in aspirin-sensitive people.'),
  A('e104', 'Quinoline yellow', 'artificial yellow colour', 'moderate', 'Southampton-study colour — EU warning label about activity and attention in children.'),
  A('e110', 'Sunset yellow FCF', 'artificial orange colour', 'moderate', 'Southampton-study colour — EU warning label about activity and attention in children.'),
  A('e120', 'Carmine (cochineal)', 'red colour from insects', 'limited', 'Can cause allergic reactions in a small number of people; not vegan.'),
  A('e122', 'Carmoisine (azorubine)', 'artificial red colour', 'moderate', 'Southampton-study colour — EU warning label about activity and attention in children.'),
  A('e124', 'Ponceau 4R', 'artificial red colour', 'moderate', 'Southampton-study colour; banned in the USA.'),
  A('e127', 'Erythrosine', 'artificial pink colour', 'moderate', 'Contains iodine and has thyroid effects in animal studies; tightly restricted in the EU.'),
  A('e129', 'Allura red AC', 'artificial red colour', 'moderate', 'Southampton-study colour; 2022 mouse study linked it to gut inflammation.'),
  A('e132', 'Indigo carmine', 'artificial blue colour', 'limited', 'Low concern at normal intake; occasional intolerance.'),
  A('e133', 'Brilliant blue FCF', 'artificial blue colour', 'limited', 'Low concern at normal intake.'),
  A('e140', 'Chlorophylls', 'green colour', 'none', 'Natural plant pigment.'),
  A('e141', 'Copper chlorophyllins', 'green colour', 'none', 'No concern at food levels.'),
  A('e150a', 'Plain caramel', 'brown colour', 'none', 'Plain cooked sugar colour.'),
  A('e150b', 'Caustic sulphite caramel', 'brown colour', 'limited', 'Made with sulphites; low concern.'),
  A('e150c', 'Ammonia caramel', 'brown colour (colas, sauces)', 'moderate', 'Can contain 4-MEI, which IARC classes as "possibly carcinogenic" (2B).'),
  A('e150d', 'Sulphite ammonia caramel', 'brown colour (colas)', 'moderate', 'Can contain 4-MEI (IARC 2B, possibly carcinogenic). The usual cola colour.'),
  A('e153', 'Vegetable carbon', 'black colour', 'limited', 'Low concern; banned in the USA.'),
  A('e160a', 'Beta-carotene', 'orange colour', 'none', 'Vitamin A precursor (as a food colour; high-dose supplements are a different matter for smokers).'),
  A('e160b', 'Annatto', 'orange colour', 'limited', 'Natural, but can trigger allergy/intolerance in some people.'),
  A('e160c', 'Paprika extract', 'colour', 'none', 'Natural paprika colour.'),
  A('e162', 'Beetroot red', 'red colour', 'none', 'Natural beetroot colour.'),
  A('e163', 'Anthocyanins', 'purple/red colour', 'none', 'Natural fruit/vegetable pigment.'),
  A('e171', 'Titanium dioxide', 'white colour', 'high', 'Banned as a food additive in the EU since 2022 after EFSA could not rule out damage to DNA (genotoxicity). Still allowed in Australia.'),
  A('e172', 'Iron oxides', 'colour', 'limited', 'Low concern at food levels.'),
  // ---- preservatives ----
  A('e200', 'Sorbic acid', 'preservative', 'limited', 'Low concern; occasional skin sensitivity.'),
  A('e202', 'Potassium sorbate', 'preservative', 'limited', 'Low concern at permitted levels (EFSA 2019).'),
  A('e210', 'Benzoic acid', 'preservative', 'moderate', 'Can form benzene with vitamin C; may worsen asthma/hives in sensitive people.'),
  A('e211', 'Sodium benzoate', 'preservative (soft drinks)', 'moderate', 'Can form benzene (a carcinogen) with vitamin C in drinks; included in the Southampton hyperactivity study.'),
  A('e212', 'Potassium benzoate', 'preservative', 'moderate', 'Same concerns as sodium benzoate.'),
  A('e220', 'Sulphur dioxide', 'preservative (wine, dried fruit)', 'moderate', 'Sulphites trigger asthma and reactions in sensitive people; must be declared as an allergen.'),
  A('e221', 'Sodium sulphite', 'preservative', 'moderate', 'Sulphite — asthma trigger in sensitive people.'),
  A('e223', 'Sodium metabisulphite', 'preservative', 'moderate', 'Sulphite — asthma trigger in sensitive people.'),
  A('e224', 'Potassium metabisulphite', 'preservative', 'moderate', 'Sulphite — asthma trigger in sensitive people.'),
  A('e228', 'Potassium bisulphite', 'preservative', 'moderate', 'Sulphite — asthma trigger in sensitive people.'),
  A('e249', 'Potassium nitrite', 'preservative (cured meat)', 'high', 'Nitrites form nitrosamines; processed meat is an IARC Group 1 carcinogen (bowel cancer).'),
  A('e250', 'Sodium nitrite', 'preservative (ham, bacon, salami)', 'high', 'Forms nitrosamines when cooked; processed meat is an IARC Group 1 carcinogen (bowel cancer).'),
  A('e251', 'Sodium nitrate', 'preservative (cured meat)', 'high', 'Converts to nitrite in the body/meat; linked with processed-meat cancer risk.'),
  A('e252', 'Potassium nitrate', 'preservative (cured meat)', 'high', 'Converts to nitrite; linked with processed-meat cancer risk.'),
  A('e260', 'Acetic acid', 'acidity (vinegar)', 'none', 'Vinegar.'),
  A('e270', 'Lactic acid', 'acidity', 'none', 'Naturally made by fermentation.'),
  A('e280', 'Propionic acid', 'preservative (bread)', 'limited', 'Low concern; some reports of irritability in children.'),
  A('e282', 'Calcium propionate', 'preservative (bread)', 'limited', 'Low concern at normal intake.'),
  A('e290', 'Carbon dioxide', 'fizz', 'none', 'The bubbles.'),
  A('e296', 'Malic acid', 'acidity', 'none', 'Found naturally in apples.'),
  // ---- antioxidants ----
  A('e300', 'Ascorbic acid', 'antioxidant (vitamin C)', 'none', 'It is vitamin C.'),
  A('e301', 'Sodium ascorbate', 'antioxidant', 'none', 'A form of vitamin C.'),
  A('e306', 'Tocopherols', 'antioxidant (vitamin E)', 'none', 'Vitamin E.'),
  A('e307', 'Alpha-tocopherol', 'antioxidant', 'none', 'Vitamin E.'),
  A('e319', 'TBHQ', 'antioxidant (oils, fried foods)', 'moderate', 'Synthetic antioxidant; animal studies raise immune and other concerns at high intake.'),
  A('e320', 'BHA', 'antioxidant', 'high', 'IARC classes BHA as "possibly carcinogenic to humans" (2B).'),
  A('e321', 'BHT', 'antioxidant', 'moderate', 'Synthetic antioxidant with mixed animal evidence; EFSA lowered its acceptable intake.'),
  A('e322', 'Lecithins', 'emulsifier', 'none', 'Usually from soy or sunflower. No concern.'),
  A('e330', 'Citric acid', 'acidity', 'none', 'Found naturally in citrus fruit.'),
  A('e331', 'Sodium citrates', 'acidity regulator', 'none', 'No concern.'),
  A('e332', 'Potassium citrates', 'acidity regulator', 'none', 'No concern.'),
  A('e334', 'Tartaric acid', 'acidity', 'none', 'Found naturally in grapes.'),
  A('e338', 'Phosphoric acid', 'acidity (colas)', 'moderate', 'Phosphate additive. High intake is linked to lower bone density and is a concern for kidneys and heart; EFSA set a group limit in 2019.'),
  A('e339', 'Sodium phosphates', 'stabiliser', 'moderate', 'Phosphate additive — high intake is a concern for heart and kidney health (EFSA 2019 group limit).'),
  A('e340', 'Potassium phosphates', 'stabiliser', 'moderate', 'Phosphate additive — see above.'),
  A('e341', 'Calcium phosphates', 'stabiliser / anti-caking', 'moderate', 'Phosphate additive — see above.'),
  A('e385', 'Calcium disodium EDTA', 'preservative', 'limited', 'Low concern at permitted levels.'),
  // ---- thickeners / emulsifiers ----
  A('e401', 'Sodium alginate', 'thickener (seaweed)', 'none', 'From seaweed. No concern.'),
  A('e406', 'Agar', 'thickener (seaweed)', 'none', 'No concern.'),
  A('e407', 'Carrageenan', 'thickener (dairy, deli meat)', 'moderate', 'Animal and cell studies link it to gut inflammation; EFSA (2018) asked for more data and lowered confidence.'),
  A('e410', 'Locust bean gum', 'thickener', 'none', 'Natural gum.'),
  A('e412', 'Guar gum', 'thickener', 'none', 'Natural fibre.'),
  A('e414', 'Gum arabic', 'thickener', 'none', 'Natural fibre.'),
  A('e415', 'Xanthan gum', 'thickener', 'none', 'Fermentation-made fibre. No concern.'),
  A('e418', 'Gellan gum', 'thickener', 'none', 'No concern.'),
  A('e420', 'Sorbitol', 'sweetener', 'limited', 'Laxative effect in larger amounts.'),
  A('e421', 'Mannitol', 'sweetener', 'limited', 'Laxative effect in larger amounts.'),
  A('e422', 'Glycerol', 'humectant', 'none', 'No concern.'),
  A('e433', 'Polysorbate 80', 'emulsifier', 'moderate', 'Emulsifier that altered gut bacteria and caused low-grade gut inflammation in animal studies (Chassaing et al., Nature 2015).'),
  A('e435', 'Polysorbate 60', 'emulsifier', 'moderate', 'Same family as polysorbate 80.'),
  A('e440', 'Pectin', 'thickener', 'none', 'Fruit fibre. No concern.'),
  A('e450', 'Diphosphates', 'raising agent / stabiliser', 'moderate', 'Phosphate additive — high intake is a concern for heart and kidney health.'),
  A('e451', 'Triphosphates', 'stabiliser (meat)', 'moderate', 'Phosphate additive — see above.'),
  A('e452', 'Polyphosphates', 'stabiliser (meat, seafood)', 'moderate', 'Phosphate additive — see above.'),
  A('e460', 'Cellulose', 'bulking agent', 'none', 'Plant fibre.'),
  A('e461', 'Methyl cellulose', 'thickener', 'limited', 'Low concern.'),
  A('e464', 'Hydroxypropyl methyl cellulose', 'thickener', 'limited', 'Low concern.'),
  A('e466', 'Carboxymethyl cellulose (CMC)', 'thickener', 'moderate', 'Emulsifier that changed gut bacteria in a 2022 human trial (Chassaing et al., Gastroenterology).'),
  A('e471', 'Mono- and diglycerides of fatty acids', 'emulsifier', 'limited', 'Very common. A 2023 French cohort (NutriNet-Santé) linked high emulsifier intake with heart disease — association only.'),
  A('e472e', 'DATEM', 'emulsifier (bread)', 'limited', 'Low concern; same emulsifier cohort caveat.'),
  A('e476', 'PGPR', 'emulsifier (chocolate)', 'limited', 'Low concern at permitted levels.'),
  A('e481', 'Sodium stearoyl lactylate', 'emulsifier', 'limited', 'Low concern.'),
  // ---- raising agents / misc ----
  A('e500', 'Sodium carbonates (baking soda)', 'raising agent', 'none', 'Baking soda.'),
  A('e501', 'Potassium carbonates', 'raising agent', 'none', 'No concern.'),
  A('e503', 'Ammonium carbonates', 'raising agent', 'none', 'No concern.'),
  A('e504', 'Magnesium carbonates', 'anti-caking', 'none', 'No concern.'),
  A('e508', 'Potassium chloride', 'salt substitute', 'none', 'No concern for most people (caution with kidney disease).'),
  A('e509', 'Calcium chloride', 'firming agent', 'none', 'No concern.'),
  A('e551', 'Silicon dioxide', 'anti-caking', 'limited', 'Low concern; EFSA flagged uncertainty about nano-sized particles.'),
  A('e554', 'Sodium aluminium silicate', 'anti-caking', 'moderate', 'Aluminium-based; regular intake adds to aluminium exposure.'),
  A('e575', 'Glucono delta-lactone', 'acidity', 'none', 'No concern.'),
  // ---- flavour enhancers ----
  A('e621', 'Monosodium glutamate (MSG)', 'flavour enhancer', 'limited', 'Safe at normal intake (EFSA 2017 set a daily limit); a few people report headaches with large amounts.'),
  A('e627', 'Disodium guanylate', 'flavour enhancer', 'limited', 'Low concern; avoid with gout.'),
  A('e631', 'Disodium inosinate', 'flavour enhancer', 'limited', 'Low concern; avoid with gout.'),
  A('e635', 'Disodium ribonucleotides', 'flavour enhancer', 'limited', 'Low concern; rare skin reactions; avoid with gout.'),
  // ---- sweeteners ----
  A('e950', 'Acesulfame K', 'artificial sweetener', 'moderate', 'A 2022 French cohort (NutriNet-Santé, BMJ) linked artificial sweeteners including acesulfame K to higher heart-disease and cancer risk — association, not proof.'),
  A('e951', 'Aspartame', 'artificial sweetener', 'moderate', 'IARC classed it as "possibly carcinogenic" (2B) in 2023; the WHO/JECFA safe limit (40 mg/kg/day) was kept. A Monster or Coke Zero is well under that.'),
  A('e952', 'Cyclamate', 'artificial sweetener', 'moderate', 'Banned in the USA since 1969 after animal studies; allowed in Australia.'),
  A('e954', 'Saccharin', 'artificial sweetener', 'limited', 'Old cancer concern was withdrawn; may affect gut bacteria.'),
  A('e955', 'Sucralose', 'artificial sweetener', 'moderate', 'A 2023 lab study found a sucralose by-product (sucralose-6-acetate) can damage DNA; also changes gut bacteria in some studies.'),
  A('e960', 'Steviol glycosides (stevia)', 'sweetener', 'none', 'Plant-based; no safety concern at normal intake.'),
  A('e961', 'Neotame', 'artificial sweetener', 'limited', 'Low concern at the tiny amounts used.'),
  A('e962', 'Aspartame-acesulfame salt', 'artificial sweetener', 'moderate', 'Combines aspartame and acesulfame K — same concerns.'),
  A('e965', 'Maltitol', 'sweetener (sugar-free lollies, protein bars)', 'limited', 'Bloating and laxative effect.'),
  A('e967', 'Xylitol', 'sweetener', 'limited', 'Laxative in larger amounts; dangerous to dogs.'),
  A('e968', 'Erythritol', 'sweetener', 'moderate', 'A 2023 Nature Medicine study linked high blood erythritol with heart attack and stroke and showed it made platelets stickier.'),
  // ---- glazing / starch ----
  A('e901', 'Beeswax', 'glazing agent', 'none', 'No concern (not vegan).'),
  A('e903', 'Carnauba wax', 'glazing agent', 'none', 'No concern.'),
  A('e904', 'Shellac', 'glazing agent', 'none', 'No concern (insect-derived).'),
  A('e924', 'Potassium bromate', 'flour treatment', 'high', 'IARC "possibly carcinogenic" (2B); banned in Australia, the EU, UK and Canada — should not appear here.'),
  A('e1400', 'Dextrin', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1404', 'Oxidised starch', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1412', 'Distarch phosphate', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1414', 'Acetylated distarch phosphate', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1420', 'Acetylated starch', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1422', 'Acetylated distarch adipate', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1442', 'Hydroxypropyl distarch phosphate', 'thickener', 'none', 'Modified starch. No concern.'),
  A('e1450', 'Starch sodium octenyl succinate', 'emulsifier', 'none', 'Modified starch. No concern.'),
].map((a) => [a.code, a]))

/** 'en:e150d' / 'e150d' / 'E 150 d' / '150d' → 'e150d' */
export function normaliseAdditive(tag: string): string {
  const t = tag.toLowerCase().replace(/^[a-z]{2}:/, '').replace(/\s+/g, '')
  // letters a–h are real variants (e150d, e472e); trailing i/ii/iii are sub-forms of the same additive (e322i)
  const m = t.match(/^e?(\d{3,4}[a-h]?)/)
  return m ? `e${m[1]}` : t
}

export function additiveInfo(tag: string): Additive {
  const code = normaliseAdditive(tag)
  if (ADDITIVES[code]) return ADDITIVES[code]
  // e471-family subcodes like e472e, e150d are listed; strip a trailing letter for a best match
  const base = code.replace(/[a-z]$/, '')
  if (ADDITIVES[base]) return { ...ADDITIVES[base], code }
  return { code, name: code.toUpperCase(), role: 'additive', risk: 'limited', why: 'Not in the built-in list yet — treated as low concern. Look it up if you react to foods.' }
}

// ---------- nutrition ----------
export interface Nut { kcal?: number; sugar?: number; satFat?: number; fat?: number; salt?: number; fibre?: number; protein?: number }
export type Level = 'low' | 'medium' | 'high'
/** UK FSA front-of-pack thresholds per 100 g (food) */
export function trafficLight(n: Nut): Partial<Record<'sugar' | 'fat' | 'satFat' | 'salt', Level>> {
  const lvl = (v: number | undefined, lo: number, hi: number): Level | undefined => (v === undefined ? undefined : v > hi ? 'high' : v > lo ? 'medium' : 'low')
  return { sugar: lvl(n.sugar, 5, 22.5), fat: lvl(n.fat, 3, 17.5), satFat: lvl(n.satFat, 1.5, 5), salt: lvl(n.salt, 0.3, 1.5) }
}

const GRADE_PTS: Record<string, number> = { a: 100, b: 75, c: 50, d: 25, e: 0 }

/** 0–100 nutrition quality, official Nutri-Score grade when present */
export function nutritionPoints(n: Nut, grade?: string, isDrink = false): { pts: number; from: 'nutriscore' | 'estimate' } {
  if (grade && GRADE_PTS[grade.toLowerCase()] !== undefined) return { pts: GRADE_PTS[grade.toLowerCase()], from: 'nutriscore' }
  let p = 70
  const t = trafficLight(n)
  const pen: Record<Level, number> = { low: 0, medium: 8, high: 20 }
  for (const k of ['sugar', 'satFat', 'salt'] as const) if (t[k]) p -= pen[t[k]!]
  if (n.kcal !== undefined) p -= n.kcal > 500 ? 15 : n.kcal > 300 ? 8 : 0
  if (isDrink && (n.sugar ?? 0) > 2.5) p -= 25
  p += Math.min(15, (n.protein ?? 0) * 0.8) + Math.min(10, (n.fibre ?? 0) * 2)
  return { pts: Math.max(0, Math.min(100, Math.round(p))), from: 'estimate' }
}

// ---------- the score ----------
export interface ScoreInput { nut: Nut; nutriscore?: string; nova?: number; additives: string[]; organic?: boolean; isDrink?: boolean }
export interface ScoreResult {
  score: number
  band: 'Excellent' | 'Good' | 'Poor' | 'Bad'
  colour: string
  nutrition: { pts: number; from: 'nutriscore' | 'estimate' }
  additivePts: number
  additives: Additive[]
  capped: boolean
  reasons: { good: string[]; bad: string[] }
}

export function scoreFood(i: ScoreInput): ScoreResult {
  const nutrition = nutritionPoints(i.nut, i.nutriscore, i.isDrink)
  const additives = [...new Set(i.additives.map(normaliseAdditive))].map(additiveInfo)
  const high = additives.filter((a) => a.risk === 'high')
  const mod = additives.filter((a) => a.risk === 'moderate')
  const lim = additives.filter((a) => a.risk === 'limited')
  const additivePts = Math.max(0, 100 - mod.length * 20 - lim.length * 5 - high.length * 40)
  let score = 0.6 * nutrition.pts + 0.3 * additivePts + (i.organic ? 10 : 0)
  if (i.nova === 4) score -= 10
  let capped = false
  if (high.length && score > 49) { score = 49; capped = true }
  score = Math.max(0, Math.min(100, Math.round(score)))
  const band = score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : score >= 25 ? 'Poor' : 'Bad'
  const colour = score >= 75 ? '#16a34a' : score >= 50 ? '#84cc16' : score >= 25 ? '#f97316' : '#dc2626'

  const t = trafficLight(i.nut)
  const good: string[] = [], bad: string[] = []
  const say = (k: 'sugar' | 'satFat' | 'salt' | 'fat', label: string, v?: number, unit = 'g') => {
    if (v === undefined || !t[k]) return
    if (t[k] === 'high') bad.push(`High ${label}: ${v}${unit} per 100 g`)
    else if (t[k] === 'low') good.push(`Low ${label}: ${v}${unit} per 100 g`)
  }
  say('sugar', 'sugar', i.nut.sugar); say('satFat', 'saturated fat', i.nut.satFat); say('salt', 'salt', i.nut.salt)
  if ((i.nut.protein ?? 0) >= 10) good.push(`Good protein: ${i.nut.protein} g per 100 g`)
  if ((i.nut.fibre ?? 0) >= 6) good.push(`High fibre: ${i.nut.fibre} g per 100 g`)
  if ((i.nut.kcal ?? 0) > 500) bad.push(`Energy-dense: ${Math.round(i.nut.kcal!)} kcal per 100 g`)
  if (i.nova === 4) bad.push('Ultra-processed (NOVA 4) — built mostly from industrial ingredients')
  if (i.nova === 1) good.push('Unprocessed or minimally processed (NOVA 1)')
  if (!additives.length) good.push('No additives')
  if (high.length) bad.push(`${high.length} high-risk additive${high.length > 1 ? 's' : ''} — score capped at 49`)
  if (mod.length) bad.push(`${mod.length} additive${mod.length > 1 ? 's' : ''} with moderate concern`)
  if (i.organic) good.push('Certified organic')
  return { score, band, colour, nutrition, additivePts, additives: additives.sort((a, b) => rank(b.risk) - rank(a.risk)), capped, reasons: { good, bad } }
}
const rank = (r: Risk) => ({ high: 3, moderate: 2, limited: 1, none: 0 })[r]

export const RISK_LABEL: Record<Risk, string> = { high: 'High risk', moderate: 'Moderate', limited: 'Limited', none: 'No risk' }
export const RISK_COLOUR: Record<Risk, string> = { high: '#dc2626', moderate: '#f97316', limited: '#eab308', none: '#16a34a' }

// ---------- Open Food Facts ----------
export interface ScannedHealth {
  code: string; name: string; brand?: string; image?: string
  nut: Nut; nutriscore?: string; nova?: number; additives: string[]; organic: boolean; isDrink: boolean
  ingredients?: string; allergens: string[]; palmOil?: boolean; vegan?: boolean
  scannedAt: string
}

const FIELDS = 'product_name,product_name_en,brands,image_front_small_url,nutriments,additives_tags,nova_group,nutriscore_grade,ingredients_text_en,ingredients_text,allergens_tags,labels_tags,categories_tags,ingredients_analysis_tags'

export function mapHealth(code: string, p: Record<string, unknown>): ScannedHealth {
  const nm = (p.nutriments ?? {}) as Record<string, unknown>
  const num = (k: string) => { const v = nm[k]; const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN; return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined }
  let kcal = num('energy-kcal_100g'); if (kcal === undefined && num('energy-kj_100g') !== undefined) kcal = Math.round(num('energy-kj_100g')! / 4.184)
  const arr = (k: string) => (Array.isArray(p[k]) ? (p[k] as unknown[]).map(String) : [])
  const labels = arr('labels_tags'), cats = arr('categories_tags'), ana = arr('ingredients_analysis_tags')
  const g = String(p.nutriscore_grade ?? '').toLowerCase()
  return {
    code,
    name: String(p.product_name_en || p.product_name || `Product ${code}`).slice(0, 90),
    brand: String(p.brands ?? '').split(',')[0]?.trim() || undefined,
    image: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : undefined,
    nut: { kcal, sugar: num('sugars_100g'), fat: num('fat_100g'), satFat: num('saturated-fat_100g'), salt: num('salt_100g'), fibre: num('fiber_100g'), protein: num('proteins_100g') },
    nutriscore: 'abcde'.includes(g) && g ? g : undefined,
    nova: typeof p.nova_group === 'number' ? p.nova_group : Number(p.nova_group) || undefined,
    additives: arr('additives_tags'),
    organic: labels.some((l) => /organic|bio/.test(l)),
    isDrink: cats.some((c) => /beverages|drinks|sodas|energy-drinks|waters/.test(c)),
    ingredients: String(p.ingredients_text_en || p.ingredients_text || '') || undefined,
    allergens: arr('allergens_tags').map((a) => a.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')),
    palmOil: ana.includes('en:palm-oil') ? true : ana.includes('en:palm-oil-free') ? false : undefined,
    vegan: ana.includes('en:vegan') ? true : ana.includes('en:non-vegan') ? false : undefined,
    scannedAt: new Date().toISOString(),
  }
}

const CACHE_KEY = 'iv-health-scans'
export function healthHistory(): ScannedHealth[] {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') as ScannedHealth[] } catch { return [] }
}
function remember(h: ScannedHealth) {
  try { const L = healthHistory().filter((x) => x.code !== h.code); L.unshift(h); localStorage.setItem(CACHE_KEY, JSON.stringify(L.slice(0, 60))) } catch { /* storage full or blocked */ }
}

export async function lookupHealth(code: string): Promise<ScannedHealth> {
  const cached = healthHistory().find((x) => x.code === code)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (cached) return cached
    throw new Error("You're offline and this product hasn't been scanned before.")
  }
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { headers: { accept: 'application/json' } })
  if (res.status === 404) throw new Error("That barcode isn't in Open Food Facts yet.")
  if (!res.ok) throw new Error(`Open Food Facts error (${res.status}). Try again.`)
  const j = (await res.json()) as { status?: number; product?: Record<string, unknown> }
  if (!j.product || j.status === 0) throw new Error("That barcode isn't in Open Food Facts yet.")
  const h = mapHealth(code, j.product)
  remember(h)
  return h
}

/** better options in the same category (higher Nutri-Score, no high-risk additives) */
export async function betterOptions(code: string): Promise<ScannedHealth[]> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=categories_tags`)
  const j = (await res.json()) as { product?: { categories_tags?: string[] } }
  const cat = j.product?.categories_tags?.slice(-1)[0]
  if (!cat) return []
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/search?categories_tags=${encodeURIComponent(cat)}&countries_tags=en:australia&nutrition_grades_tags=a,b&page_size=12&fields=code,${FIELDS}`)
  if (!r.ok) return []
  const s = (await r.json()) as { products?: (Record<string, unknown> & { code: string })[] }
  return (s.products ?? []).filter((p) => p.code !== code).map((p) => mapHealth(p.code, p))
    .filter((h) => !h.additives.some((a) => additiveInfo(a).risk === 'high')).slice(0, 6)
}
