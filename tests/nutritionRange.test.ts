import { describe, expect, it } from 'vitest'
import { rangeRows } from '@/screens/food/NutritionRange'
import { groupPhotoDays } from '@/screens/food/FoodPhotoDiary'

describe('nutrition range and photo diary', () => {
  it('builds one row per day with totals and that day\'s target; empty days stay empty', () => {
    const E = [{ date: '2026-10-12', kcal: 500, protein: 40, carbs: 50, fat: 10 }, { date: '2026-10-12', kcal: 300, protein: 20, carbs: 30, fat: 5 }, { date: '2026-10-13', kcal: 900, protein: 60, carbs: 80, fat: 20 }]
    const R = rangeRows(E, 7, '2026-10-13', (d) => (d === '2026-10-13' ? 2400 : 2200))
    expect(R).toHaveLength(7)
    expect(R[6]).toMatchObject({ date: '2026-10-13', kcal: 900, n: 1, target: 2400 })
    expect(R[5]).toMatchObject({ date: '2026-10-12', kcal: 800, protein: 60, n: 2 })
    expect(R[0].n).toBe(0)
  })
  it('groups only days that have photos, newest first', () => {
    const b = new Blob(['x'])
    const G = groupPhotoDays([{ id: 'a', date: '2026-10-10', kcal: 400, photo: b }, { id: 'b', date: '2026-10-11', kcal: 300 }, { id: 'c', date: '2026-10-12', kcal: 600, photo: b }, { id: 'd', date: '2026-10-12', kcal: 200 }])
    expect(G.map((g) => g.date)).toEqual(['2026-10-12', '2026-10-10'])
    expect(G[0]).toMatchObject({ kcal: 800, photos: ['c'] })
  })
})
