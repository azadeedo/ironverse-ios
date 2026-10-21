import { describe, expect, it } from 'vitest'
import { weekStreak } from '@/lib/shareCard'
const L = (date: string) => ({ date, finishedAt: date })
describe('week streak', () => {
  it('counts consecutive weeks that hit the target; this week counts only once met', () => {
    const logs = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-13', '2026-10-14'].map(L)
    expect(weekStreak(logs, 4, '2026-10-16')).toEqual({ weeks: 2, thisWeek: 2 })
    expect(weekStreak([...logs, L('2026-10-15'), L('2026-10-16')], 4, '2026-10-16')).toEqual({ weeks: 3, thisWeek: 4 })
  })
})
