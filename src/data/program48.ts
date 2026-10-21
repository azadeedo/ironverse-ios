// ============================================================
// THE 12-WEEK PROGRAM — 48 INDIVIDUALLY WRITTEN WORKOUTS
//
// Every week and every day below is spelled out on its own, straight from the
// owner's specification. There is NO shared Tuesday/Wednesday/... template:
// changing week 3 Tuesday cannot change any other workout.
//
// MAIN QUEST: build muscle, lose fat (98 → ~85 kg), get fitter, stronger
// overall, better at harder movements, balanced musculature, grip.
// SIDE QUEST: squat / bench / deadlift PRs. If recovery conflicts, the main
// quest wins — accessory hypertrophy work is never dropped for powerlifting.
//
// Design rules (owner's brief):
//  • anchors stay long enough to progress: squat, bench, deadlift, RDL,
//    a vertical pull and a horizontal row
//  • accessories rotate between blocks, never all at once
//  • sets, reps, RIR, volume, intensity, supersets, cardio and emphasis change
//    week to week
//  • the PROGRAM sets exercise / sets / reps / RIR; the adaptive engine only
//    recommends the LOAD. The two never overwrite each other.
// ============================================================

import type { MainScheme } from '@/db/types'
import type { DayKey, LiftKey } from './program12'

// ---------- types ----------
export type WarmupRule =
  | 'ramp'        // main lift: empty bar → ramp to the first work set, snapped to real plates
  | 'pr-ladder'   // PR day: the PR coach's warm-up ladder
  | 'feeder'      // first compound for a muscle: 1–2 lighter sets before the work sets
  | 'first-light' // isolation: first set a little lighter to groove the movement
  | 'none'

export type ProgressionRule =
  | 'main-rir'       // hold the load after a miss, small increase after a clean session at target RIR
  | 'top-backoff'    // work up to a top set at the RPE shown, back-offs a fixed % lighter
  | 'single-backoff' // a controlled single at the RPE shown, then back-off sets
  | 'double'         // fill the rep range at target RIR on every set → add the smallest load
  | 'reps-variation' // bodyweight: add reps, then move to the harder rung
  | 'deload-hold'    // deload: no progression, light and crisp
  | 'pr-test'        // PR attempts from the PR coach — always optional
  | 'technique'

export type GoalTag = 'SBD side quest' | 'General strength' | 'Hypertrophy' | 'Exercise skill'

export interface CardioDay {
  minutes: [number, number]
  kind: 'incline-walk' | 'easy' | 'walk'
  optional?: boolean
  note?: string
}

export interface ProgramEntry {
  exerciseId: string
  order: number
  sets: number
  repMin: number
  repMax: number
  targetRIR?: [number, number]
  targetRPE?: [number, number]
  restSeconds: number
  supersetGroup?: string
  warmupRule: WarmupRule
  progressionRule: ProgressionRule
  role: 'main' | 'compound' | 'accessory' | 'core'
  /** main lifts: which SBD lift the estimate / PR history belongs to */
  lift?: LiftKey
  scheme?: MainScheme
  /** this slot follows the pull-up journey (pulldown → assisted → pull-up → weighted) */
  pullProgression?: boolean
  perSide?: boolean
  optionalAlternative?: string
  isPRSideQuest: boolean
  goal: GoalTag
  /** short instruction specific to this workout (shown on the card) */
  note?: string
}

export interface ProgramWorkout {
  programWeek: number
  day: DayKey
  phase: string
  title: string
  kind: 'training' | 'deload' | 'pr' | 'recovery' | 'light'
  entries: ProgramEntry[]
  cardio: CardioDay | null
  /** one line about what this session is for */
  intent: string
}

// ---------- compact builders (each call is ONE line of one workout) ----------
type Reps = number | [number, number]
interface Opt {
  rir?: [number, number]; rpe?: [number, number]; rest?: number; ss?: string; alt?: string; note?: string
  perSide?: boolean; warm?: WarmupRule; prog?: ProgressionRule; goal?: GoalTag
}
interface Draft extends Omit<ProgramEntry, 'order' | 'targetRIR' | 'restSeconds' | 'warmupRule' | 'progressionRule' | 'goal'> {
  targetRIR?: [number, number]; restSeconds?: number; warmupRule?: WarmupRule; progressionRule?: ProgressionRule; goal?: GoalTag
}
const rr = (r: Reps): [number, number] => (typeof r === 'number' ? [r, r] : r)

