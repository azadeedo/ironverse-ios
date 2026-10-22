// ============================================================
// Ironverse data model.
// Conventions: ids = nanoid strings; dates 'YYYY-MM-DD'; timestamps ISO;
// weights kg (number, 0.5 steps ok); distances km; volumes ml; energy kcal.
// ============================================================

export type ID = string

// ---------- muscles ----------
export type Muscle =
  | 'chest' | 'front-delts' | 'side-delts' | 'rear-delts' | 'biceps' | 'triceps'
  | 'forearms' | 'lats' | 'traps' | 'upper-back' | 'lower-back' | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'hip-flexors' | 'full-body' | 'cardio'

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest', 'front-delts': 'Front delts', 'side-delts': 'Side delts',
  'rear-delts': 'Rear delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', lats: 'Lats', traps: 'Traps', 'upper-back': 'Upper back',
  'lower-back': 'Lower back', abs: 'Abs', obliques: 'Obliques', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  'hip-flexors': 'Hip flexors', 'full-body': 'Full body', cardio: 'Cardio',
}

// ---------- equipment (fixed to the user's garage) ----------
export type Equipment =
  | 'barbell'        // full bar + plates (2x5, 2x10, 2x15, 2x20 kg)
  | 'curl-bar'       // shorter straight bar for curls etc.
  | 'smith'          // GRK-110 smith machine bar
  | 'cable-high'     // cable crossover, high pulley (73kg stack per side)
  | 'cable-low'      // low pulley
  | 'cable-mid'      // adjustable mid position
  | 'lat-pulldown'   // lat bar on high pulley + seat/rollers
  | 'low-row'        // low row with foot plates
  | 'pullup-bar'     // multi-grip pull-up bar
  | 'dip-handles'    // dip attachment
  | 'bench'          // adjustable FID bench (flat/incline/decline + leg rollers)
  | 'suspension'     // suspension straps
  | 'jump-rope'
  | 'bodyweight'
  | 'plate'          // loose plate held in hands

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', 'curl-bar': 'Curl bar', smith: 'Smith machine',
  'cable-high': 'Cable (high)', 'cable-low': 'Cable (low)', 'cable-mid': 'Cable (mid)',
  'lat-pulldown': 'Lat pulldown', 'low-row': 'Low row', 'pullup-bar': 'Pull-up bar',
  'dip-handles': 'Dip handles', bench: 'Bench', suspension: 'Suspension straps',
  'jump-rope': 'Jump rope', bodyweight: 'Bodyweight', plate: 'Plate',
}

// ---------- exercise animation rig ----------
/** Joint angles in DEGREES. 0 = straight down for limbs; torso 0 = upright.
 *  Positive = clockwise when the figure faces RIGHT (side view). */
export interface Pose {
  /** root (hip) position offset in rig units (0,0 = standing origin) */
  x?: number
  y?: number
  torso?: number      // lean: + = forward (toward facing dir)
  neck?: number
  shoulder?: number   // upper-arm angle relative to torso: 0 = hanging down, 180 = overhead
  elbow?: number      // 0 = straight, + = flexion
  hip?: number        // thigh relative to torso: 0 = straight (standing), 90 = seated
  knee?: number       // 0 = straight, + = flexion
  ankle?: number
  /** far-side limb overrides (defaults mirror near side) */
  shoulder2?: number
  elbow2?: number
  hip2?: number
  knee2?: number
}

export type PropKind =
  | 'barbell'   // bar across hands (drawn as bar + plates)
  | 'curl-bar'
  | 'smith'     // vertical guide rails + bar at hands
  | 'cable-down'// cable from high anchor to hands
  | 'cable-up'  // cable from low anchor to hands
  | 'bench-flat' | 'bench-incline'
  | 'pullup-bar'
  | 'dip-bars'
  | 'rope'      // jump rope arc
  | 'plate'
  | 'none'

export interface ExerciseAnimDef {
  /** keyframe poses; the player ping-pongs through them with easing */
  poses: Pose[]
  /** seconds for a full rep cycle */
  cycle?: number
  prop: PropKind
  /** figure orientation */
  view?: 'side' | 'front'
  /** lying on bench etc: rotate whole figure -90 (head to the right) */
  lying?: boolean
}

// ---------- exercises (static registry, not in Dexie) ----------
export type ExerciseKind = 'strength' | 'cardio' | 'core' | 'mobility'
export type LoadMode = 'barbell' | 'curl-bar' | 'smith' | 'stack' | 'bodyweight' | 'plate' | 'time'

