// ============================================================
// WEEKLY INSIGHTS — the last 7 days, said plainly.
//
// The job is one honest paragraph plus a handful of numbers: what went well,
// what slipped, and one concrete thing to do about it. The hard rule is that
// it never guesses. If three days have no food logged, it says the food data
// is too thin to judge rather than reporting a fake average — a wrong number
// here is worse than no number, because he'd act on it.
//
// Nothing in here scolds. "Four of seven days logged" is a fact; "you only
// logged four days" is a telling-off. We ship the fact.
// ============================================================

import { db } from '@/db'
import { byId as exerciseById } from '@/data/exercises'
import type {
  CardioLog, FoodLogEntry, Profile, SetLog, WaterLog, WeighIn, WorkoutLog,
} from '@/db/types'
import { dayjs } from './fmt'
import { todayStr } from './id'

export type InsightTone = 'good' | 'neutral' | 'watch'

export interface InsightStat {
  label: string
  value: string
  sub?: string
  tone: InsightTone
}

export interface WeeklyInsight {
  /** inclusive date range covered, YYYY-MM-DD */
  from: string
  to: string
  /** the paragraph. Always present, always true for the data on hand. */
  paragraph: string
  /** 2-5 headline numbers */
  stats: InsightStat[]
  /** one concrete suggestion, or null when the data can't support one */
  suggestion: string | null
  /** true when there isn't enough logged to say anything meaningful */
  thin: boolean
}

const isWorking = (s: SetLog): boolean =>
  s.done === true && s.warmup !== true && (s.reps ?? 0) > 0

const kg1 = (n: number): string => (n % 1 === 0 ? String(n) : n.toFixed(1))
const int = (n: number): string => Math.round(n).toLocaleString('en-AU')

export interface InsightInput {
  logs: WorkoutLog[]
  foodLog: FoodLogEntry[]
  weighIns: WeighIn[]
  waterLog: WaterLog[]
  cardioLog: CardioLog[]
  profile?: Profile
  /** last day of the window; defaults to today */
  today?: string
}

/** The 7 dates ending on `today`, oldest first. */
export function weekDates(today = todayStr()): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    dayjs(today).subtract(6 - i, 'day').format('YYYY-MM-DD'),
  )
}

