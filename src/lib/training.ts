// ============================================================
// TRAINING ENGINE — the shared brain behind the logger.
//
// Pure functions first (easy to reason about, no React, no Dexie), then a
// handful of small Dexie helpers for per-exercise metadata and the ad-hoc
// superset map. Every load this file proposes is snapped to something the
// CURRENT equipment profile can actually build, via @/lib/plates.
//
// Nothing here prescribes. It proposes, explains itself in one line, and the
// owner accepts or ignores it.
// ============================================================

import { byId } from '@/data/exercises'
import { db } from '@/db'
import type {
  EquipmentProfile, Exercise, ExerciseMeta, LoadMode, Muscle, Profile, SetLog, WorkoutLog,
} from '@/db/types'
import { MUSCLE_LABELS } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { nearestLoad, nextLoadUp } from '@/lib/plates'
import { nowIso } from '@/lib/id'

/** Anything carrying the five fields the plate maths needs. Both `Profile` and
 *  `EquipmentProfile` satisfy this, so callers can pass either. */
export type LoadSource = Pick<
  Profile | EquipmentProfile,
  'barbellKg' | 'curlBarKg' | 'smithBarKg' | 'platePairsKg' | 'stackStepsKg'
>

// ============================================================
// 1. Estimated 1RM
// ============================================================

/** Epley estimated 1RM: w × (1 + r/30). A single rep is its own e1RM. */
export function epley1RM(weightKg: number, reps: number): number {
  if (!weightKg || !reps || reps <= 0) return 0
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30)
}

export const round1 = (n: number): number => Math.round(n * 10) / 10

/** A set counts as WORKING when it was completed and wasn't flagged a warm-up. */
export function isWorkingSet(s: SetLog): boolean {
  return s.done === true && s.warmup !== true
}

export function workingSets(sets: SetLog[]): SetLog[] {
  return sets.filter(isWorkingSet)
}

/** Every logged instance of one exercise, session by session. */
export interface SessionRollup {
  date: string
  logId: string
  /** best e1RM of the session's working sets (0 when nothing weighted) */
  e1rm: number
  /** working-set volume, kg */
  volumeKg: number
  /** working sets completed */
  hardSets: number
  /** best single-set reps (used for bodyweight lifts) */
  bestReps: number
  topWeightKg: number
  /** lowest RIR logged in the session, when he logged any */
  minRir?: number
}

/** Roll a lift up session by session, oldest → newest. */
export function exerciseRollups(logs: WorkoutLog[], exerciseId: string): SessionRollup[] {
  const out: SessionRollup[] = []
  for (const log of logs) {
    const entries = log.exercises.filter((e) => e.exerciseId === exerciseId)
    if (entries.length === 0) continue
    let e1rm = 0
    let volumeKg = 0
    let hardSets = 0
    let bestReps = 0
    let topWeightKg = 0
    let minRir: number | undefined
    for (const entry of entries) {
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue
        hardSets += 1
        const reps = s.reps ?? 0
        const kg = s.weightKg ?? 0
        if (reps > bestReps) bestReps = reps
        if (kg > topWeightKg) topWeightKg = kg
        if (kg > 0 && reps > 0) {
          volumeKg += kg * reps
          const est = epley1RM(kg, reps)
          if (est > e1rm) e1rm = est
        }
        if (typeof s.rir === 'number' && (minRir === undefined || s.rir < minRir)) minRir = s.rir
      }
    }
    if (hardSets === 0) continue
    out.push({ date: log.date, logId: log.id, e1rm, volumeKg, hardSets, bestReps, topWeightKg, minRir })
  }
  out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
  return out
}

export interface BestE1rm {
  exerciseId: string
  e1rm: number
  weightKg: number
  reps: number
  date: string
}

