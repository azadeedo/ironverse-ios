// ============================================================
// AUTOMATIC SUPERSET PLANNER
//
// He supersets to fit a session into an hour. The job here is to work out WHICH
// pairs genuinely superset well, say why, and be honest about how many minutes
// it actually saves — then let the UI propose it. Nothing is applied silently.
//
// The whole module is pure: no Dexie, no React, no network. It takes
// PlanExercise[] in and gives proposals or a new PlanExercise[] back.
// ============================================================

import { byId } from '@/data/exercises'
import type { Exercise, MovementPattern, PlanExercise } from '@/db/types'
import { inferQuality, isIsolation } from '@/lib/quality'
import { restSecFor, SUPERSET_TRANSITION_SEC } from '@/lib/training'

// ---------- antagonist table ----------
/**
 * Fallback pairing table, used when the exercise carries no `pairsWith`.
 * These are true antagonists: while one works, the other's muscle is resting,
 * so the second exercise doubles as the first one's rest instead of stealing
 * from it. Anything not in here is only paired when the muscles don't compete.
 */
const ANTAGONISTS: Partial<Record<MovementPattern, MovementPattern[]>> = {
  'horizontal-push': ['horizontal-pull', 'rear-delt'],
  'horizontal-pull': ['horizontal-push', 'chest-fly', 'incline-push'],
  'incline-push': ['horizontal-pull', 'vertical-pull'],
  'vertical-push': ['vertical-pull'],
  'vertical-pull': ['vertical-push', 'incline-push'],
  'chest-fly': ['horizontal-pull', 'rear-delt'],
  'rear-delt': ['chest-fly', 'horizontal-push'],
  'elbow-flexion': ['elbow-extension'],
  'elbow-extension': ['elbow-flexion'],
  'knee-extension': ['knee-flexion'],
  'knee-flexion': ['knee-extension'],
  'hip-extension': ['core-flexion'],
  'lateral-raise': ['elbow-flexion', 'elbow-extension', 'horizontal-pull'],
  shrug: ['core-flexion', 'calf'],
  calf: ['core-flexion', 'core-anti-extension', 'elbow-flexion'],
  'core-flexion': ['calf', 'shrug', 'hip-extension'],
  'core-anti-extension': ['calf', 'elbow-flexion'],
  'hip-abduction': ['calf', 'core-flexion'],
  pullover: ['core-flexion'],
}

/**
 * Patterns that cost the whole body, not just the muscle.
 *
 * WHY THIS MATTERS — the hard rule of this module: two heavy compounds must
 * NEVER be paired. Squat + deadlift, bench + overhead press and friends all
 * draw on the same systemic pool (breathing, bracing, CNS, grip). Alternating
 * them doesn't give either one a rest, it just makes both worse — you lose reps
 * on both lifts and call it "time saved". Isolation work costs almost nothing
 * systemically, which is why pairing an isolation with anything is cheap.
 * `veto()` below enforces it and the reason is surfaced to the UI.
 */
const HEAVY_PATTERNS = new Set<MovementPattern>([
  'squat', 'hinge', 'lunge', 'leg-press',
  'horizontal-push', 'incline-push', 'vertical-push', 'vertical-pull',
])

const HEAVY_LOAD_MODES = new Set(['barbell', 'smith'])

/** A big, systemically expensive lift — the sort you should not stack. */
export function isHeavyCompound(ex: Exercise): boolean {
  if (isIsolation(ex)) return false
  const q = inferQuality(ex)
  if (q.systemicCost === 'high') return true
  if (!HEAVY_PATTERNS.has(q.pattern)) return false
  // free-weight/smith versions of the big patterns are the expensive ones;
  // a machine chest press at the same pattern is far cheaper systemically.
  return HEAVY_LOAD_MODES.has(ex.loadMode) || ex.loadMode === 'bodyweight'
}

function patternOf(ex: Exercise): MovementPattern {
  return inferQuality(ex).pattern
}

