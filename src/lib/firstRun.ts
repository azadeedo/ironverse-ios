// ============================================================
// First-time setup (the iOS app's 8-screen onboarding) — logic only.
//
// The screens live in screens/firstRun/. Everything here is pure or a thin
// Dexie write so it can be tested without a browser.
//
// Rules this module keeps:
//  • progress is saved after every change (settings `firstRun:draft`) so an
//    interrupted setup resumes where it stopped
//  • a completed setup is never shown again by itself (`firstRun:done`)
//  • data imported from an Ironverse backup is never overwritten: if the
//    restored profile is already set up, setup is skipped; otherwise the draft
//    is PREFILLED from the restored profile and only the answers the user
//    actually gives are written
//  • it configures EXISTING engines — profile targets (lib/nutrition), the
//    location-built plan generator (lib/plangen) or the 12-week program
//    (lib/programStore) — it never replaces them
// ============================================================

import dayjs from 'dayjs'
import { db, getProfile, getSetting, saveProfile, setSetting, SETTING_KEYS } from '@/db'
import type { AnyEquipment, EquipmentProfile, Profile } from '@/db/types'
import { epley1RM } from './training'
import { GYM_PROFILE_ID, HOME_PROFILE_ID, ensureEquipmentProfiles } from './equipment'
import { recommendedTargets, tdeeFormula } from './nutrition'
import { newId, nowIso, todayStr } from './id'
import type { ProgramSetup } from './program12'

export const FIRST_RUN_KEYS = {
  draft: 'firstRun:draft',
  done: 'firstRun:done',
  answers: 'firstRun:answers',
  tourDone: 'tour:done',
} as const

export type Units = 'metric' | 'imperial'
export type GoalKey = 'muscle' | 'fat-loss' | 'strength' | 'cardio' | 'endurance' | 'recomp' | 'general' | 'maintenance'
export type LiftKey = 'bench' | 'squat' | 'deadlift' | 'ohp'
export type LiftMode = 'known' | 'estimate' | 'later'
export type TrainingStyle = 'strength' | 'hypertrophy' | 'general' | 'program12'

export interface LiftAnswer {
  mode: LiftMode
  /** known 1RM, always stored in kg */
  oneRmKg?: number
  /** a recent set (kg + reps) for the estimate */
  weightKg?: number
  reps?: number
}

export interface FirstRunDraft {
  step: number
  name: string
  ageMode: 'age' | 'dob'
  age?: number
  dob?: string
  sex?: Profile['sex']
  heightCm?: number
  weightKg?: number
  units: Units
  experience?: Profile['experience']
  goals: GoalKey[]
  goalWeightKg?: number
  lifts: Record<LiftKey, LiftAnswer>
  daysPerWeek: number
  sessionMinutes: number
  location: 'gym' | 'home'
  homeEquipment: string[]
  style: TrainingStyle
  halalMode: boolean
  reminders: boolean
  /** set when the draft was prefilled from a restored backup */
  prefilledFromBackup?: boolean
  updatedAt?: string
}

export const GOAL_OPTIONS: { key: GoalKey; label: string; desc: string }[] = [
  { key: 'muscle', label: 'Muscle building', desc: 'Add size with progressive overload' },
  { key: 'fat-loss', label: 'Fat loss', desc: 'A steady deficit while keeping strength' },
  { key: 'strength', label: 'Strength', desc: 'Lift heavier on the big lifts' },
  { key: 'cardio', label: 'Cardiovascular fitness', desc: 'Heart and lungs — runs, rides, rowing' },
  { key: 'endurance', label: 'Endurance', desc: 'Go longer before you tire' },
  { key: 'recomp', label: 'Body recomposition', desc: 'Lose fat and gain muscle together' },
  { key: 'general', label: 'General fitness', desc: 'Feel fitter and move well' },
  { key: 'maintenance', label: 'Maintenance', desc: 'Keep what you have built' },
]

