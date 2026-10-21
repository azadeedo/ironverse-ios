// ============================================================
// VOLUME INTELLIGENCE
//
// training.ts counts the hard sets he HAS done. This file looks forward and
// sideways: what the week ahead is actually planned to deliver per muscle,
// where that sits against the volume landmarks people generally grow in,
// which muscles are quietly getting less than the rest, which lifts lag their
// own stablemates, and what is still recovering.
//
// The landmarks below are RULES OF THUMB from the training literature and the
// evidence-based coaching crowd — not laws, not medicine, and not tuned to him
// personally. Every surface that renders them must say so; VOLUME_DISCLAIMER
// is there for exactly that.
// ============================================================

import { byId } from '@/data/exercises'
import type {
  Exercise, Measurement, MovementPattern, Muscle, Plan, WorkoutLog,
} from '@/db/types'
import { MUSCLE_LABELS, PATTERN_LABELS } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { inferQuality } from '@/lib/quality'
import { bestE1rmPerExercise, isWorkingSet, round1, weekStartStr } from '@/lib/training'

// ------------------------------------------------------------------
// Landmarks
// ------------------------------------------------------------------

export interface VolumeLandmarks {
  /** below this a muscle is being maintained at best */
  maintenance: number
  /** the range most people actually grow in */
  productive: [number, number]
  /** above this the recovery cost usually outruns what the sets buy */
  ceiling: number
}

export const VOLUME_LANDMARKS: VolumeLandmarks = {
  maintenance: 6,
  productive: [10, 20],
  ceiling: 25,
}

export const VOLUME_DISCLAIMER =
  'Rules of thumb, not laws. Around 10-20 hard sets per muscle per week is where most people grow; under about 6 is maintenance and over about 25 usually costs more recovery than it buys. Individual response varies a lot — your own logs beat any range.'

export type VolumeBand = 'none' | 'maintenance' | 'building' | 'productive' | 'high' | 'excessive'

export const BAND_LABELS: Record<VolumeBand, string> = {
  none: 'Nothing planned',
  maintenance: 'Maintenance',
  building: 'Below the range',
  productive: 'Productive range',
  high: 'Above the range',
  excessive: 'Likely counterproductive',
}

/** green / amber / red for the UI, without the UI having to know the numbers. */
export const BAND_TONE: Record<VolumeBand, 'gray' | 'amber' | 'green' | 'red'> = {
  none: 'gray',
  maintenance: 'amber',
  building: 'amber',
  productive: 'green',
  high: 'amber',
  excessive: 'red',
}

export function volumeBand(sets: number): VolumeBand {
  const { maintenance, productive, ceiling } = VOLUME_LANDMARKS
  if (sets <= 0) return 'none'
  if (sets < maintenance) return 'maintenance'
  if (sets < productive[0]) return 'building'
  if (sets <= productive[1]) return 'productive'
  if (sets <= ceiling) return 'high'
  return 'excessive'
}

export function bandNote(sets: number): string {
  const { maintenance, productive, ceiling } = VOLUME_LANDMARKS
  const band = volumeBand(sets)
  if (band === 'none') return 'Nothing planned for this muscle this week'
  if (band === 'maintenance') return `${sets} sets — enough to hold what you have, not to add to it`
  if (band === 'building') return `${sets} sets — ${productive[0] - sets} short of the productive range`
  if (band === 'productive') return `${sets} sets — inside the ${productive[0]}-${productive[1]} range`
  if (band === 'high') return `${sets} sets — over ${productive[1]}, worth watching how you recover`
  return `${sets} sets — past ${ceiling}, usually more than the recovery pays back`
}

// ------------------------------------------------------------------
// Muscles worth counting
// ------------------------------------------------------------------

const NON_TARGET: Muscle[] = ['cardio', 'full-body']

const countable = (m: Muscle): boolean => !NON_TARGET.includes(m)

