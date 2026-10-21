// ============================================================
// GOAL COACH — "85 kg by 14 January".
//
// He asked for the calorie target to follow the goal on its own, every day, up or
// down — not a suggestion every two weeks. So:
//   • the daily target = estimated burn − the deficit the goal needs
//   • it is re-worked every day from the weigh-ins (7-day average, not one day)
//   • a change is applied automatically and shown with Undo (never silent)
// Hard safety rails stay, and are said out loud when they bite:
//   • never below 1,500 kcal (man) / 1,200 (woman) without a doctor
//   • never aiming to lose more than 1% of bodyweight a week (muscle loss, gallstones)
// When the date needs more than that, the rest becomes MOVEMENT (walk minutes),
// and if even that can't close it, the app says the honest projected date.
// ============================================================
import dayjs from 'dayjs'
import type { CardioLog, Profile, WeighIn } from '@/db/types'
import { adaptiveTdee, metCalories, tdeeFormula } from './nutrition'
import { ed } from './edition'

export const DEFAULT_GOAL_DATE = '2027-01-14'
export const KCAL_PER_KG = 7700
export const MAX_DAILY_STEP = 150

export function goalFloor(p: Pick<Profile, 'sex'>): number {
  return p.sex === 'female' ? 1200 : 1500
}

/** 7-day average of weigh-ins ending today (falls back to the latest weigh-in, then the profile) */
export function currentWeight(weighIns: WeighIn[], today: string, fallback: number): number {
  const recent = weighIns.filter((w) => { const d = dayjs(today).diff(dayjs(w.date), 'day'); return d >= 0 && d < 7 })
  if (recent.length) return Math.round((recent.reduce((a, w) => a + w.weightKg, 0) / recent.length) * 10) / 10
  const latest = [...weighIns].sort((a, b) => b.date.localeCompare(a.date))[0]
  return latest ? latest.weightKg : fallback
}

export interface GoalPlan {
  current: number
  goal: number
  date: string
  daysLeft: number
  kgToGo: number
  neededKgPerWeek: number
  safeKgPerWeek: number
  tdee: number
  tdeeSource: 'measured' | 'formula'
  floor: number
  /** the daily calorie target to set */
  intake: number
  /** extra movement a day (kcal) on top of the intake deficit to stay on the date */
  moveKcal: number
  /** brisk-walk minutes that burn moveKcal */
  walkMin: number
  onTrack: 'on-track' | 'needs-movement' | 'too-fast' | 'done'
  /** when the goal lands at the safe pace if the date is out of reach */
  projectedDate?: string
  /** real loss over the last ~2 weeks of weigh-ins (kg/week, positive = losing), when known */
  actualKgPerWeek: number | null
  /** calories may only go UP when he is genuinely losing too fast (measured), or the goal is reached */
  allowRaise: boolean
  summary: string
}