export function computeWeeklyInsight(input: InsightInput): WeeklyInsight {
  const today = input.today ?? todayStr()
  const days = weekDates(today)
  const from = days[0]
  const to = days[days.length - 1]
  const inWindow = (d: string) => d >= from && d <= to
  const prevFrom = dayjs(from).subtract(7, 'day').format('YYYY-MM-DD')
  const prevTo = dayjs(from).subtract(1, 'day').format('YYYY-MM-DD')
  const inPrev = (d: string) => d >= prevFrom && d <= prevTo

  const profile = input.profile

  // ---------- training ----------
  const realLogs = input.logs.filter((l) => l.exercises.some((e) => e.sets.some(isWorking)))
  const weekLogs = realLogs.filter((l) => inWindow(l.date))
  const prevLogs = realLogs.filter((l) => inPrev(l.date))

  const volumeOf = (list: WorkoutLog[]) => list.reduce((sum, log) => {
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (isWorking(s)) sum += (s.weightKg ?? 0) * (s.reps ?? 0)
      }
    }
    return sum
  }, 0)
  const setsOf = (list: WorkoutLog[]) =>
    list.reduce((n, log) => n + log.exercises.reduce((m, e) => m + e.sets.filter(isWorking).length, 0), 0)

  const weekVolume = volumeOf(weekLogs)
  const prevVolume = volumeOf(prevLogs)
  const weekSets = setsOf(weekLogs)
  const target = profile?.daysPerWeek ?? 0

  // ---------- food ----------
  const weekFood = input.foodLog.filter((f) => inWindow(f.date))
  const foodDays = new Set(weekFood.map((f) => f.date))
  const kcalByDay = new Map<string, number>()
  const proteinByDay = new Map<string, number>()
  for (const f of weekFood) {
    kcalByDay.set(f.date, (kcalByDay.get(f.date) ?? 0) + f.kcal)
    proteinByDay.set(f.date, (proteinByDay.get(f.date) ?? 0) + f.protein)
  }
  const loggedDayCount = foodDays.size
  // only average over days that were actually logged, and only claim it when
  // there are enough of them to mean something
  const foodTrustworthy = loggedDayCount >= 4
  const avgKcal = loggedDayCount > 0
    ? [...kcalByDay.values()].reduce((a, b) => a + b, 0) / loggedDayCount
    : 0
  const avgProtein = loggedDayCount > 0
    ? [...proteinByDay.values()].reduce((a, b) => a + b, 0) / loggedDayCount
    : 0
  const proteinTarget = profile?.proteinTarget ?? 0
  const calorieTarget = profile?.calorieTarget ?? 0
  const proteinHitDays = [...proteinByDay.values()].filter((p) => proteinTarget > 0 && p >= proteinTarget).length

  // ---------- weight ----------
  const weighIns = [...input.weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const weekWeighIns = weighIns.filter((w) => inWindow(w.date))
  const firstW = weekWeighIns[0]
  const lastW = weekWeighIns[weekWeighIns.length - 1]
  const beforeWindow = weighIns.filter((w) => w.date < from).pop()
  // a change needs two points at least 3 days apart, otherwise it's noise
  const anchor = beforeWindow ?? firstW
  const weightDelta = anchor && lastW && anchor.date !== lastW.date
    && dayjs(lastW.date).diff(dayjs(anchor.date), 'day') >= 3
    ? lastW.weightKg - anchor.weightKg
    : null

  // ---------- water / cardio ----------
  const waterByDay = new Map<string, number>()
  for (const w of input.waterLog) if (inWindow(w.date)) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml)
  const waterTarget = profile?.waterTargetMl ?? 0
  const waterHitDays = waterTarget > 0
    ? [...waterByDay.values()].filter((ml) => ml >= waterTarget).length
    : 0
  const cardioSessions = input.cardioLog.filter((c) => inWindow(c.date)).length

  // ---------- thin data guard ----------
  const thin = weekLogs.length === 0 && loggedDayCount === 0 && weekWeighIns.length === 0 && cardioSessions === 0
  if (thin) {
    return {
      from, to,
      paragraph:
        'Nothing was logged in the last 7 days, so there is nothing here worth reporting. '
        + 'One session or one day of food is enough for this to start saying something real.',
      stats: [],
      suggestion: null,
      thin: true,
    }
  }

  // ---------- stats ----------
  const stats: InsightStat[] = []

  stats.push({
    label: 'Sessions',
    value: String(weekLogs.length),
    sub: target > 0 ? `target ${target}/week` : undefined,
    tone: target > 0 ? (weekLogs.length >= target ? 'good' : weekLogs.length >= target - 1 ? 'neutral' : 'watch') : 'neutral',
  })

  if (weekSets > 0) {
    stats.push({
      label: 'Working sets',
      value: int(weekSets),
      sub: weekVolume > 0 ? `${int(weekVolume)} kg moved` : undefined,
      tone: 'neutral',
    })
  }

  if (loggedDayCount > 0) {
    stats.push({
      label: 'Food logged',
      value: `${loggedDayCount}/7 days`,
      sub: foodTrustworthy && calorieTarget > 0 ? `avg ${int(avgKcal)} cal` : undefined,
      tone: loggedDayCount >= 6 ? 'good' : loggedDayCount >= 4 ? 'neutral' : 'watch',
    })
  }

  if (foodTrustworthy && proteinTarget > 0) {
    stats.push({
      label: 'Protein',
      value: `${int(avgProtein)} g`,
      sub: `target ${proteinTarget} g · hit on ${proteinHitDays}/${loggedDayCount} logged days`,
      tone: avgProtein >= proteinTarget ? 'good' : avgProtein >= proteinTarget * 0.85 ? 'neutral' : 'watch',
    })
  }

  if (weightDelta !== null) {
    stats.push({
      label: 'Weight',
      value: `${weightDelta > 0 ? '+' : ''}${kg1(Math.round(weightDelta * 10) / 10)} kg`,
      sub: `${kg1(anchor!.weightKg)} → ${kg1(lastW!.weightKg)} kg`,
      tone: 'neutral',
    })
  }

  if (waterTarget > 0 && waterByDay.size > 0) {
    stats.push({
      label: 'Water',
      value: `${waterHitDays}/7 days`,
      sub: `target ${(waterTarget / 1000).toFixed(2).replace(/\.?0+$/, '')} L`,
      tone: waterHitDays >= 5 ? 'good' : waterHitDays >= 3 ? 'neutral' : 'watch',
    })
  }

  // ---------- the paragraph ----------
  const went: string[] = []
  const slipped: string[] = []

  if (target > 0 && weekLogs.length >= target) {
    went.push(`you hit all ${target} training day${target === 1 ? '' : 's'}`)
  } else if (weekLogs.length > 0 && target > 0) {
    slipped.push(`${weekLogs.length} of ${target} training days landed`)
  } else if (weekLogs.length > 0) {
    went.push(`${weekLogs.length} session${weekLogs.length === 1 ? '' : 's'} went in the book`)
  } else {
    slipped.push('no sessions were logged')
  }

  if (prevLogs.length > 0 && weekVolume > 0 && prevVolume > 0) {
    const pct = Math.round(((weekVolume - prevVolume) / prevVolume) * 100)
    if (pct >= 8) went.push(`total volume is up ${pct}% on last week`)
    else if (pct <= -12) slipped.push(`volume is down ${Math.abs(pct)}% on last week`)
  }

  if (cardioSessions > 0) went.push(`${cardioSessions} cardio session${cardioSessions === 1 ? '' : 's'} on top`)

  if (loggedDayCount >= 6) went.push('food went in nearly every day')
  else if (loggedDayCount > 0 && loggedDayCount < 4) slipped.push(`food was only logged on ${loggedDayCount} of 7 days`)

  if (foodTrustworthy && proteinTarget > 0) {
    if (avgProtein >= proteinTarget) went.push(`protein averaged ${int(avgProtein)} g, over your ${proteinTarget} g target`)
    else if (avgProtein < proteinTarget * 0.85) slipped.push(`protein averaged ${int(avgProtein)} g against a ${proteinTarget} g target`)
  }

  if (waterTarget > 0 && waterByDay.size > 0 && waterHitDays <= 2) {
    slipped.push(`water hit target on ${waterHitDays} of 7 days`)
  }

  const joiner = (list: string[]): string => {
    if (list.length === 0) return ''
    if (list.length === 1) return list[0]
    return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
  }

  const range = `${dayjs(from).format('D MMM')} – ${dayjs(to).format('D MMM')}`
  const parts: string[] = [`Last 7 days (${range}):`]
  if (went.length) parts.push(`${joiner(went)}.`)
  if (slipped.length) parts.push(`${went.length ? 'On the other side, ' : ''}${joiner(slipped)}.`)

  if (weightDelta !== null) {
    const dir = weightDelta < 0 ? 'down' : weightDelta > 0 ? 'up' : 'flat'
    parts.push(
      dir === 'flat'
        ? 'Weight is flat across the window.'
        : `Weight is ${dir} ${kg1(Math.abs(Math.round(weightDelta * 10) / 10))} kg over the window — one week is noise, so read it against the trend line, not on its own.`,
    )
  } else if (weekWeighIns.length <= 1) {
    parts.push('Not enough weigh-ins this week to call a direction on bodyweight.')
  }

  if (!foodTrustworthy && loggedDayCount > 0) {
    parts.push(`Food was logged on ${loggedDayCount} of 7 days, which is too few to average honestly — the calorie figure is left out rather than guessed.`)
  }

  // ---------- one concrete suggestion ----------
  const suggestion = pickSuggestion({
    weekLogs, target, loggedDayCount, foodTrustworthy, avgProtein, proteinTarget,
    waterTarget, waterHitDays, waterDays: waterByDay.size, weekVolume, prevVolume,
    weekWeighIns: weekWeighIns.length, mostSkipped: mostSkippedExercise(weekLogs),
  })

  return {
    from, to,
    paragraph: parts.join(' '),
    stats,
    suggestion,
    thin: false,
  }
}

