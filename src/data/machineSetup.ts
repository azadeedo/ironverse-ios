// Exact setup for benches, seats, pads and cables — the bit that decides
// which muscle a lift actually trains. Angles follow the EMG work on bench
// incline (e.g. Rodríguez-Ridao et al. 2020: upper-chest activation peaks
// around 30°; past ~45° the front delts take over) and standard machine
// alignment rules (joint lined up with the machine's pivot).

export interface SetupSpec {
  /** bench / backrest angle */
  bench?: string
  seat?: string
  pads?: string
  handles?: string
  cable?: string
  feet?: string
  /** one-line why */
  why?: string
}

export const MACHINE_SETUP: Record<string, SetupSpec> = {
  'incline-dumbbell-press': { bench: '30° — usually the 2nd or 3rd notch up from flat. Not 45°+ (that turns it into a shoulder press).', seat: 'Raise the seat one notch so your hips don’t slide down the bench.', feet: 'Flat on the floor, slightly behind your knees.', why: 'Upper-chest activation peaks around 30°; higher angles shift work to the front delts.' },
  'incline-dumbbell-fly': { bench: '30°, same as incline press.', seat: 'Seat up one notch so you stay locked in.', why: 'Keeps the stretch on the upper chest, not the shoulder joint.' },
  'incline-dumbbell-curl': { bench: '45–60° — arms hang straight down behind your body.', why: 'Puts the long head of the biceps on stretch.' },
  'incline-barbell-bench-press': { bench: '30° if the bench is adjustable.', handles: 'Bar unracks over your upper chest; J-hooks at a height you reach with a slight elbow bend.' },
  'smith-incline-bench-press': { bench: '30° — slide the bench so the bar touches your upper chest, just under the collarbones.', handles: 'Set the safety stops 2–3 cm below where the bar touches your chest.' },
  'dumbbell-bench-press': { bench: 'Flat.', feet: 'Feet planted, slight arch, shoulder blades pulled back and down.' },
  'dumbbell-shoulder-press': { bench: '80–90° (one notch back from upright) so your lower back stays on the pad.', seat: 'Seat set so your hips are pushed right back.' },
  'seated-dumbbell-lateral-raise': { bench: 'Upright, back supported.', why: 'Removes body swing so the side delts do the work.' },
  'chest-supported-dumbbell-row': { bench: '30–45° incline, chest on the pad, chin just over the top.' },
  'spider-curl': { bench: '45° incline, chest on the pad, arms hanging straight down over the top.' },
  'chest-press-machine': { seat: 'Handles at mid-chest (nipple line). Too high = shoulders take over.', handles: 'Elbows about 45° from your body, not flared straight out.', pads: 'Back flat on the pad, shoulder blades pinned.' },
  'incline-chest-press-machine': { seat: 'Handles start in line with your upper chest, just under the collarbone.', pads: 'Back flat, shoulder blades pinned.' },
  'decline-chest-press-machine': { seat: 'Handles in line with your lower chest.' },
  'converging-chest-press': { seat: 'Handles at mid-chest height.', handles: 'Start with a slight stretch, not so deep your shoulders roll forward.' },
  'pec-deck': { seat: 'Handles at chest height, upper arms parallel to the floor.', handles: 'Start position: hands just behind your chest — not over-stretched.' },
  'machine-incline-fly': { seat: 'Handles in line with your upper chest.' },
  'shoulder-press-machine': { seat: 'Handles start at shoulder height (top of your shoulders, not your ears).', pads: 'Back flat on the pad.' },
  'lateral-raise-machine': { seat: 'Shoulder joint lined up with the machine’s pivot (the dot / axle).', pads: 'Pads on the outside of your upper arm, just above the elbow.' },
  'reverse-pec-deck': { seat: 'Handles at shoulder height, chest on the pad.', handles: 'Neutral or overhand grip, arms nearly straight.' },
  'neutral-grip-lat-pulldown': { pads: 'Thigh pad snug on your thighs so you don’t lift off.', seat: 'Knees at 90°, feet flat.' },
  'close-grip-lat-pulldown': { pads: 'Thigh pad snug.' },
  'reverse-grip-lat-pulldown': { pads: 'Thigh pad snug.' },
  'single-arm-lat-pulldown': { pads: 'Thigh pad snug; sit slightly side-on to the working arm.' },
  'iso-lateral-pulldown': { seat: 'Handles reachable with arms fully straight at the top.', pads: 'Thigh pad snug.' },
  'seated-row-machine': { seat: 'Handles at the bottom of your chest when you sit tall.', pads: 'Chest pad set so you just reach the handles with arms straight.' },
  'iso-lateral-row': { seat: 'Handles in line with your lower chest.', pads: 'Chest pad close enough that your arms are fully straight at the start.' },
  'chest-supported-row': { pads: 'Chest on the pad, handles reachable with straight arms.' },
  'machine-pullover': { seat: 'Shoulder joint lined up with the machine’s pivot.' },
  'seated-row-wide': { cable: 'Low pulley, wide bar. Sit tall, slight lean at the start only.' },
  'seated-row-close': { cable: 'Low pulley, V-handle.' },
  'face-pull': { cable: 'Pulley at forehead height or a bit above, rope attachment.', why: 'Pulling to the face with elbows high hits rear delts and the upper back.' },
  'cable-lateral-raise': { cable: 'Pulley at the lowest setting (or wrist height for less stretch).' },
  'single-arm-cable-lateral-raise': { cable: 'Pulley at the lowest setting; stand side-on, cable crossing in front of you.' },
  'leaning-cable-lateral-raise': { cable: 'Lowest pulley, hold the machine and lean away.' },
  'cable-fly-high': { cable: 'Pulleys at the top — bring hands down and in (lower chest).' },
  'cable-fly-mid': { cable: 'Pulleys at shoulder height (mid chest).' },
  'cable-fly-low': { cable: 'Pulleys at the bottom — bring hands up and in (upper chest).' },
  'cable-crossover-low-to-high': { cable: 'Pulleys at the bottom.' },
  'cable-crossover-high-to-low': { cable: 'Pulleys at the top.' },
  'seated-cable-fly': { seat: 'Handles in line with your chest.' },
  'cable-pushdown': { cable: 'Top pulley, straight bar.' },
  'rope-pushdown': { cable: 'Top pulley, rope.' },
  'overhead-cable-extension': { cable: 'Pulley at the lowest setting (or head height facing away), rope.' },
  'seated-overhead-rope-extension': { cable: 'Low pulley, sit facing away.' },
  'bayesian-cable-curl': { cable: 'Lowest pulley, single handle, step forward so your arm is behind your body.' },
  'cable-crunch': { cable: 'Top pulley, rope. Kneel far enough back that the stack lifts at the start.' },
  'leg-press': { seat: 'Back pad at an angle that keeps your lower back flat at the bottom.', feet: 'Shoulder-width, mid-platform. Higher = more glutes/hamstrings, lower = more quads.' },
  'hack-squat': { pads: 'Shoulder pads snug.', feet: 'Shoulder-width, middle of the plate. Lower and closer = more quads.' },
  'pendulum-squat': { pads: 'Shoulder pads snug, back flat on the pad.' },
  'leg-extension': { seat: 'Back pad so your KNEE lines up with the machine’s pivot.', pads: 'Ankle pad just above your shoes, on the lower shin.', why: 'Knee off the pivot loads the joint instead of the quads.' },
  'seated-leg-curl': { seat: 'Back pad so your knee lines up with the pivot.', pads: 'Thigh pad pressed down on your thighs; ankle pad just above your heels.' },
  'lying-leg-curl': { pads: 'Knees just off the end of the bench, pad just above your heels.' },
  'standing-leg-curl-machine': { pads: 'Knee in line with the pivot, pad just above the heel.' },
  'hip-thrust-machine': { pads: 'Belt/pad across the hip crease; upper back on the pad at shoulder-blade level.' },
  'glute-drive-machine': { pads: 'Pad across your hips, upper back supported.' },
  'adductor-machine': { seat: 'Start with only a comfortable stretch; widen it over weeks.' },
  'abductor-machine': { seat: 'Sit tall or lean slightly forward (more glute).' },
  'standing-calf-raise-machine': { pads: 'Shoulder pads set so you start slightly bent at the knees and can drop your heels fully.' },
  'seated-calf-raise-machine': { pads: 'Knee pad snug on the lower thighs, balls of your feet on the edge.' },
  'preacher-curl': { seat: 'Armpits tight to the top of the pad, arms flat on it.' },
  'machine-preacher-curl': { seat: 'Elbow lined up with the machine’s pivot; armpits on the top of the pad.' },
  'biceps-curl-machine': { seat: 'Elbows lined up with the pivot.' },
  'triceps-extension-machine': { seat: 'Elbows lined up with the pivot.' },
  'seated-dip-machine': { seat: 'Handles start at chest level.' },
  'ab-crunch-machine': { seat: 'Pads at the top of your chest; hips stay on the seat.' },
  'assisted-pull-up': { pads: 'More counterweight = easier. Knee pad under both knees.' },
  'assisted-dip': { pads: 'More counterweight = easier.' },
  'smith-bench-press': { bench: 'Flat. Slide it so the bar lands on your mid-chest.', handles: 'Safety stops just below the touch point.' },
  'smith-seated-shoulder-press': { bench: 'Upright (80–90°), bar lands in front of your chin.' },
  'belt-squat': { pads: 'Belt around your hips, stand on the platform with feet shoulder-width.' },
  '45-degree-back-extension': { pads: 'Hip pad just BELOW your hip bones so you can bend at the hips.' },
  'reverse-hyperextension': { pads: 'Hips at the edge of the pad, legs hanging.' },
  'barbell-squat': { handles: 'J-hooks at about armpit height (mid-chest), safeties just below your bottom position.' },
  'barbell-bench-press': { bench: 'Flat.', handles: 'J-hooks where you unrack with a slight elbow bend; safeties just below chest height.' },
}

export function setupFor(id: string): SetupSpec | undefined {
  return MACHINE_SETUP[id]
}
