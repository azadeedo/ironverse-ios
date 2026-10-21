// The App Store build: neutral first run, first-time setup, 1RM estimates,
// and backups (integrity + round-trip + "never overwrite imported data").
import { beforeEach, describe, expect, it } from 'vitest'

;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'ios'

async function fresh() {
  const { db } = await import('@/db')
  await db.delete()
  await db.open()
  return db
}

describe('App Store edition — first launch', () => {
  beforeEach(async () => { await fresh() })

  it('seeds a neutral, not-onboarded profile — never the owner’s personal data', async () => {
    const { seedIfNeeded } = await import('@/db/seed')
    const { db } = await import('@/db')
    await seedIfNeeded()
    const me = await db.profile.get('me')
    expect(me?.onboarded).toBe(false)
    expect(me?.name).toBe('')
    expect(me?.weightKg).not.toBe(98.3)
    expect(await db.weighIns.count()).toBe(0)
    expect(await db.measurements.count()).toBe(0)
    const { needsFirstRun } = await import('@/lib/firstRun')
    expect(await needsFirstRun()).toBe(true)
  })

  it('web edition still seeds exactly as before', async () => {
    ;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'web'
    try {
      const { seedIfNeeded } = await import('@/db/seed')
      const { db } = await import('@/db')
      await seedIfNeeded()
      const me = await db.profile.get('me')
      expect(me?.name).toBe('Nouri')
      expect(me?.weightKg).toBe(98.3)
      expect(await db.weighIns.count()).toBe(1)
    } finally {
      ;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'ios'
    }
  })
})

describe('one-rep max estimate', () => {
  it('uses Epley and refuses sets over 12 reps', async () => {
    const { estimateOneRm, liftOneRm } = await import('@/lib/firstRun')
    expect(estimateOneRm(100, 5)).toBeCloseTo(116.7, 1)
    expect(estimateOneRm(100, 1)).toBe(100)
    expect(estimateOneRm(60, 15)).toBeNull()
    expect(estimateOneRm(undefined, 5)).toBeNull()
    expect(liftOneRm({ mode: 'known', oneRmKg: 140 })).toBe(140)
    expect(liftOneRm({ mode: 'later' })).toBeNull()
  })
  it('converts units both ways', async () => {
    const { kgToLb, lbToKg, cmToFtIn, ftInToCm } = await import('@/lib/firstRun')
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 6)
    expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 })
    expect(ftInToCm(5, 11)).toBeCloseTo(180.3, 1)
  })
})

