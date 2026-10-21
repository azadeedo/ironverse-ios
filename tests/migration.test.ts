// Builds a real v2 'iron-verse' database exactly as the live app has it, fills it
// with realistic rows, then runs the pre-upgrade backup and opens the app's v3
// schema on top. Every row must survive byte-for-byte.
import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { backupBeforeUpgrade, getPreUpgradeDump, listPreUpgradeDumps } from '@/lib/migrate'

const V1 = {
  profile: 'id', plans: 'id, active, createdAt', workoutLogs: 'id, date, planId', foods: 'id, name, custom, favourite, useCount',
  foodLog: 'id, date, meal, createdAt', weighIns: 'id, date', measurements: 'id, date', waterLog: 'id, date',
  creatineLog: 'id, date', cardioLog: 'id, date, kind', reminders: 'id', settings: 'key',
}
const V2 = {
  snapshots: 'id, createdAt, date', equipmentProfiles: 'id, name', recipes: 'id, name, useCount', progressPhotos: 'id, date, pose',
  exerciseMeta: 'exerciseId, injured', barcodeCache: 'barcode, fetchedAt', dayAdjust: 'date, sourceDate', programOverrides: 'id, date, scope, coach',
}

async function makeV2() {
  const old = new Dexie('iron-verse')
  old.version(1).stores(V1)
  old.version(2).stores(V2)
  await old.open()
  await old.table('profile').put({ id: 'me', name: 'Nouri', weightKg: 98.3, heightCm: 180, goal: 'lose-fat', onboarded: true })
  await old.table('weighIns').bulkPut([{ id: 'w1', date: '2026-09-01', weightKg: 98.3 }, { id: 'w2', date: '2026-10-01', weightKg: 97.1 }])
  await old.table('workoutLogs').put({
    id: 'log1', date: '2026-09-20', title: 'Lower', startedAt: '2026-09-20T10:00:00Z', finishedAt: '2026-09-20T11:00:00Z',
    exercises: [{ exerciseId: 'barbell-squat', sets: [{ setIndex: 0, targetReps: [6, 8], weightKg: 100, reps: 8, done: true, rir: 2 }] }],
  })
  await old.table('foodLog').put({ id: 'f1', date: '2026-10-01', meal: 'lunch', name: 'Chicken', grams: 200, kcal: 330, protein: 62, carbs: 0, fat: 7, createdAt: '2026-10-01T12:00:00Z' })
  await old.table('foods').put({ id: 'custom1', name: 'Mum\'s lentil soup', kcal: 90, protein: 6, carbs: 12, fat: 2, custom: true, favourite: true })
  await old.table('cardioLog').put({ id: 'c1', date: '2026-10-02', kind: 'walk', seconds: 1800, createdAt: '2026-10-02T08:00:00Z' })
  await old.table('settings').put({ key: 'seeded:v1', value: true })
  await old.table('exerciseMeta').put({ exerciseId: 'barbell-squat', note: 'knee ok', updatedAt: '2026-09-01' })
  await old.table('progressPhotos').put({ id: 'p1', date: '2026-09-01', pose: 'front', blob: 'binary-placeholder', createdAt: '2026-09-01' })
  old.close()
}

describe('v2 → v3 database upgrade', () => {
  it('backs up every table first, then upgrades without losing a single row', async () => {
    await makeV2()
    const dump = await backupBeforeUpgrade()
    expect(dump).not.toBeNull()
    expect(dump!.fromVersion).toBe(20)
    expect(dump!.counts.workoutLogs).toBe(1)
    expect(dump!.counts.weighIns).toBe(2)
    expect((await listPreUpgradeDumps()).length).toBe(1)
    expect((await getPreUpgradeDump(dump!.id))!.data.profile).toHaveLength(1)

    const { db } = await import('@/db')
    await db.open()
    expect(db.verno).toBe(3)
    expect((await db.profile.get('me'))!.weightKg).toBe(98.3)
    expect(await db.weighIns.count()).toBe(2)
    const log = await db.workoutLogs.get('log1')
    expect(log!.exercises[0].sets[0]).toMatchObject({ weightKg: 100, reps: 8, rir: 2 })
    expect((await db.foods.get('custom1'))!.favourite).toBe(true)
    expect(await db.foodLog.count()).toBe(1)
    expect(await db.cardioLog.count()).toBe(1)
    expect((await db.exerciseMeta.get('barbell-squat'))!.note).toBe('knee ok')
    expect(await db.progressPhotos.count()).toBe(1)
    // new v3 tables exist and are empty
    expect(await db.customExercises.count()).toBe(0)
    expect(await db.checkins.count()).toBe(0)
    // a second run is a no-op (already on v3)
    db.close()
    expect(await backupBeforeUpgrade()).toBeNull()
  })
})
