// ============================================================
// Equipment profiles + the substitution engine.
//
// "Training at: Home / Flex" swaps the session in place — same muscles, same
// sets, exercises swapped for whatever that location actually has. Every swap
// is explainable ("no cable at home → smith machine row"), because a silent
// substitution is indistinguishable from a bug.
// ============================================================

import { db } from '@/db'
import { profileFromLegacy } from '@/db/defaults'
import type {
  AnyEquipment, EquipmentProfile, Exercise, PlanExercise, Profile,
} from '@/db/types'
import { equipmentLabel } from '@/db/types'
import { byId, EXERCISES } from '@/data/exercises'
import { nowIso } from './id'
import { ed } from './edition'

export const HOME_PROFILE_ID = 'home'
export const GYM_PROFILE_ID = 'flex'

const HOME_EQUIPMENT: AnyEquipment[] = [
  'barbell', 'curl-bar', 'smith', 'cable-high', 'cable-low', 'cable-mid',
  'lat-pulldown', 'low-row', 'pullup-bar', 'dip-handles', 'bench',
  'suspension', 'jump-rope', 'bodyweight', 'plate',
]

const GYM_EQUIPMENT: AnyEquipment[] = [
  // Flex 24/7 is a full commercial gym — it is NOT a limited subset of anything.
  // Every key the app knows about is available there.
  ...HOME_EQUIPMENT,
  'dumbbell', 'cable-station', 'leg-press', 'hack-squat', 'pendulum-squat',
  'leg-extension', 'seated-leg-curl', 'lying-leg-curl', 'chest-press-machine',
  'pec-deck', 'shoulder-press-machine', 'seated-row-machine', 'chest-supported-row',
  'assisted-pullup', 'preacher-bench', 'calf-raise-machine', 'hip-thrust-machine',
  'adductor-machine', 'abductor-machine', 'ab-machine', 't-bar-row', 'landmine',
  'kettlebell', 'trap-bar', 'treadmill', 'stair-climber', 'rower', 'bike', 'sled',
  'plate-loaded-machine', 'back-extension-bench',
  'vertical-leg-press', 'lateral-raise-machine', 'biceps-machine', 'triceps-machine',
  'air-bike', 'ski-erg', 'elliptical', 'curved-treadmill',
  'resistance-band', 'medicine-ball', 'plyo-box', 'agility-ladder', 'boxing-bag',
  'deadlift-platform',
]

/**
 * A commercial floor has MANY plates. platePairsKg lists one entry per PAIR, so
 * repeats are how "four pairs of 20s" is expressed. The v1 default had one pair
 * of each size, which capped the barbell at 177.5 kg — too low for a deadlift PR.
 */
/** v10: his gym racks only have 5, 10, 15 and 20 kg plates (no 25s, no 2.5s) — several pairs of each. */
const GYM_PLATE_PAIRS = [20, 20, 20, 20, 15, 15, 15, 10, 10, 10, 5, 5, 5]
const V6_GYM_PLATE_PAIRS = [25, 25, 25, 25, 20, 20, 20, 20, 15, 15, 10, 10, 5, 5, 2.5, 2.5, 1.25, 1.25]
const OLD_GYM_PLATES = [1.25, 2.5, 5, 10, 15, 20, 25]
/** Selectorised stacks and plate-loaded machines (leg press/hack) — 2.5 kg steps to 300. */
const GYM_STACK = Array.from({ length: 120 }, (_, i) => (i + 1) * 2.5)
const OLD_GYM_STACK = Array.from({ length: 20 }, (_, i) => (i + 1) * 5)
const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/** Standard commercial-gym dumbbell rack: 2.5kg jumps to 10, then 2.5s to 40+. */
const GYM_DUMBBELLS = [
  2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 45, 50,
]