export interface Exercise {
  id: string                  // kebab: 'barbell-bench-press'
  name: string
  kind: ExerciseKind
  /** widened in v2 to AnyEquipment so gym machines can be tagged */
  equipment: AnyEquipment[]
  primary: Muscle[]
  secondary: Muscle[]
  /** how the working load is built (drives plate math / stack picker) */
  loadMode: LoadMode
  /** relative strength baseline vs bodyweight for auto start-weights (e.g. bench 0.5 = 50% BW) */
  startFactor?: number
  repRange?: [number, number] // default target reps
  unilateral?: boolean
  instructions: string[]      // 3-6 short steps
  tips?: string[]
  anim: ExerciseAnimDef
  /** MET value for calorie estimates */
  met?: number
  alternatives?: string[]     // exercise ids that can swap in
  // ---- v2 (all optional) ----
  /** ranked substitutes, best first — used when swapping equipment profiles */
  substitutes?: string[]
  /** 3-5 setup cues */
  setupCues?: string[]
  /** 3-5 execution cues */
  executionCues?: string[]
  /** the 2-3 mistakes people actually make */
  commonMistakes?: string[]
  /** e.g. '3-1-1 — slow on the way down' */
  tempo?: string
  /** where the rep should feel hardest */
  hardestPoint?: string
  /** classic-era training wisdom, written fresh (never fabricated quotes) */
  classicNote?: string
  /** shown when the lift genuinely warrants a warning */
  safetyNote?: string
  // ---- v5 (optional; all additive — absent means "inferred or unknown") ----
  /**
   * Which head or region the exercise biases, e.g. 'long head of the triceps',
   * 'upper pec', 'rear delt'. Two exercises can share a movement pattern and
   * still bias different tissue, which is the whole argument for rotating
   * between them rather than treating them as interchangeable.
   */
  primeMoverEmphasis?: string
  /**
   * How much absolute load, skill and balance the movement demands. Drives
   * regression suggestions and ordering — high-demand work belongs early in a
   * session while he is fresh.
   */
  loadingDemand?: 'low' | 'medium' | 'high'
  /**
   * Systemic fatigue relative to the stimulus produced. A barbell squat is
   * high, a leg extension is low. Distinct from `quality.systemicCost`, which
   * predates this and is inferred from the name when absent; prefer this field
   * and fall back to that one (see `fatigueCostOf` in @/lib/programming).
   */
  fatigueCost?: 'low' | 'medium' | 'high'
  /**
   * Why this exercise is programmed and what it is preparing him for. Shown in
   * the app verbatim, so write it as coaching addressed to him, not as a note
   * to a developer.
   */
  progressionRole?: string
  /**
   * 1-2 easier / lower-load stand-ins for a day the prescribed weight is not
   * there. Ordered easiest-last. Distinct from `substitutes`, which answers
   * "this room does not have the kit" rather than "today I do not have it".
   */
  regressionOptions?: string[]
  // ---- v3 (optional; inferred at runtime when absent) ----
  /** movement pattern + how good this exercise is at it */
  quality?: ExerciseQuality
  /** antagonist patterns this pairs well with in a superset */
  pairsWith?: MovementPattern[]
}

// ---------- profile / settings ----------
export interface WorkDay {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Sunday
  working: boolean
  start?: string // 'HH:mm'
  end?: string
}

export interface Profile {
  id: 'me'
  name: string
  sex: 'male' | 'female'
  birthYear: number
  heightCm: number
  weightKg: number          // latest known (kept in sync with weighIns)
  goal: 'lose-fat' | 'build-muscle' | 'recomp'
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active'
  experience: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number       // training days target
  sessionMinutes: number    // preferred workout length
  workSchedule: WorkDay[]
  preferredSlot: 'auto' | 'morning' | 'after-work' | 'evening'
  // targets (auto-computed but overridable)
  calorieTarget: number
  proteinTarget: number
  waterTargetMl: number
  creatineGrams: number
  // equipment config
  barbellKg: number         // 20 default
  curlBarKg: number         // 10 default
  smithBarKg: number        // 15 default
  platePairsKg: number[]    // [5,10,15,20] (one pair each)
  stackStepsKg: number[]    // cable stack selectable weights
  onboarded: boolean
  createdAt: string
  updatedAt: string
  // ---- v2 (all optional; see db/defaults.ts for read-time defaults) ----
  /** hide pork & alcohol, flag ambiguous items (default true for this user) */
  halalMode?: boolean
  /** how energy is displayed; storage is always kcal */
  energyUnit?: EnergyUnit
  /** currently selected EquipmentProfile id */
  equipmentProfileId?: ID
  /** Ramadan mode: shifted eating/training windows */
  ramadan?: RamadanConfig
  /** prayer-time awareness for session scheduling */
  prayer?: PrayerConfig
  /** adaptive calorie target learned from real weight change */
  adaptiveCalories?: boolean
  // ---- v6 (optional) ----
  goalWeightKg?: number
  startWeightKg?: number
  stepsTarget?: number
  // ---- v8 (optional) ----
  /** the time he actually goes to the gym, 'HH:mm' (overrides the auto slot on training days) */
  gymTime?: string
  /** creatine loading phase: loading dose every day up to and including this date */
  creatineLoadUntil?: string
  creatineLoadGrams?: number
  /** last automatic calorie adjustment (weight not dropping) */
  calorieAuto?: { date: string; from: number; to: number; why: string }
}