/** Best e1RM ever, per exercise, across every log. */
export function bestE1rmPerExercise(logs: WorkoutLog[]): Map<string, BestE1rm> {
  const map = new Map<string, BestE1rm>()
  for (const log of logs) {
    for (const entry of log.exercises) {
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue
        const kg = s.weightKg ?? 0
        const reps = s.reps ?? 0
        if (kg <= 0 || reps <= 0) continue
        const est = epley1RM(kg, reps)
        const cur = map.get(entry.exerciseId)
        if (!cur || est > cur.e1rm) {
          map.set(entry.exerciseId, {
            exerciseId: entry.exerciseId, e1rm: est, weightKg: kg, reps, date: log.date,
          })
        }
      }
    }
  }
  return map
}

/** Chart-ready e1RM series for one lift (skips sessions with no weighted work). */
export function e1rmSeries(logs: WorkoutLog[], exerciseId: string): { x: string; y: number }[] {
  return exerciseRollups(logs, exerciseId)
    .filter((r) => r.e1rm > 0)
    .map((r) => ({ x: dayjs(r.date).format('D/M'), y: Math.round(r.e1rm) }))
}

// ============================================================
// 2. Double progression
// ============================================================

export type ProgressionAction = 'add-weight' | 'add-reps' | 'repeat' | 'no-data'

export interface ProgressionAdvice {
  action: ProgressionAction
  /** achievable next load when action === 'add-weight' */
  nextKg?: number
  fromKg?: number
  /** one short line, safe to render straight into the UI */
  text: string
}

function topOfRange(exercise: Exercise | undefined, sets: SetLog[]): number {
  const fromSets = sets.find((s) => s.targetReps)?.targetReps?.[1]
  return fromSets ?? exercise?.repRange?.[1] ?? 12
}

/**
 * Double progression: reps first, then load.
 * Hit the TOP of the rep range on EVERY working set → take the next achievable
 * jump on this equipment profile. Otherwise chase reps at the same load.
 */
export function doubleProgression(
  exercise: Exercise | undefined,
  lastSets: SetLog[],
  profile: LoadSource,
): ProgressionAdvice {
  const done = workingSets(lastSets)
  if (done.length === 0) {
    return { action: 'no-data', text: 'Log a set or two and progression advice shows up here.' }
  }

  const mode: LoadMode = exercise?.loadMode ?? 'barbell'
  const top = topOfRange(exercise, lastSets)
  const allTopped = done.every((s) => (s.reps ?? 0) >= top)

  if (mode === 'time') {
    const best = Math.max(...done.map((s) => s.timeSec ?? 0))
    return {
      action: 'add-reps',
      text: best > 0 ? `Add 10-15s next time — last best was ${best}s.` : 'Add a little time next session.',
    }
  }

  if (!allTopped) {
    const short = done.filter((s) => (s.reps ?? 0) < top).length
    return {
      action: 'add-reps',
      text: `Stay at this load — ${short === done.length ? 'chase' : `${short} ${short === 1 ? 'set is' : 'sets are'} short of`} ${top} reps on every set, then the weight goes up.`,
    }
  }

  if (mode === 'bodyweight') {
    return {
      action: 'add-reps',
      text: `Every set hit ${top} reps. No load to add — slow the negative, pause the hardest point, or push the rep target up.`,
    }
  }

  const current = Math.max(...done.map((s) => s.weightKg ?? 0))
  if (current <= 0) {
    return { action: 'repeat', text: `Every set hit ${top} reps — log the weight you used so the jump can be worked out.` }
  }

  const up = nextLoadUp(mode, current, profile)
  if (up === null) {
    return {
      action: 'add-reps',
      fromKg: current,
      text: `Every set hit ${top} reps, but ${current} kg is the heaviest load you can build here — add reps or slow the tempo instead.`,
    }
  }

  const plan = nearestLoad(mode, up, profile)
  const build = plan && plan.perSide && plan.perSide.length
    ? ` (${plan.perSide.join(' + ')} each side)`
    : ''
  return {
    action: 'add-weight',
    fromKg: current,
    nextKg: up,
    text: `Every set hit ${top} reps at ${current} kg — go to ${up} kg${build} and work back up the range.`,
  }
}

// ============================================================
// 3. Deload signal
// ============================================================

export interface DeloadSignal {
  suggest: boolean
  reason: string
  /** which rule fired, for the UI to pick an icon/tone */
  rule?: 'rir-zero' | 'regression' | 'time'
}