export function builtInProfiles(p?: Profile | null): EquipmentProfile[] {
  const ts = nowIso()
  const home: EquipmentProfile = p
    ? profileFromLegacy(p)
    : {
        id: HOME_PROFILE_ID, name: 'Home', builtIn: true, equipment: HOME_EQUIPMENT,
        barbellKg: 20, curlBarKg: 10, smithBarKg: 15, platePairsKg: [5, 10, 15, 20],
        dumbbellsKg: [], stackStepsKg: [6, 11, 17, 22, 28, 34, 39, 45, 51, 56, 62, 68, 74],
        minIncrementKg: 5, createdAt: ts, updatedAt: ts,
      }
  const gym: EquipmentProfile = {
    id: GYM_PROFILE_ID,
    name: ed('Flex 24/7', 'Gym'),
    builtIn: true,
    equipment: GYM_EQUIPMENT,
    barbellKg: 20,
    curlBarKg: 10,
    smithBarKg: 15,
    platePairsKg: GYM_PLATE_PAIRS,
    dumbbellsKg: GYM_DUMBBELLS,
    stackStepsKg: GYM_STACK,
    minIncrementKg: 10,
    createdAt: ts,
    updatedAt: ts,
  }
  return [home, gym]
}

/**
 * Create the built-in profiles if the table is empty. Safe to call repeatedly.
 *
 * The BUILT-IN gym profile is also topped up to the full commercial-gym list on
 * every call. A row saved before a key existed would otherwise hide every
 * exercise tagged with it — which is how Flex quietly lost machines it has.
 * Flex is defined as "a full commercial gym", so keeping it complete is the
 * whole point of it; only the built-in row is touched, and only ever by adding,
 * so a custom profile of his own keeps exactly what he put in it.
 */
export async function ensureEquipmentProfiles(): Promise<EquipmentProfile[]> {
  const existing = await db.equipmentProfiles.toArray()
  if (existing.length > 0) {
    const gym = existing.find((p) => p.id === GYM_PROFILE_ID && p.builtIn)
    const missing = gym ? GYM_EQUIPMENT.filter((k) => !gym.equipment.includes(k)) : []
    // v6: lift the built-in row off the old one-pair-of-each plate set and the
    // 100 kg stack cap — but ONLY if it still holds those exact old defaults.
    const sortedPlates = gym ? [...gym.platePairsKg].sort((x, y) => x - y) : []
    const oldPlates = gym ? same(sortedPlates, OLD_GYM_PLATES) || same(sortedPlates, [...V6_GYM_PLATE_PAIRS].sort((x, y) => x - y)) : false
    const oldStack = gym ? same(gym.stackStepsKg, OLD_GYM_STACK) : false
    if (gym && (missing.length > 0 || oldPlates || oldStack)) {
      const topped: EquipmentProfile = {
        ...gym,
        equipment: [...gym.equipment, ...missing],
        ...(oldPlates ? { platePairsKg: GYM_PLATE_PAIRS, minIncrementKg: 10 } : {}),
        ...(oldStack ? { stackStepsKg: GYM_STACK } : {}),
        updatedAt: nowIso(),
      }
      await db.equipmentProfiles.put(topped)
      return existing.map((p) => (p.id === topped.id ? topped : p))
    }
    return existing
  }
  const profile = await db.profile.get('me')
  const seeded = builtInProfiles(profile)
  await db.equipmentProfiles.bulkPut(seeded)
  return seeded
}

export async function getCurrentProfile(): Promise<EquipmentProfile> {
  const profiles = await ensureEquipmentProfiles()
  const me = await db.profile.get('me')
  const id = me?.equipmentProfileId ?? HOME_PROFILE_ID
  return profiles.find((p) => p.id === id) ?? profiles[0]
}

export async function setCurrentProfile(id: string): Promise<void> {
  const me = await db.profile.get('me')
  if (!me) return
  await db.profile.put({ ...me, equipmentProfileId: id, updatedAt: nowIso() })
}

// ---------- availability ----------
export function isAvailable(ex: Exercise, profile: EquipmentProfile): boolean {
  const have = new Set<AnyEquipment>(profile.equipment)
  // an exercise is doable when EVERY piece of kit it needs is present
  return ex.equipment.every((e) => have.has(e) || e === 'bodyweight')
}

export function availableExercises(profile: EquipmentProfile): Exercise[] {
  return EXERCISES.filter((ex) => isAvailable(ex, profile))
}

// ---------- substitution ----------
export interface SwapResult {
  exercise: Exercise
  /** null when the original was already available */
  swappedFrom?: Exercise
  reason?: string
}

