// ============================================================
// PROGRESSION INTELLIGENCE
//
// training.ts answers "what happened". This file answers "what should I do
// about it" — a concrete prescription for the next session, an honest read on
// whether a lift has stopped moving, how long an accessory has been running,
// and what to do with a session that starts badly.
//
// Rules this file obeys:
//  - every number comes from HIS logged sets, never from a template
//  - every load is buildable on the CURRENT equipment profile (lib/plates)
//  - every claim says how much data it rests on; one session is never a trend
//  - nothing is alarmist. A plateau is information, not a verdict.
// ============================================================

import { byId } from '@/data/exercises'
import { db } from '@/db'
import type {
  EquipmentProfile, Exercise, MovementPattern, Profile, SetLog, WorkoutLog,
} from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { availableExercises } from '@/lib/equipment'
import { inferQuality, qualityScore, sameRole } from '@/lib/quality'
import {
  achievableLoads, effectiveLoadMode, nearestLoad, nextLoadUp, type AnyLoadMode, type LoadSource,
} from '@/lib/plates'
import {
  epley1RM, exerciseRollups, isWorkingSet, round1, type Readiness, type SessionRollup,
} from '@/lib/training'

// ------------------------------------------------------------------
// shared plumbing
// ------------------------------------------------------------------

const kg = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? `${r}` : `${r}`
}

/** How much data an answer rests on. Rendered next to every claim. */
export type Confidence = 'none' | 'thin' | 'ok'

export const CONFIDENCE_NOTE: Record<Confidence, string> = {
  none: 'Nothing logged for this lift yet',
  thin: 'Based on one session — treat it as a starting point, not a trend',
  ok: 'Based on your logged sets',
}

/** One session's worth of working sets for a single lift. */
export interface LiftSession {
  date: string
  logId: string
  sets: SetLog[]
}

/** Every session this lift appears in, oldest → newest, working sets only. */
export function liftSessions(logs: WorkoutLog[], exerciseId: string): LiftSession[] {
  const out: LiftSession[] = []
  for (const log of logs) {
    const sets: SetLog[] = []
    for (const entry of log.exercises) {
      if (entry.exerciseId !== exerciseId) continue
      for (const s of entry.sets) if (isWorkingSet(s)) sets.push(s)
    }
    if (sets.length === 0) continue
    out.push({ date: log.date, logId: log.id, sets })
  }
  out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
  return out
}

/** '60 kg × 10, 9, 9' — exactly what he did, in the order he did it. */
export function describeSets(sets: SetLog[], mode: AnyLoadMode | null): string {
  if (sets.length === 0) return ''
  if (mode === 'time') {
    return sets.map((s) => `${s.timeSec ?? 0}s`).join(', ')
  }
  const reps = sets.map((s) => s.reps ?? 0)
  const loads = [...new Set(sets.map((s) => s.weightKg ?? 0))]
  if (mode === 'bodyweight' || loads.every((l) => l <= 0)) {
    return `bodyweight × ${reps.join(', ')}`
  }
  if (loads.length === 1) return `${kg(loads[0])} kg × ${reps.join(', ')}`
  return sets.map((s) => `${kg(s.weightKg ?? 0)}×${s.reps ?? 0}`).join(', ')
}

/** The rep range this lift is actually being run in. */
export function repRangeFor(
  ex: Exercise | undefined,
  lastSets: SetLog[],
  override?: [number, number],
): [number, number] {
  if (override) return override
  const fromSets = lastSets.find((s) => s.targetReps)?.targetReps
  if (fromSets && fromSets[1] > 0) return [fromSets[0], fromSets[1]]
  if (ex?.repRange) return ex.repRange
  return [8, 12]
}

function loadSourceOf(eq: EquipmentProfile | LoadSource): LoadSource {
  return eq as LoadSource
}

// ------------------------------------------------------------------
// 1. Next session target
// ------------------------------------------------------------------

export type TargetAction =
  | 'add-weight'     // earned the jump
  | 'reduce'         // missed the bottom of the range two sessions running — come down a step
  | 'add-reps'       // stay put and fill the range
  | 'hold'           // repeat, nothing conclusive
  | 'first-time'     // no history — a sensible starting load
  | 'no-data'