/** main SBD lift, straight sets */
const main = (id: string, lift: LiftKey, sets: number, reps: Reps, rir: [number, number], o: Opt = {}): Draft => ({
  exerciseId: id, lift, sets, repMin: rr(reps)[0], repMax: rr(reps)[1], targetRIR: rir, restSeconds: o.rest ?? 210,
  role: 'main', isPRSideQuest: true, goal: 'SBD side quest', warmupRule: 'ramp', progressionRule: o.prog ?? 'main-rir',
  scheme: { kind: 'straight', ...(o.prog === 'deload-hold' ? { intensity: [0.6, 0.7] as [number, number] } : {}), ...(o.note ? { note: o.note } : {}) },
  note: o.note, ...(o.alt ? { optionalAlternative: o.alt } : {}),
})
/** main lift: top set at RPE then back-offs */
const topSet = (id: string, lift: LiftKey, topReps: number, rpe: [number, number], back: number, backReps: Reps, o: Opt = {}): Draft => ({
  exerciseId: id, lift, sets: 1 + back, repMin: topReps, repMax: topReps, targetRPE: rpe, targetRIR: [2, 2], restSeconds: o.rest ?? 240,
  role: 'main', isPRSideQuest: true, goal: 'SBD side quest', warmupRule: 'ramp', progressionRule: 'top-backoff',
  scheme: { kind: 'top-backoff', topReps, topRpe: rpe, backoffSets: back, backoffReps: rr(backReps), backoffDrop: [0.06, 0.1], ...(o.note ? { note: o.note } : {}) },
  note: o.note,
})
/** main lift: a controlled heavy single, then back-offs */
const single = (id: string, lift: LiftKey, rpe: [number, number], back: number, backReps: Reps, o: Opt = {}): Draft => ({
  exerciseId: id, lift, sets: 1 + back, repMin: 1, repMax: 1, targetRPE: rpe, targetRIR: [2, 3], restSeconds: o.rest ?? 270,
  role: 'main', isPRSideQuest: true, goal: 'SBD side quest', warmupRule: 'ramp', progressionRule: 'single-backoff',
  scheme: { kind: 'single-backoff', topReps: 1, topRpe: rpe, backoffSets: back, backoffReps: rr(backReps), ...(o.note ? { note: o.note } : {}) },
  note: o.note,
})
/** main lift: optional PR test */
const prTest = (id: string, lift: LiftKey, note: string): Draft => ({
  exerciseId: id, lift, sets: 3, repMin: 1, repMax: 1, targetRIR: [0, 1], restSeconds: 300,
  role: 'main', isPRSideQuest: true, goal: 'SBD side quest', warmupRule: 'pr-ladder', progressionRule: 'pr-test',
  scheme: { kind: 'pr-test', note }, note,
})
/** compound accessory (rows, presses, RDL, hack squat…) */
const C = (id: string, sets: number, reps: Reps, o: Opt = {}): Draft => ({
  exerciseId: id, sets, repMin: rr(reps)[0], repMax: rr(reps)[1], ...(o.rir ? { targetRIR: o.rir } : {}), ...(o.rpe ? { targetRPE: o.rpe } : {}),
  restSeconds: o.rest ?? 150, role: 'compound', isPRSideQuest: false, warmupRule: o.warm ?? 'feeder', progressionRule: o.prog ?? 'double',
  goal: o.goal ?? 'General strength', ...(o.ss ? { supersetGroup: o.ss } : {}), ...(o.alt ? { optionalAlternative: o.alt } : {}),
  ...(o.perSide ? { perSide: true } : {}), ...(o.note ? { note: o.note } : {}),
})
/** isolation / hypertrophy accessory */
const I = (id: string, sets: number, reps: Reps, o: Opt = {}): Draft => ({
  ...C(id, sets, reps, o), role: 'accessory', restSeconds: o.rest ?? (o.ss ? 90 : 90), warmupRule: o.warm ?? 'first-light', goal: o.goal ?? 'Hypertrophy',
})
/** core / grip skill work */
const K = (id: string, sets: number, reps: Reps, o: Opt = {}): Draft => ({
  ...C(id, sets, reps, o), role: 'core', restSeconds: o.rest ?? 60, warmupRule: 'none', goal: o.goal ?? 'Exercise skill',
  progressionRule: o.prog ?? 'reps-variation',
})
/** the pull-up journey slot: resolves to his current rung (pulldown → assisted → pull-up → weighted) */
const PULL = (sets: number, reps: Reps, o: Opt = {}): Draft => ({
  ...C('lat-pulldown', sets, reps, { goal: 'Exercise skill', prog: 'reps-variation', ...o }), pullProgression: true,
  note: o.note ?? 'Pull-up journey: done at your current rung — pulldown, assisted pull-up, pull-up or weighted pull-up.',
})
const cardio = (minutes: Reps, kind: CardioDay['kind'] = 'incline-walk', o: { optional?: boolean; note?: string } = {}): CardioDay => ({ minutes: rr(minutes), kind, ...o })

const TITLE = {
  tue: 'Lower A — Squat + Quads',
  wed: 'Upper A — Bench + Back',
  thu: 'Lower B — Deadlift + Posterior Chain',
  fri: 'Upper B — Upper Hypertrophy',
} as const

// Week-level default RIR for accessories (applied where a line has no RIR of its own)
interface WeekCtx { week: number; phase: string; accRir: [number, number]; compRir: [number, number] }

function day(ctx: WeekCtx, d: DayKey, kind: ProgramWorkout['kind'], title: string, intent: string, list: Draft[], cardioRx: CardioDay | null): ProgramWorkout {
  return {
    programWeek: ctx.week, day: d, phase: ctx.phase, title, kind, intent, cardio: cardioRx,
    entries: list.map((x, i): ProgramEntry => ({
      ...x,
      order: i + 1,
      targetRIR: x.targetRIR ?? (x.role === 'compound' ? ctx.compRir : ctx.accRir),
      restSeconds: x.restSeconds ?? 90,
      warmupRule: x.warmupRule ?? 'none',
      progressionRule: kind === 'deload' && x.role !== 'main' ? 'deload-hold' : x.progressionRule ?? 'double',
      goal: x.goal ?? 'Hypertrophy',
    })),
  }
}

