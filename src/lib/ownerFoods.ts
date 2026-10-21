// Foods he asked for by name, added once and pinned to the top of favourites.
import { db, getSetting, setSetting } from '@/db'
import type { FoodItem } from '@/db/types'

export const MONSTER_PEACH: FoodItem = {
  id: 'owner-monster-ultra-peachy-keen',
  name: 'Monster Ultra Peachy Keen',
  brand: 'Monster Energy',
  // his can: 12 kcal per 500 ml (sugar-free) → per 100 ml
  kcal: 2.4, protein: 0, carbs: 0.6, fat: 0,
  servingName: 'can (500 ml)', servingGrams: 500,
  custom: true, favourite: true, pinned: true,
}

export async function ensureOwnerFoodsOnce(): Promise<void> {
  if (await getSetting<boolean>('owner-foods-v1', false)) return
  const existing = await db.foods.get(MONSTER_PEACH.id)
  if (!existing) await db.foods.put(MONSTER_PEACH)
  else await db.foods.put({ ...existing, favourite: true, pinned: true })
  await setSetting('owner-foods-v1', true)
}