export interface NextSessionTarget {
  exerciseId: string
  name: string
  action: TargetAction
  /** '62.5 kg × 8+' — the headline prescription */
  prescription: string
  /** 'Last time 60 kg × 10, 9, 9' — what it's built on */
  lastLine: string
  /** one line of reasoning, safe to render straight into the UI */
  reason: string
  /** achievable load on the CURRENT equipment profile */
  loadKg?: number
  /** plate / stack / dumbbell breakdown for that load */
  buildLabel?: string
  repTarget: [number, number]
  /** how many working sets he ran last time (the sets to repeat) */
  sets?: number
  /** how many past sessions fed this */
  basedOn: number
  confidence: Confidence
}

/**
 * A concrete prescription for the NEXT session of one lift, from his last 1-3
 * sessions of it. Double progression: fill the rep range at a load, then take
 * the smallest jump this equipment profile can actually build.
 */
export function nextSessionTargetFrom(
  logs: WorkoutLog[],
  exerciseId: string,
  profile: Profile | null | undefined,
  eq: EquipmentProfile | LoadSource,
  opts: { repRange?: [number, number] } = {},
): NextSessionTarget {
  const ex = byId.get(exerciseId)
  const name = ex?.name ?? exerciseId
  const src = loadSourceOf(eq)
  const mode = effectiveLoadMode(ex, src)
  const recent = liftSessions(logs, exerciseId).slice(-3)
  const last = recent[recent.length - 1]
  const range = repRangeFor(ex, last?.sets ?? [], opts.repRange)

  // ---- nothing logged: propose an honest starting point ----
  if (!last) {
    const bw = profile?.weightKg ?? 0
    if (ex && mode && mode !== 'bodyweight' && mode !== 'time' && ex.startFactor && bw > 0) {
      const plan = nearestLoad(mode, ex.startFactor * bw, src)
      if (plan) {
        return {
          exerciseId, name, action: 'first-time',
          prescription: `${kg(plan.totalKg)} kg × ${range[0]}-${range[1]}`,
          lastLine: 'No sessions logged for this lift yet',
          reason: `Starting estimate from your bodyweight — log a session and the next target comes from your own sets.`,
          loadKg: plan.totalKg, buildLabel: plan.label, repTarget: range,
          basedOn: 0, confidence: 'none',
        }
      }
    }
    return {
      exerciseId, name, action: 'no-data',
      prescription: `${range[0]}-${range[1]} reps`,
      lastLine: 'No sessions logged for this lift yet',
      reason: 'Pick a load you can control for the full range, log it, and the next target writes itself.',
      repTarget: range, basedOn: 0, confidence: 'none',
    }
  }

  const basedOn = recent.length
  const confidence: Confidence = basedOn >= 2 ? 'ok' : 'thin'
  const lastLine = `Last time ${describeSets(last.sets, mode)}`
  const setCount = last.sets.length
  const top = range[1]
  const bottom = range[0]
  const allTopped = last.sets.every((s) => (s.reps ?? 0) >= top)

  // ---- timed work ----
  if (mode === 'time') {
    const best = Math.max(...last.sets.map((s) => s.timeSec ?? 0))
    return {
      exerciseId, name, action: 'add-reps',
      prescription: best > 0 ? `${best + 10}s per set` : 'Add a little time',
      lastLine,
      reason: 'Timed work progresses by holding longer, not by adding load.',
      repTarget: range, sets: setCount, basedOn, confidence,
    }
  }

  // ---- missing the BOTTOM of the range twice at the same load: come down a step ----
  if (!allTopped && mode && mode !== 'bodyweight') {
    const current = Math.max(...last.sets.map((s) => s.weightKg ?? 0))
    const half = Math.ceil(setCount / 2)
    const missed = (ss: SetLog[]) => ss.filter((s) => (s.reps ?? 0) < bottom).length
    const prev = recent[recent.length - 2]
    const prevSame = prev && Math.max(...prev.sets.map((s) => s.weightKg ?? 0)) === current
    const avgReps = last.sets.reduce((a, s) => a + (s.reps ?? 0), 0) / Math.max(1, setCount)
    const struggling = current > 0 && missed(last.sets) >= half && ((prevSame && missed(prev.sets) >= half) || avgReps <= bottom - 3)
    if (struggling) {
      const opts = achievableLoads(mode, src).filter((w) => w < current)
      const want = current * 0.9
      const down = opts.length ? opts.reduce((b, w) => (Math.abs(w - want) < Math.abs(b - want) ? w : b), opts[opts.length - 1]) : null
      if (down !== null && down > 0) {
        const plan = nearestLoad(mode, down, src)
        return {
          exerciseId, name, action: 'reduce',
          prescription: `${kg(down)} kg × ${bottom}-${top}`,
          lastLine,
          reason: prevSame
            ? `Two sessions in a row at ${kg(current)} kg most sets fell short of ${bottom}. Drop to ${kg(down)} kg, own the full range with good form, then build back up — it adapts both ways.`
            : `Most sets landed well under ${bottom} reps at ${kg(current)} kg. ${kg(down)} kg lets you train in the right range; the weight goes back up once you hit ${top} on every set.`,
          loadKg: down, buildLabel: plan?.label,
          repTarget: range, sets: setCount, basedOn, confidence,
        }
      }
    }
  }

  // ---- not yet at the top of the range: chase reps at the same load ----
  if (!allTopped) {
    const current = Math.max(...last.sets.map((s) => s.weightKg ?? 0))
    const short = last.sets.filter((s) => (s.reps ?? 0) < top).length
    const loadPart = current > 0 ? `${kg(current)} kg` : 'bodyweight'
    const plan = current > 0 && mode ? nearestLoad(mode, current, src) : null
    return {
      exerciseId, name, action: 'add-reps',
      prescription: `${loadPart} × ${Array(setCount).fill(top).join(', ')}`,
      lastLine,
      reason: `${short === setCount ? 'Every set was' : `${short} ${short === 1 ? 'set was' : 'sets were'}`} short of ${top}. Stay here until all ${setCount} sets hit ${top}, then the weight goes up.`,
      loadKg: current > 0 ? current : undefined,
      buildLabel: plan?.label,
      repTarget: range, sets: setCount, basedOn, confidence,
    }
  }

  // ---- topped the range on bodyweight work ----
  if (mode === 'bodyweight' || !mode) {
    const bestReps = Math.max(...last.sets.map((s) => s.reps ?? 0))
    return {
      exerciseId, name, action: 'add-reps',
      prescription: `${bestReps + 1}+ reps per set`,
      lastLine,
      reason: `Every set hit ${top}. No load to add here — push the rep target up, slow the negative, or pause the hardest point.`,
      repTarget: [bottom, top], sets: setCount, basedOn, confidence,
    }
  }

  const current = Math.max(...last.sets.map((s) => s.weightKg ?? 0))
  if (current <= 0) {
    return {
      exerciseId, name, action: 'hold',
      prescription: `${top} reps on every set`,
      lastLine,
      reason: 'Log the load you used and the jump can be worked out for you.',
      repTarget: range, sets: setCount, basedOn, confidence,
    }
  }

  const up = nextLoadUp(mode, current, src)
  if (up === null) {
    return {
      exerciseId, name, action: 'add-reps',
      prescription: `${kg(current)} kg × ${top + 1}+`,
      lastLine,
      reason: `${kg(current)} kg is the heaviest load you can build here — add reps, slow the tempo, or add a set instead.`,
      loadKg: current, repTarget: range, sets: setCount, basedOn, confidence,
    }
  }

  const plan = nearestLoad(mode, up, src)
  return {
    exerciseId, name, action: 'add-weight',
    prescription: `${kg(up)} kg × ${bottom}+`,
    lastLine,
    reason: `All ${setCount} sets hit ${top} at ${kg(current)} kg — that's the jump earned. Expect ${bottom}-${bottom + 1} reps at the new load and work back up the range.`,
    loadKg: up,
    buildLabel: plan?.label,
    repTarget: range, sets: setCount, basedOn, confidence,
  }
}