// ------------------------------------------------------------------
// 1. Planned weekly volume
// ------------------------------------------------------------------

export interface PlannedMuscleVolume {
  muscle: Muscle
  label: string
  /** sets PLANNED for this muscle in the selected week */
  planned: number
  /** hard sets already COMPLETED against it this week (when a week is supplied) */
  done: number
  band: VolumeBand
  note: string
}

export interface PlannedWeekVolume {
  weekIndex: number
  label: string
  days: number
  totalPlannedSets: number
  byMuscle: PlannedMuscleVolume[]
  /** the highest planned figure, so bars can be scaled against the band */
  maxPlanned: number
}

/**
 * Sets per muscle PLANNED for a week of the active plan. A planned set counts
 * once toward every PRIMARY muscle of the exercise — the same rule
 * weeklyHardSets() uses for completed work, so the two are comparable.
 *
 * `logs` + `weekStart` are optional: pass them and each row also carries what
 * has actually been done so far.
 */
export function plannedWeeklyVolume(
  plan: Plan | null | undefined,
  weekIndex: number,
  opts: { logs?: WorkoutLog[]; weekStart?: string } = {},
): PlannedWeekVolume {
  const week = plan?.weeks[weekIndex - 1]
  const planned = new Map<Muscle, number>()
  let total = 0

  for (const day of week?.days ?? []) {
    for (const pe of day.exercises) {
      const ex: Exercise | undefined = byId.get(pe.exerciseId)
      if (!ex || ex.kind === 'cardio') continue
      const sets = Math.max(0, pe.sets ?? 0)
      if (sets === 0) continue
      total += sets
      for (const m of ex.primary) {
        if (!countable(m)) continue
        planned.set(m, (planned.get(m) ?? 0) + sets)
      }
    }
  }

  const done = opts.logs
    ? completedSetsPerMuscle(opts.logs, opts.weekStart ?? weekStartStr())
    : new Map<Muscle, number>()

  const muscles = [...new Set([...planned.keys(), ...done.keys()])]
  const byMuscle: PlannedMuscleVolume[] = muscles
    .map((muscle) => {
      const p = planned.get(muscle) ?? 0
      return {
        muscle,
        label: MUSCLE_LABELS[muscle],
        planned: p,
        done: done.get(muscle) ?? 0,
        band: volumeBand(p),
        note: bandNote(p),
      }
    })
    .sort((a, b) => b.planned - a.planned || a.label.localeCompare(b.label))

  return {
    weekIndex,
    label: week?.label ?? '',
    days: week?.days.length ?? 0,
    totalPlannedSets: total,
    byMuscle,
    maxPlanned: Math.max(VOLUME_LANDMARKS.productive[1], ...byMuscle.map((m) => Math.max(m.planned, m.done))),
  }
}

/** Completed hard sets per muscle inside one Monday-anchored week. */
export function completedSetsPerMuscle(
  logs: WorkoutLog[],
  weekStart: string = weekStartStr(),
): Map<Muscle, number> {
  const from = weekStartStr(weekStart)
  const to = dayjs(from).add(7, 'day').format('YYYY-MM-DD')
  return setsPerMuscleBetween(logs, from, to)
}

function setsPerMuscleBetween(logs: WorkoutLog[], from: string, to: string): Map<Muscle, number> {
  const counts = new Map<Muscle, number>()
  for (const log of logs) {
    if (log.date < from || log.date >= to) continue
    for (const entry of log.exercises) {
      const ex = byId.get(entry.exerciseId)
      if (!ex || ex.kind === 'cardio') continue
      const hard = entry.sets.filter(isWorkingSet).length
      if (hard === 0) continue
      for (const m of ex.primary) {
        if (!countable(m)) continue
        counts.set(m, (counts.get(m) ?? 0) + hard)
      }
    }
  }
  return counts
}

// ------------------------------------------------------------------
// 2. Weak points — observations, never a diagnosis
// ------------------------------------------------------------------

