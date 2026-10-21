// ============================================================
// Programming metadata — resolution and regressions.
//
// The exercise records carry authored programming data (prime-mover emphasis,
// loading demand, fatigue cost, why it is programmed, what to drop to on a bad
// day). Authored data always wins; everything here falls back to something
// honest so the app behaves sensibly for any record still missing a field.
//
// Evidence framing used throughout: exercises are judged on mechanical tension
// through a meaningful range, how well the target is loaded in its lengthened
// position, whether the lift can be taken to within 1-2 reps of failure safely,
// how well it loads progressively, and what it costs systemically for that
// stimulus. Machines and cables are treated as fully valid for hypertrophy —
// the current literature does not support ranking them below free weights for
// muscle growth, though free weights remain better for loading heavy and for
// the stability demands that carry into them.
// ============================================================

import type { Exercise, EquipmentProfile, MovementPattern } from '@/db/types'
import { EXERCISES, byId } from '@/data/exercises'
import { inferQuality, isIsolation, sameRole } from './quality'
import { isAvailable } from './equipment'

export type Demand = 'low' | 'medium' | 'high'

/** Systemic fatigue relative to the stimulus bought. */
export function fatigueCostOf(ex: Exercise): Demand {
  if (ex.fatigueCost) return ex.fatigueCost
  const cost = inferQuality(ex).systemicCost
  if (cost === 'high') return 'high'
  if (cost === 'moderate') return 'medium'
  if (cost === 'low') return 'low'
  return isIsolation(ex) ? 'low' : 'medium'
}

/** Absolute load, skill and balance the movement demands. */
export function loadingDemandOf(ex: Exercise): Demand {
  if (ex.loadingDemand) return ex.loadingDemand
  const q = inferQuality(ex)
  if (isIsolation(ex)) return 'low'
  // a lift you cannot bail out of alone is a high-demand lift whatever it loads
  if (!q.stableToFailure) return 'high'
  return 'medium'
}

const DEMAND_RANK: Record<Demand, number> = { low: 0, medium: 1, high: 2 }
export function demandRank(ex: Exercise): number {
  return DEMAND_RANK[loadingDemandOf(ex)]
}

/** Which head or region the exercise biases. */
export function emphasisOf(ex: Exercise): string | undefined {
  return ex.primeMoverEmphasis
}

/**
 * Why this exercise is programmed, addressed to him. Falls back to a statement
 * built from what we actually know rather than inventing a rationale — an
 * unhelpful-but-true line beats a confident-sounding invention.
 */
export function progressionRoleOf(ex: Exercise): string | undefined {
  if (ex.progressionRole) return ex.progressionRole
  const q = inferQuality(ex)
  const bits: string[] = []
  if (q.stretchLoaded) bits.push('loads the target muscle hard in its lengthened position')
  if (q.stableToFailure) bits.push('is stable enough to push to within a rep or two of failure on your own')
  if (fatigueCostOf(ex) === 'low' && !isIsolation(ex)) bits.push('buys that stimulus cheaply in systemic fatigue')
  if (bits.length === 0) return undefined
  const lead = bits.join(', and ')
  return `Programmed because it ${lead}.`
}

// ---------- regressions ----------

export interface Regression {
  exercise: Exercise
  /** short, honest reason this is the easier option */
  why: string
}

/**
 * Easier stand-ins for a day the prescribed load is not there.
 *
 * This is a DIFFERENT question from `bestSubstitute` in @/lib/equipment, which
 * answers "this room does not have the kit". Here the kit is present and the
 * day is not. Authored `regressionOptions` come first; after that we derive
 * from the library: same movement pattern, same job, genuinely lower demand.
 */
export function regressionsFor(ex: Exercise, profile?: EquipmentProfile | null): Regression[] {
  const out: Regression[] = []
  const seen = new Set<string>([ex.id])
  const usable = (c: Exercise) => (profile ? isAvailable(c, profile) : true)

  for (const id of ex.regressionOptions ?? []) {
    const cand = byId.get(id)
    if (!cand || seen.has(cand.id) || !usable(cand)) continue
    seen.add(cand.id)
    out.push({ exercise: cand, why: derivedWhy(ex, cand) })
  }
  if (out.length >= 2) return out

  const pattern: MovementPattern = inferQuality(ex).pattern
  const primary = new Set(ex.primary)
  const here = demandRank(ex)
  const derived = EXERCISES
    .filter((c) => !seen.has(c.id)
      && c.kind === ex.kind
      && inferQuality(c).pattern === pattern
      && sameRole(ex, c)
      && c.primary.some((m) => primary.has(m))
      && demandRank(c) < here
      && usable(c))
    .sort((a, b) => demandRank(b) - demandRank(a)) // closest step down first
  for (const cand of derived) {
    if (out.length >= 2) break
    seen.add(cand.id)
    out.push({ exercise: cand, why: derivedWhy(ex, cand) })
  }
  return out
}

/**
 * NOTE on the two ratings, because they look contradictory and are not.
 * `loadingDemand` is absolute weight, skill and balance — a leg press rates
 * HIGH on it because the number on the machine is large. That does not make it
 * a harder exercise to complete: it is supported and bilateral, which is
 * exactly why it is a sound regression from a belt squat or a single-leg press.
 * So a regression is not required to have a lower `loadingDemand`; it has to be
 * easier to COMPLETE, which this function states in whichever way is true.
 */
function derivedWhy(from: Exercise, to: Exercise): string {
  const qt = inferQuality(to)
  const qf = inferQuality(from)
  if (from.unilateral && !to.unilateral) {
    return 'both sides at once, so each side carries less of the work'
  }
  if (qt.stableToFailure && !qf.stableToFailure) {
    return 'supported through the movement — you can push it without the balance and bail-out demand'
  }
  if (demandRank(to) < demandRank(from)) {
    return 'same movement with less load and skill demand'
  }
  if (fatigueCostOf(to) === 'low' && fatigueCostOf(from) !== 'low') {
    return 'same muscles for a lot less systemic fatigue'
  }
  if (demandRank(to) > demandRank(from)) {
    // heavier on paper, easier in practice — a supported machine is the usual case
    return 'the machine carries the position for you, so the same muscles work with less to manage'
  }
  return 'trains the same pattern with an easier entry point'
}

/**
 * True when a movement pattern has been regressed repeatedly. Three or more in
 * a rolling window is worth surfacing: one bad day is noise, a pattern of them
 * usually means the prescribed load is simply wrong, or something hurts.
 */
export const REGRESSION_FLAG_THRESHOLD = 3
