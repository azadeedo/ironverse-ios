// ============================================================
// Exercise quality resolution.
//
// Every exercise needs a movement pattern and a quality tier so the session
// localiser can answer "what is the BEST way to train this pattern with the kit
// in this room" rather than only "is this exercise possible here".
//
// Authored data on the exercise wins. When it's missing we infer from the id,
// name and equipment, so the feature works across the whole library immediately
// and simply gets sharper as data is filled in.
// ============================================================

import type {
  AnyEquipment, Exercise, ExerciseQuality, ExerciseTier, MovementPattern,
} from '@/db/types'

// ---------- pattern inference ----------
const PATTERN_RULES: { re: RegExp; pattern: MovementPattern }[] = [
  { re: /leg-press/, pattern: 'leg-press' },
  { re: /hack-squat|pendulum|front-squat|goblet|back-squat|(^|-)squat/, pattern: 'squat' },
  { re: /lunge|split-squat|step-up/, pattern: 'lunge' },
  { re: /rdl|romanian|deadlift|good-morning|pull-through/, pattern: 'hinge' },
  { re: /hip-thrust|glute-bridge|kickback/, pattern: 'hip-extension' },
  { re: /abductor|adductor/, pattern: 'hip-abduction' },
  { re: /leg-curl|hamstring-curl/, pattern: 'knee-flexion' },
  { re: /leg-extension/, pattern: 'knee-extension' },
  { re: /calf/, pattern: 'calf' },
  { re: /incline.*(press|push)|press.*incline/, pattern: 'incline-push' },
  { re: /overhead-press|shoulder-press|military|arnold|ohp/, pattern: 'vertical-push' },
  // flyes and pec deck are ISOLATION — they must never stand in for a press
  { re: /fly|flye|pec-deck|crossover/, pattern: 'chest-fly' },
  { re: /bench-press|chest-press|push-up|pushup|dip(?!.*triceps)/, pattern: 'horizontal-push' },
  { re: /pulldown|pull-?up|chin-?up/, pattern: 'vertical-pull' },
  { re: /pullover|straight-arm/, pattern: 'pullover' },
  { re: /row/, pattern: 'horizontal-pull' },
  { re: /face-pull|rear-delt|reverse-fly|y-raise/, pattern: 'rear-delt' },
  { re: /lateral-raise|upright-row/, pattern: 'lateral-raise' },
  { re: /shrug/, pattern: 'shrug' },
  { re: /curl/, pattern: 'elbow-flexion' },
  { re: /pushdown|pressdown|skull|triceps|extension.*overhead|overhead.*extension|kickback.*triceps/, pattern: 'elbow-extension' },
  { re: /plank|dead-bug|bird-dog|hollow/, pattern: 'core-anti-extension' },
  { re: /woodchop|russian-twist|rotation|oblique/, pattern: 'core-rotation' },
  { re: /crunch|sit-up|situp|leg-raise|knee-raise/, pattern: 'core-flexion' },
  { re: /carry|farmer/, pattern: 'carry' },
]

export function inferPattern(ex: Exercise): MovementPattern {
  if (ex.quality?.pattern) return ex.quality.pattern
  if (ex.kind === 'cardio') return 'cardio'
  const key = `${ex.id} ${ex.name.toLowerCase().replace(/\s+/g, '-')}`
  for (const rule of PATTERN_RULES) if (rule.re.test(key)) return rule.pattern
  return 'other'
}

// ---------- tier inference ----------
/**
 * Equipment quality for hard, safe, close-to-failure work when training alone.
 * Machines and cables score well because the resistance is honest and you can
 * push them without a spotter; free weights score well for loadability.
 */
const EQUIPMENT_BONUS: Partial<Record<AnyEquipment, number>> = {
  'hack-squat': 2, 'pendulum-squat': 2, 'leg-press': 2, 'leg-extension': 2,
  'seated-leg-curl': 2, 'lying-leg-curl': 2, 'pec-deck': 2, 'chest-press-machine': 1,
  'seated-row-machine': 1, 'chest-supported-row': 2, 'shoulder-press-machine': 1,
  'hip-thrust-machine': 2, 'preacher-bench': 1, 'calf-raise-machine': 2,
  'assisted-pullup': 1, 'ab-machine': 1, 't-bar-row': 1,
  dumbbell: 2, 'cable-station': 1, 'cable-high': 0, 'cable-low': 0, 'cable-mid': 0,
  barbell: 3, 'trap-bar': 3, 'lat-pulldown': 1, 'low-row': 1, 'pullup-bar': 1,
  smith: 0, 'curl-bar': 0, bench: 0, 'dip-handles': 0,
  suspension: -1, bodyweight: -1, plate: -1, 'jump-rope': 0,
}

