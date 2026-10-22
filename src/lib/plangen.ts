// ============================================================
// PLAN GENERATOR — the brain of Ironverse.
//
// Builds a 5-week progressive program from the owner's profile and the
// static exercise registry. Every prescribed load comes from lib/plates,
// so it is ALWAYS buildable on his hardware (rack/smith/cables, barbell
// 20kg, curl bar 10kg, plate pairs 5/10/15/20, bodyweight attachments).
//
// Shape of a plan:
//   split      — 3d: Full Body A/B/C · 4d: Upper/Lower ×2 · 5d: U/L + Push/Pull/Legs
//   weeks      — Foundations → Build → Push → Peak → Deload
//   sets       — 3 → 3 → 4 → 4 → 2
//   reps       — squeeze toward the lower end of the range as weeks progress
//   loads      — start = BW × startFactor × experience, step up (nextLoadUp)
//                at Build and Peak, Deload = ~60% re-snapped to real plates
//
// Exports: generatePlan, WEEK_LABELS, dayForDate (+ small helper types).
//
// v4 (2026-09-15) — two complaints, two fixes, both opt-in through
// `generatePlan(p, opts)`. Called with no options it behaves EXACTLY as before.
//   1. "the gym session is the same as home" — pass `opts.equipment` and the
//      plan is BUILT for that location: only exercises available there are
//      selected, ranking breaks ties toward the best option that room offers,
//      and the day templates grow machine + isolation slots a garage cannot
//      fill (and drop the accessory compounds those supersede). One plan per
//      location; localiseSession stays the safety net for a plan built
//      elsewhere.
//   2. "every week is the same, only the reps change" — accessories and
//      isolation rotate between two-week blocks (same movement pattern, same
//      primary muscle, different exercise), while the first compound of each
//      pattern anchors the whole plan so progression still has something to
//      measure. Loads for a rotated-in exercise start where IT starts.
// ============================================================

import dayjs from 'dayjs'
import { byId, EXERCISES } from '@/data/exercises'
import { COACHES, coachPicks, coachWhyMap, groupsForMuscles } from '@/data/coaches'
import type { Coach, MuscleGroup } from '@/data/coaches'
import { newId, nowIso, todayStr } from '@/lib/id'
import {
  effectiveLoadMode, nearestLoad, nextLoadUp,
  type AnyLoadMode, type LoadSource,
} from '@/lib/plates'
import { isAvailable } from '@/lib/equipment'
import { inferQuality, qualityScore, sameRole } from '@/lib/quality'
import { metCalories } from '@/lib/nutrition'
import { pickTrainingDays } from '@/lib/schedule'
import type {
  AnyEquipment, CoachId, EquipmentProfile, Exercise, ID, MovementPattern, Muscle,
  Plan, PlanDay, PlanExercise, PlanWeek, Profile, ProgramOverride,
} from '@/db/types'

// ---------- week periodisation ----------

export const WEEK_LABELS = ['Foundations', 'Build', 'Push', 'Peak', 'Deload'] as const

/** working sets per week (deload = 2 easy sets) */
const SETS_BY_WEEK = [3, 3, 4, 4, 2]
/** how many reps we shave off the top of the range per week */
const REP_SHIFT_BY_WEEK = [0, 1, 2, 3, 0]
/** rest seconds per week — compounds always rest longer */
const REST_COMPOUND = [90, 90, 105, 120, 90]
const REST_ISOLATION = [75, 75, 90, 90, 75]
const REST_CORE = [60, 60, 60, 60, 45]
/** timed core holds (plank etc.) grow weekly, sec */
const CORE_TIME = [35, 40, 50, 60, 30]
/** cardio finisher duration grows weekly, sec (5–8 min) */
const CARDIO_TIME = [300, 360, 420, 480, 300]

// ---------- variation blocks (v4 — exercise rotation) ----------
//
// Why blocks and not "a different exercise every week":
// progression needs a stable anchor. If the main lift of a pattern changes every
// week there is nothing to measure, and "am I getting stronger?" becomes
// unanswerable. So the ANCHOR COMPOUND of every pattern is the same lift for all
// five weeks and its load climbs through loadLadder, while the ACCESSORY and
// ISOLATION slots rotate between two-week blocks — same movement pattern, same
// primary muscle, different exercise. Week 5 (deload) reaches for the most
// joint-friendly variant available, because a deload is recovery, not a test.
//
//   weeks 1-2 → block 0 (variation A)
//   weeks 3-4 → block 1 (variation B)
//   week  5   → block 2 (deload — joint-friendly / machine variant)
const BLOCK_BY_WEEK = [0, 0, 1, 1, 2] as const
const BLOCK_COUNT = 3
/** the first week (0-based) each block is trained — used to start its load ladder */
const BLOCK_FIRST_WEEK = [0, 2, 4] as const
/** weeks where the load steps up (matches the original ladder shape exactly) */
const STEP_WEEKS = new Set([1, 3])

const EXPERIENCE_MULT: Record<Profile['experience'], number> = {
  beginner: 0.7,
  intermediate: 1,
  advanced: 1.25,
}

// ---------- exercise classification ----------

type Role = 'compound' | 'isolation' | 'core' | 'cardio'

/** obvious single-joint / accessory patterns — never treated as compounds */
const ISOLATION_RX =
  /(curl|fly|flye|raise|extension|pushdown|pressdown|kickback|crunch|plank|calf|shrug|face-pull|pullover|straight-arm|rotation|twist|hollow|leg-raise|sit-up|situp|dead-bug|bird-dog)/
/** multi-joint patterns that anchor a session */
const COMPOUND_RX =
  /(bench|squat|deadlift|rdl|romanian|good-morning|row|press|pulldown|pull-up|pullup|chin|hip-thrust|dip|lunge|split-squat|step-up|push-up|pushup|thruster)/

function isCompound(ex: Exercise): boolean {
  if (ex.kind !== 'strength') return false
  const key = `${ex.id} ${ex.name.toLowerCase()}`
  if (ISOLATION_RX.test(key)) return false
  if (COMPOUND_RX.test(key)) return true
  // fallback: lots of musculature involved → treat as compound
  return ex.primary.length + ex.secondary.length >= 3
}

function roleOf(ex: Exercise): Role {
  if (ex.kind === 'cardio') return 'cardio'
  if (ex.kind === 'core' || ex.kind === 'mobility') return 'core'
  return isCompound(ex) ? 'compound' : 'isolation'
}

/** big-lift priority — higher means "goes earlier / picked first" */
function compoundPriority(ex: Exercise): number {
  const key = `${ex.id} ${ex.name.toLowerCase()}`
  if (/lunge|split-squat|step-up/.test(key)) return 70 // before generic squat test
  if (/squat/.test(key)) return 100
  // 'bench' alone is not enough — names like 'Bench Dip' / 'Push-Up (Feet on
  // Bench)' mention the bench without being a press
  if (/bench.*press|chest.*press/.test(key)) return 96
  if (/deadlift|rdl|romanian/.test(key)) return 92
  if (/(^|[^d])row/.test(key)) return 90
  if (/(overhead|shoulder|military).*press|press.*(overhead|shoulder)/.test(key)) return 88
  if (/pulldown/.test(key)) return 86
  if (/pull-?up|chin-?up/.test(key)) return 84
  if (/hip-thrust/.test(key)) return 82
  if (/dip/.test(key)) return 74
  if (/push-up|pushup/.test(key)) return 60
  return 55
}

// ---------- day templates (muscle slots, not hardcoded exercise ids) ----------
// Slots select from whatever the registry offers, so the generator keeps
// working (and improves) as the exercise library grows.

interface SlotSpec {
  /** acceptable PRIMARY muscles for this slot */
  muscles: Muscle[]
  role: 'compound' | 'isolation' | 'core' | 'cardio'
  /**
   * Soft movement-pattern hint (tested against id + name). Applied AFTER the
   * variety rotation but BEFORE raw big-lift priority, so e.g. a 'lats' slot
   * meant as a VERTICAL pull reaches for pulldowns/pull-ups instead of letting
   * rows (which also list lats primary) win every back slot.
   */
  prefer?: RegExp
  /**
   * v4 — location gate. The slot is only added when the equipment profile has at
   * least ONE of these keys. Used by `gymSlots` so a commercial gym day can grow
   * the machine + isolation work a garage simply cannot offer, without inventing
   * slots that the home plan would then have to fill with something random.
   */
  requires?: AnyEquipment[]
  /**
   * v4 — set on a BASE slot that the location's machine work supersedes. At a
   * location with that machine kit the slot steps aside so the machine + isolation
   * work has room inside his session-length budget; at home it is untouched and
   * behaves exactly as it always has. Without this a gym day is just the garage
   * day with two extra exercises bolted on the end — which the time budget then
   * trims straight back off.
   */
  dropAtGym?: AnyEquipment[]
}

