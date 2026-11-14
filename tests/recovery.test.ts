import { describe, expect, it } from 'vitest'
import { applyRecovery, buildRecoveryPlan } from '@/lib/recovery'
import { weekSequence } from '@/lib/program12'
import type { Plan, WorkoutLog } from '@/db/types'

const plan = { id: 'p1', programStart: '2026-10-20', startDate: '2026-10-20', weeks: [], skippedWeeks: [], repeatedWeeks: [] } as unknown as Plan
const log = (week: number, date: string): WorkoutLog => ({ id: `${week}-${date}`, planId: 'p1', dayId: `p12-w${week}-tue`, date, finishedAt: `${date}T10:00:00Z` } as unknown as WorkoutLog)

describe('programme recovery after missed weeks', () => {
  it('his case: finished week 2, away 3 weeks, 10 weeks left → re-entry, no squeezing', () => {
    const logs = [log(1, '2026-10-21'), log(2, '2026-10-28')]
    const rp = buildRecoveryPlan(plan, logs, { today: '2026-11-18', weeksLeft: 10 })
    expect(rp.lastWeekDone).toBe(2)
    expect(rp.weeksAway).toBe(3)
    expect(rp.reentryWeek).toBe(2)
    expect(rp.reentryLighterPct).toBe(10)
    expect(rp.sequence).toHaveLength(10)            // exactly the weeks he has
    expect(rp.sequence.at(-1)?.week).toBe(12)        // still ends on the PR / review week
    expect(rp.dropped.some((d) => d.week === 4)).toBe(true) // the break replaced the first deload
    expect(new Set(rp.sequence.map((s) => s.week)).size).toBe(rp.sequence.length) // no week twice
  })

  it('applies as one programme week per calendar week from this week', () => {
    const logs = [log(1, '2026-10-21'), log(2, '2026-10-28')]
    const rp = buildRecoveryPlan(plan, logs, { today: '2026-11-18', weeksLeft: 10 })
    const next = applyRecovery(plan, rp, '2026-11-18')
    const seq = weekSequence(next).map((x) => x.w)
    const from = seq.indexOf(rp.reentryWeek)
    expect(seq.slice(from)).toEqual(rp.sequence.map((s) => s.week))
    expect(next.loadAdjust).toEqual({ week: 2, pct: 10 })
  })

  it('more weeks than the programme needs: repeats a heavy week instead of stretching thin', () => {
    const rp = buildRecoveryPlan(plan, [log(6, '2026-11-01')], { today: '2026-11-10', weeksLeft: 9 })
    expect(rp.sequence).toHaveLength(9)
    expect(rp.repeated.length).toBeGreaterThan(0)
  })

  it('very long break restarts the current block, much lighter', () => {
    const rp = buildRecoveryPlan(plan, [log(7, '2026-09-01')], { today: '2026-11-15', weeksLeft: 8 })
    expect(rp.reentryWeek).toBe(5)
    expect(rp.reentryLighterPct).toBe(15)
    expect(rp.sequence).toHaveLength(8)
  })

  it('a missed few days is not treated as a break', () => {
    const rp = buildRecoveryPlan(plan, [log(3, '2026-11-10')], { today: '2026-11-15', weeksLeft: 10 })
    expect(rp.weeksAway).toBe(0)
    expect(rp.reentryLighterPct).toBe(0)
    expect(rp.dropped).toHaveLength(0)
  })
})
