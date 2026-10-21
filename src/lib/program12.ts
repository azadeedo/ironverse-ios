// ============================================================
// 12-WEEK PROGRAM ENGINE
//
// Builds the program as an ordinary Plan (so the existing session player,
// history, PRs, supersets and backups all work unchanged) and prescribes the
// actual loads at session start from what he has really lifted.
//
// Principles enforced here, all from the owner's brief:
//  • loads are only ever suggested, never forced; misses never trigger an increase
//  • history is never rewritten — planned, attempted and completed are kept apart
//  • every load is something the room can actually build
//  • e1RM is an estimate (Epley) and is never called a PR
// ============================================================

import dayjs from 'dayjs'
import type {
  EquipmentProfile, Exercise, ExerciseMeta, MainScheme, Muscle, Plan, PlanDay, PlanExercise,
  PlanWeek, Profile, SetLog, WorkoutLog,
} from '@/db/types'
import { byId } from '@/data/exercises'
import {
  DAY_ORDER, DAY_WEEKDAY, LIFT_EXERCISE, PHASES, PR_INCREMENT, PR_WARMUP_PCTS, PROGRAM_NAME,
  VOLUME_TARGETS, type DayKey, type LiftKey, type VolumeGroup,
} from '@/data/program12'
import { PROGRAM, weekCardio, workoutFor, type ProgramEntry } from '@/data/program48'
import { coachingFor } from '@/data/coaching'
import { effectiveLoadMode, nearestLoad, type LoadSource } from './plates'
import { newId } from './id'

// ---------- setup captured from the initial questionnaire ----------
export interface LiftBaseline { kg: number; reps: number; date?: string }
export interface ProgramSetup {
  squat?: LiftBaseline
  bench?: LiftBaseline
  deadlift?: LiftBaseline
  /** actual tested 1RMs if he knows them (never guessed) */
  squatPR?: number
  benchPR?: number
  deadliftPR?: number
  bodyweightKg?: number
  goalWeightKg?: number
  heightCm?: number
  age?: number
  steps?: number
  sleepHours?: number
  cardio?: 'incline-walk' | 'bike' | 'elliptical'
  cannotDo?: string[]
  pullUps?: number          // bodyweight pull-ups he can do now (0 = none)
  pullStage?: 'lat-pulldown' | 'assisted-pull-up' | 'pull-up' | 'weighted-pull-up'
  pushUps?: number
  completedAt?: string
}

// ---------- estimated strength ----------
/** Epley. Reps in reserve are added to reps when known (RIR-adjusted e1RM). */
export function e1rm(kg: number, reps: number, rir = 0): number {
  if (!(kg > 0) || !(reps > 0)) return 0
  const r = reps + Math.max(0, rir)
  return r <= 1 ? kg : kg * (1 + r / 30)
}
export const E1RM_FORMULA = 'Epley: e1RM = weight × (1 + reps ÷ 30). When you log reps in reserve, those are added to the reps (a set of 5 with 2 left in the tank is treated like 7 to failure).'

/**
 * %1RM for a given number of reps to failure (reps done + RIR), from the
 * RPE/RIR chart popularised by Tuchscherer and validated in the RIR-based RPE
 * literature (Helms et al. 2016). Interpolated beyond 12.
 */
const PCT_BY_RTF = [0, 1.0, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68]
export function pctFor(repsToFailure: number): number {
  const r = Math.max(1, repsToFailure)
  if (r <= 12) {
    const lo = Math.floor(r), hi = Math.ceil(r)
    return lo === hi ? PCT_BY_RTF[lo] : PCT_BY_RTF[lo] + (PCT_BY_RTF[hi] - PCT_BY_RTF[lo]) * (r - lo)
  }
  return Math.max(0.5, 0.68 - (r - 12) * 0.025)
}
/** load for `reps` with `rir` in reserve, from an e1RM */
export function loadFor(e: number, reps: number, rir: number): number {
  return e * pctFor(reps + rir)
}