const NO_DELOAD: DeloadSignal = { suggest: false, reason: 'Nothing says back off yet — keep pushing.' }

/** A session counts as a deload when he deliberately trimmed it or flagged it wrecked. */
function isDeloadish(log: WorkoutLog): boolean {
  return log.trimmed === true || /deload/i.test(log.title)
}

/**
 * Propose (never impose) a deload. Fires on any one of:
 *  - three sessions in a row taken to RIR 0
 *  - two sessions running where e1RM (or volume) went backwards
 *  - 6-8 weeks since the last deload / trimmed session
 */
export function deloadSignal(logs: WorkoutLog[], exerciseId?: string): DeloadSignal {
  const finished = logs
    .filter((l) => l.finishedAt)
    .slice()
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
  if (finished.length === 0) return NO_DELOAD

  // ---- rule 1: three sessions in a row at RIR 0 ----
  const relevant = exerciseId
    ? finished.filter((l) => l.exercises.some((e) => e.exerciseId === exerciseId))
    : finished
  const lastThree = relevant.slice(-3)
  if (lastThree.length === 3) {
    const allFailure = lastThree.every((l) =>
      l.exercises.some((e) =>
        (!exerciseId || e.exerciseId === exerciseId) &&
        e.sets.some((s) => isWorkingSet(s) && s.rir === 0)),
    )
    if (allFailure) {
      return {
        suggest: true,
        rule: 'rir-zero',
        reason: 'Three sessions running taken to RIR 0. A lighter week now usually buys a better month.',
      }
    }
  }

  // ---- rule 2: performance going backwards two sessions running ----
  if (exerciseId) {
    const rolls = exerciseRollups(relevant, exerciseId)
    if (rolls.length >= 3) {
      const [a, b, c] = rolls.slice(-3)
      const useE1rm = a.e1rm > 0 && b.e1rm > 0 && c.e1rm > 0
      const va = useE1rm ? a.e1rm : a.volumeKg
      const vb = useE1rm ? b.e1rm : b.volumeKg
      const vc = useE1rm ? c.e1rm : c.volumeKg
      if (va > 0 && vb < va - 0.01 && vc < vb - 0.01) {
        return {
          suggest: true,
          rule: 'regression',
          reason: `${useE1rm ? 'Estimated 1RM' : 'Volume'} has dropped two sessions in a row on this lift — that usually means fatigue, not weakness.`,
        }
      }
    }
  } else {
    const vols = finished.slice(-3).map((l) => sessionVolume(l))
    if (vols.length === 3 && vols[0] > 0 && vols[1] < vols[0] && vols[2] < vols[1]) {
      return {
        suggest: true,
        rule: 'regression',
        reason: 'Session volume has dropped two workouts in a row — a lighter week is usually the fix.',
      }
    }
  }

  // ---- rule 3: it has simply been a while ----
  const lastDeload = [...finished].reverse().find(isDeloadish)
  const anchor = lastDeload?.date ?? finished[0].date
  const weeks = Math.floor(dayjs().diff(dayjs(anchor), 'day') / 7)
  if (weeks >= 6) {
    return {
      suggest: true,
      rule: 'time',
      reason: lastDeload
        ? `${weeks} weeks since your last easy week. Six to eight is about the limit before it catches up.`
        : `${weeks} weeks of unbroken training logged. Six to eight is about the limit before it catches up.`,
    }
  }

  return NO_DELOAD
}

/** Working-set volume of one session (warm-ups excluded). */
export function sessionVolume(log: WorkoutLog): number {
  let v = 0
  for (const e of log.exercises) {
    for (const s of e.sets) {
      if (!isWorkingSet(s)) continue
      v += (s.weightKg ?? 0) * (s.reps ?? 0)
    }
  }
  return v
}

// ============================================================
// 4. Weekly hard sets per muscle — the number that matters most
// ============================================================

export type HardSetMarker = 'green' | 'amber' | 'red'

export interface MuscleHardSets {
  muscle: Muscle
  label: string
  sets: number
  marker: HardSetMarker
  /** one honest line about where this sits against the evidence range */
  note: string
}

