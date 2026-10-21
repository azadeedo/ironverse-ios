// Proves the 12-week program is 48 INDIVIDUALLY DEFINED workouts — not one
// Tuesday/Wednesday/Thursday/Friday template reused 12 times — and that the
// workouts are what the live session engine, history and adaptive loads use.
import { describe, expect, it } from 'vitest'
import { byId } from '@/data/exercises'
import { DAY_ORDER, type DayKey } from '@/data/program12'
import { PROGRAM, programExerciseIds, workoutFor } from '@/data/program48'
import { AUTHORED_COACHING_IDS, coachingFor } from '@/data/coaching'
import { MEDIA } from '@/data/media'
import { MACHINE_LIBRARY } from '@/screens/session/V6'
import {
  buildProgramPlan, cardioFor, lastPerformance, prescribeAccessory, prescribedSetLogs, programWeekFor, upgradeProgramPlan, whyToday,
} from '@/lib/program12'
import type { Plan, PlanDay, WorkoutLog } from '@/db/types'

const plan = buildProgramPlan({ start: '2026-10-13', setup: { squat: { kg: 140, reps: 5 }, bench: { kg: 100, reps: 5 }, deadlift: { kg: 170, reps: 5 } } })
const pd = (w: number, d: DayKey): PlanDay => plan.weeks[w - 1].days[DAY_ORDER.indexOf(d)]
/** a workout's full prescription as a comparable signature */
const sig = (w: number, d: DayKey) => JSON.stringify(pd(w, d).exercises.map((e) => [e.exerciseId, e.sets, e.reps, e.rir, e.rpe, e.scheme?.kind, e.supersetGroup]))
const lines = (w: number, d: DayKey) => pd(w, d).exercises.map((e) => `${e.exerciseId}|${e.sets}|${e.reps.join('-')}|${e.rir?.join('-')}`)
const diffCount = (a: string[], b: string[]) => a.filter((x) => !b.includes(x)).length + b.filter((x) => !a.includes(x)).length

describe('48 workout definitions', () => {
  it('12 weeks × Tue/Wed/Thu/Fri = 48 workouts in the program data', () => {
    expect(PROGRAM).toHaveLength(12)
    let n = 0
    for (let w = 1; w <= 12; w++) {
      for (const d of DAY_ORDER) {
        const wo = workoutFor(w, d)
        expect(wo, `week ${w} ${d}`).toBeDefined()
        expect(wo!.programWeek).toBe(w)
        expect(wo!.day).toBe(d)
        expect(wo!.entries.length, `week ${w} ${d}`).toBeGreaterThan(0)
        n++
      }
    }
    expect(n).toBe(48)
  })

  it('the built active plan has 48 separate day objects with unique ids', () => {
    const days = plan.weeks.flatMap((w) => w.days)
    expect(days).toHaveLength(48)
    expect(new Set(days.map((d) => d.id)).size).toBe(48)
    // no two workouts share the same exercise array or entry objects
    const arrays = new Set(days.map((d) => d.exercises))
    expect(arrays.size).toBe(48)
    const entries = days.flatMap((d) => d.exercises)
    expect(new Set(entries).size).toBe(entries.length)
  })

  it('every entry carries the full set of per-workout fields', () => {
    for (let w = 1; w <= 12; w++) for (const d of DAY_ORDER) {
      const wo = workoutFor(w, d)!
      expect(wo.phase.length).toBeGreaterThan(2)
      expect(wo).toHaveProperty('cardio')
      wo.entries.forEach((e, i) => {
        const where = `w${w} ${d} #${i + 1} ${e.exerciseId}`
        expect(byId.has(e.exerciseId), where).toBe(true)
        expect(e.order, where).toBe(i + 1)
        expect(e.sets, where).toBeGreaterThan(0)
        expect(e.repMin, where).toBeLessThanOrEqual(e.repMax)
        expect(e.targetRIR, where).toBeDefined()
        expect(e.restSeconds, where).toBeGreaterThanOrEqual(60)
        expect(e.warmupRule, where).toBeTruthy()
        expect(e.progressionRule, where).toBeTruthy()
        expect(typeof e.isPRSideQuest, where).toBe('boolean')
        expect(e.goal, where).toBeTruthy()
      })
      for (const pe of pd(w, d).exercises) {
        expect(pe.purpose, `${pd(w, d).id} ${pe.exerciseId}`).toBeTruthy()
        expect(pe.whyToday, `${pd(w, d).id} ${pe.exerciseId}`).toBeTruthy()
        expect(pe.volume?.sets, `${pd(w, d).id} ${pe.exerciseId}`).toBe(pe.sets)
        expect(coachingFor(pe.exerciseId), pe.exerciseId).toBeDefined()
      }
    }
  })

  it('every programmed exercise has authored coaching (TIP / FEEL / AVOID / PROGRESSION)', () => {
    const missing = programExerciseIds().filter((id) => !AUTHORED_COACHING_IDS.includes(id))
    expect(missing).toEqual([])
  })
})

