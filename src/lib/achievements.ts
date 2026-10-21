// ============================================================
// ACHIEVEMENTS — derived entirely from what he actually logged.
//
// Three rules, and they are not negotiable:
//  1. Nothing is awarded that wasn't earned. Every badge carries the exact
//     record that triggered it and the date it happened.
//  2. Nothing unearned is ever framed as a failure. The "next up" list states
//     a number and stops. No streak-loss guilt, no red, no "you missed".
//  3. Thin data says so. A brand-new log gets an honest "not enough yet"
//     rather than a wall of participation trophies.
//
// Pure functions over rows, so this is testable and the screen stays dumb.
// ============================================================

import { db } from '@/db'
import { byId as exerciseById } from '@/data/exercises'
import type {
  CreatineLog, FoodLogEntry, Profile, SetLog, WaterLog, WeighIn, WorkoutLog,
} from '@/db/types'
import { dayjs } from './fmt'

export type AchievementCategory =
  | 'consistency' | 'volume' | 'strength' | 'bodyweight' | 'habit'

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  consistency: 'Consistency',
  volume: 'Volume moved',
  strength: 'Strength',
  bodyweight: 'Bodyweight',
  habit: 'Daily habits',
}

/** Icon keys — the screen maps these to lucide components. No emoji. */
export type AchievementIcon =
  | 'flame' | 'calendar' | 'weight' | 'dumbbell' | 'trending-down'
  | 'trending-up' | 'droplets' | 'pill' | 'utensils' | 'repeat' | 'medal'

export interface Achievement {
  id: string
  category: AchievementCategory
  title: string
  /** the literal record that earned it — never a generic blurb */
  evidence: string
  /** YYYY-MM-DD the threshold was crossed */
  date: string
  icon: AchievementIcon
}

export interface NextUp {
  id: string
  category: AchievementCategory
  title: string
  icon: AchievementIcon
  /** neutral, factual. "42 of 50 sessions logged." */
  note: string
  current: number
  target: number
}

export interface AchievementReport {
  earned: Achievement[]
  next: NextUp[]
  /** true when there simply isn't enough logged to say anything meaningful */
  thin: boolean
  thinReason?: string
  totals: {
    sessions: number
    workingSets: number
    volumeKg: number
    weighIns: number
    foodDays: number
  }
}

// ---------- helpers ----------

const isWorking = (s: SetLog): boolean =>
  s.done === true && s.warmup !== true && (s.reps ?? 0) > 0

const fmtDay = (d: string): string => dayjs(d).format('D MMM YYYY')
const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-AU')
const kg1 = (n: number): string => (n % 1 === 0 ? String(n) : n.toFixed(1))

function exerciseName(id: string): string {
  return exerciseById.get(id)?.name ?? id
}

/** Longest run of consecutive dates in a set, and the date it ended. */
function longestRun(dates: Iterable<string>): { days: number; endedOn: string | null } {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let bestEnd: string | null = null
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && dayjs(d).diff(dayjs(prev), 'day') === 1 ? run + 1 : 1
    if (run > best) { best = run; bestEnd = d }
    prev = d
  }
  return { days: best, endedOn: bestEnd }
}

/**
 * Walk ascending thresholds against a cumulative series and emit one
 * achievement per crossed threshold, using the row that crossed it.
 */
function crossings<T>(
  rows: T[],
  thresholds: number[],
  valueOf: (row: T) => number,
  dateOf: (row: T) => string,
  make: (threshold: number, row: T, runningTotal: number, index: number) => Achievement,
): { earned: Achievement[]; total: number } {
  const earned: Achievement[] = []
  let total = 0
  let ti = 0
  rows.forEach((row, i) => {
    total += valueOf(row)
    while (ti < thresholds.length && total >= thresholds[ti]) {
      earned.push(make(thresholds[ti], row, total, i))
      ti++
    }
    void dateOf
  })
  return { earned, total }
}

function nextThreshold(thresholds: number[], current: number): number | null {
  for (const t of thresholds) if (current < t) return t
  return null
}

// ---------- thresholds ----------