export const LIFT_LABELS: Record<LiftKey, string> = {
  bench: 'Bench press', squat: 'Squat', deadlift: 'Deadlift', ohp: 'Overhead press',
}

/** home-equipment choices shown in setup → the equipment keys the exercise library uses */
export const HOME_KIT: { id: string; label: string; keys: AnyEquipment[] }[] = [
  { id: 'dumbbells', label: 'Dumbbells', keys: ['dumbbell'] },
  { id: 'barbell', label: 'Barbell + plates', keys: ['barbell', 'plate'] },
  { id: 'rack', label: 'Squat rack / power rack', keys: ['barbell', 'plate'] },
  { id: 'bench', label: 'Flat / adjustable bench', keys: ['bench'] },
  { id: 'pullup', label: 'Pull-up bar', keys: ['pullup-bar'] },
  { id: 'dip', label: 'Dip bars / handles', keys: ['dip-handles'] },
  { id: 'cables', label: 'Cable machine', keys: ['cable-high', 'cable-low', 'cable-mid'] },
  { id: 'pulldown', label: 'Lat pulldown / low row', keys: ['lat-pulldown', 'low-row'] },
  { id: 'smith', label: 'Smith machine', keys: ['smith'] },
  { id: 'curlbar', label: 'EZ curl bar', keys: ['curl-bar'] },
  { id: 'kettlebell', label: 'Kettlebells', keys: ['kettlebell'] },
  { id: 'bands', label: 'Resistance bands', keys: ['resistance-band'] },
  { id: 'suspension', label: 'Suspension straps (TRX)', keys: ['suspension'] },
  { id: 'rope', label: 'Jump rope', keys: ['jump-rope'] },
  { id: 'treadmill', label: 'Treadmill', keys: ['treadmill'] },
  { id: 'bike', label: 'Exercise bike', keys: ['bike'] },
  { id: 'rower', label: 'Rowing machine', keys: ['rower'] },
]

const HOME_DUMBBELLS = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30]

export function emptyDraft(): FirstRunDraft {
  const later: LiftAnswer = { mode: 'later' }
  return {
    step: 0, name: '', ageMode: 'age', units: 'metric', goals: [],
    lifts: { bench: { ...later }, squat: { ...later }, deadlift: { ...later }, ohp: { ...later } },
    daysPerWeek: 3, sessionMinutes: 60, location: 'gym', homeEquipment: [],
    style: 'general', halalMode: false, reminders: true,
  }
}

// ---------- units ----------
export const LB_PER_KG = 2.2046226218
export const kgToLb = (kg: number) => kg * LB_PER_KG
export const lbToKg = (lb: number) => lb / LB_PER_KG
export const cmToFtIn = (cm: number) => { const inches = cm / 2.54; let ft = Math.floor(inches / 12); let inch = Math.round(inches - ft * 12); if (inch === 12) { ft += 1; inch = 0 } return { ft, inch } }
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54
export const round1 = (n: number) => Math.round(n * 10) / 10

// ---------- strength ----------
/**
 * Estimated one-rep max from a recent set — the Epley formula,
 * e1RM = weight × (1 + reps ÷ 30), the same one the rest of Ironverse uses.
 * Most accurate from sets of 2–10 reps; above 12 reps it is not used at all
 * (returns null) because the error grows too large to be useful.
 */
export const ONE_RM_FORMULA_NOTE = 'Estimated with the Epley formula: weight × (1 + reps ÷ 30). Estimates are approximate — most accurate from a set of 2–10 good reps, and never a reason to attempt a true max.'

export function estimateOneRm(weightKg?: number, reps?: number): number | null {
  if (!(weightKg && weightKg > 0) || !(reps && reps >= 1) || reps > 12) return null
  return round1(epley1RM(weightKg, Math.round(reps)))
}

/** the 1RM a lift answer stands for (known, estimated, or none yet) */
export function liftOneRm(a: LiftAnswer | undefined): number | null {
  if (!a) return null
  if (a.mode === 'known') return a.oneRmKg && a.oneRmKg > 0 ? round1(a.oneRmKg) : null
  if (a.mode === 'estimate') return estimateOneRm(a.weightKg, a.reps)
  return null
}