export interface WeeklyHardSets {
  /** YYYY-MM-DD, Monday-anchored */
  weekStart: string
  /** YYYY-MM-DD, exclusive */
  weekEnd: string
  totalHardSets: number
  sessions: number
  byMuscle: MuscleHardSets[]
}

/** The evidence range most people grow in: 10-20 hard sets per muscle per week. */
export const HARD_SET_RANGE: [number, number] = [10, 20]

/** Muscles that aren't meaningful hard-set targets. */
const NON_TARGET: Muscle[] = ['cardio', 'full-body']

export function markerFor(sets: number): HardSetMarker {
  if (sets >= HARD_SET_RANGE[0] && sets <= HARD_SET_RANGE[1]) return 'green'
  if (sets >= 6 && sets < HARD_SET_RANGE[0]) return 'amber'
  if (sets > HARD_SET_RANGE[1] && sets <= 25) return 'amber'
  return 'red'
}

function noteFor(sets: number, marker: HardSetMarker): string {
  if (marker === 'green') return `In the 10-20 range`
  if (sets === 0) return 'Nothing logged this week'
  if (sets < HARD_SET_RANGE[0]) return `${HARD_SET_RANGE[0] - sets} short of 10`
  return `${sets - HARD_SET_RANGE[1]} over 20 — watch recovery`
}

/** Monday-anchored start of the week containing `d`. */
export function weekStartStr(d: string | Date = new Date()): string {
  const dd = dayjs(d)
  const dow = (dd.day() + 6) % 7
  return dd.subtract(dow, 'day').format('YYYY-MM-DD')
}

/**
 * Hard sets per muscle for one week.
 * A COMPLETED, NON-WARM-UP set counts once toward every PRIMARY muscle of the
 * exercise. Cardio work never counts. This is the single number worth reading.
 */
export function weeklyHardSets(logs: WorkoutLog[], weekStart: string | Date = new Date()): WeeklyHardSets {
  const from = weekStartStr(weekStart)
  const to = dayjs(from).add(7, 'day').format('YYYY-MM-DD')
  const counts = new Map<Muscle, number>()
  let total = 0
  const seenLogs = new Set<string>()

  for (const log of logs) {
    if (log.date < from || log.date >= to) continue
    for (const entry of log.exercises) {
      const ex = byId.get(entry.exerciseId)
      if (!ex || ex.kind === 'cardio') continue
      const hard = entry.sets.filter(isWorkingSet).length
      if (hard === 0) continue
      seenLogs.add(log.id)
      total += hard
      for (const m of ex.primary) {
        if (NON_TARGET.includes(m)) continue
        counts.set(m, (counts.get(m) ?? 0) + hard)
      }
    }
  }

  const byMuscle: MuscleHardSets[] = [...counts.entries()]
    .map(([muscle, sets]) => {
      const marker = markerFor(sets)
      return { muscle, label: MUSCLE_LABELS[muscle], sets, marker, note: noteFor(sets, marker) }
    })
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label))

  return { weekStart: from, weekEnd: to, totalHardSets: total, sessions: seenLogs.size, byMuscle }
}

// ============================================================
// 5. Warm-up ramp
// ============================================================

export interface WarmupRung {
  kg: number
  reps: number
  /** '40% · 20 kg — empty bar' */
  label: string
  pct: number
}

const RAMP: { pct: number; reps: number }[] = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
]

/**
 * Warm-up rungs up to a working load, snapped to loads this profile can
 * actually build. Duplicates and anything at/above the working load are
 * dropped, so an empty-bar-only ramp returns one rung, not three.
 */
export function warmupRamp(
  workingKg: number,
  exercise: Exercise | undefined,
  profile: LoadSource,
): WarmupRung[] {
  const mode: LoadMode = exercise?.loadMode ?? 'barbell'
  if (mode === 'bodyweight' || mode === 'time') return []
  if (!workingKg || workingKg <= 0) return []

  const out: WarmupRung[] = []
  const seen = new Set<number>()
  for (const rung of RAMP) {
    const plan = nearestLoad(mode, workingKg * rung.pct, profile)
    if (!plan) continue
    const kg = plan.totalKg
    if (kg >= workingKg) continue
    if (seen.has(kg)) continue
    seen.add(kg)
    out.push({
      kg,
      reps: rung.reps,
      pct: rung.pct,
      label: `${Math.round(rung.pct * 100)}% · ${plan.label}`,
    })
  }
  return out
}

