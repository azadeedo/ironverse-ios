import { describe, expect, it } from 'vitest'
import { nutritionInsights } from '@/lib/nutritionInsights'

const e = (date: string, kcal: number, protein: number, meal = 'lunch', hour = 12) => ({ date, kcal, protein, meal: meal as never, name: 'Food ' + meal, createdAt: `${date}T${String(hour).padStart(2, '0')}:00:00` })
describe('nutrition insights', () => {
  it('needs 3 days', () => { expect(nutritionInsights([e('2026-10-14', 2000, 150)], {})[0].id).toBe('thin') })
  it('flags weekends, low protein days and half-logged days', () => {
    const L = [
      e('2026-10-10', 3200, 120), e('2026-10-11', 3100, 110), // Sat, Sun
      e('2026-10-12', 2100, 120), e('2026-10-13', 2000, 115), e('2026-10-14', 2050, 118), e('2026-10-09', 700, 30),
    ]
    const I = nutritionInsights(L, { kcalTarget: 2100, proteinTarget: 190, weightKg: 85, today: '2026-10-14' })
    const ids = I.map((i) => i.id)
    expect(ids).toContain('weekend'); expect(I.find((i) => i.id === 'weekend')!.tone).toBe('warn')
    expect(I.find((i) => i.id === 'protein')!.tone).toBe('warn')
    expect(ids).toContain('incomplete')
  })
})
