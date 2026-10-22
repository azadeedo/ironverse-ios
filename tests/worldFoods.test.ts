import { describe, expect, it } from 'vitest'
import { CUISINES, SEED_FOODS } from '@/data/foods'

describe('world foods', () => {
  it('every seed food id is unique', () => {
    const ids = SEED_FOODS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every cuisine chip lists at least 20 dishes', () => {
    for (const c of CUISINES) expect(SEED_FOODS.filter((f) => f.cuisine === c).length, c).toBeGreaterThanOrEqual(20)
  })

  it('world-dish calories roughly match their macros (4/4/9 within 20%)', () => {
    for (const f of SEED_FOODS.filter((x) => x.id.startsWith('sf-w-') && x.kcal >= 40)) {
      const fromMacros = f.protein * 4 + f.carbs * 4 + f.fat * 9
      expect(Math.abs(fromMacros - f.kcal) / f.kcal, f.name).toBeLessThan(0.2)
    }
  })

  it('common takeaway searches find a dish', () => {
    for (const q of ['laksa', 'udon', 'tempura', 'kofte', 'doner', 'paratha', 'sinigang', 'lasagne', 'parma', 'bibimbap', 'jollof', 'pho'])
      expect(SEED_FOODS.some((f) => f.name.toLowerCase().includes(q)), q).toBe(true)
  })
})