function sharedMuscleScore(a: Exercise, b: Exercise): number {
  const ap = new Set(a.primary)
  const as = new Set(a.secondary)
  let score = 0
  for (const m of b.primary) if (ap.has(m)) score += 10
  for (const m of b.primary) if (as.has(m)) score += 3
  for (const m of b.secondary) if (ap.has(m)) score += 3
  for (const m of b.secondary) if (as.has(m)) score += 1
  if (a.kind === b.kind) score += 4
  if (a.loadMode === b.loadMode) score += 2
  return score
}

/** A short, honest explanation of why a swap happened. */
function explainSwap(from: Exercise, to: Exercise, profile: EquipmentProfile): string {
  const have = new Set<AnyEquipment>(profile.equipment)
  const missing = from.equipment.filter((e) => !have.has(e) && e !== 'bodyweight')
  const missingLabel = missing.map(equipmentLabel).join(' / ')
  const gained = to.equipment.find((e) => !from.equipment.includes(e))
  if (missingLabel && gained) return `no ${missingLabel.toLowerCase()} here → ${equipmentLabel(gained).toLowerCase()}`
  if (missingLabel) return `no ${missingLabel.toLowerCase()} here`
  return `swapped for ${profile.name}`
}

/**
 * Best available stand-in for an exercise on a given profile.
 * Order: the exercise itself → its ranked substitutes/alternatives →
 * best muscle match from everything available.
 */
export function bestSubstitute(exerciseId: string, profile: EquipmentProfile): SwapResult | null {
  const original = byId.get(exerciseId)
  if (!original) return null
  if (isAvailable(original, profile)) return { exercise: original }

  const ranked = [...(original.substitutes ?? []), ...(original.alternatives ?? [])]
  for (const id of ranked) {
    const cand = byId.get(id)
    if (cand && isAvailable(cand, profile)) {
      return { exercise: cand, swappedFrom: original, reason: explainSwap(original, cand, profile) }
    }
  }

  let best: Exercise | null = null
  let bestScore = 0
  for (const cand of availableExercises(profile)) {
    if (cand.id === original.id) continue
    const score = sharedMuscleScore(original, cand)
    if (score > bestScore) {
      best = cand
      bestScore = score
    }
  }
  if (!best || bestScore < 10) return null
  return { exercise: best, swappedFrom: original, reason: explainSwap(original, best, profile) }
}

export interface AdaptedExercise extends PlanExercise {
  swapNote?: string
}

export interface AdaptResult {
  exercises: AdaptedExercise[]
  swaps: { from: string; to: string; reason: string }[]
  /** exercises with no viable stand-in at this location */
  dropped: string[]
}

/**
 * Re-point a day's exercises at a different location, keeping sets, reps and
 * rest identical. Loads are NOT carried across — the caller re-snaps them to
 * the new profile's plates via lib/plates.
 */
export function adaptToProfile(exercises: PlanExercise[], profile: EquipmentProfile): AdaptResult {
  const out: AdaptedExercise[] = []
  const swaps: AdaptResult['swaps'] = []
  const dropped: string[] = []

  for (const pe of exercises) {
    const res = bestSubstitute(pe.exerciseId, profile)
    if (!res) {
      dropped.push(pe.exerciseId)
      continue
    }
    if (res.swappedFrom) {
      swaps.push({
        from: res.swappedFrom.name,
        to: res.exercise.name,
        reason: res.reason ?? '',
      })
      out.push({
        ...pe,
        exerciseId: res.exercise.id,
        weightKg: undefined,
        swappedFrom: res.swappedFrom.id,
        reason: res.reason,
        swapNote: `${res.swappedFrom.name} → ${res.exercise.name} (${res.reason})`,
      })
    } else {
      out.push({ ...pe })
    }
  }
  return { exercises: out, swaps, dropped }
}

// ============================================================
// SESSION LOCALISER — the fix for "same exercises at home and the gym".
//
// adaptToProfile() above only replaces exercises that are MISSING. Home kit is
// a subset of a commercial gym, so going Home -> Flex changed nothing and 44
// machines sat unused. localiseSession() instead asks, for every slot: what is
// the BEST way to train this movement pattern with the kit in THIS room?
// It upgrades at the gym and degrades gracefully at home, and always says why.
// ============================================================

