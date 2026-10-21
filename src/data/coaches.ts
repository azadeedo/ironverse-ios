// ============================================================
// COACH PROGRAMS — honest training philosophies, written fresh.
//
// INTEGRITY NOTE (read before editing):
// Nothing in this file reproduces anybody's paid program, its structure or its
// branded name, and there are no quotes here, real or invented. Every line is
// our own description of established, widely-taught training practice:
//   · 'cbum'           — classic high-volume bodybuilding practice
//   · 'nippard'        — evidence-based, high-effort hypertrophy practice
//   · 'classic-volume' — a classic body-part split at high weekly volume
//   · 'machine-day'    — a machine-focused hypertrophy day for a commercial gym
// Credit an influence plainly and generally; never name a person as the author
// of anything here, never imply endorsement, and invent nothing.
//
// Everything is a rule of thumb. Rep ranges and volume landmarks are starting
// points drawn from common practice, not measurements — individual response
// varies, and the log is the final word.
//
// Every exercise id below must exist in @/data/exercises. Unknown ids are
// filtered out at runtime by coachPicks() rather than crashing a screen.
// ============================================================

import { byId } from '@/data/exercises'
import type { CoachId, Exercise, Muscle } from '@/db/types'

// ---------- muscle groups ----------

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'forearms'

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms',
]

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', forearms: 'Forearms',
}

/** Which registry muscles roll up into each display group. */
export const GROUP_MUSCLES: Record<MuscleGroup, Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'upper-back', 'traps', 'lower-back'],
  shoulders: ['front-delts', 'side-delts', 'rear-delts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves'],
  abs: ['abs', 'obliques', 'hip-flexors'],
  forearms: ['forearms'],
}

/** Best-fit group for a muscle (first group that claims it). */
export function groupForMuscle(m: Muscle): MuscleGroup | null {
  for (const g of MUSCLE_GROUPS) if (GROUP_MUSCLES[g].includes(m)) return g
  return null
}

/** All groups touched by a set of focus muscles, in display order, deduped. */
export function groupsForMuscles(muscles: Muscle[]): MuscleGroup[] {
  const out: MuscleGroup[] = []
  for (const m of muscles) {
    const g = groupForMuscle(m)
    if (g && !out.includes(g)) out.push(g)
  }
  return out
}

// ---------- coach shapes ----------

export type PickRole = 'compound' | 'isolation'

export interface CoachPick {
  /** exercise id in @/data/exercises */
  id: string
  /** one line: why THIS coach reaches for it */
  why: string
  role: PickRole
}

export interface Prescription {
  sets: number
  reps: [number, number]
  restSec: number
  /** short coaching line attached to the prescribed exercise */
  note: string
}

/**
 * The programming reasoning behind a style — the part that makes it teachable
 * rather than just a list of exercises. Optional so nothing that existed before
 * this was added is required to carry it.
 */
export interface OrderSlot {
  /** where it sits in the session, e.g. 'First — one heavy compound' */
  slot: string
  /** why it sits there */
  why: string
}

export interface ProgramRationale {
  /** one paragraph: the logic of the running order */
  orderWhy: string
  /** the running order itself, slot by slot */
  order: OrderSlot[]
  /** why these rep ranges and not others */
  repRangeWhy: string[]
  /** how the block moves week to week */
  weekToWeek: string[]
  /** what to actually do when a lift stops moving, in order */
  whenItStalls: string[]
  /** how machine work and free-weight work divide the job in this style */
  machinesVsFreeWeights: string[]
  /** the honest limits of all of the above */
  uncertainty: string
}

/**
 * A program archetype. `Coach` (below) is the subset that the plan generator can
 * build a real block from — those ids must exist in CoachId. Extra archetypes
 * use their own ids and are presented as programming education: browsable,
 * readable, not wired into plan generation.
 */
export interface ProgramArchetype {
  id: string
  /** the style, not the person */
  name: string
  /** plain-language credit for the influence */
  influence: string
  /** one short provenance line — goes on generated plans (Plan.sourceLabel) */
  shortCredit: string
  tagline: string
  /** 4-6 bullet principles, our words */
  principles: string[]
  /** honest "this suits you when…" */
  bestFor: string[]
  /** honest "this is the cost" */
  tradeoffs: string[]
  weeklySets: string
  intensity: string
  tempo: string
  exerciseBias: string
  deload: string
  /** ranked picks per muscle group, best first */
  picks: Record<MuscleGroup, CoachPick[]>
  prescription: {
    compound: Prescription
    isolation: Prescription
    core: Prescription
  }
  /** the teaching layer: order, rep ranges, progression, stalls, machines */
  rationale?: ProgramRationale
  /** a worked example day, so the shape of a session is concrete */
  sampleDay?: { title: string; lines: string[] }
}

/**
 * An archetype the plan generator can actually build (its id is a CoachId).
 * Widening this type is a schema change — leave it alone and add extra
 * archetypes as ProgramArchetype instead.
 */
export interface Coach extends ProgramArchetype {
  id: CoachId
}

// ============================================================
// CLASSIC PHYSIQUE — high volume, machines and cables, chase the contraction
// ============================================================