const SESSION_MARKS = [1, 10, 25, 50, 100, 250, 500]
const WEEK_STREAK_MARKS = [2, 4, 8, 12, 26, 52]
const VOLUME_MARKS = [25_000, 100_000, 250_000, 1_000_000, 5_000_000, 10_000_000]
const SESSION_VOLUME_MARKS = [3_000, 6_000, 10_000, 15_000, 20_000]
const LOAD_MARKS = [40, 60, 80, 100, 120, 140, 160, 180, 200]
const REP_MARKS = [10, 12, 15, 20, 25]
const BODYWEIGHT_MARKS = [1, 2, 3, 5, 7.5, 10, 15, 20]
const WEIGHIN_MARKS = [10, 25, 50, 100, 250]
const FOOD_DAY_MARKS = [7, 30, 100, 365]
const FOOD_STREAK_MARKS = [7, 14, 30, 60]
const WATER_DAY_MARKS = [10, 50, 100]
const CREATINE_STREAK_MARKS = [7, 30, 90]

// ---------- the calculation ----------

export interface AchievementInput {
  logs: WorkoutLog[]
  weighIns: WeighIn[]
  foodLog: FoodLogEntry[]
  waterLog: WaterLog[]
  creatineLog: CreatineLog[]
  profile?: Profile
}

