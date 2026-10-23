// Saved workouts (v10.1, owner request 23 Oct 2026): keep any finished session
// as a template and start it again later in one tap. Stored in a settings key
// (no schema change) and included in backups with the rest of settings.
import { db, getSetting, setSetting } from '@/db'
import { newId, nowIso, todayStr } from '@/lib/id'
import type { WorkoutLog } from '@/db/types'

export const SAVED_KEY = 'saved:workouts'

export interface SavedWorkout {
  id: string
  title: string
  savedAt: string
  /** working sets only: what to aim for next time */
  exercises: { exerciseId: string; sets: { targetReps: [number, number]; weightKg?: number; timeSec?: number }[] }[]
}

export async function savedWorkouts(): Promise<SavedWorkout[]> {
  return getSetting<SavedWorkout[]>(SAVED_KEY, [])
}

/** keep a finished (or planned) session as a template; returns the saved copy */
export async function saveWorkoutTemplate(log: WorkoutLog, title?: string): Promise<SavedWorkout> {
  const t: SavedWorkout = {
    id: newId(),
    title: (title ?? log.title ?? 'My workout').trim() || 'My workout',
    savedAt: nowIso(),
    exercises: log.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets.filter((s) => !s.warmup).map((s) => ({
        targetReps: s.targetReps ?? [8, 12],
        weightKg: s.weightKg,
        timeSec: s.timeSec,
      })),
    })).filter((e) => e.sets.length > 0),
  }
  await setSetting(SAVED_KEY, [t, ...(await savedWorkouts())].slice(0, 100))
  return t
}

export async function deleteSavedWorkout(id: string): Promise<void> {
  await setSetting(SAVED_KEY, (await savedWorkouts()).filter((w) => w.id !== id))
}

/** start a saved template as today's session; returns the new log id */
export async function startSavedWorkout(t: SavedWorkout): Promise<string> {
  const log: WorkoutLog = {
    id: newId(),
    date: todayStr(),
    title: t.title,
    startedAt: nowIso(),
    exercises: t.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets.map((s, i) => ({ setIndex: i, targetReps: s.targetReps, weightKg: s.weightKg, timeSec: s.timeSec, done: false })),
    })),
  }
  await db.workoutLogs.add(log)
  return log.id
}