const CBUM: Coach = {
  id: 'cbum',
  name: 'Classic Physique',
  influence: 'Written in the spirit of classic high-volume bodybuilding practice. Our own words, not anybody’s program, and not endorsed by anyone.',
  shortCredit: 'Classic high-volume bodybuilding practice',
  tagline: 'Volume, control and the squeeze. Build the shape, not just the numbers.',
  principles: [
    'Train the muscle, not the weight — if you cannot feel it working, the load is wrong.',
    'Machines and cables carry most of the volume: constant tension, no balance tax, easy to push alone.',
    'Big compounds stay heavy, but they are a foundation — not something to grind into the floor every week.',
    'Controlled tempo every rep: slow down, pause where it is hardest, never bounce.',
    'Lots of single-joint work at moderate-to-high reps to fill in the shape a compound cannot reach.',
    'More total sets than a strength program, each one a touch further from absolute failure.',
  ],
  bestFor: [
    'You want size and shape more than a bigger one-rep max.',
    'You train alone and want to push hard without a spotter.',
    'You enjoy longer sessions and a proper pump.',
  ],
  tradeoffs: [
    'Higher set counts mean longer sessions — budget 60-75 minutes.',
    'Less emphasis on measurable barbell strength progress week to week.',
    'Volume this high needs sleep and food behind it or it just accumulates fatigue.',
  ],
  weeklySets: '16-22 hard sets per muscle per week',
  intensity: '2-3 reps in reserve on compounds, 1-2 on isolations',
  tempo: '3 seconds down, no bounce, 1-second squeeze at the peak',
  exerciseBias: 'Machine, smith and cable heavy — steady tension beats free-weight balance here',
  deload: 'Pull sets back by about a third whenever joints or sleep start complaining.',
  picks: {
    chest: [
      { id: 'smith-incline-bench-press', why: 'Fixed path lets you hunt the upper chest hard without a spotter.', role: 'compound' },
      { id: 'cable-fly-mid', why: 'The crossover squeeze at the midline is the whole point of this style.', role: 'isolation' },
      { id: 'smith-bench-press', why: 'Heavy flat pressing with the balance taken out of the equation.', role: 'compound' },
      { id: 'cable-fly-low', why: 'Low-to-high scoop finishes the upper chest after pressing.', role: 'isolation' },
      { id: 'cable-chest-press', why: 'Constant tension press — a clean pump finisher.', role: 'compound' },
      { id: 'chest-dip', why: 'Leaning dips stretch the chest under load; add reps before adding weight.', role: 'compound' },
      { id: 'incline-barbell-bench-press', why: 'Kept in for the heavy free-weight stimulus, not for maxing out.', role: 'compound' },
      { id: 'cable-fly-high', why: 'High-to-low arc for the lower chest line.', role: 'isolation' },
    ],
    back: [
      { id: 'lat-pulldown', why: 'Wide-grip pulldowns let you feel the lats instead of fighting bodyweight.', role: 'compound' },
      { id: 'seated-row-close', why: 'Stretch forward, drive the elbows back, hold the squeeze for a beat.', role: 'compound' },
      { id: 'close-grip-lat-pulldown', why: 'Longer pull, deeper stretch at the top of every rep.', role: 'compound' },
      { id: 'single-arm-cable-row', why: 'One side at a time lets you chase the contraction properly.', role: 'compound' },
      { id: 'straight-arm-pulldown', why: 'Isolates the lats with the biceps completely out of the way.', role: 'isolation' },
      { id: 'smith-row', why: 'Rail-guided rowing so the lower back is not the limiting factor.', role: 'compound' },
      { id: 'seated-row-wide', why: 'Flared-elbow rowing to thicken the mid-back.', role: 'compound' },
      { id: 'neutral-grip-pull-up', why: 'Joint-friendly vertical pull when you want bodyweight in the mix.', role: 'compound' },
    ],
    shoulders: [
      { id: 'cable-lateral-raise', why: 'Side delts are width — cables keep tension on them from the very bottom.', role: 'isolation' },
      { id: 'smith-seated-shoulder-press', why: 'Back supported, rails guiding: press hard and safely alone.', role: 'compound' },
      { id: 'cable-rear-delt-fly', why: 'Rear delts get their own dedicated slot, every single week.', role: 'isolation' },
      { id: 'face-pull', why: 'Keeps the shoulders healthy while all that pressing volume accumulates.', role: 'isolation' },
      { id: 'cable-front-raise', why: 'Small extra front-delt work when the upper chest needs company.', role: 'isolation' },
      { id: 'barbell-overhead-press', why: 'The heavy foundation press — sets are kept crisp, never ground out.', role: 'compound' },
      { id: 'barbell-upright-row', why: 'Wide-grip, chest-height only — traps and side delts together.', role: 'isolation' },
    ],
    biceps: [
      { id: 'cable-curl', why: 'Tension from the first millimetre to the last — the classic pump curl.', role: 'isolation' },
      { id: 'curl-bar-curl', why: 'The heavy anchor curl; strict elbows, no hip kick.', role: 'isolation' },
      { id: 'single-arm-cable-curl', why: 'One arm at a time so the weaker side cannot hide.', role: 'isolation' },
      { id: 'bar-drag-curl', why: 'Drags the front delt out of the rep and leaves the biceps alone with it.', role: 'isolation' },
      { id: 'rope-hammer-curl', why: 'Brachialis work — that is what pushes the biceps peak up.', role: 'isolation' },
    ],
    triceps: [
      { id: 'rope-pushdown', why: 'Split the rope at the bottom and hold — a proper peak contraction.', role: 'isolation' },
      { id: 'overhead-cable-extension', why: 'The only cable move that really stretches the long head.', role: 'isolation' },
      { id: 'cable-pushdown', why: 'Heavier straight-bar pushdowns to open the triceps work.', role: 'isolation' },
      { id: 'skull-crusher', why: 'Free-weight stretch under load, bar drifting behind the head.', role: 'isolation' },
      { id: 'triceps-dip', why: 'Upright dips for bodyweight overload at the end of a push day.', role: 'compound' },
      { id: 'close-grip-bench-press', why: 'Heavy triceps pressing when you want a barbell in your hands.', role: 'compound' },
    ],
    quads: [
      { id: 'smith-squat', why: 'Feet forward on the rails puts the work squarely on the quads.', role: 'compound' },
      { id: 'smith-split-squat', why: 'Deep single-leg work with the balance handled for you.', role: 'compound' },
      { id: 'smith-lunge', why: 'Guided lunges let you sink deeper than a free-weight version.', role: 'compound' },
      { id: 'barbell-squat', why: 'The heavy foundation lift — kept in, never taken to a grind.', role: 'compound' },
      { id: 'front-squat', why: 'Upright torso, quad-dominant; a change of stimulus mid-block.', role: 'compound' },
      { id: 'barbell-lunge', why: 'Long strides at moderate load for extra leg volume.', role: 'compound' },
    ],
    hamstrings: [
      { id: 'cable-leg-curl-standing', why: 'Direct knee-flexion work, which the hinge pattern alone never gives you.', role: 'isolation' },
      { id: 'smith-rdl', why: 'Hinge on rails so you can chase the hamstring stretch, not the balance.', role: 'compound' },
      { id: 'barbell-rdl', why: 'Heavy hip hinge — the backbone of hamstring thickness.', role: 'compound' },
      { id: 'good-morning', why: 'Light, slow and high-rep as an accessory, never a max-out lift.', role: 'compound' },
    ],
    glutes: [
      { id: 'barbell-hip-thrust', why: 'The one lift where the glutes are hardest at full contraction.', role: 'compound' },
      { id: 'cable-pull-through', why: 'Cable RDL feel with a hard squeeze at the top of every rep.', role: 'compound' },
      { id: 'cable-glute-kickback', why: 'Pure glute isolation to finish; light stack, long squeeze.', role: 'isolation' },
      { id: 'smith-split-squat', why: 'A long stride turns this into serious glute work.', role: 'compound' },
    ],
    calves: [
      { id: 'smith-calf-raise', why: 'Loaded calves with a full stretch below the plate and a one-second hold up top.', role: 'isolation' },
      { id: 'single-leg-calf-raise', why: 'One leg at a time when the stack is not the limiting factor.', role: 'isolation' },
    ],
    abs: [
      { id: 'cable-crunch', why: 'Loaded spinal flexion — abs respond to resistance like everything else.', role: 'isolation' },
      { id: 'hanging-leg-raise', why: 'Lower abs with a full stretch at the bottom of the hang.', role: 'isolation' },
      { id: 'hanging-knee-raise', why: 'The version you can actually control for 15 clean reps.', role: 'isolation' },
      { id: 'decline-sit-up', why: 'Bench decline for a longer range than a floor crunch.', role: 'isolation' },
      { id: 'cable-woodchopper-high-low', why: 'Loaded rotation for the obliques and the waist line.', role: 'isolation' },
    ],
    forearms: [
      { id: 'reverse-curl', why: 'Builds the forearm mass that makes an arm look finished.', role: 'isolation' },
      { id: 'rope-hammer-curl', why: 'Neutral grip hits biceps and forearms in the same set.', role: 'isolation' },
      { id: 'wrist-curl', why: 'High-rep burnout at the end of an arm day.', role: 'isolation' },
    ],
  },
  prescription: {
    compound: { sets: 4, reps: [8, 12], restSec: 120, note: 'Heavy but clean — stop two reps short of a grind.' },
    isolation: { sets: 4, reps: [12, 20], restSec: 60, note: 'Slow negative, squeeze the top for a full second.' },
    core: { sets: 3, reps: [12, 20], restSec: 45, note: 'Control the range, breathe out hard at the contraction.' },
  },
  rationale: {
    orderWhy:
      'The session is ordered by how much the exercise costs you and how much skill it needs. The heaviest, most technical lift goes first while you are fresh, because that is the one where a tired rep is both the least useful and the most risky. Everything after it is progressively easier to control, so fatigue lands on the muscle instead of on your technique. The pump work sits last on purpose — it is the part that is meant to be done tired.',
    order: [
      { slot: 'First — one heavy compound for the day’s main muscle', why: 'Highest skill and highest load, so it gets your freshest sets. One is enough; two heavy compounds in a row mostly buys fatigue.' },
      { slot: 'Second — a supported or machine press/pull in the same direction', why: 'Same job, less balance tax. You can chase the target reps without the set ending because you wobbled.' },
      { slot: 'Third — a stretch-biased isolation', why: 'Now that the muscle is warm and pre-fatigued, the single-joint work can be done with a long range and real control.' },
      { slot: 'Fourth — a cable or machine squeeze movement', why: 'Constant tension, easy to push near failure alone, and it finishes the muscle rather than the joints.' },
      { slot: 'Last — rear delts, calves, core or whatever lags', why: 'Small muscles go at the end because nothing else in the session depends on them being fresh.' },
    ],
    repRangeWhy: [
      'Compounds at 8-12: heavy enough to build, light enough that a set does not wreck the rest of the session.',
      'Isolations at 12-20: single-joint work is safest and most controllable at higher reps, and that is where the constant-tension feel this style is built on actually happens.',
      'Core at 12-20 with resistance once bodyweight stops being hard — abs progress like any other muscle.',
      'Anything in roughly 5-30 reps grows muscle when the set is taken close enough to failure. The ranges here are about what each exercise is pleasant and repeatable at, not about a magic number.',
    ],
    weekToWeek: [
      'Week 1: set the loads. Every set should finish with two or three clean reps still in you.',
      'Weeks 2-3: add reps first, then load. Adding one set to a lagging muscle is the other lever.',
      'Week 4: pull the sets back by roughly a third and keep the loads. That is the deload, and it is planned, not earned.',
      'Repeat with the same exercises for at least two blocks before changing them — you cannot tell whether an exercise works if you keep swapping it.',
    ],
    whenItStalls: [
      'First check recovery, not programming: sleep, food and whether the last two weeks were genuinely hard.',
      'Drop the load about 10 percent and rebuild over two or three weeks with strict tempo. Most stalls are technique creeping, not strength disappearing.',
      'If it is still stuck, add two sets a week to the muscle that finishes the movement — usually triceps for presses, mid-back for rows.',
      'If that fails, swap the stalled exercise for its closest variation for four to six weeks and come back to it. The pattern keeps training; the specific groove gets a break.',
    ],
    machinesVsFreeWeights: [
      'Free weights own the first exercise: heaviest loads, most systemic stimulus, the thing worth practising.',
      'Machines and cables own the volume: they hold tension where free weights lose it, and you can take them close to failure alone without a spotter.',
      'Anything where balance ends the set before the muscle does belongs on a machine in this style.',
      'Neither is better in the abstract. They are answers to different questions — how heavy, versus how hard on the muscle.',
    ],
    uncertainty:
      'Volume this high suits some people and quietly buries others. Treat 16-22 sets per muscle as a ceiling to work up to, not a starting point, and cut it the week your sleep or joints start complaining.',
  },
  sampleDay: {
    title: 'Sample chest and shoulders day',
    lines: [
      'Smith incline press — 4 × 8-12, two reps in reserve',
      'Cable fly (mid) — 4 × 12-20, one-second squeeze',
      'Smith flat press — 3 × 8-12',
      'Cable lateral raise — 4 × 15-20, no swinging',
      'Rear delt fly — 3 × 15-20',
      'Cable crunch — 3 × 12-20',
    ],
  },
}