export type WeakPointKind = 'volume' | 'lift'

export interface WeakPoint {
  kind: WeakPointKind
  /** 'Rear delts' / 'Rows vs bench' */
  title: string
  /** what the logs actually show */
  detail: string
  /** a concrete, low-drama suggestion */
  fix: string
  /** how confident the observation is, given how much data fed it */
  strength: 'worth-a-look' | 'clear'
}

export interface WeakPointReport {
  weeks: number
  sessions: number
  observations: WeakPoint[]
  /** honest framing line the UI should always show */
  caveat: string
}

/** Rough relative-strength expectations between patterns. Not gospel. */
interface LiftRule {
  lagging: MovementPattern
  versus: MovementPattern
  /** expected lagging / versus ratio */
  expect: number
  fix: string
}

const LIFT_RULES: LiftRule[] = [
  {
    lagging: 'horizontal-pull', versus: 'horizontal-push', expect: 0.9,
    fix: 'Add a set or two of rowing per week, and run rows in the 8-12 range with a full stretch at the bottom before adding load.',
  },
  {
    lagging: 'vertical-push', versus: 'horizontal-push', expect: 0.6,
    fix: 'Put an overhead press first in one session a week while you are fresh, rather than last after pressing.',
  },
  {
    lagging: 'hinge', versus: 'squat', expect: 1,
    fix: 'Give hinging its own slot — Romanian deadlifts in the 6-10 range, loaded through the stretch.',
  },
  {
    lagging: 'vertical-pull', versus: 'vertical-push', expect: 1.2,
    fix: 'Add a weekly pulldown or pull-up session and push it close to failure — vertical pulling is usually the easiest place to find quick progress.',
  },
  {
    lagging: 'elbow-flexion', versus: 'elbow-extension', expect: 0.8,
    fix: 'Add one direct curl slot a week — biceps take direct work well and recover fast.',
  },
]

const MUSCLE_MEASUREMENT: Partial<Record<Muscle, keyof Measurement['values']>> = {
  biceps: 'biceps', chest: 'chest', quads: 'thigh', calves: 'calf',
  'side-delts': 'shoulders', abs: 'abs',
}

/**
 * Muscle groups getting materially less volume than the rest, and lifts that
 * lag their own stablemates. Both are OBSERVATIONS with a suggested fix —
 * nothing here is a diagnosis, and short histories are labelled as such.
 */
