// ============================================================
// Read-time defaults for v2 optional fields.
// RULE: a v1 row must render identically to a v2 row. Nothing in the UI may
// read a v2 field directly — always go through these helpers so old records
// (real data the owner already has) keep working untouched.
// ============================================================

import type {
  DietTag, EnergyUnit, EquipmentProfile, Exercise, FoodItem, PrayerConfig,
  Profile, RamadanConfig, SetLog, WorkoutLog,
} from './types'
import { KJ_PER_KCAL } from './types'

// ---------- profile ----------
/** Halal mode is ON by default for this owner; explicit false turns it off. */
export const halalMode = (p?: Profile | null): boolean => p?.halalMode !== false

export const energyUnit = (p?: Profile | null): EnergyUnit => p?.energyUnit ?? 'kcal'

export const adaptiveCalories = (p?: Profile | null): boolean => p?.adaptiveCalories === true

export const DEFAULT_RAMADAN: RamadanConfig = {
  enabled: false,
  suhoorTime: '04:30',
  iftarTime: '19:45',
  trainingWindow: 'after-iftar',
  maintenanceVolume: true,
}

export const ramadanConfig = (p?: Profile | null): RamadanConfig => ({
  ...DEFAULT_RAMADAN,
  ...(p?.ramadan ?? {}),
})

export const DEFAULT_PRAYER: PrayerConfig = {
  enabled: false,
  times: { fajr: '05:15', dhuhr: '12:45', asr: '16:00', maghrib: '19:45', isha: '21:00' },
  bufferMin: 25,
}

export const prayerConfig = (p?: Profile | null): PrayerConfig => ({
  ...DEFAULT_PRAYER,
  ...(p?.prayer ?? {}),
  times: { ...DEFAULT_PRAYER.times, ...(p?.prayer?.times ?? {}) },
})

// ---------- energy display ----------
export const kcalToKj = (kcal: number): number => Math.round(kcal * KJ_PER_KCAL)
export const kjToKcal = (kj: number): number => Math.round(kj / KJ_PER_KCAL)

/** Format an energy value for display under the user's chosen unit. */
export function fmtEnergy(kcal: number, unit: EnergyUnit = 'kcal'): string {
  const c = Math.round(kcal)
  if (unit === 'kj') return `${kcalToKj(c).toLocaleString('en-AU')} kJ`
  if (unit === 'both') return `${c.toLocaleString('en-AU')} cal · ${kcalToKj(c).toLocaleString('en-AU')} kJ`
  return `${c.toLocaleString('en-AU')} cal`
}

/** Short form for tight spaces — primary unit only. */
export function fmtEnergyShort(kcal: number, unit: EnergyUnit = 'kcal'): string {
  const c = Math.round(kcal)
  return unit === 'kj' ? `${kcalToKj(c).toLocaleString('en-AU')} kJ` : `${c.toLocaleString('en-AU')} cal`
}

/**
 * A per-100g energy figure above this is almost certainly kilojoules — no
 * everyday food is 1,200 kcal/100g (pure fat is ~900).
 */
export const KJ_SUSPECT_THRESHOLD = 1200

// ---------- foods ----------
export const dietTags = (f?: Partial<FoodItem> | null): DietTag[] => f?.dietTags ?? []

/** Hidden entirely in halal mode. */
export function isHalalHidden(f: Partial<FoodItem>, halal: boolean): boolean {
  if (!halal) return false
  const t = dietTags(f)
  return t.includes('pork') || t.includes('alcohol')
}

/** Shown, but with a "check the label" note. */
export function isHalalCaution(f: Partial<FoodItem>, halal: boolean): boolean {
  if (!halal) return false
  const t = dietTags(f)
  if (t.includes('pork') || t.includes('alcohol')) return false
  return t.includes('gelatine') || t.includes('unclear')
}

// ---------- sets / workouts ----------
export const setRir = (s: SetLog): number | undefined => s.rir
export const isWarmup = (s: SetLog): boolean => s.warmup === true
export const workoutProfileName = (w: WorkoutLog): string | undefined => w.equipmentProfileName

// ---------- exercises ----------
export const substitutesOf = (ex: Exercise): string[] =>
  ex.substitutes ?? ex.alternatives ?? []

export const hasFormCues = (ex: Exercise): boolean =>
  Boolean(ex.setupCues?.length || ex.executionCues?.length || ex.commonMistakes?.length)

// ---------- equipment profiles ----------
/** Fallback profile derived from the legacy Profile fields (pre-v2 users). */
export function profileFromLegacy(p: Profile): EquipmentProfile {
  const ts = p.updatedAt ?? new Date().toISOString()
  return {
    id: 'home',
    name: 'Home',
    builtIn: true,
    equipment: [
      'barbell', 'curl-bar', 'smith', 'cable-high', 'cable-low', 'cable-mid',
      'lat-pulldown', 'low-row', 'pullup-bar', 'dip-handles', 'bench',
      'suspension', 'jump-rope', 'bodyweight', 'plate',
    ],
    barbellKg: p.barbellKg ?? 20,
    curlBarKg: p.curlBarKg ?? 10,
    smithBarKg: p.smithBarKg ?? 15,
    platePairsKg: p.platePairsKg ?? [5, 10, 15, 20],
    dumbbellsKg: [],
    stackStepsKg: p.stackStepsKg ?? [6, 11, 17, 22, 28, 34, 39, 45, 51, 56, 62, 68, 74],
    minIncrementKg: 5,
    createdAt: ts,
    updatedAt: ts,
  }
}