/** Cues in the name that signal a genuinely better stimulus. */
const STRETCH_RX = /incline|deficit|romanian|rdl|split-squat|bulgarian|overhead|pullover|fly|flye|preacher|seated-leg-curl|lying-leg-curl|hack|pendulum|deep/
const STABLE_RX = /machine|smith|cable|pec-deck|leg-press|hack|pendulum|preacher|chest-supported|assisted|seated/

export function inferQuality(ex: Exercise): ExerciseQuality {
  if (ex.quality) {
    // authored data wins, but fill any gaps
    return {
      stretchLoaded: ex.quality.stretchLoaded ?? STRETCH_RX.test(ex.id),
      stableToFailure: ex.quality.stableToFailure ?? STABLE_RX.test(ex.id),
      ...ex.quality,
      pattern: ex.quality.pattern ?? inferPattern(ex),
    }
  }
  const key = `${ex.id} ${ex.name.toLowerCase().replace(/\s+/g, '-')}`
  let score = 0
  for (const e of ex.equipment) score += EQUIPMENT_BONUS[e] ?? 0
  const stretchLoaded = STRETCH_RX.test(key)
  const stableToFailure = STABLE_RX.test(key)
  if (stretchLoaded) score += 2
  if (stableToFailure) score += 1
  // bodyweight-only work is capped — you cannot progressively load it well
  if (ex.loadMode === 'bodyweight') score -= 2

  const tier: ExerciseTier = score >= 4 ? 1 : score >= 2 ? 2 : score >= 0 ? 3 : 4
  return {
    pattern: inferPattern(ex),
    tier,
    stretchLoaded,
    stableToFailure,
    systemicCost: /squat|deadlift|rdl|row|bench|press/.test(key) && ex.loadMode === 'barbell' ? 'high' : 'low',
    fixesImbalance: ex.unilateral === true,
  }
}

/**
 * Compound or isolation. A heavy multi-joint lift must never be swapped for an
 * isolation exercise just because the isolation scores well on stretch — they
 * do different jobs in a session.
 */
const ISOLATION_PATTERNS = new Set<MovementPattern>([
  'chest-fly', 'lateral-raise', 'rear-delt', 'elbow-flexion', 'elbow-extension',
  'knee-flexion', 'knee-extension', 'calf', 'shrug', 'hip-abduction', 'pullover',
  'core-flexion', 'core-anti-extension', 'core-rotation',
])

export function isIsolation(ex: Exercise): boolean {
  return ISOLATION_PATTERNS.has(inferQuality(ex).pattern)
}

/** Two exercises can stand in for each other only if they do the same job. */
export function sameRole(a: Exercise, b: Exercise): boolean {
  return isIsolation(a) === isIsolation(b)
}

/** Sort key — lower is better. */
export function qualityScore(ex: Exercise): number {
  const q = inferQuality(ex)
  let s = q.tier * 10
  if (q.stretchLoaded) s -= 3
  if (q.stableToFailure) s -= 2
  return s
}

/**
 * How much better a candidate must be before we bother swapping. Churning a
 * session for a marginal difference is worse than leaving it alone — he loses
 * the thread of his own progression for no real gain.
 */
export const UPGRADE_MARGIN = 5

/** True only when `to` is meaningfully better than `from` for the same job. */
export function isRealUpgrade(from: Exercise, to: Exercise): boolean {
  if (!sameRole(from, to)) return false
  return qualityScore(to) <= qualityScore(from) - UPGRADE_MARGIN
}

/** A short, honest reason one exercise is a step up from another. */
export function upgradeReason(from: Exercise, to: Exercise, locationName: string): string {
  const qf = inferQuality(from)
  const qt = inferQuality(to)
  if (qt.edge) return qt.edge
  if (qt.stretchLoaded && !qf.stretchLoaded) {
    return `${locationName} has it — loads the stretch harder than ${from.name.toLowerCase()}`
  }
  if (qt.stableToFailure && !qf.stableToFailure) {
    return `${locationName} has it — you can push this one closer to failure on your own`
  }
  if (qt.tier < qf.tier) {
    return `better option than ${from.name.toLowerCase()} now that you're at ${locationName}`
  }
  return `swapped in for ${locationName}`
}