interface DayTemplate {
  title: string
  focus: Muscle[]
  slots: SlotSpec[]
  /** the slot appended for build-muscle goal (extra isolation volume) */
  extraIso: SlotSpec
  /**
   * v4 — extra slots added ONLY when generating for a location that has the kit
   * (see SlotSpec.requires). This is what makes a gym session genuinely a gym
   * session instead of the garage session with different labels: the plan gets
   * a slot for a leg extension / pec deck / machine press, not just a lens over
   * a barbell-shaped day. Still muscles + role + pattern intent — no ids.
   */
  gymSlots?: SlotSpec[]
}

const core: SlotSpec = { muscles: ['abs', 'obliques'], role: 'core' }

// movement-pattern hints (see SlotSpec.prefer)
// NB 'chin-?up' not bare 'chin' — 'chin' is inside 'maCHINe' (Smith Machine …)
const VERTICAL_PULL = /pulldown|pull-?up|chin-?up/
const HINGE = /rdl|romanian|deadlift|good-morning/
const GLUTE_DRIVE = /hip-thrust|pull-through/
const VERTICAL_PUSH = /overhead|shoulder-press|military|arnold|ohp/
const INCLINE_OR_DIP = /incline|dip/
const SINGLE_LEG = /lunge|split-squat|step-up|front-squat/
const GRIP_WORK = /wrist|reverse-curl|hammer|forearm/

// v4 — machine / isolation pattern intents used by the gym-only slots below
const KNEE_EXTENSION = /leg-extension/
const KNEE_FLEXION = /leg-curl|hamstring-curl/
const CHEST_FLY = /pec-deck|fly|flye|crossover/
const LEG_PRESS = /leg-press|hack-squat|pendulum/
const TRICEPS_CABLE = /pushdown|pressdown/
const PREACHER = /preacher|spider/
const HIP_ABDUCTION = /abductor|adductor/
const LAT_ISOLATION = /pullover|straight-arm/

// Equipment keys that gate the gym slots (any one of them is enough).
const LEG_PRESS_KIT: AnyEquipment[] = ['leg-press', 'hack-squat', 'pendulum-squat']
const LEG_CURL_KIT: AnyEquipment[] = ['seated-leg-curl', 'lying-leg-curl']
const LEG_EXT_KIT: AnyEquipment[] = ['leg-extension']
const FLY_KIT: AnyEquipment[] = ['pec-deck', 'cable-station']
const PRESS_MACHINE_KIT: AnyEquipment[] = ['chest-press-machine', 'shoulder-press-machine']
const DB_OR_CABLE_KIT: AnyEquipment[] = ['dumbbell', 'cable-station']
const PREACHER_KIT: AnyEquipment[] = ['preacher-bench']
const ABDUCTOR_KIT: AnyEquipment[] = ['abductor-machine', 'adductor-machine']
const CALF_MACHINE_KIT: AnyEquipment[] = ['calf-raise-machine']

const FULL_BODY: DayTemplate[] = [
  {
    title: 'Full Body A',
    focus: ['quads', 'chest', 'upper-back', 'hamstrings', 'biceps', 'abs'],
    slots: [
      { muscles: ['quads', 'glutes'], role: 'compound' },        // squat pattern
      { muscles: ['chest'], role: 'compound' },                  // horizontal push
      { muscles: ['upper-back', 'lats'], role: 'compound' },     // row
      { muscles: ['hamstrings', 'glutes'], role: 'compound', prefer: HINGE },
      { muscles: ['biceps'], role: 'isolation' },
      core,
    ],
    extraIso: { muscles: ['triceps'], role: 'isolation' },
    // four compound patterns already — one machine isolation is what fits
    gymSlots: [
      { muscles: ['quads'], role: 'isolation', prefer: KNEE_EXTENSION, requires: LEG_EXT_KIT },
    ],
  },
  {
    title: 'Full Body B',
    focus: ['hamstrings', 'front-delts', 'lats', 'quads', 'triceps', 'abs'],
    slots: [
      { muscles: ['hamstrings', 'glutes'], role: 'compound', prefer: HINGE },
      { muscles: ['front-delts', 'chest'], role: 'compound', prefer: VERTICAL_PUSH },
      { muscles: ['lats'], role: 'compound', prefer: VERTICAL_PULL },
      { muscles: ['quads', 'glutes'], role: 'compound', prefer: SINGLE_LEG },
      { muscles: ['triceps'], role: 'isolation' },
      core,
    ],
    extraIso: { muscles: ['side-delts'], role: 'isolation' },
    gymSlots: [
      { muscles: ['hamstrings'], role: 'isolation', prefer: KNEE_FLEXION, requires: LEG_CURL_KIT },
    ],
  },
  {
    title: 'Full Body C',
    focus: ['quads', 'chest', 'lats', 'glutes', 'side-delts', 'abs'],
    slots: [
      { muscles: ['quads', 'glutes'], role: 'compound' },
      { muscles: ['chest', 'front-delts'], role: 'compound', prefer: INCLINE_OR_DIP },
      { muscles: ['lats', 'upper-back'], role: 'compound' },
      { muscles: ['glutes', 'hamstrings'], role: 'compound', prefer: GLUTE_DRIVE },
      { muscles: ['side-delts', 'rear-delts'], role: 'isolation' },
      core,
    ],
    extraIso: { muscles: ['biceps'], role: 'isolation' },
    gymSlots: [
      { muscles: ['quads'], role: 'isolation', prefer: KNEE_EXTENSION, requires: LEG_EXT_KIT },
    ],
  },
]

const UPPER: DayTemplate = {
  title: 'Upper Body',
  focus: ['chest', 'upper-back', 'front-delts', 'lats', 'triceps', 'biceps'],
  slots: [
    { muscles: ['chest'], role: 'compound' },
    { muscles: ['upper-back', 'lats'], role: 'compound' },
    { muscles: ['front-delts', 'chest'], role: 'compound', prefer: VERTICAL_PUSH },
    { muscles: ['lats'], role: 'compound', prefer: VERTICAL_PULL },
    { muscles: ['triceps'], role: 'isolation' },
    { muscles: ['biceps'], role: 'isolation' },
  ],
  extraIso: { muscles: ['side-delts'], role: 'isolation' },
  // Upper already runs four compound patterns, so ONE machine isolation is all
  // his session budget has room for — take the pec deck and leave the arm work
  // that Push and Pull day would otherwise have to carry alone.
  gymSlots: [
    { muscles: ['chest'], role: 'isolation', prefer: CHEST_FLY, requires: FLY_KIT },
  ],
}

const LOWER: DayTemplate = {
  title: 'Lower Body',
  focus: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  slots: [
    { muscles: ['quads', 'glutes'], role: 'compound' },
    { muscles: ['hamstrings', 'glutes'], role: 'compound', prefer: HINGE },
    { muscles: ['glutes', 'hamstrings'], role: 'compound', prefer: GLUTE_DRIVE, dropAtGym: LEG_PRESS_KIT },
    { muscles: ['calves'], role: 'isolation' },
    core,
  ],
  extraIso: { muscles: ['quads', 'glutes'], role: 'isolation' },
  gymSlots: [
    { muscles: ['quads', 'glutes'], role: 'compound', prefer: LEG_PRESS, requires: LEG_PRESS_KIT },
    { muscles: ['quads'], role: 'isolation', prefer: KNEE_EXTENSION, requires: LEG_EXT_KIT },
    { muscles: ['hamstrings'], role: 'isolation', prefer: KNEE_FLEXION, requires: LEG_CURL_KIT },
    { muscles: ['glutes'], role: 'isolation', prefer: HIP_ABDUCTION, requires: ABDUCTOR_KIT },
  ],
}

const PUSH: DayTemplate = {
  title: 'Push',
  focus: ['chest', 'front-delts', 'side-delts', 'triceps'],
  slots: [
    { muscles: ['chest'], role: 'compound' },
    { muscles: ['front-delts', 'chest'], role: 'compound', prefer: VERTICAL_PUSH },
    { muscles: ['chest', 'triceps'], role: 'compound', prefer: INCLINE_OR_DIP, dropAtGym: PRESS_MACHINE_KIT },
    { muscles: ['side-delts'], role: 'isolation' },
    { muscles: ['triceps'], role: 'isolation' },
    core,
  ],
  extraIso: { muscles: ['chest'], role: 'isolation' },
  // no extra machine PRESS slot here: at a gym the chest and shoulder compound
  // slots above already resolve to the machine versions, and a second press
  // would only eat the session budget that the fly and pushdown need
  gymSlots: [
    { muscles: ['chest'], role: 'isolation', prefer: CHEST_FLY, requires: FLY_KIT },
    { muscles: ['triceps'], role: 'isolation', prefer: TRICEPS_CABLE, requires: DB_OR_CABLE_KIT },
  ],
}