const isWork = (s: SetLog) => s.done && !s.warmup && (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0

export interface StrengthEstimate {
  e1rm: number
  source: 'logged' | 'setup' | 'none'
  date?: string
  detail: string
}
/** Best recent estimated 1RM for an exercise: last 4 weeks of logs, else the setup baseline. */
export function estimateFor(exerciseId: string, logs: WorkoutLog[], baseline?: LiftBaseline, today = dayjs().format('YYYY-MM-DD')): StrengthEstimate {
  const since = dayjs(today).subtract(28, 'day').format('YYYY-MM-DD')
  let best = 0, date: string | undefined, detail = ''
  for (const l of logs) {
    if (!l.finishedAt || l.date < since) continue
    for (const e of l.exercises) {
      if (e.exerciseId !== exerciseId) continue
      for (const s of e.sets) {
        if (!isWork(s) || s.failed) continue
        const v = e1rm(s.weightKg!, s.reps!, s.rir ?? (s.rpe ? Math.max(0, 10 - s.rpe) : 0))
        if (v > best) { best = v; date = l.date; detail = `${s.weightKg} kg × ${s.reps}${s.rir !== undefined ? ` @ ${s.rir} RIR` : ''} on ${l.date}` }
      }
    }
  }
  if (best > 0) return { e1rm: best, source: 'logged', date, detail }
  if (baseline && baseline.kg > 0 && baseline.reps > 0) {
    return { e1rm: e1rm(baseline.kg, baseline.reps), source: 'setup', date: baseline.date, detail: `${baseline.kg} kg × ${baseline.reps} from your setup` }
  }
  return { e1rm: 0, source: 'none', detail: 'No data yet' }
}

// ---------- program calendar ----------
/** The Tuesday on or after `from` — week 1 starts on a training Tuesday. */
export function nextTuesday(from: string): string {
  const d = dayjs(from)
  const add = (2 - d.day() + 7) % 7
  return d.add(add, 'day').format('YYYY-MM-DD')
}
export function mondayBefore(tue: string): string { return dayjs(tue).subtract(1, 'day').format('YYYY-MM-DD') }

/** Calendar week (0-based from program start) → program week, honouring repeated weeks. */
export function programWeekFor(plan: Plan, date: string): { week: number; calendarWeek: number; repeat: boolean; started: boolean; finished: boolean } {
  const start = plan.programStart ?? plan.startDate
  const monday = mondayBefore(start)
  const days = dayjs(date).diff(dayjs(monday), 'day')
  const cw = Math.floor(days / 7)
  if (days < 0) return { week: 1, calendarWeek: cw, repeat: false, started: false, finished: false }
  const seq = weekSequence(plan)
  // "I'm on week N": from that calendar week on, the sequence continues from week N
  let idx = cw
  const mw = plan.manualWeek
  if (mw && cw >= mw.calendarWeek) {
    const at = seq.findIndex((x) => x.w === mw.week && !x.repeat)
    if (at >= 0) idx = at + (cw - mw.calendarWeek)
  }
  if (idx >= seq.length) return { week: 12, calendarWeek: cw, repeat: false, started: true, finished: true }
  return { week: seq[idx].w, calendarWeek: cw, repeat: seq[idx].repeat, started: true, finished: false }
}
/** program weeks in calendar order: repeats inserted, skipped weeks removed (week 12 is never skipped) */
export function weekSequence(plan: Plan): { w: number; repeat: boolean }[] {
  const reps = [...(plan.repeatedWeeks ?? [])].sort((a, b) => a - b)
  const skipped = new Set((plan.skippedWeeks ?? []).filter((w) => w !== 12))
  const seq: { w: number; repeat: boolean }[] = []
  for (let w = 1; w <= 12; w++) {
    if (!skipped.has(w)) seq.push({ w, repeat: false })
    for (const r of reps) if (r === w) seq.push({ w, repeat: true })
  }
  return seq
}
/** Date (YYYY-MM-DD) of a program day in the CURRENT calendar week. */
export function dateOfDay(weekMonday: string, day: DayKey): string {
  return dayjs(weekMonday).add(DAY_WEEKDAY[day] - 1, 'day').format('YYYY-MM-DD')
}
export function dayKeyForDate(date: string): DayKey | null {
  const w = dayjs(date).day()
  return DAY_ORDER.find((d) => DAY_WEEKDAY[d] === w) ?? null
}
/**
 * v9 — plan-aware day: honours workouts moved to another date because of work.
 * A moved workout keeps the program WEEK of its original date.
 */
export function programDayOn(plan: Plan, date: string): { dk: DayKey; week: number; movedFrom?: string } | null {
  const moves = plan.moves ?? {}
  const from = Object.keys(moves).find((k) => moves[k] === date)
  if (from) { const dk = dayKeyForDate(from); if (dk) return { dk, week: programWeekFor(plan, from).week, movedFrom: from } }
  if (moves[date]) return null
  const dk = dayKeyForDate(date)
  return dk ? { dk, week: programWeekFor(plan, date).week } : null
}
export function dayIdFor(week: number, day: DayKey) { return `p12-w${week}-${day}` }
export function parseDayId(id?: string): { week: number; day: DayKey } | null {
  const m = /^p12-w(\d+)-(tue|wed|thu|fri)$/.exec(id ?? '')
  return m ? { week: Number(m[1]), day: m[2] as DayKey } : null
}

// ---------- building the plan ----------
// The plan is built from the 48 individually written workouts in
// @/data/program48 — there is no per-weekday template. Each PlanDay is its own
// object, so changing or logging one workout can never change another.
export interface BuildOptions {
  start: string
  setup: ProgramSetup
  /** user's chosen vertical-pull rung; the app never changes it without asking */
  pullStage?: string
  /** exercises he cannot perform → swapped for the first listed alternative */
  cannotDo?: string[]
}

function swapIfExcluded(id: string, cannot: Set<string>): { id: string; swappedFrom?: string } {
  if (!cannot.has(id)) return { id }
  const ex = byId.get(id)
  const alt = [...(ex?.substitutes ?? []), ...(ex?.alternatives ?? []), ...(ex?.regressionOptions ?? [])].find((a) => byId.has(a) && !cannot.has(a))
  return alt ? { id: alt, swappedFrom: id } : { id }
}

const nm = (id: string) => byId.get(id)?.name ?? id
const rng = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`)
export const PULL_IDS = ['lat-pulldown', 'assisted-pull-up', 'pull-up', 'weighted-pull-up']

/** the previous time this exercise appears in the program (same day first, then any day) */
function previousOccurrence(week: number, day: DayKey, e: ProgramEntry): ProgramEntry | undefined {
  for (let w = week - 1; w >= 1; w--) {
    const same = workoutFor(w, day)?.entries.find((x) => x.exerciseId === e.exerciseId && !!x.pullProgression === !!e.pullProgression)
    if (same) return same
  }
  for (let w = week - 1; w >= 1; w--) {
    for (const d of DAY_ORDER) {
      const any = workoutFor(w, d)?.entries.find((x) => x.exerciseId === e.exerciseId)
      if (any) return any
    }
  }
  return undefined
}

/** WHY TODAY — why this exercise is programmed THIS way in THIS workout. */
export function whyToday(week: number, day: DayKey, e: ProgramEntry): string {
  const w = workoutFor(week, day)
  const ex = byId.get(e.exerciseId)
  const prim = (ex?.primary ?? []).map((m) => m.replace(/-/g, ' ')).join(' and ') || 'target muscles'
  const reps = rng(e.repMin, e.repMax)
  const partner = e.supersetGroup ? w?.entries.find((x) => x !== e && x.supersetGroup === e.supersetGroup) : undefined
  const pair = partner ? ` Paired with ${nm(partner.exerciseId)} (superset ${e.supersetGroup}) — rest after the pair.` : ''
  if (e.role === 'main') {
    const s = e.scheme
    if (s?.kind === 'pr-test') return 'PR week: an optional test of what 12 weeks built. The PR coach calculates warm-ups and suggests three attempts — you decide on the day based on readiness.'
    if (w?.kind === 'deload') return `Deload: ${e.sets} light sets of ${reps} at 4+ RIR keep the groove while fatigue drops, so the next block can push harder.`
    if (s?.kind === 'single-backoff') return `Side-quest heavy exposure: one controlled single at RPE ${rng(s.topRpe?.[0] ?? 8, s.topRpe?.[1] ?? 8)} — practice with heavy weight, not a max — then ${s.backoffSets} back-off sets of ${rng(s.backoffReps?.[0] ?? 3, s.backoffReps?.[1] ?? 3)} to keep building strength.`
    if (s?.kind === 'top-backoff') return `One top set of ${s.topReps} at RPE ~${s.topRpe?.[0] ?? 8} teaches you to work heavy with control; the back-offs add strength volume without grinding.`
    if (week === 1) return `Week 1 sets your baseline: ${e.sets}×${reps} at RIR ${e.targetRIR?.[0] ?? 3} so the next 11 weeks progress from an honest starting point.`
    if (e.exerciseId !== LIFT_EXERCISE[e.lift ?? 'bench']) return `${nm(e.exerciseId)} gives the ${e.lift} side quest a different emphasis — ${coachingFor(e.exerciseId)?.purpose ?? ''}`
    const prev = previousOccurrence(week, day, e)
    if (prev && prev.repMax > e.repMax) return `Reps drop to ${reps} (from ${rng(prev.repMin, prev.repMax)}) — heavier loading for the ${e.lift} side quest while the main-quest accessories keep the muscle-building volume.`
    if (prev && prev.sets < e.sets) return `${e.sets} sets this week (up from ${prev.sets}) — an overload week for the ${e.lift}, still with ${e.targetRIR?.[0] ?? 2} reps in reserve.`
    return `${e.sets}×${reps} at RIR ${rng(e.targetRIR?.[0] ?? 2, e.targetRIR?.[1] ?? 2)}: the load goes up only if last session hit every rep at this effort.`
  }
  if (w?.kind === 'deload') return `Deload: ${e.sets} easy sets at 4+ RIR keep the ${prim} trained while you recover.${pair}`
  if (w?.kind === 'pr' || w?.kind === 'recovery') return `Very light — blood flow and a pump for the ${prim}, nothing that steals from recovery.${pair}`
  if (e.pullProgression) return `Pull-up journey: done at your current rung. ${e.sets} sets of ${reps} — when every set reaches ${e.repMax}, the app offers the next rung.${pair}`
  const prev = previousOccurrence(week, day, e)
  if (!prev) return week === 1
    ? `Learn the movement and find a weight you can do for ${reps} with ${e.targetRIR?.[0] ?? 3} reps in reserve.${pair}`
    : `New this block: ${nm(e.exerciseId)} changes the stimulus for the ${prim} while the anchor lifts stay the same, so progress stays measurable.${pair}`
  if (prev.repMax > e.repMax) return `Lower reps today (${reps} vs ${rng(prev.repMin, prev.repMax)} last time) let you use a heavier stimulus while still building the ${prim}.${pair}`
  if (prev.repMax < e.repMax) return `Higher reps today (${reps} vs ${rng(prev.repMin, prev.repMax)}) — more time under tension for the ${prim} with less joint stress.${pair}`
  if (prev.sets < e.sets) return `Volume goes up to ${e.sets} sets (from ${prev.sets}) — more growth stimulus for the ${prim} this week.${pair}`
  if (prev.sets > e.sets) return `Volume trimmed to ${e.sets} sets (from ${prev.sets}) so the heavy main lifts can recover — the ${prim} are maintained, not dropped.${pair}`
  return `Same prescription as last time — beat last session by a rep or a little load (double progression).${pair}`
}

/** planned weekly volume this entry contributes (primary = direct sets, secondary = 0.5 contribution) */
function volumeOf(id: string, sets: number): PlanExercise['volume'] {
  const ex = byId.get(id)
  const direct = [...new Set((ex?.primary ?? []).map((m) => GROUP_OF[m]).filter(Boolean) as string[])]
  const contribution = [...new Set((ex?.secondary ?? []).map((m) => GROUP_OF[m]).filter((x) => !!x && !direct.includes(x)) as string[])]
  return { direct, contribution, sets }
}

/** one ProgramEntry → a PlanExercise the session player understands */
export function planExerciseFor(week: number, day: DayKey, e: ProgramEntry, cannot: Set<string>, pullStage: string): PlanExercise {
  const want = e.pullProgression ? pullStage : e.exerciseId
  const sw = swapIfExcluded(want, cannot)
  const c = coachingFor(sw.id)
  return {
    exerciseId: sw.id,
    ...(sw.swappedFrom ? { swappedFrom: sw.swappedFrom } : {}),
    order: e.order,
    sets: e.sets,
    reps: [e.repMin, e.repMax],
    ...(e.targetRIR ? { rir: e.targetRIR } : {}),
    ...(e.targetRPE ? { rpe: e.targetRPE } : {}),
    restSec: e.restSeconds,
    ...(e.supersetGroup ? { supersetGroup: e.supersetGroup } : {}),
    role: e.role,
    ...(e.scheme ? { scheme: e.scheme } : {}),
    ...(e.lift ? { lift: e.lift } : {}),
    warmupRule: e.warmupRule,
    progressionRule: e.progressionRule,
    purpose: c?.purpose,
    whyToday: whyToday(week, day, e),
    ...(c ? { cue: c.tip } : {}),
    ...(e.optionalAlternative ? { alternative: e.optionalAlternative } : {}),
    sideQuest: e.isPRSideQuest,
    goal: e.goal,
    ...(e.pullProgression ? { pullProgression: true } : {}),
    ...(e.perSide ? { perSide: true } : {}),
    ...(e.note ? { note: e.note } : {}),
    volume: volumeOf(sw.id, e.sets),
    ...(e.isPRSideQuest ? { reason: week === 12 ? 'PR week — optional side quest' : `Side quest: ${e.lift} strength` } : {}),
  }
}

/** the 12 PlanWeeks, built from PROGRAM (48 separate workouts) */
export function buildProgramWeeks(opts: { cannotDo?: string[]; pullStage?: string }): PlanWeek[] {
  const cannot = new Set(opts.cannotDo ?? [])
  const pull = opts.pullStage ?? 'lat-pulldown'
  return PHASES.map((ph) => ({
    index: ph.week,
    label: ph.name,
    days: DAY_ORDER.map((d): PlanDay => {
      const w = workoutFor(ph.week, d)!
      const exercises = w.entries.map((e) => planExerciseFor(ph.week, d, e, cannot, pull))
      return {
        id: dayIdFor(ph.week, d),
        title: w.title,
        focus: focusFor(d),
        exercises,
        estMinutes: estimateMinutes(exercises),
        estCalories: 0,
        programWeek: ph.week,
        dayKey: d,
        phase: w.phase,
        kind: w.kind,
        intent: w.intent,
        cardio: w.cardio,
      }
    }),
  }))
}

function focusFor(day: DayKey): Muscle[] {
  return day === 'tue' ? ['quads', 'glutes', 'hamstrings'] : day === 'thu' ? ['glutes', 'hamstrings', 'lower-back'] : day === 'wed' ? ['chest', 'lats', 'upper-back'] : ['chest', 'lats', 'side-delts', 'biceps', 'triceps']
}

export const PROGRAM_VERSION = 2

export function buildProgramPlan(opts: BuildOptions): Plan {
  return {
    id: newId(),
    name: PROGRAM_NAME,
    weeks: buildProgramWeeks({ cannotDo: opts.cannotDo ?? opts.setup.cannotDo, pullStage: opts.pullStage ?? opts.setup.pullStage }),
    startDate: opts.start,
    programStart: opts.start,
    trainingWeekdays: [2, 3, 4, 5],
    active: true,
    createdAt: new Date().toISOString(),
    program: 'p12',
    programVersion: PROGRAM_VERSION,
    sourceLabel: 'Owner-specified 12-week program — 48 individually written workouts',
    blockWeeks: 12,
    equipmentProfileId: 'flex',
    repeatedWeeks: [],
  }
}

/**
 * Upgrade a program plan built by the old per-weekday template generator to
 * the 48 written workouts. Keeps the plan id (so history stays linked), start
 * date, repeats, deloads, pull rung, swaps and anything the user added.
 */
export function upgradeProgramPlan(plan: Plan, setup: ProgramSetup): Plan {
  let pullStage = setup.pullStage ?? 'lat-pulldown'
  for (const w of plan.weeks) for (const d of w.days) for (const e of d.exercises) if (PULL_IDS.includes(e.exerciseId) && e.exerciseId !== 'lat-pulldown') pullStage = e.exerciseId as typeof pullStage
  const weeks = buildProgramWeeks({ cannotDo: setup.cannotDo, pullStage })
  for (const ow of plan.weeks) for (const od of ow.days) {
    const added = od.exercises.filter((e) => e.userAdded || e.note === 'Added by you')
    if (!added.length) continue
    const nd = weeks.flatMap((w) => w.days).find((d) => d.id === od.id)
    if (nd) for (const a of added) if (!nd.exercises.some((e) => e.exerciseId === a.exerciseId)) nd.exercises.push({ ...a, userAdded: true })
  }
  return { ...plan, weeks, programVersion: PROGRAM_VERSION, sourceLabel: 'Owner-specified 12-week program — 48 individually written workouts' }
}

export function estimateMinutes(list: PlanExercise[]): number {
  let sec = 0
  for (const pe of list) {
    const work = (pe.timeSec ?? 45) * pe.sets
    sec += work + pe.restSec * Math.max(0, pe.sets - (pe.supersetGroup ? 0.5 : 1))
  }
  return Math.round(sec / 60) + 8
}

// ---------- prescriptions (computed at session start) ----------
export interface PrescribedSet {
  kind: SetLog['kind']
  reps: [number, number]
  kg?: number
  rir?: [number, number]
  rpe?: [number, number]
}
export interface Prescription {
  exerciseId: string
  sets: PrescribedSet[]
  /** plain-English reason for the load */
  why: string
  /** tags for the UI */
  flags: ('maintain' | 'increase' | 'reduce' | 'first-time' | 'overreach' | 'deload' | 'pr-test')[]
}

const r25 = (n: number) => Math.round(n / 2.5) * 2.5

/** snap a desired load to what this room can build (falls back to 2.5 kg rounding) */
export function snapLoad(ex: Exercise | undefined, kg: number, source: LoadSource | null, meta?: ExerciseMeta): number {
  if (!(kg > 0)) return 0
  if (meta?.increments?.length) {
    const toKg = meta.unit === 'lb' ? 0.45359237 : 1
    const opts = meta.increments.map((v) => v * toKg)
    return opts.reduce((b, v) => (Math.abs(v - kg) < Math.abs(b - kg) ? v : b), opts[0])
  }
  if (ex && source) {
    const mode = effectiveLoadMode(ex, source)
    if (mode && mode !== 'bodyweight' && mode !== 'time') {
      const lp = nearestLoad(mode, kg, source)
      if (lp) return lp.totalKg
    }
  }
  return r25(kg)
}

interface PastSession { date: string; sets: SetLog[]; feel?: WorkoutLog['feel'] }
export function pastSessions(logs: WorkoutLog[], exerciseId: string, limit = 6): PastSession[] {
  const out: PastSession[] = []
  for (const l of [...logs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    if (!l.finishedAt) continue
    const e = l.exercises.find((x) => x.exerciseId === exerciseId)
    if (!e) continue
    const sets = e.sets.filter((s) => s.done && !s.warmup)
    if (sets.length) out.push({ date: l.date, sets, feel: l.feel })
    if (out.length >= limit) break
  }
  return out
}

function missedTarget(s: SetLog, targetRir: [number, number] | undefined, targetReps: [number, number]): boolean {
  if (s.failed) return true
  if ((s.reps ?? 0) < targetReps[0]) return true
  if (targetRir && s.rir !== undefined && s.rir < targetRir[0] - 0.5) return true
  return false
}

/**
 * What actually happened last session, separating the weight he ATTEMPTED from
 * the weight that WORKED. Example: target 3×10, he does 100×7 then 90×10, 90×10
 * → attempted 100 (missed), successful 90. Next time builds from 90 — never from
 * the missed 100, and never a blind +2.5 on top of it.
 * Each set is judged against its own logged target (week-to-week ranges differ).
 */
export interface LastPerformance {
  attemptedKg: number
  successKg?: number
  /** sets at the successful weight */
  successSets: SetLog[]
  /** a heavier weight was tried and missed */
  missedHeavier: boolean
  anyMiss: boolean
  /** every set at the successful weight reached the TOP of its range at target effort */
  allTopAtSuccess: boolean
}
export function lastPerformance(sets: SetLog[], fallbackReps: [number, number], rir?: [number, number]): LastPerformance {
  const tgt = (s: SetLog) => (s.targetReps && s.targetReps[1] > 0 ? s.targetReps : fallbackReps)
  const ok = (s: SetLog) => !missedTarget(s, rir, tgt(s))
  const attemptedKg = Math.max(0, ...sets.map((s) => s.weightKg ?? 0))
  const good = sets.filter(ok)
  const successKg = good.length ? Math.max(...good.map((s) => s.weightKg ?? 0)) : undefined
  const successSets = successKg !== undefined ? sets.filter((s) => Math.abs((s.weightKg ?? 0) - successKg) < 0.01) : []
  const anyMiss = sets.some((s) => !ok(s))
  return {
    attemptedKg,
    successKg,
    successSets,
    missedHeavier: successKg !== undefined && attemptedKg > successKg + 0.01,
    anyMiss,
    allTopAtSuccess: successSets.length > 0 && successSets.every((s) => ok(s) && (s.reps ?? 0) >= tgt(s)[1] && (s.rir === undefined || !rir || s.rir >= rir[0] - 0.5)),
  }
}

/** True when he has reduced the planned load on this lift in 2 of the last 3 sessions. */
export function overreachSignal(past: PastSession[]): boolean {
  const recent = past.slice(0, 3)
  const reduced = recent.filter((p) => p.sets.some((s) => s.adjusted === 'reduced' || (s.attempts?.length ?? 0) > 0)).length
  return recent.length >= 2 && reduced >= 2
}

/** Main lift prescription for a given week/day. */
export function prescribeMain(
  pe: PlanExercise, lift: LiftKey, week: number, logs: WorkoutLog[], setup: ProgramSetup,
  source: LoadSource | null, meta?: ExerciseMeta,
): Prescription {
  const ex = byId.get(pe.exerciseId)
  const baseKey = pe.exerciseId === LIFT_EXERCISE[lift] ? lift : null
  const est = estimateFor(pe.exerciseId, logs, baseKey ? setup[baseKey] : undefined)
  // variations borrow the competition lift's estimate with a sensible discount
  let e = est.e1rm
  let estNote = est.detail
  if (!e && (pe.exerciseId === 'paused-bench-press' || pe.exerciseId === 'close-grip-bench-press')) {
    const b = estimateFor(LIFT_EXERCISE.bench, logs, setup.bench)
    e = b.e1rm * (pe.exerciseId === 'paused-bench-press' ? 0.9 : 0.92)
    estNote = b.e1rm ? `about ${pe.exerciseId === 'paused-bench-press' ? '90' : '92'}% of your bench estimate (${b.detail})` : 'No data yet'
  }
  const scheme: MainScheme = pe.scheme ?? { kind: 'straight' }
  const rir = pe.rir ?? [2, 3]
  const past = pastSessions(logs, pe.exerciseId)
  const flags: Prescription['flags'] = []
  const inc = PR_INCREMENT[lift]
  if (!e) {
    const t = trialLoad(ex, setup.bodyweightKg, source, meta)
    return {
      exerciseId: pe.exerciseId,
      sets: Array.from({ length: pe.sets }, () => ({ kind: 'work' as const, reps: pe.reps, rir, ...(t ? { kg: t } : {}) })),
      why: t ? `${TRIAL_WHY(t, pe.reps[1])} Use the warm-up ramp to feel it out first.` : 'No strength data yet — pick a load you could lift for the target reps with the RIR shown. The app learns from what you log.',
      flags: ['first-time'],
    }
  }
  const snap = (kg: number) => snapLoad(ex, kg, source, meta)
  if (scheme.kind === 'pr-test') {
    const a = prAttempts(lift, logs, setup, source)
    return { exerciseId: pe.exerciseId, sets: a.attempts.map((x) => ({ kind: 'pr-attempt' as const, reps: [1, 1], kg: x.kg })), why: a.why, flags: ['pr-test'] }
  }
  if (scheme.intensity) {
    // deload / technique: % of recent working weight (heaviest working set in the last 4 weeks)
    const recentWork = Math.max(0, ...past.flatMap((p) => p.sets.map((s) => s.weightKg ?? 0)))
    const ref = recentWork > 0 ? recentWork : loadFor(e, pe.reps[1], 2)
    const kg = snap(ref * (scheme.intensity[0] + scheme.intensity[1]) / 2)
    flags.push('deload')
    return {
      exerciseId: pe.exerciseId,
      sets: Array.from({ length: pe.sets }, () => ({ kind: 'work' as const, reps: pe.reps, kg, rir })),
      why: `Deload: about ${Math.round(scheme.intensity[0] * 100)}–${Math.round(scheme.intensity[1] * 100)}% of your recent working weight (${Math.round(ref)} kg). Leave 4+ reps in the tank.`,
      flags,
    }
  }
  if (scheme.kind === 'top-backoff' || scheme.kind === 'single-backoff') {
    const topReps = scheme.topReps ?? 1
    const rpe = scheme.topRpe ?? [8, 8]
    const topRir = 10 - (rpe[0] + rpe[1]) / 2
    const top = snap(loadFor(e, topReps, topRir))
    const bReps = scheme.backoffReps ?? [3, 3]
    const back = scheme.backoffDrop
      ? snap(top * (1 - (scheme.backoffDrop[0] + scheme.backoffDrop[1]) / 2))
      : snap(loadFor(e, bReps[1], 2))
    return {
      exerciseId: pe.exerciseId,
      sets: [
        { kind: scheme.kind === 'single-backoff' ? 'single' : 'top', reps: [topReps, topReps], kg: top, rpe },
        ...Array.from({ length: scheme.backoffSets ?? 2 }, () => ({ kind: 'backoff' as const, reps: bReps, kg: back, rir: [2, 2] as [number, number] })),
      ],
      why: `Estimated 1RM ${Math.round(e)} kg (${estNote}). Top ${topReps === 1 ? 'single' : `set of ${topReps}`} at RPE ${rpe[0]}${rpe[1] !== rpe[0] ? `–${rpe[1]}` : ''} ≈ ${top} kg — adjust on the day: if it moves slowly, keep it; never chase a grinder. Back-offs ${back} kg.`,
      flags,
    }
  }
  // straight sets: load from estimate, then safety rails from the last session
  let kg = snap(loadFor(e, pe.reps[1], rir[1]))
  let why = `From your estimated 1RM of ${Math.round(e)} kg (${estNote}): ${pe.reps[1]} reps with ${rir[1]} in reserve ≈ ${kg} kg.`
  const last = past[0]
  if (last) {
    const perf = lastPerformance(last.sets, pe.reps, rir)
    const lastKg = perf.successKg ?? Math.min(...last.sets.map((s) => s.weightKg ?? Infinity))
    const missed = perf.anyMiss
    const formBroke = last.sets.some((s) => s.sticking === 'Form broke down')
    if (formBroke) {
      kg = snap(Math.min(kg, lastKg))
      why = `Last time your form broke down, so the recommendation is to hold at the weight that worked (or reduce) rather than add weight: ${kg} kg.`
      flags.push('maintain')
    } else if (perf.missedHeavier) {
      // attempted a heavier weight and missed it; the lighter weight worked → build from what worked
      kg = snap(lastKg)
      why = `Last time you attempted ${perf.attemptedKg} kg and missed the target; ${lastKg} kg was successful. Today starts from what actually worked: ${kg} kg. The heavier weight comes back once ${lastKg} kg is completed at target effort on every set.`
      flags.push('maintain')
    } else if (missed) {
      // owner rule: RIR target missed → maintain the load (never increase)
      kg = snap(lastKg)
      why = `You missed the target reps or RIR last time at ${lastKg} kg, so the load stays the same: ${kg} kg. Progression waits until it is completed at the target effort. If those sets were a grind, dropping 2.5–5% is fine.`
      flags.push('maintain')
    } else {
      // owner rule: completed at target RIR → recommend a small progression
      // (bench +1–2.5, squat/deadlift +2.5–5), never more than the cap
      const lo = snap(lastKg + inc[0]) > lastKg ? snap(lastKg + inc[0]) : snap(lastKg + inc[1])
      const hi = snap(lastKg + inc[1])
      kg = Math.min(Math.max(kg, lo), hi)
      why = (past[1] && lastPerformance(past[1].sets, pe.reps, rir).anyMiss
        ? `We're increasing your weight because you're getting the hang of it — you hit every rep at ${lastKg} kg after the drop. Small step up: ${kg} kg (+${Math.round((kg - lastKg) * 100) / 100} kg).`
        : `We're increasing your weight because this is becoming easy — you completed ${lastKg} kg at the target effort. Small step up: ${kg} kg (+${Math.round((kg - lastKg) * 100) / 100} kg). Take less if warm-ups feel heavy — it is never forced.`)
      flags.push('increase')
    }
  }
  if (overreachSignal(past)) {
    flags.push('overreach')
    why += ' Note: you reduced the load in 2 of your last 3 sessions on this lift — possible overreach or the load is too high. Consider holding or reducing 2.5–5%, and check sleep/recovery.'
  }
  return { exerciseId: pe.exerciseId, sets: Array.from({ length: pe.sets }, () => ({ kind: 'work' as const, reps: pe.reps, kg, rir })), why, flags }
}