// ============================================================
// EVIDENCE-BASED — stretch under load, 0-3 RIR, double progression
// ============================================================

const NIPPARD: Coach = {
  id: 'nippard',
  name: 'Evidence-Based',
  influence: 'Written in the spirit of evidence-based, high-effort hypertrophy training. Our own words, not anybody’s program, and not endorsed by anyone.',
  shortCredit: 'Evidence-based, high-effort hypertrophy practice',
  tagline: 'Load the stretch, leave 0-3 in the tank, and add a rep or a kilo every week.',
  principles: [
    'Pick exercises that load the muscle where it is stretched — that is where the growth signal is strongest.',
    'Take working sets to 0-3 reps in reserve. Close to failure, rarely all the way to it.',
    'Double progression: add reps until you hit the top of the range on every set, then add load and start again.',
    'Roughly 10-20 hard sets per muscle per week — more is not automatically better.',
    'Compounds live around 6-12 reps, isolations around 10-20. Both build; pick the range the exercise suits.',
    'Deloads are planned, not earned by breaking down. One easy week roughly every fifth week.',
  ],
  bestFor: [
    'You want to see measurable progress in a logbook, not just a feeling.',
    'You would rather do fewer, better sets than more sets.',
    'You like knowing why each exercise is in the session.',
  ],
  tradeoffs: [
    'Sets close to failure are genuinely hard — it asks for focus, not just time.',
    'Fewer total sets can feel like less work if you are used to chasing a pump.',
    'Double progression only works if you actually log every set.',
  ],
  weeklySets: '10-20 hard sets per muscle per week',
  intensity: '0-3 reps in reserve; the last set of an exercise is the closest to failure',
  tempo: '2 seconds down, no pause needed at the top, control the stretch',
  exerciseBias: 'Deliberate selection — the best stretch-loaded option available, free weight or machine',
  deload: 'Planned deload every 4-6 weeks: same exercises, about half the sets, load pulled back.',
  picks: {
    chest: [
      { id: 'incline-barbell-bench-press', why: 'Incline pressing loads the chest deep in the stretched position.', role: 'compound' },
      { id: 'barbell-bench-press', why: 'The most progressible chest lift you own — the logbook anchor.', role: 'compound' },
      { id: 'cable-fly-low', why: 'Keeps tension on the chest at full stretch, where a dumbbell fly loses it.', role: 'isolation' },
      { id: 'smith-incline-bench-press', why: 'Safe to take to 1 RIR alone, which is the point of the set.', role: 'compound' },
      { id: 'chest-dip', why: 'A deep-stretch pressing pattern that is easy to load with progression in mind.', role: 'compound' },
      { id: 'cable-fly-mid', why: 'Second fly angle so the chest is trained across its full line of pull.', role: 'isolation' },
      { id: 'cable-chest-press', why: 'A low-fatigue press to add sets without adding joint stress.', role: 'compound' },
    ],
    back: [
      { id: 'pull-up', why: 'Full hang to chin-over-bar is the biggest range your back can train.', role: 'compound' },
      { id: 'barbell-bent-over-row', why: 'Heavy horizontal pulling that progresses cleanly in a logbook.', role: 'compound' },
      { id: 'lat-pulldown', why: 'Lets you load the top stretch and hit rep targets bodyweight will not allow.', role: 'compound' },
      { id: 'seated-row-close', why: 'Full protraction at the front, full squeeze at the back — train the whole range.', role: 'compound' },
      { id: 'single-arm-cable-row', why: 'More range per side and it exposes side-to-side differences.', role: 'compound' },
      { id: 'straight-arm-pulldown', why: 'Loads the lat in its lengthened position with no elbow flexion involved.', role: 'isolation' },
      { id: 'neutral-grip-pull-up', why: 'The grip most people can add reps on week after week.', role: 'compound' },
      { id: 'smith-row', why: 'Row option when lower-back fatigue would otherwise cap the set.', role: 'compound' },
    ],
    shoulders: [
      { id: 'barbell-overhead-press', why: 'The progressible pressing lift for the front delts.', role: 'compound' },
      { id: 'cable-lateral-raise', why: 'Cables keep tension on the side delt at the bottom, where it is stretched.', role: 'isolation' },
      { id: 'face-pull', why: 'Rear delts and external rotators — cheap insurance for a pressing block.', role: 'isolation' },
      { id: 'smith-seated-shoulder-press', why: 'Supported pressing so the set ends at target RIR, not at balance failure.', role: 'compound' },
      { id: 'cable-rear-delt-fly', why: 'Rear delts need direct work; rows alone underdo them.', role: 'isolation' },
      { id: 'cable-front-raise', why: 'Only if front delts lag — pressing usually covers them already.', role: 'isolation' },
    ],
    biceps: [
      { id: 'cable-curl', why: 'Even tension across the curl, so the rep count means something.', role: 'isolation' },
      { id: 'curl-bar-curl', why: 'The load-progression curl — add a plate pair when reps top out.', role: 'isolation' },
      { id: 'rope-hammer-curl', why: 'Brachialis and long head with a grip the elbows tolerate at volume.', role: 'isolation' },
      { id: 'single-arm-cable-curl', why: 'Behind-the-body angle loads the biceps in a stretched position.', role: 'isolation' },
      { id: 'chin-up', why: 'Heavy compound biceps work when the arms need more than curls.', role: 'compound' },
    ],
    triceps: [
      { id: 'overhead-cable-extension', why: 'Overhead loads the long head stretched — the highest-value triceps move.', role: 'isolation' },
      { id: 'skull-crusher', why: 'Same stretch principle with a bar you can progress in small steps.', role: 'isolation' },
      { id: 'close-grip-bench-press', why: 'Lets you load the triceps heavily inside a pressing pattern.', role: 'compound' },
      { id: 'rope-pushdown', why: 'Low-fatigue volume to top the week up to target sets.', role: 'isolation' },
      { id: 'cable-pushdown', why: 'Straight bar when you want more load than the rope allows.', role: 'isolation' },
      { id: 'triceps-dip', why: 'Bodyweight compound for the triceps; weight up once reps pass the range.', role: 'compound' },
    ],
    quads: [
      { id: 'barbell-squat', why: 'Deep squats load the quads stretched and drive the whole lower body.', role: 'compound' },
      { id: 'front-squat', why: 'More knee travel, more quad, and it self-limits before the back does.', role: 'compound' },
      { id: 'smith-split-squat', why: 'Huge stretch on the front leg with very little systemic fatigue.', role: 'compound' },
      { id: 'smith-squat', why: 'Fixed path for squatting close to failure without a spotter.', role: 'compound' },
      { id: 'barbell-lunge', why: 'Single-leg volume that is easy to progress by reps.', role: 'compound' },
    ],
    hamstrings: [
      { id: 'barbell-rdl', why: 'The hamstrings are loaded hardest exactly where they are longest.', role: 'compound' },
      { id: 'smith-rdl', why: 'Same hinge with the balance removed, so the hamstrings end the set.', role: 'compound' },
      { id: 'cable-leg-curl-standing', why: 'Knee flexion is a separate job from hinging — both are needed.', role: 'isolation' },
      { id: 'good-morning', why: 'A lighter hinge variation; useful, but never the heavy lift of the day.', role: 'compound' },
    ],
    glutes: [
      { id: 'barbell-hip-thrust', why: 'Peak glute tension at lockout, and it progresses in a straight line.', role: 'compound' },
      { id: 'smith-split-squat', why: 'A long stride loads the glute stretched at the bottom.', role: 'compound' },
      { id: 'cable-pull-through', why: 'Hinge pattern with zero spinal loading — easy to add sets.', role: 'compound' },
      { id: 'cable-glute-kickback', why: 'Direct glute work to top the week up without more hinging.', role: 'isolation' },
    ],
    calves: [
      { id: 'smith-calf-raise', why: 'Loaded calves with a genuine stretch at the bottom — that stretch is the stimulus.', role: 'isolation' },
      { id: 'single-leg-calf-raise', why: 'More range per leg, and reps are easy to progress.', role: 'isolation' },
    ],
    abs: [
      { id: 'cable-crunch', why: 'Abs are a muscle — load them and progress them like one.', role: 'isolation' },
      { id: 'hanging-leg-raise', why: 'Long range from a full hang, and the difficulty scales cleanly.', role: 'isolation' },
      { id: 'hanging-knee-raise', why: 'The regression to earn the straight-leg version.', role: 'isolation' },
      { id: 'plank', why: 'Anti-extension bracing — useful, but it is not growth work.', role: 'isolation' },
      { id: 'dead-bug', why: 'Teaches the bracing pattern that keeps heavy hinging safe.', role: 'isolation' },
    ],
    forearms: [
      { id: 'reverse-curl', why: 'Grip and forearm strength that unlocks heavier rows and pulls.', role: 'isolation' },
      { id: 'wrist-curl', why: 'Direct flexor work; high reps, short rest, easy to progress.', role: 'isolation' },
      { id: 'rope-hammer-curl', why: 'Trains forearms and elbow flexors in one efficient set.', role: 'isolation' },
    ],
  },
  prescription: {
    compound: { sets: 4, reps: [6, 10], restSec: 150, note: 'Leave 1-2 in the tank. Top the range on every set, then add load.' },
    isolation: { sets: 3, reps: [10, 16], restSec: 90, note: 'Own the stretch. Last set to 0-1 reps in reserve.' },
    core: { sets: 3, reps: [10, 15], restSec: 60, note: 'Add resistance once you clear the top of the range.' },
  },
  rationale: {
    orderWhy:
      'Order follows priority: whatever matters most this block is trained first, while you are fresh enough for the set to actually be close to failure at a heavy load. After that the session moves from most systemically demanding to least, so a stretch-loaded isolation is not being attempted with a trunk that is already cooked. If a lagging muscle keeps ending up last and never progressing, it gets moved first for a block — that reordering is a real programming tool, not a detail.',
    order: [
      { slot: 'First — the priority compound, loaded in a stretched position', why: 'It needs your best sets. Close to failure at a heavy load is the highest-quality stimulus you will produce all session.' },
      { slot: 'Second — a second compound in a different direction or angle', why: 'Covers the part of the muscle the first lift under-trains, without repeating the same fatigue.' },
      { slot: 'Third — the main isolation for the target muscle', why: 'Single-joint work can be taken to 0-1 reps in reserve safely, which is hard to justify on a heavy compound.' },
      { slot: 'Fourth — a second isolation or a machine version', why: 'Adds sets to the muscle at a low fatigue cost, which is how weekly volume is topped up without wrecking the next session.' },
      { slot: 'Last — rear delts, core, calves and anything specifically lagging', why: 'Cheap sets that nothing else depends on. If one of these is a real priority, it moves to the front of the session instead.' },
    ],
    repRangeWhy: [
      'Compounds at 6-10: heavy enough that load progression is obvious in the log, and the rep count is short enough that technique holds.',
      'Isolations at 10-16: the loads are small, the stretch is the point, and higher reps are easier to take genuinely close to failure.',
      'A set anywhere from about 5 to 30 reps builds muscle if it finishes close enough to failure — proximity to failure is doing more of the work than the exact number.',
      'Pick the range the exercise is good at: heavy machine pressing suits low reps, a cable fly does not.',
    ],
    weekToWeek: [
      'Double progression: hold the load until every set hits the top of the range, then add the smallest jump you can build and start again at the bottom.',
      'Add one set per muscle per week only while performance is still improving. When it flattens, the volume has done its job.',
      'Log reps in reserve on the last set. If everything reads 3 or more, the sessions are not hard enough to be measuring anything.',
      'Deload every fourth to sixth week: same exercises, about half the sets, roughly 10 percent off the load.',
    ],
    whenItStalls: [
      'Two sessions with no added reps at the same load is a stall. Three is a pattern worth acting on.',
      'Take a lighter week before doing anything else — a fair amount of what looks like a plateau is accumulated fatigue.',
      'Then check proximity to failure honestly. A set left at 4 reps in reserve will stall at exactly the weight you left it at.',
      'Then add volume to the feeder muscle, or bring in a variation of the same movement pattern for a block while keeping the stalled lift in the session.',
      'Change one thing at a time. Changing three at once means you learn nothing from the result.',
    ],
    machinesVsFreeWeights: [
      'The question is never free weight versus machine, it is which one loads this muscle best in the stretched position and lets you end the set at the reps you planned.',
      'Free weights usually win on loadability and on the first exercise of a session.',
      'Machines and cables usually win on resistance profile, on safety close to failure when training alone, and on adding sets late in a session.',
      'On a stable machine you can train closer to failure than on a free-weight lift, and that is a legitimate reason to pick it — not a compromise.',
    ],
    uncertainty:
      '10-20 hard sets per muscle per week is a landmark, not a prescription. Volume tolerance varies a lot between people and between muscles on the same person; the log decides, not the number.',
  },
  sampleDay: {
    title: 'Sample upper-body day',
    lines: [
      'Incline barbell press — 4 × 6-10, one to two reps in reserve',
      'Bent-over row — 4 × 6-10',
      'Lat pulldown — 3 × 8-12',
      'Cable fly (low) — 3 × 10-16, control the stretch',
      'Overhead cable extension — 3 × 10-16',
      'Cable lateral raise — 3 × 12-16',
    ],
  },
}