// ============================================================
// v6 ADDITIONS (2026-10) — the 12-week program. Additive only.
// ============================================================

/** A user-created exercise or machine, merged into the registry at runtime. */
export interface CustomExercise {
  id: string
  name: string
  category: 'barbell' | 'dumbbell' | 'cable' | 'smith' | 'plate-loaded' | 'selectorised' | 'bodyweight' | 'cardio' | 'machine' | 'other'
  machine?: string
  primary: Muscle[]
  secondary: Muscle[]
  unit: 'kg' | 'lb'
  notes?: string
  photo?: Blob
  createdAt: string
}

/** One row per day: steps, readiness and optional bodyweight. */
export interface DailyCheckin {
  date: string
  steps?: number
  /** 1-5 sleep rating for the night that ENDED this morning */
  sleep?: number
  // ---- v10 sleep & recovery (all optional; same table, no schema change) ----
  /** hours asleep (typed, from bed/wake times, or Apple Health) */
  sleepHours?: number
  /** 'HH:mm' */
  bedTime?: string
  wakeTime?: string
  /** see SLEEP_FACTORS in lib/sleep */
  sleepFactors?: string[]
  sleepNote?: string
  /** where the hours came from */
  sleepSource?: 'manual' | 'health'
  /** Apple Health sleep stages, minutes */
  sleepStages?: { deep?: number; rem?: number; core?: number; awake?: number }
  /** Apple Health, that morning */
  restingHr?: number
  hrv?: number
  energy?: number
  soreness?: number
  readiness?: number
  note?: string
  updatedAt: string
}

// ---------- plan / workouts ----------
export interface PlanExercise {
  exerciseId: string
  sets: number
  reps: [number, number]      // target range
  weightKg?: number           // prescribed working weight (achievable!)
  restSec: number
  timeSec?: number            // for timed exercises (plank, jump rope)
  note?: string
  // ---- v2 (all optional) ----
  /** exercises sharing a group letter are performed as a superset */
  supersetGroup?: string
  /** why this exercise was chosen (coach picks, substitutions) */
  reason?: string
  /** the exercise this replaced when swapping equipment profiles */
  swappedFrom?: string
  // ---- v5 (optional) ----
  /**
   * The other exercises that were valid for this slot at this location, best
   * first. The slot is a POOL, not a fixed lift — surfacing it lets him swap
   * within the slot without leaving the movement pattern the day was built
   * around, and lets the session offer a regression that still fits the plan.
   */
  pool?: string[]
  /** true when this row was regressed during the session (see @/lib/programming) */
  regressedFrom?: string
  // ---- v6 (optional; 12-week program) ----
  /** target reps-in-reserve band, e.g. [2,3] */
  rir?: [number, number]
  /** main = SBD side-quest lift, compound = heavy accessory compound, accessory = isolation/hypertrophy work */
  role?: 'main' | 'compound' | 'accessory' | 'core'
  /** top single / top set + back-offs / PR test structure for a main lift */
  scheme?: MainScheme
  /** one-line technique cue shown on the card */
  cue?: string
  // ---- v7 (optional; 48 individually written workouts) ----
  /** position in the workout (1-based) */
  order?: number
  /** target RPE band (top sets / singles) */
  rpe?: [number, number]
  warmupRule?: 'ramp' | 'pr-ladder' | 'feeder' | 'first-light' | 'none'
  progressionRule?: 'main-rir' | 'top-backoff' | 'single-backoff' | 'double' | 'reps-variation' | 'deload-hold' | 'pr-test' | 'technique'
  /** why this exercise is in the program */
  purpose?: string
  /** why it is programmed THIS way THIS week */
  whyToday?: string
  /** an acceptable swap the program itself suggests */
  alternative?: string
  /** true for squat / bench / deadlift side-quest work */
  sideQuest?: boolean
  goal?: 'SBD side quest' | 'General strength' | 'Hypertrophy' | 'Exercise skill'
  /** which SBD lift a main entry belongs to (estimates, PR history) */
  lift?: 'squat' | 'bench' | 'deadlift'
  /** slot that follows the pull-up journey */
  pullProgression?: boolean
  perSide?: boolean
  /** planned weekly volume this entry contributes: direct sets per group, plus 0.5 contribution */
  volume?: { direct: string[]; contribution: string[]; sets: number }
  /** added by the user (survives program rebuilds) */
  userAdded?: boolean
}

/** How a main lift is structured in a given week. */
export interface MainScheme {
  kind: 'straight' | 'top-backoff' | 'single-backoff' | 'pr-test' | 'technique'
  /** top set (or single) reps and RPE */
  topReps?: number
  topRpe?: [number, number]
  /** back-off sets after the top set */
  backoffSets?: number
  backoffReps?: [number, number]
  /** back-off load as a fraction BELOW the top set, e.g. [0.05, 0.08] */
  backoffDrop?: [number, number]
  /** deload intensity as a fraction of recent working weight, e.g. [0.6, 0.7] */
  intensity?: [number, number]
  note?: string
}

