// ============================================================
// WEEKLY REVIEW — pure maths and the honest one-liner.
//
// Nothing here touches React or Dexie. The screen loads the rows, hands them
// in, and renders what comes back. Every number is derived from something the
// owner actually logged — no filler, no invented averages.
// ============================================================

import type { CardioLog, DayAdjust, FoodLogEntry, Profile, WeighIn, WorkoutLog } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { sessionVolume, weekStartStr, type WeeklyHardSets } from '@/lib/training'
import { weightTrend } from '@/lib/nutrition'
import { targetForDateWith } from '@/screens/food/helpers'

// ---------- weeks ----------

export interface WeekRange {
  /** YYYY-MM-DD, Monday */
  start: string
  /** YYYY-MM-DD, exclusive (the next Monday) */
  end: string
  /** '8 – 14 Sep' */
  label: string
  /** 'This week' / 'Last week' / '3 weeks ago' */
  relative: string
}

export function weekRange(weekStart: string): WeekRange {
  const s = dayjs(weekStart)
  const e = s.add(6, 'day')
  const thisWeek = weekStartStr(new Date())
  const back = Math.round(dayjs(thisWeek).diff(s, 'day') / 7)
  const relative =
    back <= 0 ? 'This week'
    : back === 1 ? 'Last week'
    : `${back} weeks ago`
  const label = s.month() === e.month()
    ? `${s.format('D')} – ${e.format('D MMM')}`
    : `${s.format('D MMM')} – ${e.format('D MMM')}`
  return { start: s.format('YYYY-MM-DD'), end: s.add(7, 'day').format('YYYY-MM-DD'), label, relative }
}

/** The seven dates of a week, Monday first. */
export function weekDates(weekStart: string): string[] {
  const s = dayjs(weekStart)
  return Array.from({ length: 7 }, (_, i) => s.add(i, 'day').format('YYYY-MM-DD'))
}

/** Monday anchors for the last `count` weeks, newest first. */
export function recentWeekStarts(count = 12): string[] {
  const now = dayjs(weekStartStr(new Date()))
  return Array.from({ length: count }, (_, i) => now.subtract(i, 'week').format('YYYY-MM-DD'))
}

export const prevWeek = (weekStart: string): string =>
  dayjs(weekStart).subtract(7, 'day').format('YYYY-MM-DD')
export const nextWeek = (weekStart: string): string =>
  dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD')

export function isValidWeekStart(v: string | null | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = dayjs(v)
  return d.isValid() && weekStartStr(v) === v
}

// ---------- training ----------

export interface TrainingStats {
  sessionsDone: number
  sessionsPlanned: number
  tonnageKg: number
  hard: WeeklyHardSets
  /** the sessions themselves, oldest first, for the little list */
  sessions: { date: string; title: string; volumeKg: number; sets: number }[]
}

export function trainingStats(
  logs: WorkoutLog[],
  range: WeekRange,
  hard: WeeklyHardSets,
  planned: number,
): TrainingStats {
  const inWeek = logs
    .filter((l) => l.date >= range.start && l.date < range.end && l.finishedAt)
    .sort((a, b) => a.date.localeCompare(b.date))
  let tonnage = 0
  const sessions = inWeek.map((l) => {
    const v = sessionVolume(l)
    tonnage += v
    const sets = l.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => s.done === true && s.warmup !== true).length,
      0,
    )
    return { date: l.date, title: l.title, volumeKg: Math.round(v), sets }
  })
  return { sessionsDone: inWeek.length, sessionsPlanned: planned, tonnageKg: Math.round(tonnage), hard, sessions }
}

// ---------- nutrition ----------

export interface NutritionDay {
  date: string
  kcal: number
  protein: number
  target: number
  logged: boolean
  adjusted: boolean
}

export interface NutritionStats {
  days: NutritionDay[]
  daysLogged: number
  avgKcal: number
  avgProtein: number
  proteinTarget: number
  /** 7 × the (possibly adjusted) daily target */
  budgetKcal: number
  consumedKcal: number
  /** consumed − budget for the days that have passed; + = over */
  positionKcal: number
  /** budget for the days that have actually happened (so mid-week reads honestly) */
  elapsedBudgetKcal: number
  daysElapsed: number
  daysProteinUnder: number
  /** any carry-over rows in play this week */
  hasAdjust: boolean
}

