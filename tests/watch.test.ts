import { describe, expect, it } from 'vitest'
import { db, getProfile } from '@/db'
import { seedNeutralProfile } from '@/db/seed'
import { applyWatchAction, buildSnapshot } from '@/native/watch'
import { todayStr } from '@/lib/id'

describe('Apple Watch link', () => {
  it('water and creatine from the Watch are logged once, even if resent', async () => {
    if (!(await getProfile())) await seedNeutralProfile()
    const before = (await db.waterLog.where('date').equals(todayStr()).toArray()).reduce((s, w) => s + w.ml, 0)
    const a = { type: 'water', ml: 250, id: 'w-1', at: new Date().toISOString() }
    expect(await applyWatchAction(a)).toBe(true)
    expect(await applyWatchAction(a)).toBe(true) // resend
    const after = (await db.waterLog.where('date').equals(todayStr()).toArray()).reduce((s, w) => s + w.ml, 0)
    expect(after - before).toBe(250)
    await applyWatchAction({ type: 'creatine', id: 'c-1' })
    expect((await buildSnapshot()).creatineTaken).toBe(true)
  })

  it('a set done on the Watch is saved to the open workout', async () => {
    await db.workoutLogs.put({ id: 'log-w', date: todayStr(), title: 'Upper', startedAt: new Date().toISOString(),
      exercises: [{ exerciseId: 'barbell-bench-press', sets: [{ setIndex: 0, targetReps: [6, 8], weightKg: 60, done: false }, { setIndex: 1, targetReps: [6, 8], weightKg: 60, done: false }] }] })
    const snap = await buildSnapshot()
    expect(snap.workout?.logId).toBe('log-w')
    expect(snap.workout?.exercises[0].name).toMatch(/Bench/)
    expect(await applyWatchAction({ type: 'setDone', id: 's-1', logId: 'log-w', ex: 0, set: 1, reps: 7, kg: 62.5 })).toBe(true)
    const s = (await db.workoutLogs.get('log-w'))!.exercises[0].sets[1]
    expect(s).toMatchObject({ done: true, reps: 7, weightKg: 62.5 })
    expect(await applyWatchAction({ type: 'setDone', id: 's-2', logId: 'nope', ex: 0, set: 0 })).toBe(false)
  })
})