export function weakPoints(
  logs: WorkoutLog[],
  measurements: Measurement[] = [],
  opts: { weeks?: number } = {},
): WeakPointReport {
  const weeks = opts.weeks ?? 4
  const to = dayjs().add(1, 'day').format('YYYY-MM-DD')
  const from = dayjs().subtract(weeks * 7, 'day').format('YYYY-MM-DD')
  const window = logs.filter((l) => l.date >= from && l.date < to)
  const sessions = window.filter((l) => l.exercises.some((e) => e.sets.some(isWorkingSet))).length
  const caveat = `Observations from the last ${weeks} weeks (${sessions} session${sessions === 1 ? '' : 's'}) — patterns worth a look, not a diagnosis.`

  if (sessions < 3) {
    return { weeks, sessions, observations: [], caveat: `Only ${sessions} session${sessions === 1 ? '' : 's'} in the last ${weeks} weeks — not enough logged yet to say anything useful about weak points.` }
  }

  const observations: WeakPoint[] = []

  // ---- volume imbalance ----
  const counts = setsPerMuscleBetween(window, from, to)
  const rows = [...counts.entries()].map(([muscle, sets]) => ({ muscle, perWeek: sets / weeks }))
  if (rows.length >= 4) {
    const sorted = [...rows].sort((a, b) => a.perWeek - b.perWeek)
    const median = sorted[Math.floor(sorted.length / 2)].perWeek
    for (const row of sorted) {
      if (median <= 0) break
      if (row.perWeek >= median * 0.5) continue
      if (row.perWeek >= VOLUME_LANDMARKS.productive[0]) continue
      const label = MUSCLE_LABELS[row.muscle]
      const measureKey = MUSCLE_MEASUREMENT[row.muscle]
      const flatNote = measureKey ? flatMeasurementNote(measurements, measureKey, label) : ''
      observations.push({
        kind: 'volume',
        title: label,
        detail: `${round1(row.perWeek)} hard sets a week against a median of ${round1(median)} across everything you train.${flatNote}`,
        fix: row.perWeek < VOLUME_LANDMARKS.maintenance
          ? `Two or three direct sets a week would move ${label.toLowerCase()} from maintenance into something that adds size.`
          : `Adding 2-4 sets a week would bring ${label.toLowerCase()} into the ${VOLUME_LANDMARKS.productive[0]}-${VOLUME_LANDMARKS.productive[1]} range the rest of your training sits in.`,
        strength: row.perWeek < median * 0.35 ? 'clear' : 'worth-a-look',
      })
      if (observations.length >= 3) break
    }
  }

  // ---- lagging lifts, by estimated 1RM ----
  const bests = bestE1rmPerExercise(logs)
  const byPattern = new Map<MovementPattern, { e1rm: number; name: string }>()
  for (const [exerciseId, best] of bests) {
    const ex = byId.get(exerciseId)
    if (!ex || ex.kind !== 'strength') continue
    const pattern = inferQuality(ex).pattern
    const cur = byPattern.get(pattern)
    if (!cur || best.e1rm > cur.e1rm) byPattern.set(pattern, { e1rm: best.e1rm, name: ex.name })
  }

  for (const rule of LIFT_RULES) {
    const lag = byPattern.get(rule.lagging)
    const ref = byPattern.get(rule.versus)
    if (!lag || !ref || lag.e1rm <= 0 || ref.e1rm <= 0) continue
    const actual = lag.e1rm / ref.e1rm
    if (actual >= rule.expect * 0.85) continue
    observations.push({
      kind: 'lift',
      title: `${PATTERN_LABELS[rule.lagging]} vs ${PATTERN_LABELS[rule.versus].toLowerCase()}`,
      detail: `${lag.name} sits at an estimated ${round1(lag.e1rm)} kg against ${round1(ref.e1rm)} kg on ${lag.name === ref.name ? 'your best press' : ref.name.toLowerCase()} — about ${Math.round(actual * 100)}% where roughly ${Math.round(rule.expect * 100)}% is the usual shape. These ratios vary a lot between people and between builds, so read it as a nudge, not a rule.`,
      fix: rule.fix,
      strength: actual < rule.expect * 0.7 ? 'clear' : 'worth-a-look',
    })
    if (observations.length >= 5) break
  }

  return { weeks, sessions, observations, caveat }
}