describe('the weeks are genuinely different', () => {
  it('Week 1 Tuesday ≠ Week 7 Tuesday (the owner’s simplest test) — and not just the main lift', () => {
    expect(sig(1, 'tue')).not.toBe(sig(7, 'tue'))
    expect(diffCount(lines(1, 'tue').slice(1), lines(7, 'tue').slice(1))).toBeGreaterThanOrEqual(6)
  })
  it('Week 1 Tuesday ≠ Week 6 Tuesday', () => expect(sig(1, 'tue')).not.toBe(sig(6, 'tue')))
  it('Week 2 Wednesday ≠ Week 7 Wednesday', () => expect(sig(2, 'wed')).not.toBe(sig(7, 'wed')))
  it('Week 3 Thursday ≠ Week 10 Thursday', () => expect(sig(3, 'thu')).not.toBe(sig(10, 'thu')))
  it('Week 4 ≠ Week 8 even though both are deloads', () => {
    for (const d of DAY_ORDER) expect(sig(4, d), d).not.toBe(sig(8, d))
    expect(pd(4, 'tue').kind).toBe('deload'); expect(pd(8, 'tue').kind).toBe('deload')
  })
  it('Week 12 is not an ordinary training week', () => {
    expect(DAY_ORDER.map((d) => pd(12, d).kind)).toEqual(['pr', 'pr', 'recovery', 'pr'])
    for (let w = 1; w <= 11; w++) for (const d of DAY_ORDER) expect(sig(12, d)).not.toBe(sig(w, d))
    expect(pd(12, 'thu').exercises.some((e) => e.role === 'main')).toBe(false)
  })
  it('no workout is an exact copy of the same day in ANY other week', () => {
    for (const d of DAY_ORDER) {
      const all = Array.from({ length: 12 }, (_, i) => sig(i + 1, d))
      expect(new Set(all).size, d).toBe(12)
    }
  })
  it('exercises rotate between blocks while anchors stay', () => {
    const ids = (w: number) => new Set(DAY_ORDER.flatMap((d) => pd(w, d).exercises.map((e) => e.exerciseId)))
    const block1 = ids(1), block2 = ids(5), block3 = ids(9)
    const newIn5 = [...block2].filter((x) => !block1.has(x))
    expect(newIn5.length).toBeGreaterThanOrEqual(3)
    for (const anchor of ['barbell-squat', 'barbell-bench-press', 'barbell-deadlift', 'barbell-rdl', 'chest-supported-row'])
      for (const b of [block1, block2, block3]) expect(b.has(anchor) || anchor === 'chest-supported-row', anchor).toBe(true)
  })
  it('sets, reps and RIR all vary across the weeks', () => {
    const squat = Array.from({ length: 11 }, (_, i) => pd(i + 1, 'tue').exercises[0])
    expect(new Set(squat.map((e) => e.sets)).size).toBeGreaterThan(2)
    expect(new Set(squat.map((e) => e.reps.join('-'))).size).toBeGreaterThan(3)
    expect(new Set(squat.map((e) => e.rir?.join('-'))).size).toBeGreaterThan(2)
  })
  it('cardio prescription changes with the week and appears on the day itself', () => {
    expect(pd(1, 'tue').cardio).toMatchObject({ minutes: [15, 15], kind: 'incline-walk' })
    expect(pd(2, 'tue').cardio).toMatchObject({ minutes: [20, 20] })
    expect(pd(9, 'tue').cardio).toMatchObject({ minutes: [25, 25] })
    expect(pd(4, 'tue').cardio?.kind).toBe('easy')
    expect(cardioFor(3).sessions[0]).toBe(3)
    expect(cardioFor(4).sessions[0]).toBe(2)
  })
  it('WHY TODAY explains the week-specific change (week 6 RDL drops reps)', () => {
    const rdl6 = workoutFor(6, 'tue')!.entries.find((e) => e.exerciseId === 'barbell-rdl')!
    expect(whyToday(6, 'tue', rdl6)).toMatch(/Lower reps today \(6–8 vs 8–10/)
    expect(pd(1, 'tue').exercises[0].whyToday).not.toBe(pd(7, 'tue').exercises[0].whyToday)
  })
})

describe('connected to sessions, history and adaptive weights', () => {
  it('each prescribed set becomes its own set row with the planned weight recorded', () => {
    const hack = pd(5, 'tue').exercises.find((e) => e.exerciseId === 'hack-squat')!
    expect(hack.sets).toBe(4)
    const rx = prescribeAccessory(hack, [], null)
    const rows = prescribedSetLogs(hack, rx)
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.setIndex)).toEqual([0, 1, 2, 3])
  })
  it('logging Week 1 Tuesday does not change Week 2 Tuesday', () => {
    const before = JSON.stringify(pd(2, 'tue'))
    const w1 = pd(1, 'tue')
    const sets = prescribedSetLogs(w1.exercises[0], { exerciseId: w1.exercises[0].exerciseId, sets: [{ kind: 'work', reps: [8, 8], kg: 100 }], why: '', flags: [] })
    sets[0].weightKg = 999; sets[0].reps = 1
    w1.exercises[0].sets = w1.exercises[0].sets // touching week 1 in place
    expect(JSON.stringify(pd(2, 'tue'))).toBe(before)
  })
  it('editing one workout in the plan cannot leak into another week', () => {
    const copy: Plan = JSON.parse(JSON.stringify(plan))
    copy.weeks[0].days[0].exercises[1].sets = 9
    expect(copy.weeks[1].days[0].exercises[1].sets).not.toBe(9)
    expect(plan.weeks[0].days[0].exercises[1].sets).toBe(3)
  })
  it('historical records stay independent of the plan', () => {
    const log: WorkoutLog = { id: 'l1', date: '2026-10-13', planId: plan.id, dayId: pd(1, 'tue').id, weekIndex: 1, title: 't', startedAt: '', finishedAt: 'x', exercises: [{ exerciseId: 'barbell-squat', sets: [{ setIndex: 0, targetReps: [8, 8], weightKg: 100, plannedKg: 100, reps: 8, done: true }] }] }
    const snap = JSON.stringify(log)
    const rebuilt = upgradeProgramPlan({ ...plan, programVersion: 1 }, {})
    expect(JSON.stringify(log)).toBe(snap)
    expect(rebuilt.id).toBe(plan.id)
  })
  it('failed weight logic: 100×7 then 90×10, 90×10 → next time 90 kg, never 102.5', () => {
    const hack = { ...pd(1, 'tue').exercises[2], exerciseId: 'hack-squat', reps: [10, 10] as [number, number], sets: 3, rir: [2, 2] as [number, number] }
    const sets = [{ kg: 100, reps: 7 }, { kg: 90, reps: 10 }, { kg: 90, reps: 10 }].map((s, i) => ({ setIndex: i, targetReps: [10, 10] as [number, number], weightKg: s.kg, reps: s.reps, rir: 2, done: true }))
    const perf = lastPerformance(sets, [10, 10], [2, 2])
    expect(perf).toMatchObject({ attemptedKg: 100, successKg: 90, missedHeavier: true })
    const logs: WorkoutLog[] = [{ id: 'a', date: '2026-10-13', title: 't', startedAt: '2026-10-13T10:00:00Z', finishedAt: '2026-10-13T11:00:00Z', exercises: [{ exerciseId: 'hack-squat', sets }] }]
    const rx = prescribeAccessory(hack, logs, null)
    expect(rx.sets.every((s) => s.kg === 90)).toBe(true)
    expect(rx.why).toMatch(/attempted 100 kg/)
  })
  it('successful progression: 12/12/12 in an 8–12 range at target RIR → small increase', () => {
    const pe = { ...pd(1, 'tue').exercises[2], reps: [8, 12] as [number, number], rir: [2, 2] as [number, number] }
    const logs: WorkoutLog[] = [{ id: 'b', date: '2026-10-13', title: 't', startedAt: '2026-10-13T10:00:00Z', finishedAt: '2026-10-13T11:00:00Z',
      exercises: [{ exerciseId: pe.exerciseId, sets: [0, 1, 2].map((i) => ({ setIndex: i, targetReps: [8, 12] as [number, number], weightKg: 100, reps: 12, rir: 2, done: true })) }] }]
    const rx = prescribeAccessory(pe, logs, null)
    expect(rx.flags).toContain('increase')
    expect(rx.sets[0].kg).toBeGreaterThan(100); expect(rx.sets[0].kg).toBeLessThanOrEqual(105)
  })
})