export function computeGoalPlan(
  p: Profile,
  weighIns: WeighIn[],
  intakeByDay: Map<string, number>,
  today: string,
  goalKg: number,
  goalDate: string,
): GoalPlan {
  const current = currentWeight(weighIns, today, p.weightKg)
  const daysLeft = Math.max(1, dayjs(goalDate).diff(dayjs(today), 'day'))
  const kgToGo = Math.round((current - goalKg) * 10) / 10
  const measured = adaptiveTdee(weighIns, intakeByDay)
  const tdee = measured?.tdee && measured.tdee > 1200 && measured.tdee < 6000 ? measured.tdee : tdeeFormula(p, current)
  const tdeeSource = measured?.tdee && measured.tdee > 1200 && measured.tdee < 6000 ? 'measured' : 'formula'
  const floor = goalFloor(p)
  const safeKgPerWeek = Math.round(current * 0.01 * 100) / 100
  const brisk = metCalories(4.3, current, 60) // kcal per minute of brisk walking
  const actualKgPerWeek = lossRate(weighIns, today)

  if (kgToGo <= 0) {
    const intake = Math.max(floor, Math.round((tdee - 200) / 25) * 25)
    return { current, goal: goalKg, date: goalDate, daysLeft, kgToGo: 0, neededKgPerWeek: 0, safeKgPerWeek, tdee, tdeeSource, floor, intake, moveKcal: 0, walkMin: 0, onTrack: 'done', actualKgPerWeek, allowRaise: true,
      summary: `You are at ${current} kg — goal reached. Holding a small deficit so it sticks.` }
  }

  const neededKgPerWeek = Math.round((kgToGo / daysLeft) * 7 * 100) / 100
  const neededDeficit = (kgToGo * KCAL_PER_KG) / daysLeft
  const maxDeficit = (safeKgPerWeek * KCAL_PER_KG) / 7
  // food gives at most the safe 1%-a-week deficit; the rest of what the date needs is walking (max 60 min a day)
  const foodDeficit = Math.min(neededDeficit, maxDeficit)
  const intake = Math.max(floor, Math.round((tdee - foodDeficit) / 25) * 25)
  const fromFood = Math.max(0, tdee - intake)
  const walkCap = brisk * 60
  let moveKcal = Math.max(0, Math.min(walkCap, Math.round(neededDeficit - fromFood)))
  if (moveKcal < 50) moveKcal = 0
  const walkMin = brisk > 0 ? Math.round(moveKcal / brisk) : 0

  let onTrack: GoalPlan['onTrack'] = 'on-track'
  let projectedDate: string | undefined
  if (neededDeficit > fromFood + moveKcal + 25) {
    onTrack = 'too-fast'
    const days = Math.ceil((kgToGo * KCAL_PER_KG) / Math.max(200, fromFood + moveKcal))
    projectedDate = dayjs(today).add(days, 'day').format('YYYY-MM-DD')
  } else if (moveKcal > 0) onTrack = 'needs-movement'
  const allowRaise = actualKgPerWeek !== null && actualKgPerWeek > safeKgPerWeek

  const when = dayjs(goalDate).format('D MMM')
  const summary = onTrack === 'too-fast'
    ? `${kgToGo} kg in ${daysLeft} days needs ${neededKgPerWeek} kg a week — faster than the safe 1% a week (${safeKgPerWeek} kg). Even with up to 60 min of walking a day you land around ${dayjs(projectedDate).format('D MMM')} — every extra walk brings it closer.`
    : onTrack === 'needs-movement'
      ? `${kgToGo} kg to go by ${when}: stick to today’s calories and walk about ${walkMin} min a day (or anything from the list).`
      : `${kgToGo} kg to go by ${when}: ${neededKgPerWeek} kg a week — stick to today’s calories.`
  return { current, goal: goalKg, date: goalDate, daysLeft, kgToGo, neededKgPerWeek, safeKgPerWeek, tdee, tdeeSource, floor, intake, moveKcal, walkMin, onTrack, projectedDate, actualKgPerWeek, allowRaise, summary }
}