describe('first-time setup', () => {
  beforeEach(async () => { await fresh() })

  it('resumes a saved draft and applies answers to the existing engines', async () => {
    const { seedIfNeeded } = await import('@/db/seed')
    const { db, getSetting } = await import('@/db')
    const fr = await import('@/lib/firstRun')
    await seedIfNeeded()
    const d = fr.emptyDraft()
    d.step = 3; d.name = 'Sam'; d.age = 28; d.heightCm = 170; d.weightKg = 72; d.goals = ['fat-loss', 'strength']
    d.lifts.squat = { mode: 'estimate', weightKg: 100, reps: 5 }
    d.lifts.bench = { mode: 'known', oneRmKg: 90 }
    d.location = 'home'; d.homeEquipment = ['dumbbells', 'bench']; d.daysPerWeek = 3
    await fr.saveDraft(d)
    const back = await fr.loadDraft()
    expect(back?.step).toBe(3)
    expect(back?.lifts.squat.reps).toBe(5)

    const r = await fr.applyFirstRun(back!)
    expect(r.planKind).toBe('generated')
    const me = await db.profile.get('me')
    expect(me?.onboarded).toBe(true)
    expect(me?.name).toBe('Sam')
    expect(me?.goal).toBe('lose-fat')
    expect(me?.equipmentProfileId).toBe('home')
    expect(await db.weighIns.count()).toBe(1)
    const home = await db.equipmentProfiles.get('home')
    expect(home?.equipment).toEqual(expect.arrayContaining(['bodyweight', 'dumbbell', 'bench']))
    const setup = await getSetting<Record<string, unknown>>('p12:setup', {})
    expect(setup.benchPR).toBe(90)
    expect(setup.squat).toMatchObject({ kg: 100, reps: 5 })
    // a set over 12 reps is not used as a baseline
    const d2 = fr.emptyDraft(); d2.lifts.deadlift = { mode: 'estimate', weightKg: 100, reps: 20 }
    await fr.applyFirstRun({ ...d2, prefilledFromBackup: true })
    expect((await getSetting<Record<string, unknown>>('p12:setup', {})).deadlift).toBeUndefined()
    const plans = await db.plans.toArray()
    expect(plans.filter((p) => p.active)).toHaveLength(1)
    await fr.finishFirstRun()
    expect(await fr.needsFirstRun()).toBe(false)
  })

  it('skipped answers keep the current value and never invent a weigh-in', async () => {
    const { seedIfNeeded } = await import('@/db/seed')
    const { db } = await import('@/db')
    const fr = await import('@/lib/firstRun')
    await seedIfNeeded()
    const before = await db.profile.get('me')
    await fr.applyFirstRun(fr.emptyDraft())
    const me = await db.profile.get('me')
    expect(me?.heightCm).toBe(before?.heightCm)
    expect(await db.weighIns.count()).toBe(0)
  })

  it('a restored, already set-up profile skips setup and is never overwritten', async () => {
    const { db } = await import('@/db')
    const fr = await import('@/lib/firstRun')
    await db.profile.put({ id: 'me', name: 'Owner', sex: 'male', birthYear: 2000, heightCm: 169, weightKg: 97, goal: 'lose-fat', activityLevel: 'moderate', experience: 'intermediate', daysPerWeek: 4, sessionMinutes: 60, workSchedule: [], preferredSlot: 'auto', calorieTarget: 1850, proteinTarget: 190, waterTargetMl: 3500, creatineGrams: 5, barbellKg: 20, curlBarKg: 10, smithBarKg: 15, platePairsKg: [5], stackStepsKg: [6], onboarded: true, createdAt: 'x', updatedAt: 'x' })
    await db.weighIns.add({ id: 'w', date: '2026-10-01', weightKg: 97 })
    await db.plans.put({ id: 'kept', name: 'My plan', active: true, createdAt: 'x', days: [] } as never)
    expect(await fr.needsFirstRun()).toBe(false)
    // re-running setup later prefills from the data and keeps the plan
    const d = await fr.draftFromExisting()
    expect(d.prefilledFromBackup).toBe(true)
    expect(d.weightKg).toBe(97)
    const r = await fr.applyFirstRun(d)
    expect(r.planKind).toBe('kept')
    expect((await db.plans.get('kept'))?.active).toBe(true)
    expect((await db.profile.get('me'))?.calorieTarget).toBeGreaterThan(0)
  })
})

