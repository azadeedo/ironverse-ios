// ============================================================
// TRAINING CALCULATORS — the maths behind the Tools screen.
//
// All of it is arithmetic on numbers already on the device. Nothing here needs
// the network, and nothing here is a prescription: an estimated 1RM is an
// estimate, and it is always labelled as one.
//
// Epley lives in @/lib/training (epley1RM) and is reused, never redefined.
// ============================================================

import { epley1RM, round1 } from '@/lib/training'
import type { AnyLoadMode, LoadSource } from '@/lib/plates'
import { achievableLoads, nearestLoad, sideBreakdown, warmupRamp } from '@/lib/plates'

// ------------------------------------------------------------------
// 1. Estimated 1RM + rep-max table
// ------------------------------------------------------------------

/** The rep marks the table shows. Above ~10 the formula drifts badly. */
export const TABLE_REPS = [1, 3, 5, 8, 10, 12] as const

/** Beyond this many reps an Epley estimate is a rough guide at best. */
export const DRIFT_REPS = 10

export const ONE_RM_CAVEAT =
  'Epley is a formula, not a test. It is closest when the set was 5 reps or fewer and taken near failure; above about 10 reps it drifts badly and usually flatters you. Treat it as a trend line, not a number to chase.'

/** Invert Epley: the load that should allow `reps` given an estimated 1RM. */
export function loadForReps(e1rm: number, reps: number): number {
  if (!e1rm || e1rm <= 0 || reps <= 0) return 0
  return reps <= 1 ? e1rm : e1rm / (1 + reps / 30)
}

/** Percentage of 1RM a rep count works out to under Epley. */
export function pctOfMax(reps: number): number {
  return reps <= 1 ? 100 : Math.round((1 / (1 + reps / 30)) * 100)
}

export interface RepMaxRow {
  reps: number
  kg: number
  pct: number
  /** true once the estimate is outside the range the formula holds up in */
  drifting: boolean
}

export function repMaxTable(e1rm: number, reps: readonly number[] = TABLE_REPS): RepMaxRow[] {
  return reps.map((r) => ({
    reps: r,
    kg: round1(loadForReps(e1rm, r)),
    pct: pctOfMax(r),
    drifting: r > DRIFT_REPS,
  }))
}

/** Estimated 1RM from a set, via Epley. Thin wrapper so screens import one lib. */
export function estimate1RM(weightKg: number, reps: number): number {
  return round1(epley1RM(weightKg, reps))
}

// ------------------------------------------------------------------
// 2. Plate calculator — what actually goes on the bar, here, today
// ------------------------------------------------------------------

export interface PlateBuild {
  /** what the requested weight snapped to on this equipment */
  totalKg: number
  /** how far off the request it landed */
  deltaKg: number
  barKg: number
  /** plates per side, heaviest first */
  perSide: number[]
  /** true when the request cannot be built and this is the nearest thing */
  approximate: boolean
  label: string
  /** set when the mode isn't plate-loaded (stack / dumbbell / bodyweight) */
  note?: string
}

export function barWeight(mode: AnyLoadMode, p: LoadSource): number {
  if (mode === 'barbell') return p.barbellKg
  if (mode === 'curl-bar') return p.curlBarKg
  if (mode === 'smith') return p.smithBarKg
  return 0
}

export const BAR_MODES: AnyLoadMode[] = ['barbell', 'curl-bar', 'smith']

/**
 * Build a target weight out of the bars and plates the CURRENT profile has.
 * Loads that can't be built snap to the nearest that can — he should never walk
 * to the rack and find the number impossible.
 */
export function planPlates(mode: AnyLoadMode, targetKg: number, p: LoadSource): PlateBuild | null {
  const plan = nearestLoad(mode, targetKg, p)
  if (!plan) return null
  const barKg = barWeight(mode, p)
  const isBar = BAR_MODES.includes(mode)
  const perSide = isBar ? sideBreakdown((plan.totalKg - barKg) / 2, p.platePairsKg) : []
  return {
    totalKg: plan.totalKg,
    deltaKg: round1(plan.totalKg - targetKg),
    barKg,
    perSide,
    approximate: Math.abs(plan.totalKg - targetKg) > 0.01,
    label: plan.label,
    note: isBar
      ? undefined
      : mode === 'stack'
        ? 'Cable stack — pick the pin, there are no plates to load.'
        : mode === 'dumbbell'
          ? 'Fixed dumbbells — take the pair off the rack.'
          : mode === 'plate'
            ? 'A single plate held in your hands.'
            : 'No external load on this one.',
  }
}