/**
 * IV-01 — a conservative TRIAL load when there is no history: about 80% of the
 * bodyweight-based starting estimate (exercise startFactor × bodyweight), snapped
 * to what the equipment can actually load. Labelled as a trial, never as "his" weight.
 */
export function trialLoad(ex: Exercise | undefined, bw: number | undefined, source: LoadSource | null, meta?: ExerciseMeta): number | undefined {
  if (!ex || !bw || bw <= 0) return undefined
  if (ex.loadMode === 'bodyweight' || ex.loadMode === 'time') return undefined
  const factor = ex.startFactor ?? (ex.loadMode === 'stack' ? 0.3 : ex.loadMode === 'plate' ? 0.1 : 0.35)
  const kg = snapLoad(ex, factor * bw * 0.8, source, meta)
  return kg > 0 ? kg : undefined
}
const TRIAL_WHY = (kg: number, top: number) => `Trial load — no history for this exercise yet. Start at ${kg} kg for set 1: if ${top} reps feel easy with 4+ left, go up one step; if you can't reach the bottom of the range, drop one step. Every set after this adapts to what you actually do.`

/** Accessory double progression: fill the rep range, then add the smallest available load. */
export function prescribeAccessory(
  pe: PlanExercise, logs: WorkoutLog[], source: LoadSource | null, meta?: ExerciseMeta, bw?: number,
): Prescription {
  const ex = byId.get(pe.exerciseId)
  const past = pastSessions(logs, pe.exerciseId)
  const rir = pe.rir
  const bodyweight = ex?.loadMode === 'bodyweight' || ex?.loadMode === 'time'
  const base = (kg?: number): PrescribedSet[] => Array.from({ length: pe.sets }, () => ({ kind: 'work' as const, reps: pe.reps, kg, rir }))
  if (!past.length) {
    const t = bodyweight ? undefined : trialLoad(ex, bw, source, meta)
    return { exerciseId: pe.exerciseId, sets: base(t), why: bodyweight ? 'Bodyweight — aim for the rep range with the RIR shown.' : t ? TRIAL_WHY(t, pe.reps[1]) : 'First time — choose a weight you can do for the top of the range with the RIR shown. Next session builds from it.', flags: ['first-time'] }
  }
  const last = past[0]
  const lastKg = Math.max(...last.sets.map((s) => s.weightKg ?? 0))
  if (bodyweight || !(lastKg > 0)) {
    const allTop = last.sets.every((s) => (s.reps ?? 0) >= pe.reps[1])
    return { exerciseId: pe.exerciseId, sets: base(), why: allTop ? `Last time every set hit ${pe.reps[1]}+ reps — time to move to a harder variation or add load. See "What does this help me unlock?".` : `Last time: ${last.sets.map((s) => s.reps).join(', ')} reps. Beat at least one of those.`, flags: [] }
  }
  const perf = lastPerformance(last.sets, pe.reps, rir)
  const lastReps = last.sets.map((s) => `${s.weightKg ?? 0}×${s.reps ?? 0}`).join(', ')
  if (perf.successKg === undefined) {
    // nothing hit the target: hold at the lightest weight used — never increase
    const lo = Math.min(...last.sets.map((s) => s.weightKg ?? Infinity))
    // …and if the session before ALSO missed at this weight, come down one real step
    const prev = past[1]
    if (prev && lastPerformance(prev.sets, pe.reps, rir).successKg === undefined && Math.min(...prev.sets.map((s) => s.weightKg ?? Infinity)) <= lo + 0.01) {
      const down = nextDown(ex, lo, source, meta)
      if (down < lo - 0.01) {
        return { exerciseId: pe.exerciseId, sets: base(down), why: `Two sessions in a row at ${lo} kg missed the target (${lastReps}). Down one step to ${down} kg so every set lands in the ${pe.reps[0]}–${pe.reps[1]} range — the weight climbs again as soon as you top the range.`, flags: ['maintain'] }
      }
    }
    return { exerciseId: pe.exerciseId, sets: base(lo), why: `No set reached the target last time (${lastReps}). Stay at ${lo} kg — or drop one step — and aim to complete the range cleanly.`, flags: ['maintain'] }
  }
  const okKg = perf.successKg
  if (perf.missedHeavier) {
    return {
      exerciseId: pe.exerciseId, sets: base(okKg), flags: ['maintain'],
      why: `Last time you attempted ${perf.attemptedKg} kg and missed the target; ${okKg} kg was successful (${lastReps}). Today starts from ${okKg} kg — the heavier weight comes back once every set at ${okKg} kg reaches ${pe.reps[1]} at the target RIR.`,
    }
  }
  if (perf.allTopAtSuccess && !perf.anyMiss && meta?.holdLoadUntil && meta.holdLoadUntil >= dayjs().format('YYYY-MM-DD')) {
    return { exerciseId: pe.exerciseId, sets: base(okKg), flags: ['maintain'], why: `Plateau plan you approved: holding ${okKg} kg and adding reps until ${dayjs(meta.holdLoadUntil).format('D MMM')}, then the weight goes up again.` }
  }
  if (perf.allTopAtSuccess && !perf.anyMiss) {
    const up = nextUp(ex, okKg, source, meta)
    return {
      exerciseId: pe.exerciseId,
      sets: base(up).map((s) => ({ ...s, reps: [pe.reps[0], pe.reps[1]] as [number, number] })),
      why: (past[1] && lastPerformance(past[1].sets, pe.reps, rir).anyMiss
        ? `We're increasing your weight because you're getting the hang of it — after dropping the weight, you hit every rep last time (${lastReps}). Up one small step to ${up} kg.`
        : `We're increasing your weight because this is becoming easy — last time every set reached the top of its range (${lastReps}). Up one small step to ${up} kg; build the reps back from ${pe.reps[0]}.`),
      flags: ['increase'],
    }
  }
  const why = perf.anyMiss
    ? `You missed the target on a set at ${okKg} kg last time (${lastReps}). Stay at ${okKg} kg and aim to complete the range cleanly.`
    : `Stay at ${okKg} kg (last time ${lastReps}). Add a rep where you can; when every set hits ${pe.reps[1]} at the target RIR, the weight goes up.`
  return { exerciseId: pe.exerciseId, sets: base(okKg), why, flags: ['maintain'] }
}

