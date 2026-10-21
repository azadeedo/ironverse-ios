import { describe, expect, it } from 'vitest'
import { bestKmPace, computeGoalPlan, nextTarget, runPlan } from '@/lib/goalCoach'
import type { CardioLog, Profile, WeighIn } from '@/db/types'

const me = { sex: 'male', heightCm: 180, weightKg: 95, birthYear: 1994, activityLevel: 'moderate', calorieTarget: 1850, goal: 'lose-fat' } as unknown as Profile
const wi = (date: string, kg: number): WeighIn => ({ id: date, date, weightKg: kg })

describe('goal coach: 85 kg by 14 Jan', () => {
  it('works out a daily target from the 7-day average and the days left', () => {
    const p = computeGoalPlan(me, [wi('2026-10-19', 92.4), wi('2026-10-20', 92.0), wi('2026-10-21', 91.8)], new Map(), '2026-10-21', 85, '2027-01-14')
    expect(p.current).toBe(92.1)
    expect(p.daysLeft).toBe(85)
    expect(p.kgToGo).toBe(7.1)
    expect(p.neededKgPerWeek).toBeCloseTo(0.58, 1)
    expect(p.intake).toBeGreaterThanOrEqual(1500)
    expect(p.intake % 25).toBe(0)
    expect(p.onTrack === 'on-track' || p.onTrack === 'needs-movement').toBe(true)
  })
  it('never goes below 1,500 and says the honest date when the goal is too fast', () => {
    const p = computeGoalPlan(me, [wi('2026-12-30', 95)], new Map(), '2026-12-31', 85, '2027-01-14')
    expect(p.onTrack).toBe('too-fast')
    expect(p.intake).toBeGreaterThanOrEqual(1500)
    expect(p.projectedDate! > '2027-01-14').toBe(true)
  })
  it('moves the target at most 150 kcal a day, both ways', () => {
    const p = computeGoalPlan(me, [wi('2026-10-21', 92)], new Map(), '2026-10-21', 85, '2027-01-14')
    expect(nextTarget(2400, { ...p, intake: 1900 })).toBe(2250)
    expect(nextTarget(1600, { ...p, intake: 1900 })).toBe(1600) // no raise during a cut without proof from the scale
    expect(nextTarget(1600, { ...p, intake: 1900, allowRaise: true })).toBe(1750)
    expect(nextTarget(1900, { ...p, intake: 1910 })).toBe(1900)
  })
})

describe('4:00 km', () => {
  it('finds the best 1 km pace and plans the next milestone', () => {
    const runs = [{ kind: 'run', seconds: 330, distanceKm: 1 }, { kind: 'run', seconds: 1500, distanceKm: 5 }, { kind: 'walk', seconds: 200, distanceKm: 1 }] as CardioLog[]
    expect(bestKmPace(runs)).toBe(300)
    const r = runPlan(300)
    expect(r.gap).toBe(60); expect(r.next).toBe(290); expect(r.sessions.length).toBe(4)
  })
})

describe('raises only when the scale proves he is losing too fast', () => {
  it('two weeks of fast loss allows a raise; otherwise calories only go down', () => {
    const fast = [wi('2026-10-08', 97), wi('2026-10-10', 96.8), wi('2026-10-16', 95.4), wi('2026-10-20', 95.2)]
    const p = computeGoalPlan(me, fast, new Map(), '2026-10-21', 85, '2027-01-14')
    expect(p.actualKgPerWeek).toBeCloseTo(1.6, 1)
    expect(p.allowRaise).toBe(true)
    const slow = computeGoalPlan(me, [wi('2026-10-21', 95)], new Map(), '2026-10-21', 85, '2027-01-14')
    expect(slow.allowRaise).toBe(false)
  })
})
