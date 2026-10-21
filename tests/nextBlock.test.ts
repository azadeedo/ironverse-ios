import { describe, expect, it } from 'vitest'
import { applyBlockChanges, applyBlockSwaps, nextBlockChanges, nextBlockSwaps } from '@/lib/nextBlock'
import { builtInProfiles } from '@/lib/equipment'

const plan = { id: 'p', name: 'P', startDate: '2026-07-01', trainingWeekdays: [2], active: true, createdAt: '', weeks: [{ index: 1, label: 'w', days: [{ id: 'd', title: 'D', focus: [], estMinutes: 60, estCalories: 0, exercises: [
  { exerciseId: 'barbell-squat', sets: 3, reps: [5, 8], role: 'main' }, { exerciseId: 'leg-extension', sets: 3, reps: [10, 15], role: 'accessory' }, { exerciseId: 'dumbbell-lateral-raise', sets: 3, reps: [12, 15], role: 'accessory' }] }] }] } as never
const log = (date: string, id: string, kg: number) => ({ id: date + id, date, finishedAt: date, exercises: [{ exerciseId: id, sets: [{ setIndex: 0, targetReps: [10, 15], reps: 12, weightKg: kg, done: true }] }] }) as never
describe('next block evolves stalled accessories', () => {
  it('swaps a stalled accessory, keeps progressing ones and main lifts', () => {
    const logs = ['2026-07-02', '2026-07-09', '2026-07-16', '2026-07-23'].flatMap((d, i) => [log(d, 'leg-extension', 50), log(d, 'dumbbell-lateral-raise', 8 + i * 2), log(d, 'barbell-squat', 100)])
    const gym = builtInProfiles(null)[1]
    const S = nextBlockSwaps(plan, logs, gym)
    expect(S.map((s) => s.from)).toEqual(['leg-extension'])
    const next = applyBlockSwaps(plan, S)
    const ids = (next as never as { weeks: { days: { exercises: { exerciseId: string }[] }[] }[] }).weeks[0].days[0].exercises.map((e) => e.exerciseId)
    expect(ids).not.toContain('leg-extension'); expect(ids).toContain('barbell-squat'); expect(ids).toContain('dumbbell-lateral-raise')
  })
})

describe('next block — full decisions', () => {
  const gym = builtInProfiles(null)[1]
  it('harder after a pathway milestone, keep main lifts and progressing ones, easier when injured, swap stalled to a lengthened option', () => {
    const p = { ...(plan as object), weeks: [{ index: 1, label: 'w', days: [{ id: 'd', title: 'D', focus: [], estMinutes: 60, estCalories: 0, exercises: [
      { exerciseId: 'barbell-squat', sets: 3, reps: [5, 8], role: 'main' },
      { exerciseId: 'assisted-pull-up', sets: 3, reps: [6, 10], role: 'compound' },
      { exerciseId: 'lying-leg-curl', sets: 3, reps: [10, 15], role: 'accessory' },
      { exerciseId: 'barbell-bench-press', sets: 3, reps: [5, 8], role: 'compound' },
    ] }] }] } as never
    const L = (d: string, id: string, kg: number, reps = 12, n = 1) => ({ id: d + id, date: d, finishedAt: d, exercises: [{ exerciseId: id, sets: Array.from({ length: n }, (_, i) => ({ setIndex: i, targetReps: [6, 10], reps, weightKg: kg, done: true })) }] }) as never
    const days = ['2026-07-02', '2026-07-09', '2026-07-16', '2026-07-23']
    const logs = days.flatMap((d) => [L(d, 'barbell-squat', 100, 6), L(d, 'lying-leg-curl', 40), L(d, 'barbell-bench-press', 80, 6), L(d, 'assisted-pull-up', 20, 9, 3)])
    const meta = new Map([['barbell-bench-press', { exerciseId: 'barbell-bench-press', injured: true, updatedAt: '' }]]) as never
    const C = nextBlockChanges(p, logs, gym, { bw: 90, meta })
    const by = (id: string) => C.find((c) => c.from === id)!
    expect(by('barbell-squat').kind).toBe('keep')
    expect(by('assisted-pull-up')).toMatchObject({ kind: 'harder', to: 'pull-up' })
    expect(by('barbell-bench-press')).toMatchObject({ kind: 'easier', to: 'chest-press-machine' })
    expect(by('lying-leg-curl')).toMatchObject({ kind: 'angle', to: 'seated-leg-curl' })
    const next = applyBlockChanges(p, C.filter((c) => c.optional)) as never as { weeks: { days: { exercises: { exerciseId: string }[] }[] }[] }
    expect(next.weeks[0].days[0].exercises.map((e) => e.exerciseId)).toEqual(['barbell-squat', 'pull-up', 'seated-leg-curl', 'chest-press-machine'])
    void applyBlockSwaps; void nextBlockSwaps
  })
})