/** next ACTUALLY AVAILABLE load below `kg` */
export function nextDown(ex: Exercise | undefined, kg: number, source: LoadSource | null, meta?: ExerciseMeta): number {
  if (meta?.increments?.length) {
    const toKg = meta.unit === 'lb' ? 0.45359237 : 1
    const opts = meta.increments.map((v) => v * toKg).sort((a, b) => b - a)
    return opts.find((v) => v < kg - 0.01) ?? opts[opts.length - 1]
  }
  if (ex && source) {
    for (let step = 1.25; step <= 20; step += 1.25) {
      const v = snapLoad(ex, Math.max(0, kg - step), source)
      if (v < kg - 0.01) return v
    }
  }
  return Math.max(0, r25(kg - 2.5))
}

/** next ACTUALLY AVAILABLE load above `kg` */
export function nextUp(ex: Exercise | undefined, kg: number, source: LoadSource | null, meta?: ExerciseMeta): number {
  if (meta?.increments?.length) {
    const toKg = meta.unit === 'lb' ? 0.45359237 : 1
    const opts = meta.increments.map((v) => v * toKg).sort((a, b) => a - b)
    return opts.find((v) => v > kg + 0.01) ?? opts[opts.length - 1]
  }
  if (ex && source) {
    for (let step = 1.25; step <= 20; step += 1.25) {
      const v = snapLoad(ex, kg + step, source)
      if (v > kg + 0.01) return v
    }
  }
  return r25(kg + 2.5)
}

