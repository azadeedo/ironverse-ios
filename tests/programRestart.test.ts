import { describe, expect, it } from 'vitest'
import { db } from '@/db'
import { buildProgramPlan, programDayOn, programWeekFor } from '@/lib/program12'
import { freeDays, missedSessions, restartProgram } from '@/lib/programStore'

describe('restart the 12-week program from the week of 19 Oct 2026', () => {
  it('week 1 = Tue 20 – Fri 23 Oct, week 12 = 5–8 Jan 2027; the old plan and its history stay', async () => {
    await db.plans.clear()
    const old = { ...buildProgramPlan({ start: '2026-09-29', setup: {} }), repeatedWeeks: [2], moves: { '2026-10-06': '2026-10-04' } }
    await db.plans.put(old)
    await db.workoutLogs.put({ id: 'oldlog', planId: old.id, dayId: 'p12-w1-tue', date: '2026-09-29', startedAt: '2026-09-29T10:00:00Z', finishedAt: '2026-09-29T11:00:00Z', exercises: [] } as never)
    const p = await restartProgram('2026-10-19')
    expect(p.programStart).toBe('2026-10-20')
    expect(p.id).not.toBe(old.id)
    expect(p.repeatedWeeks).toEqual([]); expect(p.moves).toEqual({})
    expect(programDayOn(p, '2026-10-20')).toMatchObject({ dk: 'tue', week: 1 })
    expect(programWeekFor(p, '2027-01-05').week).toBe(12)
    expect(programDayOn(p, '2027-01-08')).toMatchObject({ dk: 'fri', week: 12 })
    expect(programWeekFor(p, '2027-01-12').finished).toBe(true)
    expect((await db.plans.get(old.id))!.active).toBe(false)
    expect(await db.workoutLogs.get('oldlog')).toBeTruthy()
  })
  it('a missed Tuesday shows up, and the free days offered are Sat, Sun and Mon', () => {
    const p = buildProgramPlan({ start: '2026-10-20', setup: {} })
    const missed = missedSessions(p, [], new Set(), '2026-10-21')
    expect(missed.map((m) => m.date)).toEqual(['2026-10-20'])
    expect(freeDays(p, '2026-10-21')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
    const moved = { ...p, moves: { '2026-10-20': '2026-10-24' } }
    expect(missedSessions(moved, [], new Set(), '2026-10-21')).toEqual([])
    expect(programDayOn(moved, '2026-10-24')).toMatchObject({ dk: 'tue', week: 1 })
  })
})
