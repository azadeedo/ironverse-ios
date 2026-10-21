// ============================================================
// CARRYOVER — what getting stronger on one lift does for another.
//
// Why this exists: "there's some exercises that once you get good at them, it
// makes other exercises easier." That is real, it is partial, and it is worth
// making visible — when a lift stalls, the answer is sometimes a different lift.
//
// HOW IT IS MODELLED (and why it is not a hand-written id list):
//  · Movement pattern first (@/lib/quality → inferQuality). Patterns cover the
//    whole library automatically, so all 183 exercises are handled, including
//    every commercial-gym machine, without anybody maintaining a lookup table.
//  · A directed pattern graph carries the coaching reasoning: pressing overhead
//    feeds an incline press, heavy rowing feeds a heavy bench, and so on.
//  · Where no pattern link exists, shared musculature gives an honest, weaker
//    "indirect" link rather than pretending there is nothing there.
//
// HONESTY RULES BAKED IN:
//  · Carryover is real but partial. The most reliable way to get better at a
//    lift is to train that lift. Every surface that shows this data says so.
//  · Rep ranges, transfer strength and volume talk are rules of thumb from
//    widely-taught practice, not measurements. Individual response varies.
//  · Where his own logged numbers exist we use them (@/lib/prs); where they do
//    not, we say "not enough logged yet" instead of inventing a comparison.
// ============================================================

import { EXERCISES, byId } from '@/data/exercises'
import { MUSCLE_LABELS, type Exercise, type Muscle, type MovementPattern, type WorkoutLog } from '@/db/types'
import { inferQuality } from '@/lib/quality'
import { prsForExercise, type ExercisePRs } from '@/lib/prs'

// ------------------------------------------------------------------
// shapes
// ------------------------------------------------------------------

export type CarryoverStrength = 'strong' | 'some' | 'indirect'

export const STRENGTH_LABELS: Record<CarryoverStrength, string> = {
  strong: 'Strong transfer',
  some: 'Some transfer',
  indirect: 'Indirect',
}

export const STRENGTH_BLURB: Record<CarryoverStrength, string> = {
  strong: 'Most of what you build here shows up there.',
  some: 'A useful slice of it shows up there.',
  indirect: 'It helps around the edges — supporting muscles, grip, position.',
}

/** The one line that must never be dropped from any carryover UI. */
export const CARRYOVER_CAVEAT =
  'Carryover is real but partial. The most reliable way to get better at a lift is to train that lift — treat everything here as support work, not a substitute.'

export interface CarryoverEntry {
  exercise: Exercise
  strength: CarryoverStrength
  /** one plain sentence: why strength here shows up there */
  why: string
  /** ranking score, higher = stronger transfer (internal, exposed for tests) */
  score: number
}

// ------------------------------------------------------------------
// the pattern graph — established, widely-taught coaching reasoning,
// written here in our own words.
// ------------------------------------------------------------------

interface PatternLink {
  from: MovementPattern
  to: MovementPattern
  strength: CarryoverStrength
  why: string
}

