// Rest that fits the set you just did, not one number per exercise.
//
// What the research says (and what this follows):
// • Multi-joint lifts: ≥2–3 min keeps more reps and more volume on the next set
//   and grew more muscle than 1 min (Schoenfeld et al. 2016, J Strength Cond Res).
// • Single-joint lifts: 60–90 s is enough for most people (Grgic et al. 2017,
//   Eur J Sport Sci review; Senna et al. 2016).
// • Heavy strength work (≤5 reps, ≥85% of max): 3–5 min (de Salles et al. 2009
//   review; NSCA Essentials guidance).
// • Hypertrophy meta-analysis: a small benefit for resting longer than ~60 s,
//   with little extra beyond ~90–120 s for most sets (Singer et al. 2024,
//   Frontiers in Sports and Active Living, "Give it a rest").
// • Sets taken to failure need more recovery to repeat the same reps
//   (Refalo et al. 2023 review on proximity to failure).
// Lower-body compounds (squat, deadlift, leg press) fatigue more whole-body
// systems, so they get a little longer.

import type { Exercise } from '@/db/types'

export interface RestInput {
  ex?: Pick<Exercise, 'kind' | 'loadMode' | 'primary' | 'secondary'>
  compound: boolean
  reps?: number
  targetReps?: [number, number]
  rir?: number
  rpe?: number
  warmup?: boolean
  /** weight of this set ÷ best estimated 1RM (0–1), when known */
  intensity?: number
  /** the user's own saved rest for this exercise wins */
  userSec?: number
}

export interface RestAdvice { sec: number; why: string }

const LOWER = new Set(['quads', 'hamstrings', 'glutes'])
const round15 = (s: number) => Math.round(s / 15) * 15

export function smartRestSec(i: RestInput): RestAdvice {
  if (i.userSec && i.userSec > 0) return { sec: i.userSec, why: 'your saved rest for this exercise' }
  if (i.warmup) return { sec: 45, why: 'warm-up set — just enough to move on' }
  const kind = i.ex?.kind
  if (kind === 'core' || kind === 'mobility' || i.ex?.loadMode === 'time') return { sec: 60, why: 'core / timed work recovers fast' }

  const reps = i.reps ?? i.targetReps?.[1] ?? 10
  const why: string[] = []
  let sec: number
  if (reps <= 5) { sec = i.compound ? 210 : 150; why.push(`${reps} reps is strength work — 3–5 min keeps your strength for the next set`) }
  else if (reps <= 8) { sec = i.compound ? 150 : 105; why.push(i.compound ? 'heavy compound — 2–3 min keeps the next set’s reps (Schoenfeld 2016)' : 'moderate reps on an isolation lift') }
  else if (reps <= 12) { sec = i.compound ? 120 : 90; why.push(i.compound ? 'compound in the muscle-building range — about 2 min' : 'isolation lift — 60–90 s is enough (Grgic 2017)') }
  else if (reps <= 20) { sec = i.compound ? 90 : 75; why.push('higher reps recover quicker') }
  else { sec = 60; why.push('very high reps — short rest is fine') }

  if (i.intensity && i.intensity >= 0.85) { sec += 45; why.push('the weight was 85%+ of your max') }
  else if (i.intensity && i.intensity >= 0.75) { sec += 15 }

  const lower = i.compound && (i.ex?.primary ?? []).some((m) => LOWER.has(m))
  if (lower) { sec += 30; why.push('big lower-body lift') }

  const failed = (i.rir !== undefined && i.rir <= 0) || (i.rpe !== undefined && i.rpe >= 10) || (i.targetReps && i.reps !== undefined && i.reps < i.targetReps[0])
  if (failed) { sec += 30; why.push('you went to (or near) failure — a bit more rest saves your next set') }
  else if ((i.rir !== undefined && i.rir >= 3) || (i.rpe !== undefined && i.rpe <= 7)) { sec -= 15; why.push('that set felt easy') }

  sec = Math.min(300, Math.max(45, round15(sec)))
  return { sec, why: why.join(' · ') }
}

/** Epley estimated 1RM from a set */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))