/** Dexie-backed convenience wrapper — reads his logs for you. */
export async function nextSessionTarget(
  exerciseId: string,
  profile: Profile | null | undefined,
  eq: EquipmentProfile | LoadSource,
): Promise<NextSessionTarget> {
  const logs = await db.workoutLogs.orderBy('date').toArray()
  return nextSessionTargetFrom(logs, exerciseId, profile, eq)
}

/** Targets for a whole session in one pass (what the Workout screen renders). */
export function nextSessionTargets(
  logs: WorkoutLog[],
  exerciseIds: string[],
  profile: Profile | null | undefined,
  eq: EquipmentProfile | LoadSource,
): NextSessionTarget[] {
  return exerciseIds.map((id) => nextSessionTargetFrom(logs, id, profile, eq))
}

// ------------------------------------------------------------------
// 2. Plateau check
// ------------------------------------------------------------------

export type PlateauOptionKind = 'reps' | 'variation' | 'deload'

export interface PlateauOption {
  kind: PlateauOptionKind
  label: string
  detail: string
  /** for 'variation' — the exercise to rotate to */
  exerciseId?: string
}

export interface PlateauReport {
  exerciseId: string
  name: string
  /** true only when BOTH estimated 1RM and volume have failed to improve */
  stalled: boolean
  /** consecutive sessions with no improvement */
  flatSessions: number
  sessionsSeen: number
  headline: string
  detail: string
  options: PlateauOption[]
  confidence: Confidence
}