const PULL: DayTemplate = {
  title: 'Pull',
  focus: ['lats', 'upper-back', 'rear-delts', 'biceps', 'forearms'],
  slots: [
    { muscles: ['lats'], role: 'compound', prefer: VERTICAL_PULL },
    { muscles: ['upper-back', 'lats'], role: 'compound' },
    { muscles: ['rear-delts', 'upper-back'], role: 'isolation' },
    { muscles: ['biceps'], role: 'isolation' },
    { muscles: ['forearms', 'biceps'], role: 'isolation', prefer: GRIP_WORK },
    core,
  ],
  extraIso: { muscles: ['traps', 'upper-back'], role: 'isolation' },
  gymSlots: [
    { muscles: ['lats'], role: 'isolation', prefer: LAT_ISOLATION, requires: FLY_KIT },
    { muscles: ['biceps'], role: 'isolation', prefer: PREACHER, requires: PREACHER_KIT },
  ],
}

const LEGS: DayTemplate = {
  title: 'Legs',
  focus: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  slots: [
    { muscles: ['quads', 'glutes'], role: 'compound' },
    { muscles: ['hamstrings', 'glutes'], role: 'compound', prefer: HINGE },
    { muscles: ['glutes', 'hamstrings'], role: 'compound', prefer: GLUTE_DRIVE, dropAtGym: LEG_PRESS_KIT },
    { muscles: ['quads'], role: 'compound', prefer: SINGLE_LEG, dropAtGym: LEG_PRESS_KIT },
    { muscles: ['calves'], role: 'isolation' },
    core,
  ],
  extraIso: { muscles: ['glutes'], role: 'isolation' },
  gymSlots: [
    { muscles: ['quads', 'glutes'], role: 'compound', prefer: LEG_PRESS, requires: LEG_PRESS_KIT },
    { muscles: ['quads'], role: 'isolation', prefer: KNEE_EXTENSION, requires: LEG_EXT_KIT },
    { muscles: ['hamstrings'], role: 'isolation', prefer: KNEE_FLEXION, requires: LEG_CURL_KIT },
    { muscles: ['calves'], role: 'isolation', requires: CALF_MACHINE_KIT },
    { muscles: ['glutes'], role: 'isolation', prefer: HIP_ABDUCTION, requires: ABDUCTOR_KIT },
  ],
}

/** the split for a given training frequency (clamped 1–7) */
function templatesFor(daysPerWeek: number): DayTemplate[] {
  const n = Math.max(1, Math.min(7, Math.round(daysPerWeek) || 3))
  if (n <= 3) return FULL_BODY.slice(0, n)
  if (n === 4) return [UPPER, LOWER, UPPER, LOWER]
  if (n === 5) return [UPPER, LOWER, PUSH, PULL, LEGS]
  if (n === 6) return [PUSH, PULL, LEGS, PUSH, PULL, LEGS]
  return [PUSH, PULL, LEGS, UPPER, LOWER, FULL_BODY[0], FULL_BODY[1]]
}

function splitLabel(daysPerWeek: number): string {
  const n = Math.max(1, Math.min(7, Math.round(daysPerWeek) || 3))
  if (n <= 3) return 'Full Body'
  if (n === 4) return 'Upper / Lower'
  if (n === 5) return 'U/L + Push Pull Legs'
  return 'Push / Pull / Legs'
}

// ---------- exercise selection ----------

const overlap = (a: Muscle[], b: Muscle[]) => a.some((m) => b.includes(m))

/**
 * Pick the best exercise for a slot.
 * Deterministic-ish rotation: a plan-wide usage counter makes repeated
 * templates (Upper ×2, Full Body A/B/C) reach for DIFFERENT variants of the
 * same pattern, while ties break on big-lift priority then id — so the same
 * profile always generates the same sensible plan.
 */
/**
 * v4 — what the picker knows about WHERE this plan is being built.
 * Absent (the legacy path) everything below is inert and selection behaves
 * exactly as it always has.
 */
interface PickContext {
  /** when set, only exercises doable at this location are considered */
  equipment?: EquipmentProfile
  /** prefer the most joint-friendly option (deload block) */
  jointFriendly?: boolean
  /** ids this slot has already used in another block */
  exclude?: Set<string>
}

function rankedForSlot(
  slot: SlotSpec,
  usage: Map<string, number>,
  ctx: PickContext = {},
): Exercise[] {
  const strength = (e: Exercise) => e.kind === 'strength' && overlap(e.primary, slot.muscles)

  let candidates: Exercise[]
  if (slot.role === 'core') {
    candidates = EXERCISES.filter((e) => e.kind === 'core' && overlap(e.primary, slot.muscles))
    if (!candidates.length) candidates = EXERCISES.filter((e) => e.kind === 'core')
  } else if (slot.role === 'cardio') {
    // garage finisher pool: jump rope / burpees (both always on hand); other
    // cardio (running, high-knees…) only backs the pool up if those are missing
    const allCardio = EXERCISES.filter((e) => e.kind === 'cardio')
    const finishers = allCardio.filter((e) => /jump-rope|burpee/.test(e.id))
    candidates = finishers.length ? finishers : allCardio
  } else if (slot.role === 'compound') {
    candidates = EXERCISES.filter((e) => strength(e) && isCompound(e))
    if (!candidates.length) candidates = EXERCISES.filter(strength) // relax if sparse
  } else {
    candidates = EXERCISES.filter((e) => strength(e) && !isCompound(e))
    if (!candidates.length) candidates = EXERCISES.filter(strength)
  }
  // last resort for strength slots: secondary-muscle matches keep sparse
  // registries usable (core/cardio slots simply stay empty instead)
  if (!candidates.length && (slot.role === 'compound' || slot.role === 'isolation')) {
    candidates = EXERCISES.filter(
      (e) => e.kind === 'strength' && overlap(e.secondary, slot.muscles),
    )
  }

  // location filter: only what he can actually do in THIS room. If that empties
  // the pool we fall back to the unfiltered list rather than leaving a hole —
  // the session localiser is still the safety net at training time.
  const eq = ctx.equipment
  if (eq) {
    const here = candidates.filter((e) => isAvailable(e, eq))
    if (here.length) candidates = here
  }

  const ranked = [...candidates].sort((a, b) => {
    const useDiff = (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0)
    if (useDiff !== 0) return useDiff // least-used first → variety across days
    if (slot.prefer) {
      const hit = (e: Exercise) => (slot.prefer!.test(`${e.id} ${e.name.toLowerCase()}`) ? 0 : 1)
      if (hit(a) !== hit(b)) return hit(a) - hit(b) // movement-pattern intent
    }
    if (slot.role === 'cardio') {
      // prefer jump rope, then burpees, for the finisher
      const pref = (e: Exercise) => (/jump-rope/.test(e.id) ? 0 : /burpee/.test(e.id) ? 1 : 2)
      if (pref(a) !== pref(b)) return pref(a) - pref(b)
    }
    const prDiff = compoundPriority(b) - compoundPriority(a) // big lifts first
    if (prDiff !== 0) return prDiff
    if (eq) {
      // Location-aware tie-break: among the moves that fit this slot equally
      // well, take the BEST way to do it with the kit in THIS room rather than
      // whatever is most barbell-shaped. compoundPriority scores a hack squat
      // and a back squat the same (both are the squat pattern), so this is what
      // turns a gym leg day into hack squat + leg press + leg extension while
      // the garage keeps its barbell — without ever letting a machine hijack a
      // slot meant for a different movement.
      if (ctx.jointFriendly) {
        const jf = (e: Exercise) => (inferQuality(e).stableToFailure ? 0 : 1)
        if (jf(a) !== jf(b)) return jf(a) - jf(b)
      }
      const qDiff = qualityScore(a) - qualityScore(b) // lower is better
      if (qDiff !== 0) return qDiff
    }
    return a.id.localeCompare(b.id)
  })

  return ranked
}

/**
 * The slot's pool: every exercise that legitimately fills it here, best first.
 * A slot is a POOL, not a fixed lift — that is the whole fix for "it is always
 * the same machine". `pickForSlot` just takes the first one still free.
 */
