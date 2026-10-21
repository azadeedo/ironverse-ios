// Live Dexie data hooks for the nutrition module.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { DayAdjust, FoodItem, FoodLogEntry, Profile, Recipe, WeighIn } from '@/db/types'
import { SEED_FOODS, seedFoodById } from '@/data/foods'
import { dayjs } from '@/lib/fmt'
import { todayStr } from '@/lib/id'
import type { CatalogFood } from './helpers'

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => db.profile.get('me'), [])
}

/** all entries for one date */
export function useDayEntries(date: string): FoodLogEntry[] | undefined {
  return useLiveQuery(() => db.foodLog.where('date').equals(date).toArray(), [date])
}

/** entries covering the last `days` days ending at `endDate` (inclusive) */
export function useRangeEntries(endDate: string, days: number): FoodLogEntry[] | undefined {
  const start = dayjs(endDate).subtract(days - 1, 'day').format('YYYY-MM-DD')
  return useLiveQuery(
    () => db.foodLog.where('date').between(start, endDate, true, true).toArray(),
    [start, endDate],
  )
}

/** merged food catalog: db rows (custom foods + touched seed foods) override seed data */
export function useCatalog(): CatalogFood[] {
  const dbFoods = useLiveQuery(() => db.foods.toArray(), [])
  return useMemo(() => {
    const rows = dbFoods ?? []
    const byId = new Map<string, CatalogFood>()
    for (const s of SEED_FOODS) byId.set(s.id, s)
    for (const r of rows) {
      const seed = seedFoodById.get(r.id)
      byId.set(r.id, seed ? { ...r, category: seed.category } : r)
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [dbFoods])
}

export interface RecentItem {
  key: string
  name: string
  foodId?: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** unique foods logged in the last 14 days, most recent first */
export function useRecents(): RecentItem[] | undefined {
  const cutoff = dayjs(todayStr()).subtract(13, 'day').format('YYYY-MM-DD')
  const entries = useLiveQuery(
    () => db.foodLog.where('date').aboveOrEqual(cutoff).toArray(),
    [cutoff],
  )
  return useMemo(() => {
    if (!entries) return undefined
    const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const seen = new Set<string>()
    const out: RecentItem[] = []
    for (const e of sorted) {
      const key = e.foodId ?? `name:${e.name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        key, name: e.name, foodId: e.foodId, grams: e.grams,
        kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat,
      })
      if (out.length >= 20) break
    }
    return out
  }, [entries])
}

export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => db.weighIns.toArray(), [])
}

/** date -> total kcal for the last `days` days (used by the deficit detector) */
export function useIntakeMap(days = 35): Map<string, number> | undefined {
  const cutoff = dayjs(todayStr()).subtract(days - 1, 'day').format('YYYY-MM-DD')
  const entries = useLiveQuery(
    () => db.foodLog.where('date').aboveOrEqual(cutoff).toArray(),
    [cutoff],
  )
  return useMemo(() => {
    if (!entries) return undefined
    const map = new Map<string, number>()
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.kcal)
    return map
  }, [entries])
}

/** every calorie carry-over row, keyed by the date it adjusts */
export function useDayAdjusts(): Map<string, DayAdjust> | undefined {
  const rows = useLiveQuery(() => db.dayAdjust.toArray(), [])
  return useMemo(() => {
    if (!rows) return undefined
    return new Map(rows.map((r) => [r.date, r]))
  }, [rows])
}

/** saved meals / recipes, favourites and most-used first */
export function useRecipes(): Recipe[] | undefined {
  const rows = useLiveQuery(() => db.recipes.toArray(), [])
  return useMemo(() => {
    if (!rows) return undefined
    return [...rows].sort(
      (a, b) =>
        Number(Boolean(b.favourite)) - Number(Boolean(a.favourite)) ||
        (b.useCount ?? 0) - (a.useCount ?? 0) ||
        a.name.localeCompare(b.name),
    )
  }, [rows])
}

/** upsert a food row in Dexie, bumping useCount (copies seed foods on first touch) */
export async function touchFood(food: CatalogFood): Promise<void> {
  const { category: _cat, ...item } = food
  const existing = await db.foods.get(item.id)
  const base: FoodItem = existing ?? item
  await db.foods.put({ ...base, useCount: (base.useCount ?? 0) + 1 })
}

/** flip favourite on a food (copies seed foods into Dexie so it persists) */
export async function setFavourite(food: CatalogFood, fav: boolean): Promise<void> {
  const { category: _cat, ...item } = food
  const existing = await db.foods.get(item.id)
  await db.foods.put({ ...(existing ?? item), favourite: fav })
}
