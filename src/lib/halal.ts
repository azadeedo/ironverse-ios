// ============================================================
// Halal mode.
// Nothing is deleted from the food database — items are TAGGED and then
// hidden or annotated, so the app still works for anyone else and the data
// stays honest. Pork and alcohol are hidden outright; genuinely ambiguous
// animal-derived ingredients get a "check the label" note instead of a
// confident claim, because packaging varies by brand and batch.
// ============================================================

import type { DietTag, FoodItem } from '@/db/types'
import { HALAL_CAUTION_TAGS, HALAL_HIDDEN_TAGS } from '@/db/types'
import { dietTags, isHalalCaution, isHalalHidden } from '@/db/defaults'

export { HALAL_CAUTION_TAGS, HALAL_HIDDEN_TAGS, dietTags, isHalalCaution, isHalalHidden }

export const CAUTION_NOTE = 'Check the label — this varies by brand.'

/** Why an item is flagged, for the note shown under it. */
export function cautionReason(f: Partial<FoodItem>): string | undefined {
  const t = dietTags(f)
  if (t.includes('gelatine')) return 'May contain gelatine — check the label.'
  if (t.includes('unclear')) return CAUTION_NOTE
  return undefined
}

/** Remove items halal mode hides. Keeps ordering. */
export function filterHalal<T extends Partial<FoodItem>>(items: T[], halal: boolean): T[] {
  if (!halal) return items
  return items.filter((f) => !isHalalHidden(f, true))
}

// ---------- substitutes ----------
/**
 * Search terms that should offer halal alternatives. Keys are matched as
 * whole words against the query, so "bacon" matches but "baconnaise" doesn't
 * accidentally trigger on unrelated text.
 */
const SUBSTITUTE_MAP: { match: RegExp; label: string; ids: string[] }[] = [
  { match: /\bbacon\b/i, label: 'bacon', ids: ['beef-bacon', 'turkey-rashers', 'halal-beef-sausage'] },
  { match: /\bham\b/i, label: 'ham', ids: ['turkey-breast-sliced', 'beef-pastrami', 'chicken-breast-sliced'] },
  { match: /\bpork\b/i, label: 'pork', ids: ['beef-scotch-fillet', 'lamb-loin-chop', 'sf-chicken-thigh'] },
  { match: /\bpepperoni\b/i, label: 'pepperoni', ids: ['beef-pepperoni', 'halal-beef-sausage'] },
  { match: /\bchorizo\b/i, label: 'chorizo', ids: ['halal-beef-sausage', 'beef-pepperoni'] },
  { match: /\bprosciutto|salami\b/i, label: 'cured pork', ids: ['beef-pastrami', 'beef-pepperoni'] },
  { match: /\blard\b/i, label: 'lard', ids: ['olive-oil', 'butter'] },
  { match: /\bbeer|wine|vodka|spirits?|cider\b/i, label: 'alcohol', ids: ['kombucha', 'soda-water', 'diet-cola'] },
  { match: /\bsausage\b/i, label: 'sausage', ids: ['halal-beef-sausage', 'chicken-sausage'] },
]

export interface SubstituteHint {
  /** what the user searched that triggered this */
  label: string
  /** ids to look up in the food database (missing ids are simply skipped) */
  ids: string[]
}

/** Offer halal alternatives for a search query, or null if none apply. */
export function substitutesForQuery(query: string, halal: boolean): SubstituteHint | null {
  if (!halal || !query.trim()) return null
  for (const rule of SUBSTITUTE_MAP) {
    if (rule.match.test(query)) return { label: rule.label, ids: rule.ids }
  }
  return null
}

// ---------- tagging helpers (used when seeding / adding foods) ----------
const PORK_RX = /\b(pork|bacon|ham|prosciutto|pancetta|chorizo|salami|pepperoni|lard|gammon|speck|guanciale)\b/i
const ALCOHOL_RX = /\b(beer|wine|vodka|whisk(e)?y|rum|gin|cider|liqueur|prosecco|champagne|sake|brandy|tequila|ale|lager|stout)\b/i
const GELATINE_RX = /\b(gelatine|gelatin|marshmallow|jelly|gummi|gummy|wine gum)\b/i
const DAIRY_RX = /\b(milk|cheese|yoghurt|yogurt|butter|cream|labneh|haloumi|halloumi|feta|custard|ice cream)\b/i

/**
 * Best-effort automatic tags from a food's name. Used to tag the seed list and
 * to pre-tag user-added foods — always overridable by hand.
 */
export function autoDietTags(name: string, existing: DietTag[] = []): DietTag[] {
  const tags = new Set<DietTag>(existing)
  if (PORK_RX.test(name)) tags.add('pork')
  if (ALCOHOL_RX.test(name)) tags.add('alcohol')
  if (GELATINE_RX.test(name)) tags.add('gelatine')
  if (DAIRY_RX.test(name)) tags.add('dairy')
  return [...tags]
}

/** A short badge label for the strongest tag on an item, or undefined. */
export function primaryTagLabel(f: Partial<FoodItem>): string | undefined {
  const t = dietTags(f)
  if (t.includes('pork')) return 'Pork'
  if (t.includes('alcohol')) return 'Alcohol'
  if (t.includes('gelatine')) return 'Gelatine?'
  if (t.includes('unclear')) return 'Check label'
  if (t.includes('vegan')) return 'Vegan'
  if (t.includes('vegetarian')) return 'Vegetarian'
  return undefined
}