/** A day with under ~500 kcal logged is a forgotten day, not a fasting day. */
const REAL_DAY_KCAL = 500

export function nutritionStats(
  entries: FoodLogEntry[],
  range: WeekRange,
  profile: Profile,
  adjusts: Map<string, DayAdjust> | undefined,
  today = dayjs().format('YYYY-MM-DD'),
): NutritionStats {
  const byDate = new Map<string, { kcal: number; protein: number }>()
  for (const e of entries) {
    if (e.date < range.start || e.date >= range.end) continue
    const cur = byDate.get(e.date) ?? { kcal: 0, protein: 0 }
    cur.kcal += e.kcal
    cur.protein += e.protein
    byDate.set(e.date, cur)
  }

  const proteinTarget = profile.proteinTarget
  const days: NutritionDay[] = weekDates(range.start).map((date) => {
    const row = byDate.get(date)
    const target = targetForDateWith(date, profile, adjusts)
    return {
      date,
      kcal: Math.round(row?.kcal ?? 0),
      protein: Math.round(row?.protein ?? 0),
      target,
      logged: (row?.kcal ?? 0) >= REAL_DAY_KCAL,
      adjusted: (adjusts?.get(date)?.deltaKcal ?? 0) !== 0,
    }
  })

  const logged = days.filter((d) => d.logged)
  const elapsed = days.filter((d) => d.date <= today)
  const consumed = days.reduce((n, d) => n + d.kcal, 0)
  const budget = days.reduce((n, d) => n + d.target, 0)
  const elapsedBudget = elapsed.reduce((n, d) => n + d.target, 0)

  return {
    days,
    daysLogged: logged.length,
    avgKcal: logged.length ? Math.round(logged.reduce((n, d) => n + d.kcal, 0) / logged.length) : 0,
    avgProtein: logged.length ? Math.round(logged.reduce((n, d) => n + d.protein, 0) / logged.length) : 0,
    proteinTarget,
    budgetKcal: budget,
    consumedKcal: consumed,
    elapsedBudgetKcal: elapsedBudget,
    daysElapsed: elapsed.length,
    positionKcal: Math.round(consumed - elapsedBudget),
    daysProteinUnder: logged.filter((d) => d.protein < proteinTarget * 0.9).length,
    hasAdjust: days.some((d) => d.adjusted),
  }
}

// ---------- body ----------

export interface BodyStats {
  weighIns: number
  startTrend: number | null
  endTrend: number | null
  deltaKg: number | null
  latestRaw: number | null
}

/**
 * Weight movement across the week, read off the SMOOTHED trend rather than two
 * raw mornings. Falls back to the last trend value before the week so a single
 * weigh-in still says something.
 */
export function bodyStats(allWeighIns: WeighIn[], range: WeekRange): BodyStats {
  const rows = weightTrend(allWeighIns)
  const before = rows.filter((r) => r.date < range.start)
  const inWeek = rows.filter((r) => r.date >= range.start && r.date < range.end)
  if (inWeek.length === 0) {
    return { weighIns: 0, startTrend: null, endTrend: null, deltaKg: null, latestRaw: null }
  }
  const start = inWeek.length >= 2
    ? inWeek[0].trend
    : (before.length ? before[before.length - 1].trend : null)
  const end = inWeek[inWeek.length - 1].trend
  return {
    weighIns: inWeek.length,
    startTrend: start,
    endTrend: end,
    deltaKg: start === null ? null : Math.round((end - start) * 10) / 10,
    latestRaw: inWeek[inWeek.length - 1].raw,
  }
}

// ---------- cardio ----------

export interface CardioStats {
  sessions: number
  km: number
  minutes: number
  byKind: { kind: CardioLog['kind']; label: string; sessions: number; km: number; minutes: number }[]
}

const CARDIO_LABELS: Record<CardioLog['kind'], string> = {
  run: 'Running', walk: 'Walking', 'jump-rope': 'Jump rope',
  'incline-walk': 'Incline walking', bike: 'Cycling', elliptical: 'Elliptical',
}