const LINKS: PatternLink[] = [
  // ---- pressing ----
  { from: 'horizontal-push', to: 'incline-push', strength: 'strong',
    why: 'Flat pressing strength shows up almost immediately once the bench tilts — same muscles, same skill, a slightly different angle.' },
  { from: 'incline-push', to: 'horizontal-push', strength: 'strong',
    why: 'Incline work builds the upper chest and front delts that take the bar off your chest on a flat press.' },
  { from: 'incline-push', to: 'vertical-push', strength: 'some',
    why: 'The steeper the press, the more the front delts do — steep incline work feeds overhead pressing directly.' },
  { from: 'vertical-push', to: 'incline-push', strength: 'some',
    why: 'Overhead pressing strength turns up in an incline press, because the front delt is doing a bigger share of the work.' },
  { from: 'vertical-push', to: 'horizontal-push', strength: 'indirect',
    why: 'Stronger shoulders and triceps help the press, but the bar path is different enough that transfer is modest.' },
  { from: 'horizontal-push', to: 'vertical-push', strength: 'indirect',
    why: 'Shared triceps and front delt work, though pressing overhead asks for stability the bench never trains.' },
  { from: 'elbow-extension', to: 'horizontal-push', strength: 'some',
    why: 'Stronger triceps finish the lockout, which is where a heavy press usually dies.' },
  { from: 'elbow-extension', to: 'incline-push', strength: 'some',
    why: 'The top half of an incline press is triceps work — build them and the last third of the rep stops failing.' },
  { from: 'elbow-extension', to: 'vertical-push', strength: 'some',
    why: 'Overhead pressing locks out on triceps; direct extension work makes that part of the rep cheaper.' },
  { from: 'chest-fly', to: 'horizontal-push', strength: 'indirect',
    why: 'Fly work grows the chest but trains almost none of the pressing skill, so expect size before strength.' },
  { from: 'chest-fly', to: 'incline-push', strength: 'indirect',
    why: 'Adds chest size that a press can eventually use — it does not teach you to press.' },
  { from: 'horizontal-pull', to: 'horizontal-push', strength: 'some',
    why: 'Heavy rowing builds the mid-back that holds your position under a heavy bench — a stable platform presses more.' },
  { from: 'horizontal-pull', to: 'incline-push', strength: 'indirect',
    why: 'Upper-back strength keeps the shoulder blades set on an incline, which keeps the press honest.' },
  { from: 'core-anti-extension', to: 'vertical-push', strength: 'some',
    why: 'Overhead pressing leaks through the ribcage first — bracing strength stops the lower back taking over.' },

  // ---- pulling ----
  { from: 'vertical-pull', to: 'horizontal-pull', strength: 'some',
    why: 'Lats and grip built pulling down carry into rowing, though the elbow path is different.' },
  { from: 'horizontal-pull', to: 'vertical-pull', strength: 'some',
    why: 'Rowing thickens the mid-back and strengthens the same elbow drive a hard pull-down needs.' },
  { from: 'elbow-flexion', to: 'vertical-pull', strength: 'some',
    why: 'Stronger arms mean a pull-up set ends when your back is done, not when your biceps give out.' },
  { from: 'elbow-flexion', to: 'horizontal-pull', strength: 'some',
    why: 'Curling strength keeps the arms from being the weak link in a heavy row.' },
  { from: 'vertical-pull', to: 'elbow-flexion', strength: 'some',
    why: 'Chin-ups and pull-downs load the biceps hard under a long range — that turns up in your curls.' },
  { from: 'pullover', to: 'vertical-pull', strength: 'some',
    why: 'Pullovers train the lat through the same shoulder path as a pull-down, with the arms taken out.' },
  { from: 'pullover', to: 'horizontal-pull', strength: 'indirect',
    why: 'Builds lat size that a row can use, without training the rowing pattern itself.' },
  { from: 'rear-delt', to: 'horizontal-pull', strength: 'indirect',
    why: 'Rear delts help finish a row and keep the shoulder healthy under pulling volume.' },
  { from: 'shrug', to: 'horizontal-pull', strength: 'indirect',
    why: 'Trap and grip strength help you hold a heavy row together for the last couple of reps.' },
  { from: 'shrug', to: 'carry', strength: 'some',
    why: 'Traps and grip are most of what a loaded carry asks for.' },
  { from: 'carry', to: 'horizontal-pull', strength: 'some',
    why: 'Grip is usually what ends a heavy set of rows first — carries fix that cheaply.' },
  { from: 'carry', to: 'vertical-pull', strength: 'some',
    why: 'A grip that does not slip lets you finish the set on your back, not your hands.' },
  { from: 'carry', to: 'hinge', strength: 'some',
    why: 'Carries build the grip and trunk bracing a heavy hinge is built on.' },
  { from: 'hinge', to: 'horizontal-pull', strength: 'some',
    why: 'A strong hinge holds the bent-over position still, so the row trains your back instead of your lower back.' },

  // ---- lower body ----
  { from: 'squat', to: 'leg-press', strength: 'strong',
    why: 'Same knee-and-hip drive with the balance removed — squat strength reads straight across.' },
  { from: 'leg-press', to: 'squat', strength: 'some',
    why: 'Builds the quads and glutes a squat needs, but none of the bracing or balance, so expect partial transfer.' },
  { from: 'squat', to: 'lunge', strength: 'some',
    why: 'Squatting builds the engine; the lunge still has to be practised for balance on one leg.' },
  { from: 'lunge', to: 'squat', strength: 'some',
    why: 'Single-leg work evens out the side that lags, which is often what caps a bilateral squat.' },
  { from: 'knee-extension', to: 'squat', strength: 'some',
    why: 'Direct quad work puts strength exactly where a deep squat is hardest — out of the hole.' },
  { from: 'knee-extension', to: 'leg-press', strength: 'some',
    why: 'The leg press finishes on quads; building them directly moves the press along.' },
  { from: 'knee-extension', to: 'lunge', strength: 'some',
    why: 'Quad strength on the front leg is the limiting factor in most lunges and split squats.' },
  { from: 'hinge', to: 'hip-extension', strength: 'strong',
    why: 'Same hip drive — a stronger hinge makes hip thrusts and bridges feel light.' },
  { from: 'hip-extension', to: 'hinge', strength: 'some',
    why: 'Glute strength at lockout helps you finish a hinge, but the stretched bottom half still needs hinging.' },
  { from: 'knee-flexion', to: 'hinge', strength: 'some',
    why: 'Hamstrings do two jobs; training knee flexion covers the half that hinging alone leaves short.' },
  { from: 'hinge', to: 'knee-flexion', strength: 'some',
    why: 'Hinging loads the hamstrings where they are longest, which shows up in your leg curls.' },
  { from: 'hinge', to: 'squat', strength: 'some',
    why: 'A stronger posterior chain keeps your chest up and your hips from shooting back out of the hole.' },
  { from: 'squat', to: 'hinge', strength: 'some',
    why: 'Squatting builds the trunk and quad strength a heavy hinge sets up with.' },
  { from: 'hip-abduction', to: 'squat', strength: 'indirect',
    why: 'Helps keep the knees tracking out under load — small effect, but it is not nothing.' },
  { from: 'hip-extension', to: 'lunge', strength: 'some',
    why: 'Glute strength is what stands you back up out of a long stride.' },
  { from: 'core-anti-extension', to: 'squat', strength: 'some',
    why: 'A trunk that does not fold means the squat is limited by your legs, which is how it should be.' },
  { from: 'core-anti-extension', to: 'hinge', strength: 'some',
    why: 'Anti-extension bracing is exactly the job the trunk has in a heavy hinge.' },
  { from: 'core-anti-extension', to: 'carry', strength: 'some',
    why: 'A carry is a moving plank — bracing strength is most of it.' },
  { from: 'calf', to: 'lunge', strength: 'indirect',
    why: 'Ankle strength and stability help on single-leg work; do not expect much more than that.' },

  // ---- shoulders and arms ----
  { from: 'lateral-raise', to: 'vertical-push', strength: 'indirect',
    why: 'Side delts add shoulder size and stability, but they are not the muscle pressing the weight up.' },
  { from: 'rear-delt', to: 'vertical-push', strength: 'indirect',
    why: 'Balanced shoulders tolerate pressing volume better, which is a long-game benefit rather than a quick one.' },
  { from: 'horizontal-push', to: 'elbow-extension', strength: 'some',
    why: 'Heavy pressing loads the triceps hard, so pushdowns and extensions climb alongside it.' },
  { from: 'vertical-push', to: 'elbow-extension', strength: 'some',
    why: 'Pressing overhead makes the triceps finish every rep, and that strength shows in direct extension work.' },
  { from: 'horizontal-pull', to: 'elbow-flexion', strength: 'some',
    why: 'Rowing is a lot of accidental biceps work — curls usually go up during a heavy pulling block.' },
]