/**
 * Warm-up rungs as ready-to-log SetLogs, flagged `warmup: true` so they never
 * count toward volume, hard sets or PRs. `startIndex` keeps set numbering sane
 * when they're pushed onto an existing list.
 */
export function warmupSets(
  workingKg: number,
  exercise: Exercise | undefined,
  profile: LoadSource,
  startIndex = 0,
): SetLog[] {
  return warmupRamp(workingKg, exercise, profile).map((rung, i) => ({
    setIndex: startIndex + i,
    targetReps: [rung.reps, rung.reps] as [number, number],
    reps: rung.reps,
    weightKg: rung.kg,
    done: false,
    warmup: true,
  }))
}

// ============================================================
// 5b. RIR — one tap, optional, never required
// ============================================================

export const RIR_CHOICES: { value: number; label: string; hint: string }[] = [
  { value: 0, label: '0', hint: 'Nothing left in the tank' },
  { value: 1, label: '1', hint: 'One more rep was there' },
  { value: 2, label: '2', hint: 'Two more reps were there' },
  { value: 3, label: '3+', hint: 'Three or more left — plenty in reserve' },
]

export function rirLabel(rir?: number): string {
  if (rir === undefined) return ''
  if (rir <= 0) return 'RIR 0 — to failure'
  if (rir >= 3) return 'RIR 3+ — comfortable'
  return `RIR ${rir} — ${rir} left`
}

// ============================================================
// 6. PR detection — weight, reps and estimated 1RM
// ============================================================

export type PRKind = 'weight' | 'reps' | 'e1rm'

export interface PRHit {
  exerciseId: string
  name: string
  kind: PRKind
  value: number
  /** null = first time this lift was logged */
  prev: number | null
  detail: string
}

export interface ExerciseBest {
  weightKg: number
  reps: number
  e1rm: number
  seen: boolean
}

const emptyBest = (): ExerciseBest => ({ weightKg: 0, reps: 0, e1rm: 0, seen: false })

/** Best weight / reps / e1RM per exercise across a set of logs. */
export function bestsPerExercise(logs: WorkoutLog[]): Map<string, ExerciseBest> {
  const map = new Map<string, ExerciseBest>()
  for (const log of logs) {
    for (const entry of log.exercises) {
      let b = map.get(entry.exerciseId)
      if (!b) {
        b = emptyBest()
        map.set(entry.exerciseId, b)
      }
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue
        b.seen = true
        const kg = s.weightKg ?? 0
        const reps = s.reps ?? 0
        if (kg > b.weightKg) b.weightKg = kg
        if (reps > b.reps) b.reps = reps
        if (kg > 0 && reps > 0) {
          const est = epley1RM(kg, reps)
          if (est > b.e1rm) b.e1rm = est
        }
      }
    }
  }
  return map
}

/** Does this single set beat the stored bests? Used live while he's logging. */
export function prsForSet(
  exerciseId: string,
  set: SetLog,
  prior: ExerciseBest | undefined,
): PRHit[] {
  if (!isWorkingSet(set)) return []
  const kg = set.weightKg ?? 0
  const reps = set.reps ?? 0
  if (reps <= 0) return []
  const name = byId.get(exerciseId)?.name ?? exerciseId
  const b = prior ?? emptyBest()
  const hits: PRHit[] = []

  if (kg > 0 && kg > b.weightKg + 0.01) {
    hits.push({
      exerciseId, name, kind: 'weight', value: round1(kg),
      prev: b.seen && b.weightKg > 0 ? round1(b.weightKg) : null,
      detail: b.seen && b.weightKg > 0
        ? `${round1(kg)} kg — heaviest yet, beat ${round1(b.weightKg)} kg`
        : `${round1(kg)} kg — first time logged`,
    })
  }
  if (kg > 0 && reps > 0) {
    const est = epley1RM(kg, reps)
    if (est > b.e1rm + 0.01) {
      hits.push({
        exerciseId, name, kind: 'e1rm', value: round1(est),
        prev: b.seen && b.e1rm > 0 ? round1(b.e1rm) : null,
        detail: b.seen && b.e1rm > 0
          ? `Est. 1RM ${round1(est)} kg — beat ${round1(b.e1rm)} kg`
          : `Est. 1RM ${round1(est)} kg`,
      })
    }
  }
  if (kg <= 0 && reps > b.reps) {
    hits.push({
      exerciseId, name, kind: 'reps', value: reps,
      prev: b.seen && b.reps > 0 ? b.reps : null,
      detail: b.seen && b.reps > 0 ? `${reps} reps — beat ${b.reps}` : `${reps} reps — first time logged`,
    })
  }
  return hits
}

