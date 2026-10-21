// Session player helpers: achievable-load stepping, labels, volume,
// calories and PR detection. All load maths goes through @/lib/plates.

import { byId } from '@/data/exercises'
import type { Exercise, LoadMode, PlanExercise, Profile, SetLog, WorkoutLog } from '@/db/types'
import { barLoads, nearestLoad } from '@/lib/plates'
import { entryExtraVolumeKg, type ModedEntry } from '@/lib/setmodes'

export type PlateProfile = Pick<
  Profile,
  'barbellKg' | 'curlBarKg' | 'smithBarKg' | 'platePairsKg' | 'stackStepsKg'
>

export type LogEntry = WorkoutLog['exercises'][number]

export const DEFAULT_REST_SEC = 90
export const DEFAULT_TIME_SEC = 45

export function exerciseFor(id: string): Exercise | undefined {
  return byId.get(id)
}

/** 'smith-split-squat' → 'Smith Split Squat' (fallback for unknown ids) */
export function prettyName(id: string): string {
  return id
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export function nameFor(id: string): string {
  return byId.get(id)?.name ?? prettyName(id)
}

/** unknown exercises fall back to barbell maths — always achievable on his rack */
export function loadModeFor(id: string): LoadMode {
  return byId.get(id)?.loadMode ?? 'barbell'
}

/** every achievable load for a mode, ascending (empty for bodyweight/time) */
export function loadOptions(mode: LoadMode, p: PlateProfile): number[] {
  if (mode === 'bodyweight' || mode === 'time') return []
  if (mode === 'stack') return [...p.stackStepsKg].sort((a, b) => a - b)
  if (mode === 'plate') return [...p.platePairsKg].sort((a, b) => a - b)
  const barKg = mode === 'barbell' ? p.barbellKg : mode === 'curl-bar' ? p.curlBarKg : p.smithBarKg
  return barLoads(barKg, p.platePairsKg)
}

/** step to the next/previous ACHIEVABLE load; undefined current + up = lightest option */
export function stepLoad(
  mode: LoadMode,
  current: number | undefined,
  dir: 1 | -1,
  p: PlateProfile,
): number | undefined {
  const options = loadOptions(mode, p)
  if (options.length === 0) return undefined
  if (current === undefined) return dir > 0 ? options[0] : undefined
  // index of the option nearest the current value
  let idx = 0
  for (let i = 1; i < options.length; i++) {
    if (Math.abs(options[i] - current) < Math.abs(options[idx] - current)) idx = i
  }
  const next = Math.min(options.length - 1, Math.max(0, idx + dir))
  return options[next]
}

/** compact build label: '60 kg (20 + 10 each side)' / '45 kg on the stack' / '15 kg plate' */
export function loadLabel(mode: LoadMode, kg: number | undefined, p: PlateProfile): string {
  if (mode === 'bodyweight') return 'Bodyweight'
  if (mode === 'time' || kg === undefined) return '—'
  const plan = nearestLoad(mode, kg, p)
  if (!plan) return '—'
  if (mode === 'stack') return `${plan.totalKg} kg on the stack`
  if (mode === 'plate') return `${plan.totalKg} kg plate`
  return plan.perSide && plan.perSide.length
    ? `${plan.totalKg} kg (${plan.perSide.join(' + ')} each side)`
    : `${plan.totalKg} kg (empty bar)`
}

export const kgDisplay = (kg: number | undefined): string =>
  kg === undefined ? '—' : kg % 1 === 0 ? String(kg) : kg.toFixed(1)

// ---------- volume / calories ----------

/** Warm-ups never count toward volume — they're ramp-up work, not training. */
export function setVolume(s: SetLog): number {
  if (!s.done || s.warmup) return 0
  return (s.reps ?? 0) * (s.weightKg ?? 0)
}

export function exerciseVolume(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0)
}

/**
 * Session volume. Reps done inside a drop / rest-pause / myo / cluster
 * extension are real work, so they're added here through `entryExtraVolumeKg`.
 * They never add a SET — see the hard-set note in @/lib/setmodes — so the
 * weekly hard-set count is untouched by any of this.
 */
export function totalVolume(log: WorkoutLog): number {
  return log.exercises.reduce(
    (sum, e) => sum + exerciseVolume(e.sets) + entryExtraVolumeKg(e as ModedEntry),
    0,
  )
}

