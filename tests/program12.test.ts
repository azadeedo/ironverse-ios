import { describe, expect, it } from 'vitest'
import { byId } from '@/data/exercises'
import { DAY_ORDER, PHASES, type DayKey } from '@/data/program12'
import {
  addVolume, buildProgramPlan, e1rm, emptyVolume, estimateFor, loadFor, nextTuesday, nextUp,
  parseDayId, pctFor, plannedVolume, prAttempts, prescribeAccessory, prescribeMain,
  programWeekFor, readinessAdvice, snapLoad, stepTargetFor, weekStatus, weightStats,
} from '@/lib/program12'
import { builtInProfiles } from '@/lib/equipment'
import { nearestLoad, sideBreakdown } from '@/lib/plates'
import type { PlanExercise, WorkoutLog } from '@/db/types'

const gym = builtInProfiles(null)[1]
const plan = buildProgramPlan({ start: '2026-10-13', setup: { squat: { kg: 140, reps: 5 }, bench: { kg: 100, reps: 5 }, deadlift: { kg: 170, reps: 5 } } })
const day = (w: number, d: DayKey) => plan.weeks[w - 1].days[DAY_ORDER.indexOf(d)]

function log(date: string, exerciseId: string, sets: { kg: number; reps: number; rir?: number; failed?: boolean; adjusted?: 'reduced' }[], extra: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: `${date}-${exerciseId}`, date, title: 't', startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z`,
    exercises: [{ exerciseId, sets: sets.map((s, i) => ({ setIndex: i, targetReps: [s.reps, s.reps] as [number, number], weightKg: s.kg, reps: s.reps, rir: s.rir, failed: s.failed, adjusted: s.adjusted, done: true })) }],
    ...extra,
  }
}

describe('program structure — every week, every day', () => {
  it('has 12 weeks of exactly 4 days (Tue/Wed/Thu/Fri)', () => {
    expect(plan.weeks).toHaveLength(12)
    for (const w of plan.weeks) expect(w.days.map((d) => parseDayId(d.id)?.day)).toEqual(['tue', 'wed', 'thu', 'fri'])
    expect(plan.trainingWeekdays).toEqual([2, 3, 4, 5])
    expect(plan.program).toBe('p12')
  })
  it('every programmed exercise exists in the registry', () => {
    const missing = plan.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))).filter((id) => !byId.has(id))
    expect(missing).toEqual([])
  })
  it('no duplicate exercises within a day', () => {
    for (const w of plan.weeks) for (const d of w.days) {
      const ids = d.exercises.map((e) => e.exerciseId)
      expect(new Set(ids).size, `${d.id}: ${ids.join(',')}`).toBe(ids.length)
    }
  })
  it('main lifts come first, are never supersetted, rest 3–5 min', () => {
    for (const w of plan.weeks) for (const d of w.days) {
      const mains = d.exercises.filter((e) => e.role === 'main')
      for (const m of mains) {
        expect(d.exercises[0]).toBe(m)
        expect(m.supersetGroup).toBeUndefined()
        expect(m.restSec).toBeGreaterThanOrEqual(180)
        expect(m.restSec).toBeLessThanOrEqual(300)
      }
    }
  })
  it('main-lift sets/reps/RIR match the owner specification exactly', () => {
    const expectRx = (w: number, d: DayKey, id: string, sets: number, reps: [number, number], rir: [number, number]) => {
      const m = day(w, d).exercises[0]
      expect([m.exerciseId, m.sets, m.reps, m.rir], `${w}-${d}`).toEqual([id, sets, reps, rir])
    }
    expectRx(1, 'tue', 'barbell-squat', 3, [8, 8], [3, 3]); expectRx(1, 'wed', 'barbell-bench-press', 3, [8, 8], [3, 3]); expectRx(1, 'thu', 'barbell-deadlift', 3, [5, 5], [3, 3])
    expectRx(2, 'tue', 'barbell-squat', 3, [6, 8], [2, 3]); expectRx(2, 'thu', 'barbell-deadlift', 3, [4, 5], [2, 3]); expectRx(2, 'fri', 'paused-bench-press', 3, [8, 8], [2, 3])
    expectRx(3, 'tue', 'barbell-squat', 4, [6, 6], [2, 2]); expectRx(3, 'thu', 'barbell-deadlift', 3, [4, 4], [2, 2]); expectRx(3, 'fri', 'paused-bench-press', 4, [6, 6], [2, 2])
    expectRx(4, 'tue', 'barbell-squat', 2, [6, 6], [4, 5]); expectRx(4, 'thu', 'barbell-deadlift', 2, [4, 4], [4, 5])
    expectRx(5, 'tue', 'barbell-squat', 3, [8, 8], [2, 2]); expectRx(5, 'thu', 'barbell-deadlift', 3, [5, 5], [2, 2])
    expectRx(8, 'tue', 'barbell-squat', 2, [5, 5], [4, 5]); expectRx(8, 'thu', 'barbell-deadlift', 2, [3, 3], [4, 5])
    expectRx(9, 'tue', 'barbell-squat', 4, [5, 5], [2, 2]); expectRx(9, 'thu', 'barbell-deadlift', 3, [3, 4], [2, 2]); expectRx(9, 'fri', 'paused-bench-press', 3, [5, 6], [2, 2])
  })
  it('week 6 top set + back-offs, week 7 singles RPE 7–8, weeks 10–11 singles RPE 8–8.5', () => {
    expect(day(6, 'tue').exercises[0].scheme).toMatchObject({ kind: 'top-backoff', topReps: 5, topRpe: [8, 8], backoffSets: 3, backoffReps: [5, 5] })
    expect(day(6, 'thu').exercises[0].scheme).toMatchObject({ topReps: 3, backoffSets: 2, backoffReps: [3, 3] })
    expect(day(7, 'tue').exercises[0].scheme).toMatchObject({ kind: 'single-backoff', topRpe: [7, 8], backoffSets: 3, backoffReps: [5, 5] })
    expect(day(7, 'thu').exercises[0].scheme).toMatchObject({ backoffSets: 2, backoffReps: [3, 3] })
    expect(day(10, 'tue').exercises[0].scheme).toMatchObject({ topRpe: [8, 8.5], backoffSets: 3, backoffReps: [3, 3] })
    expect(day(10, 'thu').exercises[0].scheme).toMatchObject({ backoffSets: 2, backoffReps: [2, 2] })
    expect(day(11, 'wed').exercises[0].scheme).toMatchObject({ topRpe: [8, 8.5], backoffSets: 2, backoffReps: [3, 3] })
  })
  it('Friday leads with the specified press each week, deadlift PR in week 12', () => {
    const fri = (w: number) => day(w, 'fri').exercises[0].exerciseId
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(fri)).toEqual([
      'chest-press-machine', 'paused-bench-press', 'paused-bench-press', 'chest-press-machine', 'incline-dumbbell-press',
      'paused-bench-press', 'close-grip-bench-press', 'incline-chest-press-machine', 'paused-bench-press', 'chest-press-machine', 'chest-press-machine',
    ])
    expect(day(12, 'fri').exercises[0]).toMatchObject({ exerciseId: 'barbell-deadlift', scheme: { kind: 'pr-test' } })
  })
  it('week 1 matches the specification line by line', () => {
    const sig = (w: number, d: DayKey) => day(w, d).exercises.map((e) => `${e.exerciseId} ${e.sets}x${e.reps[0]}-${e.reps[1]}${e.supersetGroup ?? ''}`)
    expect(sig(1, 'tue')).toEqual(['barbell-squat 3x8-8', 'barbell-rdl 3x10-10', 'leg-press 3x10-12', 'leg-extension 2x12-15A', 'seated-leg-curl 2x10-15A', 'standing-calf-raise-machine 3x10-15', 'cable-crunch 3x12-15'])
    expect(sig(1, 'fri')).toEqual(['chest-press-machine 3x10-10', 'lat-pulldown 3x10-12', 'seated-row-close 3x10-12', 'shoulder-press-machine 2x10-12', 'cable-lateral-raise 3x15-15A', 'reverse-pec-deck 3x15-15A', 'preacher-curl 2x10-12B', 'cable-pushdown 2x10-12B', 'hammer-curl 2x12-12'])
  })
  it('deloads cut working sets roughly 40–50% and sit at 4+ RIR', () => {
    const sets = (w: number) => DAY_ORDER.reduce((n, d) => n + day(w, d).exercises.reduce((s, e) => s + e.sets, 0), 0)
    expect(sets(4) / sets(3)).toBeGreaterThan(0.4); expect(sets(4) / sets(3)).toBeLessThan(0.65)
    expect(sets(8) / sets(7)).toBeGreaterThan(0.4); expect(sets(8) / sets(7)).toBeLessThan(0.65)
    for (const w of [4, 8]) for (const d of DAY_ORDER) for (const e of day(w, d).exercises) expect(e.rir?.[0], `${w}-${d} ${e.exerciseId}`).toBeGreaterThanOrEqual(4)
  })
  it('supersets are pairs inside one workout and match week 1 exactly', () => {
    const pairs = (w: number, d: DayKey) => {
      const m: Record<string, string[]> = {}
      for (const e of day(w, d).exercises) if (e.supersetGroup) (m[e.supersetGroup] ??= []).push(e.exerciseId)
      return m
    }
    expect(pairs(1, 'tue')).toEqual({ A: ['leg-extension', 'seated-leg-curl'] })
    expect(pairs(1, 'wed')).toEqual({ A: ['cable-lateral-raise', 'incline-dumbbell-curl'] })
    expect(pairs(1, 'thu')).toEqual({ B: ['wrist-curl', 'reverse-wrist-curl'] })
    expect(pairs(1, 'fri')).toEqual({ A: ['cable-lateral-raise', 'reverse-pec-deck'], B: ['preacher-curl', 'cable-pushdown'] })
    for (const w of plan.weeks) for (const d of w.days) for (const [g, ids] of Object.entries(pairs(w.index, parseDayId(d.id)!.day))) expect(ids.length, `${d.id} ${g}`).toBe(2)
  })
  it('grip work always comes after the deadlift on Thursday', () => {
    for (let w = 1; w <= 11; w++) {
      const ids = day(w, 'thu').exercises.map((e) => e.exerciseId)
      expect(ids[0]).toBe('barbell-deadlift')
      for (const g of ['wrist-curl', 'reverse-wrist-curl', 'reverse-curl']) if (ids.includes(g)) expect(ids.indexOf(g)).toBeGreaterThan(2)
    }
  })
  it('anchors stay for progression: squat Tue, bench Wed, deadlift Thu, RDL Tue, a row every Wed, a vertical pull every week', () => {
    for (let w = 1; w <= 12; w++) {
      expect(day(w, 'tue').exercises[0].exerciseId).toBe('barbell-squat')
      expect(day(w, 'wed').exercises[0].exerciseId).toBe('barbell-bench-press')
      if (w < 12) expect(day(w, 'thu').exercises[0].exerciseId).toBe('barbell-deadlift')
      if (w !== 8 && w !== 12) expect(day(w, 'tue').exercises.some((e) => e.exerciseId === 'barbell-rdl'), `RDL w${w}`).toBe(true)
      if (w < 12) expect(day(w, 'wed').exercises.some((e) => /row/.test(e.exerciseId)), `row w${w}`).toBe(true)
      expect(DAY_ORDER.some((d) => day(w, d).exercises.some((e) => ['lat-pulldown', 'neutral-grip-lat-pulldown', 'assisted-pull-up', 'pull-up', 'weighted-pull-up'].includes(e.exerciseId))), `pull w${w}`).toBe(true)
    }
  })
  it('vertical pull follows the chosen pull-up rung; explicit pulldowns stay pulldowns', () => {
    const p2 = buildProgramPlan({ start: '2026-10-13', setup: {}, pullStage: 'assisted-pull-up' })
    expect(p2.weeks[1].days[3].exercises.map((e) => e.exerciseId)).toContain('assisted-pull-up')
    expect(p2.weeks[0].days[1].exercises.map((e) => e.exerciseId)).toContain('lat-pulldown')
    expect(plan.weeks[1].days[3].exercises.map((e) => e.exerciseId)).toContain('lat-pulldown')
  })
  it('exercises he cannot do are swapped for an alternative', () => {
    const p3 = buildProgramPlan({ start: '2026-10-13', setup: {}, cannotDo: ['hack-squat'] })
    const tue = p3.weeks[1].days[0].exercises
    expect(tue.some((e) => e.exerciseId === 'hack-squat')).toBe(false)
    expect(tue.find((e) => e.swappedFrom === 'hack-squat')).toBeTruthy()
  })
  it('phases are labelled 1–12 exactly as specified', () => {
    expect(PHASES.map((p) => p.name)).toEqual(['Foundation', 'Build', 'Overload', 'Deload', 'Hypertrophy II', 'Strength + Size', 'Overload II', 'Deload II', 'Advanced Build', 'Performance', 'PR Prep + Hypertrophy Maintenance', 'Performance / PR / Review'])
  })
  it('no NaN anywhere in the plan', () => {
    expect(JSON.stringify(plan)).not.toMatch(/NaN|null,|undefined/)
  })
})

describe('estimated 1RM + loads', () => {
  it('Epley, RIR-adjusted', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 1)
    expect(e1rm(100, 5, 2)).toBeCloseTo(123.33, 1)
    expect(e1rm(150, 1)).toBe(150)
    expect(e1rm(0, 5)).toBe(0)
  })
  it('RPE chart percentages are monotonic', () => {
    for (let r = 1; r < 15; r++) expect(pctFor(r)).toBeGreaterThan(pctFor(r + 1))
    expect(loadFor(100, 1, 0)).toBe(100)
  })
  it('estimate prefers recent logs over setup, ignores failed sets', () => {
    const logs = [log('2026-10-01', 'barbell-squat', [{ kg: 150, reps: 5, rir: 1 }]), log('2026-10-02', 'barbell-squat', [{ kg: 200, reps: 5, failed: true }])]
    const est = estimateFor('barbell-squat', logs, { kg: 140, reps: 5 }, '2026-10-05')
    expect(est.source).toBe('logged'); expect(est.e1rm).toBeCloseTo(150 * (1 + 6 / 30), 1)
    expect(estimateFor('barbell-squat', [], { kg: 140, reps: 5 }).source).toBe('setup')
    expect(estimateFor('barbell-squat', [], undefined).source).toBe('none')
  })
})

describe('auto-progression rules', () => {
  const sq = (w: number) => day(w, 'tue').exercises[0]
  it('first time with setup data prescribes a buildable load', () => {
    const rx = prescribeMain(sq(1), 'squat', 1, [], { squat: { kg: 140, reps: 5 } }, gym)
    expect(rx.sets).toHaveLength(3)
    const kg = rx.sets[0].kg!
    expect(nearestLoad('barbell', kg, gym)!.totalKg).toBe(kg)
    expect(kg).toBeGreaterThan(110); expect(kg).toBeLessThan(140)
  })
  it('no setup data → asks him to choose, never invents', () => {
    const rx = prescribeMain(sq(1), 'squat', 1, [], {}, gym)
    expect(rx.sets[0].kg).toBeUndefined(); expect(rx.flags).toContain('first-time')
  })
  it('missed RIR target → maintain load, no increase', () => {
    const logs = [log('2026-10-13', 'barbell-squat', [{ kg: 130, reps: 6, rir: 1 }, { kg: 130, reps: 5, rir: 0 }, { kg: 130, reps: 4, rir: 0 }])]
    const rx = prescribeMain(sq(2), 'squat', 2, logs, { squat: { kg: 160, reps: 5 } }, gym)
    expect(rx.sets[0].kg).toBe(130); expect(rx.flags).toContain('maintain')
  })
  it('completed at target → increase capped at +5 kg for squat', () => {
    const logs = [log('2026-10-13', 'barbell-squat', [{ kg: 100, reps: 6, rir: 3 }, { kg: 100, reps: 6, rir: 3 }, { kg: 100, reps: 6, rir: 3 }])]
    const rx = prescribeMain(sq(2), 'squat', 2, logs, { squat: { kg: 200, reps: 5 } }, gym)
    // his racks only have 5 kg as the smallest plate, so the next buildable squat is 110 — more than the +5 cap.
    // The engine must never prescribe an unbuildable 105: it holds 100 (and chases reps) instead.
    expect(rx.sets[0].kg).toBeLessThanOrEqual(105); expect(rx.sets[0].kg).toBeGreaterThanOrEqual(100)
  })
  it('form broke down → hold or reduce', () => {
    const l = log('2026-10-13', 'barbell-squat', [{ kg: 120, reps: 6, rir: 3 }])
    l.exercises[0].sets[0].sticking = 'Form broke down'
    const rx = prescribeMain(sq(2), 'squat', 2, [l], { squat: { kg: 200, reps: 5 } }, gym)
    expect(rx.sets[0].kg).toBeLessThanOrEqual(120)
  })
  it('repeated reductions → overreach flag', () => {
    const logs = ['2026-10-01', '2026-10-08', '2026-10-15'].map((d) => log(d, 'barbell-squat', [{ kg: 120, reps: 5, rir: 2, adjusted: 'reduced' }]))
    expect(prescribeMain(sq(3), 'squat', 3, logs, {}, gym).flags).toContain('overreach')
  })
  it('deload week is 60–70% of recent working weight', () => {
    const logs = [log('2026-10-20', 'barbell-squat', [{ kg: 140, reps: 5, rir: 2 }])]
    const rx = prescribeMain(sq(4), 'squat', 4, logs, { squat: { kg: 140, reps: 5 } }, gym)
    expect(rx.sets[0].kg! / 140).toBeGreaterThanOrEqual(0.58); expect(rx.sets[0].kg! / 140).toBeLessThanOrEqual(0.72)
  })
  it('week 6 back-offs are 5–8% lighter than the top set', () => {
    const rx = prescribeMain(sq(6), 'squat', 6, [], { squat: { kg: 140, reps: 5 } }, gym)
    const top = rx.sets[0].kg!, back = rx.sets[1].kg!
    expect(rx.sets[0].kind).toBe('top'); expect(rx.sets).toHaveLength(4)
    expect(1 - back / top).toBeGreaterThan(0.03); expect(1 - back / top).toBeLessThan(0.1)
  })
})

describe('accessory double progression', () => {
  const pe: PlanExercise = { exerciseId: 'chest-press-machine', sets: 3, reps: [8, 12], restSec: 120, rir: [2, 3] }
  it('12/12/12 at target RIR → heavier, reps back to 8', () => {
    const logs = [log('2026-10-16', 'chest-press-machine', [{ kg: 50, reps: 12, rir: 2 }, { kg: 50, reps: 12, rir: 2 }, { kg: 50, reps: 12, rir: 2 }])]
    const rx = prescribeAccessory(pe, logs, gym)
    expect(rx.sets[0].kg).toBeGreaterThan(50); expect(rx.flags).toContain('increase')
  })
  it('not all sets at the top → same weight', () => {
    const logs = [log('2026-10-16', 'chest-press-machine', [{ kg: 50, reps: 12, rir: 2 }, { kg: 50, reps: 10, rir: 2 }, { kg: 50, reps: 9, rir: 1 }])]
    expect(prescribeAccessory(pe, logs, gym).sets[0].kg).toBe(50)
  })
  it('respects the machine\'s own increments (lb stack)', () => {
    const meta = { exerciseId: 'chest-press-machine', unit: 'lb' as const, increments: [100, 110, 120, 130], updatedAt: '' }
    const kg110 = 110 * 0.45359237
    const up = nextUp(byId.get('chest-press-machine'), kg110, gym, meta)
    expect(up).toBeCloseTo(120 * 0.45359237, 4)
    expect(snapLoad(byId.get('chest-press-machine'), 52, gym, meta)).toBeCloseTo(kg110, 4)
  })
})

describe('PR coach', () => {
  it('opener ~90–95%, attempt 2 at/above PR, warm-ups below the opener and ascending', () => {
    const logs = [log('2026-12-01', 'barbell-bench-press', [{ kg: 105, reps: 1, rir: 2 }])]
    const p = prAttempts('bench', logs, { bench: { kg: 100, reps: 5 }, benchPR: 110 }, gym)
    const max = p.estimate.e1rm
    expect(p.attempts[0].kg / max).toBeGreaterThan(0.88); expect(p.attempts[0].kg / max).toBeLessThan(0.96)
    expect(p.attempts[1].kg).toBeGreaterThanOrEqual(110)
    expect(p.attempts[2].kg).toBeGreaterThan(p.attempts[1].kg)
    for (let i = 1; i < p.warmups.length; i++) expect(p.warmups[i].kg).toBeGreaterThan(p.warmups[i - 1].kg)
    expect(p.warmups[p.warmups.length - 1].kg).toBeLessThan(p.attempts[0].kg)
    expect(p.safety).toMatch(/spotter|safeties/)
  })
})

describe('volume counting: direct vs contribution', () => {
  it('bench counts 1 chest direct and only 0.5 triceps/front-delt contribution', () => {
    const v = emptyVolume(); addVolume(v, byId.get('barbell-bench-press'), 3)
    expect(v.chest.direct).toBe(3); expect(v.triceps.direct).toBe(0); expect(v.triceps.contribution).toBe(1.5)
  })
  it('normal week lands near the owner targets', () => {
    const v = plannedVolume(plan.weeks[4].days)
    expect(v.chest.direct).toBeGreaterThanOrEqual(8)
    expect(v.back.direct).toBeGreaterThanOrEqual(10)
    expect(v.quads.direct).toBeGreaterThanOrEqual(8)
    expect(v.forearms.direct).toBeGreaterThanOrEqual(4)
  })
})

describe('calendar, missed sessions, steps, weight', () => {
  it('program weeks follow the calendar and honour a repeated week', () => {
    expect(nextTuesday('2026-10-07')).toBe('2026-10-13')
    expect(programWeekFor(plan, '2026-10-13').week).toBe(1)
    expect(programWeekFor(plan, '2026-10-20').week).toBe(2)
    expect(programWeekFor(plan, '2026-10-12').week).toBe(1) // Monday before = week 1 window
    expect(programWeekFor(plan, '2026-10-10').started).toBe(false)
    const rep = { ...plan, repeatedWeeks: [2] }
    expect(programWeekFor(rep, '2026-10-27')).toMatchObject({ week: 2, repeat: true })
    expect(programWeekFor(rep, '2026-11-03').week).toBe(3)
    expect(programWeekFor(plan, '2027-02-01').finished).toBe(true)
  })
  it('missed sessions are detected, never auto-combined', () => {
    const s = weekStatus(plan, '2026-10-12', 1, [], '2026-10-15')
    expect(s.map((x) => x.state)).toEqual(['missed', 'missed', 'today', 'upcoming'])
  })
  it('steps only progress after consistent adherence', () => {
    const hist = Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, steps: 8600 }))
    expect(stepTargetFor(hist, 8000, '2026-10-15').suggestUp).toBe(true)
    expect(stepTargetFor(hist.slice(0, 5), 8000, '2026-10-15').suggestUp).toBe(false)
  })
  it('weight stats: 7-day average, lost, remaining, percentage', () => {
    const w = weightStats([{ date: '2026-10-01', weightKg: 98 }, { date: '2026-10-10', weightKg: 96 }, { date: '2026-10-12', weightKg: 95 }], 98, 85, '2026-10-12')
    expect(w.avg7).toBeCloseTo(95.5); expect(w.lost).toBeCloseTo(2.5); expect(w.remaining).toBeCloseTo(10.5)
    expect(w.pct).toBeCloseTo(2.5 / 13 * 100, 1)
    expect(weightStats([], 98, 85, '2026-10-12').latest).toBeUndefined()
  })
  it('readiness never changes anything by itself — it only offers options', () => {
    expect(readinessAdvice({ sleep: 5, energy: 5, soreness: 1, readiness: 5 }).options).toHaveLength(0)
    const poor = readinessAdvice({ sleep: 1, energy: 2, soreness: 5, readiness: 1 })
    expect(poor.level).toBe('poor'); expect(poor.options.map((o) => o.id)).toEqual(['maintain', 'reduce', 'drop-set'])
  })
})

describe('commercial-gym plates', () => {
  it('Flex racks only have 5/10/15/20 plates: heavy deadlifts build, 2.5 jumps do not', () => {
    expect(nearestLoad('barbell', 230, gym)!.totalKg).toBe(230)
    expect([100, 110]).toContain(nearestLoad('barbell', 102.5, gym)!.totalKg)
    expect(gym.platePairsKg).not.toContain(2.5)
    expect(gym.platePairsKg).not.toContain(25)
    const side = sideBreakdown(105, gym.platePairsKg)
    expect(side.reduce((a, b) => a + b, 0)).toBe(105)
    expect([...side].sort((a, b) => b - a)).toEqual(side)
    expect(nearestLoad('barbell', 70, gym)!.perSide).toEqual([20, 5])
  })
  it('every day of every week has its own exercise list', () => {
    for (const w of plan.weeks) for (const d of w.days) expect(d.exercises.length).toBeGreaterThan(0)
  })

})