/** Every PR a finished session produced, compared against all prior logs. */
export function detectPRs(log: WorkoutLog, history: WorkoutLog[]): PRHit[] {
  const prior = bestsPerExercise(history.filter((h) => h.id !== log.id))
  const out: PRHit[] = []
  const claimed = new Set<string>()
  for (const entry of log.exercises) {
    const b = prior.get(entry.exerciseId)
    // compare the session's BEST set, not every set, so one lift = one PR line
    let best: SetLog | null = null
    let bestScore = -1
    for (const s of entry.sets) {
      if (!isWorkingSet(s)) continue
      const score = (s.weightKg ?? 0) > 0
        ? epley1RM(s.weightKg ?? 0, s.reps ?? 0)
        : (s.reps ?? 0) / 1000
      if (score > bestScore) {
        bestScore = score
        best = s
      }
    }
    if (!best) continue
    for (const hit of prsForSet(entry.exerciseId, best, b)) {
      const key = `${hit.exerciseId}:${hit.kind}`
      if (claimed.has(key)) continue
      claimed.add(key)
      out.push(hit)
    }
  }
  return out
}

// ============================================================
// 7. Rest defaults derived from the exercise's role
// ============================================================

export const REST_COMPOUND_SEC = 150
export const REST_ISOLATION_SEC = 90
export const REST_CORE_SEC = 60
/** the short breath between the A1 and A2 halves of a superset */
export const SUPERSET_TRANSITION_SEC = 25

const COMPOUND_MODES: LoadMode[] = ['barbell', 'smith']

/** Is this a big multi-joint lift? Used only to pick a sane default rest. */
export function isCompound(ex: Exercise | undefined): boolean {
  if (!ex) return false
  if (ex.kind !== 'strength') return false
  const muscles = ex.primary.length + ex.secondary.length
  if (COMPOUND_MODES.includes(ex.loadMode) && muscles >= 3) return true
  // pull-ups, dips and rows are compound whatever they're loaded with
  return muscles >= 4 && ex.primary.length >= 1
}

/** Per-exercise default rest: 2.5 min compound, 90s isolation, 60s core/timed. */
export function restSecFor(ex: Exercise | undefined): number {
  if (!ex) return REST_ISOLATION_SEC
  if (ex.loadMode === 'time' || ex.kind === 'core' || ex.kind === 'mobility') return REST_CORE_SEC
  return isCompound(ex) ? REST_COMPOUND_SEC : REST_ISOLATION_SEC
}

// ============================================================
// 8. Session trimming (autoregulation)
// ============================================================

export type Readiness = 'wrecked' | 'ok' | 'strong'

export const READINESS_LABELS: Record<Readiness, string> = {
  wrecked: 'Wrecked', ok: 'OK', strong: 'Strong',
}

export interface TrimPlan {
  /** indices into log.exercises that survive the cut */
  keep: number[]
  /** indices proposed for the chop */
  drop: number[]
  keepNames: string[]
  dropNames: string[]
  text: string
}

/**
 * Cut a session down instead of skipping it: keep the top two exercises (plus
 * anything already worked) and trim the accessories. Nothing is deleted until
 * the caller commits it.
 */