function poolForSlot(
  slot: SlotSpec,
  usedInDay: Set<string>,
  usage: Map<string, number>,
  ctx: PickContext = {},
): Exercise[] {
  return rankedForSlot(slot, usage, ctx).filter(
    (e) => !usedInDay.has(e.id) && !ctx.exclude?.has(e.id),
  )
}

function pickForSlot(
  slot: SlotSpec,
  usedInDay: Set<string>,
  usage: Map<string, number>,
  ctx: PickContext = {},
): Exercise | null {
  const pick = poolForSlot(slot, usedInDay, usage, ctx)[0]
  if (!pick) return null
  usedInDay.add(pick.id)
  usage.set(pick.id, (usage.get(pick.id) ?? 0) + 1)
  return pick
}

/** a selected exercise + the role it plays in the session */
interface Picked {
  ex: Exercise
  role: Role
  /**
   * v4 (optional) — the exercise this slot trains in each variation block.
   * Absent means "the same lift every week", which is exactly what every
   * pre-v4 caller (and every anchor compound) gets.
   */
  byBlock?: Exercise[]
  /**
   * v5 — the other exercises that were valid for this slot here, best first.
   * Carried onto PlanExercise.pool so the session can offer a same-slot swap or
   * a regression without leaving the movement pattern the day was built on.
   */
  pool?: Exercise[]
}

/** the exercise a slot trains in week `w` (0-based) */
function exerciseForWeek(pk: Picked, w: number): Exercise {
  return pk.byBlock?.[BLOCK_BY_WEEK[w] ?? 0] ?? pk.ex
}

/**
 * Exercises that could stand in for `base`: same movement pattern, same job
 * (a compound is never rotated to an isolation) and at least one shared primary
 * muscle. Rotation must feel like a different angle on the same work, never a
 * different workout.
 */
function rotationPool(base: Exercise, ctx: PickContext): Exercise[] {
  const pattern = inferQuality(base).pattern
  if (pattern === 'other' || pattern === 'cardio') return []
  const primary = new Set(base.primary)
  let pool = EXERCISES.filter(
    (c) => c.id !== base.id
      && c.kind === base.kind
      && inferQuality(c).pattern === pattern
      && sameRole(base, c)
      && c.primary.some((m) => primary.has(m)),
  )
  // at a location, a rotation he cannot perform there is worse than no rotation
  if (ctx.equipment) pool = pool.filter((c) => isAvailable(c, ctx.equipment!))
  return pool
}

/**
 * Resolve one slot into its per-block exercises.
 *
 * Anchor compounds keep the same lift for all five weeks — progression needs
 * something stable to measure against. Accessories and isolation rotate: a new
 * variation at week 3, and the most joint-friendly variant available for the
 * deload.
 */
function pickSlotForBlocks(
  slot: SlotSpec,
  usedInDay: Set<string>,
  usage: Map<string, number>,
  ctx: PickContext,
  opts: { rotate: boolean; seed: number; anchored: Set<MovementPattern> },
): Picked | null {
  // resolve the whole pool, then take the top of it — same ordering as before,
  // but the alternatives survive instead of being thrown away
  const poolAll = poolForSlot(slot, usedInDay, usage, ctx)
  const first = poolAll[0]
  if (!first) return null
  usedInDay.add(first.id)
  usage.set(first.id, (usage.get(first.id) ?? 0) + 1)
  const slotPool = poolAll.slice(0, 6)
  const role = roleOf(first)

  // ANCHORS NEVER ROTATE. The first compound of each movement pattern in a day
  // is the lift he measures himself on — swap it week to week and "am I getting
  // stronger?" stops having an answer. Core and the conditioning finisher stay
  // put for the same reason. Everything else — isolation, and any second
  // compound of a pattern already anchored — is accessory work, and rotates.
  const pattern = inferQuality(first).pattern
  let anchor = false
  if (role === 'compound' && !opts.anchored.has(pattern)) {
    opts.anchored.add(pattern)
    anchor = true
  }
  const rotates = opts.rotate && !anchor && (role === 'isolation' || role === 'compound')
  if (!rotates) return { ex: first, role, pool: slotPool }

  const mine = new Set<string>([first.id])
  const byBlock: Exercise[] = [first]
  const all = rotationPool(first, ctx)

  for (let b = 1; b < BLOCK_COUNT; b++) {
    const deload = b === BLOCK_COUNT - 1
    // the deload may reuse an earlier block's exercise if that one is the most
    // joint-friendly option this location has — recovery beats novelty
    const pool = [...all, ...(deload ? byBlock : [])]
      .filter((c) => deload ? (mine.has(c.id) || !usedInDay.has(c.id)) : !usedInDay.has(c.id) && !mine.has(c.id))
      .sort((a, c) => {
        if (deload) {
          const jf = (e: Exercise) => (inferQuality(e).stableToFailure ? 0 : 1)
          if (jf(a) !== jf(c)) return jf(a) - jf(c)
        }
        const qd = qualityScore(a) - qualityScore(c)
        if (qd !== 0) return qd
        return a.id.localeCompare(c.id)
      })
    if (!pool.length) {
      byBlock.push(byBlock[b - 1]) // nothing sensible to rotate to — stay put
      continue
    }
    // the seed nudges which of the TOP TWO variants comes up, so two plans built
    // the same day do not read identically — but it can never drag the choice
    // down the list to something clearly worse
    const top = Math.min(pool.length, 2)
    const pick = deload ? pool[0] : pool[opts.seed > 0 ? opts.seed % top : 0]
    if (!mine.has(pick.id)) {
      mine.add(pick.id)
      usedInDay.add(pick.id)
      usage.set(pick.id, (usage.get(pick.id) ?? 0) + 1)
    }
    byBlock.push(pick)
  }

  return { ex: first, role, byBlock, pool: slotPool }
}

/** rough seconds one exercise costs in PEAK week (the longest) — for session-length trimming */
function peakWeekSeconds(pk: Picked): number {
  const timed = pk.ex.loadMode === 'time'
  switch (pk.role) {
    case 'cardio': return timed ? CARDIO_TIME[3] + 60 : 3 * (45 + 60)
    case 'core': return 3 * ((timed ? CORE_TIME[3] : 45) + REST_CORE[3])
    case 'compound': return SETS_BY_WEEK[3] * (45 + REST_COMPOUND[3])
    default: return SETS_BY_WEEK[3] * (45 + REST_ISOLATION[3])
  }
}