/** from → to → link, built once. */
const LINK_MAP = new Map<string, PatternLink>()
for (const l of LINKS) LINK_MAP.set(`${l.from}>${l.to}`, l)

const STRENGTH_WEIGHT: Record<CarryoverStrength, number> = { strong: 100, some: 60, indirect: 30 }

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------

const patternOf = (ex: Exercise): MovementPattern => inferQuality(ex).pattern

/** Exercises that can meaningfully carry over: strength and core work. */
function trainable(ex: Exercise): boolean {
  return ex.kind === 'strength' || ex.kind === 'core'
}

function overlap(a: Muscle[], b: Muscle[]): Muscle[] {
  const set = new Set(b)
  return a.filter((m) => set.has(m) && m !== 'full-body' && m !== 'cardio')
}

function muscleList(muscles: Muscle[], max = 2): string {
  const names = muscles.slice(0, max).map((m) => MUSCLE_LABELS[m].toLowerCase())
  if (names.length === 0) return 'the same muscles'
  if (names.length === 1) return names[0]
  return `${names[0]} and ${names[1]}`
}

interface Edge {
  strength: CarryoverStrength
  why: string
  /** bonus points on top of the strength weight */
  bonus: number
}

/**
 * How training `from` feeds `to`. Pattern link first, shared musculature second,
 * nothing at all third. Direction matters: rows feed a bench more than a bench
 * feeds rows.
 */
