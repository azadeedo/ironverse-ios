// Shared helpers for the nutrition module.
import { targetBreakdown } from '@/lib/calorieTarget'
import { db } from '@/db'
import type { DayAdjust, FoodItem, FoodLogEntry, MealKey, Profile, Recipe } from '@/db/types'
import type { FoodCategory } from '@/data/foods'
import { bmr } from '@/lib/nutrition'
import { dayjs } from '@/lib/fmt'

export interface CatalogFood extends FoodItem {
  category?: FoodCategory
}

export const MEALS: { key: MealKey; label: string; short: string }[] = [
  { key: 'breakfast', label: 'Breakfast', short: 'Brekky' },
  { key: 'lunch', label: 'Lunch', short: 'Lunch' },
  { key: 'dinner', label: 'Dinner', short: 'Dinner' },
  { key: 'snacks', label: 'Snacks', short: 'Snacks' },
]

export const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snacks']

export function isMealKey(v: string | null | undefined): v is MealKey {
  return v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snacks'
}

/** sensible default meal for "log something now" */
export function mealForNow(d = new Date()): MealKey {
  const mins = d.getHours() * 60 + d.getMinutes()
  if (mins < 10.5 * 60) return 'breakfast'
  if (mins < 15 * 60) return 'lunch'
  if (mins < 20.5 * 60) return 'dinner'
  return 'snacks'
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export interface MacroTotals { kcal: number; protein: number; carbs: number; fat: number }

/** macros for `grams` of a per-100g food */
export function scaledMacros(food: Pick<FoodItem, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number): MacroTotals {
  const k = grams / 100
  return {
    kcal: Math.round(food.kcal * k),
    protein: round1(food.protein * k),
    carbs: round1(food.carbs * k),
    fat: round1(food.fat * k),
  }
}

export function sumEntries(entries: FoodLogEntry[]): MacroTotals {
  return entries.reduce<MacroTotals>(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

/** parse a positive number from an input string; null when invalid */
export function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** short label for the amount on an entry row */
export function amountLabel(e: FoodLogEntry): string {
  return e.grams > 0 ? `${e.grams % 1 === 0 ? e.grams : e.grams.toFixed(1)}g` : 'quick add'
}

// ============================================================
// Daily calorie target, including "take it off tomorrow" adjustments.
// ============================================================

/** Never push a day's target below this, whatever the carry-over says. */
export const MIN_DAILY_KCAL = 1500

/** Hard floor for an adjusted day: his BMR, or 1,500 kcal, whichever is higher. */
export function targetFloor(profile: Profile): number {
  const base = Math.round(bmr(profile))
  return Math.max(Number.isFinite(base) ? base : 0, MIN_DAILY_KCAL)
}

/** How much a single day can give back before it hits the floor. */
export function roomToGiveBack(profile: Profile): number {
  return Math.max(0, Math.round(profile.calorieTarget - targetFloor(profile)))
}

/** Apply a (usually negative) delta to the base target, clamped to the floor. */
export function targetWithDelta(profile: Profile, deltaKcal: number): number {
  // single authoritative rule (lib/calorieTarget): the floor only limits carry-over
  // REDUCTIONS — it never silently raises the base target he set
  return targetBreakdown(profile, deltaKcal).final
}

/**
 * The calorie target for one date, honouring any DayAdjust carry-over rows.
 * Async because the adjustments live in Dexie — other screens import this.
 */
export async function targetForDate(date: string, profile: Profile): Promise<number> {
  const row = await db.dayAdjust.get(date)
  return targetWithDelta(profile, row?.deltaKcal ?? 0)
}

/** Sync form, for when the adjust rows have already been loaded. */
export function targetForDateWith(
  date: string,
  profile: Profile,
  adjusts: Map<string, DayAdjust> | undefined,
): number {
  return targetWithDelta(profile, adjusts?.get(date)?.deltaKcal ?? 0)
}

/**
 * Split an overspend across up to `maxDays` upcoming days without pushing any
 * of them below the floor. Returns the per-day plan (deltas are negative).
 */
export function planCarryOver(
  overBy: number,
  fromDate: string,
  profile: Profile,
  existing: Map<string, DayAdjust> | undefined,
  maxDays = 3,
): { date: string; deltaKcal: number }[] {
  const out: { date: string; deltaKcal: number }[] = []
  let left = Math.round(Math.max(0, overBy))
  for (let i = 1; i <= maxDays && left > 0; i++) {
    const date = dayjs(fromDate).add(i, 'day').format('YYYY-MM-DD')
    const already = existing?.get(date)?.deltaKcal ?? 0
    const room = Math.max(0, Math.round(profile.calorieTarget + already - targetFloor(profile)))
    if (room <= 0) continue
    const take = Math.min(room, left)
    out.push({ date, deltaKcal: -take })
    left -= take
  }
  return out
}

// ---------- recipes ----------

/** Totals for the whole recipe (all ingredients). */
export function recipeTotals(r: Pick<Recipe, 'ingredients'>): MacroTotals {
  return r.ingredients.reduce<MacroTotals>(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

/** Totals for one serve of a recipe. */
export function recipePerServe(r: Pick<Recipe, 'ingredients' | 'servings'>): MacroTotals {
  const t = recipeTotals(r)
  const n = r.servings > 0 ? r.servings : 1
  return {
    kcal: Math.round(t.kcal / n),
    protein: round1(t.protein / n),
    carbs: round1(t.carbs / n),
    fat: round1(t.fat / n),
  }
}

export function recipeGrams(r: Pick<Recipe, 'ingredients' | 'servings'>): number {
  const total = r.ingredients.reduce((a, i) => a + i.grams, 0)
  const n = r.servings > 0 ? r.servings : 1
  return round1(total / n)
}

// ---------- entry provenance ----------

/** Short honest label for where an entry came from, or undefined for manual. */
export function sourceLabel(e: Pick<FoodLogEntry, 'source' | 'estimate'>): string | undefined {
  if (e.source === 'quick') return 'Quick add — estimate'
  if (e.source === 'photo') return 'Photo estimate'
  if (e.source === 'barcode') return 'Scanned label'
  if (e.source === 'recipe') return 'From a saved meal'
  if (e.estimate) return 'Estimate'
  return undefined
}
