// Plate maths for the user's exact hardware:
// plate PAIRS 5/10/15/20 kg, barbell 20, curl bar 10, smith bar 15,
// cable stack selectable steps. Prescriptions must always be achievable.

import type { AnyEquipment, LoadMode, Profile } from '@/db/types'

// ------------------------------------------------------------------
// v2 — EQUIPMENT-PROFILE AWARE LOADS (additive; every existing export below
// keeps its old behaviour and old callers keep compiling).
//
// `LoadSource` is the shape the maths actually needs. Both the legacy `Profile`
// AND an `EquipmentProfile` satisfy it structurally, so `nearestLoad(mode, kg,
// equipmentProfile)` just works — no call-site churn.
// ------------------------------------------------------------------

/** Anything that can describe buildable loads: legacy Profile or EquipmentProfile. */
export type LoadSource =
  Pick<Profile, 'barbellKg' | 'curlBarKg' | 'smithBarKg' | 'platePairsKg' | 'stackStepsKg'> & {
    /** fixed dumbbells available (kg, ascending). Absent/empty = no dumbbells here. */
    dumbbellsKg?: number[]
    /** smallest usable jump for progression */
    minIncrementKg?: number
  }

/** LoadMode plus the dumbbell mode that only exists on full-gym profiles. */
export type AnyLoadMode = LoadMode | 'dumbbell'

/** Dumbbells this profile actually has, ascending. */
export function dumbbellOptions(p: LoadSource): number[] {
  return [...(p.dumbbellsKg ?? [])].sort((a, b) => a - b)
}

/**
 * The mode an exercise is really performed in AT THIS LOCATION.
 * A dumbbell-tagged exercise becomes 'dumbbell' whenever the profile has a rack;
 * otherwise it falls back to whatever the registry declared.
 */
export function effectiveLoadMode(
  ex: { loadMode: AnyLoadMode; equipment: AnyEquipment[] } | undefined,
  p: LoadSource,
): AnyLoadMode | null {
  if (!ex) return null
  if (ex.equipment.includes('dumbbell') && dumbbellOptions(p).length > 0) return 'dumbbell'
  return ex.loadMode
}

/** Every achievable total load for a mode on this profile, ascending. */
export function achievableLoads(mode: AnyLoadMode, p: LoadSource): number[] {
  if (mode === 'bodyweight' || mode === 'time') return []
  if (mode === 'dumbbell') return dumbbellOptions(p)
  if (mode === 'stack') return [...p.stackStepsKg].sort((a, b) => a - b)
  if (mode === 'plate') return [...p.platePairsKg].sort((a, b) => a - b)
  return barLoads(barKgFor(mode, p), p.platePairsKg).sort((a, b) => a - b)
}

function barKgFor(mode: AnyLoadMode, p: LoadSource): number {
  if (mode === 'barbell') return p.barbellKg
  if (mode === 'curl-bar') return p.curlBarKg
  return p.smithBarKg
}

const nearestIn = (opts: number[], want: number): number | null => {
  if (opts.length === 0) return null
  return opts.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best), opts[0])
}

const fmtKgNum = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))

/** every achievable per-side plate sum (one of each pair max) — includes 0 */
export function perSideOptions(platePairs: number[]): number[] {
  const sums = new Set<number>([0])
  for (const plate of platePairs) {
    for (const s of [...sums]) sums.add(s + plate)
  }
  return [...sums].sort((a, b) => a - b)
}

/** all achievable total loads for a bar */
export function barLoads(barKg: number, platePairs: number[]): number[] {
  return perSideOptions(platePairs).map((side) => barKg + side * 2)
}

export interface LoadPlan {
  totalKg: number
  perSide?: number[]   // plates each side, descending (bar modes)
  stackKg?: number     // stack modes
  /** per-hand dumbbell weight (dumbbell mode); totalKg is the same figure */
  dumbbellKg?: number
  label: string        // '60 kg — 20 + 15 + 5 each side' / '2 x 22.5 kg'
}

/**
 * Nearest achievable load for a mode.
 * `p` accepts the legacy `Profile` OR an `EquipmentProfile` (both satisfy
 * LoadSource), and `mode` now also accepts 'dumbbell'.
 */