function edgeBetween(from: Exercise, to: Exercise): Edge | null {
  if (from.id === to.id) return null
  if (!trainable(from) || !trainable(to)) return null

  const pf = patternOf(from)
  const pt = patternOf(to)
  const primaryShared = overlap(from.primary, to.primary)
  const assistShared = overlap(from.primary, to.secondary)

  // same pattern, different exercise — the most direct transfer there is
  if (pf === pt && pf !== 'other') {
    return {
      strength: 'strong',
      why: `Same movement pattern trained a different way, so most of the strength carries — the groove and the set-up still differ, which is why it is not all of it.`,
      bonus: primaryShared.length * 8 + 10,
    }
  }

  const link = LINK_MAP.get(`${pf}>${pt}`)
  if (link) {
    return {
      strength: link.strength,
      why: link.why,
      bonus: primaryShared.length * 6 + assistShared.length * 3,
    }
  }

  // no coaching link — fall back to honest shared musculature
  if (primaryShared.length > 0) {
    return {
      strength: 'some',
      why: `Both train ${muscleList(primaryShared)} directly, so size and strength built here turn up there — the movement itself still has to be practised.`,
      bonus: primaryShared.length * 5,
    }
  }
  if (assistShared.length > 0) {
    return {
      strength: 'indirect',
      why: `Trains ${muscleList(assistShared)}, which only assists in ${to.name.toLowerCase()} — helpful, but it will not move that lift on its own.`,
      bonus: assistShared.length * 2,
    }
  }
  return null
}

function tierBonus(ex: Exercise): number {
  // a better exercise is a better thing to send him to
  return (5 - inferQuality(ex).tier) * 3
}

/** Keep the list varied — six near-identical incline presses is not advice. */
function diversify(rows: CarryoverEntry[], limit: number, perPattern = 2): CarryoverEntry[] {
  const count = new Map<MovementPattern, number>()
  const out: CarryoverEntry[] = []
  for (const row of rows) {
    const p = patternOf(row.exercise)
    const n = count.get(p) ?? 0
    if (n >= perPattern) continue
    count.set(p, n + 1)
    out.push(row)
    if (out.length >= limit) break
  }
  return out
}

// ------------------------------------------------------------------
// the two directions
// ------------------------------------------------------------------

export interface CarryoverOptions {
  limit?: number
  /** drop 'indirect' links — useful when space is tight */
  minStrength?: CarryoverStrength
}

const MIN_RANK: Record<CarryoverStrength, number> = { indirect: 0, some: 1, strong: 2 }

function rank(rows: CarryoverEntry[], opts: CarryoverOptions | undefined, fallbackLimit: number) {
  const min = MIN_RANK[opts?.minStrength ?? 'indirect']
  return diversify(
    rows
      .filter((r) => MIN_RANK[r.strength] >= min)
      .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name)),
    opts?.limit ?? fallbackLimit,
  )
}

/**
 * What getting stronger on THIS lift does for other lifts, best transfer first.
 * Covers the whole library automatically — no maintained id list.
 */
