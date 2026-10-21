// ============================================================
// EXERCISE KNOWLEDGE — the "why", the skill network and the transfer labels.
//
// Written for the owner, in plain coaching language. Transfer labels never
// promise results: DIRECT means it IS the skill; everything else "may support".
// Exercises not authored here get an honest inferred card (see knowledgeFor).
// ============================================================

import type { Exercise, Muscle } from '@/db/types'
import { byId } from './exercises'

export type Transfer = 'direct' | 'supporting' | 'general' | 'hypertrophy' | 'technique' | 'stability'
export const TRANSFER_LABEL: Record<Transfer, string> = {
  direct: 'Direct transfer', supporting: 'Supporting transfer', general: 'General strength',
  hypertrophy: 'Hypertrophy support', technique: 'Technique development', stability: 'Stability development',
}
export type Level = 'Foundation' | 'Developing' | 'Competent' | 'Advanced'

export interface Knowledge {
  why: string
  develops: string[]
  mayHelp: string[]
  preparesFor: string[]
  preparedBy: string[]
  regression?: string
  progression?: string
  unlocks?: string[]
  stabilisers: Muscle[]
  transfer: { squat?: Transfer; bench?: Transfer; deadlift?: Transfer }
  difficulty: 1 | 2 | 3 | 4 | 5
  breathing: string
  bracing: string
  rom: string
  /** authored = written for this exercise; inferred = built from its registry data */
  source: 'authored' | 'inferred'
}

const BRACE_HEAVY = 'Big breath into your belly and sides, then tighten as if about to be punched. Hold it through the hardest part of the rep.'
const BRACE_LIGHT = 'Ribs down, abs lightly tight — enough to keep your torso still, not a maximal brace.'
const BREATH_HEAVY = 'Breathe in and brace before each rep; breathe out at the top or once past the hardest point.'
const BREATH_MOD = 'Breathe in on the lowering phase, out as you lift.'