/** Do these two fight over the same muscle? Then they don't superset. */
function competes(a: Exercise, b: Exercise): boolean {
  const bPrimary = new Set<string>(b.primary)
  if (a.primary.some((m) => bPrimary.has(m))) return true
  // a heavy secondary overlap counts too: curls after rows is not a rest
  const bAll = new Set<string>([...b.primary, ...b.secondary])
  const shared = a.primary.filter((m) => bAll.has(m))
  return shared.length > 0 && isIsolation(a)
}

function authoredPair(a: Exercise, b: Exercise): boolean {
  return (
    (a.pairsWith ?? []).includes(patternOf(b)) ||
    (b.pairsWith ?? []).includes(patternOf(a))
  )
}

function antagonists(a: Exercise, b: Exercise): boolean {
  return (ANTAGONISTS[patternOf(a)] ?? []).includes(patternOf(b)) ||
    (ANTAGONISTS[patternOf(b)] ?? []).includes(patternOf(a))
}

// ---------- time model ----------

export interface TimeModelOptions {
  /** seconds a single rep takes under load (controlled tempo) */
  secPerRep?: number
  /** floor on how long any working set takes */
  minWorkSec?: number
}

const DEFAULT_SEC_PER_REP = 3.5
const DEFAULT_MIN_WORK_SEC = 20

/** How long one set of this exercise takes, in seconds. */
export function workSecFor(pe: PlanExercise, ex: Exercise | undefined, o: TimeModelOptions = {}): number {
  if (pe.timeSec) return pe.timeSec
  const perRep = o.secPerRep ?? DEFAULT_SEC_PER_REP
  const reps = (pe.reps[0] + pe.reps[1]) / 2
  return Math.max(o.minWorkSec ?? DEFAULT_MIN_WORK_SEC, Math.round(reps * perRep))
}

function restSecOf(pe: PlanExercise, ex: Exercise | undefined): number {
  return pe.restSec && pe.restSec > 0 ? pe.restSec : restSecFor(ex)
}

/** Straight sets: every set costs its work plus its full rest. */
export function straightSeconds(pe: PlanExercise, o: TimeModelOptions = {}): number {
  const ex = byId.get(pe.exerciseId)
  return Math.max(0, pe.sets) * (workSecFor(pe, ex, o) + restSecOf(pe, ex))
}

/**
 * Supersetted: A1 → transition → A2 → transition → (whatever rest is still
 * owed) → A1 again. The antagonist's work IS the first exercise's rest, so the
 * only rest that remains is the shortfall. Sets past the shorter exercise's
 * count fall back to straight sets, because there's nothing left to alternate
 * with.
 */
export function supersetSeconds(a: PlanExercise, b: PlanExercise, o: TimeModelOptions = {}): number {
  const exA = byId.get(a.exerciseId)
  const exB = byId.get(b.exerciseId)
  const workA = workSecFor(a, exA, o)
  const workB = workSecFor(b, exB, o)
  const restA = restSecOf(a, exA)
  const restB = restSecOf(b, exB)
  const t = SUPERSET_TRANSITION_SEC

  const rounds = Math.min(a.sets, b.sets)
  // the gap still owed after the partner's work has covered part of the rest
  const gapA = Math.max(0, restA - (workB + 2 * t))
  const gapB = Math.max(0, restB - (workA + 2 * t))
  const roundSec = workA + t + workB + t + Math.max(gapA, gapB)

  let total = rounds * roundSec
  // leftovers run as normal straight sets
  if (a.sets > rounds) total += (a.sets - rounds) * (workA + restA)
  if (b.sets > rounds) total += (b.sets - rounds) * (workB + restB)
  return total
}

// ---------- proposals ----------

export interface SupersetPair {
  /** indices into the array passed to suggestSupersets */
  a: number
  b: number
  aId: string
  bId: string
  aName: string
  bName: string
  /** why these two go together, in plain words */
  reason: string
  /** honest minutes saved, rounded down to a whole minute */
  minutesSaved: number
  /** exact seconds, for callers that want the raw number */
  secondsSaved: number
  /** the trade-off, when there is one worth saying out loud */
  caution?: string
}