// ---------- goals → the engine's single goal ----------
export function primaryGoal(goals: GoalKey[]): Profile['goal'] {
  if (goals.includes('fat-loss')) return 'lose-fat'
  if (goals.includes('recomp')) return 'recomp'
  if (goals.includes('muscle')) return 'build-muscle'
  return 'recomp'
}

export function birthYearFrom(d: Pick<FirstRunDraft, 'ageMode' | 'age' | 'dob'>, now = dayjs()): number | undefined {
  if (d.ageMode === 'dob' && d.dob && dayjs(d.dob).isValid()) return dayjs(d.dob).year()
  if (d.age && d.age >= 13 && d.age <= 100) return now.year() - Math.round(d.age)
  return undefined
}

// ---------- persistence ----------
export async function loadDraft(): Promise<FirstRunDraft | null> {
  const raw = await getSetting<FirstRunDraft | null>(FIRST_RUN_KEYS.draft, null)
  if (!raw) return null
  const base = emptyDraft()
  return { ...base, ...raw, lifts: { ...base.lifts, ...(raw.lifts ?? {}) } }
}

export async function saveDraft(d: FirstRunDraft): Promise<void> {
  await setSetting(FIRST_RUN_KEYS.draft, { ...d, updatedAt: nowIso() })
}

export async function isFirstRunDone(): Promise<boolean> {
  return getSetting<boolean>(FIRST_RUN_KEYS.done, false)
}

/**
 * Should the first-time setup open? Not when it was finished before, and not
 * when the profile is already set up (e.g. restored from an Ironverse backup).
 */
export async function needsFirstRun(): Promise<boolean> {
  if (await isFirstRunDone()) return false
  const me = await getProfile()
  return !me?.onboarded
}

/** Prefill a draft from a profile that came in with a restored backup. */
export async function draftFromExisting(): Promise<FirstRunDraft> {
  const d = (await loadDraft()) ?? emptyDraft()
  const me = await getProfile()
  if (!me || !(await hasUserData())) return d
  const setup = await getSetting<ProgramSetup | null>(SETTING_KEYS.programSetup, null)
  const goals: GoalKey[] = d.goals.length ? d.goals : [me.goal === 'lose-fat' ? 'fat-loss' : me.goal === 'build-muscle' ? 'muscle' : 'recomp']
  const lift = (pr?: number, base?: { kg: number; reps: number }): LiftAnswer =>
    pr ? { mode: 'known', oneRmKg: pr } : base ? { mode: 'estimate', weightKg: base.kg, reps: base.reps } : { mode: 'later' }
  return {
    ...d,
    name: d.name || me.name || '',
    sex: d.sex ?? me.sex,
    age: d.age ?? (me.birthYear ? dayjs().year() - me.birthYear : undefined),
    heightCm: d.heightCm ?? me.heightCm,
    weightKg: d.weightKg ?? me.weightKg,
    experience: d.experience ?? me.experience,
    goals,
    goalWeightKg: d.goalWeightKg ?? me.goalWeightKg,
    daysPerWeek: me.daysPerWeek || d.daysPerWeek,
    sessionMinutes: me.sessionMinutes || d.sessionMinutes,
    location: me.equipmentProfileId === HOME_PROFILE_ID ? 'home' : 'gym',
    halalMode: me.halalMode !== false,
    lifts: {
      bench: d.lifts.bench.mode !== 'later' ? d.lifts.bench : lift(setup?.benchPR, setup?.bench),
      squat: d.lifts.squat.mode !== 'later' ? d.lifts.squat : lift(setup?.squatPR, setup?.squat),
      deadlift: d.lifts.deadlift.mode !== 'later' ? d.lifts.deadlift : lift(setup?.deadliftPR, setup?.deadlift),
      ohp: d.lifts.ohp,
    },
    prefilledFromBackup: true,
  }
}