/** choose 5–7 exercises for one day template (selection is shared by all weeks) */
function selectDayExercises(
  t: DayTemplate,
  goal: Profile['goal'],
  sessionMinutes: number,
  usage: Map<string, number>,
  opts: {
    ctx?: PickContext
    rotate?: boolean
    seed?: number
    /**
     * Movement patterns that SURVIVED trimming on earlier days of the week.
     * It has to be what survived, not what was picked: `usage` records a pick
     * the moment it is made, so a curl that was later trimmed off day 1 still
     * made day 3 believe biceps were covered — and biceps ended up with no
     * direct work in the whole week.
     */
    keptPatterns?: Set<MovementPattern>
    /** filled with the names of exercises the time budget forced out */
    trimmedOut?: string[]
  } = {},
): Picked[] {
  const usedInDay = new Set<string>()
  const ctx = opts.ctx ?? {}
  const rotate = opts.rotate === true
  const seed = opts.seed ?? 0

  // assemble slot list per goal: extra isolation for building, cardio finisher for cutting
  let slots: SlotSpec[] = [...t.slots]
  // v4 — at a location with real machines the day is RESHAPED, not just padded:
  // slots the machine work supersedes step aside, and the machine + isolation
  // slots land ahead of the base isolation work so that when the session-length
  // trim bites it takes the calf raise he can do anywhere, not the pec deck he
  // came to the gym for. Without this the plan has no slot for a leg extension
  // at all, so no lens over it could ever produce one.
  if (ctx.equipment && t.gymSlots?.length) {
    const have = new Set<AnyEquipment>(ctx.equipment.equipment)
    const here = (keys?: AnyEquipment[]) => !keys || keys.some((k) => have.has(k))
    const extra = t.gymSlots.filter((s) => here(s.requires))
    if (extra.length) {
      slots = slots.filter((s) => !(s.dropAtGym && here(s.dropAtGym)))
      const isoAt = slots.findIndex((s) => s.role === 'isolation' || s.role === 'core')
      slots.splice(isoAt === -1 ? slots.length : isoAt, 0, ...extra)
    }
  }
  if (goal === 'build-muscle') {
    const coreIdx = slots.findIndex((s) => s.role === 'core')
    slots.splice(coreIdx === -1 ? slots.length : coreIdx, 0, t.extraIso)
  }
  if (goal === 'lose-fat') slots.push({ muscles: ['cardio'], role: 'cardio' })

  const picked: Picked[] = []
  // the first compound of each movement pattern in a day is that pattern's
  // anchor and never rotates — see pickSlotForBlocks
  const anchored = new Set<MovementPattern>()
  for (const slot of slots) {
    const pk = pickSlotForBlocks(slot, usedInDay, usage, ctx, { rotate, seed, anchored })
    if (pk) picked.push(pk)
  }

  // sparse-registry backfill: guarantee ≥5 exercises per day. Tiered so we
  // reach for on-focus work first, then secondary-muscle matches, then (only
  // if the registry is still tiny) any least-used strength move at all.
  const backfillTiers: ((e: Exercise) => boolean)[] = [
    (e) => overlap(e.primary, t.focus),
    (e) => overlap(e.secondary, t.focus),
    () => true,
  ]
  for (const fits of backfillTiers) {
    if (picked.length >= 5) break
    const extras = EXERCISES.filter(
      (e) => e.kind === 'strength'
        && !usedInDay.has(e.id)
        && fits(e)
        && (!ctx.equipment || isAvailable(e, ctx.equipment)),
    ).sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0) || a.id.localeCompare(b.id))
    for (const ex of extras) {
      if (picked.length >= 5) break
      usedInDay.add(ex.id)
      usage.set(ex.id, (usage.get(ex.id) ?? 0) + 1)
      // keep the finisher last if one exists
      const at = picked.findIndex((x) => x.role === 'cardio')
      picked.splice(at === -1 ? picked.length : at, 0, { ex, role: roleOf(ex) })
    }
  }

  // session order: compounds → isolation → core → finisher
  const order: Record<Role, number> = { compound: 0, isolation: 1, core: 2, cardio: 3 }
  const ordered = picked
    .map((x, i) => ({ x, i }))
    .sort((a, b) => order[a.x.role] - order[b.x.role] || a.i - b.i)
    .map(({ x }) => x)
    // a gym day is allowed to be longer on paper — the time budget below is the
    // real arbiter, and it trims trailing isolation until the session fits
    .slice(0, ctx.equipment ? 9 : 7)

  // respect his session length: if the PEAK week would badly overrun, drop
  // trailing isolation volume (never compounds, core, or the finisher) — but
  // never below 5 exercises
  const budget = Math.max(35, sessionMinutes) + 10 // small grace over preference
  const estPeak = () => Math.round(ordered.reduce((s, pk) => s + peakWeekSeconds(pk), 0) / 60) + 8

  /**
   * How much it would cost the session to drop this isolation. Trimming purely
   * from the tail is how a gym leg day came out as three quad movements with the
   * leg curl and the calf raise cut off the end: inside its time budget, and with
   * no hamstring or calf work left in it.
   *
   * Muscle coverage alone isn't enough either — a Romanian deadlift and a leg
   * curl both list hamstrings, but a hip hinge and a knee curl are different
   * jobs, so the curl is not redundant just because the RDL is there.
   */
  /**
   * Has this movement pattern already been trained on an EARLIER day of the
   * week? `usage` spans the whole week; `usedInDay` is today's picks, so
   * anything in usage that isn't in usedInDay came from a previous day.
   *
   * Without this the two arm isolations score identically and the trimmer always
   * drops the later one — which is how every upper day ended up with triceps
   * work and no direct biceps work at all. Now they alternate across the week.
   */
  const patternTrainedEarlier = (pattern: MovementPattern): boolean =>
    opts.keptPatterns?.has(pattern) ?? false

  const keepScore = (pk: Picked, list: Picked[]): number => {
    const others = list.filter((x) => x !== pk)
    const focusPrimary = pk.ex.primary.filter((m) => t.focus.includes(m))
    const pattern = inferQuality(pk.ex).pattern
    let score = 0
    // the only work in the day for one of its focus muscles
    if (focusPrimary.some((m) => !others.some((x) => x.ex.primary.includes(m)))) score += 3
    // the only exercise doing this movement pattern
    if (!others.some((x) => inferQuality(x.ex).pattern === pattern)) score += 2
    // nothing else this week has trained this pattern yet — losing it loses it
    // from the whole week, not just from today
    if (!patternTrainedEarlier(pattern)) score += 2
    // its muscles are otherwise only hit by compounds — direct work still adds
    if (focusPrimary.some((m) => !others.some((x) => x.role === 'isolation' && x.ex.primary.includes(m)))) {
      score += 1
    }
    return score
  }

  /**
   * What the trimmer is allowed to take: any isolation, plus a compound that
   * merely repeats a movement pattern an earlier compound already covers.
   *
   * An hour will not hold belt squat + RDL + hack squat + leg extension + leg
   * curl + calves + core + a finisher. Something has to go, and a second squat
   * pattern is a better thing to lose than the only hamstring curl in the day —
   * the first compound of each pattern is never touched.
   */
  const trimmable = (list: Picked[]): Picked[] => {
    const seen = new Set<MovementPattern>()
    const out: Picked[] = []
    for (const pk of list) {
      const pattern = inferQuality(pk.ex).pattern
      if (pk.role === 'isolation') out.push(pk)
      else if (pk.role === 'compound') {
        if (seen.has(pattern)) out.push(pk)
        seen.add(pattern)
      }
    }
    return out
  }

  while (ordered.length > 5 && estPeak() > budget) {
    const candidates = trimmable(ordered)
    if (candidates.length === 0) break
    // drop the cheapest one — ties break towards the end of the session
    let cut = candidates[candidates.length - 1]
    let best = Infinity
    for (const pk of candidates) {
      const s = keepScore(pk, ordered)
      if (s <= best) {
        best = s
        cut = pk
      }
    }
    opts.trimmedOut?.push(cut.ex.name)
    ordered.splice(ordered.indexOf(cut), 1)
  }

  // record what actually survived, so the next day of the week can tell which
  // patterns still have no direct work in the plan
  if (opts.keptPatterns) {
    for (const pk of ordered) opts.keptPatterns.add(inferQuality(pk.ex).pattern)
  }
  return ordered
}

// ---------- load ladder (all via lib/plates → always achievable) ----------

// Working weight per week, or undefined for bodyweight/time. Foundations =
// start; step up once at Build and once at Peak (when the hardware allows a next
// load); Deload snaps ~60% of Peak to real plates.
const NO_LOADS: (number | undefined)[] = [undefined, undefined, undefined, undefined, undefined]

/**
 * v4 — the ladder for an exercise that first appears in week `firstWeek`.
 *
 * Rotation means an exercise can join the plan at week 3 (or only in the deload
 * week), and it would be dishonest to hand it the load of a lift he has already
 * been driving up for a fortnight. So the ladder always STARTS where the
 * exercise starts: week `firstWeek` gets the computed starting load, and the
 * same step-up points (entering Build and Peak) apply from there. Every rung
 * still comes from lib/plates and is buildable on the hardware in `src`.
 *
 * firstWeek = 0 reproduces the original five-week ladder exactly.
 */
function loadLadderFrom(
  ex: Exercise,
  p: Profile,
  firstWeek: number,
  eq?: EquipmentProfile,
): (number | undefined)[] {
  if (ex.loadMode === 'bodyweight' || ex.loadMode === 'time') return [...NO_LOADS]
  const src: LoadSource = eq ?? p
  const mode: AnyLoadMode = eq ? (effectiveLoadMode(ex, eq) ?? ex.loadMode) : ex.loadMode

  const mult = EXPERIENCE_MULT[p.experience] ?? 1
  const desired = p.weightKg * (ex.startFactor ?? 0.3) * mult
  const start = nearestLoad(mode, desired, src)
  if (!start) return [...NO_LOADS]

  const out: (number | undefined)[] = [...NO_LOADS]
  const from = Math.max(0, Math.min(4, Math.round(firstWeek) || 0))
  let cur = start.totalKg
  for (let w = from; w <= 4; w++) {
    if (w === 4) {
      // deload — ~60% of the last working load, re-snapped to real plates
      out[4] = nearestLoad(mode, cur * 0.6, src)?.totalKg ?? cur
      break
    }
    if (w > from && STEP_WEEKS.has(w)) cur = nextLoadUp(mode, cur, src) ?? cur // stay put if maxed out
    out[w] = cur
  }
  return out
}

/** Working weight per week for one exercise, starting at week 1. */
function loadLadder(ex: Exercise, p: Profile, eq?: EquipmentProfile): (number | undefined)[] {
  return loadLadderFrom(ex, p, 0, eq)
}