/** Build the session's set rows from prescriptions. Planned load is recorded on every set. */
export function prescribedSetLogs(pe: PlanExercise, rx: Prescription): SetLog[] {
  return rx.sets.map((s, i) => ({
    setIndex: i,
    targetReps: s.reps,
    weightKg: s.kg,
    plannedKg: s.kg,
    timeSec: pe.timeSec,
    kind: s.kind,
    done: false,
  }))
}

// ---------- readiness ----------
export interface Checkin { sleep: number; energy: number; soreness: number; readiness: number }
export interface ReadinessAdvice { level: 'good' | 'ok' | 'poor'; score: number; options: { id: 'maintain' | 'reduce' | 'drop-set'; label: string; detail: string }[]; text: string }
export function readinessAdvice(c: Checkin): ReadinessAdvice {
  // soreness is reverse-scored (5 = very sore)
  const score = (c.sleep + c.energy + (6 - c.soreness) + c.readiness) / 4
  const level = score >= 3.5 ? 'good' : score >= 2.6 ? 'ok' : 'poor'
  const options: ReadinessAdvice['options'] = level === 'good' ? [] : [
    { id: 'maintain', label: 'Keep loads as planned', detail: 'Train as written and see how warm-ups feel.' },
    { id: 'reduce', label: 'Reduce loads 2.5–5%', detail: 'Main lifts and compounds drop slightly; reps and sets stay.' },
    { id: 'drop-set', label: 'Remove one accessory set', detail: 'Each accessory loses its last set today.' },
  ]
  const text = level === 'good' ? 'Recovery looks good — train as planned.' : level === 'ok'
    ? 'Recovery is middling. Nothing changes unless you choose an option below.'
    : 'Recovery looks poor today. Consider holding loads or trimming volume — nothing changes unless you choose.'
  return { level, score, options, text }
}

