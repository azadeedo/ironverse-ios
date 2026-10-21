// Weekly review ("WEEK X COMPLETE") and the 12-week program review.
// Adaptation is shown as a RECOMMENDED CHANGE with WHY + ACCEPT / DECLINE —
// nothing in the program changes unless he accepts it.

import dayjs from 'dayjs'
import type { CardioLog, DailyCheckin, Plan, WorkoutLog } from '@/db/types'
import { byId } from '@/data/exercises'
import { DAY_ORDER, LIFT_EXERCISE, PHASES, type LiftKey } from '@/data/program12'
import { e1rm, loggedVolume, mondayBefore, programWeekFor, weekSequence, type VolumeMap } from './program12'

export type WeekFeel = 'too-easy' | 'good' | 'hard' | 'too-hard'
export const FEEL_LABEL: Record<WeekFeel, string> = { 'too-easy': 'Too easy', good: 'Good', hard: 'Hard', 'too-hard': 'Too hard' }

export interface WeekReviewRecord {
  feel?: WeekFeel
  at: string
  recommendation?: RecommendationId
  decision?: 'accepted' | 'declined'
}
export type RecommendationId = 'none' | 'repeat-week' | 'deload-next' | 'reduce-loads' | 'keep-going'

const isWork = (l: WorkoutLog) => !!l.finishedAt && !l.skipped
const doneSets = (l: WorkoutLog) => l.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done && !s.warmup).length, 0)

/** the workouts logged against program week `week` of this plan */
export function logsForWeek(plan: Plan, week: number, logs: WorkoutLog[]): WorkoutLog[] {
  return logs.filter((l) => l.planId === plan.id && isWork(l) && (l.dayId ?? '').startsWith(`p12-w${week}-`))
}

/** calendar range (Mon–Sun) a program week was / will be trained in */
export function weekRange(plan: Plan, week: number, logs: WorkoutLog[]): { from: string; to: string } {
  const wl = logsForWeek(plan, week, logs).sort((a, b) => a.date.localeCompare(b.date))
  let monday: string
  if (wl.length) monday = dayjs(wl[0].date).subtract((dayjs(wl[0].date).day() + 6) % 7, 'day').format('YYYY-MM-DD')
  else {
    const idx = Math.max(0, weekSequence(plan).findIndex((x) => x.w === week))
    monday = dayjs(mondayBefore(plan.programStart ?? plan.startDate)).add(idx * 7, 'day').format('YYYY-MM-DD')
  }
  return { from: monday, to: dayjs(monday).add(6, 'day').format('YYYY-MM-DD') }
}

/** a finished week that has not been reviewed yet (last calendar week, or this week once all 4 days are done) */
export function weekReviewDue(plan: Plan, logs: WorkoutLog[], today: string): number | null {
  const reviews = plan.weekReviews ?? {}
  const pw = programWeekFor(plan, today)
  if (!pw.started) return null
  const thisWeekDone = new Set(logsForWeek(plan, pw.week, logs).map((l) => l.dayId)).size >= DAY_ORDER.length
  if (thisWeekDone && !reviews[pw.week]) return pw.week
  if (pw.calendarWeek < 1) return null
  const prev = programWeekFor(plan, dayjs(today).subtract(7, 'day').format('YYYY-MM-DD'))
  if (prev.started && !reviews[prev.week] && logsForWeek(plan, prev.week, logs).length > 0 && (prev.week !== pw.week || pw.finished)) return prev.week
  return null
}

export interface WeekSummary {
  week: number
  phase: string
  range: { from: string; to: string }
  sessions: number
  planned: number
  totalSets: number
  volume: VolumeMap
  prs: { exerciseId: string; detail: string }[]
  improvements: { exerciseId: string; before: number; after: number }[]
  bodyweight: { avg?: number; prevAvg?: number; change?: number }
  cardio: { sessions: number; minutes: number }
  steps: { avg?: number; days: number }
  readiness: { avg?: number; n: number }
  missedDays: string[]
}