// ============================================================
// CLASSIC VOLUME SPLIT — one body part a day, free weights first, lots of sets
// ============================================================

const CLASSIC_VOLUME: ProgramArchetype = {
  id: 'classic-volume',
  name: 'Classic Volume Split',
  influence: 'A body-part split in the spirit of classic gym-floor bodybuilding: free weights first, plenty of sets, one or two muscles a day. Our own words, not anybody’s program.',
  shortCredit: 'Classic body-part split, high weekly volume',
  tagline: 'One or two muscles a day, hit from several angles, and hit again next week.',
  principles: [
    'Each muscle gets a whole session, so there is room to train it from several angles instead of one.',
    'Free weights carry the heavy work: barbells and dumbbells first, everything else after.',
    'Volume is the main lever. Five to six exercises per muscle, three to five sets each, is the shape of a session.',
    'Train each muscle roughly once a week and let it recover completely between sessions.',
    'Reps live in the 8-15 range for most of it — heavy enough to build, repeatable enough to accumulate sets.',
    'Effort is the entry fee: most sets end one to three reps from failure, the last set of an exercise closer still.',
  ],
  bestFor: [
    'You can train five or six days a week and enjoy long sessions.',
    'You like the simplicity of "today is back day".',
    'You have a few years of training behind you and can handle real volume.',
  ],
  tradeoffs: [
    'One session per muscle per week means a missed day costs that muscle the whole week.',
    'Long sessions: 60-90 minutes is normal, and the last exercises are done tired.',
    'Very high set counts are easy to do badly — junk volume feels productive and is not.',
  ],
  weeklySets: '18-25 hard sets per muscle, all in one session',
  intensity: '1-3 reps in reserve, last set of each exercise closest to failure',
  tempo: 'Two seconds down, no bounce, full range on everything',
  exerciseBias: 'Barbells and dumbbells lead; machines and cables finish the muscle off',
  deload: 'Every fifth or sixth week: same exercises, half the sets, loads unchanged.',
  picks: {
    chest: [
      { id: 'barbell-bench-press', why: 'The heaviest chest lift you own, done first while you can actually load it.', role: 'compound' },
      { id: 'incline-barbell-bench-press', why: 'Second pressing angle so the upper chest gets its own heavy work.', role: 'compound' },
      { id: 'incline-dumbbell-press', why: 'Dumbbells allow a deeper stretch than a bar and fix side-to-side differences.', role: 'compound' },
      { id: 'dumbbell-fly', why: 'Classic stretch work — light, slow, and never turned into a press.', role: 'isolation' },
      { id: 'chest-dip', why: 'Leaning forward makes this a lower-chest press you can load with a belt.', role: 'compound' },
      { id: 'cable-fly-mid', why: 'Constant-tension finisher once the heavy pressing is done.', role: 'isolation' },
      { id: 'dumbbell-pullover', why: 'Old-school ribcage and lat work that rounds out a chest day.', role: 'isolation' },
    ],
    back: [
      { id: 'barbell-bent-over-row', why: 'Heavy horizontal pulling is the backbone of back thickness.', role: 'compound' },
      { id: 'pull-up', why: 'Widest range your lats will ever train; add weight once reps pass the range.', role: 'compound' },
      { id: 't-bar-row', why: 'Lets you row heavy with the chest supported by the position rather than the lower back.', role: 'compound' },
      { id: 'dumbbell-row', why: 'One side at a time, long range, easy to progress by reps.', role: 'compound' },
      { id: 'lat-pulldown', why: 'Volume work for the lats after the heavy pulling is finished.', role: 'compound' },
      { id: 'seated-row-wide', why: 'Flared elbows shift the work to the upper back and rear delts.', role: 'compound' },
      { id: 'barbell-shrug', why: 'Direct trap work; hold the top for a beat instead of rolling the shoulders.', role: 'isolation' },
    ],
    shoulders: [
      { id: 'barbell-overhead-press', why: 'The heavy standing press — the strength lift of a shoulder day.', role: 'compound' },
      { id: 'dumbbell-shoulder-press', why: 'Seated dumbbells let each side work independently at a longer range.', role: 'compound' },
      { id: 'dumbbell-lateral-raise', why: 'Side delts are what make shoulders look wide; they get their own volume.', role: 'isolation' },
      { id: 'dumbbell-rear-delt-fly', why: 'Rear delts are the half of the shoulder most people never train.', role: 'isolation' },
      { id: 'barbell-upright-row', why: 'Wide grip, bar to chest height only — traps and side delts together.', role: 'isolation' },
      { id: 'face-pull', why: 'Keeps the shoulders healthy under a week full of pressing.', role: 'isolation' },
    ],
    biceps: [
      { id: 'curl-bar-curl', why: 'The heavy anchor curl — strict elbows, no hip drive.', role: 'isolation' },
      { id: 'dumbbell-curl', why: 'Supinating dumbbells train the biceps through their full job.', role: 'isolation' },
      { id: 'incline-dumbbell-curl', why: 'Arms behind the body loads the biceps at their longest.', role: 'isolation' },
      { id: 'preacher-curl', why: 'Pad support removes the swing, so the bottom half stays honest.', role: 'isolation' },
      { id: 'concentration-curl', why: 'A classic finisher for the peak — light and slow.', role: 'isolation' },
      { id: 'hammer-curl', why: 'Brachialis work, which pushes the biceps up from underneath.', role: 'isolation' },
    ],
    triceps: [
      { id: 'close-grip-bench-press', why: 'The heaviest triceps movement available — it goes first.', role: 'compound' },
      { id: 'skull-crusher', why: 'Loads the long head stretched with a bar you can add small jumps to.', role: 'isolation' },
      { id: 'overhead-dumbbell-extension', why: 'Overhead is where the long head is longest, and it needs that.', role: 'isolation' },
      { id: 'rope-pushdown', why: 'High-rep volume with a hard contraction at the bottom.', role: 'isolation' },
      { id: 'triceps-dip', why: 'Upright dips for bodyweight overload at the end of the session.', role: 'compound' },
      { id: 'bench-dip', why: 'A simple way to add triceps reps when everything else is done.', role: 'compound' },
    ],
    quads: [
      { id: 'barbell-squat', why: 'The lift the whole leg day is built around.', role: 'compound' },
      { id: 'front-squat', why: 'More knee travel and an upright torso — quads without the same back cost.', role: 'compound' },
      { id: 'leg-press', why: 'Loads the legs heavily once the trunk has had enough for the day.', role: 'compound' },
      { id: 'barbell-lunge', why: 'Long strides at moderate load for single-leg volume.', role: 'compound' },
      { id: 'dumbbell-bulgarian-split-squat', why: 'Brutal single-leg stretch with very little spinal loading.', role: 'compound' },
      { id: 'leg-extension', why: 'Direct quad work to finish, where the squat leaves reps on the table.', role: 'isolation' },
    ],
    hamstrings: [
      { id: 'barbell-rdl', why: 'Hamstrings loaded hardest exactly where they are longest.', role: 'compound' },
      { id: 'lying-leg-curl', why: 'Knee flexion is a separate job from hinging and needs its own sets.', role: 'isolation' },
      { id: 'dumbbell-rdl', why: 'Easier to set up than a bar and lets you feel the stretch properly.', role: 'compound' },
      { id: 'seated-leg-curl', why: 'Hip flexed means the hamstrings work at a longer length than lying.', role: 'isolation' },
      { id: 'good-morning', why: 'Light, slow accessory hinging — never a lift to max out on.', role: 'compound' },
    ],
    glutes: [
      { id: 'barbell-hip-thrust', why: 'The one lift where the glutes are hardest at full contraction.', role: 'compound' },
      { id: 'dumbbell-walking-lunge', why: 'Long strides and lots of reps — the classic glute builder.', role: 'compound' },
      { id: 'cable-pull-through', why: 'Hinge feel with no spinal loading, so sets are cheap to add.', role: 'compound' },
      { id: '45-degree-back-extension', why: 'Rounds the back day off with glutes and hamstrings together.', role: 'isolation' },
    ],
    calves: [
      { id: 'standing-calf-raise-machine', why: 'Knee straight is where the big calf muscle does its work.', role: 'isolation' },
      { id: 'seated-calf-raise-machine', why: 'Knee bent shifts it to the muscle underneath — both are needed.', role: 'isolation' },
      { id: 'smith-calf-raise', why: 'A loaded option when the machines are taken.', role: 'isolation' },
      { id: 'single-leg-calf-raise', why: 'One leg at a time when load is not the limiting factor.', role: 'isolation' },
    ],
    abs: [
      { id: 'hanging-leg-raise', why: 'Full stretch from a dead hang, and it scales cleanly.', role: 'isolation' },
      { id: 'decline-sit-up', why: 'Longer range than a floor crunch; hold a plate once it is easy.', role: 'isolation' },
      { id: 'cable-crunch', why: 'Loaded spinal flexion, progressed like any other lift.', role: 'isolation' },
      { id: 'russian-twist', why: 'Rotation work for the obliques, controlled rather than thrashed.', role: 'isolation' },
      { id: 'plank', why: 'Bracing work — useful for the heavy lifts, not a growth exercise.', role: 'isolation' },
    ],
    forearms: [
      { id: 'wrist-curl', why: 'High-rep flexor work at the very end of an arm day.', role: 'isolation' },
      { id: 'reverse-curl', why: 'Builds the top of the forearm and the brachialis at the same time.', role: 'isolation' },
      { id: 'farmers-carry', why: 'Grip that holds up under heavy rows and deadlifts.', role: 'compound' },
      { id: 'reverse-wrist-curl', why: 'Balances all the gripping with work for the other side.', role: 'isolation' },
    ],
  },
  prescription: {
    compound: { sets: 4, reps: [8, 12], restSec: 120, note: 'Heavy and strict. Last set closest to failure.' },
    isolation: { sets: 4, reps: [10, 15], restSec: 75, note: 'Full range, controlled negative, no swinging.' },
    core: { sets: 3, reps: [12, 20], restSec: 45, note: 'Add load once you clear the top of the range.' },
  },
  rationale: {
    orderWhy:
      'A body-part day is ordered heaviest to lightest, and the angles are deliberately varied down the list. The first two exercises are the ones you try to add weight to over the block; everything after them exists to add sets to the same muscle from a direction the first two under-trained. Because the whole session hits one muscle, fatigue accumulates fast — which is exactly why the technical lifts go first and the machine work goes last.',
    order: [
      { slot: 'First — the heaviest barbell lift for the day’s muscle', why: 'You only get one genuinely fresh heavy lift per session. Spend it on the one that progresses in a logbook.' },
      { slot: 'Second — a second heavy angle (incline, different grip, single-limb)', why: 'A muscle is not one line of pull. The second angle covers what the first misses while you are still strong.' },
      { slot: 'Third and fourth — dumbbell and cable work at moderate reps', why: 'This is where most of the weekly set count comes from. Load is lower, control is higher, fatigue cost is manageable.' },
      { slot: 'Fifth — an isolation or machine finisher', why: 'Ends the session on the target muscle rather than on your joints or your lower back.' },
      { slot: 'Optional last — the lagging body part of the moment', why: 'Two or three extra sets for whatever is behind, added where it cannot compromise anything else.' },
    ],
    repRangeWhy: [
      'Compounds at 8-12: enough load to drive strength, enough reps to accumulate volume without maximal grinding every week.',
      'Isolations at 10-15: the sweet spot where you can control the weight and still take the set close to failure.',
      'Calves and abs tolerate and usually need more reps — 12-20 and loaded once bodyweight gets easy.',
      'These are conventions with a lot of practice behind them, not laws. If a lift feels better five reps either side of the range, use that.',
    ],
    weekToWeek: [
      'Same exercises for the whole block. The variety is within the session, not between weeks.',
      'Add reps until the top of the range is hit on every set, then add the smallest available jump.',
      'If the first exercise stops moving for two weeks, that is the signal to look at recovery, not to add a sixth exercise.',
      'Every fifth or sixth week, halve the sets and keep the loads. One easy week protects several hard ones.',
    ],
    whenItStalls: [
      'Cut the session back before you add to it. Six hard exercises done properly beat nine done tired.',
      'Reset the stalled lift about 10 percent lighter and rebuild for three weeks with a strict tempo.',
      'Move the stalled muscle earlier in the week, on a day when you are actually fresh.',
      'If a body part has not moved in two blocks, train it twice a week at roughly half the per-session volume — frequency is the lever a one-day-a-muscle split leaves unused.',
    ],
    machinesVsFreeWeights: [
      'Barbells and dumbbells do the heavy, progressible work at the start of the session.',
      'Machines and cables do the late-session volume, where balance would end the set before the muscle does.',
      'Calves, abs and rear delts are almost entirely machine and cable work here — there is no advantage to doing them the hard way.',
      'If a machine lets you train a muscle closer to failure safely, that is a reason to use it, not a shortcut.',
    ],
    uncertainty:
      'Training a muscle once a week works, but for most people so does twice — often better. This split is a preference for session structure as much as a claim about results, and 18-25 sets in one session is at the upper end of what is useful.',
  },
  sampleDay: {
    title: 'Sample back day',
    lines: [
      'Bent-over row — 4 × 8-12',
      'Pull-up — 4 sets, add weight once you clear 12',
      'T-bar row — 3 × 10-12',
      'Single-arm dumbbell row — 3 × 10-15 per side',
      'Lat pulldown — 3 × 12-15',
      'Barbell shrug — 4 × 10-15, one-second hold',
    ],
  },
}

