import { describe, expect, it } from 'vitest'
import type { FoodLogEntry } from '@/db/types'
import { dayState, mondayOf, offChartAdvice, patternTips, weekView } from '@/lib/overeating'

const e = (date: string, kcal: number, meal: FoodLogEntry['meal'] = 'lunch', protein = 30, hour = 12, name = 'Food'): FoodLogEntry => ({
  id: `${date}-${kcal}-${Math.random()}`, date, meal, name, grams: 100, kcal, protein, carbs: 0, fat: 0, createdAt: `${date}T${String(hour).padStart(2, '0')}:00:00`,
})

describe('full week', () => {
  it('finds the Monday', () => {
    expect(mondayOf('2026-10-08')).toBe('2026-10-05') // Thursday
    expect(mondayOf('2026-10-11')).toBe('2026-10-05') // Sunday
    expect(mondayOf('2026-10-05')).toBe('2026-10-05')
  })
  it('totals the whole Mon–Sun week with per-day targets', () => {
    const entries = [e('2026-10-05', 2000), e('2026-10-06', 3500), e('2026-10-07', 5000), e('2026-10-08', 1000)]
    const target = (d: string) => (d === '2026-10-06' ? 2500 : 3000)
    const w = weekView(entries, '2026-10-08', target, '2026-10-08')
    expect(w.days).toHaveLength(7)
    expect(w.eaten).toBe(11500)
    expect(w.budget).toBe(3000 * 6 + 2500)
    expect(w.days.map((d) => d.state)).toEqual(['under', 'way-over', 'off-chart', 'under', 'future', 'future', 'future'])
    expect(w.overDays).toBe(2)
    expect(w.worst!.date).toBe('2026-10-07')
    expect(w.daysLeft).toBe(4) // Thu (today) + Fri/Sat/Sun
    expect(w.perDayLeft).toBe(Math.round((w.budget - w.eaten) / 4))
  })
  it('day states', () => {
    expect(dayState(0, 3000, false, false)).toBe('unlogged')
    expect(dayState(3000, 3000, true, false)).toBe('on')
    expect(dayState(3300, 3000, true, false)).toBe('over')
    expect(dayState(4000, 3000, true, false)).toBe('way-over')
    expect(dayState(4600, 3000, true, false)).toBe('off-chart')
    expect(dayState(1000, 3000, true, true)).toBe('future')
  })
})

describe('off the chart advice', () => {
  it('is calm, factual and never suggests going below the floor', () => {
    const a = offChartAdvice(5000, 3000, 2100, 60, 190, 20)!
    expect(a.level).toBe('off-chart')
    expect(a.over).toBe(2000)
    expect(a.facts[0]).toMatch(/260 g/)
    expect(a.tips.join(' ')).toMatch(/2,100/)
    expect(a.tips.join(' ')).toMatch(/GP|dietitian/)
    expect(a.tips.join(' ').toLowerCase()).not.toMatch(/starve|skip meals|punish/)
    expect(offChartAdvice(2900, 3000, 2100, 100, 190)).toBeNull()
  })
})

describe('pattern tips', () => {
  it('needs data first', () => {
    expect(patternTips([e('2026-10-01', 2000)], () => 3000, 190, '2026-10-08')[0].id).toBe('more-data')
  })
  it('spots weekends, snacks, late eating and low protein', () => {
    const list: FoodLogEntry[] = []
    for (let i = 0; i < 21; i++) {
      const d = new Date(2026, 8, 14 + i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const wk = [0, 5, 6].includes(d.getDay())
      list.push(e(date, wk ? 2600 : 1800, 'lunch', 40))
      list.push(e(date, 1200, 'snacks', 5, 22, 'Chips'))
    }
    const ids = patternTips(list, () => 3000, 190, '2026-10-04').map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['weekend', 'snacks', 'late', 'protein']))
  })
})
