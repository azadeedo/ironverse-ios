// ============================================================
// THE 12-WEEK PROGRAM — exactly as specified by the owner.
//
// MAIN QUEST: fat loss (98 → 85 kg), muscle, physique, fitness, general
// strength, exercise progression. SIDE QUEST: squat / bench / deadlift PRs.
// Where the two conflict, the main quest wins: accessory hypertrophy work is
// never cut further than the spec says to make room for powerlifting.
//
// Main-lift sets/reps/RIR per week come verbatim from the owner's table.
// Phase names use the physique-first labels; the SBD focus of each week is
// shown alongside so both views are visible.
// ============================================================

import type { MainScheme } from '@/db/types'

export type DayKey = 'tue' | 'wed' | 'thu' | 'fri'
export type LiftKey = 'squat' | 'bench' | 'deadlift'

export interface Phase {
  week: number
  name: string
  /** what the SBD side quest is doing this week */
  sbd: string
  goal: string
  deload?: boolean
  /** block 1 = base movements, 2 = selective variations, 3 = back to measurable */
  block: 1 | 2 | 3
}

export const PHASES: Phase[] = [
  { week: 1, name: 'Foundation', sbd: 'Technique + baseline', block: 1, goal: 'Learn the movements, establish working weights and do not destroy recovery.' },
  { week: 2, name: 'Build', sbd: 'Build', block: 1, goal: 'Most work goes to 3 sets, reps tighten and effort moves to 2–3 reps in reserve.' },
  { week: 3, name: 'Overload', sbd: 'Overload', block: 1, goal: 'Highest volume of the first block — main lifts 4 sets at RIR 2. No forced failure.' },
  { week: 4, name: 'Deload', sbd: 'Deload', block: 1, deload: true, goal: 'Working sets cut about 40–50%, everything at 4+ RIR. No grinders, no PRs.' },
  { week: 5, name: 'Hypertrophy II', sbd: 'Volume', block: 2, goal: 'Productive volume returns with selective exercise variations.' },
  { week: 6, name: 'Strength + Size', sbd: 'Top sets', block: 2, goal: 'Top set at RPE ~8 plus back-offs on the main lifts while hypertrophy work continues.' },
  { week: 7, name: 'Overload II', sbd: 'Heavy exposure', block: 2, goal: 'A controlled single at RPE 7–8 (practice, not a max) with full accessory work.' },
  { week: 8, name: 'Deload II', sbd: 'Deload / resensitise', block: 2, deload: true, goal: 'About 50% accessory volume, no heavy singles, 4+ RIR.' },
  { week: 9, name: 'Advanced Build', sbd: 'Heavy volume', block: 3, goal: 'Back to the measurable anchors with the heaviest straight sets of the program.' },
  { week: 10, name: 'Performance', sbd: 'Peak', block: 3, goal: 'Singles at RPE 8–8.5 and back-off triples; accessories trimmed so strength can show.' },
  { week: 11, name: 'PR Prep + Hypertrophy Maintenance', sbd: 'PR primer', block: 3, goal: 'Keep the heavy single sharp, cut fatigue — hypertrophy work at maintenance, never stopped.' },
  { week: 12, name: 'Performance / PR / Review', sbd: 'PR week', block: 3, goal: 'Optional PR tests: squat Tuesday, bench Wednesday, recovery Thursday, deadlift Friday. Then review the 12 weeks.' },
]