// ---------- PR coach ----------
export interface PRPlan {
  lift: LiftKey
  estimate: StrengthEstimate
  currentPR: { kg: number; date?: string } | null
  attempts: { n: 1 | 2 | 3; kg: number; label: string }[]
  warmups: { kg: number; reps: string; pct: number }[]
  why: string
  safety: string
}
export function actualPR(lift: LiftKey, logs: WorkoutLog[], setup: ProgramSetup): { kg: number; date?: string } | null {
  const id = LIFT_EXERCISE[lift]
  let best: { kg: number; date?: string } | null = null
  for (const l of logs) {
    if (!l.finishedAt) continue
    for (const e of l.exercises) {
      if (e.exerciseId !== id) continue
      for (const s of e.sets) if (s.done && !s.warmup && !s.failed && s.reps === 1 && (s.weightKg ?? 0) > (best?.kg ?? 0)) best = { kg: s.weightKg!, date: l.date }
    }
  }
  const sp = setup[`${lift}PR` as const]
  if (sp && sp > (best?.kg ?? 0)) best = { kg: sp, date: setup.completedAt?.slice(0, 10) }
  return best
}
export function prAttempts(lift: LiftKey, logs: WorkoutLog[], setup: ProgramSetup, source: LoadSource | null): PRPlan {
  const id = LIFT_EXERCISE[lift]
  const ex = byId.get(id)
  const est = estimateFor(id, logs, setup[lift])
  const pr = actualPR(lift, logs, setup)
  const inc = PR_INCREMENT[lift]
  const max = est.e1rm
  const snap = (kg: number) => snapLoad(ex, kg, source)
  const a1 = snap(max * 0.925)
  let a2 = pr ? (max >= pr.kg + inc[0] ? snap(pr.kg + inc[0]) : snap(pr.kg)) : snap(max * 0.975)
  if (a2 <= a1) a2 = snap(a1 + inc[1])
  if (a2 <= a1) a2 = nextUp(ex, a1, source)
  let a3 = snap(a2 + inc[1])
  // with only big plate jumps (e.g. 5 kg plates = 10 kg steps) a small increment can snap back to a2
  if (a3 <= a2) a3 = nextUp(ex, a2, source)
  const opener = a1
  const warmups = [{ kg: source?.barbellKg ?? 20, reps: '8–10 (empty bar)', pct: 0 }, ...PR_WARMUP_PCTS
    .map((w) => ({ kg: snap(max * w.pct), reps: w.reps, pct: w.pct }))
    .filter((w) => w.kg < opener - 0.01)]
  const uniq = warmups.filter((w, i) => i === 0 || w.kg > warmups[i - 1].kg)
  return {
    lift,
    estimate: est,
    currentPR: pr,
    attempts: [
      { n: 1, kg: a1, label: 'Opener — about 90–95% of your realistic max. Should feel very likely.' },
      { n: 2, kg: a2, label: pr ? (a2 > pr.kg ? 'A small PR — only if the opener moved well.' : 'Match your current PR.') : 'A solid, honest max attempt.' },
      { n: 3, kg: a3, label: 'Only if attempt 2 moved acceptably. Otherwise stop — the PR is the one you made.' },
    ],
    warmups: uniq,
    why: max
      ? `Realistic max is estimated at ${Math.round(max)} kg (${est.detail}). Attempts are suggestions from that estimate — override them freely. An equation is never a reason to attempt a max.`
      : 'No strength data yet. Log some heavy sets first so the attempts are based on what you can actually do.',
    safety: lift === 'bench' ? 'Bench PRs: use a spotter or set the safeties. No grinders past a technical breakdown.'
      : lift === 'squat' ? 'Squat PRs: safety arms set just below your bottom position, or a spotter. Bail properly if needed.'
        : 'Deadlift PRs: sensible jumps, reset every rep, and stop if your back position changes.',
  }
}

