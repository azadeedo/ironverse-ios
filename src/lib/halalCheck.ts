// Halal check for a scanned product (health scanner + barcode logger).
// Reads Open Food Facts labels, the ingredients text and E-numbers. It is a
// guide, never a certification: the only "Halal" verdict is a halal label on
// the pack; everything else is "not halal", "check the label" or "no concerns".

export type HalalVerdict = 'certified' | 'not-halal' | 'check' | 'no-concerns' | 'unknown'

export interface HalalResult {
  verdict: HalalVerdict
  title: string
  reasons: string[]
}

/** clearly not halal when found in the ingredients */
const HARAM: [RegExp, string][] = [
  [/\b(pork|porc|bacon|ham|prosciutto|pancetta|salami|chorizo|lard|pig|swine)\b/i, 'pork'],
  [/\b(wine|beer|rum|brandy|whisk(e)?y|vodka|liqueur|sake|mirin|ethanol|alcohol)\b/i, 'alcohol'],
]
/** may be animal- or alcohol-derived — needs the maker or a halal label */
const DOUBTFUL: [RegExp, string][] = [
  [/\bgelatin(e)?\b/i, 'gelatine (source not stated)'],
  [/\b(rennet|animal rennet)\b/i, 'rennet'],
  [/\b(animal fat|tallow|dripping)\b/i, 'animal fat'],
  [/\b(vanilla extract)\b/i, 'vanilla extract (usually made with alcohol)'],
  [/\b(carmine|cochineal)\b/i, 'carmine (insect colour)'],
  [/\bl-?cysteine\b/i, 'L-cysteine'],
]
/** E-numbers (Open Food Facts additive tags look like "en:e441") */
const E_HARAM: Record<string, string> = {}
const E_DOUBTFUL: Record<string, string> = {
  e120: 'E120 carmine (insect colour)', e441: 'E441 gelatine', e542: 'E542 bone phosphate', e904: 'E904 shellac',
  e471: 'E471 mono- and diglycerides (can be animal fat)', e472: 'E472 esters (can be animal fat)',
  e422: 'E422 glycerol (can be animal fat)', e920: 'E920 L-cysteine', e631: 'E631 disodium inosinate (can be from meat)',
  e635: 'E635 ribonucleotides (can be from meat)', e1510: 'E1510 ethanol',
}

export function halalCheck(p: { name?: string; ingredients?: string; additives?: string[]; labels?: string[] }): HalalResult {
  const labels = (p.labels ?? []).map((l) => l.toLowerCase())
  if (labels.some((l) => /(^|:)halal/.test(l))) {
    return { verdict: 'certified', title: 'Halal — labelled halal', reasons: ['The product is tagged with a halal label. Check the logo on the pack.'] }
  }
  const text = `${p.name ?? ''} ${p.ingredients ?? ''}`.replace(/\bhalal (gelatine|gelatin)\b/gi, '')
  const codes = (p.additives ?? []).map((a) => a.replace(/^[a-z]{2}:/, '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  const haram = [...HARAM.filter(([re]) => re.test(text)).map(([, why]) => why), ...codes.filter((c) => E_HARAM[c]).map((c) => E_HARAM[c])]
  if (haram.length) return { verdict: 'not-halal', title: 'Not halal', reasons: [...new Set(haram)].map((w) => `Contains ${w}`) }
  const doubt = [...DOUBTFUL.filter(([re]) => re.test(text)).map(([, why]) => why), ...codes.filter((c) => E_DOUBTFUL[c]).map((c) => E_DOUBTFUL[c])]
  if (doubt.length) return { verdict: 'check', title: 'Check the label', reasons: [...new Set(doubt)].map((w) => `Contains ${w}`) }
  if (!p.ingredients) return { verdict: 'unknown', title: 'No ingredient list', reasons: ['This product has no ingredients in the database, so it can’t be checked.'] }
  return { verdict: 'no-concerns', title: 'No haram ingredients found', reasons: ['Nothing in the ingredients or E-numbers suggests pork, alcohol or doubtful animal sources. Not a certification.'] }
}

export const HALAL_COLOUR: Record<HalalVerdict, string> = {
  certified: '#16a34a', 'no-concerns': '#22c55e', check: '#f59e0b', 'not-halal': '#dc2626', unknown: '#94a3b8',
}
