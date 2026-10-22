import { describe, expect, it } from 'vitest'
import { factorEffects, hoursBetween, recoveryScore, summarise } from '@/lib/sleep'
import type { DailyCheckin } from '@/db/types'

const c = (date: string, p: Partial<DailyCheckin>): DailyCheckin => ({ date, updatedAt: '', ...p })

describe('sleep', () => {
  it('hours between bed and wake cross midnight', () => {
    expect(hoursBetween('22:30', '06:30')).toBe(8)
    expect(hoursBetween('00:15', '07:45')).toBe(7.5)
    expect(hoursBetween('bad', '07:00')).toBeNull()
  })

  it('summary: average, debt and consistency', () => {
    const rows = [c('2026-10-20', { sleepHours: 6, sleep: 2, wakeTime: '06:00' }), c('2026-10-21', { sleepHours: 8, sleep: 4, wakeTime: '06:10' }), c('2026-10-22', { sleepHours: 7, sleep: 3, wakeTime: '06:05' })]
    const s = summarise(rows, 8)
    expect(s.avgHours).toBe(7)
    expect(s.debtHours).toBe(3)
    expect(s.avgRating).toBe(3)
    expect(s.consistency).toBeGreaterThan(90)
  })

  it('factor effects need 3+ nights on each side', () => {
    const rows = [
      ...['01', '02', '03'].map((d) => c(`2026-10-${d}`, { sleep: 2, sleepFactors: ['caffeine'] })),
      ...['04', '05', '06'].map((d) => c(`2026-10-${d}`, { sleep: 4 })),
    ]
    const e = factorEffects(rows)
    expect(e[0].id).toBe('caffeine')
    expect(e[0].delta).toBe(-2)
    expect(factorEffects(rows.slice(1))).toEqual([])
  })

  it('recovery: green after a long good night, red after a short bad one, null with no data', () => {
    expect(recoveryScore(c('2026-10-23', { sleepHours: 8.5, sleep: 5 }), []).zone).toBe('green')
    expect(recoveryScore(c('2026-10-23', { sleepHours: 4, sleep: 1, soreness: 5 }), []).zone).toBe('red')
    expect(recoveryScore(undefined, []).score).toBeNull()
  })

  it('a higher-than-usual resting heart rate lowers recovery', () => {
    const hist = ['16', '17', '18', '19', '20'].map((d) => c(`2026-10-${d}`, { restingHr: 55 }))
    const calm = recoveryScore(c('2026-10-23', { sleepHours: 8, sleep: 4, restingHr: 55 }), hist).score!
    const high = recoveryScore(c('2026-10-23', { sleepHours: 8, sleep: 4, restingHr: 65 }), hist).score!
    expect(high).toBeLessThan(calm)
  })
})