export function doneSetCount(log: WorkoutLog): number {
  return log.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
}

export function totalSetCount(log: WorkoutLog): number {
  return log.exercises.reduce((n, e) => n + e.sets.length, 0)
}

/** average MET across the session's exercises (5 = generic resistance work) */
export function avgMet(log: WorkoutLog): number {
  if (log.exercises.length === 0) return 5
  const sum = log.exercises.reduce((s, e) => s + (byId.get(e.exerciseId)?.met ?? 5), 0)
  return sum / log.exercises.length
}

// ---------- PRs ----------

/** Epley estimated 1RM */
export const epley1RM = (weightKg: number, reps: number): number =>
  reps <= 1 ? weightKg : weightKg * (1 + reps / 30)

export interface SessionPR {
  exerciseId: string
  name: string
  metric: 'e1rm' | 'reps'
  value: number
  prev: number | null // null = first time this exercise was logged
  detail: string
}

interface Best {
  e1rm: number | null
  reps: number | null
}

function bestOfSets(sets: SetLog[]): Best {
  let e1rm: number | null = null
  let reps: number | null = null
  for (const s of sets) {
    if (!s.done || s.warmup || !s.reps || s.reps <= 0) continue
    if (s.weightKg && s.weightKg > 0) {
      const est = epley1RM(s.weightKg, s.reps)
      if (e1rm === null || est > e1rm) e1rm = est
    } else if (s.timeSec === undefined) {
      if (reps === null || s.reps > reps) reps = s.reps
    }
  }
  return { e1rm, reps }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** compare this session's best efforts against every previous finished log */
export function computePRs(log: WorkoutLog, history: WorkoutLog[]): SessionPR[] {
  const prs: SessionPR[] = []
  for (const entry of log.exercises) {
    const now = bestOfSets(entry.sets)
    if (now.e1rm === null && now.reps === null) continue
    const prev: Best = { e1rm: null, reps: null }
    let seen = false
    for (const h of history) {
      for (const he of h.exercises) {
        if (he.exerciseId !== entry.exerciseId) continue
        seen = true
        const b = bestOfSets(he.sets)
        if (b.e1rm !== null && (prev.e1rm === null || b.e1rm > prev.e1rm)) prev.e1rm = b.e1rm
        if (b.reps !== null && (prev.reps === null || b.reps > prev.reps)) prev.reps = b.reps
      }
    }
    const name = nameFor(entry.exerciseId)
    if (now.e1rm !== null && (prev.e1rm === null || now.e1rm > prev.e1rm + 0.01)) {
      prs.push({
        exerciseId: entry.exerciseId,
        name,
        metric: 'e1rm',
        value: r1(now.e1rm),
        prev: prev.e1rm === null ? null : r1(prev.e1rm),
        detail:
          prev.e1rm === null
            ? seen
              ? `Est. 1RM ${r1(now.e1rm)} kg`
              : `First time logged — est. 1RM ${r1(now.e1rm)} kg`
            : `Est. 1RM ${r1(now.e1rm)} kg — beat ${r1(prev.e1rm)} kg`,
      })
    } else if (now.reps !== null && (prev.reps === null || now.reps > prev.reps)) {
      prs.push({
        exerciseId: entry.exerciseId,
        name,
        metric: 'reps',
        value: now.reps,
        prev: prev.reps,
        detail:
          prev.reps === null
            ? `Best set ${now.reps} reps`
            : `${now.reps} reps — beat ${prev.reps}`,
      })
    }
  }
  return prs
}

/** elapsed clock: m:ss under an hour, h:mm:ss above */
export function fmtElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** Working (non-warm-up) sets completed / available, for honest stat lines. */
export function workingSetCount(log: WorkoutLog): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const e of log.exercises) {
    for (const s of e.sets) {
      if (s.warmup) continue
      total += 1
      if (s.done) done += 1
    }
  }
  return { done, total }
}

export const warmupCount = (sets: SetLog[]): number => sets.filter((s) => s.warmup).length

// ---------- supersets ----------

/** One exercise's place in a superset/giant set. */
export interface GroupInfo {
  group: string
  /** indices into log.exercises, in session order */
  members: number[]
  /** 0-based position of this exercise inside the group */
  position: number
  /** 'A1', 'B2' … */
  label: string
}

