// The 12-week program must become the ACTIVE plan on a phone that still has an
// old generated plan active (owner's report 2026-10-08: "still old exercises,
// still rowing machine"). Runs against a real (fake-indexeddb) database.
import { describe, expect, it } from 'vitest'
import { db } from '@/db'
import { ensureProgramActive, fixSeedProfileOnce } from '@/lib/programStore'
import type { Plan, Profile } from '@/db/types'

const oldPlan: Plan = {
  id: 'old', name: '12-Week Evidence-Based U/L', startDate: '2026-09-01', trainingWeekdays: [1, 3, 5], active: true, createdAt: '2026-09-01T00:00:00Z',
  weeks: [{ index: 1, label: 'W1', days: [{ id: 'd', title: 'Upper', focus: [], estMinutes: 60, estCalories: 0, exercises: [{ exerciseId: 'rowing-machine', sets: 1, reps: [1, 1], restSec: 0 }] }] }],
}

describe('program activation on an existing phone', () => {
  it('switches the old plan off (kept) and makes the 12-week program active for this week', async () => {
    await db.open()
    await db.plans.clear(); await db.settings.clear()
    await db.profile.put({ id: 'me', name: 'N', sex: 'male', birthYear: 2001, heightCm: 180, weightKg: 98.3, goal: 'lose-fat', activityLevel: 'light', calorieTarget: 2956, proteinTarget: 192 } as unknown as Profile)
    await db.plans.put(oldPlan)
    const r = await ensureProgramActive('2026-10-08')
    expect(r).toBe('created')
    const plans = await db.plans.toArray()
    const p12 = plans.find((p) => p.program === 'p12')!
    expect(p12.active).toBe(true)
    expect(p12.programStart).toBe('2026-10-06')
    expect(plans.find((p) => p.id === 'old')!.active).toBe(false)
    expect(p12.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))).not.toContain('rowing-machine')
    // runs once: a later deliberate pause is respected
    await db.plans.put({ ...p12, active: false })
    expect(await ensureProgramActive('2026-10-09')).toBe('skipped')
  })
  it('replaces the seeded guesses and the above-maintenance 2,956 kcal target', async () => {
    const msg = await fixSeedProfileOnce()
    const me = (await db.profile.get('me'))!
    expect(me.heightCm).toBe(169); expect(me.birthYear).toBe(2000)
    expect(me.calorieTarget).toBeLessThan(2600); expect(me.calorieTarget).toBeGreaterThan(2200)
    expect(msg).toMatch(/kcal/)
    expect(await fixSeedProfileOnce()).toBeNull()
  })
})