export function carryoverFor(exerciseId: string, opts?: CarryoverOptions): CarryoverEntry[] {
  const from = byId.get(exerciseId)
  if (!from || !trainable(from)) return []
  const rows: CarryoverEntry[] = []
  for (const to of EXERCISES) {
    const edge = edgeBetween(from, to)
    if (!edge) continue
    rows.push({
      exercise: to,
      strength: edge.strength,
      why: edge.why,
      score: STRENGTH_WEIGHT[edge.strength] + edge.bonus + tierBonus(to),
    })
  }
  return rank(rows, opts, 6)
}

/**
 * The reverse view: which lifts FEED this one. This is the list he wants when a
 * lift stalls — bring the feeder up and the stuck lift often follows.
 */
export function builtBy(exerciseId: string, opts?: CarryoverOptions): CarryoverEntry[] {
  const to = byId.get(exerciseId)
  if (!to || !trainable(to)) return []
  const rows: CarryoverEntry[] = []
  for (const from of EXERCISES) {
    const edge = edgeBetween(from, to)
    if (!edge) continue
    rows.push({
      exercise: from,
      strength: edge.strength,
      why: edge.why,
      score: STRENGTH_WEIGHT[edge.strength] + edge.bonus + tierBonus(from),
    })
  }
  return rank(rows, opts, 6)
}

/**
 * How strongly training `a` carries over to training `b`.
 * Returns null when there is no honest link to claim.
 */
export function strengthFor(a: string, b: string): CarryoverStrength | null {
  const from = byId.get(a)
  const to = byId.get(b)
  if (!from || !to) return null
  return edgeBetween(from, to)?.strength ?? null
}

/** The same answer with the sentence and the caveat attached, for UI use. */
export function carryoverBetween(a: string, b: string): {
  strength: CarryoverStrength | null
  why: string
  caveat: string
} {
  const from = byId.get(a)
  const to = byId.get(b)
  const edge = from && to ? edgeBetween(from, to) : null
  return {
    strength: edge?.strength ?? null,
    why: edge?.why
      ?? 'No honest link between these two — they do different jobs, so getting better at one should not be expected to move the other.',
    caveat: CARRYOVER_CAVEAT,
  }
}

// ------------------------------------------------------------------
// grounding it in his own numbers
// ------------------------------------------------------------------

export type FeederStatus =
  /** the feeder lift is moving, the target is the one that is stuck */
  | 'feeder-ahead'
  /** the feeder is the stale one — that is what to bring up */
  | 'feeder-behind'
  /** both moving at a similar rate */
  | 'in-step'
  /** he has logged something, but not enough to call it either way */
  | 'thin'
  /** one or both have never been logged */
  | 'no-data'

export interface FeederReading {
  status: FeederStatus
  /** one honest sentence, safe to render as-is */
  text: string
  /** best estimated 1RM for each, when it exists (Epley, never a tested max) */
  feederE1rm?: number
  targetE1rm?: number
  /** days since each lift last set any best */
  feederStandingDays?: number
  targetStandingDays?: number
}

/** Both lifts' records, read straight off his real logs (warm-ups excluded). */
function reading(logs: WorkoutLog[] | undefined, id: string): ExercisePRs | undefined {
  if (!logs || logs.length === 0) return undefined
  try {
    return prsForExercise(logs, id)
  } catch {
    return undefined
  }
}

/**
 * Is the feeder lift actually ahead of, or behind, the lift it is supposed to
 * help? Answered from his own logged bests — never from theory. "Ahead" means
 * the feeder has moved more recently than the target, so the target is the one
 * that is stuck; "behind" means the feeder is the stale one and is worth
 * bringing up first.
 */