export interface PlanDay {
  id: ID
  title: string               // 'Upper Body', 'Lower Body', 'Full Body A'…
  focus: Muscle[]
  exercises: PlanExercise[]
  estMinutes: number
  estCalories: number
  /**
   * v4 (optional) — exercises this day WANTED but could not fit inside the
   * session-length preference. A commercial-gym day can offer nine movements and
   * an hour holds six, so the difference is stated rather than silently dropped.
   */
  trimmed?: string[]
  // ---- v7 (optional; 12-week program) ----
  programWeek?: number
  dayKey?: 'tue' | 'wed' | 'thu' | 'fri'
  phase?: string
  kind?: 'training' | 'deload' | 'pr' | 'recovery' | 'light'
  intent?: string
  cardio?: { minutes: [number, number]; kind: 'incline-walk' | 'easy' | 'walk'; optional?: boolean; note?: string } | null
}

export interface PlanWeek {
  index: number               // 1-based
  label: string               // 'Foundations', 'Build', 'Push', 'Peak', 'Deload'
  days: PlanDay[]             // length = daysPerWeek
}

export interface Plan {
  id: ID
  name: string
  weeks: PlanWeek[]
  startDate: string           // YYYY-MM-DD (week 1 monday-ish anchor)
  /** which weekdays are training days, e.g. [1,3,5] (0=Sun) */
  trainingWeekdays: number[]
  active: boolean
  createdAt: string
  // ---- v2 (all optional) ----
  /** set when this plan was generated from a coach program */
  coach?: CoachId
  /** short provenance line shown in the UI */
  sourceLabel?: string
  /** weeks of the coach block (4/8/12) */
  blockWeeks?: number
  // ---- v4 (optional) ----
  /**
   * The equipment profile this plan was BUILT for ('home' / 'flex' / a custom
   * location id). Optional on purpose: plans generated before v4 have no such
   * field and must keep working exactly as they do — getActivePlan falls back to
   * the first active plan when nothing matches the current location.
   */
  equipmentProfileId?: ID
  // ---- v6 (optional) ----
  /** set on the research-based 12-week physique + SBD program; exercises are fixed, not localised */
  program?: 'p12'
  /** week the program was started on (Tuesday of week 1) */
  programStart?: string
  /** repeated weeks inserted by the user (missed sessions / manual deload) */
  repeatedWeeks?: number[]
  /** calendar weeks (0-based from programStart) the user turned into a manual deload */
  manualDeloads?: number[]
  // ---- v7 (optional) ----
  /** 2 = built from the 48 individually written workouts (src/data/program48.ts) */
  programVersion?: number
  /** program weeks the user chose to skip */
  skippedWeeks?: number[]
  /** "I'm on week N" — from this calendar week on, the schedule continues from week N */
  manualWeek?: { calendarWeek: number; week: number; setAt: string }
  /** v9: workouts moved because of work — original date → new date (both YYYY-MM-DD) */
  moves?: Record<string, string>
  /** when the program was paused (calendar keeps its place on resume) */
  pausedAt?: string
  /** block number: 1 for the first 12 weeks, 2 for the next block, … */
  cycle?: number
  /** weekly reviews: how the week felt + the recommendation he accepted/declined */
  weekReviews?: Record<number, { feel?: 'too-easy' | 'good' | 'hard' | 'too-hard'; at: string; recommendation?: string; decision?: 'accepted' | 'declined' }>
  /** an ACCEPTED load-only adjustment for one program week (structure untouched) */
  loadAdjust?: { week: number; pct: number }
}

export interface WatchSummary {
  workoutType: string
  durationMin?: number
  activeKcal?: number
  totalKcal?: number
  avgHr?: number
  minHr?: number
  maxHr?: number
  distanceKm?: number
  /** optional screenshot he attached (kept on this device only) */
  screenshot?: Blob
  enteredAt: string
  source: 'manual'
}

export interface SetLog {
  setIndex: number
  targetReps: [number, number]
  reps?: number
  weightKg?: number
  timeSec?: number
  done: boolean
  // ---- v2 (optional) ----
  /** reps in reserve, 0-5; 0 = went to failure */
  rir?: number
  /** true when logged as a warm-up rather than a working set */
  warmup?: boolean
  // ---- v6 (optional) — never rewrite history: planned vs what actually happened ----
  /** load the program PRESCRIBED for this set when the session was built (kg) */
  plannedKg?: number
  /** v8: lowered automatically after a set fell short of the target reps */
  autoDropped?: boolean
  /** v9: when the set was ticked (lets replay show real rest intervals) */
  doneAt?: string
  /** heavier loads tried and abandoned on this set before the logged one */
  attempts?: SetAttempt[]
  /** unit he entered the weight in (weightKg always holds the kg value) */
  unit?: 'kg' | 'lb'
  /** the number exactly as typed, in `unit` (keeps 110 lb as 110 lb, not 49.9 kg) */
  entered?: number
  /** RPE 6-10 as an alternative to RIR */
  rpe?: number
  /** where a hard SBD rep got hardest */
  sticking?: string
  /** structural role of the set */
  kind?: 'work' | 'top' | 'backoff' | 'single' | 'pr-attempt'
  /** set the user changed the load on vs the plan */
  adjusted?: 'reduced' | 'increased'
  /** rep target missed */
  failed?: boolean
}

