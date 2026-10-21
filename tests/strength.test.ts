import { describe, expect, it } from 'vitest'
import type { WorkoutLog } from '@/db/types'
import { byId } from '@/data/exercises'
import { compareWeeklyVolume, detectPlateau, e1rmMeaningful, exerciseRecords, predictE1rm, sessionSeries } from '@/lib/strength'
import { trialLoad } from '@/lib/program12'

const L = (date: string, id: string, sets: [number, number][]): WorkoutLog => ({
  id: `${date}-${id}`, date, title: 't', startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z`,
  exercises: [{ exerciseId: id, sets: sets.map(([kg, reps], i) => ({ setIndex: i, targetReps: [5, 8] as [number, number], weightKg: kg, reps, done: true })) }],
})

describe('IV-02 records', () => {
  const logs = [L('2026-09-01', 'barbell-squat', [[100, 5], [100, 5]]), L('2026-09-08', 'barbell-squat', [[105, 5], [110, 2]]), L('2026-09-15', 'barbell-squat', [[107.5, 6], [120, 1]])]
  const r = exerciseRecords(logs, 'barbell-squat')
  it('heaviest actual lift with date and reps', () => expect(r.heaviest).toEqual({ kg: 120, reps: 1, date: '2026-09-15' }))
  it('best working set is a real set (≥5 reps), not a single', () => expect(r.bestWorkingSet).toMatchObject({ kg: 107.5, reps: 6 }))
  it('rep records keep only the true frontier', () => {
    expect(r.repRecords.map((x) => `${x.reps}@${x.kg}`)).toEqual(['1@120', '2@110', '6@107.5'])
  })
  it('since first and since previous comparisons', () => {
    expect(r.sinceFirst!.first.topKg).toBe(100); expect(r.sincePrevious!.prev.topKg).toBe(110); expect(r.sincePrevious!.latest.topKg).toBe(120)
  })
})

describe('IV-33A e1RM only where meaningful', () => {
  it('compound barbell lifts yes; wrist curls / leg curls / reverse pec deck no', () => {
    expect(e1rmMeaningful(byId.get('barbell-squat'))).toBe(true)
    for (const id of ['wrist-curl', 'seated-leg-curl', 'reverse-pec-deck']) expect(e1rmMeaningful(byId.get(id)), id).toBe(false)
  })
})

describe('IV-09 plateau needs several sessions, not one bad day', () => {
  it('one bad session after progress is not a plateau', () => {
    const logs = [L('2026-09-01', 'leg-press', [[100, 10]]), L('2026-09-05', 'leg-press', [[110, 10]]), L('2026-09-09', 'leg-press', [[120, 10]]), L('2026-09-13', 'leg-press', [[125, 10]]), L('2026-09-17', 'leg-press', [[120, 8]])]
    expect(detectPlateau(logs, 'leg-press')).toBeNull()
  })
  it('three sessions over 10+ days without beating the best → plateau with suggestions', () => {
    const logs = [L('2026-09-01', 'leg-press', [[120, 10]]), L('2026-09-05', 'leg-press', [[120, 10]]), L('2026-09-10', 'leg-press', [[120, 9]]), L('2026-09-15', 'leg-press', [[120, 10]]), L('2026-09-22', 'leg-press', [[117.5, 10]])]
    const p = detectPlateau(logs, 'leg-press')
    expect(p).not.toBeNull(); expect(p!.suggestions.length).toBeGreaterThan(2)
  })
})

describe('IV-14 prediction is a range with a confidence label', () => {
  it('needs ≥4 sessions in 8 weeks and never predicts a target below now', () => {
    const logs = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'].map((d, i) => L(d, 'barbell-bench-press', [[80 + i * 2.5, 5]]))
    const p = predictE1rm(sessionSeries(logs, 'barbell-bench-press'), '2026-10-01')!
    expect(p.in4w[0]).toBeGreaterThanOrEqual(p.now); expect(p.in4w[1]).toBeGreaterThan(p.in4w[0]); expect(['low', 'moderate']).toContain(p.confidence)
    expect(predictE1rm(sessionSeries(logs.slice(0, 3), 'barbell-bench-press'), '2026-10-01')).toBeNull()
  })
})

describe('IV-01 trial loads', () => {
  it('a conservative, loadable trial weight from bodyweight — never 0, never for bodyweight moves', () => {
    const t = trialLoad(byId.get('leg-press'), 98, null)
    expect(t).toBeGreaterThan(0)
    expect(trialLoad(byId.get('pull-up'), 98, null)).toBeUndefined()
    expect(trialLoad(byId.get('leg-press'), undefined, null)).toBeUndefined()
  })
})

describe('IV-37 volume comparisons show the totals and context', () => {
  it('different session counts are called out', () => {
    const logs = [L('2026-10-06', 'leg-press', [[100, 10]]), L('2026-10-07', 'leg-press', [[100, 10]]), L('2026-09-30', 'leg-press', [[100, 10]])]
    const c = compareWeeklyVolume(logs, '2026-10-08')
    expect(c).toMatchObject({ thisWeek: 2000, lastWeek: 1000, sessionsThis: 2, sessionsLast: 1, pct: 100 })
    expect(c.note).toMatch(/Different number of sessions/)
  })
})

import { customLoad } from '@/screens/tools/PlateTool'
describe('IV-03 / IV-15 custom plate maths', () => {
  it('kg: 100 kg on a 20 kg bar = 25 + 15 per side', () => expect(customLoad(100, 20, 0, [25, 20, 15, 10, 5, 2.5, 1.25])).toMatchObject({ perSide: [25, 15], loaded: 100, exact: true }))
  it('collars are counted', () => expect(customLoad(105, 20, 2.5, [25, 20, 15, 10, 5, 2.5, 1.25])).toMatchObject({ loaded: 105, exact: true }))
  it('fractional plates', () => expect(customLoad(22.5, 20, 0, [1.25, 0.5]).perSide).toEqual([1.25]))
  it('lb: 225 on a 45 lb bar = 45 + 45 per side', () => expect(customLoad(225, 45, 0, [45, 35, 25, 10, 5, 2.5])).toMatchObject({ perSide: [45, 45], exact: true }))
  it('impossible totals fall to the nearest buildable below', () => { const r = customLoad(101, 20, 0, [25, 20, 15, 10, 5, 2.5]); expect(r.exact).toBe(false); expect(r.loaded).toBeLessThanOrEqual(101) })
})

import { PATHWAYS, pathwayStatus } from '@/lib/pathways'
describe('IV-08 progression pathways use real sets', () => {
  const pull = PATHWAYS.find((p) => p.id === 'pullup')!
  it('assisted pull-up 3×8 achieved → pull-up becomes the current stage; 2 sets is not enough', () => {
    const logs = [L('2026-09-01', 'lat-pulldown', [[60, 10], [60, 10], [60, 10]]), L('2026-09-05', 'assisted-pull-up', [[20, 8], [20, 8]]), L('2026-09-09', 'assisted-pull-up', [[20, 8], [20, 8], [20, 9]])]
    const st = pathwayStatus(pull, logs, 98)
    expect(st.stages[0].achieved).toBe('2026-09-01')
    expect(st.stages[1].achieved).toBe('2026-09-09')
    expect(st.current).toBe(2)
  })
  it('a minimum load is respected (light pulldowns do not count)', () => {
    const st = pathwayStatus(pull, [L('2026-09-01', 'lat-pulldown', [[30, 12], [30, 12], [30, 12]])], 98)
    expect(st.stages[0].achieved).toBeUndefined(); expect(st.current).toBe(0)
  })
})