// ---------- weekly volume: direct sets vs secondary contribution ----------
const GROUP_OF: Partial<Record<Muscle, VolumeGroup>> = {
  chest: 'chest', lats: 'back', 'upper-back': 'back', traps: 'back', quads: 'quads', hamstrings: 'hamstrings',
  glutes: 'glutes', 'side-delts': 'side-delts', 'rear-delts': 'rear-delts', biceps: 'biceps', triceps: 'triceps',
  calves: 'calves', forearms: 'forearms', abs: 'core', obliques: 'core',
}
export interface GroupVolume { direct: number; contribution: number }
export type VolumeMap = Record<VolumeGroup, GroupVolume>
export function emptyVolume(): VolumeMap {
  return Object.fromEntries(Object.keys(VOLUME_TARGETS).map((k) => [k, { direct: 0, contribution: 0 }])) as VolumeMap
}
/** adds `sets` of an exercise: 1 per set to each primary group, 0.5 to each secondary group (once per group) */
export function addVolume(v: VolumeMap, ex: Exercise | undefined, sets: number) {
  if (!ex || sets <= 0) return
  const prim = new Set(ex.primary.map((m) => GROUP_OF[m]).filter(Boolean) as VolumeGroup[])
  const sec = new Set(ex.secondary.map((m) => GROUP_OF[m]).filter((g) => g && !prim.has(g)) as VolumeGroup[])
  prim.forEach((g) => { v[g].direct += sets })
  sec.forEach((g) => { v[g].contribution += sets * 0.5 })
}
export function plannedVolume(day: PlanDay[]): VolumeMap {
  const v = emptyVolume()
  for (const d of day) for (const pe of d.exercises) addVolume(v, byId.get(pe.exerciseId), pe.sets)
  return v
}
export function loggedVolume(logs: WorkoutLog[], from: string, to: string): VolumeMap {
  const v = emptyVolume()
  for (const l of logs) {
    if (l.date < from || l.date > to) continue
    for (const e of l.exercises) addVolume(v, byId.get(e.exerciseId), e.sets.filter((s) => s.done && !s.warmup).length)
  }
  return v
}
export const VOLUME_CALC_NOTE = 'Each working set counts 1 toward every muscle group the exercise trains as a PRIMARY mover (direct), and 0.5 toward groups it only assists (contribution). Warm-ups never count.'