export function planTrim(log: WorkoutLog, keepCount = 2): TrimPlan {
  const keep: number[] = []
  const drop: number[] = []
  log.exercises.forEach((e, i) => {
    const touched = e.sets.some((s) => s.done)
    if (i < keepCount || touched) keep.push(i)
    else drop.push(i)
  })
  const nameOf = (i: number) => byId.get(log.exercises[i].exerciseId)?.name ?? log.exercises[i].exerciseId
  const keepNames = keep.map(nameOf)
  const dropNames = drop.map(nameOf)
  return {
    keep,
    drop,
    keepNames,
    dropNames,
    text: drop.length === 0
      ? 'Nothing left to trim — this session is already short.'
      : `Keep ${keepNames.slice(0, keepCount).join(' + ')} and drop ${dropNames.length} ${dropNames.length === 1 ? 'accessory' : 'accessories'}. Something beats nothing.`,
  }
}

// ============================================================
// 9. Dexie helpers — per-exercise metadata
// ============================================================

export async function getExerciseMeta(exerciseId: string): Promise<ExerciseMeta | undefined> {
  try {
    return await db.exerciseMeta.get(exerciseId)
  } catch {
    return undefined
  }
}

export async function allExerciseMeta(): Promise<Map<string, ExerciseMeta>> {
  try {
    const rows = await db.exerciseMeta.toArray()
    return new Map(rows.map((r) => [r.exerciseId, r]))
  } catch {
    return new Map()
  }
}

async function patchMeta(exerciseId: string, patch: Partial<ExerciseMeta>): Promise<ExerciseMeta> {
  const existing = await getExerciseMeta(exerciseId)
  const next: ExerciseMeta = {
    exerciseId,
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  }
  await db.exerciseMeta.put(next)
  return next
}

/** Empty string clears the note. */
export async function setExerciseNote(exerciseId: string, note: string): Promise<ExerciseMeta> {
  const trimmed = note.trim()
  return patchMeta(exerciseId, { note: trimmed.length ? trimmed : undefined })
}

/** Flag or clear a niggle. Clearing wipes the date too, so nothing lingers. */
export async function setExerciseInjured(exerciseId: string, injured: boolean): Promise<ExerciseMeta> {
  return injured
    ? patchMeta(exerciseId, { injured: true, injuredSince: dayjs().format('YYYY-MM-DD') })
    : patchMeta(exerciseId, { injured: false, injuredSince: undefined })
}

export const isInjured = (meta?: ExerciseMeta): boolean => meta?.injured === true

/** All flagged exercises, for the "clear it" list. */
export async function injuredExercises(): Promise<ExerciseMeta[]> {
  try {
    const rows = await db.exerciseMeta.toArray()
    return rows.filter((r) => r.injured === true)
  } catch {
    return []
  }
}

// ============================================================
// 10. Dexie helpers — ad-hoc supersets
//
// PlanExercise.supersetGroup covers supersets that came from the plan.
// Groups he creates mid-session are stored per WorkoutLog in `settings`, so no
// schema change is needed and nothing about the log record changes shape.
// ============================================================

export type SupersetMap = Record<string, string>

export const supersetKey = (logId: string): string => `session:supersets:${logId}`

export async function getSessionSupersets(logId: string): Promise<SupersetMap> {
  try {
    const row = await db.settings.get(supersetKey(logId))
    const val = row?.value
    return val && typeof val === 'object' ? (val as SupersetMap) : {}
  } catch {
    return {}
  }
}

export async function saveSessionSupersets(logId: string, map: SupersetMap): Promise<void> {
  try {
    await db.settings.put({ key: supersetKey(logId), value: map })
  } catch {
    /* storage full / private mode — grouping just won't survive a reload */
  }
}

/** A1 / A2 / B1 … label for one member of a group. */
export function supersetLabel(group: string, position: number): string {
  return `${group.toUpperCase()}${position + 1}`
}

/** Next unused group letter given the groups already in play. */
export function nextGroupLetter(used: Iterable<string>): string {
  const taken = new Set([...used].map((g) => g.toUpperCase()))
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!taken.has(letter)) return letter
  }
  return 'Z'
}