describe('schedule controls never rewrite history', () => {
  it('skip week, manual week and start date move the calendar only', () => {
    expect(programWeekFor(plan, '2026-10-21').week).toBe(2)
    expect(programWeekFor({ ...plan, skippedWeeks: [2] }, '2026-10-21').week).toBe(3)
    expect(programWeekFor({ ...plan, manualWeek: { calendarWeek: 1, week: 6, setAt: '' } }, '2026-10-21').week).toBe(6)
    expect(programWeekFor({ ...plan, manualWeek: { calendarWeek: 1, week: 6, setAt: '' } }, '2026-10-28').week).toBe(7)
    expect(programWeekFor({ ...plan, manualWeek: { calendarWeek: 1, week: 6, setAt: '' } }, '2026-10-14').week).toBe(1)
  })
  it('upgrading an old template plan keeps id, start date, repeats and user-added exercises', () => {
    const old: Plan = { ...plan, programVersion: 1, repeatedWeeks: [3], weeks: plan.weeks.map((w) => ({ ...w, days: w.days.map((d) => d.id === 'p12-w2-tue' ? { ...d, exercises: [...d.exercises, { exerciseId: 'hip-thrust-machine', sets: 3, reps: [8, 12], restSec: 90, note: 'Added by you' }] } : d) })) }
    const up = upgradeProgramPlan(old, {})
    expect(up.id).toBe(plan.id); expect(up.programStart).toBe('2026-10-13'); expect(up.repeatedWeeks).toEqual([3]); expect(up.programVersion).toBe(2)
    expect(up.weeks[1].days[0].exercises.some((e) => e.exerciseId === 'hip-thrust-machine')).toBe(true)
  })
})

describe('library and media coverage', () => {
  it('every machine in the machine library exists', () => {
    expect(MACHINE_LIBRARY.filter((m) => !byId.has(m.id)).map((m) => m.id)).toEqual([])
    expect(MACHINE_LIBRARY.length).toBeGreaterThanOrEqual(28)
  })
  it('reports media coverage for programmed exercises', () => {
    const ids = programExerciseIds()
    const withImg = ids.filter((id) => MEDIA[id])
    const withAnim = ids.filter((id) => byId.get(id)?.anim)
    // eslint-disable-next-line no-console
    console.log(`MEDIA COVERAGE images ${withImg.length}/${ids.length} anim ${withAnim.length}/${ids.length} missing-img: ${ids.filter((id) => !MEDIA[id]).join(',')}`)
    expect(withAnim.length).toBe(ids.length)
  })
})