/** any real record — workouts, food, weigh-ins or measurements */
export async function hasUserData(): Promise<boolean> {
  const n = await Promise.all([db.workoutLogs.count(), db.foodLog.count(), db.weighIns.count(), db.measurements.count()])
  return n.reduce((a, b) => a + b, 0) > 0
}

// ---------- applying the answers ----------
export interface FirstRunPreview {
  profile: Profile
  calories: number
  protein: number
  tdee: number
  waterMl: number
}

/** The profile the answers produce — fields the user skipped keep their current value. */
export function previewProfile(base: Profile, d: FirstRunDraft): FirstRunPreview {
  const by = birthYearFrom(d)
  const goal = d.goals.length ? primaryGoal(d.goals) : base.goal
  const profile: Profile = {
    ...base,
    name: d.name.trim() || base.name,
    ...(d.sex ? { sex: d.sex } : {}),
    ...(by ? { birthYear: by } : {}),
    ...(d.heightCm && d.heightCm > 90 && d.heightCm < 250 ? { heightCm: Math.round(d.heightCm) } : {}),
    ...(d.weightKg && d.weightKg > 25 && d.weightKg < 350 ? { weightKg: round1(d.weightKg) } : {}),
    ...(d.experience ? { experience: d.experience } : {}),
    goal,
    daysPerWeek: Math.max(1, Math.min(7, Math.round(d.daysPerWeek))),
    sessionMinutes: Math.max(20, Math.min(150, Math.round(d.sessionMinutes))),
    ...(d.goalWeightKg && d.goalWeightKg > 25 ? { goalWeightKg: round1(d.goalWeightKg) } : {}),
    halalMode: d.halalMode,
    equipmentProfileId: d.location === 'home' ? HOME_PROFILE_ID : GYM_PROFILE_ID,
  }
  const tdee = tdeeFormula(profile)
  const rec = recommendedTargets(profile)
  // maintenance as the ONLY aim → eat at maintenance; any other mix uses the engine's goal maths
  const calories = d.goals.length === 1 && d.goals[0] === 'maintenance' ? tdee : rec.calories
  const waterMl = Math.max(1500, Math.round((profile.weightKg * 35) / 250) * 250)
  return { profile, calories, protein: rec.protein, tdee, waterMl }
}

export interface ApplyResult { planId?: string; planKind: 'program12' | 'generated' | 'kept'; profile: Profile }

/**
 * Write the answers. Called once, from the "Personalise" screen.
 * `targets` lets the user override the suggested calories/protein/water.
 */
