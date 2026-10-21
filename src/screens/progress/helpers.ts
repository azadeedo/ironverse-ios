// Shared maths for the Progress module — pure functions, no React.
import type { Dayjs } from 'dayjs'
import { dayjs } from '@/lib/fmt'
import { byId } from '@/data/exercises'
import type { Exercise, Muscle, WorkoutLog } from '@/db/types'

/** Monday-anchored start of the week containing d. */
export function weekStartOf(d: Dayjs): Dayjs {
  const dow = (d.day() + 6) % 7 // 0 = Monday
  return d.subtract(dow, 'day').startOf('day')
}

/** Epley estimated 1RM: w × (1 + r/30). */
export const epley = (weightKg: number, reps: number): number => weightKg * (1 + reps / 30)

export interface ExerciseStats {
  ex: Exercise
  /** best Epley e1RM across all done weighted sets */
  bestE1rm: number | null
  /** the set that produced the best e1RM */
  bestSet: { weightKg: number; reps: number; date: string } | null
  /** best rep count on unweighted (bodyweight) sets */
  bestReps: number | null
  /** longest timed set (plank, jump rope finishers…) */
  bestTimeSec: number | null
  lastDone: string
  sessions: number
}

/** Roll every workout log up into per-exercise PR stats, sorted by recency. */
export function collectExerciseStats(logs: WorkoutLog[]): ExerciseStats[] {
  const map = new Map<string, ExerciseStats>()
  for (const log of logs) {
    for (const entry of log.exercises) {
      const ex = byId.get(entry.exerciseId)
      if (!ex) continue
      const doneSets = entry.sets.filter((s) => s.done)
      if (doneSets.length === 0) continue
      let st = map.get(ex.id)
      if (!st) {
        st = { ex, bestE1rm: null, bestSet: null, bestReps: null, bestTimeSec: null, lastDone: log.date, sessions: 0 }
        map.set(ex.id, st)
      }
      st.sessions += 1
      if (log.date > st.lastDone) st.lastDone = log.date
      for (const s of doneSets) {
        if (s.weightKg && s.weightKg > 0 && s.reps && s.reps > 0) {
          const e = epley(s.weightKg, s.reps)
          if (st.bestE1rm === null || e > st.bestE1rm) {
            st.bestE1rm = e
            st.bestSet = { weightKg: s.weightKg, reps: s.reps, date: log.date }
          }
        } else if (s.reps && s.reps > 0) {
          if (st.bestReps === null || s.reps > st.bestReps) st.bestReps = s.reps
        }
        if (s.timeSec && (st.bestTimeSec === null || s.timeSec > st.bestTimeSec)) st.bestTimeSec = s.timeSec
      }
    }
  }
  return [...map.values()].sort((a, b) => b.lastDone.localeCompare(a.lastDone))
}

/** Total kg moved in one workout (falls back to summing done sets). */
export function logVolumeKg(log: WorkoutLog): number {
  if (typeof log.totalVolumeKg === 'number') return log.totalVolumeKg
  let v = 0
  for (const e of log.exercises) {
    for (const s of e.sets) if (s.done && s.weightKg && s.reps) v += s.weightKg * s.reps
  }
  return v
}

/** Weekly total volume for the last `weeks` weeks (oldest → newest). */
export function weeklyVolume(logs: WorkoutLog[], weeks = 8): { label: string; value: number }[] {
  const thisWeek = weekStartOf(dayjs())
  const out: { label: string; value: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = thisWeek.subtract(i, 'week')
    const from = ws.format('YYYY-MM-DD')
    const to = ws.add(7, 'day').format('YYYY-MM-DD')
    const total = logs.reduce((sum, l) => (l.date >= from && l.date < to ? sum + logVolumeKg(l) : sum), 0)
    out.push({ label: ws.format('D/M'), value: Math.round(total) })
  }
  return out
}

/** Done sets per primary muscle for logs with from ≤ date < to. */
export function setsPerMuscle(logs: WorkoutLog[], from: string, to: string): Map<Muscle, number> {
  const m = new Map<Muscle, number>()
  for (const log of logs) {
    if (log.date < from || log.date >= to) continue
    for (const e of log.exercises) {
      const ex = byId.get(e.exerciseId)
      if (!ex || ex.kind === 'cardio') continue
      const done = e.sets.filter((s) => s.done).length
      if (!done) continue
      for (const mus of ex.primary) m.set(mus, (m.get(mus) ?? 0) + done)
    }
  }
  return m
}

/** Consecutive weeks (incl. this week, or starting last week if this one is still empty) with ≥1 workout. */
export function weekStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const weeks = new Set(dates.map((d) => weekStartOf(dayjs(d)).format('YYYY-MM-DD')))
  let cursor = weekStartOf(dayjs())
  if (!weeks.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'week')
  let streak = 0
  while (weeks.has(cursor.format('YYYY-MM-DD'))) {
    streak += 1
    cursor = cursor.subtract(1, 'week')
  }
  return streak
}