function flatMeasurementNote(
  measurements: Measurement[],
  key: keyof Measurement['values'],
  label: string,
): string {
  const rows = measurements
    .filter((m) => typeof m.values[key] === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
  if (rows.length < 2) return ''
  const first = rows[0]
  const last = rows[rows.length - 1]
  const weeks = Math.round(dayjs(last.date).diff(dayjs(first.date), 'day') / 7)
  if (weeks < 8) return ''
  const delta = (last.values[key] ?? 0) - (first.values[key] ?? 0)
  if (Math.abs(delta) > 0.5) return ''
  return ` Your ${label.toLowerCase()} measurement has also moved less than half a centimetre across ${weeks} weeks.`
}

// ------------------------------------------------------------------
// 3. Recovery status
// ------------------------------------------------------------------

export type RecoveryState = 'cooking' | 'recovering' | 'ready' | 'overdue'

export const RECOVERY_LABELS: Record<RecoveryState, string> = {
  // qualified on purpose (IV-33D): these are estimates from his log, not measurements
  cooking: 'Likely still recovering',
  recovering: 'Probably recovering',
  ready: 'Likely ready',
  overdue: 'Not trained recently',
}

export const RECOVERY_TONE: Record<RecoveryState, 'red' | 'amber' | 'green' | 'gray'> = {
  cooking: 'red', recovering: 'amber', ready: 'green', overdue: 'gray',
}

export interface MuscleRecovery {
  muscle: Muscle
  label: string
  /** whole days since the last hard set touched this muscle */
  daysSince: number
  lastDate: string
  lastTitle: string
  setsThatDay: number
  state: RecoveryState
  note: string
}

/**
 * Days since each muscle group was last trained. Protein synthesis and soreness
 * timelines vary; these bands are a practical read, not physiology:
 *  0-1 day = still cooking, 2 = recovering, 3-6 = ready, 7+ = been a while.
 */
export function recoveryStatus(
  logs: WorkoutLog[],
  opts: { asOf?: string; withinDays?: number } = {},
): MuscleRecovery[] {
  const asOf = dayjs(opts.asOf ?? undefined).startOf('day')
  const within = opts.withinDays ?? 28
  const last = new Map<Muscle, { date: string; title: string; sets: number }>()

  for (const log of logs) {
    if (asOf.diff(dayjs(log.date), 'day') > within) continue
    for (const entry of log.exercises) {
      const ex = byId.get(entry.exerciseId)
      if (!ex || ex.kind === 'cardio') continue
      const hard = entry.sets.filter(isWorkingSet).length
      if (hard === 0) continue
      for (const m of ex.primary) {
        if (!countable(m)) continue
        const cur = last.get(m)
        if (!cur || log.date > cur.date) {
          last.set(m, { date: log.date, title: log.title, sets: hard })
        } else if (log.date === cur.date) {
          cur.sets += hard
        }
      }
    }
  }

  const out: MuscleRecovery[] = [...last.entries()].map(([muscle, row]) => {
    const days = Math.max(0, asOf.diff(dayjs(row.date), 'day'))
    const state: RecoveryState =
      days <= 1 ? 'cooking' : days === 2 ? 'recovering' : days <= 6 ? 'ready' : 'overdue'
    return {
      muscle,
      label: MUSCLE_LABELS[muscle],
      daysSince: days,
      lastDate: row.date,
      lastTitle: row.title,
      setsThatDay: row.sets,
      state,
      note:
        state === 'cooking' ? `Trained ${days === 0 ? 'today' : 'yesterday'} — give it another day`
          : state === 'recovering' ? 'Two days out — fine to train again if it feels good'
            : state === 'ready' ? `${days} days out — ready to go`
              : `${days} days since you trained it`,
    }
  })

  return out.sort((a, b) => b.daysSince - a.daysSince || a.label.localeCompare(b.label))
}

// ------------------------------------------------------------------
// 4. Strength standards (bodyweight multiples)
// ------------------------------------------------------------------

export interface StandardBand {
  /** multiple of bodyweight */
  x: number
  label: string
}

export interface StrengthStandard {
  exerciseId: string
  name: string
  e1rm: number
  ratio: number
  /** where this sits, in plain language */
  level: string
  context: string
  bands: StandardBand[]
}

/**
 * Widely-quoted male bodyweight multiples for the main barbell lifts. They come
 * from gym convention rather than any single study, they shift with height,
 * limb length, age and training years, and they are NOT a judgement — the only
 * number that matters is whether yours is going up.
 */
const STANDARD_TABLE: { patterns: MovementPattern[]; bands: StandardBand[] }[] = [
  {
    patterns: ['horizontal-push'],
    bands: [
      { x: 0.5, label: 'getting started' },
      { x: 0.75, label: 'novice' },
      { x: 1, label: 'solid intermediate' },
      { x: 1.25, label: 'strong' },
      { x: 1.5, label: 'advanced' },
    ],
  },
  {
    patterns: ['squat', 'leg-press'],
    bands: [
      { x: 0.75, label: 'getting started' },
      { x: 1, label: 'novice' },
      { x: 1.5, label: 'solid intermediate' },
      { x: 1.75, label: 'strong' },
      { x: 2, label: 'advanced' },
    ],
  },
  {
    patterns: ['hinge'],
    bands: [
      { x: 1, label: 'getting started' },
      { x: 1.25, label: 'novice' },
      { x: 1.75, label: 'solid intermediate' },
      { x: 2, label: 'strong' },
      { x: 2.5, label: 'advanced' },
    ],
  },
  {
    patterns: ['vertical-push'],
    bands: [
      { x: 0.35, label: 'getting started' },
      { x: 0.5, label: 'novice' },
      { x: 0.65, label: 'solid intermediate' },
      { x: 0.8, label: 'strong' },
      { x: 1, label: 'advanced' },
    ],
  },
  {
    patterns: ['horizontal-pull'],
    bands: [
      { x: 0.5, label: 'getting started' },
      { x: 0.75, label: 'novice' },
      { x: 1, label: 'solid intermediate' },
      { x: 1.25, label: 'strong' },
      { x: 1.5, label: 'advanced' },
    ],
  },
]

export const STANDARDS_DISCLAIMER =
  'Bodyweight multiples are gym convention, not science — they move with height, limb length, age and years trained, and your estimated 1RM is itself an estimate from your best set. The useful number is whether yours is climbing.'

function bandFor(ratio: number, bands: StandardBand[]): { level: string; next?: StandardBand } {
  let level = 'building your base'
  let next: StandardBand | undefined = bands[0]
  for (const b of bands) {
    if (ratio >= b.x) {
      level = b.label
      next = bands[bands.indexOf(b) + 1]
    }
  }
  return { level, next }
}

/**
 * His estimated 1RM on the main lifts as a multiple of bodyweight, with plain
 * encouraging language. One row per pattern, using his best lift in it.
 */
export function strengthStandards(logs: WorkoutLog[], bodyweightKg: number): StrengthStandard[] {
  if (!bodyweightKg || bodyweightKg <= 0) return []
  const bests = bestE1rmPerExercise(logs)
  const byPattern = new Map<MovementPattern, { e1rm: number; ex: Exercise }>()

  for (const [exerciseId, best] of bests) {
    const ex = byId.get(exerciseId)
    if (!ex || ex.kind !== 'strength' || best.e1rm <= 0) continue
    const pattern = inferQuality(ex).pattern
    const cur = byPattern.get(pattern)
    if (!cur || best.e1rm > cur.e1rm) byPattern.set(pattern, { e1rm: best.e1rm, ex })
  }

  const out: StrengthStandard[] = []
  for (const row of STANDARD_TABLE) {
    let pick: { pattern: MovementPattern; e1rm: number; ex: Exercise } | null = null
    for (const pattern of row.patterns) {
      const found = byPattern.get(pattern)
      if (found && (!pick || found.e1rm > pick.e1rm)) pick = { pattern, ...found }
    }
    if (!pick) continue
    const ratio = pick.e1rm / bodyweightKg
    const { level, next } = bandFor(ratio, row.bands)
    const nextLine = next
      ? ` Next mark is ${next.x}× bodyweight — about ${round1(next.x * bodyweightKg)} kg.`
      : ' You are past the top of the usual table on this one.'
    out.push({
      exerciseId: pick.ex.id,
      name: pick.ex.name,
      e1rm: round1(pick.e1rm),
      ratio: Math.round(ratio * 100) / 100,
      level,
      context: `${Math.round(ratio * 100) / 100}× bodyweight — a ${level} mark for this lift.${nextLine}`,
      bands: row.bands,
    })
  }
  return out.sort((a, b) => b.ratio - a.ratio)
}