export interface SuggestOptions extends TimeModelOptions {
  /** don't bother proposing anything that saves less than this (default 2) */
  minMinutes?: number
  /** cap the number of pairs proposed (default 3) */
  maxPairs?: number
  /** skip indices already grouped, already finished, etc. */
  skip?: (pe: PlanExercise, idx: number) => boolean
  /** allow pairing two compounds when neither is heavy (default true) */
  allowCompoundPairs?: boolean
  /** pairs he told us are too far apart in the gym (exercise ids) */
  avoidPair?: (aId: string, bId: string) => boolean
}

/** key for a pair of exercises regardless of order */
export const pairKey = (a: string, b: string) => [a, b].sort().join('|')

interface Veto {
  ok: false
  why: string
}
interface Ok {
  ok: true
  reason: string
  caution?: string
}

/** The rules, in one place, so the "why not" is as explainable as the "why". */
function judge(exA: Exercise, exB: Exercise, opts: SuggestOptions): Ok | Veto {
  if (exA.id === exB.id) return { ok: false, why: 'same exercise' }
  if (exA.kind === 'cardio' || exB.kind === 'cardio') {
    return { ok: false, why: 'cardio is already continuous' }
  }

  // ---- the hard rule: never stack two heavy compounds ----
  const heavyA = isHeavyCompound(exA)
  const heavyB = isHeavyCompound(exB)
  if (heavyA && heavyB) {
    return {
      ok: false,
      why: `${exA.name} and ${exB.name} both cost you systemically — pairing them just makes both lighter`,
    }
  }

  if (competes(exA, exB)) return { ok: false, why: 'they share a muscle, so neither one rests' }

  const isoA = isIsolation(exA)
  const isoB = isIsolation(exB)
  const authored = authoredPair(exA, exB)
  const anti = antagonists(exA, exB)

  if (!isoA && !isoB) {
    // two compounds: only true antagonists, only when neither is a heavy one
    if (opts.allowCompoundPairs === false) return { ok: false, why: 'compound pairing turned off' }
    if (heavyA || heavyB) {
      return { ok: false, why: `${(heavyA ? exA : exB).name} is heavy enough that it wants a real rest` }
    }
    if (!authored && !anti) return { ok: false, why: 'not opposing movements' }
    return {
      ok: true,
      reason: `True antagonists — one rests while the other works`,
      caution: 'Keep an eye on the second lift; if reps drop, split them back up.',
    }
  }

  if (isoA && isoB) {
    if (anti || authored) {
      return { ok: true, reason: 'Opposing isolation work — the cheapest pair there is' }
    }
    // two isolations that don't compete still pair fine; they cost nothing systemically
    return { ok: true, reason: `${exA.primary.length ? 'Different muscles' : 'Isolation work'}, no overlap — safe to alternate` }
  }

  // one compound, one isolation
  const compound = isoA ? exB : exA
  const iso = isoA ? exA : exB
  if (heavyA || heavyB) {
    return {
      ok: true,
      reason: `${iso.name} costs almost nothing systemically, so it fits inside ${compound.name}'s rest`,
      caution: `Do the ${iso.name.toLowerCase()} early in the rest so you're fresh for ${compound.name.toLowerCase()}.`,
    }
  }
  return { ok: true, reason: `${iso.name} slots into ${compound.name}'s rest without competing` }
}

/**
 * Propose supersets over a list of plan exercises.
 * Pairs are greedy and non-overlapping: each exercise appears in at most one
 * proposal, best saving first, with nearby exercises preferred so the session
 * order barely changes.
 */