const K: Record<string, Omit<Knowledge, 'source'>> = {
  'barbell-squat': {
    why: 'This is your squat side quest and the biggest leg builder in the program. Practising it twice a week at different intensities is how a squat PR is actually built — strength is specific.',
    develops: ['Quad and glute strength', 'Bracing under load', 'Squat technique and groove'],
    mayHelp: ['Leg size', 'General lower-body strength', 'Deadlift off the floor'],
    preparesFor: ['Paused Squat', 'Heavy singles', 'Squat PR test'],
    preparedBy: ['Bodyweight Squat', 'Goblet Squat'],
    regression: 'goblet-squat', progression: 'paused-squat',
    stabilisers: ['abs', 'obliques', 'lower-back', 'calves'],
    transfer: { squat: 'direct', deadlift: 'supporting' }, difficulty: 4,
    breathing: BREATH_HEAVY, bracing: BRACE_HEAVY,
    rom: 'Hip crease at or just below the top of the knee — as deep as you can keep a neutral back and whole-foot pressure.',
  },
  'barbell-bench-press': {
    why: 'Your bench side quest. Wednesday is the heavier practice day; Friday adds paused work so the bench is trained twice without copying itself.',
    develops: ['Chest and pressing strength', 'Bench technique', 'Upper-back tightness'],
    mayHelp: ['Chest size', 'Push-up ability', 'Triceps strength'],
    preparesFor: ['Paused Bench', 'Heavy singles', 'Bench PR test'],
    preparedBy: ['Machine Chest Press', 'Dumbbell Bench Press', 'Push-Up'],
    regression: 'dumbbell-bench-press', progression: 'paused-bench-press',
    stabilisers: ['upper-back', 'lats', 'abs'],
    transfer: { bench: 'direct' }, difficulty: 4,
    breathing: 'Breathe in at the top, hold as you lower and press, breathe out after lockout.',
    bracing: 'Shoulder blades pinched and down, chest up, feet driving into the floor — a stable arch, not a lifted bum.',
    rom: 'Bar touches the lower chest every rep, then press to straight arms.',
  },
  'barbell-deadlift': {
    why: 'Your deadlift side quest. Kept to low, crisp volume once a week because it is the most fatiguing lift in the program — and it goes on Thursday so Tuesday\'s squats are not in its way.',
    develops: ['Hip-hinge strength', 'Posterior chain', 'Grip and upper-back tension'],
    mayHelp: ['Back thickness', 'Total-body strength', 'Carry and grip strength'],
    preparesFor: ['Heavy singles', 'Deadlift PR test', 'Paused Deadlift where useful'],
    preparedBy: ['Hip Hinge Drill', 'Dumbbell RDL', 'Barbell RDL'],
    regression: 'barbell-rdl', progression: 'paused-deadlift',
    stabilisers: ['abs', 'obliques', 'forearms', 'traps'],
    transfer: { deadlift: 'direct', squat: 'supporting' }, difficulty: 5,
    breathing: BREATH_HEAVY, bracing: BRACE_HEAVY,
    rom: 'From a dead stop on the floor to standing tall with hips locked — every rep.',
  },
  'paused-bench-press': {
    why: 'Extra bench practice that is not a copy of Wednesday. The pause removes the bounce, so your chest has to start every press from a dead stop at its longest length.',
    develops: ['Strength off the chest', 'Bench positional control', 'Chest at long muscle lengths'],
    mayHelp: ['Bench PR', 'Chest size'],
    preparesFor: ['Heavier bench work', 'Competition-style pauses'],
    preparedBy: ['Barbell Bench Press'],
    regression: 'barbell-bench-press', progression: 'barbell-bench-press',
    stabilisers: ['upper-back', 'lats', 'abs'],
    transfer: { bench: 'direct' }, difficulty: 4,
    breathing: 'Breathe in at the top, hold through the pause and the press, out after lockout.',
    bracing: 'Stay pinned and tight during the pause — relaxing on the chest is the common mistake.',
    rom: 'Full touch on the chest with a one-second still pause.',
  },
  'close-grip-bench-press': {
    why: 'Used in week 7 instead of paused bench. A narrower grip puts more work on the triceps and the lockout, which is useful variety at a heavy point in the program.',
    develops: ['Triceps strength', 'Bench lockout'],
    mayHelp: ['Bench PR if lockout is the weak point', 'Triceps size'],
    preparesFor: ['Heavier benching'], preparedBy: ['Barbell Bench Press'],
    regression: 'barbell-bench-press', progression: 'barbell-bench-press',
    stabilisers: ['upper-back', 'abs'],
    transfer: { bench: 'supporting' }, difficulty: 4,
    breathing: 'Breathe in at the top, out after lockout.', bracing: 'Same tight setup as your bench.',
    rom: 'Bar to the lower chest/sternum with elbows tucked closer to the body.',
  },
  'paused-squat': {
    why: 'Not in your default plan. It is the tool the app may suggest if your squats keep getting hardest at the bottom — the pause makes you own that position.',
    develops: ['Strength out of the hole', 'Bracing in the bottom'], mayHelp: ['Squat PR'],
    preparesFor: ['Heavier squats'], preparedBy: ['Barbell Back Squat'],
    regression: 'barbell-squat', progression: 'barbell-squat',
    stabilisers: ['abs', 'obliques', 'lower-back'], transfer: { squat: 'direct' }, difficulty: 4,
    breathing: BREATH_HEAVY, bracing: BRACE_HEAVY, rom: 'Normal depth with a two-second still pause.',
  },
  'paused-deadlift': {
    why: 'Not a default. A possible tool only if your sticking-point log shows the deadlift repeatedly breaking off the floor.',
    develops: ['Position off the floor'], mayHelp: ['Deadlift PR'], preparesFor: ['Heavier deadlifts'], preparedBy: ['Conventional Deadlift'],
    regression: 'barbell-deadlift', progression: 'barbell-deadlift',
    stabilisers: ['abs', 'forearms', 'traps'], transfer: { deadlift: 'direct' }, difficulty: 5,
    breathing: BREATH_HEAVY, bracing: BRACE_HEAVY, rom: 'Floor to lockout with a hold just off the floor.',
  },
  'barbell-rdl': {
    why: 'This movement gives you additional hamstring, glute and hip-hinge training without requiring another maximal deadlift session. It develops your posterior chain and may support your conventional deadlift.',
    develops: ['Hamstrings and glutes', 'Hip hinge', 'Erector endurance', 'Bracing'],
    mayHelp: ['Deadlift', 'Hamstring size'], preparesFor: ['Conventional Deadlift'], preparedBy: ['Hip Hinge Drill', 'Dumbbell RDL'],
    regression: 'dumbbell-rdl', progression: 'barbell-deadlift',
    stabilisers: ['lower-back', 'forearms', 'abs'], transfer: { deadlift: 'supporting', squat: 'hypertrophy' }, difficulty: 3,
    breathing: BREATH_MOD, bracing: BRACE_HEAVY,
    rom: 'Lower until your hamstrings are fully stretched with a neutral back — usually mid-shin. The plates do not need to touch.',
  },
  'hack-squat': {
    why: 'High-quality quad volume without needing a second technical barbell squat on the same day. The machine lets you push the quads hard with less back and balance demand.',
    develops: ['Quad size and strength'], mayHelp: ['Squat out of the hole', 'Leg development'],
    preparesFor: ['Heavier squatting'], preparedBy: ['Leg Press', 'Goblet Squat'],
    regression: 'leg-press', progression: 'barbell-squat',
    stabilisers: ['abs', 'calves'], transfer: { squat: 'hypertrophy' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'As deep as the machine and your hips allow while your lower back stays on the pad.',
  },
  'leg-press': {
    why: 'The block-2 swap for the hack squat. A different resistance profile for the quads with very low technical demand — easy to track and push.',
    develops: ['Quad and glute size'], mayHelp: ['Leg strength'], preparesFor: ['Hack Squat', 'Barbell Squat'], preparedBy: ['Bodyweight Squat'],
    regression: 'bodyweight-squat', progression: 'hack-squat',
    stabilisers: ['abs'], transfer: { squat: 'hypertrophy' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Knees towards the chest until your lower back would start to round off the pad, then press.',
  },
  'leg-extension': {
    why: 'Direct quad work that costs almost no recovery. Paired with leg curls so both sides of the thigh get trained in the same rest window.',
    develops: ['Quad size (especially rectus femoris)'], mayHelp: ['Knee extension strength'], preparesFor: ['Squat and leg press volume'], preparedBy: [],
    progression: 'hack-squat', stabilisers: [], transfer: { squat: 'hypertrophy' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Hold the handles and keep your hips down on the seat.', rom: 'Full extension with a short squeeze, controlled lowering to about 90°.',
  },
  'seated-leg-curl': {
    why: 'Your default hamstring curl. It trains knee flexion with the hip bent, which puts the biarticular hamstrings at relatively long muscle lengths.',
    develops: ['Knee-flexion strength', 'Hamstring size'], mayHelp: ['Deadlift and general lower-body performance', 'Posterior-chain development'],
    preparesFor: ['Nordic curls if you ever want them'], preparedBy: [],
    regression: 'lying-leg-curl', progression: 'nordic-hamstring-curl',
    stabilisers: [], transfer: { deadlift: 'hypertrophy' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Thigh pad snug, lean slightly forward to deepen the stretch.', rom: 'Full stretch at the top to a hard curl under the seat.',
  },
  'standing-calf-raise-machine': {
    why: 'Calves rarely grow from compound lifts alone. A controlled stretch at the bottom is what makes this work.',
    develops: ['Calf size (gastrocnemius)'], mayHelp: ['Ankle stability'], preparesFor: [], preparedBy: [],
    regression: 'single-leg-calf-raise', stabilisers: ['abs'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Deep stretch with a pause at the bottom, all the way up onto the big toe.',
  },
  'seated-calf-raise-machine': {
    why: 'Bent-knee calf work biases the soleus. A useful alternative if the standing machine is busy.',
    develops: ['Soleus'], mayHelp: ['Calf size'], preparesFor: [], preparedBy: [], stabilisers: [], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Full stretch to full contraction.',
  },
  'cable-crunch': {
    why: 'Loadable ab training. Because you can add weight, it progresses like any other lift.',
    develops: ['Abdominal strength', 'Trunk flexion'], mayHelp: ['Bracing for squats and deadlifts'], preparesFor: ['Ab Wheel Rollout'], preparedBy: [],
    progression: 'ab-wheel-rollout', stabilisers: ['obliques'], transfer: { squat: 'stability', deadlift: 'stability' }, difficulty: 1,
    breathing: 'Breathe out hard as you crunch.', bracing: 'Hips stay still — curl the ribcage towards the pelvis.', rom: 'Full spinal flexion; let the abs stretch at the top.',
  },
  'hanging-knee-raise': {
    why: 'Core work plus a bonus: hanging builds grip, and you have both goals.',
    develops: ['Lower abs and hip flexors', 'Grip endurance'], mayHelp: ['Pull-up ability'], preparesFor: ['Hanging Leg Raise'], preparedBy: ['Captain\'s chair knee raise'],
    regression: 'captains-chair-knee-raise', progression: 'hanging-leg-raise',
    stabilisers: ['forearms', 'lats'], transfer: { deadlift: 'stability' }, difficulty: 2,
    breathing: 'Breathe out as the knees come up.', bracing: 'Posterior pelvic tilt — curl the pelvis, do not just lift the legs.', rom: 'Knees to chest without swinging.',
  },
  'hanging-leg-raise': {
    why: 'The progression from knee raises once you own 15 clean reps.',
    develops: ['Ab strength at long lever'], mayHelp: ['Grip'], preparesFor: [], preparedBy: ['Hanging Knee Raise'],
    regression: 'hanging-knee-raise', stabilisers: ['forearms', 'lats'], transfer: {}, difficulty: 3,
    breathing: 'Breathe out on the raise.', bracing: 'Curl the pelvis up.', rom: 'Straight legs to at least horizontal.',
  },
  'ab-wheel-rollout': {
    why: 'Anti-extension strength — the exact job your abs do under a heavy squat. Only progress here once your trunk control is solid.',
    develops: ['Anti-extension core strength'], mayHelp: ['Bracing', 'Plank strength'], preparesFor: ['Standing rollouts'], preparedBy: ['Cable Crunch', 'Plank'],
    regression: 'plank', stabilisers: ['lats', 'front-delts'], transfer: { squat: 'stability', deadlift: 'stability' }, difficulty: 3,
    breathing: 'Breathe out as you roll back in.', bracing: 'Ribs down, glutes squeezed, no sag.', rom: 'Only as far as you can keep a flat back.',
  },
  'chest-supported-row': {
    why: 'Upper-back size with very little lower-back fatigue — important because squats, RDLs and deadlifts already load your lower back on three days.',
    develops: ['Upper back and lats', 'Pulling strength'], mayHelp: ['Bench stability (upper back)', 'Posture'], preparesFor: ['Heavier rows'], preparedBy: ['Seated cable row'],
    regression: 'seated-row-close', progression: 't-bar-row',
    stabilisers: ['rear-delts', 'biceps'], transfer: { bench: 'stability', deadlift: 'general' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: 'Chest stays glued to the pad.', rom: 'Full reach forward, elbows past the torso at the top.',
  },
  'lat-pulldown': {
    why: 'Vertical pulling, and the first rung of your pull-up journey: Lat Pulldown → Assisted Pull-Up → Bodyweight Pull-Up → Weighted Pull-Up.',
    develops: ['Lat strength and size'], mayHelp: ['Pull-up ability', 'Back width'], preparesFor: ['Assisted Pull-Up', 'Pull-Up'], preparedBy: [],
    progression: 'assisted-pull-up', unlocks: ['assisted-pull-up', 'pull-up', 'weighted-pull-up'],
    stabilisers: ['biceps', 'rear-delts', 'abs'], transfer: { deadlift: 'general', bench: 'stability' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Thighs locked under the pads, slight lean back.', rom: 'Full stretch overhead to the bar at the upper chest.',
  },
  'assisted-pull-up': {
    why: 'The bridge between pulldowns and real pull-ups. Less assistance over time = progress.',
    develops: ['Pull-up pattern', 'Lat strength relative to bodyweight'], mayHelp: ['First bodyweight pull-up'], preparesFor: ['Pull-Up'], preparedBy: ['Lat Pulldown'],
    regression: 'lat-pulldown', progression: 'pull-up', unlocks: ['pull-up', 'weighted-pull-up'],
    stabilisers: ['abs', 'forearms'], transfer: {}, difficulty: 2,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Dead hang to chin over the bar.',
  },
  'pull-up': {
    why: 'A bodyweight pull-up is a genuine milestone — and every kilo you lose makes it easier.',
    develops: ['Relative pulling strength'], mayHelp: ['Back width', 'Grip'], preparesFor: ['Weighted Pull-Up'], preparedBy: ['Assisted Pull-Up', 'Lat Pulldown'],
    regression: 'assisted-pull-up', progression: 'weighted-pull-up', unlocks: ['weighted-pull-up'],
    stabilisers: ['abs', 'forearms'], transfer: {}, difficulty: 3,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Dead hang to chin over the bar, no kipping.',
  },
  'weighted-pull-up': {
    why: 'The top of the pull-up tree, for once 8+ clean bodyweight reps are easy.',
    develops: ['Maximal pulling strength'], mayHelp: ['Back size'], preparesFor: [], preparedBy: ['Pull-Up'],
    regression: 'pull-up', stabilisers: ['abs', 'forearms'], transfer: { deadlift: 'general' }, difficulty: 4,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Dead hang to chin over the bar.',
  },
  'incline-dumbbell-press': {
    why: 'Upper-chest and pressing hypertrophy with a long stretch at the bottom — chest growth that a flat bench alone underplays.',
    develops: ['Upper chest', 'Pressing hypertrophy'], mayHelp: ['Bench lockout stability', 'Shoulder health via free movement'], preparesFor: ['Heavier pressing'], preparedBy: ['Machine Chest Press'],
    regression: 'incline-chest-press-machine', progression: 'incline-barbell-bench-press',
    stabilisers: ['triceps', 'abs'], transfer: { bench: 'hypertrophy' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: 'Shoulder blades back on the bench, feet planted.', rom: 'Dumbbells to the outside of the chest with a deep stretch, press to near lockout.',
  },
  'chest-press-machine': {
    why: 'Stable chest work you can take close to failure safely, after Friday\'s bench practice.',
    develops: ['Chest size'], mayHelp: ['Bench strength'], preparesFor: ['Dumbbell Bench', 'Barbell Bench'], preparedBy: ['Push-Up'],
    progression: 'dumbbell-bench-press', stabilisers: ['triceps'], transfer: { bench: 'hypertrophy' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Back flat on the pad.', rom: 'Handles back until the chest stretches, press to near lockout.',
  },
  'cable-lateral-raise': {
    why: 'Direct side-delt training — wide shoulders change your whole physique. Dumbbell lateral raises are an equivalent swap; neither is universally superior.',
    develops: ['Side delts'], mayHelp: ['Shoulder width'], preparesFor: [], preparedBy: [],
    stabilisers: ['traps', 'abs'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Stand tall, slight lean away from the cable.', rom: 'From across the body to about shoulder height.',
  },
  'dumbbell-lateral-raise': {
    why: 'The block-2 side-delt option. Same job as the cable version with a different resistance curve.',
    develops: ['Side delts'], mayHelp: ['Shoulder width'], preparesFor: [], preparedBy: [], stabilisers: ['traps'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Arms out to about shoulder height, controlled lowering.',
  },
  'reverse-pec-deck': {
    why: 'Rear-delt and upper-back work for shoulder balance and the "3D" shoulder look. Light on recovery.',
    develops: ['Rear delts'], mayHelp: ['Shoulder health', 'Posture'], preparesFor: [], preparedBy: [],
    stabilisers: ['upper-back'], transfer: { bench: 'stability' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Chest on the pad.', rom: 'Arms from in front to in line with the body.',
  },
  'cable-rear-delt-fly': {
    why: 'Block-2 rear-delt option with a slightly different line of pull.',
    develops: ['Rear delts'], mayHelp: ['Shoulder balance'], preparesFor: [], preparedBy: [], stabilisers: ['upper-back'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Cross-body to arms out wide.',
  },
  'incline-dumbbell-curl': {
    why: 'Trains the elbow flexors with the shoulder extended, which gives the biceps a useful lengthened stimulus.',
    develops: ['Biceps (long head emphasis)'], mayHelp: ['Arm size'], preparesFor: [], preparedBy: ['Dumbbell Curl'],
    stabilisers: ['forearms'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Back flat on the incline bench, arms hang straight down.', rom: 'Full stretch at the bottom to a full curl.',
  },
  'preacher-curl': {
    why: 'A different resistance profile and elbow-flexor stimulus to the incline curl. Both are useful — neither universally beats the other.',
    develops: ['Biceps'], mayHelp: ['Arm size'], preparesFor: [], preparedBy: [], stabilisers: ['forearms'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Armpits snug on the pad.', rom: 'Nearly straight at the bottom (do not hyperextend), full curl at the top.',
  },
  'bayesian-cable-curl': {
    why: 'Block-2 curl: the shoulder is extended behind you, giving another lengthened biceps stimulus.',
    develops: ['Biceps'], mayHelp: ['Arm size'], preparesFor: [], preparedBy: [], stabilisers: ['forearms'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Staggered stance facing away from the cable.', rom: 'Arm behind the body to full curl.',
  },
  'overhead-cable-extension': {
    why: 'Trains the long head of the triceps in a lengthened overhead position. May support general elbow-extension strength and pressing hypertrophy. Kept at 2+ RIR on Wednesday so Friday\'s bench is not hurt.',
    develops: ['Triceps long head'], mayHelp: ['Pressing hypertrophy', 'Bench lockout'], preparesFor: [], preparedBy: ['Cable Pressdown'],
    stabilisers: ['abs'], transfer: { bench: 'hypertrophy' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Ribs down so the lower back does not arch.', rom: 'Deep stretch behind the head to full lockout.',
  },
  'cable-pushdown': {
    why: 'Simple, joint-friendly triceps volume, supersetted with curls on Friday.',
    develops: ['Triceps (lateral/medial heads)'], mayHelp: ['Bench lockout'], preparesFor: ['Overhead extensions'], preparedBy: [],
    stabilisers: ['abs'], transfer: { bench: 'hypertrophy' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Elbows pinned at your sides.', rom: 'Full lockout to about 90° at the top.',
  },
  'hammer-curl': {
    why: 'Brachialis and brachioradialis — the muscles that make the upper arm and forearm look thick from the side.',
    develops: ['Brachialis', 'Brachioradialis', 'Forearms'], mayHelp: ['Grip', 'Arm size'], preparesFor: ['Reverse Curl'], preparedBy: [],
    stabilisers: ['forearms'], transfer: { deadlift: 'general' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Neutral grip, full extension to full curl.',
  },
  'reverse-curl': {
    why: 'Forearm extensors and brachioradialis — part of your forearm goal.',
    develops: ['Forearm extensors', 'Brachioradialis'], mayHelp: ['Grip balance', 'Elbow health'], preparesFor: [], preparedBy: ['Hammer Curl'],
    stabilisers: [], transfer: {}, difficulty: 1, breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Overhand grip, full range.',
  },
  'wrist-curl': {
    why: 'Direct forearm flexor work for your forearm goal. Done after the deadlift so your grip is fresh for the pull.',
    develops: ['Forearm flexors', 'Grip'], mayHelp: ['Deadlift grip', 'Forearm size'], preparesFor: [], preparedBy: [],
    stabilisers: [], transfer: { deadlift: 'supporting' }, difficulty: 1, breathing: 'Breathe normally.', bracing: 'Forearms resting on a bench or your thighs.', rom: 'Let the bar roll to your fingers, then curl the wrist fully.',
  },
  'reverse-wrist-curl': {
    why: 'Wrist extension — balances the flexors and finishes the forearm superset.',
    develops: ['Forearm extensors'], mayHelp: ['Elbow and wrist health'], preparesFor: [], preparedBy: [],
    stabilisers: [], transfer: {}, difficulty: 1, breathing: 'Breathe normally.', bracing: 'Forearms supported, palms down.', rom: 'Full wrist flexion to extension.',
  },
  'dumbbell-bulgarian-split-squat': {
    why: 'Unilateral leg development on Thursday — quads, glutes and stability, without another heavy bilateral squat right after deadlifts.',
    develops: ['Quads and glutes', 'Single-leg stability', 'Adductors'], mayHelp: ['Fixing left/right imbalances', 'Squat stability'], preparesFor: [], preparedBy: ['Split squat', 'Goblet Squat'],
    regression: 'smith-split-squat', stabilisers: ['abs', 'obliques', 'glutes'], transfer: { squat: 'supporting' }, difficulty: 3,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Back knee close to the floor, front foot flat.',
  },
  'seated-row-close': {
    why: 'Friday\'s cable row — horizontal pulling volume with the spine supported.',
    develops: ['Lats and mid-back'], mayHelp: ['Posture'], preparesFor: [], preparedBy: [], stabilisers: ['biceps', 'rear-delts'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Chest up, torso still.', rom: 'Long reach forward, handle to the stomach.',
  },
  'seated-row-machine': {
    why: 'Block-2 row variation with a different resistance curve.',
    develops: ['Mid-back'], mayHelp: [], preparesFor: [], preparedBy: [], stabilisers: ['biceps'], transfer: {}, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Chest on the pad if it has one.', rom: 'Full stretch to full squeeze.',
  },
  'goblet-squat': {
    why: 'Squat tree rung 2 — teaches an upright torso and depth with a light load.',
    develops: ['Squat pattern', 'Depth'], mayHelp: ['Barbell squat technique'], preparesFor: ['Barbell Back Squat'], preparedBy: ['Bodyweight Squat'],
    regression: 'bodyweight-squat', progression: 'barbell-squat', stabilisers: ['abs', 'upper-back'], transfer: { squat: 'technique' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Elbows inside the knees at the bottom.',
  },
  'bodyweight-squat': {
    why: 'The first rung of the squat tree.', develops: ['Squat pattern'], mayHelp: [], preparesFor: ['Goblet Squat'], preparedBy: [],
    progression: 'goblet-squat', stabilisers: ['abs'], transfer: { squat: 'technique' }, difficulty: 1, breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Full depth with heels down.',
  },
  'hip-hinge-drill': {
    why: 'The first rung of the hinge tree. Learn to move at the hips with a neutral spine before loading it.',
    develops: ['Hinge pattern'], mayHelp: ['RDL and deadlift technique'], preparesFor: ['Dumbbell RDL'], preparedBy: [],
    progression: 'dumbbell-rdl', stabilisers: ['abs'], transfer: { deadlift: 'technique' }, difficulty: 1, breathing: 'Breathe normally.', bracing: BRACE_LIGHT, rom: 'Hips back until the hamstrings stretch, dowel contact kept.',
  },
  'dumbbell-rdl': {
    why: 'Hinge tree rung 2 — the RDL pattern with a load you can easily control.',
    develops: ['Hamstrings', 'Hinge'], mayHelp: ['Barbell RDL'], preparesFor: ['Barbell RDL'], preparedBy: ['Hip Hinge Drill'],
    regression: 'hip-hinge-drill', progression: 'barbell-rdl', stabilisers: ['lower-back', 'forearms'], transfer: { deadlift: 'technique' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: BRACE_LIGHT, rom: 'Dumbbells to mid-shin with a flat back.',
  },
  'push-up': {
    why: 'Push-up tree rung 2 — one of your stated goals. It gets easier as bodyweight drops and pressing strength rises.',
    develops: ['Pressing endurance', 'Core stiffness'], mayHelp: ['Bench support', 'General fitness'], preparesFor: ['Weighted Push-Up'], preparedBy: ['Knee Push-Up', 'Incline Push-Up'],
    regression: 'incline-push-up', progression: 'weighted-push-up', stabilisers: ['abs', 'glutes'], transfer: { bench: 'general' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: 'Plank position — glutes and abs tight.', rom: 'Chest to the floor, full lockout.',
  },
  'incline-push-up': {
    why: 'A regression that lets you train the full push-up range at a lighter load.',
    develops: ['Push-up pattern'], mayHelp: ['Push-up ability'], preparesFor: ['Push-Up'], preparedBy: ['Knee Push-Up'],
    regression: 'knee-push-up', progression: 'push-up', stabilisers: ['abs'], transfer: { bench: 'technique' }, difficulty: 1,
    breathing: BREATH_MOD, bracing: 'Body straight.', rom: 'Chest to the bench edge.',
  },
  'knee-push-up': {
    why: 'Push-up tree rung 1.', develops: ['Push-up pattern'], mayHelp: [], preparesFor: ['Incline Push-Up', 'Push-Up'], preparedBy: [],
    progression: 'incline-push-up', stabilisers: ['abs'], transfer: { bench: 'technique' }, difficulty: 1, breathing: BREATH_MOD, bracing: 'Straight line knees to head.', rom: 'Chest to the floor.',
  },
  'weighted-push-up': {
    why: 'Top of the push-up tree — optional, never required.', develops: ['Pressing strength'], mayHelp: [], preparesFor: [], preparedBy: ['Push-Up'],
    regression: 'push-up', stabilisers: ['abs'], transfer: { bench: 'general' }, difficulty: 3, breathing: BREATH_MOD, bracing: 'Rigid plank.', rom: 'Chest to floor.',
  },
  'dumbbell-bench-press': {
    why: 'Pushing tree rung 2 — free dumbbells build stability between machine pressing and the barbell.',
    develops: ['Chest', 'Pressing stability'], mayHelp: ['Bench'], preparesFor: ['Barbell Bench Press'], preparedBy: ['Machine Chest Press'],
    regression: 'chest-press-machine', progression: 'barbell-bench-press', stabilisers: ['triceps', 'abs'], transfer: { bench: 'supporting' }, difficulty: 2,
    breathing: BREATH_MOD, bracing: 'Shoulder blades back.', rom: 'Deep stretch, press to near lockout.',
  },
  'plank': {
    why: 'Basic anti-extension; a regression for the ab wheel.', develops: ['Trunk stiffness'], mayHelp: ['Bracing'], preparesFor: ['Ab Wheel Rollout'], preparedBy: [],
    progression: 'ab-wheel-rollout', stabilisers: ['glutes'], transfer: { squat: 'stability' }, difficulty: 1, breathing: 'Slow breaths without losing the brace.', bracing: BRACE_LIGHT, rom: 'Static.',
  },
}

/** Knowledge for any exercise: authored where it exists, otherwise inferred honestly. */
export function knowledgeFor(id: string): Knowledge | null {
  const ex = byId.get(id)
  if (!ex) return null
  const a = K[id]
  if (a) return { ...a, source: 'authored' }
  return inferred(ex)
}

function inferred(ex: Exercise): Knowledge {
  const pattern = ex.quality?.pattern
  const transfer: Knowledge['transfer'] = {}
  if (pattern === 'squat' || pattern === 'leg-press' || pattern === 'lunge') transfer.squat = 'hypertrophy'
  if (pattern === 'hinge' || pattern === 'knee-flexion') transfer.deadlift = 'hypertrophy'
  if (pattern === 'horizontal-push' || pattern === 'incline-push' || pattern === 'elbow-extension') transfer.bench = 'hypertrophy'
  const heavy = ex.loadingDemand === 'high'
  return {
    why: ex.progressionRole ?? `Trains ${ex.primary.join(', ')}${ex.secondary.length ? ` with help from ${ex.secondary.join(', ')}` : ''}.`,
    develops: ex.primary.map((m) => m.replace('-', ' ')),
    mayHelp: [],
    preparesFor: [],
    preparedBy: [],
    regression: ex.regressionOptions?.[0],
    stabilisers: [],
    transfer,
    difficulty: ex.loadingDemand === 'high' ? 4 : ex.loadingDemand === 'medium' ? 2 : 1,
    breathing: heavy ? BREATH_HEAVY : BREATH_MOD,
    bracing: heavy ? BRACE_HEAVY : BRACE_LIGHT,
    rom: ex.quality?.stretchLoaded ? 'Use the full range, especially the stretched position.' : 'Use the full range you can control.',
    source: 'inferred',
  }
}

// ============================================================
// SKILL TREES — motivational levels, never locks.
// ============================================================
export interface TreeNode { id: string; label: string; criterion: string }
export interface SkillTree { id: string; title: string; goal: string; nodes: TreeNode[]; note?: string }

export const SKILL_TREES: SkillTree[] = [
  {
    id: 'pull', title: 'Pull-Up Journey', goal: 'Your first, fifth and tenth pull-up',
    nodes: [
      { id: 'lat-pulldown', label: 'Lat Pulldown', criterion: 'Pulldown about 70% of your bodyweight for 8+' },
      { id: 'assisted-pull-up', label: 'Assisted Pull-Up', criterion: '3 × 8 with little assistance' },
      { id: 'pull-up', label: 'Bodyweight Pull-Up', criterion: 'Clean sets of 8+' },
      { id: 'weighted-pull-up', label: 'Weighted Pull-Up', criterion: 'Added load for 5+' },
    ],
    note: 'The app suggests the next rung when you are ready, but never changes your exercise without asking.',
  },
  {
    id: 'push', title: 'Push-Up Tree', goal: 'Strong, clean push-ups',
    nodes: [
      { id: 'knee-push-up', label: 'Push-Up Regression', criterion: '3 × 15 knee or incline push-ups' },
      { id: 'push-up', label: 'Push-Up', criterion: '3 × 15 full push-ups' },
      { id: 'weighted-push-up', label: 'Weighted Push-Up', criterion: 'Only if appropriate — 20+ easy reps first' },
    ],
  },
  {
    id: 'press', title: 'Pressing Tree', goal: 'A heavy, confident bench',
    nodes: [
      { id: 'chest-press-machine', label: 'Machine Chest Press', criterion: 'Comfortable working weights' },
      { id: 'dumbbell-bench-press', label: 'Dumbbell Bench', criterion: 'Stable, controlled reps' },
      { id: 'barbell-bench-press', label: 'Barbell Bench', criterion: 'Consistent technique at RIR targets' },
      { id: 'paused-bench-press', label: 'Paused Bench', criterion: 'Honest pauses without losing tightness' },
      { id: 'heavy-bench', label: 'Heavy Bench', criterion: 'Singles at RPE 8 and a PR test' },
    ],
    note: 'You do not have to complete every step — you are already benching. It shows where each movement fits.',
  },
  {
    id: 'squat', title: 'Squat Tree', goal: 'A heavy, repeatable squat',
    nodes: [
      { id: 'bodyweight-squat', label: 'Bodyweight Squat', criterion: 'Full depth, heels down' },
      { id: 'goblet-squat', label: 'Goblet Squat', criterion: 'Upright torso, controlled depth' },
      { id: 'barbell-squat', label: 'Barbell Back Squat', criterion: 'Consistent depth at RIR targets' },
      { id: 'paused-squat', label: 'Paused Squat', criterion: 'Two-second holds with no bounce' },
      { id: 'heavy-squat', label: 'Heavy Squat', criterion: 'Singles at RPE 8 and a PR test' },
    ],
  },
  {
    id: 'hinge', title: 'Hinge Tree', goal: 'A strong, safe deadlift',
    nodes: [
      { id: 'hip-hinge-drill', label: 'Hip Hinge Drill', criterion: 'Dowel contact kept' },
      { id: 'dumbbell-rdl', label: 'Dumbbell RDL', criterion: 'Flat back to mid-shin' },
      { id: 'barbell-rdl', label: 'Barbell RDL', criterion: 'Controlled hamstring stretch' },
      { id: 'barbell-deadlift', label: 'Conventional Deadlift', criterion: 'Consistent setup every rep' },
      { id: 'paused-deadlift', label: 'Advanced variations', criterion: 'Only where appropriate' },
      { id: 'heavy-deadlift', label: 'Heavy Deadlift', criterion: 'Singles at RPE 8 and a PR test' },
    ],
  },
  {
    id: 'core', title: 'Core Progression', goal: 'A brace that holds under heavy load',
    nodes: [
      { id: 'cable-crunch', label: 'Cable Crunch', criterion: 'Progressively loaded' },
      { id: 'hanging-knee-raise', label: 'Hanging Knee Raise', criterion: '3 × 15 without swinging' },
      { id: 'hanging-leg-raise', label: 'Hanging Leg Raise', criterion: 'Straight legs to horizontal' },
      { id: 'ab-wheel-rollout', label: 'Ab Wheel', criterion: 'Only with adequate trunk control' },
    ],
  },
]

export const LEVELS: Level[] = ['Foundation', 'Developing', 'Competent', 'Advanced']