/** Best-available same-pattern alternatives, best first. */
export function samePatternCandidates(
  exerciseId: string,
  eq: EquipmentProfile | null | undefined,
  limit = 3,
): Exercise[] {
  const ex = byId.get(exerciseId)
  if (!ex) return []
  const pattern: MovementPattern = inferQuality(ex).pattern
  const pool = eq ? availableExercises(eq) : []
  const primary = new Set(ex.primary)
  return pool
    .filter((c) => c.id !== ex.id)
    .filter((c) => c.kind === ex.kind)
    .filter((c) => inferQuality(c).pattern === pattern)
    .filter((c) => sameRole(ex, c))
    .filter((c) => c.primary.some((m) => primary.has(m)))
    .sort((a, b) => qualityScore(a) - qualityScore(b))
    .slice(0, limit)
}

/**
 * Has this lift stopped moving? Only flags when estimated 1RM AND total volume
 * have both failed to beat their best across 3 or more consecutive sessions —
 * one bad day is not a plateau.
 */
export function plateauCheckFrom(
  logs: WorkoutLog[],
  exerciseId: string,
  eq?: EquipmentProfile | null,
): PlateauReport {
  const ex = byId.get(exerciseId)
  const name = ex?.name ?? exerciseId
  const rolls: SessionRollup[] = exerciseRollups(logs, exerciseId)
  const base: PlateauReport = {
    exerciseId, name, stalled: false, flatSessions: 0, sessionsSeen: rolls.length,
    headline: 'Still moving', detail: '', options: [], confidence: 'ok',
  }

  if (rolls.length < 4) {
    return {
      ...base,
      headline: 'Not enough sessions to call it',
      detail: `${rolls.length} session${rolls.length === 1 ? '' : 's'} logged on this lift. Four is about the minimum before a flat patch means anything.`,
      confidence: rolls.length <= 1 ? 'none' : 'thin',
    }
  }

  // how many sessions since the best e1RM and since the best volume
  let bestE1rmIdx = 0
  let bestVolIdx = 0
  rolls.forEach((r, i) => {
    if (r.e1rm > rolls[bestE1rmIdx].e1rm + 0.01) bestE1rmIdx = i
    if (r.volumeKg > rolls[bestVolIdx].volumeKg + 0.01) bestVolIdx = i
  })
  const sinceE1rm = rolls.length - 1 - bestE1rmIdx
  const sinceVol = rolls.length - 1 - bestVolIdx
  const flat = Math.min(sinceE1rm, sinceVol)

  if (flat < 3) {
    const which = sinceE1rm < sinceVol ? 'Estimated 1RM' : 'Total volume'
    return {
      ...base,
      flatSessions: flat,
      headline: 'Still moving',
      detail: flat === 0
        ? 'Last session was your best on this lift.'
        : `${which} set a new best ${flat} session${flat === 1 ? '' : 's'} ago — nothing to fix.`,
    }
  }

  const bestE1rm = rolls[bestE1rmIdx].e1rm
  const lastRoll = rolls[rolls.length - 1]
  const weeks = Math.max(1, Math.round(dayjs(lastRoll.date).diff(dayjs(rolls[bestE1rmIdx].date), 'day') / 7))
  const range = repRangeFor(ex, liftSessions(logs, exerciseId).slice(-1)[0]?.sets ?? [])

  const options: PlateauOption[] = [
    {
      kind: 'reps',
      label: `Push the rep target to ${range[1] + 2}`,
      detail: `Run ${range[0] + 2}-${range[1] + 2} at your current load for a few weeks. More reps at the same weight is still progress, and it usually breaks the log-jam without changing anything else.`,
    },
  ]
  const alt = samePatternCandidates(exerciseId, eq, 1)[0]
  if (alt) {
    options.push({
      kind: 'variation',
      label: `Rotate to ${alt.name}`,
      detail: `Same movement pattern, different angle — you keep the stimulus and get a fresh load to progress from. ${inferQuality(alt).edge ?? 'Come back to this lift in 6-8 weeks.'}`,
      exerciseId: alt.id,
    })
  }
  options.push({
    kind: 'deload',
    label: 'Take a lighter week',
    detail: 'Two-thirds of the load, same sets and reps, nothing near failure. Fatigue hides fitness — a week off the gas often shows up as a PR the week after.',
  })

  return {
    exerciseId, name,
    stalled: true,
    flatSessions: flat,
    sessionsSeen: rolls.length,
    headline: `Flat for ${flat} sessions`,
    detail: `Best estimated 1RM on this lift is still ${round1(bestE1rm)} kg from about ${weeks} week${weeks === 1 ? '' : 's'} ago, and total volume hasn't beaten its best either. That is normal at this stage — it just means the current approach has given what it has.`,
    options,
    confidence: 'ok',
  }
}