export async function applyFirstRun(d: FirstRunDraft, targets?: { calories?: number; protein?: number; waterMl?: number }): Promise<ApplyResult> {
  const base = await getProfile()
  if (!base) throw new Error('No profile to set up')
  const pv = previewProfile(base, d)
  const imported = d.prefilledFromBackup && (await hasUserData())
  const profile: Profile = {
    ...pv.profile,
    calorieTarget: Math.round(targets?.calories ?? pv.calories),
    proteinTarget: Math.round(targets?.protein ?? pv.protein),
    waterTargetMl: Math.round(targets?.waterMl ?? pv.waterMl),
    startWeightKg: base.startWeightKg ?? pv.profile.weightKg,
    onboarded: true,
  }
  await saveProfile(profile)

  // today's weigh-in only when a weight was actually entered (never invented)
  if (d.weightKg && d.weightKg > 25) {
    const today = todayStr()
    const existing = await db.weighIns.where('date').equals(today).first()
    if (existing) await db.weighIns.update(existing.id, { weightKg: round1(d.weightKg) })
    else await db.weighIns.add({ id: newId(), date: today, weightKg: round1(d.weightKg), note: 'First-time setup' })
  }

  // equipment: the built-in rows are configured, never deleted
  const profiles = await ensureEquipmentProfiles()
  const ts = nowIso()
  if (d.location === 'home' && !imported) {
    const home = profiles.find((p) => p.id === HOME_PROFILE_ID)
    if (home) {
      const keys = new Set<AnyEquipment>(['bodyweight'])
      for (const id of d.homeEquipment) HOME_KIT.find((k) => k.id === id)?.keys.forEach((k) => keys.add(k))
      const next: EquipmentProfile = {
        ...home,
        equipment: [...keys],
        dumbbellsKg: keys.has('dumbbell') ? (home.dumbbellsKg.length ? home.dumbbellsKg : HOME_DUMBBELLS) : home.dumbbellsKg,
        updatedAt: ts,
      }
      await db.equipmentProfiles.put(next)
    }
  }
  if (!imported) {
    const gym = profiles.find((p) => p.id === GYM_PROFILE_ID && p.builtIn)
    if (gym && gym.name === 'Flex 24/7') await db.equipmentProfiles.put({ ...gym, name: 'Gym', updatedAt: ts })
  }

  // strength answers → the program setup the 12-week program and PR screens read
  const prev = await getSetting<ProgramSetup | null>(SETTING_KEYS.programSetup, null)
  const setup: ProgramSetup = { ...(prev ?? {}), bodyweightKg: profile.weightKg, heightCm: profile.heightCm, age: dayjs().year() - profile.birthYear, ...(profile.goalWeightKg ? { goalWeightKg: profile.goalWeightKg } : {}) }
  for (const k of ['squat', 'bench', 'deadlift'] as const) {
    const a = d.lifts[k]
    if (a.mode === 'known' && a.oneRmKg) setup[`${k}PR`] = round1(a.oneRmKg)
    // only a set the estimate accepts (1–12 reps) becomes a baseline
    if (a.mode === 'estimate' && a.weightKg && a.reps && estimateOneRm(a.weightKg, a.reps)) setup[k] = { kg: round1(a.weightKg), reps: Math.round(a.reps), date: todayStr() }
  }
  await setSetting(SETTING_KEYS.programSetup, setup)

  // reminders: the user's choice; the reminder rules themselves are unchanged
  const rem = await db.reminders.get('reminders')
  if (rem) await db.reminders.put({ ...rem, workoutEnabled: d.reminders, waterEnabled: d.reminders, updatedAt: ts })

  await setSetting(FIRST_RUN_KEYS.answers, {
    goals: d.goals, units: d.units, style: d.style, location: d.location, homeEquipment: d.homeEquipment,
    lifts: Object.fromEntries((Object.keys(d.lifts) as LiftKey[]).map((k) => [k, { ...d.lifts[k], oneRm: liftOneRm(d.lifts[k]) }])),
    savedAt: ts,
  })

  // the plan — an existing active plan (e.g. from a restored backup) is kept
  let result: ApplyResult = { planKind: 'kept', profile }
  const activeExists = (await db.plans.toArray()).some((p) => p.active)
  if (!imported || !activeExists) {
    if (d.style === 'program12') {
      const { startProgram } = await import('./programStore')
      const today = dayjs()
      const start = today.subtract((today.day() - 2 + 7) % 7, 'day').format('YYYY-MM-DD')
      const plan = await startProgram(setup, start)
      result = { planKind: 'program12', planId: plan.id, profile }
    } else {
      const { generatePlan } = await import('./plangen')
      const eq = (await db.equipmentProfiles.get(profile.equipmentProfileId ?? GYM_PROFILE_ID)) ?? undefined
      const plan = generatePlan(profile, { equipment: eq, seed: 0 })
      await db.transaction('rw', db.plans, async () => {
        await db.plans.toCollection().modify((p) => { p.active = false })
        await db.plans.add(plan)
      })
      result = { planKind: 'generated', planId: plan.id, profile }
    }
  }
  // the owner's boot routine that switches the 12-week program on is not used in this build
  await setSetting('p12:autoActivated', true)
  return result
}

export async function finishFirstRun(): Promise<void> {
  await setSetting(FIRST_RUN_KEYS.done, true)
}