// ============================================================
// MACHINE HYPERTROPHY DAY — the commercial-gym session
// ============================================================

const MACHINE_DAY: ProgramArchetype = {
  id: 'machine-day',
  name: 'Machine Hypertrophy Day',
  influence: 'A machine-and-cable session for a busy commercial gym, built on ordinary hypertrophy practice. Our own words, not anybody’s program.',
  shortCredit: 'Machine-focused hypertrophy day for a full gym',
  tagline: 'Every set close to failure, nothing riding on balance, no spotter needed.',
  principles: [
    'Machines fix the path so the set ends when the muscle is done, not when your stability runs out.',
    'That means you can honestly train to one or zero reps in reserve on your own — which is the entire point of this day.',
    'Pick the machine whose resistance is hardest where the muscle is stretched, and use the full range it allows.',
    'Low systemic fatigue means you can do this the day after a heavy free-weight session without paying for it twice.',
    'Rest is shorter than a barbell day: 60-90 seconds is usually enough because nothing is taxing your whole system.',
    'Intensity techniques belong here, not on heavy free weights — a drop set on a machine is safe, on a squat it is not.',
  ],
  bestFor: [
    'You are at the commercial gym and want to use what it actually has.',
    'You are training alone and want to push sets properly without a spotter.',
    'You are tired, short on time, or coming back from a heavy week.',
  ],
  tradeoffs: [
    'Machines do not train balance, bracing or the skill of a barbell lift — those need free weights.',
    'You are at the mercy of what is free; have a second choice for every slot.',
    'Machine strength does not read across to a barbell one-for-one, so do not expect the logbook numbers to match.',
  ],
  weeklySets: '12-20 hard sets per muscle per week',
  intensity: '0-1 reps in reserve on most sets — machines are where that is safe alone',
  tempo: 'Two to three seconds down, no slamming the stack, brief pause at the stretch',
  exerciseBias: 'Machines and cables throughout; free weights only where nothing fixed does the job',
  deload: 'Every fourth to sixth week, or simply use this day as the easy day inside a heavier week.',
  picks: {
    chest: [
      { id: 'incline-chest-press-machine', why: 'Upper chest pressing you can take to failure with no spotter and no wobble.', role: 'compound' },
      { id: 'chest-press-machine', why: 'Flat pressing with a fixed path — all the effort goes into the chest.', role: 'compound' },
      { id: 'pec-deck', why: 'The cleanest chest isolation in the building: tension held right through the squeeze.', role: 'isolation' },
      { id: 'converging-chest-press', why: 'The handles come together at the top, which matches what the chest actually does.', role: 'compound' },
      { id: 'seated-cable-fly', why: 'Cables keep tension at full stretch where a dumbbell fly gives it away.', role: 'isolation' },
      { id: 'machine-incline-fly', why: 'Fly pattern aimed at the upper chest, supported the whole way.', role: 'isolation' },
      { id: 'decline-chest-press-machine', why: 'Lower chest angle to round the session out.', role: 'compound' },
    ],
    back: [
      { id: 'iso-lateral-row', why: 'One side at a time with the chest supported — no lower-back tax at all.', role: 'compound' },
      { id: 'chest-supported-row', why: 'Removes the hinge entirely so the set ends on your back.', role: 'compound' },
      { id: 'neutral-grip-lat-pulldown', why: 'The grip most shoulders tolerate at volume, with a long lat range.', role: 'compound' },
      { id: 'seated-row-machine', why: 'Stretch forward, drive the elbows back, hold for a beat.', role: 'compound' },
      { id: 'iso-lateral-pulldown', why: 'Independent arms mean the stronger side cannot carry the weaker one.', role: 'compound' },
      { id: 'single-arm-lat-pulldown', why: 'Most range per side of any pulling option here.', role: 'compound' },
      { id: 'machine-pullover', why: 'Trains the lat with the arms taken out of the equation.', role: 'isolation' },
      { id: 'assisted-pull-up', why: 'Keeps the vertical pull pattern honest while you build up to bodyweight sets.', role: 'compound' },
    ],
    shoulders: [
      { id: 'shoulder-press-machine', why: 'Back supported, path fixed — press until the delts are done.', role: 'compound' },
      { id: 'lateral-raise-machine', why: 'Loads the side delt from the very bottom, which dumbbells never do.', role: 'isolation' },
      { id: 'reverse-pec-deck', why: 'Rear delts with no momentum available at all.', role: 'isolation' },
      { id: 'leaning-cable-lateral-raise', why: 'Leaning away lengthens the side delt at the start of the rep.', role: 'isolation' },
      { id: 'rope-rear-delt-row', why: 'High elbows and a hard squeeze — rear delts plus upper back.', role: 'isolation' },
      { id: 'face-pull', why: 'Shoulder maintenance that costs almost nothing to include.', role: 'isolation' },
    ],
    biceps: [
      { id: 'biceps-curl-machine', why: 'No swing possible, so every rep is the same rep.', role: 'isolation' },
      { id: 'machine-preacher-curl', why: 'Supported arms make the bottom of the curl the hardest part, as it should be.', role: 'isolation' },
      { id: 'bayesian-cable-curl', why: 'Arm behind the body loads the biceps at full length.', role: 'isolation' },
      { id: 'cable-curl', why: 'Even tension the whole way up — a reliable volume curl.', role: 'isolation' },
      { id: 'single-arm-cable-hammer-curl', why: 'Neutral grip for the brachialis, one side at a time.', role: 'isolation' },
    ],
    triceps: [
      { id: 'triceps-extension-machine', why: 'Fixed path means you can finish the set properly without wrecking your elbows.', role: 'isolation' },
      { id: 'seated-dip-machine', why: 'Heavy triceps pressing with the load selected rather than balanced.', role: 'compound' },
      { id: 'seated-overhead-rope-extension', why: 'Overhead position loads the long head stretched — the piece pushdowns miss.', role: 'isolation' },
      { id: 'rope-pushdown', why: 'Cheap, high-quality volume at the end of the session.', role: 'isolation' },
      { id: 'single-arm-cable-pushdown', why: 'Exposes the weaker arm instead of letting it hide.', role: 'isolation' },
    ],
    quads: [
      { id: 'hack-squat', why: 'Squat pattern with the balance removed — you can genuinely go to failure.', role: 'compound' },
      { id: 'leg-press', why: 'Loadable, safe alone, and easy to progress in small jumps.', role: 'compound' },
      { id: 'pendulum-squat', why: 'The arc keeps you upright and the quads loaded through the whole range.', role: 'compound' },
      { id: 'leg-extension', why: 'The only movement that isolates the quads outright — worth its own sets.', role: 'isolation' },
      { id: 'single-leg-press', why: 'Fixes a side-to-side difference without any balance demand.', role: 'compound' },
      { id: 'belt-squat', why: 'Squat loading with nothing on your spine at all.', role: 'compound' },
    ],
    hamstrings: [
      { id: 'seated-leg-curl', why: 'Hip flexed means the hamstrings work at their longest — usually the best curl here.', role: 'isolation' },
      { id: 'lying-leg-curl', why: 'Second knee-flexion angle so both jobs of the hamstring get trained.', role: 'isolation' },
      { id: 'standing-leg-curl-machine', why: 'One leg at a time, full control, no lower back involved.', role: 'isolation' },
      { id: 'cable-leg-curl-standing', why: 'The fallback when every curl machine is taken.', role: 'isolation' },
    ],
    glutes: [
      { id: 'hip-thrust-machine', why: 'Peak glute tension at lockout without wrestling a barbell into place.', role: 'compound' },
      { id: 'glute-drive-machine', why: 'Same job, supported, and easy to load in small steps.', role: 'compound' },
      { id: 'glute-kickback-machine', why: 'Direct glute work per side to top the week up.', role: 'isolation' },
      { id: 'machine-glute-bridge', why: 'A simple, repeatable way to add glute sets at the end of a day.', role: 'compound' },
      { id: 'abductor-machine', why: 'Trains the side of the hip that squats and presses barely touch.', role: 'isolation' },
    ],
    calves: [
      { id: 'standing-calf-raise-machine', why: 'Knee straight, full stretch at the bottom, pause at the top.', role: 'isolation' },
      { id: 'seated-calf-raise-machine', why: 'Knee bent targets the muscle underneath — do both across the week.', role: 'isolation' },
      { id: 'calf-press-leg-press', why: 'Heavy calf work when the dedicated machines are busy.', role: 'isolation' },
    ],
    abs: [
      { id: 'ab-crunch-machine', why: 'Loaded flexion you can progress in small steps like any other lift.', role: 'isolation' },
      { id: 'cable-crunch', why: 'Same idea with a longer range and a harder contraction.', role: 'isolation' },
      { id: 'captains-chair-knee-raise', why: 'Lower abs with the back supported and no grip limit.', role: 'isolation' },
      { id: 'cable-pallof-press', why: 'Anti-rotation bracing — the trunk work that helps the free-weight days.', role: 'isolation' },
    ],
    forearms: [
      { id: 'cable-reverse-curl', why: 'Constant tension on the top of the forearm.', role: 'isolation' },
      { id: 'reverse-wrist-curl', why: 'Balances all the pulling and gripping the rest of the week involves.', role: 'isolation' },
      { id: 'farmers-carry', why: 'The one free-weight movement worth keeping here — grip transfers to everything.', role: 'compound' },
    ],
  },
  prescription: {
    compound: { sets: 3, reps: [8, 12], restSec: 90, note: 'Machines are safe to finish — last set at 0-1 reps in reserve.' },
    isolation: { sets: 3, reps: [12, 18], restSec: 60, note: 'Pause at the stretch, control the return, no stack slamming.' },
    core: { sets: 3, reps: [12, 20], restSec: 45, note: 'Add load once the top of the range is comfortable.' },
  },
  rationale: {
    orderWhy:
      'Because nothing here depends on balance, the running order is about resistance profile rather than risk. The most loadable machine for the biggest muscle goes first while you can still move real weight, then the angles change, then the stretch-loaded isolations come in once the muscle is warm enough to be taken to a genuine failure point. This day also works as the second session for a muscle you already trained with free weights earlier in the week — it adds stimulus without adding much systemic fatigue.',
    order: [
      { slot: 'First — the most loadable machine press, row or squat pattern', why: 'It is the closest thing here to a heavy lift, so it gets the fresh sets.' },
      { slot: 'Second — a second machine at a different angle', why: 'Changes the line of pull while the muscle is still capable of real load.' },
      { slot: 'Third — a stretch-loaded cable or machine isolation', why: 'This is the highest-value set of the day and the one most worth taking to failure.' },
      { slot: 'Fourth — a squeeze-biased isolation or a drop set', why: 'Cheap volume, high control, and it is safe to use intensity techniques here.' },
      { slot: 'Last — rear delts, calves, abs and grip', why: 'Quick, low-cost, and nothing else in the session needs them fresh.' },
    ],
    repRangeWhy: [
      'Machine compounds at 8-12: heavy enough to matter, and a fixed path makes the last reps safe rather than risky.',
      'Isolations at 12-18: the stretch is the stimulus here, and higher reps let you hold position instead of fighting the load.',
      'Short rests work because nothing is taxing your whole body — but if a set drops by more than two reps, rest longer, not shorter.',
      'These are rules of thumb. A machine with a nasty resistance curve may simply be better at higher reps than the number above says.',
    ],
    weekToWeek: [
      'Machines often have big jumps in the stack. Add reps until the top of the range is hit on every set before taking the next pin.',
      'When the next pin is too big a jump, add a set instead, or slow the negative by a second and keep the same load.',
      'Write down the seat and pad settings. Half of what looks like a strength change on a machine is a setting change.',
      'This day can be repeated twice a week for a lagging muscle without much recovery cost — that is its main advantage.',
    ],
    whenItStalls: [
      'Check the settings first: seat height, pad position, and where your feet were.',
      'If the stack jump is the problem, keep the load and add reps, a set, or a slower negative until the next pin is realistic.',
      'Add one drop set on the last exercise for two or three weeks. Safe here in a way it is not on a barbell.',
      'If a machine simply does not suit your limb lengths, use a different machine for the same pattern — there is no prize for forcing it.',
    ],
    machinesVsFreeWeights: [
      'Machines own this day entirely: stability is handled, so effort goes where it is useful and the set can be finished properly alone.',
      'What they cannot give you is bracing, balance and barbell skill — that is what the free-weight days are for.',
      'Expect machine loads and barbell loads to progress independently. They are not the same measurement.',
      'Use this day alongside free-weight training, not instead of it, unless you are deliberately deloading or working around a niggle.',
    ],
    uncertainty:
      'Machines and free weights both build muscle; the research does not support declaring a winner. Choose per exercise on resistance profile, range, and whether you can take the set close to failure safely — not on principle.',
  },
  sampleDay: {
    title: 'Sample full-gym machine day',
    lines: [
      'Incline chest press machine — 3 × 8-12',
      'Iso-lateral row — 3 × 10-12 per side',
      'Pec deck — 3 × 12-18, pause at the stretch',
      'Neutral-grip lat pulldown — 3 × 10-15',
      'Lateral raise machine — 3 × 15-20',
      'Triceps extension machine — 3 × 12-18',
      'Ab crunch machine — 3 × 12-20',
    ],
  },
}