export function weekSummary(plan: Plan, week: number, all: { logs: WorkoutLog[]; weighIns: { date: string; weightKg: number }[]; cardio: CardioLog[]; checkins: DailyCheckin[] }): WeekSummary {
  const wl = logsForWeek(plan, week, all.logs)
  const range = weekRange(plan, week, all.logs)
  const before = all.logs.filter((l) => isWork(l) && l.date < range.from)
  const best = (logs: WorkoutLog[], id: string) => Math.max(0, ...logs.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup && !s.failed).map((s) => e1rm(s.weightKg ?? 0, s.reps ?? 0)))))
  const ids = [...new Set(wl.flatMap((l) => l.exercises.map((e) => e.exerciseId)))]
  const improvements = ids.map((id) => ({ exerciseId: id, before: best(before, id), after: best(wl, id) })).filter((x) => x.before > 0 && x.after > x.before + 0.4)
  const prs = ids.flatMap((id) => {
    const heaviestBefore = Math.max(0, ...before.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup && !s.failed).map((s) => s.weightKg ?? 0))))
    const heaviest = Math.max(0, ...wl.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup && !s.failed).map((s) => s.weightKg ?? 0))))
    return heaviestBefore > 0 && heaviest > heaviestBefore ? [{ exerciseId: id, detail: `${heaviest} kg (was ${heaviestBefore} kg)` }] : []
  })
  const inRange = (d: string, r = range) => d >= r.from && d <= r.to
  const prevRange = { from: dayjs(range.from).subtract(7, 'day').format('YYYY-MM-DD'), to: dayjs(range.from).subtract(1, 'day').format('YYYY-MM-DD') }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)
  const bwAvg = avg(all.weighIns.filter((w) => inRange(w.date)).map((w) => w.weightKg))
  const bwPrev = avg(all.weighIns.filter((w) => inRange(w.date, prevRange)).map((w) => w.weightKg))
  const cw = all.cardio.filter((c) => inRange(c.date) && c.seconds >= 8 * 60)
  const steps = all.checkins.filter((c) => inRange(c.date) && typeof c.steps === 'number').map((c) => c.steps!)
  const ready = wl.map((l) => l.checkin).filter(Boolean).map((c) => (c!.sleep + c!.energy + (6 - c!.soreness) + c!.readiness) / 4)
  const doneDays = new Set(wl.map((l) => l.dayId))
  return {
    week,
    phase: PHASES[week - 1]?.name ?? '',
    range,
    sessions: doneDays.size,
    planned: DAY_ORDER.length,
    totalSets: wl.reduce((n, l) => n + doneSets(l), 0),
    volume: loggedVolume(wl, '0000-00-00', '9999-12-31'),
    prs,
    improvements,
    bodyweight: { avg: bwAvg, prevAvg: bwPrev, change: bwAvg !== undefined && bwPrev !== undefined ? bwAvg - bwPrev : undefined },
    cardio: { sessions: cw.length, minutes: Math.round(cw.reduce((n, c) => n + c.seconds, 0) / 60) },
    steps: { avg: avg(steps), days: steps.length },
    readiness: { avg: avg(ready), n: ready.length },
    missedDays: DAY_ORDER.filter((d) => !doneDays.has(`p12-w${week}-${d}`)),
  }
}

export interface Recommendation { id: RecommendationId; title: string; why: string; structural: boolean }
/** a SIGNAL, not an order: shown with ACCEPT / DECLINE */
export function recommendFor(sum: WeekSummary, feel: WeekFeel | undefined): Recommendation {
  const deloadWeek = PHASES[sum.week - 1]?.deload
  const poorReady = sum.readiness.avg !== undefined && sum.readiness.avg < 2.6
  if (sum.sessions <= 2 && sum.week < 12) return { id: 'repeat-week', structural: true, title: `Repeat week ${sum.week} next week`, why: `Only ${sum.sessions} of ${sum.planned} sessions were completed. Repeating the week keeps the progression honest instead of jumping ahead. Later weeks (including PR week) move back by one.` }
  if (feel === 'too-hard' && !deloadWeek && sum.week < 11 && (poorReady || sum.sessions < sum.planned)) return { id: 'deload-next', structural: true, title: 'Make next week a deload', why: `You rated the week "too hard"${poorReady ? ` and average readiness was ${sum.readiness.avg!.toFixed(1)}/5` : ''}. A lighter week now protects the main quest; the program picks up where it left off afterwards.` }
  if (feel === 'too-hard' || (feel === 'hard' && poorReady)) return { id: 'reduce-loads', structural: false, title: 'Reduce recommended loads 2.5–5% next week', why: 'Sets, reps and exercises stay exactly as programmed — only the suggested weights come down a little while recovery catches up.' }
  if (feel === 'too-easy') return { id: 'keep-going', structural: false, title: 'Keep the program as written', why: 'Loads already rise automatically when you hit the top of your rep ranges at the target RIR, so "too easy" is handled by progression — nothing structural needs to change. If it stays easy for two weeks, log more honest RIR.' }
  return { id: 'none', structural: false, title: 'No change needed', why: 'The week went to plan. Carry on with the next written week.' }
}