/** loss per week from the average of the last 7 days vs the 7 days before (null without enough weigh-ins) */
export function lossRate(weighIns: WeighIn[], today: string): number | null {
  const avg = (from: number, to: number) => {
    const xs = weighIns.filter((w) => { const d = dayjs(today).diff(dayjs(w.date), 'day'); return d >= from && d < to }).map((w) => w.weightKg)
    return xs.length >= 2 ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  const a = avg(0, 7), b = avg(7, 14)
  return a === null || b === null ? null : Math.round((b - a) * 100) / 100
}

/** today's change, limited to MAX_DAILY_STEP so a noisy weigh-in can't swing it hard */
export function nextTarget(currentTarget: number, plan: GoalPlan): number {
  const diff = plan.intake - currentTarget
  if (Math.abs(diff) < 25) return currentTarget
  // during a cut, calories only go up when the weigh-ins prove he's losing too fast
  if (diff > 0 && !plan.allowRaise) return currentTarget
  const step = Math.sign(diff) * Math.min(Math.abs(diff), MAX_DAILY_STEP)
  return Math.max(plan.floor, Math.round((currentTarget + step) / 25) * 25)
}

// ---------- ways to burn it that aren't the gym ----------
export interface Activity { key: string; label: string; detail: string; met: number; where: 'home' | 'outside' | 'gym'; together?: boolean; kind: CardioLog['kind'] }
export const ACTIVITIES: Activity[] = [
  { key: 'walk-wife', label: 'Walk together', detail: ed('an easy walk outside with your wife — talking pace', 'an easy walk outside with a partner, friend or family — talking pace'), met: 3.5, where: 'outside', together: true, kind: 'walk' },
  { key: 'brisk-walk', label: 'Brisk walk', detail: 'about 5.5 km/h, arms swinging', met: 4.3, where: 'outside', kind: 'walk' },
  { key: 'hill-walk', label: 'Hills or stairs walk', detail: 'pick a hilly street or a set of stairs', met: 6, where: 'outside', kind: 'walk' },
  { key: 'bike-together', label: 'Bike ride together', detail: 'steady ride around the area', met: 6.8, where: 'outside', together: true, kind: 'bike' },
  { key: 'home-gym', label: 'Home gym circuit', detail: ed('your garage: squats, rows, presses, step-ups — 40 s on, 20 s off, keep moving', 'your home setup: squats, rows, presses, step-ups — 40 s on, 20 s off, keep moving'), met: 7, where: 'home', kind: 'walk' },
  { key: 'home-circuit', label: 'Home circuit', detail: 'squats, push-ups, lunges, plank, burpees — 40 s on, 20 s off', met: 8, where: 'home', kind: 'walk' },
  { key: 'skip', label: 'Skipping', detail: 'rope, steady rhythm — driveway works', met: 11, where: 'home', kind: 'jump-rope' },
  { key: 'shadow-box', label: 'Shadow boxing', detail: 'rounds of 3 min, keep moving', met: 5.5, where: 'home', kind: 'walk' },
  { key: 'dance', label: 'Dancing / active games', detail: 'music on — together or with family', met: 5, where: 'home', together: true, kind: 'walk' },
  { key: 'yard', label: 'Yard work / wash the car', detail: 'mowing, weeding, scrubbing', met: 4, where: 'home', kind: 'walk' },
  { key: 'incline-walk', label: 'Incline walk', detail: '5.5 km/h on a decent incline', met: 6, where: 'gym', kind: 'incline-walk' },
  { key: 'jog', label: 'Steady jog', detail: 'easy conversational pace', met: 9, where: 'outside', kind: 'run' },
  { key: 'row', label: 'Rowing', detail: 'moderate effort', met: 7, where: 'gym', kind: 'elliptical' },
]
export function minutesToBurn(a: Activity, kcal: number, weightKg: number): number {
  const perMin = metCalories(a.met, weightKg, 60)
  return perMin > 0 ? Math.max(5, Math.round(kcal / perMin)) : 0
}

// ---------- 4:00 per km ----------
export const RUN_GOAL_SEC = 240
/** best 1 km pace from runs of at least 1 km (sec/km) */
export function bestKmPace(runs: CardioLog[]): number | null {
  const paces = runs.filter((r) => r.kind === 'run').flatMap((r) => [r.avgPaceSecPerKm ?? (r.distanceKm && r.distanceKm >= 1 ? r.seconds / r.distanceKm : undefined), ...(r.splitsSec ?? []).slice(0, Math.floor(r.distanceKm ?? 0))]).filter((x): x is number => !!x && x > 150 && x < 900)
  return paces.length ? Math.round(Math.min(...paces)) : null
}
export const fmtPace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
export interface RunSession { title: string; detail: string }
export function runPlan(best: number | null): { best: number | null; gap: number | null; next: number; weeks: [number, number] | null; sessions: RunSession[] } {
  const b = best ?? 330
  const gap = best ? Math.max(0, best - RUN_GOAL_SEC) : null
  const next = Math.max(RUN_GOAL_SEC, b - 10)
  const work = Math.max(RUN_GOAL_SEC - 5, next - 5)
  const rep400 = Math.round(work * 0.4)
  const sessions: RunSession[] = [
    { title: 'Intervals', detail: `Warm up 10 min easy, then 6–8 × 400 m in ${rep400} s each (${fmtPace(work)}/km pace) with 90 s walk/jog between. Cool down 5 min.` },
    { title: 'Tempo', detail: `10 min easy, then 2–3 km at ${fmtPace(b + 20)}/km — hard but steady, you could say a few words. 5 min easy.` },
    { title: 'Easy run', detail: `25–35 min at ${fmtPace(b + 75)}/km or slower — fully conversational. This builds the engine.` },
    { title: 'Time trial (every 2 weeks)', detail: 'Warm up 10 min, then 1 km all-out on a flat route. Log it as a run with distance so the app tracks your best.' },
  ]
  // novice-to-intermediate runners usually take 2–4 s/km off per week with this mix — a rough guide only
  const weeks: [number, number] | null = gap === null ? null : gap === 0 ? [0, 0] : [Math.ceil(gap / 4), Math.ceil(gap / 2)]
  return { best, gap, next, weeks, sessions }
}

/** quick burn-back picks for the "you're over" banner: outside walk, jog, skipping, home gym */
export const QUICK_BURN = ['brisk-walk', 'jog', 'skip', 'home-gym']