// ---------- registry ----------

export const COACHES: Record<CoachId, Coach> = { cbum: CBUM, nippard: NIPPARD }
export const COACH_LIST: Coach[] = [CBUM, NIPPARD]
export const COACH_IDS: CoachId[] = ['cbum', 'nippard']

/**
 * Extra archetypes: full programming content, browsable and readable, but not
 * wired into plan generation (their ids are not CoachId, and the generator only
 * builds blocks from COACHES). Nothing in the UI may offer to apply these.
 */
export const EXTRA_PROGRAMS: ProgramArchetype[] = [CLASSIC_VOLUME, MACHINE_DAY]

/** Every archetype, applicable ones first. */
export const PROGRAM_LIST: ProgramArchetype[] = [...COACH_LIST, ...EXTRA_PROGRAMS]

/** True when this archetype can actually be turned into a plan/override. */
export function isApplicable(p: ProgramArchetype): p is Coach {
  return (COACH_IDS as string[]).includes(p.id)
}

export function getProgram(id: string | undefined | null): ProgramArchetype | null {
  if (!id) return null
  return PROGRAM_LIST.find((p) => p.id === id) ?? null
}

export function getCoach(id: CoachId | string | undefined | null): Coach | null {
  if (!id) return null
  return (COACHES as Record<string, Coach | undefined>)[id] ?? null
}