/** Every load this profile can build for a mode — used to show the range. */
export function buildableRange(mode: AnyLoadMode, p: LoadSource): { min: number; max: number; steps: number } | null {
  const loads = achievableLoads(mode, p)
  if (loads.length === 0) return null
  return { min: loads[0], max: loads[loads.length - 1], steps: loads.length }
}

// ------------------------------------------------------------------
// 3. Warm-up ramp
// ------------------------------------------------------------------

export const WARMUP_NOTE =
  'Enough to wake the pattern up, not enough to cost you the top set. Every rung is snapped to a load this location can actually build.'

/** Ramp to a top set on the current profile's hardware. Re-exports plates lib. */
export function warmupTo(mode: AnyLoadMode, topSetKg: number, p: LoadSource) {
  return warmupRamp(mode, topSetKg, p)
}

// ------------------------------------------------------------------
// 4. Rest by rep range
// ------------------------------------------------------------------

export interface RestBand {
  label: string
  reps: string
  /** seconds, low → high */
  range: [number, number]
  why: string
}

export const REST_BANDS: RestBand[] = [
  {
    label: 'Heavy strength',
    reps: '1-5 reps',
    range: [180, 300],
    why: 'The nervous system, not the muscle, is the limit here. Three to five minutes is not laziness — cut it short and the next set is just a worse version of the last one.',
  },
  {
    label: 'Hypertrophy — compounds',
    reps: '6-12 reps on big lifts',
    range: [120, 180],
    why: 'Squats, presses and rows leave you breathing hard. Two to three minutes lets you hit the rep target again with the same load, which is what actually drives growth.',
  },
  {
    label: 'Hypertrophy — isolation',
    reps: '8-15 reps on single joints',
    range: [60, 120],
    why: 'A curl or a lateral raise costs you almost nothing systemically. A minute or two is plenty.',
  },
  {
    label: 'Endurance / pump',
    reps: '15+ reps',
    range: [45, 75],
    why: 'Short rests keep the burn, at the cost of load. Fine as a finisher, poor as the main course.',
  },
  {
    label: 'Antagonist superset',
    reps: 'paired push / pull',
    range: [20, 40],
    why: 'The short breath between A1 and A2. The opposing muscle rests while the other one works, so you buy time without losing quality.',
  },
]

/** The band that fits a rep target. */
export function restFor(reps: number, isolation = false): RestBand {
  if (reps <= 5) return REST_BANDS[0]
  if (reps >= 15) return REST_BANDS[3]
  return isolation ? REST_BANDS[2] : REST_BANDS[1]
}

export const REST_NOTE =
  'Rest is a training variable, not dead time. The honest test is simple: if the next set loses more than a rep or two, you went too early.'

// ------------------------------------------------------------------
// 5. Bodyweight-relative strength
// ------------------------------------------------------------------

export interface StrengthBand {
  /** multiples of bodyweight */
  min: number
  label: string
}

/**
 * Rough bodyweight multiples for the big lifts. These are descriptive markers
 * people use in the gym, not standards to be judged against — the label under
 * each one says so.
 */
export const STRENGTH_BANDS: StrengthBand[] = [
  { min: 0, label: 'Getting started' },
  { min: 0.75, label: 'Novice' },
  { min: 1.0, label: 'Intermediate' },
  { min: 1.5, label: 'Strong' },
  { min: 2.0, label: 'Very strong' },
]

export function bandFor(multiple: number): StrengthBand {
  let out = STRENGTH_BANDS[0]
  for (const b of STRENGTH_BANDS) if (multiple >= b.min) out = b
  return out
}

export interface RelativeStrength {
  exerciseId: string
  name: string
  e1rm: number
  multiple: number
  band: string
  date: string
}

export const RELATIVE_NOTE =
  'Strength relative to your own bodyweight, using your best estimated 1RM on each lift and your current profile weight. It is a way to compare yourself to yourself over time — it is not a grade, and it says nothing about anyone else.'

export function relativeStrength(
  bests: { exerciseId: string; name: string; e1rm: number; date: string }[],
  bodyweightKg: number,
): RelativeStrength[] {
  if (!bodyweightKg || bodyweightKg <= 0) return []
  return bests
    .filter((b) => b.e1rm > 0)
    .map((b) => {
      const multiple = b.e1rm / bodyweightKg
      return {
        exerciseId: b.exerciseId,
        name: b.name,
        e1rm: round1(b.e1rm),
        multiple: Math.round(multiple * 100) / 100,
        band: bandFor(multiple).label,
        date: b.date,
      }
    })
    .sort((a, b) => b.multiple - a.multiple)
}