export async function plateauCheck(
  exerciseId: string,
  eq?: EquipmentProfile | null,
): Promise<PlateauReport> {
  const logs = await db.workoutLogs.orderBy('date').toArray()
  return plateauCheckFrom(logs, exerciseId, eq)
}

// ------------------------------------------------------------------
// 3. Staleness — how long this accessory has been on the menu
// ------------------------------------------------------------------

/** A gap this long ends a run — he stopped doing it and came back later. */
const RUN_BREAK_DAYS = 21
export const STALE_WEEKS = 6
export const ROTATE_WEEKS = 8

export interface StalenessReport {
  exerciseId: string
  name: string
  /** consecutive weeks this lift has been in the rotation */
  weeks: number
  sessions: number
  stale: boolean
  headline: string
  detail: string
  /** a concrete same-pattern alternative available at this location */
  suggestion?: { exerciseId: string; name: string; why: string }
  confidence: Confidence
}

export function stalenessFrom(
  logs: WorkoutLog[],
  exerciseId: string,
  eq?: EquipmentProfile | null,
): StalenessReport {
  const ex = byId.get(exerciseId)
  const name = ex?.name ?? exerciseId
  const sessions = liftSessions(logs, exerciseId)
  if (sessions.length === 0) {
    return {
      exerciseId, name, weeks: 0, sessions: 0, stale: false,
      headline: 'Not in your rotation yet',
      detail: 'Nothing logged for this lift.',
      confidence: 'none',
    }
  }

  // walk back from the latest session until a gap ends the run
  let startIdx = sessions.length - 1
  for (let i = sessions.length - 1; i > 0; i--) {
    const gap = dayjs(sessions[i].date).diff(dayjs(sessions[i - 1].date), 'day')
    if (gap > RUN_BREAK_DAYS) break
    startIdx = i - 1
  }
  const run = sessions.slice(startIdx)
  const days = dayjs(run[run.length - 1].date).diff(dayjs(run[0].date), 'day')
  const weeks = Math.max(1, Math.round(days / 7) || 1)
  const stale = weeks >= STALE_WEEKS

  const alt = stale ? samePatternCandidates(exerciseId, eq, 1)[0] : undefined
  return {
    exerciseId, name,
    weeks,
    sessions: run.length,
    stale,
    headline: stale
      ? `${weeks} weeks on this one`
      : `${weeks} week${weeks === 1 ? '' : 's'} in`,
    detail: stale
      ? `You've run ${name} for about ${weeks} straight weeks (${run.length} sessions). Around ${STALE_WEEKS}-${ROTATE_WEEKS} weeks is where most people get more out of a change of angle than another block of the same thing. Nothing is wrong with it — it's just had its run.`
      : `About ${weeks} week${weeks === 1 ? '' : 's'} and ${run.length} session${run.length === 1 ? '' : 's'} into this one. Worth rotating around the ${STALE_WEEKS}-${ROTATE_WEEKS} week mark.`,
    suggestion: alt
      ? {
          exerciseId: alt.id,
          name: alt.name,
          why: inferQuality(alt).edge
            ?? `Same pattern, different angle — and you can come back to ${name} fresh.`,
        }
      : undefined,
    confidence: run.length >= 3 ? 'ok' : 'thin',
  }
}