export function coachLabel(id: CoachId | string | undefined | null): string {
  return getCoach(id)?.name ?? 'Coach'
}

// ---------- resolved picks (unknown ids filtered out safely) ----------

export interface ResolvedPick extends CoachPick {
  exercise: Exercise
}

/**
 * The coach's picks for a group, resolved against the live registry.
 * Ids that no longer exist are dropped silently — a stale id must never
 * break a screen or a generated plan.
 */
export function coachPicks(coach: ProgramArchetype, group: MuscleGroup): ResolvedPick[] {
  const list = coach.picks[group] ?? []
  const out: ResolvedPick[] = []
  for (const p of list) {
    const ex = byId.get(p.id)
    if (ex) out.push({ ...p, exercise: ex })
  }
  return out
}

/** Every resolved pick for a coach, grouped — used by the compare screen. */
export function allCoachPicks(coach: ProgramArchetype): { group: MuscleGroup; picks: ResolvedPick[] }[] {
  return MUSCLE_GROUPS.map((group) => ({ group, picks: coachPicks(coach, group) }))
}

/**
 * exerciseId → the coach's one-line reason for picking it.
 * Used to stamp PlanExercise.reason so every prescribed lift can explain itself.
 */
export function coachWhyMap(coach: ProgramArchetype): Map<string, string> {
  const map = new Map<string, string>()
  for (const group of MUSCLE_GROUPS) {
    for (const p of coach.picks[group] ?? []) {
      if (!map.has(p.id)) map.set(p.id, p.why)
    }
  }
  return map
}

/** Ids referenced by a coach that are NOT in the registry (dev sanity check). */
export function unknownCoachIds(coach: ProgramArchetype): string[] {
  const missing: string[] = []
  for (const group of MUSCLE_GROUPS) {
    for (const p of coach.picks[group] ?? []) {
      if (!byId.get(p.id)) missing.push(p.id)
    }
  }
  return missing
}