import { inferQuality, isRealUpgrade, qualityScore, sameRole, upgradeReason } from './quality'
import type { MovementPattern } from '@/db/types'

export interface LocalisedSwap {
  from: string
  to: string
  reason: string
  direction: 'upgrade' | 'substitute'
}

export interface LocaliseResult {
  exercises: AdaptedExercise[]
  swaps: LocalisedSwap[]
  dropped: string[]
}

/** Candidates that train the same pattern and share a primary muscle. */
function candidatesFor(ex: Exercise, profile: EquipmentProfile): Exercise[] {
  const pattern: MovementPattern = inferQuality(ex).pattern
  const primary = new Set(ex.primary)
  return availableExercises(profile).filter((c) => {
    if (c.kind !== ex.kind) return false
    if (inferQuality(c).pattern !== pattern) return false
    // a compound is never replaced by an isolation, or vice versa
    if (!sameRole(ex, c)) return false
    return c.primary.some((m) => primary.has(m))
  })
}

/**
 * Re-point a session at a location, upgrading where the room allows it.
 * Sets, reps and rest are preserved exactly; loads are cleared so the caller
 * re-snaps them to this profile's plates.
 */
export function localiseSession(
  exercises: PlanExercise[],
  profile: EquipmentProfile,
  opts: { upgrade?: boolean } = {},
): LocaliseResult {
  const upgrade = opts.upgrade !== false
  const out: AdaptedExercise[] = []
  const swaps: LocalisedSwap[] = []
  const dropped: string[] = []
  // never recommend the same exercise twice in one session
  const used = new Set<string>()

  for (const pe of exercises) {
    const original = byId.get(pe.exerciseId)
    if (!original) {
      dropped.push(pe.exerciseId)
      continue
    }

    const here = isAvailable(original, profile)
    const pool = candidatesFor(original, profile)
      .filter((c) => !used.has(c.id))
      .sort((a, b) => qualityScore(a) - qualityScore(b))

    // best option in this room for this job
    const best = pool[0]

    // 1) available and nothing better here — keep it
    if (here && (!upgrade || !best || !isRealUpgrade(original, best))) {
      used.add(original.id)
      out.push({ ...pe })
      continue
    }

    // 2) something genuinely better is available — upgrade
    if (here && best && isRealUpgrade(original, best)) {
      used.add(best.id)
      const reason = upgradeReason(original, best, profile.name)
      swaps.push({ from: original.name, to: best.name, reason, direction: 'upgrade' })
      out.push({
        ...pe,
        exerciseId: best.id,
        weightKg: undefined,
        swappedFrom: original.id,
        reason,
        swapNote: `${original.name} → ${best.name} (${reason})`,
      })
      continue
    }

    // 3) not available here — prefer an unused same-job option, then fall back
    //    to the ranked substitution engine. Without the `used` check a session
    //    can end up prescribing the same lift twice.
    let sub = pool.length > 0
      ? { exercise: pool[0], swappedFrom: original, reason: explainSwap(original, pool[0], profile) }
      : bestSubstitute(original.id, profile)
    if (sub && sub.exercise.id !== original.id && used.has(sub.exercise.id)) {
      const alt = pool.find((cand) => !used.has(cand.id))
      sub = alt
        ? { exercise: alt, swappedFrom: original, reason: explainSwap(original, alt, profile) }
        : null
    }
    if (!sub) {
      dropped.push(original.id)
      continue
    }
    used.add(sub.exercise.id)
    if (sub.swappedFrom) {
      const reason = sub.reason ?? `not available at ${profile.name}`
      swaps.push({ from: sub.swappedFrom.name, to: sub.exercise.name, reason, direction: 'substitute' })
      out.push({
        ...pe,
        exerciseId: sub.exercise.id,
        weightKg: undefined,
        swappedFrom: sub.swappedFrom.id,
        reason,
        swapNote: `${sub.swappedFrom.name} → ${sub.exercise.name} (${reason})`,
      })
    } else {
      out.push({ ...pe })
    }
  }

  return { exercises: out, swaps, dropped }
}