// ---------- missed sessions ----------
export interface DayStatus { day: DayKey; date: string; state: 'done' | 'partial' | 'missed' | 'skipped' | 'today' | 'upcoming' | 'moved'; log?: WorkoutLog }
export function weekStatus(plan: Plan, weekMonday: string, week: number, logs: WorkoutLog[], today: string, skips: Set<string> = new Set()): DayStatus[] {
  return DAY_ORDER.map((day) => {
    const date = dateOfDay(weekMonday, day)
    const id = dayIdFor(week, day)
    const log = logs.find((l) => l.planId === plan.id && l.dayId === id && l.date >= weekMonday && l.date <= dayjs(weekMonday).add(6, 'day').format('YYYY-MM-DD'))
    let state: DayStatus['state']
    if (log?.skipped || (!log?.finishedAt && skips.has(id))) state = 'skipped'
    else if (log?.finishedAt) state = log.plannedFor && log.plannedFor !== log.date ? 'moved' : log.status === 'partial' ? 'partial' : 'done'
    else if (date === today) state = 'today'
    else if (date < today) state = 'missed'
    else state = 'upcoming'
    return { day, date, state, log }
  })
}

// ---------- cardio / steps ----------
/** this week's cardio, derived from the four written workouts */
export function cardioFor(week: number): { sessions: [number, number]; minutes: [number, number]; easy?: boolean; note?: string } {
  const c = weekCardio(week)
  return { sessions: [c.sessions, c.sessions + c.optional], minutes: c.minutes, easy: c.easy, ...(c.optional ? { note: `${c.optional} optional session${c.optional > 1 ? 's' : ''}.` } : {}) }
}
export { PROGRAM }
export function stepTargetFor(history: { date: string; steps?: number }[], current: number, today: string): { target: number; suggestUp: boolean; why: string } {
  const since = dayjs(today).subtract(14, 'day').format('YYYY-MM-DD')
  const recent = history.filter((h) => h.date >= since && h.date < today && typeof h.steps === 'number')
  const hit = recent.filter((h) => (h.steps ?? 0) >= current).length
  const next = current < 9000 ? 9000 : current < 10000 ? 10000 : current
  const suggestUp = recent.length >= 10 && hit / recent.length >= 0.8 && next > current
  return {
    target: current,
    suggestUp,
    why: recent.length < 10
      ? `Log steps on at least 10 of 14 days to get a progression suggestion (${recent.length} so far).`
      : suggestUp ? `You hit ${current.toLocaleString()} on ${hit} of the last ${recent.length} days. If recovery feels good, try ${next.toLocaleString()}.`
        : `${hit} of the last ${recent.length} days at ${current.toLocaleString()}+. Stay here until it is consistent.`,
  }
}

// ---------- bodyweight trend ----------
export interface WeightStats {
  latest?: { date: string; kg: number }
  avg7?: number
  weekly: { week: string; avg: number }[]
  lost?: number
  remaining?: number
  pct?: number
  trajectory?: { date: string; kg: number }[]
}
export function weightStats(weighIns: { date: string; weightKg: number }[], startKg: number, goalKg: number, today: string): WeightStats {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return { weekly: [] }
  const latest = { date: sorted[sorted.length - 1].date, kg: sorted[sorted.length - 1].weightKg }
  const since7 = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD')
  const last7 = sorted.filter((w) => w.date >= since7)
  const avg7 = last7.length ? last7.reduce((s, w) => s + w.weightKg, 0) / last7.length : undefined
  const byWeek = new Map<string, number[]>()
  for (const w of sorted) {
    const wk = dayjs(w.date).subtract((dayjs(w.date).day() + 6) % 7, 'day').format('YYYY-MM-DD')
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), w.weightKg])
  }
  const weekly = [...byWeek.entries()].map(([week, v]) => ({ week, avg: v.reduce((a, b) => a + b, 0) / v.length }))
  const ref = avg7 ?? latest.kg
  const lost = startKg - ref
  const remaining = ref - goalKg
  const pct = startKg > goalKg ? Math.max(0, Math.min(100, (lost / (startKg - goalKg)) * 100)) : undefined
  return { latest, avg7, weekly, lost, remaining, pct }
}

/** e.g. "Week 3 / 12 · Overload" */
export function phaseLabel(week: number) { return `Week ${week} / 12 · ${PHASES[week - 1]?.name ?? ''}` }
export { PHASES }