export async function staleness(
  exerciseId: string,
  eq?: EquipmentProfile | null,
): Promise<StalenessReport> {
  const logs = await db.workoutLogs.orderBy('date').toArray()
  return stalenessFrom(logs, exerciseId, eq)
}

// ------------------------------------------------------------------
// 4. Readiness adjustment
// ------------------------------------------------------------------

export interface ReadinessAdjustment {
  readiness: Readiness
  /** multiply prescribed loads by this */
  loadFactor: number
  /** add this to the prescribed set count (per exercise) */
  setDelta: number
  headline: string
  text: string
}

const ADJUSTMENTS: Record<Readiness, ReadinessAdjustment> = {
  wrecked: {
    readiness: 'wrecked',
    loadFactor: 0.9,
    setDelta: -1,
    headline: '10% off, one set fewer',
    text: 'Take roughly 10% off every working load and drop the last set of each exercise. Stop two reps short of failure. A trimmed session you actually finish beats a heroic one you bail on.',
  },
  ok: {
    readiness: 'ok',
    loadFactor: 1,
    setDelta: 0,
    headline: 'Run it as written',
    text: 'Nothing to change. Hit the prescribed loads and reps, leave a rep in reserve on the early sets.',
  },
  strong: {
    readiness: 'strong',
    loadFactor: 1,
    setDelta: 0,
    headline: 'As written — take the jump early if it flies',
    text: 'Run the prescribed loads. If the top set of your first lift moves fast and clean, take the next achievable jump today rather than waiting for the rep target. Add one back-off set if you still have it in you.',
  },
}

/** Turn the session's readiness flag into a concrete load / set adjustment. */
export function readinessAdjustment(readiness: Readiness | undefined | null): ReadinessAdjustment {
  return ADJUSTMENTS[readiness ?? 'ok']
}

/** Apply a readiness adjustment to a prescribed load, snapped to real plates. */
export function adjustedLoad(
  loadKg: number | undefined,
  adj: ReadinessAdjustment,
  ex: Exercise | undefined,
  eq: EquipmentProfile | LoadSource,
): { kg: number; label: string } | null {
  if (!loadKg || loadKg <= 0) return null
  if (adj.loadFactor === 1) return null
  const mode = effectiveLoadMode(ex, loadSourceOf(eq))
  if (!mode || mode === 'bodyweight' || mode === 'time') return null
  const plan = nearestLoad(mode, loadKg * adj.loadFactor, loadSourceOf(eq))
  if (!plan || Math.abs(plan.totalKg - loadKg) < 0.01) return null
  return { kg: plan.totalKg, label: plan.label }
}

// ------------------------------------------------------------------
// 5. Small shared read used by the UI
// ------------------------------------------------------------------

/** Best estimated 1RM this lift has ever produced (0 when never weighted). */
export function bestE1rmFor(logs: WorkoutLog[], exerciseId: string): number {
  let best = 0
  for (const s of liftSessions(logs, exerciseId)) {
    for (const set of s.sets) {
      const est = epley1RM(set.weightKg ?? 0, set.reps ?? 0)
      if (est > best) best = est
    }
  }
  return best
}