// ---------- per-week prescription ----------

/** rep range for week w: hi end shaved as intensity climbs, deload back to base */
function repsForWeek(base: [number, number], w: number): [number, number] {
  const [lo, hi] = base
  const shavedHi = Math.max(lo + 2, hi - REP_SHIFT_BY_WEEK[w])
  const clampedLo = Math.max(3, Math.min(lo, shavedHi - 2))
  return [clampedLo, shavedHi]
}

const DEFAULT_REPS: Record<Role, [number, number]> = {
  compound: [6, 10],
  isolation: [10, 15],
  core: [10, 15],
  cardio: [1, 1],
}

/** build one PlanExercise for week w (0-based) */
function prescribe(pk: Picked, w: number, loads: (number | undefined)[]): PlanExercise {
  const { ex, role } = pk
  const timed = ex.loadMode === 'time'

  // sets — timed finishers are one continuous effort; rep-based ones (burpees) get rounds
  let sets: number
  if (role === 'cardio') sets = timed ? 1 : 3
  else if (role === 'core') sets = w === 4 ? 2 : Math.min(SETS_BY_WEEK[w], 3)
  else sets = SETS_BY_WEEK[w]

  // reps / time
  let reps: [number, number]
  if (timed) reps = [1, 1]
  else if (role === 'cardio') reps = ex.repRange ?? [12, 20] // no weekly rep shaving for conditioning
  else reps = repsForWeek(ex.repRange ?? DEFAULT_REPS[role], w)
  let timeSec: number | undefined
  if (timed) timeSec = role === 'cardio' ? CARDIO_TIME[w] : CORE_TIME[w]

  // rest
  const restSec =
    role === 'compound' ? REST_COMPOUND[w]
    : role === 'isolation' ? REST_ISOLATION[w]
    : role === 'cardio' ? 60
    : REST_CORE[w]

  const px: PlanExercise = { exerciseId: ex.id, sets, reps, restSec }
  // the slot's other valid options, minus whatever is prescribed this week
  const alts = (pk.pool ?? []).filter((c) => c.id !== ex.id).map((c) => c.id)
  if (alts.length > 0) px.pool = alts
  if (timeSec !== undefined) px.timeSec = timeSec
  const weight = loads[w]
  if (weight !== undefined) px.weightKg = weight

  // short practical coaching cues, no fluff
  if (w === 4) px.note = 'Deload — light, crisp reps. Bank recovery for the next block.'
  else if (role === 'cardio') px.note = 'Finisher — steady pace, nose-breathe, shake it out after.'
  else if (role === 'compound' && w === 3) px.note = 'Peak week — brace hard, leave 1 rep in the tank.'

  return px
}

// ---------- day materialisation ----------

/** Why an accessory changed this block — stated plainly, in his own session. */
function rotationNote(from: Exercise, to: Exercise, deload: boolean): string {
  if (deload) {
    return `Deload — ${to.name} instead of ${from.name} this week: easier on the joints while you bank recovery.`
  }
  return `New this block — ${to.name} replaces ${from.name}. Accessories rotate so the muscle gets a fresh angle; your main lifts stay put so the weight on them still means something.`
}

function materialiseDay(
  t: DayTemplate,
  picks: Picked[],
  ladders: Map<string, (number | undefined)[]>,
  w: number,
  p: Profile,
  trimmed: string[] = [],
): PlanDay {
  const weekPicks: Picked[] = picks.map((pk) => ({
    ex: exerciseForWeek(pk, w), role: pk.role, pool: pk.pool,
  }))

  const exercises = weekPicks.map((pk, i) => {
    const px = prescribe(pk, w, ladders.get(pk.ex.id) ?? NO_LOADS)
    // first week of a rotated-in exercise: say what it replaced and why
    const prev = w > 0 ? exerciseForWeek(picks[i], w - 1) : null
    if (prev && prev.id !== pk.ex.id) px.note = rotationNote(prev, pk.ex, w === 4)
    return px
  })

  // time: per set (work + rest), timed sets use their real duration; + warm-up
  const workSeconds = exercises.reduce(
    (sum, px) => sum + px.sets * ((px.timeSec ?? 45) + px.restSec),
    0,
  )
  const estMinutes = Math.round(workSeconds / 60) + 8

  // calories: average MET across the session over its duration
  const mets = weekPicks.map((pk) => pk.ex.met ?? 5)
  const avgMet = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : 5
  const estCalories = metCalories(avgMet, p.weightKg, estMinutes * 60)

  const day: PlanDay = {
    id: newId(),
    title: t.title,
    focus: [...t.focus],
    exercises,
    estMinutes,
    estCalories,
  }
  // say what the session-length budget pushed out, rather than dropping it silently
  if (trimmed.length > 0) day.trimmed = [...new Set(trimmed)]
  return day
}

// ---------- public API ----------

const GOAL_LABEL: Record<Profile['goal'], string> = {
  'lose-fat': 'Shred',
  'build-muscle': 'Build',
  recomp: 'Recomp',
}

/** v4 — where (and how varied) a generated plan should be. */
export interface GeneratePlanOptions {
  /**
   * Build the plan FOR this location: only exercises available there are
   * selected, ranking prefers the best option that room offers, and the day
   * templates grow their machine slots. Omit for the original behaviour.
   */
  equipment?: EquipmentProfile
  /** nudges which of several equally good accessory variants comes up */
  seed?: number
  /**
   * v10 (owner, 23 Oct 2026): program length in weeks (1-16). Up to 5 takes the
   * first weeks of the usual wave; longer repeats the 5-week wave as new blocks,
   * each block one load step heavier on loaded lifts. Omit for the classic 5.
   */
  weeks?: number
}

/**
 * Generate the full 5-week progressive plan for the profile.
 * Pure aside from ids/dates — screens Dexie-save the result themselves.
 *
 * `generatePlan(p)` with no options behaves exactly as it always has: whole
 * registry, one exercise selection shared by all five weeks, no rotation.
 * Passing options turns on v4: location-aware selection and block rotation.
 */
export function generatePlan(p: Profile, opts?: GeneratePlanOptions): Plan {
  const eq = opts?.equipment
  const rotate = !!opts // opting in at all opts into the varied plan
  const seed = opts?.seed ?? 0
  const templates = templatesFor(p.daysPerWeek)

  // 1) resolve each day's slots — anchors once for the whole plan, accessories
  //    once per variation block
  const usage = new Map<string, number>()
  // patterns that survived trimming on earlier days — see selectDayExercises
  const keptPatterns = new Set<MovementPattern>()
  const dayTrimmed: string[][] = templates.map(() => [])
  const dayPicks = templates.map((t, i) =>
    selectDayExercises(t, p.goal, p.sessionMinutes, usage, {
      ctx: { equipment: eq }, rotate, seed, keptPatterns, trimmedOut: dayTrimmed[i],
    }))

  // 2) load ladders. An exercise that only joins at week 3 starts its ladder at
  //    week 3, so a rotated-in lift is never handed a fortnight of progression
  //    it did not earn.
  const firstWeekOf = new Map<string, number>()
  for (const picks of dayPicks) {
    for (const pk of picks) {
      const blocks = pk.byBlock ?? [pk.ex]
      blocks.forEach((ex, b) => {
        const w = BLOCK_FIRST_WEEK[b] ?? 0
        const prev = firstWeekOf.get(ex.id)
        if (prev === undefined || w < prev) firstWeekOf.set(ex.id, w)
      })
    }
  }
  const ladders = new Map<string, (number | undefined)[]>()
  for (const picks of dayPicks) {
    for (const pk of picks) {
      for (const ex of pk.byBlock ?? [pk.ex]) {
        if (!ladders.has(ex.id)) {
          ladders.set(ex.id, loadLadderFrom(ex, p, firstWeekOf.get(ex.id) ?? 0, eq))
        }
      }
    }
  }

  // 3) materialise the 5 weeks
  const weeks: PlanWeek[] = WEEK_LABELS.map((label, w) => ({
    index: w + 1,
    label,
    days: templates.map((t, d) => materialiseDay(t, dayPicks[d], ladders, w, p, dayTrimmed[d])),
  }))

  const total = opts?.weeks === undefined ? 5 : Math.max(1, Math.min(16, Math.round(opts.weeks)))
  const allWeeks = total === 5 ? weeks : extendWeeks(weeks, total, p, eq)
  const base = `${total}-Week ${splitLabel(p.daysPerWeek)} ${GOAL_LABEL[p.goal] ?? ''}`.trim()
  const plan: Plan = {
    id: newId(),
    name: eq ? `${base} · ${eq.name}` : base,
    weeks: allWeeks,
    startDate: todayStr(),
    trainingWeekdays: pickTrainingDays(p),
    active: true,
    createdAt: nowIso(),
  }
  if (eq) plan.equipmentProfileId = eq.id
  return plan
}