describe('backups', () => {
  beforeEach(async () => { await fresh() })

  it('round-trips every table with a verified checksum', async () => {
    const { seedIfNeeded } = await import('@/db/seed')
    const { db } = await import('@/db')
    const b = await import('@/lib/backup')
    await seedIfNeeded()
    await db.weighIns.add({ id: 'w1', date: '2026-10-01', weightKg: 81.4 })
    await db.workoutLogs.put({ id: 'l1', date: '2026-10-02', title: 'Push', startedAt: 'a', exercises: [{ exerciseId: 'bench', sets: [{ setIndex: 0, targetReps: [6, 8], weightKg: 80, reps: 7, done: true }] }] } as never)
    await db.foodLog.put({ id: 'f1', date: '2026-10-02', meal: 'lunch', name: 'Rice', grams: 200, kcal: 260, protein: 5, carbs: 56, fat: 1, createdAt: 'a' } as never)
    await db.progressPhotos.put({ id: 'p1', date: '2026-10-01', pose: 'front', blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }), createdAt: 'a' } as never)
    const file = await b.exportBackup()
    const info = await b.inspectBackup(file)
    expect(info.integrity).toBe('verified')
    expect(info.payload.edition).toBe('ios')
    expect(info.payload.schema).toBe(db.verno)

    for (const t of db.tables) if (t.name !== 'snapshots') await t.clear()
    expect(await db.weighIns.count()).toBe(0)
    await b.restoreFromPayload(info.payload, 'replace')
    expect((await db.weighIns.get('w1'))?.weightKg).toBe(81.4)
    expect((await db.workoutLogs.get('l1'))?.exercises[0].sets[0].reps).toBe(7)
    const photo = (await db.progressPhotos.get('p1')) as unknown as { blob: Blob }
    expect([...new Uint8Array(await photo.blob.arrayBuffer())]).toEqual([1, 2, 3, 250])
    // a pre-restore snapshot was taken so the restore itself is undoable
    expect((await db.snapshots.toArray()).some((s) => s.reason === 'pre-restore')).toBe(true)
  })

  it('rejects a tampered or truncated file and imports nothing', async () => {
    const { seedIfNeeded } = await import('@/db/seed')
    const { db } = await import('@/db')
    const b = await import('@/lib/backup')
    await seedIfNeeded()
    await db.weighIns.add({ id: 'w1', date: '2026-10-01', weightKg: 81.4 })
    const json = JSON.parse(await (await b.exportBackup()).text())
    json.tables.weighIns[0].weightKg = 50
    await expect(b.inspectBackup(new Blob([JSON.stringify(json)]))).rejects.toThrow(/damaged/)
    const cut = JSON.parse(await (await b.exportBackup()).text())
    cut.tables.weighIns = []
    await expect(b.inspectBackup(new Blob([JSON.stringify(cut)]))).rejects.toThrow(/damaged/)
  })

  it('still accepts an older web backup with no checksum (existing users)', async () => {
    const b = await import('@/lib/backup')
    const legacy = { format: 'ironverse-backup', version: 2, exportedAt: '2026-10-01T00:00:00Z', counts: { weighIns: 1 }, tables: { weighIns: [{ id: 'old', date: '2026-09-01', weightKg: 99 }] } }
    const info = await b.inspectBackup(new Blob([JSON.stringify(legacy)]))
    expect(info.integrity).toBe('unchecked')
    const { db } = await import('@/db')
    await b.restoreFromPayload(info.payload, 'merge')
    expect((await db.weighIns.get('old'))?.weightKg).toBe(99)
  })

  it('merge never destroys newer local rows', async () => {
    const { db } = await import('@/db')
    const b = await import('@/lib/backup')
    await db.foods.put({ id: 'x', name: 'Mine', kcal: 100, protein: 1, carbs: 1, fat: 1, custom: true, updatedAt: '2026-10-20' } as never)
    const payload = { format: 'ironverse-backup', version: 2, exportedAt: 'a', counts: { foods: 1 }, tables: { foods: [{ id: 'x', name: 'Old', kcal: 1, protein: 1, carbs: 1, fat: 1, updatedAt: '2026-01-01' }] } }
    await b.restoreFromPayload(payload, 'merge')
    expect((await db.foods.get('x'))?.name).toBe('Mine')
  })
})

describe('goal coach in the App Store build', () => {
  beforeEach(async () => { await fresh() })
  it('uses the user’s own goal, a safe date, and never auto-changes calories by default', async () => {
    const { db } = await import('@/db')
    const { seedIfNeeded } = await import('@/db/seed')
    const ct = await import('@/lib/calorieTarget')
    await seedIfNeeded()
    const me = await db.profile.get('me')
    await db.profile.put({ ...me!, weightKg: 90, goalWeightKg: 80, onboarded: true })
    const g = await ct.goalSettings()
    expect(g.kg).toBe(80)
    expect(g.auto).toBe(false)
    expect(g.date).not.toBe('2027-01-14')
    expect(await ct.runGoalAutoAdjust()).toBeNull()
    expect((await db.profile.get('me'))?.calorieTarget).toBe(me!.calorieTarget)
  })
})
