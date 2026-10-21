// Energy maths: BMR/TDEE, targets, deficit detection, adaptive TDEE from
// real weight trend + logged intake.

import type { Profile, WeighIn } from '@/db/types'

export function ageOf(profile: Profile): number {
  return new Date().getFullYear() - profile.birthYear
}

/** Mifflin-St Jeor BMR (kcal) */
export function bmr(p: Profile, weightKg = p.weightKg): number {
  const base = 10 * weightKg + 6.25 * p.heightCm - 5 * ageOf(p)
  return Math.round(p.sex === 'male' ? base + 5 : base - 161)
}

const ACTIVITY_MULT: Record<Profile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

/** baseline TDEE from formula (kcal/day) */
export function tdeeFormula(p: Profile, weightKg = p.weightKg): number {
  return Math.round(bmr(p, weightKg) * ACTIVITY_MULT[p.activityLevel])
}

/** recommended daily targets for the goal */
export function recommendedTargets(p: Profile): { calories: number; protein: number } {
  const tdee = tdeeFormula(p)
  const calories =
    p.goal === 'lose-fat' ? Math.round(tdee - 500)
    : p.goal === 'build-muscle' ? Math.round(tdee + 250)
    : Math.round(tdee - 200) // recomp: slight deficit
  // protein: 2g/kg for cut/recomp, 1.8 for bulk
  const protein = Math.round(p.weightKg * (p.goal === 'build-muscle' ? 1.8 : 2.0))
  return { calories, protein }
}

export interface DeficitDay {
  date: string
  intake: number | null   // null = nothing logged that day
  burn: number            // TDEE estimate (+ logged exercise already inside TDEE mult; keep simple)
  deficit: number | null  // burn - intake
}

/**
 * ADAPTIVE TDEE — the "deficit detector".
 * Uses logged intake + actual weight change over a window:
 * trueTDEE ≈ avgIntake + (kgLost * 7700 / days).
 * Returns null when there isn't enough data (needs ≥7 logged days and ≥2 weigh-ins ≥7 days apart).
 */
export function adaptiveTdee(
  weighIns: WeighIn[],
  dailyIntake: Map<string, number>, // date -> kcal (only days with logs)
  windowDays = 21,
): { tdee: number; kgPerWeek: number; daysUsed: number; avgIntake: number } | null {
  if (weighIns.length < 2) return null
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const end = sorted[sorted.length - 1]
  const endTime = new Date(end.date).getTime()
  const startCandidates = sorted.filter((w) => {
    const d = (endTime - new Date(w.date).getTime()) / 86400000
    return d >= 7 && d <= windowDays
  })
  if (startCandidates.length === 0) return null
  const start = startCandidates[0]
  const days = Math.round((endTime - new Date(start.date).getTime()) / 86400000)
  // intake over the same window
  const intakes: number[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(new Date(start.date).getTime() + i * 86400000)
    const key = d.toISOString().slice(0, 10)
    const v = dailyIntake.get(key)
    if (v && v > 500) intakes.push(v) // ignore obviously incomplete days
  }
  if (intakes.length < Math.min(7, days * 0.5)) return null
  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length
  const kgChange = end.weightKg - start.weightKg // negative = lost
  const dailyImbalance = (kgChange * 7700) / days // kcal/day surplus(+)/deficit(-)
  const tdee = Math.round(avgIntake - dailyImbalance)
  return {
    tdee,
    kgPerWeek: Math.round((kgChange / days) * 7 * 100) / 100,
    daysUsed: days,
    avgIntake: Math.round(avgIntake),
  }
}

/**
 * Why the deficit detector is still locked — the exact unmet condition, using the
 * same rules as adaptiveTdee (two weigh-ins 7–21 days apart, and food logged
 * (>500 kcal) on at least min(7, half the days) BETWEEN them).
 */
export function deficitReadiness(weighIns: WeighIn[], intake: Map<string, number>): { ready: boolean; missing: string | null } {
  if (adaptiveTdee(weighIns, intake)) return { ready: true, missing: null }
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return { ready: false, missing: `${2 - sorted.length} more weigh-in${sorted.length === 1 ? '' : 's'}, at least 7 days apart.` }
  const end = sorted[sorted.length - 1]
  const dd = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
  const inWindow = sorted.filter((w) => { const d = dd(w.date, end.date); return d >= 7 && d <= 21 })
  if (!inWindow.length) {
    const first = sorted[0], gap = dd(first.date, end.date)
    if (gap < 7) {
      const when = new Date(new Date(first.date).getTime() + 7 * 86400000).toISOString().slice(0, 10)
      return { ready: false, missing: `Your weigh-ins span only ${gap} day${gap === 1 ? '' : 's'} (${first.date} → ${end.date}). Weigh in again on or after ${when} so they are at least 7 days apart.` }
    }
    return { ready: false, missing: 'Your latest weigh-in has no earlier weigh-in 7–21 days before it. Weigh in a couple of times this week to restart the window.' }
  }
  const start = inWindow[0], days = dd(start.date, end.date)
  let logged = 0
  for (let i = 0; i < days; i++) { const k = new Date(new Date(start.date).getTime() + i * 86400000).toISOString().slice(0, 10); if ((intake.get(k) ?? 0) > 500) logged++ }
  const need = Math.ceil(Math.min(7, days * 0.5))
  return { ready: false, missing: `Food logged on ${logged} of the ${days} days between your weigh-ins (${start.date} → ${end.date}); ${need} needed. Days under 500 kcal count as incomplete.` }
}

/** projected weekly change at a given intake vs tdee */
export function projectedKgPerWeek(intake: number, tdee: number): number {
  return Math.round(((intake - tdee) * 7 / 7700) * 100) / 100
}

/** simple smoothed weight trend (EMA over weigh-ins) */
export function weightTrend(weighIns: WeighIn[], alpha = 0.25): { date: string; raw: number; trend: number }[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  let ema: number | null = null
  return sorted.map((w) => {
    ema = ema === null ? w.weightKg : ema + alpha * (w.weightKg - ema)
    return { date: w.date, raw: w.weightKg, trend: Math.round(ema * 100) / 100 }
  })
}

/** calories for cardio via MET: kcal = MET * kg * hours */
export function metCalories(met: number, weightKg: number, seconds: number): number {
  return Math.round((met * weightKg * seconds) / 3600)
}

export const MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 } as const