export function nearestLoad(
  mode: AnyLoadMode,
  desiredKg: number,
  p: LoadSource,
): LoadPlan | null {
  if (mode === 'bodyweight' || mode === 'time') return null
  if (mode === 'dumbbell') {
    const pick = nearestIn(dumbbellOptions(p), desiredKg)
    if (pick === null) return null
    return { totalKg: pick, dumbbellKg: pick, label: `2 x ${fmtKgNum(pick)} kg` }
  }
  if (mode === 'stack') {
    const pick = nearestIn(p.stackStepsKg, desiredKg)
    if (pick === null) return null
    return { totalKg: pick, stackKg: pick, label: `${fmtKgNum(pick)} kg on the stack` }
  }
  if (mode === 'plate') {
    const pick = nearestIn(p.platePairsKg, desiredKg)
    if (pick === null) return null
    return { totalKg: pick, label: `${fmtKgNum(pick)} kg plate` }
  }
  const barKg = barKgFor(mode, p)
  const options = barLoads(barKg, p.platePairsKg)
  const pick = nearestIn(options, desiredKg) ?? barKg
  const side = (pick - barKg) / 2
  const breakdown = sideBreakdown(side, p.platePairsKg)
  return {
    totalKg: pick,
    perSide: breakdown,
    label: breakdown.length
      ? `${pick} kg — ${breakdown.join(' + ')} each side`
      : `${pick} kg — empty bar`,
  }
}

/** which plates make up a per-side sum (greedy works since each plate exists once) */
export function sideBreakdown(sideKg: number, platePairs: number[]): number[] {
  const sorted = [...platePairs].sort((a, b) => b - a)
  // Exact subset search, largest plates first, with memoised dead ends. The old
  // 2^n mask scan was fine for a garage's 4 pairs but a commercial floor lists
  // 18+ pairs. Values are scaled to integers (×100) so 1.25 kg sums stay exact.
  const target = Math.round(sideKg * 100)
  const vals = sorted.map((v) => Math.round(v * 100))
  const dead = new Set<string>()
  const picks: number[] = []
  const dfs = (i: number, rem: number): boolean => {
    if (rem === 0) return true
    if (rem < 0 || i >= vals.length) return false
    const k = `${i}:${rem}`
    if (dead.has(k)) return false
    picks.push(sorted[i])
    if (dfs(i + 1, rem - vals[i])) return true
    picks.pop()
    // skip every remaining plate of the same size at once (they are identical)
    let j = i + 1
    while (j < vals.length && vals[j] === vals[i]) j++
    if (dfs(j, rem)) return true
    dead.add(k)
    return false
  }
  return dfs(0, target) ? picks : []
}

/** next achievable load ABOVE current (for progressive overload) */
export function nextLoadUp(
  mode: AnyLoadMode,
  currentKg: number,
  p: LoadSource,
): number | null {
  if (mode === 'bodyweight' || mode === 'time') return null
  const options = achievableLoads(mode, p)
  const up = options.filter((o) => o > currentKg + 0.01).sort((a, b) => a - b)
  return up.length ? up[0] : null
}

// ------------------------------------------------------------------
// WARM-UP RAMP
// Every rung is snapped to a load this location can actually build, so he
// never walks to the rack and finds the number impossible.
// ------------------------------------------------------------------

export interface WarmupRung {
  /** 'Empty bar', '40%', '60%', '80%' */
  tag: string
  reps: number
  totalKg: number
  /** plate / stack / dumbbell breakdown for this rung */
  label: string
}

const RAMP_STEPS: { pct: number; reps: number }[] = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 1 },
]

/** true when a mode carries no external load and so needs no ramp */
export function isRampable(mode: AnyLoadMode | null | undefined): boolean {
  return !!mode && mode !== 'bodyweight' && mode !== 'time'
}

/**
 * Warm-up ladder up to a working weight on THIS profile's hardware:
 * empty bar x8 (bar modes only), then ~40% x5, ~60% x3, ~80% x1.
 * Rungs that snap onto the same load, or up to the working weight itself,
 * are collapsed out — no one warms up twice with the same bar.
 */
export function warmupRamp(
  mode: AnyLoadMode,
  workingKg: number,
  p: LoadSource,
): WarmupRung[] {
  if (!isRampable(mode) || !(workingKg > 0)) return []

  const rungs: WarmupRung[] = []
  const seen = new Set<number>()
  const push = (tag: string, reps: number, plan: LoadPlan | null) => {
    if (!plan) return
    if (plan.totalKg >= workingKg - 0.01) return
    if (seen.has(plan.totalKg)) return
    seen.add(plan.totalKg)
    rungs.push({ tag, reps, totalKg: plan.totalKg, label: plan.label })
  }

  const barMode = mode === 'barbell' || mode === 'curl-bar' || mode === 'smith'
  if (barMode) {
    const barKg = barKgFor(mode, p)
    push('Empty bar', 8, {
      totalKg: barKg,
      perSide: [],
      label: `${fmtKgNum(barKg)} kg — empty bar`,
    })
  }

  for (const step of RAMP_STEPS) {
    push(`${Math.round(step.pct * 100)}%`, step.reps, nearestLoad(mode, workingKg * step.pct, p))
  }

  return rungs.sort((a, b) => a.totalKg - b.totalKg)
}