export const DAY_ORDER: DayKey[] = ['tue', 'wed', 'thu', 'fri']
/** JS weekday numbers (0 = Sunday) for the four training days. */
export const DAY_WEEKDAY: Record<DayKey, number> = { tue: 2, wed: 3, thu: 4, fri: 5 }
export const DAY_TITLE: Record<DayKey, string> = {
  tue: 'Lower A — Squat + Quads',
  wed: 'Upper A — Bench + Upper Body',
  thu: 'Lower B — Deadlift + Posterior Chain',
  fri: 'Upper B — Upper Hypertrophy',
}
export const DAY_LABEL: Record<DayKey, string> = { tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' }
export const MAIN_LIFT_OF: Record<DayKey, LiftKey> = { tue: 'squat', wed: 'bench', thu: 'deadlift', fri: 'bench' }
export const LIFT_EXERCISE: Record<LiftKey, string> = {
  squat: 'barbell-squat', bench: 'barbell-bench-press', deadlift: 'barbell-deadlift',
}

// ---------- main lifts, verbatim from the owner's table ----------
export interface MainRx {
  sets: number
  reps: [number, number]
  rir: [number, number]
  scheme: MainScheme
}

const straight = (sets: number, reps: [number, number], rir: [number, number]): MainRx => ({
  sets, reps, rir, scheme: { kind: 'straight' },
})
const deload = (sets: number, reps: number, intensity?: [number, number]): MainRx => ({
  sets, reps: [reps, reps], rir: [4, 5], scheme: { kind: 'straight', intensity: intensity ?? [0.6, 0.7], note: 'Deload — about 60–70% of recent working weight, 4+ reps in reserve.' },
})
const topBack = (topReps: number, rpe: [number, number], sets: number, reps: [number, number], drop?: [number, number]): MainRx => ({
  sets: 1 + sets, reps: [topReps, topReps], rir: [2, 2],
  scheme: { kind: 'top-backoff', topReps, topRpe: rpe, backoffSets: sets, backoffReps: reps, backoffDrop: drop ?? [0.05, 0.08] },
})
const single = (rpe: [number, number], sets: number, reps: [number, number]): MainRx => ({
  sets: 1 + sets, reps: [1, 1], rir: [2, 3],
  scheme: { kind: 'single-backoff', topReps: 1, topRpe: rpe, backoffSets: sets, backoffReps: reps },
})

/** MAIN_RX[week-1][day] */
export const MAIN_RX: Record<DayKey, MainRx>[] = [
  /* 1 */ { tue: straight(3, [6, 6], [3, 3]), wed: straight(3, [6, 6], [3, 3]), thu: straight(3, [5, 5], [3, 3]), fri: straight(3, [8, 8], [3, 3]) },
  /* 2 */ { tue: straight(3, [5, 6], [2, 3]), wed: straight(3, [5, 6], [2, 3]), thu: straight(3, [4, 5], [2, 3]), fri: straight(3, [6, 8], [2, 3]) },
  /* 3 */ { tue: straight(4, [5, 5], [2, 2]), wed: straight(4, [5, 5], [2, 2]), thu: straight(3, [4, 4], [2, 2]), fri: straight(4, [6, 6], [2, 2]) },
  /* 4 */ { tue: deload(2, 5), wed: deload(2, 5), thu: deload(2, 4), fri: deload(2, 6) },
  /* 5 */ { tue: straight(4, [4, 4], [2, 2]), wed: straight(4, [4, 4], [2, 2]), thu: straight(3, [3, 4], [2, 2]), fri: straight(3, [5, 6], [2, 2]) },
  /* 6 */ { tue: topBack(4, [8, 8], 3, [4, 4]), wed: topBack(4, [8, 8], 3, [4, 4]), thu: topBack(3, [8, 8], 2, [3, 3]), fri: straight(3, [5, 5], [2, 2]) },
  /* 7 */ { tue: single([7, 8], 3, [3, 3]), wed: single([7, 8], 3, [3, 3]), thu: single([7, 8], 2, [3, 3]), fri: straight(3, [5, 5], [2, 2]) },
  /* 8 */ { tue: deload(2, 4), wed: deload(2, 4), thu: deload(2, 3), fri: deload(2, 5) },
  /* 9 */ { tue: single([8, 8], 3, [3, 3]), wed: single([8, 8], 3, [3, 3]), thu: single([8, 8], 2, [2, 3]), fri: straight(3, [4, 5], [2, 2]) },
  /* 10 */ { tue: single([8, 8.5], 2, [2, 3]), wed: single([8, 8.5], 2, [2, 3]), thu: single([8, 8.5], 2, [2, 2]), fri: { ...straight(3, [4, 4], [2, 3]), scheme: { kind: 'straight', note: '2–3 sets of 4 — do the third only if the first two moved well.' } } },
  /* 11 */ { tue: single([8, 8.5], 2, [2, 2]), wed: single([8, 8.5], 2, [2, 2]), thu: single([8, 8], 2, [2, 2]), fri: { sets: 2, reps: [3, 5], rir: [4, 5], scheme: { kind: 'technique', intensity: [0.6, 0.7], note: 'Very light bench technique only — skip it if you feel beaten up.' } } },
  /* 12 */ {
    tue: { sets: 3, reps: [1, 1], rir: [0, 1], scheme: { kind: 'pr-test', note: 'Squat PR test — optional side quest. Very light accessories afterwards only if you want them.' } },
    wed: { sets: 3, reps: [1, 1], rir: [0, 1], scheme: { kind: 'pr-test', note: 'Bench PR test — optional. Very low accessory volume.' } },
    thu: { sets: 0, reps: [0, 0], rir: [5, 5], scheme: { kind: 'technique', note: 'Recovery / technique — NO deadlift today. Mobility, walking, very light posterior work if it feels good.' } },
    fri: { sets: 3, reps: [1, 1], rir: [0, 1], scheme: { kind: 'pr-test', note: 'Deadlift PR test — optional. No unnecessary fatigue beforehand.' } },
  },
]

/** Friday's bench variation by week (week 7 uses close-grip for lockout/triceps emphasis). */
export function fridayBenchVariation(week: number): string {
  if (week === 12) return 'barbell-deadlift'
  if (week === 7) return 'close-grip-bench-press'
  return 'paused-bench-press'
}

// ---------- accessories ----------
export interface AccSlot {
  /** base exercise (block 1 and 3) */
  id: string
  /** selective variation for weeks 5–8 — only a few slots change, never all at once */
  block2?: string
  /** why it rotates (shown in the app) */
  rotateReason?: string
  /** 'compound' accessories get compound set counts, 'iso' isolation counts */
  kind: 'compound' | 'iso' | 'core'
  /** rep range in hypertrophy-oriented weeks / strength-oriented weeks */
  reps: [number, number]
  strengthReps?: [number, number]
  rest: number
  superset?: string
  /** this slot follows the pull-up journey (lat pulldown → assisted → BW → weighted) */
  verticalPull?: boolean
  /** fixed set count regardless of the week's base (e.g. hammer curls are always 2) */
  fixedSets?: number
  /** wrist work: 2–3 sets */
  maxSets?: number
  cue?: string
  note?: string
}

export const ACCESSORIES: Record<DayKey, AccSlot[]> = {
  tue: [
    { id: 'barbell-rdl', kind: 'compound', reps: [8, 12], strengthReps: [6, 10], rest: 150, cue: 'Hips back, bar close, stop when the hamstrings are long — not when the plates touch.' },
    { id: 'hack-squat', block2: 'leg-press', rotateReason: 'Different resistance profile for the quads in block 2; both are measurable machine work.', kind: 'compound', reps: [8, 12], rest: 150, cue: 'Full depth you can control, knees travel forward.' },
    { id: 'leg-extension', kind: 'iso', reps: [10, 15], rest: 105, superset: 'A' },
    { id: 'seated-leg-curl', kind: 'iso', reps: [8, 15], rest: 105, superset: 'A', note: 'Default hamstring curl — trains the hamstrings at longer muscle lengths.' },
    { id: 'standing-calf-raise-machine', kind: 'iso', reps: [8, 15], rest: 75, cue: 'Controlled stretch at the bottom — pause a beat.' },
    { id: 'cable-crunch', kind: 'core', reps: [10, 15], rest: 60 },
  ],
  wed: [
    { id: 'chest-supported-row', kind: 'compound', reps: [8, 12], strengthReps: [6, 10], rest: 150, cue: 'Chest stays on the pad — no lower-back help.' },
    { id: 'incline-dumbbell-press', kind: 'compound', reps: [8, 12], strengthReps: [6, 10], rest: 150 },
    { id: 'lat-pulldown', kind: 'compound', reps: [8, 12], strengthReps: [6, 10], rest: 120, verticalPull: true },
    { id: 'cable-lateral-raise', block2: 'dumbbell-lateral-raise', rotateReason: 'An equivalent side-delt option for block 2 — neither is universally superior.', kind: 'iso', reps: [12, 20], rest: 75, superset: 'A' },
    { id: 'incline-dumbbell-curl', kind: 'iso', reps: [8, 15], rest: 75, superset: 'A' },
    { id: 'overhead-cable-extension', kind: 'iso', reps: [8, 15], rest: 90, note: 'Keep 2+ reps in reserve today — Friday needs fresh triceps for bench volume.' },
  ],
  thu: [
    { id: 'dumbbell-bulgarian-split-squat', kind: 'compound', reps: [8, 12], rest: 120, note: 'Each leg. Moderate effort — the deadlift came first today.' },
    { id: 'seated-leg-curl', kind: 'iso', reps: [8, 15], rest: 90 },
    { id: 'chest-supported-row', kind: 'compound', reps: [8, 12], rest: 120 },
    { id: 'reverse-pec-deck', kind: 'iso', reps: [12, 20], rest: 75 },
    { id: 'wrist-curl', kind: 'iso', reps: [12, 20], rest: 60, superset: 'B', maxSets: 3, note: 'After the deadlift — never before it.' },
    { id: 'reverse-wrist-curl', kind: 'iso', reps: [12, 20], rest: 60, superset: 'B', maxSets: 3 },
    { id: 'hanging-knee-raise', kind: 'core', reps: [8, 15], rest: 60 },
  ],
  fri: [
    { id: 'chest-press-machine', kind: 'compound', reps: [8, 12], rest: 120 },
    { id: 'lat-pulldown', kind: 'compound', reps: [8, 12], rest: 120, verticalPull: true },
    { id: 'seated-row-close', block2: 'seated-row-machine', rotateReason: 'Machine row in block 2 changes the resistance curve; the chest-supported row stays constant so back strength stays measurable.', kind: 'compound', reps: [8, 12], rest: 120 },
    { id: 'cable-lateral-raise', kind: 'iso', reps: [12, 20], rest: 75, superset: 'A' },
    { id: 'reverse-pec-deck', block2: 'cable-rear-delt-fly', rotateReason: 'A cable rear-delt fly gives a slightly different line of pull for block 2.', kind: 'iso', reps: [12, 20], rest: 75, superset: 'A' },
    { id: 'preacher-curl', block2: 'bayesian-cable-curl', rotateReason: 'The Bayesian curl loads the biceps with the shoulder extended — a different stimulus for block 2.', kind: 'iso', reps: [8, 15], rest: 75, superset: 'B' },
    { id: 'cable-pushdown', kind: 'iso', reps: [8, 15], rest: 75, superset: 'B' },
    { id: 'hammer-curl', kind: 'iso', reps: [10, 15], rest: 75, fixedSets: 2, note: 'Brachialis, brachioradialis and forearms.' },
  ],
}

/** Sets per accessory kind for each week. Week 1 = 2 sets each, as specified. */
export const ACC_SETS: { compound: number; iso: number; core: number }[] = [
  /* 1 */ { compound: 2, iso: 2, core: 2 },
  /* 2 */ { compound: 3, iso: 3, core: 3 },
  /* 3 */ { compound: 3, iso: 3, core: 3 },
  /* 4 */ { compound: 2, iso: 1, core: 1 }, // ~half
  /* 5 */ { compound: 3, iso: 3, core: 3 },
  /* 6 */ { compound: 3, iso: 2, core: 2 }, // "mostly 2–3"
  /* 7 */ { compound: 3, iso: 3, core: 3 },
  /* 8 */ { compound: 2, iso: 1, core: 1 }, // ~50%
  /* 9 */ { compound: 3, iso: 2, core: 2 }, // slightly reduced
  /* 10 */ { compound: 2, iso: 2, core: 2 }, // ~60–70%
  /* 11 */ { compound: 2, iso: 1, core: 1 }, // maintenance ~40–50%
  /* 12 */ { compound: 1, iso: 1, core: 1 }, // very light, optional
]

/** Accessory RIR target per week. */
export const ACC_RIR: [number, number][] = [
  [3, 3], [2, 3], [1, 2], [4, 5], [1, 2], [1, 2], [1, 2], [4, 5], [1, 2], [2, 3], [2, 3], [3, 4],
]

/** Weeks where compound accessories use the lower "strength" rep range. */
export const STRENGTH_ORIENTED_WEEKS = new Set([6, 7, 10, 11])

/** Main lifts, compounds and isolations all rest as specified. */
export const REST = { main: 240, compound: 150, iso: 90, superset: 105, core: 60 }

// ---------- cardio + steps ----------
export interface CardioRx { sessions: [number, number]; minutes: [number, number]; easy?: boolean; note?: string }
export const CARDIO_RX: CardioRx[] = [
  { sessions: [2, 2], minutes: [15, 15] },
  { sessions: [2, 2], minutes: [15, 20] },
  { sessions: [3, 3], minutes: [20, 20] },
  { sessions: [2, 2], minutes: [15, 15], easy: true, note: 'Easy — deload week.' },
  { sessions: [3, 3], minutes: [20, 20] },
  { sessions: [3, 3], minutes: [20, 25] },
  { sessions: [3, 3], minutes: [20, 25] },
  { sessions: [2, 2], minutes: [15, 20], easy: true, note: 'Reduced — deload week.' },
  { sessions: [3, 3], minutes: [20, 25] },
  { sessions: [2, 3], minutes: [20, 20] },
  { sessions: [2, 2], minutes: [15, 20] },
  { sessions: [0, 2], minutes: [10, 20], easy: true, note: 'Light cardio only around your PR tests.' },
]
export const CARDIO_NOTE =
  'Default is incline treadmill walking at a conversational (Zone 2) effort. A stationary bike or elliptical is fine. ' +
  'Do it after lifting or at a separate time — never demanding cardio before squats or deadlifts. ' +
  'There is no single correct speed, incline or heart rate for everyone: pick a pace where you can still talk in full sentences.'

export const STEP_TARGETS = [8000, 9000, 10000]
export const STEP_NOTE =
  'Start at about 8,000 a day. When you hit it on most days for two weeks and recovery feels fine, move to 9,000, then 10,000. No jumping to 15,000+.'

// ---------- weekly volume targets (direct / high-contribution sets) ----------
export type VolumeGroup = 'chest' | 'back' | 'quads' | 'hamstrings' | 'glutes' | 'side-delts' | 'rear-delts' |
  'biceps' | 'triceps' | 'calves' | 'forearms' | 'core'
export const VOLUME_TARGETS: Record<VolumeGroup, { range: [number, number]; plus?: string; label: string }> = {
  chest: { range: [10, 14], label: 'Chest' },
  back: { range: [10, 14], label: 'Back / lats' },
  quads: { range: [10, 12], label: 'Quads' },
  hamstrings: { range: [8, 12], label: 'Hamstrings' },
  glutes: { range: [6, 10], label: 'Glutes' },
  'side-delts': { range: [6, 6], plus: 'plus pressing contribution', label: 'Side delts' },
  'rear-delts': { range: [6, 6], plus: 'plus pulling contribution', label: 'Rear delts' },
  biceps: { range: [6, 8], plus: 'plus pulling', label: 'Biceps' },
  triceps: { range: [6, 8], plus: 'plus pressing', label: 'Triceps' },
  calves: { range: [6, 6], label: 'Calves' },
  forearms: { range: [4, 6], plus: 'plus pulling, deadlift and grip work', label: 'Forearms' },
  core: { range: [6, 6], label: 'Core' },
}
export const VOLUME_NOTE =
  'These are programming targets for normal training weeks, not biological thresholds. A primary-muscle set counts as 1 direct set; ' +
  'a muscle that only assists counts as 0.5 contribution and is shown separately — a bench set is 1 chest set, not 1 chest + 1 triceps + 1 shoulder set. ' +
  'Deload and peaking weeks are deliberately lower.'

// ---------- PR engine constants ----------
export const PR_WARMUP_PCTS: { pct: number; reps: string }[] = [
  { pct: 0.4, reps: '5' }, { pct: 0.55, reps: '3–5' }, { pct: 0.7, reps: '3' }, { pct: 0.8, reps: '2' }, { pct: 0.87, reps: '1' }, { pct: 0.92, reps: '1 (if it feels right)' },
]
export const PR_INCREMENT: Record<LiftKey, [number, number]> = { squat: [2.5, 5], bench: [1, 2.5], deadlift: [2.5, 5] }

// ---------- sticking points ----------
export const STICKING: Record<LiftKey, string[]> = {
  bench: ['Off the chest', 'Mid-range', 'Lockout'],
  squat: ['Bottom', 'Out of the hole', 'Mid-range', 'Lockout'],
  deadlift: ['Off the floor', 'Below the knee', 'At the knee', 'Lockout'],
}
export const STICKING_SUGGESTIONS: Record<string, { tools: string[]; why: string }> = {
  'bench:Off the chest': { tools: ['paused-bench-press', 'incline-dumbbell-press'], why: 'Paused bench and more chest work at long lengths are possible tools for the bottom of the press.' },
  'bench:Lockout': { tools: ['close-grip-bench-press', 'overhead-cable-extension'], why: 'Close-grip bench and triceps work are possible tools when the finish is the hard part.' },
  'bench:Mid-range': { tools: ['barbell-bench-press'], why: 'Mid-range misses usually respond to more practice at moderate loads — keep the current plan.' },
  'squat:Bottom': { tools: ['paused-squat', 'hack-squat'], why: 'Paused squats, more quad development and bracing work are possible tools.' },
  'squat:Out of the hole': { tools: ['paused-squat', 'leg-press'], why: 'Paused squats and quad volume are possible tools for driving out of the hole.' },
  'squat:Mid-range': { tools: ['barbell-squat'], why: 'More practice at moderate loads usually helps — keep the current plan.' },
  'squat:Lockout': { tools: ['barbell-rdl'], why: 'Lockout misses are rare; glute and hip extension strength is the usual suspect.' },
  'deadlift:Off the floor': { tools: ['paused-deadlift', 'hack-squat'], why: 'A paused deadlift (where appropriate), leg strength and setup/bracing are possible tools.' },
  'deadlift:Below the knee': { tools: ['paused-deadlift', 'barbell-rdl'], why: 'Positioning work and posterior-chain strength are possible tools.' },
  'deadlift:At the knee': { tools: ['barbell-rdl'], why: 'RDLs build the hip extension that carries the bar past the knee.' },
  'deadlift:Lockout': { tools: ['barbell-rdl', 'hip-thrust-machine'], why: 'Posterior-chain development may help the finish.' },
}
/** Never suggest anything from one or two bad sets. */
export const STICKING_MIN_OBSERVATIONS = 4

export const PROGRAM_NAME = 'Ironverse 12-Week — Physique First, SBD Side Quest'