export function feederReading(
  feederId: string,
  targetId: string,
  logs: WorkoutLog[] | undefined,
): FeederReading {
  const feeder = reading(logs, feederId)
  const target = reading(logs, targetId)
  const feederName = byId.get(feederId)?.name ?? 'that lift'
  const targetName = byId.get(targetId)?.name ?? 'this lift'

  if (!feeder && !target) {
    return {
      status: 'no-data',
      text: `Nothing logged for either lift yet, so this is general reasoning rather than a read on your own numbers.`,
    }
  }
  if (!feeder) {
    return {
      status: 'no-data',
      text: `You have not logged ${feederName.toLowerCase()} yet — log a few sessions and this will compare it against your ${targetName.toLowerCase()} instead of guessing.`,
      targetE1rm: target?.bestE1rm?.value,
      targetStandingDays: target?.standingDays,
    }
  }
  if (!target) {
    return {
      status: 'no-data',
      text: `No ${targetName.toLowerCase()} in your logs yet, so there is nothing to compare your ${feederName.toLowerCase()} against.`,
      feederE1rm: feeder.bestE1rm?.value,
      feederStandingDays: feeder.standingDays,
    }
  }

  const base: FeederReading = {
    status: 'thin',
    text: '',
    feederE1rm: feeder.bestE1rm?.value,
    targetE1rm: target.bestE1rm?.value,
    feederStandingDays: feeder.standingDays,
    targetStandingDays: target.standingDays,
  }

  if (feeder.thin || target.thin || feeder.standingDays === undefined || target.standingDays === undefined) {
    return {
      ...base,
      status: 'thin',
      text: `Only a handful of sets logged across the two, which is a data point rather than a trend — keep logging and this line gets sharper.`,
    }
  }

  const fd = feeder.standingDays
  const td = target.standingDays
  const nums = feeder.bestE1rm && target.bestE1rm
    ? ` Best estimates right now: ${feeder.bestE1rm.value} kg on ${feederName.toLowerCase()}, ${target.bestE1rm.value} kg on ${targetName.toLowerCase()} — Epley estimates, not tested maxes.`
    : ''

  // 3 weeks of difference is enough to call one of them stuck
  const GAP = 21
  if (fd + GAP < td) {
    return {
      ...base,
      status: 'feeder-ahead',
      text: `Your ${feederName.toLowerCase()} set a best ${fd} days ago while ${targetName.toLowerCase()} has not moved in ${td} — the feeder is ahead, so the stuck lift is the one that needs the attention.${nums}`,
    }
  }
  if (td + GAP < fd) {
    return {
      ...base,
      status: 'feeder-behind',
      text: `Your ${feederName.toLowerCase()} has not moved in ${fd} days, against ${td} for ${targetName.toLowerCase()} — that makes it a fair candidate to bring up.${nums}`,
    }
  }
  return {
    ...base,
    status: 'in-step',
    text: `Both have moved recently (${fd} and ${td} days since a best), so neither is obviously holding the other back.${nums}`,
  }
}

/**
 * The whole "what builds this" list with his own numbers attached, ready to
 * render. Feeders that are stale relative to the target float to the top,
 * because those are the ones actually worth chasing.
 */
export interface BuiltByReading extends CarryoverEntry {
  reading: FeederReading
}

export function builtByWithData(
  exerciseId: string,
  logs: WorkoutLog[] | undefined,
  opts?: CarryoverOptions,
): BuiltByReading[] {
  const rows = builtBy(exerciseId, opts)
  const out = rows.map((r) => ({ ...r, reading: feederReading(r.exercise.id, exerciseId, logs) }))
  // a stale feeder is the actionable one — nudge it up, but never reorder past
  // a genuinely stronger transfer
  return out.sort((a, b) => {
    const bump = (r: BuiltByReading) => (r.reading.status === 'feeder-behind' ? 12 : 0)
    return (b.score + bump(b)) - (a.score + bump(a))
  })
}

/** Short line for a stalled lift: the honest order of operations. */
export function stallAdvice(exerciseName: string): string[] {
  return [
    `Check the basics first — sleep, food and whether the last few sessions were actually close to failure.`,
    `Give ${exerciseName.toLowerCase()} a lighter week, then come back at the load you last completed cleanly and build from there.`,
    `If it is still stuck, add a feeder lift below for 4-6 weeks while keeping ${exerciseName.toLowerCase()} in the session — it stays the lift you practise.`,
    `Rules of thumb, not guarantees: people respond differently, and a stall that lasts months is usually about recovery rather than exercise choice.`,
  ]
}
