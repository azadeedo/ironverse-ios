import { describe, expect, it } from 'vitest'
import { getProfile } from '@/db'
import { seedNeutralProfile } from '@/db/seed'
import { applyFirstRun, emptyDraft } from '@/lib/firstRun'
import { builtInProfiles, isAvailable } from '@/lib/equipment'
import { generatePlan } from '@/lib/plangen'
import { byId } from '@/data/exercises'

async function profile() {
  if (!(await getProfile())) await seedNeutralProfile()
  const d = emptyDraft()
  Object.assign(d, { name: 'T', age: 30, heightCm: 178, weightKg: 80, experience: 'intermediate', goals: ['strength'], daysPerWeek: 4, sessionMinutes: 60, location: 'home', style: 'general' })
  await applyFirstRun(d)
  return (await getProfile())!
}

describe('program length', () => {
  it('builds 1, 2, 6 and 12-week programs; the default stays 5', async () => {
    const p = await profile()
    expect(generatePlan(p).weeks).toHaveLength(5)
    for (const n of [1, 2, 6, 12]) {
      const plan = generatePlan(p, { weeks: n })
      expect(plan.weeks, `${n} weeks`).toHaveLength(n)
      expect(plan.name).toMatch(new RegExp(`^${n}-Week`))
      expect(plan.weeks.map((w) => w.index)).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    }
  })

  it('block 2 is heavier than block 1 on loaded lifts', async () => {
    const p = await profile()
    const plan = generatePlan(p, { weeks: 12 })
    const w1 = plan.weeks[0].days[0].exercises.find((x) => x.weightKg)
    const w6 = plan.weeks[5].days[0].exercises.find((x) => x.exerciseId === w1?.exerciseId)
    expect(w1 && w6 && w6.weightKg! >= w1.weightKg!).toBe(true)
  })

  it('a home program only uses what the home kit has', async () => {
    const p = await profile()
    const home = builtInProfiles(p).find((e) => e.id === 'home')!
    const plan = generatePlan(p, { equipment: home, weeks: 6 })
    for (const w of plan.weeks) for (const d of w.days) for (const px of d.exercises) {
      const ex = byId.get(px.exerciseId)!
      expect(isAvailable(ex, home), ex.id).toBe(true)
    }
  })
})