/**
 * Lay the 5-week wave out over `total` weeks: week i uses wave week i % 5, and
 * every repeat of the wave (a new block) sits one buildable load step heavier.
 */
function extendWeeks(wave: PlanWeek[], total: number, p: Profile, eq?: EquipmentProfile): PlanWeek[] {
  const src: LoadSource = eq ?? p
  const stepUp = (px: PlanExercise, steps: number): PlanExercise => {
    const ex = byId.get(px.exerciseId)
    if (!ex || px.weightKg === undefined || steps <= 0) return { ...px }
    const mode: AnyLoadMode = eq ? (effectiveLoadMode(ex, eq) ?? ex.loadMode) : ex.loadMode
    let cur = px.weightKg
    for (let i = 0; i < steps; i++) cur = nextLoadUp(mode, cur, src) ?? cur
    return { ...px, weightKg: cur }
  }
  return Array.from({ length: total }, (_, i) => {
    const block = Math.floor(i / wave.length)
    const w = wave[i % wave.length]
    return {
      index: i + 1,
      label: block ? `${w.label} · block ${block + 1}` : w.label,
      days: w.days.map((d) => ({ ...d, id: newId(), exercises: d.exercises.map((px) => stepUp(px, block)) })),
    }
  })
}

// ---------- calendar mapping ----------

export interface PlanDayRef {
  week: PlanWeek
  day: PlanDay
  /** index into week.days */
  dayIndex: number
}

/**
 * Map a calendar date ('YYYY-MM-DD') onto the plan.
 * Training weekdays cycle through that week's days array in order; the week
 * index advances every 7 days from startDate and clamps to the last week
 * (so the program stays useful past week 5 until it's regenerated).
 * Returns null for rest days and dates before the plan started.
 */
export function dayForDate(plan: Plan, dateStr: string): PlanDayRef | null {
  if (!plan.weeks.length || !plan.trainingWeekdays.length) return null

  const date = dayjs(dateStr)
  const start = dayjs(plan.startDate)
  if (!date.isValid() || !start.isValid()) return null

  const diffDays = date.startOf('day').diff(start.startOf('day'), 'day')
  if (diffDays < 0) return null // plan hasn't started yet

  const weekdays = [...plan.trainingWeekdays].sort((a, b) => a - b)
  const slot = weekdays.indexOf(date.day())
  if (slot === -1) return null // rest day

  const weekIdx = Math.min(Math.floor(diffDays / 7), plan.weeks.length - 1)
  const week = plan.weeks[weekIdx]
  if (!week || !week.days.length) return null

  const dayIndex = slot % week.days.length
  return { week, day: week.days[dayIndex], dayIndex }
}

// ============================================================
// COACH PROGRAMS — ADDITIVE LAYER (v2).
//
// Nothing above this line changed: generatePlan, dayForDate and WEEK_LABELS
// behave exactly as they always have. Everything below sits ON TOP of that
// machinery — the same slot templates, the same plate-safe load ladders, the
// same session ordering — and simply lets a coach's ranked picks and
// set/rep/rest prescription choose what goes in the slots.
//
// Integrity: the coaches are principle-faithful interpretations written in our
// own words (see data/coaches.ts). No paid program is reproduced here.
// ============================================================

/** Labels for a coach block week, by phase. */
export const COACH_PHASE_LABELS = ['Foundations', 'Build', 'Peak', 'Deload'] as const

/** Coach phase → the index used by the existing 5-week ladders/rest tables. */
const COACH_PHASE_TO_WEEK = [0, 1, 3, 4]
/** Sets added to (or taken off) the coach's base prescription, by phase. */
const COACH_SET_DELTA = [-1, 0, 1, -2]

/** Block lengths the Programs screen offers. */
export const COACH_BLOCK_WEEKS = [4, 8, 12] as const

/** Phase (0-3) for a 0-based week index: 3 weeks building, then a deload. */
export function coachPhaseFor(weekIndex0: number): number {
  const n = Math.floor(weekIndex0)
  return ((n % 4) + 4) % 4
}

/** Monday (YYYY-MM-DD) of the week containing `dateStr`. Safe on bad input. */
export function mondayOf(dateStr: string): string {
  const d = dayjs(dateStr)
  if (!d.isValid()) return dateStr
  const dow = d.day() // 0 = Sunday
  return d.subtract(dow === 0 ? 6 : dow - 1, 'day').format('YYYY-MM-DD')
}

function coachById(id: CoachId | string | null | undefined): Coach | null {
  if (!id) return null
  return (COACHES as Record<string, Coach | undefined>)[id] ?? null
}

// ---------- coach prescription ----------

/** Build one PlanExercise from the coach's own set/rep/rest prescription. */
function prescribeCoach(
  pk: Picked,
  phase: number,
  loads: (number | undefined)[],
  coach: Coach,
  why?: string,
): PlanExercise {
  const { ex, role } = pk
  const w = COACH_PHASE_TO_WEEK[phase] ?? 1

  // conditioning finishers keep the generic treatment — no coach prescribes them
  if (role === 'cardio') {
    const px = prescribe(pk, w, loads)
    if (why) px.reason = why
    return px
  }

  const base =
    role === 'core' ? coach.prescription.core
    : role === 'compound' ? coach.prescription.compound
    : coach.prescription.isolation

  const timed = ex.loadMode === 'time'
  const sets = Math.max(2, base.sets + (COACH_SET_DELTA[phase] ?? 0))
  const reps: [number, number] = timed ? [1, 1] : [base.reps[0], base.reps[1]]

  const px: PlanExercise = { exerciseId: ex.id, sets, reps, restSec: base.restSec }
  if (timed) px.timeSec = role === 'core' ? CORE_TIME[w] : CARDIO_TIME[w]
  const weight = loads[w]
  if (weight !== undefined) px.weightKg = weight

  px.note = phase === 3
    ? 'Deload — same movement, half the effort. This week is recovery, not a test.'
    : base.note
  if (why) px.reason = why
  return px
}

/** Session length + calorie estimate, same arithmetic the plan generator uses. */
function estimateSession(
  exercises: PlanExercise[],
  picks: Picked[],
  p: Profile,
): { estMinutes: number; estCalories: number } {
  const workSeconds = exercises.reduce(
    (sum, px) => sum + px.sets * ((px.timeSec ?? 45) + px.restSec),
    0,
  )
  const estMinutes = Math.round(workSeconds / 60) + 8
  const mets = picks.map((pk) => pk.ex.met ?? 5)
  const avgMet = mets.length ? mets.reduce((a, b) => a + b, 0) / mets.length : 5
  return { estMinutes, estCalories: metCalories(avgMet, p.weightKg, estMinutes * 60) }
}

// ---------- coach exercise selection ----------

/**
 * Fill a day template with THIS coach's ranked picks for the muscle groups the
 * day trains, walking down each group's list round by round so the top pick of
 * every group lands before anyone's second choice. Falls back to the generic
 * slot engine if a coach list runs dry, so a day is never short.
 */
function selectCoachDayExercises(
  t: DayTemplate,
  coach: Coach,
  p: Profile,
  usage: Map<string, number>,
): Picked[] {
  const usedInDay = new Set<string>()
  const picked: Picked[] = []

  const groups: MuscleGroup[] = groupsForMuscles(t.focus)
  const pools = new Map<MuscleGroup, Exercise[]>()
  for (const g of groups) pools.set(g, coachPicks(coach, g).map((rp) => rp.exercise))

  const target = Math.max(5, Math.min(8, t.slots.length + (p.goal === 'build-muscle' ? 1 : 0)))

  for (let round = 0; round < 6 && picked.length < target; round++) {
    for (const g of groups) {
      if (picked.length >= target) break
      const pool = pools.get(g) ?? []
      // least-used across the plan first (stable sort keeps the coach's ranking
      // for ties) → repeated templates reach for different variants
      const next = pool
        .filter((e) => !usedInDay.has(e.id))
        .sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))[0]
      if (!next) continue
      usedInDay.add(next.id)
      usage.set(next.id, (usage.get(next.id) ?? 0) + 1)
      picked.push({ ex: next, role: roleOf(next) })
    }
  }

  // backfill from the generic engine — a sparse coach list must never shorten a day
  for (const slot of t.slots) {
    if (picked.length >= 5) break
    const ex = pickForSlot(slot, usedInDay, usage)
    if (ex) picked.push({ ex, role: roleOf(ex) })
  }

  if (p.goal === 'lose-fat') {
    const ex = pickForSlot({ muscles: ['cardio'], role: 'cardio' }, usedInDay, usage)
    if (ex) picked.push({ ex, role: roleOf(ex) })
  }

  const order: Record<Role, number> = { compound: 0, isolation: 1, core: 2, cardio: 3 }
  return picked
    .map((x, i) => ({ x, i }))
    .sort((a, b) => order[a.x.role] - order[b.x.role] || a.i - b.i)
    .map(({ x }) => x)
}

