// IV-08 — progression pathways (e.g. assisted pull-up → pull-up → weighted pull-up).
// Each stage has a milestone checked against REAL logged sets: N working sets of
// at least R reps in one session (and, where it matters, a minimum load).
import type { WorkoutLog } from '@/db/types'

export interface Stage { id: string; sets: number; reps: number; minKg?: number | ((bw: number) => number); note?: string }
export interface Pathway { id: string; name: string; stages: Stage[] }

export const PATHWAYS: Pathway[] = [
  { id: 'pullup', name: 'Pull-up pathway', stages: [
    { id: 'lat-pulldown', sets: 3, reps: 10, minKg: (bw) => Math.round(bw * 0.6 / 2.5) * 2.5, note: 'pulldown at ≈60% of bodyweight' },
    { id: 'assisted-pull-up', sets: 3, reps: 8 },
    { id: 'pull-up', sets: 3, reps: 8 },
    { id: 'weighted-pull-up', sets: 3, reps: 5, minKg: 10, note: 'with +10 kg' },
  ] },
  { id: 'pushup', name: 'Push-up pathway', stages: [
    { id: 'knee-push-up', sets: 3, reps: 15 },
    { id: 'incline-push-up', sets: 3, reps: 12 },
    { id: 'push-up', sets: 3, reps: 15 },
    { id: 'decline-push-up', sets: 3, reps: 12 },
    { id: 'weighted-push-up', sets: 3, reps: 8, minKg: 10, note: 'with +10 kg' },
  ] },
  { id: 'dip', name: 'Dip pathway', stages: [
    { id: 'bench-dip', sets: 3, reps: 15 },
    { id: 'assisted-dip', sets: 3, reps: 10 },
  ] },
  { id: 'squat', name: 'Squat pathway', stages: [
    { id: 'bodyweight-squat', sets: 3, reps: 20 },
    { id: 'goblet-squat', sets: 3, reps: 10, minKg: (bw) => Math.round(bw * 0.25 / 2) * 2, note: 'goblet at ≈25% of bodyweight' },
    { id: 'barbell-squat', sets: 3, reps: 5, minKg: (bw) => Math.round(bw * 0.75 / 2.5) * 2.5, note: 'back squat at ≈75% of bodyweight' },
  ] },
  { id: 'hang', name: 'Hanging core pathway', stages: [
    { id: 'hanging-knee-raise', sets: 3, reps: 12 },
    { id: 'hanging-leg-raise', sets: 3, reps: 10 },
  ] },
]

export const pathwayFor = (exerciseId: string) => PATHWAYS.find((p) => p.stages.some((s) => s.id === exerciseId))
export const minKgOf = (s: Stage, bw: number) => (typeof s.minKg === 'function' ? s.minKg(bw) : s.minKg ?? 0)

export interface StageStatus { stage: Stage; achieved?: string; best?: { sets: number; date: string }; minKg: number }
/** For each stage: the first date the milestone was met, and the best attempt so far. */
export function pathwayStatus(p: Pathway, logs: WorkoutLog[], bw: number): { stages: StageStatus[]; current: number } {
  const done = [...logs].filter((l) => l.finishedAt).sort((a, b) => a.date.localeCompare(b.date))
  const stages = p.stages.map((stage) => {
    const minKg = minKgOf(stage, bw); let achieved: string | undefined; let best: StageStatus['best']
    for (const l of done) {
      const n = l.exercises.filter((e) => e.exerciseId === stage.id).flatMap((e) => e.sets)
        .filter((s) => s.done && !s.warmup && (s.reps ?? 0) >= stage.reps && (s.weightKg ?? 0) >= minKg).length
      if (n && (!best || n > best.sets)) best = { sets: n, date: l.date }
      if (!achieved && n >= stage.sets) achieved = l.date
    }
    return { stage, achieved, best, minKg }
  })
  const current = stages.findIndex((s) => !s.achieved)
  return { stages, current: current < 0 ? stages.length : current }
}