// ---------- 12-week completion review ----------
export interface ProgramReview {
  startKg?: number; currentKg?: number; waist?: { start?: number; now?: number }
  sessions: number; plannedSessions: number; consistency: number
  totalSets: number; cardioSessions: number; cardioMinutes: number; avgSteps?: number
  volume: VolumeMap
  lifts: Record<LiftKey, { start?: number; end?: number }>
  pull: { start: string; now: string }
  topImprovements: { exerciseId: string; before: number; after: number }[]
}
export function programReview(plan: Plan, all: { logs: WorkoutLog[]; weighIns: { date: string; weightKg: number }[]; cardio: CardioLog[]; checkins: DailyCheckin[]; measurements?: { date: string; waistCm?: number }[] }): ProgramReview {
  const wl = all.logs.filter((l) => l.planId === plan.id && isWork(l)).sort((a, b) => a.date.localeCompare(b.date))
  const from = plan.programStart ?? plan.startDate
  const sortedW = [...all.weighIns].filter((w) => w.date >= dayjs(from).subtract(7, 'day').format('YYYY-MM-DD')).sort((a, b) => a.date.localeCompare(b.date))
  const e = (logs: WorkoutLog[], id: string) => Math.max(0, ...logs.flatMap((l) => l.exercises.filter((x) => x.exerciseId === id).flatMap((x) => x.sets.filter((s) => s.done && !s.warmup && !s.failed).map((s) => e1rm(s.weightKg ?? 0, s.reps ?? 0)))))
  const firstHalf = wl.slice(0, Math.max(1, Math.floor(wl.length / 4)))
  const lastHalf = wl.slice(-Math.max(1, Math.floor(wl.length / 4)))
  const lifts = Object.fromEntries((['squat', 'bench', 'deadlift'] as LiftKey[]).map((k) => [k, { start: e(firstHalf, LIFT_EXERCISE[k]) || undefined, end: e(wl, LIFT_EXERCISE[k]) || undefined }])) as ProgramReview['lifts']
  const ids = [...new Set(wl.flatMap((l) => l.exercises.map((x) => x.exerciseId)))]
  const topImprovements = ids.map((id) => ({ exerciseId: id, before: e(firstHalf, id), after: e(lastHalf, id) })).filter((x) => x.before > 0 && x.after > x.before).sort((a, b) => b.after / b.before - a.after / a.before).slice(0, 8)
  const pullRung = (logs: WorkoutLog[]) => ['weighted-pull-up', 'pull-up', 'assisted-pull-up', 'lat-pulldown'].find((id) => logs.some((l) => l.exercises.some((x) => x.exerciseId === id && x.sets.some((s) => s.done)))) ?? 'lat-pulldown'
  const cardio = all.cardio.filter((c) => c.date >= from && c.seconds >= 8 * 60)
  const steps = all.checkins.filter((c) => c.date >= from && typeof c.steps === 'number').map((c) => c.steps!)
  const ms = (all.measurements ?? []).filter((m) => typeof m.waistCm === 'number').sort((a, b) => a.date.localeCompare(b.date))
  const sessions = new Set(wl.map((l) => l.dayId)).size
  return {
    startKg: sortedW[0]?.weightKg, currentKg: sortedW[sortedW.length - 1]?.weightKg,
    waist: ms.length ? { start: ms[0].waistCm, now: ms[ms.length - 1].waistCm } : undefined,
    sessions, plannedSessions: 48, consistency: Math.round((sessions / 48) * 100),
    totalSets: wl.reduce((n, l) => n + doneSets(l), 0),
    cardioSessions: cardio.length, cardioMinutes: Math.round(cardio.reduce((n, c) => n + c.seconds, 0) / 60),
    avgSteps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : undefined,
    volume: loggedVolume(wl, '0000-00-00', '9999-12-31'),
    lifts,
    pull: { start: pullRung(firstHalf), now: pullRung(lastHalf) },
    topImprovements,
  }
}
export const exName = (id: string) => byId.get(id)?.name ?? id