export function suggestSupersets(exercises: PlanExercise[], opts: SuggestOptions = {}): SupersetPair[] {
  const minMinutes = opts.minMinutes ?? 2
  const maxPairs = opts.maxPairs ?? 3

  const candidates: (SupersetPair & { score: number })[] = []

  for (let i = 0; i < exercises.length; i++) {
    const a = exercises[i]
    if (opts.skip?.(a, i)) continue
    const exA = byId.get(a.exerciseId)
    if (!exA || a.sets <= 0) continue

    for (let j = i + 1; j < exercises.length; j++) {
      const b = exercises[j]
      if (opts.skip?.(b, j)) continue
      const exB = byId.get(b.exerciseId)
      if (!exB || b.sets <= 0) continue

      if (opts.avoidPair?.(a.exerciseId, b.exerciseId)) continue
      const verdict = judge(exA, exB, opts)
      if (!verdict.ok) continue

      const secondsSaved = Math.round(
        straightSeconds(a, opts) + straightSeconds(b, opts) - supersetSeconds(a, b, opts),
      )
      const minutesSaved = Math.floor(secondsSaved / 60)
      if (minutesSaved < minMinutes) continue

      candidates.push({
        a: i,
        b: j,
        aId: a.exerciseId,
        bId: b.exerciseId,
        aName: exA.name,
        bName: exB.name,
        reason: verdict.reason,
        caution: verdict.caution,
        minutesSaved,
        secondsSaved,
        // big saving first, then pairs that sit close together in the session
        score: secondsSaved - (j - i - 1) * 12,
      })
    }
  }

  candidates.sort((x, y) => y.score - x.score)
  const taken = new Set<number>()
  const out: SupersetPair[] = []
  for (const c of candidates) {
    if (out.length >= maxPairs) break
    if (taken.has(c.a) || taken.has(c.b)) continue
    taken.add(c.a)
    taken.add(c.b)
    const { score: _score, ...pair } = c
    out.push(pair)
  }
  return out
}

/** Total honest saving of a set of proposals, in whole minutes. */
export function totalMinutesSaved(pairs: SupersetPair[]): number {
  return Math.floor(pairs.reduce((s, p) => s + p.secondsSaved, 0) / 60)
}

// ---------- applying ----------

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Letters already in use on these exercises. */
export function usedLetters(exercises: PlanExercise[]): Set<string> {
  const used = new Set<string>()
  for (const pe of exercises) if (pe.supersetGroup) used.add(pe.supersetGroup.toUpperCase())
  return used
}

function freshLetter(used: Set<string>): string {
  for (const l of LETTERS) if (!used.has(l)) return l
  // beyond Z, keep going with AA, AB … rather than colliding
  for (const a of LETTERS) for (const b of LETTERS) if (!used.has(a + b)) return a + b
  return 'Z'
}

/**
 * Write supersetGroup letters onto the proposed pairs. PURE — a new array is
 * returned and existing groups are left exactly as they were.
 */
export function applySupersets(exercises: PlanExercise[], pairs: SupersetPair[]): PlanExercise[] {
  const used = usedLetters(exercises)
  const next = exercises.map((pe) => ({ ...pe }))
  for (const pair of pairs) {
    if (!next[pair.a] || !next[pair.b]) continue
    const letter = freshLetter(used)
    used.add(letter)
    next[pair.a].supersetGroup = letter
    next[pair.b].supersetGroup = letter
  }
  return next
}

/**
 * Remove superset grouping. PURE. Pass `letters` to break apart only those
 * blocks; omit it to clear everything.
 */
export function clearSupersets(exercises: PlanExercise[], letters?: string[]): PlanExercise[] {
  const only = letters ? new Set(letters.map((l) => l.toUpperCase())) : null
  return exercises.map((pe) => {
    if (!pe.supersetGroup) return { ...pe }
    if (only && !only.has(pe.supersetGroup.toUpperCase())) return { ...pe }
    const { supersetGroup: _drop, ...rest } = pe
    return rest
  })
}

/** Minutes a whole list takes as written (respecting existing groups). */
export function estimateMinutes(exercises: PlanExercise[], o: TimeModelOptions = {}): number {
  const byGroup = new Map<string, PlanExercise[]>()
  let seconds = 0
  for (const pe of exercises) {
    const g = pe.supersetGroup?.toUpperCase()
    if (!g) {
      seconds += straightSeconds(pe, o)
      continue
    }
    const list = byGroup.get(g) ?? []
    list.push(pe)
    byGroup.set(g, list)
  }
  for (const list of byGroup.values()) {
    if (list.length < 2) {
      seconds += list.reduce((s, pe) => s + straightSeconds(pe, o), 0)
      continue
    }
    // model a block as successive pairs — good enough, and never flattering
    seconds += supersetSeconds(list[0], list[1], o)
    for (let i = 2; i < list.length; i++) {
      seconds += list[i].sets * (workSecFor(list[i], byId.get(list[i].exerciseId), o) + SUPERSET_TRANSITION_SEC)
    }
  }
  return Math.round(seconds / 60)
}