/**
 * Group letter per exercise index. An ad-hoc group (keyed by exercise id so it
 * survives trimming) wins over the one the plan prescribed.
 */
export function resolveGroups(
  log: WorkoutLog,
  planGroupOf: (entry: LogEntry, idx: number) => string | undefined,
  adhoc: Record<string, string>,
): (string | undefined)[] {
  return log.exercises.map((e, i) => {
    const own = adhoc[e.exerciseId]
    const g = own ?? planGroupOf(e, i)
    return g ? g.toUpperCase() : undefined
  })
}

/** Full membership info for one index, or null when it isn't supersetted. */
export function groupInfoAt(groups: (string | undefined)[], idx: number): GroupInfo | null {
  const group = groups[idx]
  if (!group) return null
  const members: number[] = []
  groups.forEach((g, i) => {
    if (g === group) members.push(i)
  })
  if (members.length < 2) return null
  const position = members.indexOf(idx)
  return { group, members, position, label: `${group}${position + 1}` }
}

/** Letters already claimed, so a new ad-hoc group gets a fresh one. */
export function usedGroups(groups: (string | undefined)[]): string[] {
  return [...new Set(groups.filter(Boolean) as string[])]
}

/** Exercise indices that still have work left in them. */
export function remainingIdx(log: WorkoutLog): number[] {
  const out: number[] = []
  log.exercises.forEach((e, i) => {
    if (e.sets.some((s) => !s.done)) out.push(i)
  })
  return out
}

/**
 * A live session read as `PlanExercise[]`, so the pure planner in
 * @/lib/supersets can reason about it (time model, proposals, apply/clear).
 * Index i here IS index i in `log.exercises`, which keeps every proposal's
 * `a`/`b` usable straight against the session.
 */
export function toPlanExercises(
  log: WorkoutLog,
  groups: (string | undefined)[],
  restFor: (entry: LogEntry, idx: number) => number,
  planExFor?: (entry: LogEntry, idx: number) => PlanExercise | undefined,
): PlanExercise[] {
  return log.exercises.map((e, i) => {
    const pe = planExFor?.(e, i)
    const working = e.sets.filter((s) => !s.warmup)
    const shape = working[0] ?? e.sets[0]
    const reps: [number, number] = shape?.targetReps
      ? [shape.targetReps[0], shape.targetReps[1]]
      : (pe?.reps ?? [8, 12])
    const weightKg = working.find((s) => s.weightKg !== undefined)?.weightKg ?? pe?.weightKg
    const timeSec = loadModeFor(e.exerciseId) === 'time'
      ? (shape?.timeSec ?? pe?.timeSec ?? DEFAULT_TIME_SEC)
      : undefined
    const group = groups[i]
    return {
      exerciseId: e.exerciseId,
      sets: Math.max(1, working.length || e.sets.length),
      reps,
      weightKg,
      restSec: restFor(e, i),
      ...(timeSec !== undefined ? { timeSec } : {}),
      ...(group ? { supersetGroup: group } : {}),
    }
  })
}

/**
 * Fold a fresh set of group letters back into the session's ad-hoc map.
 * An exercise the plan grouped but the planner didn't gets an empty-string
 * override, which `resolveGroups` already reads as "not in a block" — so
 * breaking a PLAN superset apart sticks, without touching the saved plan.
 */
export function adhocFromGroups(
  log: WorkoutLog,
  next: (string | undefined)[],
  planGroupOf: (entry: LogEntry, idx: number) => string | undefined,
  prev: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...prev }
  log.exercises.forEach((e, i) => {
    const want = next[i]?.toUpperCase()
    const fromPlan = planGroupOf(e, i)?.toUpperCase()
    if (want) {
      if (want === fromPlan) delete out[e.exerciseId]
      else out[e.exerciseId] = want
    } else if (fromPlan) {
      out[e.exerciseId] = ''
    } else {
      delete out[e.exerciseId]
    }
  })
  return out
}

/** Group letters of a PlanExercise[], positionally. */
export function groupsOf(list: PlanExercise[]): (string | undefined)[] {
  return list.map((pe) => (pe.supersetGroup ? pe.supersetGroup.toUpperCase() : undefined))
}

export function buzz(pattern: number | number[] = [120, 60, 120]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}