/** A load that was attempted on a set and abandoned (too heavy today). */
export interface SetAttempt {
  kg: number
  reps?: number
  unit?: 'kg' | 'lb'
  entered?: number
  failed: boolean
  at: string
}

export interface WorkoutLog {
  id: ID
  date: string
  planId?: ID
  weekIndex?: number
  dayId?: ID
  title: string
  startedAt: string
  finishedAt?: string
  exercises: {
    exerciseId: string
    sets: SetLog[]
    swappedFrom?: string
    /**
     * v5 — set when he dropped to an easier variation mid-session because the
     * prescribed load was not there that day. Recorded so repeated regressions
     * on the same movement pattern can be surfaced as a coaching notice; one
     * bad day is noise, a run of them usually means the load is wrong.
     */
    regressedFrom?: string
    /** v6: he chose "end exercise" after a bad first set — remaining sets were not done */
    endedEarly?: boolean
    /** v6: added during the session (not in the plan) */
    extra?: boolean
  }[]
  totalVolumeKg?: number
  calories?: number
  notes?: string
  // ---- v2 (all optional) ----
  /** which EquipmentProfile this session was trained on */
  equipmentProfileId?: ID
  equipmentProfileName?: string
  /** set when the session came from a coach program */
  coach?: CoachId
  /** user cut the session short on purpose (autoregulation) */
  trimmed?: boolean
  /** how the session felt */
  readiness?: 'wrecked' | 'ok' | 'strong'
  // ---- v6 (optional) ----
  /** post-session rating */
  feel?: 'easy' | 'good' | 'hard' | 'too-hard'
  /** pre-session check-in 1-5 */
  checkin?: { sleep: number; energy: number; soreness: number; readiness: number; bodyweightKg?: number }
  /** discomfort reported on exercises (never a diagnosis) */
  discomfort?: { exerciseId: string; where?: string; note?: string; at: string }[]
  /** exercises added during the session that were not in the plan */
  extras?: string[]
  /** v7: what he chose for each extra exercise after the workout */
  extrasDecision?: Record<string, 'one-off' | 'program'>
  /** v9: Apple Watch end-of-workout summary he entered by hand (watch ESTIMATES, not measured lifting) */
  watch?: WatchSummary
  /** a PR-test session for one of the big three */
  prSession?: { lift: 'squat' | 'bench' | 'deadlift'; attempts: { planned: number; kg?: number; made?: boolean }[] }
  /** schedule status relative to the program */
  status?: 'completed' | 'partial' | 'moved' | 'skipped'
  /** program date this session was planned for, when trained on a different day */
  plannedFor?: string
  /** a session the user deliberately skipped */
  skipped?: boolean
}

// ---------- nutrition ----------
export interface FoodItem {
  id: ID
  name: string
  brand?: string
  /** per 100g unless perServing */
  kcal: number
  protein: number
  carbs: number
  fat: number
  servingName?: string   // 'slice', 'cup', 'piece'
  servingGrams?: number
  custom?: boolean
  favourite?: boolean
  /** v10: always first in favourites */
  pinned?: boolean
  useCount?: number
  // ---- v2 (all optional) ----
  dietTags?: DietTag[]
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
  /** extra named serve options beyond servingName/servingGrams */
  serves?: { name: string; grams: number }[]
  /** halal alternatives offered when this item is hidden */
  substituteIds?: string[]
  barcode?: string
}

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export interface FoodLogEntry {
  id: ID
  date: string
  meal: MealKey
  foodId?: ID
  name: string
  grams: number          // amount consumed in grams (or servings*servingGrams)
  kcal: number           // computed totals for the entry
  protein: number
  carbs: number
  fat: number
  createdAt: string
  // ---- v2 (all optional) ----
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
  /** photo the entry was estimated from */
  photo?: Blob
  /** true when this came from the AI photo estimate or a rough quick-add */
  estimate?: boolean
  source?: 'manual' | 'quick' | 'photo' | 'barcode' | 'recipe'
  recipeId?: ID
  barcode?: string
}

// ---------- tracking ----------
export interface WeighIn { id: ID; date: string; weightKg: number; note?: string }

export interface Measurement {
  id: ID
  date: string
  /** cm values; any subset */
  values: Partial<Record<'biceps' | 'abs' | 'waist' | 'chest' | 'shoulders' | 'thigh' | 'calf' | 'neck' | 'hips', number>>
}

export interface WaterLog { id: ID; date: string; ml: number; at: string; /** v9: which saved bottle/drink, and the full volume drunk */ drink?: string; drunkMl?: number }
export interface CreatineLog { id: ID; date: string; taken: boolean; at?: string }