export function cardioStats(entries: CardioLog[], range: WeekRange): CardioStats {
  const inWeek = entries.filter((c) => c.date >= range.start && c.date < range.end)
  const kinds: CardioLog['kind'][] = ['run', 'walk', 'jump-rope', 'incline-walk', 'bike', 'elliptical']
  const byKind = kinds
    .map((kind) => {
      const rows = inWeek.filter((c) => c.kind === kind)
      return {
        kind,
        label: CARDIO_LABELS[kind],
        sessions: rows.length,
        km: Math.round(rows.reduce((n, r) => n + (r.distanceKm ?? 0), 0) * 10) / 10,
        minutes: Math.round(rows.reduce((n, r) => n + r.seconds, 0) / 60),
      }
    })
    .filter((k) => k.sessions > 0)
  return {
    sessions: inWeek.length,
    km: Math.round(inWeek.reduce((n, r) => n + (r.distanceKm ?? 0), 0) * 10) / 10,
    minutes: Math.round(inWeek.reduce((n, r) => n + r.seconds, 0) / 60),
    byKind,
  }
}

// ============================================================
// THE ONE HONEST SENTENCE
//
// Straight-talking, never a scold. It names what happened and what it means,
// and it always leaves him somewhere to go next. Guilt has never added a kilo
// to anyone's bench.
// ============================================================

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
export const countWord = (n: number): string => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n))
const sessionPhrase = (n: number): string =>
  n === 0 ? 'No sessions' : `${countWord(n)} session${n === 1 ? '' : 's'}`
const dayWord = (n: number): string => `${countWord(n).toLowerCase()} day${n === 1 ? '' : 's'}`

export type VerdictTone = 'green' | 'brand' | 'amber' | 'gray'

export interface Verdict {
  text: string
  tone: VerdictTone
  /** which template fired — handy for the icon and for future tuning */
  pattern:
    | 'no-data' | 'part-week' | 'great' | 'both-good' | 'training-good-food-off'
    | 'food-good-training-light' | 'both-slipped' | 'light-after-heavy' | 'mixed'
}

export interface VerdictInput {
  training: TrainingStats
  nutrition: NutritionStats
  body: BodyStats
  cardio: CardioStats
  goal: Profile['goal']
  prevSessions: number
  prevTonnageKg: number
  /** true while the week is still running — changes the tense, not the honesty */
  inProgress: boolean
  /** formats a kcal number in the owner's chosen unit */
  fmtCal: (kcal: number) => string
}

function weightClause(body: BodyStats, goal: Profile['goal']): string {
  if (body.deltaKg === null) {
    return body.weighIns > 0 ? 'one weigh-in, not enough to call the trend' : 'no weigh-ins'
  }
  const d = body.deltaKg
  if (Math.abs(d) < 0.2) return 'weight flat'
  const dir = d < 0 ? 'down' : 'up'
  const wanted = goal === 'build-muscle' ? d > 0 : d < 0
  return `weight trending ${dir} ${Math.abs(d).toFixed(1)} kg${wanted ? '' : ' (against the goal)'}`
}