/** Which planned exercise got started but left with unfinished sets most often. */
function mostSkippedExercise(logs: WorkoutLog[]): string | null {
  const misses = new Map<string, number>()
  for (const log of logs) {
    for (const ex of log.exercises) {
      const undone = ex.sets.filter((s) => !s.done).length
      if (undone > 0) misses.set(ex.exerciseId, (misses.get(ex.exerciseId) ?? 0) + undone)
    }
  }
  let bestId: string | null = null
  let best = 0
  for (const [id, n] of misses) if (n > best) { best = n; bestId = id }
  if (!bestId || best < 3) return null
  return exerciseById.get(bestId)?.name ?? bestId
}

interface SuggestionInput {
  weekLogs: WorkoutLog[]
  target: number
  loggedDayCount: number
  foodTrustworthy: boolean
  avgProtein: number
  proteinTarget: number
  waterTarget: number
  waterHitDays: number
  waterDays: number
  weekVolume: number
  prevVolume: number
  weekWeighIns: number
  mostSkipped: string | null
}

/**
 * Exactly one suggestion, picked by what would actually move the needle most.
 * Ordered by leverage, and every branch is something he can do tomorrow.
 */
function pickSuggestion(i: SuggestionInput): string | null {
  if (i.target > 0 && i.weekLogs.length === 0) {
    return 'Put one session in the calendar for tomorrow and log it, even a short one — the streak restarts on the first entry, not on a perfect week.'
  }
  if (i.target > 0 && i.weekLogs.length < i.target - 1) {
    return `Pick the single easiest day this week to protect and treat it as fixed. Getting back to ${i.target} sessions matters more than what is in any one of them.`
  }
  if (i.foodTrustworthy && i.proteinTarget > 0 && i.avgProtein < i.proteinTarget * 0.85) {
    const gap = Math.round(i.proteinTarget - i.avgProtein)
    return `You are about ${gap} g of protein short per day. One extra fixed protein serve at the same meal each day closes most of that without re-planning anything.`
  }
  if (i.loggedDayCount > 0 && i.loggedDayCount < 4) {
    return 'Log just breakfast every day this week. A partial day of data beats a missing one, and it makes the weekly numbers usable.'
  }
  if (i.loggedDayCount === 0) {
    return 'Log one day of food end to end this week. Without it there is nothing here to say about calories or protein.'
  }
  if (i.mostSkipped) {
    return `${i.mostSkipped} is where sets get left unfinished most often. Move it earlier in the session, or drop its set count so the sets you do plan actually get done.`
  }
  if (i.waterTarget > 0 && i.waterDays > 0 && i.waterHitDays <= 2) {
    return 'Water is the cheapest fix on this list — set the reminder interval tighter in Water & Creatine and it mostly handles itself.'
  }
  if (i.weekWeighIns <= 1) {
    return 'Weigh in on three fixed mornings this week. Three points make the trend line honest; one point tells you nothing.'
  }
  if (i.prevVolume > 0 && i.weekVolume < i.prevVolume * 0.88) {
    return 'Volume dropped this week. Before adding sets, check the loads are still buildable from your current equipment profile — that is usually the cause.'
  }
  if (i.target > 0 && i.weekLogs.length >= i.target && i.foodTrustworthy) {
    return 'Everything tracked is on target, so change nothing this week. Hold it, and let the next week of data decide the adjustment.'
  }
  return null
}

/** Load the window out of Dexie, then compute. */
export async function loadWeeklyInsight(today = todayStr()): Promise<WeeklyInsight> {
  const from = dayjs(today).subtract(13, 'day').format('YYYY-MM-DD')
  const [logs, foodLog, weighIns, waterLog, cardioLog, profile] = await Promise.all([
    db.workoutLogs.where('date').aboveOrEqual(from).toArray(),
    db.foodLog.where('date').aboveOrEqual(from).toArray(),
    db.weighIns.toArray(),
    db.waterLog.where('date').aboveOrEqual(from).toArray(),
    db.cardioLog.where('date').aboveOrEqual(from).toArray(),
    db.profile.get('me'),
  ])
  return computeWeeklyInsight({ logs, foodLog, weighIns, waterLog, cardioLog, profile, today })
}