export interface CardioLog {
  id: ID
  date: string
  /** v6 adds incline walking, bike and elliptical for the program's Zone 2 work */
  kind: 'run' | 'walk' | 'jump-rope' | 'incline-walk' | 'bike' | 'elliptical'
  seconds: number
  distanceKm?: number
  rounds?: number         // jump rope rounds
  calories?: number
  avgPaceSecPerKm?: number
  note?: string
  createdAt: string
  // ---- v6 (optional) ----
  avgHr?: number
  inclinePct?: number
  speedKmh?: number
  /** counts toward the program's cardio target for that week */
  program?: boolean
  // ---- v2.23 (optional) ----
  /** treadmill run: seconds for each km (last entry may be a part km) */
  splitsSec?: number[]
  treadmill?: boolean
  maxHr?: number
  /** steps per minute from the watch */
  cadence?: number
  /** calories the watch / treadmill reported (used instead of the estimate when given) */
  deviceKcal?: number
  /** the app's own estimate, kept for comparison */
  estKcal?: number
}

// ---------- reminders ----------
export interface ReminderConfig {
  id: 'reminders'
  waterEnabled: boolean
  waterIntervalMin: number     // e.g. 90
  waterWindow: [string, string] // ['07:00','21:30']
  creatineEnabled: boolean
  creatineTime: string          // 'HH:mm'
  workoutEnabled: boolean
  workoutLeadMin: number        // notify N min before computed slot
  updatedAt: string
}

export interface Setting { key: string; value: unknown }

// ============================================================
// v2 ADDITIONS (2026-09) — additive only.
// Every field added to an EXISTING interface above is optional and has a
// read-time default (see db/defaults.ts), so v1 rows keep working untouched.
// ============================================================

// ---------- energy units ----------
/** Australian labels are in kJ; we always STORE kcal and convert for display. */
export type EnergyUnit = 'kcal' | 'kj' | 'both'
export const KJ_PER_KCAL = 4.184

// ---------- diet / halal ----------
export type DietTag =
  | 'pork' | 'alcohol' | 'gelatine' | 'vegetarian' | 'vegan'
  | 'dairy' | 'halal-ok' | 'unclear'

export const DIET_TAG_LABELS: Record<DietTag, string> = {
  pork: 'Pork', alcohol: 'Alcohol', gelatine: 'Gelatine',
  vegetarian: 'Vegetarian', vegan: 'Vegan', dairy: 'Dairy',
  'halal-ok': 'Halal friendly', unclear: 'Check the label',
}

/** Tags that halal mode hides outright. */
export const HALAL_HIDDEN_TAGS: DietTag[] = ['pork', 'alcohol']
/** Tags that halal mode annotates with a "check the label" note. */
export const HALAL_CAUTION_TAGS: DietTag[] = ['gelatine', 'unclear']

// ---------- extended equipment (gym machines etc.) ----------
/** Equipment keys added for full-gym profiles. Union-extends Equipment below. */
export type GymEquipment =
  | 'dumbbell' | 'cable-station' | 'leg-press' | 'hack-squat' | 'pendulum-squat'
  | 'leg-extension' | 'seated-leg-curl' | 'lying-leg-curl' | 'chest-press-machine'
  | 'pec-deck' | 'shoulder-press-machine' | 'seated-row-machine' | 'chest-supported-row'
  | 'assisted-pullup' | 'preacher-bench' | 'calf-raise-machine' | 'hip-thrust-machine'
  | 'adductor-machine' | 'abductor-machine' | 'ab-machine' | 't-bar-row'
  | 'landmine' | 'kettlebell' | 'trap-bar' | 'treadmill' | 'stair-climber'
  | 'rower' | 'bike' | 'sled'
  // v4 — machines a commercial gym has that a garage rack genuinely does not.
  // Without these, exercises like an iso-lateral pulldown were tagged with the
  // plain 'lat-pulldown' his rack DOES have, and leaked into the home plan.
  | 'plate-loaded-machine' | 'back-extension-bench'
  // v5 — the rest of a real 24/7 commercial floor. Cardio variety (B2) needs
  // more than one machine to rotate through, and the functional area is most of
  // what a garage cannot offer at all.
  | 'vertical-leg-press' | 'lateral-raise-machine' | 'biceps-machine' | 'triceps-machine'
  | 'air-bike' | 'ski-erg' | 'elliptical' | 'curved-treadmill'
  | 'resistance-band' | 'medicine-ball' | 'plyo-box' | 'agility-ladder' | 'boxing-bag'
  | 'deadlift-platform'