// ---------- a single coach session (used by day / week overrides) ----------

export interface CoachSession {
  title: string
  exercises: PlanExercise[]
  estMinutes: number
  estCalories: number
}

/**
 * Build one session the coach's way for a given day title + focus, WITHOUT
 * touching the saved plan. This is what a 'day' or 'week' ProgramOverride
 * stores, so his own split and day titles are preserved.
 */
export function buildCoachSession(
  coachId: CoachId | string,
  p: Profile,
  opts: { title: string; focus: Muscle[]; phase?: number },
): CoachSession | null {
  const coach = coachById(coachId)
  if (!coach) return null

  const focus: Muscle[] = opts.focus?.length
    ? opts.focus
    : (['chest', 'lats', 'quads', 'abs'] as Muscle[])

  // a light template so the generic backfill still has slots to reach for
  const template: DayTemplate = {
    title: opts.title,
    focus,
    slots: focus.map((m, i) => ({
      muscles: [m],
      role: i < 2 ? ('compound' as const) : ('isolation' as const),
    })),
    extraIso: { muscles: focus, role: 'isolation' },
  }

  const usage = new Map<string, number>()
  const picks = selectCoachDayExercises(template, coach, p, usage)
  if (!picks.length) return null

  const phase = opts.phase ?? 1
  const why = coachWhyMap(coach)
  const exercises = picks.map((pk) =>
    prescribeCoach(pk, phase, loadLadder(pk.ex, p), coach, why.get(pk.ex.id)),
  )

  return { title: opts.title, exercises, ...estimateSession(exercises, picks, p) }
}

// ---------- a full coach block (a real Plan) ----------

/**
 * Generate a 4 / 8 / 12-week block in a coach's style. Reuses the plan
 * generator's split templates, load ladders and session ordering; only the
 * exercise choices and the set/rep/rest prescription come from the coach.
 * The caller saves it and deactivates (never deletes) the previous plan.
 */
export function generateCoachPlan(
  p: Profile,
  coachId: CoachId | string,
  blockWeeks: number,
): Plan | null {
  const coach = coachById(coachId)
  if (!coach) return null

  const requested = Math.round(blockWeeks)
  const weeksN = (COACH_BLOCK_WEEKS as readonly number[]).includes(requested) ? requested : 8

  const templates = templatesFor(p.daysPerWeek)

  const usage = new Map<string, number>()
  const dayPicks = templates.map((t) => selectCoachDayExercises(t, coach, p, usage))

  const ladders = new Map<string, (number | undefined)[]>()
  for (const picks of dayPicks) {
    for (const pk of picks) {
      if (!ladders.has(pk.ex.id)) ladders.set(pk.ex.id, loadLadder(pk.ex, p))
    }
  }

  const why = coachWhyMap(coach)
  const NO_LOAD: (number | undefined)[] = [undefined, undefined, undefined, undefined, undefined]

  const weeks: PlanWeek[] = Array.from({ length: weeksN }, (_, w) => {
    const phase = coachPhaseFor(w)
    return {
      index: w + 1,
      label: COACH_PHASE_LABELS[phase],
      days: templates.map((t, d) => {
        const picks = dayPicks[d]
        const exercises = picks.map((pk) =>
          prescribeCoach(pk, phase, ladders.get(pk.ex.id) ?? NO_LOAD, coach, why.get(pk.ex.id)),
        )
        const day: PlanDay = {
          id: newId(),
          title: t.title,
          focus: [...t.focus],
          exercises,
          ...estimateSession(exercises, picks, p),
        }
        return day
      }),
    }
  })

  return {
    id: newId(),
    name: `${weeksN}-Week ${coach.name} ${splitLabel(p.daysPerWeek)}`,
    weeks,
    startDate: todayStr(),
    trainingWeekdays: pickTrainingDays(p),
    active: true,
    createdAt: nowIso(),
    coach: coach.id,
    sourceLabel: coach.shortCredit,
    blockWeeks: weeksN,
  }
}

// ---------- program overrides → the session actually being trained ----------

/**
 * Defensive copy of an override with unknown exercise ids stripped.
 * Returns null when the record is malformed or nothing usable survives — a
 * stale override must never break the Today screen.
 */
export function sanitiseOverride(raw: unknown): ProgramOverride | null {
  try {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Partial<ProgramOverride>
    if (o.scope !== 'day' && o.scope !== 'week') return null
    if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null
    if (!Array.isArray(o.exercises)) return null

    const exercises = o.exercises.filter(
      (e): e is PlanExercise =>
        Boolean(e)
        && typeof (e as PlanExercise).exerciseId === 'string'
        && byId.has((e as PlanExercise).exerciseId)
        && Array.isArray((e as PlanExercise).reps),
    )
    if (!exercises.length) return null

    return {
      id: typeof o.id === 'string' ? o.id : '',
      coach: (o.coach ?? 'cbum') as CoachId,
      scope: o.scope,
      date: o.date,
      exercises,
      title: typeof o.title === 'string' && o.title ? o.title : 'Coach session',
      note: typeof o.note === 'string' ? o.note : undefined,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : nowIso(),
    }
  } catch {
    return null
  }
}

export interface EffectiveDay {
  title: string
  exercises: PlanExercise[]
  estMinutes: number
  estCalories: number
  /** where this session came from */
  source: 'plan' | 'override'
  coach?: CoachId
  overrideId?: ID
  overrideScope?: 'day' | 'week'
  note?: string
  /** the plan's own day for this date, when the plan has one (kept untouched) */
  planRef: PlanDayRef | null
}

/**
 * The session actually being trained on a date.
 *
 * Resolution order: a 'day' override for that exact date → a 'week' override
 * anchored on that week's Monday → the plan's own day (dayForDate).
 *
 * A week override only lands on days the plan already trains, so his split
 * survives. Everything is wrapped defensively: a malformed or stale override
 * degrades to the plan, and a broken plan degrades to null — never a throw.
 */
export function effectiveDayForDate(
  plan: Plan | null | undefined,
  dateStr: string,
  overrides?: readonly unknown[] | null,
): EffectiveDay | null {
  let planRef: PlanDayRef | null = null
  try {
    planRef = plan ? dayForDate(plan, dateStr) : null
  } catch {
    planRef = null
  }

  let hit: ProgramOverride | null = null
  try {
    const list = (Array.isArray(overrides) ? overrides : [])
      .map(sanitiseOverride)
      .filter((o): o is ProgramOverride => o !== null)

    const monday = mondayOf(dateStr)
    hit = list.find((o) => o.scope === 'day' && o.date === dateStr) ?? null
    if (!hit) {
      // week scope: one record per plan-day title it stands in for, all anchored
      // on that week's Monday. Match the title so his split is preserved.
      const weekList = list.filter((o) => o.scope === 'week' && o.date === monday)
      const weekHit =
        (planRef ? weekList.find((o) => o.title === planRef!.day.title) : null)
        ?? weekList[0]
        ?? null
      // a week-scoped swap keeps his split: rest days stay rest days
      if (weekHit && (!plan || planRef)) hit = weekHit
    }
  } catch {
    hit = null
  }

  if (hit) {
    const workSeconds = hit.exercises.reduce(
      (s, px) => s + (px.sets || 1) * ((px.timeSec ?? 45) + (px.restSec ?? 60)),
      0,
    )
    const estMinutes = Math.round(workSeconds / 60) + 8
    return {
      title: hit.title,
      exercises: hit.exercises,
      estMinutes,
      estCalories: planRef?.day.estCalories ?? 0,
      source: 'override',
      coach: hit.coach,
      overrideId: hit.id || undefined,
      overrideScope: hit.scope,
      note: hit.note,
      planRef,
    }
  }

  if (!planRef) return null
  return {
    title: planRef.day.title,
    exercises: planRef.day.exercises,
    estMinutes: planRef.day.estMinutes,
    estCalories: planRef.day.estCalories,
    source: 'plan',
    planRef,
  }
}