export function buildVerdict(i: VerdictInput): Verdict {
  const { training: t, nutrition: n, body, cardio, fmtCal } = i
  const planned = Math.max(0, t.sessionsPlanned)
  const trainingGood = planned > 0 ? t.sessionsDone >= planned : t.sessionsDone >= 3
  const trainingClose = t.sessionsDone >= Math.max(1, planned - 1)
  const budgetBand = Math.max(500, n.elapsedBudgetKcal * 0.05)
  const over = n.positionKcal > budgetBand
  const under = n.positionKcal < -budgetBand
  const proteinOff = n.daysLogged > 0 && n.daysProteinUnder >= Math.max(2, Math.ceil(n.daysLogged / 2))
  const trackingThin = n.daysLogged < 3
  const nutritionGood = n.daysLogged >= 5 && n.daysProteinUnder <= 1 && !over
  const nutritionOff = !trackingThin && (proteinOff || over)

  // ---------- nothing to read yet ----------
  if (t.sessionsDone === 0 && n.daysLogged === 0 && body.weighIns === 0 && cardio.sessions === 0) {
    return {
      pattern: 'no-data',
      tone: 'gray',
      text: i.inProgress
        ? 'Nothing logged this week yet — the review fills itself in as you train and eat.'
        : 'Nothing was logged that week, so there is nothing honest to say about it. The weeks you do log are the ones worth reading.',
    }
  }

  // ---------- week still running, too early to judge ----------
  if (i.inProgress && n.daysElapsed <= 2 && t.sessionsDone <= 1) {
    return {
      pattern: 'part-week',
      tone: 'gray',
      text: `Only ${dayWord(n.daysElapsed)} into the week — ${sessionPhrase(t.sessionsDone).toLowerCase()} and ${dayWord(n.daysLogged)} logged so far. Too early to read anything into it.`,
    }
  }

  // ---------- deliberate lighter week after a heavy one ----------
  if (
    !trainingGood && t.sessionsDone >= 1 && i.prevSessions >= Math.max(3, planned) &&
    i.prevTonnageKg > 0 && t.tonnageKg < i.prevTonnageKg * 0.8
  ) {
    return {
      pattern: 'light-after-heavy',
      tone: 'brand',
      text: `${sessionPhrase(t.sessionsDone)} and tonnage down on last week's ${i.prevSessions}. That reads as a lighter week after a heavy one — which is how you keep training for years, not a problem to fix.`,
    }
  }

  // ---------- everything lining up ----------
  if (trainingGood && nutritionGood) {
    const moving = body.deltaKg !== null && Math.abs(body.deltaKg) >= 0.2
    const goalMatch = body.deltaKg !== null &&
      (i.goal === 'build-muscle' ? body.deltaKg > 0 : body.deltaKg < 0)
    if (moving && goalMatch) {
      return {
        pattern: 'great',
        tone: 'green',
        text: `${sessionPhrase(t.sessionsDone)}, ${t.hard.totalHardSets} hard sets, protein on ${dayWord(n.daysLogged - n.daysProteinUnder)}, and ${weightClause(body, i.goal)}. Everything is pointing the same direction — just keep doing this.`,
      }
    }
    return {
      pattern: 'both-good',
      tone: 'green',
      text: `${sessionPhrase(t.sessionsDone)}, ${dayWord(n.daysLogged)} logged, calories within ${fmtCal(Math.abs(n.positionKcal))} of budget. Training and eating are both where they should be — the scale will catch up.`,
    }
  }

  // ---------- training holding, food is the gap ----------
  if ((trainingGood || trainingClose) && nutritionOff) {
    const gap = proteinOff
      ? `protein under on ${dayWord(n.daysProteinUnder)}`
      : `${fmtCal(n.positionKcal)} over budget`
    return {
      pattern: 'training-good-food-off',
      tone: 'amber',
      text: `${sessionPhrase(t.sessionsDone)}, ${gap}, ${weightClause(body, i.goal)}. The training's fine — the eating is the gap, and it's the easier of the two to fix.`,
    }
  }

  // ---------- food holding, training went light ----------
  if (!trainingClose && (nutritionGood || (!nutritionOff && n.daysLogged >= 4))) {
    return {
      pattern: 'food-good-training-light',
      tone: 'amber',
      text: `${dayWord(n.daysLogged)} logged and the food side held together, but only ${sessionPhrase(t.sessionsDone).toLowerCase()} against ${planned || 3} planned. The eating is doing its job — the sessions are what's missing.`,
    }
  }

  // ---------- both drifted ----------
  if (!trainingClose && nutritionOff) {
    return {
      pattern: 'both-slipped',
      tone: 'amber',
      text: `${sessionPhrase(t.sessionsDone)} and ${dayWord(n.daysLogged)} logged — both sides drifted this week. Pick one session and one solid day of food to start next week; that's usually enough to turn it around.`,
    }
  }

  // ---------- mixed / thin tracking ----------
  const bits: string[] = [sessionPhrase(t.sessionsDone)]
  if (t.hard.totalHardSets > 0) bits.push(`${t.hard.totalHardSets} hard sets`)
  bits.push(trackingThin ? `only ${dayWord(n.daysLogged)} of food logged` : `${dayWord(n.daysLogged)} logged`)
  if (cardio.sessions > 0) bits.push(`${cardio.minutes} min of cardio`)
  const tail = trackingThin
    ? 'Log a few more days and this sentence gets a lot more useful.'
    : under
      ? 'Calories came in under budget — worth checking you actually ate that little rather than under-logging.'
      : 'Not a bad week, not a standout one. Nothing here needs fixing today.'
  return {
    pattern: 'mixed',
    tone: 'gray',
    text: `${bits.join(', ')}, ${weightClause(body, i.goal)}. ${tail}`,
  }
}