export const GYM_EQUIPMENT_LABELS: Record<GymEquipment, string> = {
  dumbbell: 'Dumbbells', 'cable-station': 'Cable station', 'leg-press': 'Leg press',
  'hack-squat': 'Hack squat', 'pendulum-squat': 'Pendulum squat',
  'leg-extension': 'Leg extension', 'seated-leg-curl': 'Seated leg curl',
  'lying-leg-curl': 'Lying leg curl', 'chest-press-machine': 'Chest press machine',
  'pec-deck': 'Pec deck', 'shoulder-press-machine': 'Shoulder press machine',
  'seated-row-machine': 'Seated row machine', 'chest-supported-row': 'Chest-supported row',
  'assisted-pullup': 'Assisted pull-up/dip', 'preacher-bench': 'Preacher bench',
  'calf-raise-machine': 'Calf raise machine', 'hip-thrust-machine': 'Hip thrust machine',
  'adductor-machine': 'Adductor machine', 'abductor-machine': 'Abductor machine',
  'ab-machine': 'Ab machine', 't-bar-row': 'T-bar row', landmine: 'Landmine',
  kettlebell: 'Kettlebells', 'trap-bar': 'Trap bar', treadmill: 'Treadmill',
  'stair-climber': 'Stair climber', rower: 'Rower', bike: 'Bike', sled: 'Sled',
  'plate-loaded-machine': 'Plate-loaded machine', 'back-extension-bench': 'Back extension bench',
  'vertical-leg-press': 'Vertical leg press', 'lateral-raise-machine': 'Lateral raise machine',
  'biceps-machine': 'Biceps curl machine', 'triceps-machine': 'Triceps machine',
  'air-bike': 'Air bike', 'ski-erg': 'Ski erg', elliptical: 'Elliptical',
  'curved-treadmill': 'Curved treadmill', 'resistance-band': 'Resistance bands',
  'medicine-ball': 'Medicine ball', 'plyo-box': 'Plyo box',
  'agility-ladder': 'Agility ladder', 'boxing-bag': 'Boxing bag',
  'deadlift-platform': 'Deadlift platform',
}

/** Any equipment key usable anywhere in the app. */
export type AnyEquipment = Equipment | GymEquipment

// ---------- equipment profiles ----------
export interface EquipmentProfile {
  id: ID
  name: string                 // 'Home', 'Flex 24/7'
  builtIn?: boolean
  equipment: AnyEquipment[]
  barbellKg: number
  curlBarKg: number
  smithBarKg: number
  platePairsKg: number[]
  /** available fixed dumbbells (kg, ascending); empty = none */
  dumbbellsKg: number[]
  stackStepsKg: number[]
  /** smallest jump usable for progression on plate-loaded lifts */
  minIncrementKg?: number
  createdAt: string
  updatedAt: string
}

// ---------- snapshots (automatic local backups) ----------
export interface Snapshot {
  id: ID
  createdAt: string
  date: string                 // YYYY-MM-DD
  reason: 'auto' | 'pre-restore' | 'manual'
  counts: Record<string, number>
  bytes: number
  compressed: boolean
  /** base64 gzip (compressed) or raw JSON string */
  payload: string
}

