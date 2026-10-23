import { describe, expect, it } from 'vitest'
import { db } from '@/db'
import { deleteSavedWorkout, saveWorkoutTemplate, savedWorkouts, startSavedWorkout } from '@/lib/saved'

describe('saved workouts', () => {
  it('save a finished workout, start it again, delete it', async () => {
    const t = await saveWorkoutTemplate({ id: 'l1', date: '2026-10-20', title: 'Push day', startedAt: '2026-10-20T07:00:00Z', finishedAt: '2026-10-20T08:00:00Z',
      exercises: [{ exerciseId: 'barbell-bench-press', sets: [{ setIndex: 0, targetReps: [5, 5], weightKg: 40, done: true, warmup: true }, { setIndex: 1, targetReps: [6, 8], weightKg: 80, reps: 8, done: true }] }] })
    expect(t.exercises[0].sets).toEqual([{ targetReps: [6, 8], weightKg: 80, timeSec: undefined }])
    expect((await savedWorkouts())[0].title).toBe('Push day')
    const id = await startSavedWorkout(t)
    const log = await db.workoutLogs.get(id)
    expect(log?.finishedAt).toBeUndefined()
    expect(log?.exercises[0].sets[0]).toMatchObject({ weightKg: 80, done: false })
    await deleteSavedWorkout(t.id)
    expect((await savedWorkouts()).find((w) => w.id === t.id)).toBeUndefined()
  })
})