// ============================================================
// WEEK 1 — FOUNDATION: learn the movements, establish weights, protect recovery
// ============================================================
const W1: WeekCtx = { week: 1, phase: 'Foundation', accRir: [3, 3], compRir: [3, 3] }
const week1: Record<DayKey, ProgramWorkout> = {
  tue: day(W1, 'tue', 'training', TITLE.tue, 'Learn the squat groove and find honest starting weights — nothing should feel like a grind.', [
    main('barbell-squat', 'squat', 3, 8, [3, 3], { rest: 180 }),
    C('barbell-rdl', 3, 10, { rest: 150, goal: 'General strength' }),
    C('leg-press', 3, [10, 12], { rir: [2, 3], goal: 'Hypertrophy' }),
    I('leg-extension', 2, [12, 15], { ss: 'A' }),
    I('seated-leg-curl', 2, [10, 15], { ss: 'A' }),
    I('standing-calf-raise-machine', 3, [10, 15], { rest: 75 }),
    K('cable-crunch', 3, [12, 15]),
  ], cardio(15, 'incline-walk')),
  wed: day(W1, 'wed', 'training', TITLE.wed, 'Establish bench and back baselines with clean, repeatable reps.', [
    main('barbell-bench-press', 'bench', 3, 8, [3, 3], { rest: 180 }),
    C('chest-supported-row', 3, 10),
    C('incline-dumbbell-press', 3, 10, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 3, [10, 12], { rest: 120 }),
    I('cable-lateral-raise', 2, [15, 20], { ss: 'A' }),
    I('incline-dumbbell-curl', 2, [10, 15], { ss: 'A' }),
    I('overhead-cable-extension', 2, [10, 15]),
  ], cardio(15, 'easy', { optional: true })),
  thu: day(W1, 'thu', 'training', TITLE.thu, 'Groove the deadlift at a comfortable load, then posterior chain and grip.', [
    main('barbell-deadlift', 'deadlift', 3, 5, [3, 3], { rest: 210 }),
    C('dumbbell-bulgarian-split-squat', 3, 10, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg. Moderate effort — the deadlift came first.' }),
    I('seated-leg-curl', 3, [10, 12]),
    C('seated-row-machine', 3, [10, 12], { rest: 120 }),
    I('reverse-pec-deck', 3, 15, { rest: 75 }),
    I('wrist-curl', 2, [15, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 2, [15, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-knee-raise', 3, [10, 15]),
  ], null),
  fri: day(W1, 'fri', 'training', TITLE.fri, 'Machine-based upper hypertrophy — easy to learn, easy to recover from.', [
    C('chest-press-machine', 3, 10, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 3, [10, 12], { rest: 120 }),
    C('seated-row-close', 3, [10, 12], { rest: 120 }),
    C('shoulder-press-machine', 2, [10, 12], { rest: 120, goal: 'Hypertrophy' }),
    I('cable-lateral-raise', 3, 15, { ss: 'A' }),
    I('reverse-pec-deck', 3, 15, { ss: 'A' }),
    I('preacher-curl', 2, [10, 12], { ss: 'B' }),
    I('cable-pushdown', 2, [10, 12], { ss: 'B' }),
    I('hammer-curl', 2, 12, { goal: 'Exercise skill' }),
  ], cardio(15, 'incline-walk')),
}

// ============================================================
// WEEK 2 — BUILD: most work goes to 3 sets, reps tighten, effort moves to 2–3 RIR
// ============================================================
const W2: WeekCtx = { week: 2, phase: 'Build', accRir: [2, 3], compRir: [2, 3] }
const week2: Record<DayKey, ProgramWorkout> = {
  tue: day(W2, 'tue', 'training', TITLE.tue, 'Squat reps drop to 6–8 and the hack squat comes in for direct quad work.', [
    main('barbell-squat', 'squat', 3, [6, 8], [2, 3]),
    C('barbell-rdl', 3, [8, 10]),
    C('hack-squat', 3, [8, 12], { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [12, 15], { ss: 'A' }),
    I('seated-leg-curl', 3, [10, 15], { ss: 'A' }),
    I('seated-calf-raise-machine', 3, [12, 15], { rest: 75 }),
    K('hanging-knee-raise', 3, [10, 15]),
  ], cardio(20, 'incline-walk')),
  wed: day(W2, 'wed', 'training', TITLE.wed, 'Heavier bench, neutral-grip pulldowns and a stretched-position curl.', [
    main('barbell-bench-press', 'bench', 3, [6, 8], [2, 3]),
    C('chest-supported-row', 3, [8, 10]),
    C('incline-dumbbell-press', 3, [8, 10], { goal: 'Hypertrophy' }),
    C('neutral-grip-lat-pulldown', 3, [8, 12], { rest: 120 }),
    I('cable-lateral-raise', 3, [12, 20], { ss: 'A' }),
    I('bayesian-cable-curl', 3, [10, 15], { ss: 'A' }),
    I('overhead-cable-extension', 3, [10, 15]),
  ], null),
  thu: day(W2, 'thu', 'training', TITLE.thu, 'Deadlift reps drop to 4–5; rear delts switch to the cable fly.', [
    main('barbell-deadlift', 'deadlift', 3, [4, 5], [2, 3]),
    C('dumbbell-bulgarian-split-squat', 3, [8, 10], { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 3, [8, 12]),
    C('chest-supported-row', 3, [8, 12], { rest: 120 }),
    I('cable-rear-delt-fly', 3, [12, 20], { rest: 75 }),
    I('wrist-curl', 3, [12, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 3, [12, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('cable-crunch', 3, [10, 15]),
  ], null),
  fri: day(W2, 'fri', 'training', TITLE.fri, 'Paused bench practice opens the day — bench skill without copying Wednesday.', [
    main('paused-bench-press', 'bench', 3, 8, [2, 3], { note: 'Two-second pause on the chest. Not a copy of Wednesday — this is bench skill work.' }),
    C('chest-press-machine', 3, [8, 12], { goal: 'Hypertrophy' }),
    PULL(3, [8, 12], { alt: 'lat-pulldown', note: 'Assisted pull-up OR lat pulldown — your current pull-up rung.' }),
    C('seated-row-close', 3, [8, 12], { rest: 120 }),
    I('cable-lateral-raise', 3, [12, 20], { ss: 'A' }),
    I('reverse-pec-deck', 3, [12, 20], { ss: 'A' }),
    I('preacher-curl', 3, [8, 12], { ss: 'B' }),
    I('cable-pushdown', 3, [8, 12], { ss: 'B' }),
    I('hammer-curl', 2, [10, 15], { goal: 'Exercise skill' }),
  ], cardio(20, 'incline-walk')),
}

// ============================================================
// WEEK 3 — OVERLOAD: highest volume of block 1; main lifts 4 sets at RIR 2
// ============================================================
const W3: WeekCtx = { week: 3, phase: 'Overload', accRir: [1, 2], compRir: [2, 2] }
const week3: Record<DayKey, ProgramWorkout> = {
  tue: day(W3, 'tue', 'training', TITLE.tue, 'Four squat sets of 6 — the hardest lower day of the first block.', [
    main('barbell-squat', 'squat', 4, 6, [2, 2]),
    C('barbell-rdl', 3, 8),
    C('hack-squat', 3, [8, 10], { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [10, 15], { ss: 'A' }),
    I('seated-leg-curl', 3, [8, 12], { ss: 'A' }),
    I('standing-calf-raise-machine', 3, [10, 15], { rest: 75 }),
    K('cable-crunch', 3, [10, 15]),
  ], cardio(20, 'incline-walk')),
  wed: day(W3, 'wed', 'training', TITLE.wed, 'Bench and rows both go to 4 sets — peak upper volume of block 1.', [
    main('barbell-bench-press', 'bench', 4, 6, [2, 2]),
    C('chest-supported-row', 4, 8),
    C('incline-dumbbell-press', 3, 8, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 3, [8, 10], { rest: 120 }),
    I('cable-lateral-raise', 3, [12, 20], { ss: 'A' }),
    I('incline-dumbbell-curl', 3, [8, 12], { ss: 'A' }),
    I('overhead-cable-extension', 3, [8, 12]),
  ], cardio(20, 'easy')),
  thu: day(W3, 'thu', 'training', TITLE.thu, 'Heavier deadlift triples-plus, high row for the lats, reverse curls for grip.', [
    main('barbell-deadlift', 'deadlift', 3, 4, [2, 2]),
    C('dumbbell-bulgarian-split-squat', 3, 8, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 3, [8, 10]),
    C('machine-high-row', 3, [8, 10], { rest: 120 }),
    I('reverse-pec-deck', 3, [12, 15], { rest: 75 }),
    I('reverse-curl', 3, [10, 15], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 2, [15, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-leg-raise', 3, [8, 12], { note: 'Harder than the knee raise — straight legs, no swing.' }),
  ], null),
  fri: day(W3, 'fri', 'training', TITLE.fri, 'Four paused bench sets, then the pull-up journey and full upper pump.', [
    main('paused-bench-press', 'bench', 4, 6, [2, 2], { note: 'Two-second pause on the chest.' }),
    C('chest-press-machine', 3, 8, { goal: 'Hypertrophy' }),
    PULL(3, [6, 10]),
    C('seated-row-machine', 3, [8, 10], { rest: 120 }),
    I('cable-lateral-raise', 3, [12, 20], { ss: 'A' }),
    I('cable-rear-delt-fly', 3, [12, 20], { ss: 'A' }),
    I('preacher-curl', 3, [8, 12], { ss: 'B' }),
    I('cable-pushdown', 3, [8, 12], { ss: 'B' }),
    I('hammer-curl', 2, [10, 12], { goal: 'Exercise skill' }),
  ], cardio(20, 'incline-walk')),
}

// ============================================================
// WEEK 4 — DELOAD: working sets cut ~40–50%, everything at 4+ RIR
// ============================================================
const W4: WeekCtx = { week: 4, phase: 'Deload', accRir: [4, 5], compRir: [4, 5] }
const DL_NOTE = 'Deload — light and crisp, 4+ reps in reserve. No grinders, no PRs.'
const week4: Record<DayKey, ProgramWorkout> = {
  tue: day(W4, 'tue', 'deload', `${TITLE.tue} · Deload`, 'Fatigue comes down so weeks 5–8 can go up. Move well, leave fresh.', [
    main('barbell-squat', 'squat', 2, 6, [4, 5], { prog: 'deload-hold', note: DL_NOTE }),
    C('barbell-rdl', 2, 8),
    C('leg-press', 2, 10, { goal: 'Hypertrophy' }),
    I('seated-leg-curl', 2, 10),
    I('standing-calf-raise-machine', 2, 12, { rest: 75 }),
    K('cable-crunch', 2, [10, 12]),
  ], cardio(15, 'easy')),
  wed: day(W4, 'wed', 'deload', `${TITLE.wed} · Deload`, 'Two easy bench sets and light upper volume — recovery is the goal.', [
    main('barbell-bench-press', 'bench', 2, 6, [4, 5], { prog: 'deload-hold', note: DL_NOTE }),
    C('chest-supported-row', 2, 8),
    C('incline-chest-press-machine', 2, 10, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 2, 10, { rest: 120 }),
    I('cable-lateral-raise', 2, 15),
    I('incline-dumbbell-curl', 2, 12, { ss: 'A' }),
    I('overhead-cable-extension', 2, 12, { ss: 'A' }),
  ], null),
  thu: day(W4, 'thu', 'deload', `${TITLE.thu} · Deload`, 'Light deadlift practice and easy posterior-chain work.', [
    main('barbell-deadlift', 'deadlift', 2, 4, [4, 5], { prog: 'deload-hold', note: DL_NOTE }),
    C('dumbbell-bulgarian-split-squat', 2, 8, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 2, 10),
    C('seated-row-machine', 2, 10, { rest: 120 }),
    I('reverse-pec-deck', 2, 15, { rest: 75 }),
    K('hanging-knee-raise', 2, [8, 12]),
  ], null),
  fri: day(W4, 'fri', 'deload', `${TITLE.fri} · Deload`, 'No barbell today — easy machine pump work.', [
    C('chest-press-machine', 2, 10, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 2, 10, { rest: 120 }),
    C('seated-row-close', 2, 10, { rest: 120 }),
    I('cable-lateral-raise', 2, 15, { ss: 'A' }),
    I('reverse-pec-deck', 2, 15, { ss: 'A' }),
    I('preacher-curl', 2, 12, { ss: 'B' }),
    I('cable-pushdown', 2, 12, { ss: 'B' }),
  ], cardio(15, 'easy')),
}

// ============================================================
// WEEK 5 — HYPERTROPHY II: volume returns with selective variations
// ============================================================
const W5: WeekCtx = { week: 5, phase: 'Hypertrophy II', accRir: [1, 2], compRir: [2, 2] }
const week5: Record<DayKey, ProgramWorkout> = {
  tue: day(W5, 'tue', 'training', TITLE.tue, 'Back to productive volume: 4 hack squat sets and 4 seated calf sets.', [
    main('barbell-squat', 'squat', 3, 8, [2, 2]),
    C('barbell-rdl', 3, [8, 10]),
    C('hack-squat', 4, 10, { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [12, 15]),
    I('seated-leg-curl', 3, [10, 15]),
    I('seated-calf-raise-machine', 4, [10, 15], { rest: 75 }),
    K('cable-crunch', 3, [12, 15]),
  ], cardio(20, 'incline-walk')),
  wed: day(W5, 'wed', 'training', TITLE.wed, 'New block variations: machine high row, incline machine press and the pull-up journey.', [
    main('barbell-bench-press', 'bench', 3, 8, [2, 2]),
    C('machine-high-row', 3, [8, 12], { rest: 120 }),
    C('incline-chest-press-machine', 3, [8, 12], { goal: 'Hypertrophy' }),
    PULL(3, [6, 10], { note: 'Assisted pull-up / pull-up — your current rung.' }),
    I('cable-lateral-raise', 4, [12, 20]),
    I('bayesian-cable-curl', 3, [10, 15]),
    I('overhead-cable-extension', 3, [10, 15]),
  ], cardio(20, 'easy')),
  thu: day(W5, 'thu', 'training', TITLE.thu, 'Deadlift 3×5, leg press replaces split squats, unilateral cable rows.', [
    main('barbell-deadlift', 'deadlift', 3, 5, [2, 2]),
    C('leg-press', 3, [10, 12], { goal: 'Hypertrophy' }),
    I('seated-leg-curl', 3, [10, 12]),
    C('single-arm-cable-row', 3, [10, 12], { perSide: true, rest: 90, note: 'Each arm — full stretch forward.' }),
    I('reverse-pec-deck', 3, [15, 20], { rest: 75 }),
    I('wrist-curl', 3, 15, { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 3, 15, { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-knee-raise', 3, 12),
  ], null),
  fri: day(W5, 'fri', 'training', TITLE.fri, 'Incline dumbbell press leads (no bench today) — upper chest and arm volume.', [
    C('incline-dumbbell-press', 3, [8, 12], { goal: 'Hypertrophy' }),
    C('chest-press-machine', 3, [10, 12], { goal: 'Hypertrophy' }),
    PULL(3, [6, 10]),
    C('seated-row-machine', 3, [10, 12], { rest: 120 }),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('cable-rear-delt-fly', 3, [15, 20], { ss: 'A' }),
    I('preacher-curl', 3, [10, 15], { ss: 'B' }),
    I('cable-pushdown', 3, [10, 15], { ss: 'B' }),
    I('hammer-curl', 2, [12, 15], { goal: 'Exercise skill' }),
  ], cardio(20, 'incline-walk')),
}

// ============================================================
// WEEK 6 — STRENGTH + SIZE: top set + back-offs, hypertrophy continues
// ============================================================
const W6: WeekCtx = { week: 6, phase: 'Strength + Size', accRir: [1, 2], compRir: [2, 2] }
const week6: Record<DayKey, ProgramWorkout> = {
  tue: day(W6, 'tue', 'training', TITLE.tue, 'First top set of the program: one heavy 5 at RPE ~8, then back-offs.', [
    topSet('barbell-squat', 'squat', 5, [8, 8], 3, 5),
    C('barbell-rdl', 3, [6, 8]),
    C('hack-squat', 3, [8, 10], { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [10, 15]),
    I('seated-leg-curl', 3, [8, 12]),
    I('standing-calf-raise-machine', 3, [10, 15], { rest: 75 }),
    K('cable-crunch', 3, [10, 15]),
  ], cardio([20, 25], 'incline-walk')),
  wed: day(W6, 'wed', 'training', TITLE.wed, 'Bench top set at RPE ~8, four rows of 6–10, heavier presses.', [
    topSet('barbell-bench-press', 'bench', 5, [8, 8], 3, 5),
    C('chest-supported-row', 4, [6, 10]),
    C('incline-dumbbell-press', 3, [6, 10], { goal: 'Hypertrophy' }),
    PULL(3, [6, 10], { note: 'Pull-up or lat pulldown — your current rung.' }),
    I('cable-lateral-raise', 3, [12, 20], { ss: 'A' }),
    I('incline-dumbbell-curl', 3, [8, 12], { ss: 'A' }),
    I('overhead-cable-extension', 3, [8, 12]),
  ], cardio([20, 25], 'easy')),
  thu: day(W6, 'thu', 'training', TITLE.thu, 'Deadlift top triple at RPE ~8, split squats return, forearm work changes.', [
    topSet('barbell-deadlift', 'deadlift', 3, [8, 8], 2, 3),
    C('dumbbell-bulgarian-split-squat', 3, 8, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 3, [8, 10]),
    C('seated-row-machine', 3, [8, 10], { rest: 120 }),
    I('reverse-pec-deck', 3, [12, 20], { rest: 75 }),
    I('reverse-curl', 3, [10, 12], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 2, [15, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-leg-raise', 3, [8, 12]),
  ], null),
  fri: day(W6, 'fri', 'training', TITLE.fri, 'Paused bench returns at 3×6, four lateral-raise sets for the shoulders.', [
    main('paused-bench-press', 'bench', 3, 6, [2, 2], { note: 'Two-second pause on the chest.' }),
    C('chest-press-machine', 3, [8, 10], { goal: 'Hypertrophy' }),
    PULL(3, [6, 10]),
    C('seated-row-close', 3, [8, 10], { rest: 120 }),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('cable-rear-delt-fly', 3, [15, 20], { ss: 'A' }),
    I('preacher-curl', 3, [8, 12], { ss: 'B' }),
    I('cable-pushdown', 3, [8, 12], { ss: 'B' }),
    I('hammer-curl', 2, [10, 15], { goal: 'Exercise skill' }),
  ], cardio([20, 25], 'incline-walk')),
}

// ============================================================
// WEEK 7 — OVERLOAD II: controlled heavy singles (RPE 7–8) + full accessory work
// ============================================================
const W7: WeekCtx = { week: 7, phase: 'Overload II', accRir: [1, 2], compRir: [2, 2] }
const week7: Record<DayKey, ProgramWorkout> = {
  tue: day(W7, 'tue', 'training', TITLE.tue, 'Side-quest heavy exposure: one controlled single at RPE 7–8 — practice, not a max.', [
    single('barbell-squat', 'squat', [7, 8], 3, 5, { note: 'SIDE QUEST HEAVY EXPOSURE — a confident single, then 3×5.' }),
    C('barbell-rdl', 3, [6, 8]),
    C('hack-squat', 3, 8, { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [10, 12]),
    I('seated-leg-curl', 3, [8, 12]),
    I('standing-calf-raise-machine', 4, [10, 12], { rest: 75 }),
    K('cable-crunch', 3, [10, 12]),
  ], cardio([20, 25], 'incline-walk')),
  wed: day(W7, 'wed', 'training', TITLE.wed, 'Bench single at RPE 7–8, heavier rows, Bayesian curls return.', [
    single('barbell-bench-press', 'bench', [7, 8], 3, 5, { note: 'SIDE QUEST HEAVY EXPOSURE — a confident single, then 3×5.' }),
    C('chest-supported-row', 4, [6, 8]),
    C('incline-dumbbell-press', 3, 8, { goal: 'Hypertrophy' }),
    PULL(3, [6, 10]),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('bayesian-cable-curl', 3, [10, 12], { ss: 'A' }),
    I('overhead-cable-extension', 3, [10, 12]),
  ], cardio([20, 25], 'easy')),
  thu: day(W7, 'thu', 'training', TITLE.thu, 'Deadlift single at RPE 7–8, then 2×3. High row and full grip work.', [
    single('barbell-deadlift', 'deadlift', [7, 8], 2, 3, { note: 'SIDE QUEST HEAVY EXPOSURE — a confident single, then 2×3.' }),
    C('dumbbell-bulgarian-split-squat', 3, 8, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 3, 8),
    C('machine-high-row', 3, 8, { rest: 120 }),
    I('cable-rear-delt-fly', 3, 15, { rest: 75 }),
    I('wrist-curl', 3, [12, 15], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 3, [12, 15], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-leg-raise', 3, [8, 12]),
  ], null),
  fri: day(W7, 'fri', 'training', TITLE.fri, 'Close-grip bench for triceps and lockout; weighted pull-ups where earned.', [
    main('close-grip-bench-press', 'bench', 3, [6, 8], [2, 2], { note: 'Hands about shoulder-width, elbows tucked — triceps and lockout emphasis.' }),
    C('chest-press-machine', 3, [8, 10], { goal: 'Hypertrophy' }),
    PULL(3, [5, 8], { note: 'Pull-up — or weighted pull-up if you own 8+ clean bodyweight reps.' }),
    C('seated-row-close', 3, [8, 10], { rest: 120 }),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('reverse-pec-deck', 3, [15, 20], { ss: 'A' }),
    I('preacher-curl', 3, [8, 12], { ss: 'B' }),
    I('cable-pushdown', 3, [8, 12], { ss: 'B' }),
    I('hammer-curl', 2, [10, 12], { goal: 'Exercise skill' }),
  ], cardio([20, 25], 'incline-walk')),
}

// ============================================================
// WEEK 8 — DELOAD II: ~50% accessory volume, no heavy singles, 4+ RIR
// (deliberately NOT a copy of week 4: different variations, reps and pairings)
// ============================================================
const W8: WeekCtx = { week: 8, phase: 'Deload II', accRir: [4, 5], compRir: [4, 5] }
const week8: Record<DayKey, ProgramWorkout> = {
  tue: day(W8, 'tue', 'deload', `${TITLE.tue} · Deload II`, 'Second deload — resensitise before the final block. Machines carry the volume.', [
    main('barbell-squat', 'squat', 2, 5, [4, 5], { prog: 'deload-hold', note: DL_NOTE }),
    C('leg-press', 2, [10, 12], { goal: 'Hypertrophy' }),
    I('seated-leg-curl', 2, [10, 12], { ss: 'A' }),
    I('leg-extension', 2, [12, 15], { ss: 'A' }),
    I('seated-calf-raise-machine', 2, [12, 15], { rest: 75 }),
    K('hanging-knee-raise', 2, [10, 12]),
  ], cardio([15, 20], 'easy')),
  wed: day(W8, 'wed', 'deload', `${TITLE.wed} · Deload II`, 'Two light bench sets of 5, machine work, light arms.', [
    main('barbell-bench-press', 'bench', 2, 5, [4, 5], { prog: 'deload-hold', note: DL_NOTE }),
    C('seated-row-machine', 2, 10),
    C('chest-press-machine', 2, 10, { goal: 'Hypertrophy' }),
    C('neutral-grip-lat-pulldown', 2, 10, { rest: 120 }),
    I('cable-lateral-raise', 2, 15),
    I('cable-curl', 2, 12, { ss: 'A' }),
    I('cable-pushdown', 2, 12, { ss: 'A' }),
  ], null),
  thu: day(W8, 'thu', 'deload', `${TITLE.thu} · Deload II`, 'Two light deadlift triples, easy pulls, light core.', [
    main('barbell-deadlift', 'deadlift', 2, 3, [4, 5], { prog: 'deload-hold', note: DL_NOTE }),
    I('seated-leg-curl', 2, 10),
    C('machine-high-row', 2, 10, { rest: 120 }),
    C('lat-pulldown', 2, 10, { rest: 120 }),
    I('cable-rear-delt-fly', 2, 15, { rest: 75 }),
    K('cable-crunch', 2, [10, 12]),
  ], null),
  fri: day(W8, 'fri', 'deload', `${TITLE.fri} · Deload II`, 'Light upper pump — machines only, nothing heavy.', [
    C('incline-chest-press-machine', 2, 10, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 2, 10, { rest: 120 }),
    C('seated-row-close', 2, 10, { rest: 120 }),
    I('cable-lateral-raise', 2, 15, { ss: 'A' }),
    I('reverse-pec-deck', 2, 15, { ss: 'A' }),
    I('hammer-curl', 2, 12, { ss: 'B', goal: 'Exercise skill' }),
    I('overhead-cable-extension', 2, 12, { ss: 'B' }),
  ], cardio([15, 20], 'easy')),
}

// ============================================================
// WEEK 9 — ADVANCED BUILD: back to the measurable anchors, heavier straight sets
// ============================================================
const W9: WeekCtx = { week: 9, phase: 'Advanced Build', accRir: [1, 2], compRir: [2, 2] }
const week9: Record<DayKey, ProgramWorkout> = {
  tue: day(W9, 'tue', 'training', TITLE.tue, 'Squat 4×5 — the heaviest straight sets of the program — plus full quad volume.', [
    main('barbell-squat', 'squat', 4, 5, [2, 2]),
    C('barbell-rdl', 3, 8),
    C('hack-squat', 4, [8, 10], { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [12, 15], { ss: 'A' }),
    I('seated-leg-curl', 3, [10, 12], { ss: 'A' }),
    I('seated-calf-raise-machine', 4, [10, 15], { rest: 75 }),
    K('cable-crunch', 3, [10, 15]),
  ], cardio(25, 'incline-walk')),
  wed: day(W9, 'wed', 'training', TITLE.wed, 'Bench 4×5 and four sets on the pull-up journey.', [
    main('barbell-bench-press', 'bench', 4, 5, [2, 2]),
    C('chest-supported-row', 4, 8),
    C('incline-chest-press-machine', 3, [8, 10], { goal: 'Hypertrophy' }),
    PULL(4, [5, 10]),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('incline-dumbbell-curl', 3, [8, 12], { ss: 'A' }),
    I('overhead-cable-extension', 3, [8, 12]),
  ], cardio(25, 'easy')),
  thu: day(W9, 'thu', 'training', TITLE.thu, 'Deadlift 3×3–4, four rear-delt sets, reverse curls for the forearms.', [
    main('barbell-deadlift', 'deadlift', 3, [3, 4], [2, 2]),
    C('dumbbell-bulgarian-split-squat', 3, [8, 10], { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 3, [8, 12]),
    C('seated-row-machine', 3, [8, 12], { rest: 120 }),
    I('reverse-pec-deck', 4, [12, 20], { rest: 75 }),
    I('reverse-curl', 3, [10, 15], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 2, [15, 20], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-leg-raise', 3, [8, 12]),
  ], null),
  fri: day(W9, 'fri', 'training', TITLE.fri, 'Paused bench 3×5–6 and four sets each for side and rear delts.', [
    main('paused-bench-press', 'bench', 3, [5, 6], [2, 2], { note: 'Two-second pause on the chest.' }),
    C('chest-press-machine', 3, [8, 12], { goal: 'Hypertrophy' }),
    PULL(3, [5, 10]),
    C('seated-row-close', 3, [8, 12], { rest: 120 }),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('cable-rear-delt-fly', 4, [12, 20], { ss: 'A' }),
    I('preacher-curl', 3, [8, 12], { ss: 'B' }),
    I('cable-pushdown', 3, [8, 12], { ss: 'B' }),
    I('hammer-curl', 2, [10, 15], { goal: 'Exercise skill' }),
  ], cardio(25, 'incline-walk')),
}

// ============================================================
// WEEK 10 — PERFORMANCE: singles at RPE 8–8.5, heavier back-off triples
// ============================================================
const W10: WeekCtx = { week: 10, phase: 'Performance', accRir: [2, 2], compRir: [2, 2] }
const week10: Record<DayKey, ProgramWorkout> = {
  tue: day(W10, 'tue', 'training', TITLE.tue, 'Heavier single (RPE 8–8.5) and back-off triples — strength starts to show.', [
    single('barbell-squat', 'squat', [8, 8.5], 3, 3),
    C('barbell-rdl', 3, [6, 8]),
    C('hack-squat', 3, 8, { goal: 'Hypertrophy' }),
    I('leg-extension', 3, [10, 15]),
    I('seated-leg-curl', 3, [8, 12]),
    I('standing-calf-raise-machine', 3, [10, 15], { rest: 75 }),
    K('cable-crunch', 3, [10, 15]),
  ], cardio([20, 25], 'incline-walk')),
  wed: day(W10, 'wed', 'training', TITLE.wed, 'Bench single at RPE 8–8.5, then 3×3. Hypertrophy work holds steady.', [
    single('barbell-bench-press', 'bench', [8, 8.5], 3, 3),
    C('chest-supported-row', 3, [6, 8]),
    C('incline-dumbbell-press', 3, 8, { goal: 'Hypertrophy' }),
    PULL(3, [5, 8]),
    I('cable-lateral-raise', 3, [12, 20]),
    I('incline-dumbbell-curl', 3, [10, 12]),
    I('overhead-cable-extension', 3, [10, 12]),
  ], cardio([20, 25], 'easy', { optional: true, note: 'Optional third session this week.' })),
  thu: day(W10, 'thu', 'training', TITLE.thu, 'Deadlift single at RPE 8–8.5, then 2×2. Accessories trimmed to let strength show.', [
    single('barbell-deadlift', 'deadlift', [8, 8.5], 2, 2),
    C('dumbbell-bulgarian-split-squat', 2, 8, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg. 2–3 sets — stop at 2 if the deadlift was hard.' }),
    I('seated-leg-curl', 3, [8, 10]),
    C('machine-high-row', 3, 8, { rest: 120 }),
    I('reverse-pec-deck', 3, 15, { rest: 75 }),
    I('wrist-curl', 2, [12, 15], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    I('reverse-wrist-curl', 2, [12, 15], { ss: 'B', rest: 60, goal: 'Exercise skill' }),
    K('hanging-leg-raise', 3, [8, 12]),
  ], null),
  fri: day(W10, 'fri', 'training', TITLE.fri, 'No bench today — the main quest gets a full machine upper day.', [
    C('chest-press-machine', 3, [8, 10], { goal: 'Hypertrophy' }),
    PULL(3, [5, 10], { note: 'Lat pulldown or pull-up — your current rung.' }),
    C('seated-row-machine', 3, [8, 10], { rest: 120 }),
    I('cable-lateral-raise', 4, [12, 20], { ss: 'A' }),
    I('cable-rear-delt-fly', 3, [15, 20], { ss: 'A' }),
    I('preacher-curl', 3, [8, 12], { ss: 'B' }),
    I('cable-pushdown', 3, [8, 12], { ss: 'B' }),
    I('hammer-curl', 2, [10, 15], { goal: 'Exercise skill' }),
  ], cardio([20, 25], 'incline-walk')),
}

// ============================================================
// WEEK 11 — PR PREP + HYPERTROPHY MAINTENANCE: skill on the big three, fatigue down
// ============================================================
const W11: WeekCtx = { week: 11, phase: 'PR Prep + Hypertrophy Maintenance', accRir: [2, 3], compRir: [2, 3] }
const week11: Record<DayKey, ProgramWorkout> = {
  tue: day(W11, 'tue', 'light', TITLE.tue, 'Keep the heavy single sharp, cut everything else to maintenance (2 sets).', [
    single('barbell-squat', 'squat', [8, 8.5], 2, 3),
    C('barbell-rdl', 2, [6, 8]),
    C('hack-squat', 2, [8, 10], { goal: 'Hypertrophy' }),
    I('seated-leg-curl', 2, 10),
    I('seated-calf-raise-machine', 2, [12, 15], { rest: 75 }),
    K('cable-crunch', 2, [10, 15]),
  ], null),
  wed: day(W11, 'wed', 'light', TITLE.wed, 'Bench single, two back-off triples, maintenance upper volume.', [
    single('barbell-bench-press', 'bench', [8, 8.5], 2, 3),
    C('chest-supported-row', 2, 8),
    C('incline-dumbbell-press', 2, 8, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 2, [8, 10], { rest: 120 }),
    I('cable-lateral-raise', 2, 15),
    I('bayesian-cable-curl', 2, 10, { ss: 'A' }),
    I('cable-pushdown', 2, 10, { ss: 'A' }),
  ], cardio([15, 20], 'easy')),
  thu: day(W11, 'thu', 'light', TITLE.thu, 'Deadlift single at about RPE 8 and one or two doubles — then keep it short.', [
    single('barbell-deadlift', 'deadlift', [8, 8], 2, 2, { note: 'Single at about RPE 8, then 1–2 doubles — skip the second if the first was slow.' }),
    C('dumbbell-bulgarian-split-squat', 2, 8, { perSide: true, rest: 120, goal: 'Exercise skill', note: 'Each leg.' }),
    I('seated-leg-curl', 2, 10),
    C('seated-row-machine', 2, 8, { rest: 120 }),
    I('reverse-pec-deck', 2, 15, { rest: 75 }),
    K('hanging-knee-raise', 2, [10, 12]),
  ], cardio([15, 20], 'easy')),
  fri: day(W11, 'fri', 'light', `${TITLE.fri} · Light`, 'Light upper hypertrophy — keep the muscle you built, arrive fresh for PR week.', [
    C('chest-press-machine', 2, 10, { goal: 'Hypertrophy' }),
    C('lat-pulldown', 2, 10, { rest: 120 }),
    C('seated-row-close', 2, 10, { rest: 120 }),
    I('cable-lateral-raise', 2, 15, { ss: 'A' }),
    I('cable-rear-delt-fly', 2, 15, { ss: 'A' }),
    I('preacher-curl', 2, 12, { ss: 'B' }),
    I('cable-pushdown', 2, 12, { ss: 'B' }),
  ], null),
}

// ============================================================
// WEEK 12 — PERFORMANCE / PR / REVIEW: optional PR tests, recovery Thursday
// ============================================================
const W12: WeekCtx = { week: 12, phase: 'Performance / PR / Review', accRir: [3, 4], compRir: [3, 4] }
const week12: Record<DayKey, ProgramWorkout> = {
  tue: day(W12, 'tue', 'pr', 'PR Day — Squat', 'OPTIONAL squat PR side quest. Only if readiness is good — the PR coach builds warm-ups and attempts.', [
    prTest('barbell-squat', 'squat', 'Squat PR test — optional. Attempt 1 high-confidence, attempt 2 your PR or a small PR, attempt 3 only if appropriate.'),
    I('leg-extension', 2, 15, { rir: [4, 5], note: 'VERY light — just a pump.' }),
    I('seated-leg-curl', 2, 12, { rir: [4, 5], note: 'VERY light.' }),
  ], null),
  wed: day(W12, 'wed', 'pr', 'PR Day — Bench', 'OPTIONAL bench PR side quest, then a light upper pump.', [
    prTest('barbell-bench-press', 'bench', 'Bench PR test — optional. Spotter or safeties set.'),
    C('lat-pulldown', 2, 12, { rir: [4, 5], rest: 90, note: 'Light.' }),
    I('cable-lateral-raise', 2, 15, { rir: [4, 5] }),
    I('cable-pushdown', 2, 12, { rir: [4, 5] }),
  ], null),
  thu: day(W12, 'thu', 'recovery', 'Recovery / Pump / Technique', 'NO heavy work today — blood flow and technique so Friday feels fresh.', [
    I('seated-leg-curl', 2, 12, { rir: [4, 5] }),
    C('leg-press', 2, 10, { rir: [4, 5], note: 'Light.', goal: 'Hypertrophy' }),
    C('seated-row-machine', 2, 10, { rir: [4, 5], rest: 90 }),
    I('reverse-pec-deck', 2, 15, { rir: [4, 5] }),
    K('cable-crunch', 2, [10, 12]),
  ], cardio([10, 15], 'walk', { optional: true, note: 'Easy walk only.' })),
  fri: day(W12, 'fri', 'pr', 'PR Day — Deadlift + Program Review', 'OPTIONAL deadlift PR side quest. Then the 12-week program review.', [
    prTest('barbell-deadlift', 'deadlift', 'Deadlift PR test — optional. No unnecessary fatigue beforehand.'),
  ], null),
}

/** PROGRAM[week-1][day] — 12 weeks × 4 days = 48 individually written workouts. */
export const PROGRAM: Record<DayKey, ProgramWorkout>[] = [
  week1, week2, week3, week4, week5, week6, week7, week8, week9, week10, week11, week12,
]

export function workoutFor(week: number, d: DayKey): ProgramWorkout | undefined {
  return PROGRAM[week - 1]?.[d]
}

/** every exercise the program uses (pull slot counts as all four rungs) */
export function programExerciseIds(): string[] {
  const ids = new Set<string>()
  for (const w of PROGRAM) for (const d of Object.values(w)) for (const e of d.entries) {
    ids.add(e.exerciseId)
    if (e.pullProgression) ['assisted-pull-up', 'pull-up', 'weighted-pull-up'].forEach((x) => ids.add(x))
  }
  return [...ids]
}

/** weekly cardio summary derived from the days */
export function weekCardio(week: number): { sessions: number; optional: number; minutes: [number, number]; easy: boolean } {
  const days = Object.values(PROGRAM[week - 1] ?? {}).map((d) => d.cardio).filter(Boolean) as CardioDay[]
  const req = days.filter((c) => !c.optional)
  return {
    sessions: req.length,
    optional: days.length - req.length,
    minutes: [Math.min(...days.map((c) => c.minutes[0]), 99), Math.max(...days.map((c) => c.minutes[1]), 0)],
    easy: days.every((c) => c.kind !== 'incline-walk'),
  }
}