// ---------- recipes / saved meals ----------
export interface RecipeIngredient {
  foodId?: ID
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Recipe {
  id: ID
  name: string
  ingredients: RecipeIngredient[]
  /** how many serves the whole recipe makes (log 1 serve by default) */
  servings: number
  favourite?: boolean
  useCount?: number
  createdAt: string
  updatedAt: string
}

// ---------- progress photos ----------
export type PhotoPose = 'front' | 'side' | 'back' | 'other'
  // v9 (additive): more categories
  | 'front-flex' | 'side-right' | 'back-flex' | 'arms' | 'legs' | 'abs'

export interface ProgressPhoto {
  id: ID
  date: string
  pose: PhotoPose
  blob: Blob
  thumb?: string
  weightKg?: number
  note?: string
  createdAt: string
  /** v9: conditions, e.g. morning, fasted, after workout */
  tags?: string[]
}

// ---------- per-exercise metadata (notes, injuries, overrides) ----------
export interface ExerciseMeta {
  exerciseId: string
  note?: string
  injured?: boolean
  injuredSince?: string
  /** user override of the working rep range */
  repRange?: [number, number]
  restSec?: number
  updatedAt: string
  // ---- v6 (optional) ----
  /** preferred weight unit for this exercise (machines are often lb) */
  unit?: 'kg' | 'lb'
  /** loads this machine/stack actually offers, in `unit`, ascending */
  increments?: number[]
  /** lat pulldown → assisted → bodyweight → weighted: which rung he trains now */
  pathStage?: string
  // ---- v9 (optional) ----
  /** plateau plan he APPROVED: hold the load and chase reps until this date */
  holdLoadUntil?: string
  /** smart gym mode: this machine is busy / broken right now */
  availability?: 'available' | 'occupied' | 'unavailable'
  availabilityAt?: string
  // ---- v10 (optional) ----
  /** his own seat / pad numbers for this machine, e.g. 'seat 4, back pad 2' */
  setupNote?: string
}

// ---------- barcode cache (Open Food Facts) ----------
export interface BarcodeEntry {
  barcode: string
  name: string
  brand?: string
  kcal: number                 // per 100g
  protein: number
  carbs: number
  fat: number
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
  servingGrams?: number
  servingName?: string
  dietTags?: DietTag[]
  fetchedAt: string
}

// ---------- calorie carry-over ("take it off tomorrow") ----------
export interface DayAdjust {
  date: string                 // the day being ADJUSTED
  deltaKcal: number            // negative = target reduced
  reason: string
  sourceDate: string           // the day that went over
  createdAt: string
}

// ---------- coach programs ----------
export type CoachId = 'cbum' | 'nippard'

/** A day- or week-scoped swap of the plan, without touching the saved plan. */
export interface ProgramOverride {
  id: ID
  coach: CoachId
  scope: 'day' | 'week'
  /** for scope 'day' the exact date; for 'week' the Monday of that week */
  date: string
  /** replacement exercises keyed by the plan day title they stand in for */
  exercises: PlanExercise[]
  title: string
  note?: string
  createdAt: string
}

// ---------- Ramadan mode ----------
export interface RamadanConfig {
  enabled: boolean
  /** 'HH:mm' — pre-dawn meal */
  suhoorTime: string
  /** 'HH:mm' — breaking the fast */
  iftarTime: string
  /** preferred training slot while fasting */
  trainingWindow: 'before-iftar' | 'after-iftar' | 'after-taraweeh' | 'before-suhoor'
  /** drop volume to a maintenance block while fasting */
  maintenanceVolume: boolean
  startDate?: string
  endDate?: string
}

// ---------- prayer-aware scheduling ----------
export interface PrayerConfig {
  enabled: boolean
  /** 'HH:mm' times; entered manually or estimated — never fabricated as authoritative */
  times: { fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string }
  /** minutes to keep clear around each prayer */
  bufferMin: number
}

/** Labels for every equipment key (home + gym). */
export const ALL_EQUIPMENT_LABELS: Record<AnyEquipment, string> = {
  ...EQUIPMENT_LABELS,
  ...GYM_EQUIPMENT_LABELS,
}

export function equipmentLabel(key: AnyEquipment): string {
  return ALL_EQUIPMENT_LABELS[key] ?? String(key)
}

// ============================================================
// v3 — EXERCISE QUALITY MODEL
// Why this exists: swapping locations used to only replace exercises that were
// MISSING. Home kit is a subset of a commercial gym, so going Home -> Flex
// changed nothing and 44 machines went unused. The engine now needs to know
// which exercise is BETTER for a given job, not just whether it exists.
// ============================================================

/** What the movement actually is, independent of the kit used to do it. */
export type MovementPattern =
  | 'squat' | 'hinge' | 'lunge' | 'leg-press'
  | 'horizontal-push' | 'incline-push' | 'vertical-push' | 'chest-fly'
  | 'horizontal-pull' | 'vertical-pull' | 'pullover'
  | 'elbow-flexion' | 'elbow-extension'
  | 'lateral-raise' | 'rear-delt' | 'shrug'
  | 'knee-flexion' | 'knee-extension' | 'hip-extension' | 'hip-abduction'
  | 'calf' | 'core-flexion' | 'core-anti-extension' | 'core-rotation'
  | 'carry' | 'cardio' | 'other'

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge', 'leg-press': 'Leg press',
  'horizontal-push': 'Horizontal press', 'incline-push': 'Incline press',
  'vertical-push': 'Overhead press', 'chest-fly': 'Chest fly', 'horizontal-pull': 'Row',
  'vertical-pull': 'Vertical pull', pullover: 'Pullover',
  'elbow-flexion': 'Curl', 'elbow-extension': 'Triceps extension',
  'lateral-raise': 'Lateral raise', 'rear-delt': 'Rear delt', shrug: 'Shrug',
  'knee-flexion': 'Leg curl', 'knee-extension': 'Leg extension',
  'hip-extension': 'Hip extension', 'hip-abduction': 'Abduction',
  calf: 'Calf', 'core-flexion': 'Ab flexion',
  'core-anti-extension': 'Anti-extension', 'core-rotation': 'Rotation',
  carry: 'Carry', cardio: 'Cardio', other: 'Other',
}

/**
 * Quality of an exercise FOR ITS PATTERN, ranked the way the evidence-based
 * crowd (Nippard et al.) argues it: does it load the muscle in a lengthened
 * position, can you take it close to failure safely, is the resistance profile
 * honest through the range.
 *  1 = the best option for this job
 *  4 = it works, but only because it's what's in the room
 */
export type ExerciseTier = 1 | 2 | 3 | 4

export interface ExerciseQuality {
  pattern: MovementPattern
  tier: ExerciseTier
  /** loads the target muscle in a lengthened position — the biggest single lever */
  stretchLoaded?: boolean
  /** stable enough to push to 0-1 RIR alone without a spotter */
  stableToFailure?: boolean
  /** how much systemic fatigue it costs relative to the stimulus */
  systemicCost?: 'low' | 'moderate' | 'high'
  /** unilateral work that fixes side-to-side differences */
  fixesImbalance?: boolean
  /** one line explaining why this is a step up, shown when it swaps in */
  edge?: string
}