export function computeAchievements(input: AchievementInput): AchievementReport {
  const { profile } = input
  const earned: Achievement[] = []
  const next: NextUp[] = []

  // only sessions with real work in them count as sessions
  const logs = input.logs
    .filter((l) => l.exercises.some((e) => e.sets.some(isWorking)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))

  const weighIns = [...input.weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const foodDays = new Set(input.foodLog.map((f) => f.date))
  const waterByDay = new Map<string, number>()
  for (const w of input.waterLog) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml)
  const creatineDays = new Set(input.creatineLog.filter((c) => c.taken).map((c) => c.date))

  // ---------- session counts ----------
  logs.forEach((log, i) => {
    const n = i + 1
    if (!SESSION_MARKS.includes(n)) return
    earned.push({
      id: `sessions-${n}`,
      category: 'consistency',
      title: n === 1 ? 'First session logged' : `${fmtInt(n)} sessions logged`,
      evidence: `Session ${fmtInt(n)} was "${log.title}" on ${fmtDay(log.date)}.`,
      date: log.date,
      icon: n === 1 ? 'medal' : 'calendar',
    })
  })
  const nextSessions = nextThreshold(SESSION_MARKS, logs.length)
  if (nextSessions !== null) {
    next.push({
      id: 'sessions-next',
      category: 'consistency',
      title: `${fmtInt(nextSessions)} sessions logged`,
      icon: 'calendar',
      note: `${fmtInt(logs.length)} logged so far.`,
      current: logs.length,
      target: nextSessions,
    })
  }

  // ---------- consecutive training weeks (2+ sessions each) ----------
  const perWeek = new Map<string, number>()
  for (const log of logs) {
    const monday = dayjs(log.date).startOf('week').add(1, 'day')
    const key = (dayjs(log.date).day() === 0 ? monday.subtract(7, 'day') : monday).format('YYYY-MM-DD')
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1)
  }
  const goodWeeks = [...perWeek.entries()].filter(([, n]) => n >= 2).map(([w]) => w).sort()
  let weekRun = 0
  let bestWeekRun = 0
  let bestWeekEnd: string | null = null
  let prevWeek: string | null = null
  const weekRunEndFor = new Map<number, string>()
  for (const w of goodWeeks) {
    weekRun = prevWeek && dayjs(w).diff(dayjs(prevWeek), 'day') === 7 ? weekRun + 1 : 1
    if (!weekRunEndFor.has(weekRun)) weekRunEndFor.set(weekRun, w)
    if (weekRun > bestWeekRun) { bestWeekRun = weekRun; bestWeekEnd = w }
    prevWeek = w
  }
  for (const mark of WEEK_STREAK_MARKS) {
    if (bestWeekRun < mark) break
    const endWeek = weekRunEndFor.get(mark) ?? bestWeekEnd ?? ''
    earned.push({
      id: `week-streak-${mark}`,
      category: 'consistency',
      title: `${mark} weeks straight`,
      evidence: `${mark} consecutive weeks with at least 2 sessions each, reached in the week of ${fmtDay(endWeek)}.`,
      date: endWeek,
      icon: 'flame',
    })
  }
  const nextWeekRun = nextThreshold(WEEK_STREAK_MARKS, bestWeekRun)
  if (nextWeekRun !== null) {
    next.push({
      id: 'week-streak-next',
      category: 'consistency',
      title: `${nextWeekRun} weeks straight`,
      icon: 'flame',
      note: bestWeekRun === 0
        ? 'A week counts once it has 2 sessions in it.'
        : `Best run so far is ${bestWeekRun} week${bestWeekRun === 1 ? '' : 's'}.`,
      current: bestWeekRun,
      target: nextWeekRun,
    })
  }

  // ---------- volume moved ----------
  const sessionVolumes = logs.map((log) => {
    let vol = 0
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (!isWorking(s)) continue
        vol += (s.weightKg ?? 0) * (s.reps ?? 0)
      }
    }
    return { log, vol }
  })

  const volResult = crossings(
    sessionVolumes,
    VOLUME_MARKS,
    (r) => r.vol,
    (r) => r.log.date,
    (mark, r) => ({
      id: `volume-${mark}`,
      category: 'volume' as const,
      title: `${fmtInt(mark)} kg lifted`,
      evidence: `Total working-set volume passed ${fmtInt(mark)} kg during "${r.log.title}" on ${fmtDay(r.log.date)}.`,
      date: r.log.date,
      icon: 'weight' as const,
    }),
  )
  earned.push(...volResult.earned)
  const totalVolume = volResult.total
  const nextVolume = nextThreshold(VOLUME_MARKS, totalVolume)
  if (nextVolume !== null) {
    next.push({
      id: 'volume-next',
      category: 'volume',
      title: `${fmtInt(nextVolume)} kg lifted`,
      icon: 'weight',
      note: `${fmtInt(totalVolume)} kg moved so far.`,
      current: totalVolume,
      target: nextVolume,
    })
  }

  // ---------- biggest single session ----------
  let bestSession = { vol: 0, log: null as WorkoutLog | null }
  for (const s of sessionVolumes) if (s.vol > bestSession.vol) bestSession = { vol: s.vol, log: s.log }
  for (const mark of SESSION_VOLUME_MARKS) {
    if (bestSession.vol < mark || !bestSession.log) continue
    // the achievement belongs to the FIRST session that cleared the mark
    const first = sessionVolumes.find((s) => s.vol >= mark)
    if (!first) continue
    earned.push({
      id: `session-volume-${mark}`,
      category: 'volume',
      title: `${fmtInt(mark)} kg in one session`,
      evidence: `"${first.log.title}" on ${fmtDay(first.log.date)} totalled ${fmtInt(first.vol)} kg.`,
      date: first.log.date,
      icon: 'dumbbell',
    })
  }
  const nextSessionVol = nextThreshold(SESSION_VOLUME_MARKS, bestSession.vol)
  if (nextSessionVol !== null) {
    next.push({
      id: 'session-volume-next',
      category: 'volume',
      title: `${fmtInt(nextSessionVol)} kg in one session`,
      icon: 'dumbbell',
      note: bestSession.vol > 0
        ? `Biggest session so far: ${fmtInt(bestSession.vol)} kg.`
        : 'Log a session with weights to start this one.',
      current: bestSession.vol,
      target: nextSessionVol,
    })
  }

  // ---------- heaviest working set ----------
  interface SetHit { date: string; exerciseId: string; weight: number; reps: number; title: string }
  const allSets: SetHit[] = []
  for (const log of logs) {
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        if (!isWorking(s)) continue
        allSets.push({
          date: log.date,
          exerciseId: ex.exerciseId,
          weight: s.weightKg ?? 0,
          reps: s.reps ?? 0,
          title: log.title,
        })
      }
    }
  }
  const heaviest = allSets.reduce((m, s) => Math.max(m, s.weight), 0)
  for (const mark of LOAD_MARKS) {
    if (heaviest < mark) break
    const first = allSets.find((s) => s.weight >= mark)
    if (!first) continue
    earned.push({
      id: `load-${mark}`,
      category: 'strength',
      title: `${mark} kg on the bar`,
      evidence: `First working set at ${mark} kg or more: ${exerciseName(first.exerciseId)} ${kg1(first.weight)} kg × ${first.reps} on ${fmtDay(first.date)}.`,
      date: first.date,
      icon: 'dumbbell',
    })
  }
  const nextLoad = nextThreshold(LOAD_MARKS, heaviest)
  if (nextLoad !== null) {
    next.push({
      id: 'load-next',
      category: 'strength',
      title: `${nextLoad} kg on the bar`,
      icon: 'dumbbell',
      note: heaviest > 0 ? `Heaviest working set so far: ${kg1(heaviest)} kg.` : 'Log a weighted working set to start this one.',
      current: heaviest,
      target: nextLoad,
    })
  }

  // ---------- rep targets (loaded sets only) ----------
  const loadedSets = allSets.filter((s) => s.weight > 0)
  const bestReps = loadedSets.reduce((m, s) => Math.max(m, s.reps), 0)
  for (const mark of REP_MARKS) {
    if (bestReps < mark) break
    const first = loadedSets.find((s) => s.reps >= mark)
    if (!first) continue
    earned.push({
      id: `reps-${mark}`,
      category: 'strength',
      title: `${mark} reps in one set`,
      evidence: `First loaded set of ${mark}+ reps: ${exerciseName(first.exerciseId)} ${kg1(first.weight)} kg × ${first.reps} on ${fmtDay(first.date)}.`,
      date: first.date,
      icon: 'repeat',
    })
  }
  const nextReps = nextThreshold(REP_MARKS, bestReps)
  if (nextReps !== null) {
    next.push({
      id: 'reps-next',
      category: 'strength',
      title: `${nextReps} reps in one set`,
      icon: 'repeat',
      note: bestReps > 0 ? `Best loaded set so far: ${bestReps} reps.` : 'Counts loaded sets only.',
      current: bestReps,
      target: nextReps,
    })
  }

  // ---------- bodyweight ----------
  const start = weighIns[0]
  const latest = weighIns[weighIns.length - 1]
  const goal = profile?.goal ?? 'recomp'
  // "toward the goal" — losing counts for lose-fat/recomp, gaining for build-muscle
  const direction: 1 | -1 = goal === 'build-muscle' ? 1 : -1
  if (start && latest && weighIns.length >= 2) {
    let bestMove = 0
    let bestRow: WeighIn | null = null
    const firstAt = new Map<number, WeighIn>()
    for (const w of weighIns) {
      const move = (w.weightKg - start.weightKg) * direction
      if (move > bestMove) { bestMove = move; bestRow = w }
      for (const mark of BODYWEIGHT_MARKS) {
        if (move >= mark && !firstAt.has(mark)) firstAt.set(mark, w)
      }
    }
    for (const mark of BODYWEIGHT_MARKS) {
      const row = firstAt.get(mark)
      if (!row) continue
      earned.push({
        id: `bodyweight-${mark}`,
        category: 'bodyweight',
        title: direction === -1 ? `${kg1(mark)} kg down` : `${kg1(mark)} kg up`,
        evidence: `${kg1(row.weightKg)} kg on ${fmtDay(row.date)} — ${kg1(Math.abs(row.weightKg - start.weightKg))} kg ${direction === -1 ? 'below' : 'above'} your first weigh-in (${kg1(start.weightKg)} kg on ${fmtDay(start.date)}).`,
        date: row.date,
        icon: direction === -1 ? 'trending-down' : 'trending-up',
      })
    }
    const nextBw = nextThreshold(BODYWEIGHT_MARKS, Math.max(0, bestMove))
    if (nextBw !== null) {
      next.push({
        id: 'bodyweight-next',
        category: 'bodyweight',
        title: direction === -1 ? `${kg1(nextBw)} kg down` : `${kg1(nextBw)} kg up`,
        icon: direction === -1 ? 'trending-down' : 'trending-up',
        note: bestMove > 0
          ? `Best so far: ${kg1(bestMove)} kg from ${kg1(start.weightKg)} kg${bestRow ? ` (on ${fmtDay(bestRow.date)})` : ''}.`
          : `Measured from your first weigh-in, ${kg1(start.weightKg)} kg on ${fmtDay(start.date)}.`,
        current: Math.max(0, bestMove),
        target: nextBw,
      })
    }
  }

  for (const mark of WEIGHIN_MARKS) {
    if (weighIns.length < mark) break
    const row = weighIns[mark - 1]
    earned.push({
      id: `weighins-${mark}`,
      category: 'bodyweight',
      title: `${fmtInt(mark)} weigh-ins`,
      evidence: `Weigh-in number ${fmtInt(mark)} was ${kg1(row.weightKg)} kg on ${fmtDay(row.date)}.`,
      date: row.date,
      icon: 'weight',
    })
  }
  const nextWeighIn = nextThreshold(WEIGHIN_MARKS, weighIns.length)
  if (nextWeighIn !== null) {
    next.push({
      id: 'weighins-next',
      category: 'bodyweight',
      title: `${fmtInt(nextWeighIn)} weigh-ins`,
      icon: 'weight',
      note: `${fmtInt(weighIns.length)} logged so far.`,
      current: weighIns.length,
      target: nextWeighIn,
    })
  }

  // ---------- daily habits ----------
  const foodDayList = [...foodDays].sort()
  for (const mark of FOOD_DAY_MARKS) {
    if (foodDayList.length < mark) break
    earned.push({
      id: `food-days-${mark}`,
      category: 'habit',
      title: `${fmtInt(mark)} days of food logged`,
      evidence: `Day ${fmtInt(mark)} with food logged was ${fmtDay(foodDayList[mark - 1])}.`,
      date: foodDayList[mark - 1],
      icon: 'utensils',
    })
  }
  const nextFoodDays = nextThreshold(FOOD_DAY_MARKS, foodDayList.length)
  if (nextFoodDays !== null) {
    next.push({
      id: 'food-days-next',
      category: 'habit',
      title: `${fmtInt(nextFoodDays)} days of food logged`,
      icon: 'utensils',
      note: `${fmtInt(foodDayList.length)} day${foodDayList.length === 1 ? '' : 's'} logged so far.`,
      current: foodDayList.length,
      target: nextFoodDays,
    })
  }

  const foodStreak = longestRun(foodDayList)
  for (const mark of FOOD_STREAK_MARKS) {
    if (foodStreak.days < mark || !foodStreak.endedOn) break
    earned.push({
      id: `food-streak-${mark}`,
      category: 'habit',
      title: `${mark} days of food in a row`,
      evidence: `Longest unbroken run of food logging is ${foodStreak.days} days, ending ${fmtDay(foodStreak.endedOn)}.`,
      date: foodStreak.endedOn,
      icon: 'flame',
    })
  }

  const waterTarget = profile?.waterTargetMl ?? 0
  const waterHitDays = waterTarget > 0
    ? [...waterByDay.entries()].filter(([, ml]) => ml >= waterTarget).map(([d]) => d).sort()
    : []
  for (const mark of WATER_DAY_MARKS) {
    if (waterHitDays.length < mark) break
    earned.push({
      id: `water-days-${mark}`,
      category: 'habit',
      title: `${fmtInt(mark)} days on your water target`,
      evidence: `Day ${fmtInt(mark)} at or above ${(waterTarget / 1000).toFixed(2).replace(/\.?0+$/, '')} L was ${fmtDay(waterHitDays[mark - 1])}.`,
      date: waterHitDays[mark - 1],
      icon: 'droplets',
    })
  }

  const creatineStreak = longestRun(creatineDays)
  for (const mark of CREATINE_STREAK_MARKS) {
    if (creatineStreak.days < mark || !creatineStreak.endedOn) break
    earned.push({
      id: `creatine-streak-${mark}`,
      category: 'habit',
      title: `${mark} days of creatine in a row`,
      evidence: `Longest unbroken run is ${creatineStreak.days} days, ending ${fmtDay(creatineStreak.endedOn)}.`,
      date: creatineStreak.endedOn,
      icon: 'pill',
    })
  }

  // ---------- v6: program milestones (only from real logged sets) ----------
  const doneSets = (id: string) => logs.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((x) => x.done && !x.warmup && !x.failed).map((x) => ({ s: x, date: l.date }))))
  const pullUps = doneSets('pull-up').sort((a, b) => a.date.localeCompare(b.date))
  for (const mark of [1, 5, 10]) {
    const hit = pullUps.find((p) => (p.s.reps ?? 0) >= mark)
    if (hit) earned.push({ id: `pullup-${mark}`, category: 'strength', title: mark === 1 ? 'First pull-up' : `${mark} pull-ups in a set`, evidence: `${hit.s.reps} bodyweight pull-ups on ${fmtDay(hit.date)}.`, date: hit.date, icon: 'medal' })
  }
  const bench100 = doneSets('barbell-bench-press').filter((p) => (p.s.weightKg ?? 0) >= 100).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (bench100) earned.push({ id: 'bench-100', category: 'strength', title: 'First 100 kg bench', evidence: `${bench100.s.weightKg} kg × ${bench100.s.reps} on ${fmtDay(bench100.date)}.`, date: bench100.date, icon: 'dumbbell' })
  for (const [lift, id] of [['Squat', 'barbell-squat'], ['Bench', 'barbell-bench-press'], ['Deadlift', 'barbell-deadlift']] as const) {
    // a PR = a completed single heavier than every earlier completed single
    let best = 0
    let last: { kg: number; date: string; prev: number } | null = null
    for (const p of doneSets(id).filter((x) => x.s.reps === 1).sort((a, b) => a.date.localeCompare(b.date))) {
      const kg = p.s.weightKg ?? 0
      if (kg > best) { if (best > 0) last = { kg, date: p.date, prev: best }; best = kg }
    }
    if (last) earned.push({ id: `pr-${id}`, category: 'strength', title: `New ${lift} PR`, evidence: `${last.kg} kg single on ${fmtDay(last.date)} — previous best ${last.prev} kg.`, date: last.date, icon: 'trending-up' })
  }
  const goalKg = profile?.goalWeightKg
  if (goalKg && weighIns.length) {
    const reached = weighIns.find((w) => w.weightKg <= goalKg)
    if (reached) earned.push({ id: 'goal-weight', category: 'bodyweight', title: `${kg1(goalKg)} kg goal reached`, evidence: `${kg1(reached.weightKg)} kg on ${fmtDay(reached.date)}.`, date: reached.date, icon: 'medal' })
  }
  const programWeeks = new Set(logs.filter((l) => /^p12-w\d+-/.test(l.dayId ?? '') && l.status === 'completed').map((l) => (l.dayId ?? '').split('-')[1]))
  if (programWeeks.has('w12')) {
    const fin = logs.filter((l) => /^p12-w12-/.test(l.dayId ?? '')).sort((a, b) => b.date.localeCompare(a.date))[0]
    earned.push({ id: 'program-12', category: 'consistency', title: '12-week program complete', evidence: `Sessions logged in ${programWeeks.size} of the 12 program weeks, finishing on ${fmtDay(fin.date)}.`, date: fin.date, icon: 'medal' })
  }

  // ---------- assemble ----------
  earned.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
  next.sort((a, b) => (b.current / b.target) - (a.current / a.target))

  const workingSets = allSets.length
  const thin = logs.length === 0 && weighIns.length < 2 && foodDays.size === 0
  return {
    earned,
    next,
    thin,
    thinReason: thin
      ? 'Nothing has been logged yet, so there is nothing here that would be true. Log a session, a weigh-in or a meal and this fills in on its own.'
      : undefined,
    totals: {
      sessions: logs.length,
      workingSets,
      volumeKg: totalVolume,
      weighIns: weighIns.length,
      foodDays: foodDays.size,
    },
  }
}

/** Load everything this needs out of Dexie, then compute. */
export async function loadAchievements(): Promise<AchievementReport> {
  const [logs, weighIns, foodLog, waterLog, creatineLog, profile] = await Promise.all([
    db.workoutLogs.toArray(),
    db.weighIns.toArray(),
    db.foodLog.toArray(),
    db.waterLog.toArray(),
    db.creatineLog.toArray(),
    db.profile.get('me'),
  ])
  return computeAchievements({ logs, weighIns, foodLog, waterLog, creatineLog, profile })
}

/** Newest few, for a compact card elsewhere in the app. */
export function recentAchievements(report: AchievementReport, n = 3): Achievement[] {
  return report.earned.slice(0, n)
}
