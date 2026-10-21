// ============================================================
// Kilojoules ↔ calories.
// Australian labels are printed in kJ, so every energy input accepts either
// and every display can show either. STORAGE IS ALWAYS kcal.
// ============================================================

import { KJ_PER_KCAL, type EnergyUnit } from '@/db/types'
import { KJ_SUSPECT_THRESHOLD, fmtEnergy, fmtEnergyShort, kcalToKj, kjToKcal } from '@/db/defaults'

export { KJ_PER_KCAL, KJ_SUSPECT_THRESHOLD, fmtEnergy, fmtEnergyShort, kcalToKj, kjToKcal }
export type { EnergyUnit }

/** Input unit the user is currently typing in (not the display preference). */
export type InputUnit = 'kcal' | 'kj'

export const INPUT_UNIT_OPTIONS: { value: InputUnit; label: string }[] = [
  { value: 'kcal', label: 'cal' },
  { value: 'kj', label: 'kJ' },
]

/** Convert a typed number in `unit` into stored kcal. */
export function toKcal(value: number, unit: InputUnit): number {
  if (!isFinite(value)) return 0
  return unit === 'kj' ? value / KJ_PER_KCAL : value
}

/** Convert stored kcal into the given input unit for editing. */
export function fromKcal(kcal: number, unit: InputUnit): number {
  if (!isFinite(kcal)) return 0
  return unit === 'kj' ? kcal * KJ_PER_KCAL : kcal
}

/**
 * Auto-detect a kJ figure typed into a per-100g calorie field.
 * No ordinary food reaches 1,200 kcal/100g (pure fat is ~900), so a number
 * that high is almost certainly the kJ value off an Australian label.
 */
export function looksLikeKilojoules(value: number, per: 'per100g' | 'serve' = 'per100g'): boolean {
  if (!isFinite(value) || value <= 0) return false
  return per === 'per100g' ? value > KJ_SUSPECT_THRESHOLD : value > 4000
}

/** The suggestion shown when a kJ value is suspected. */
export function kjSuggestion(value: number): { kcal: number; message: string } {
  const kcal = Math.round(kjToKcal(value))
  return {
    kcal,
    message: `${Math.round(value).toLocaleString('en-AU')} kJ is about ${kcal.toLocaleString('en-AU')} cal. Use that?`,
  }
}

// ---------- macro sanity check ----------
export const MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 } as const

export interface MacroCheck {
  /** kcal implied by the macros */
  computed: number
  stated: number
  /** signed difference as a fraction of stated (0.12 = 12% out) */
  driftPct: number
  ok: boolean
  message?: string
}

/**
 * 4·protein + 4·carbs + 9·fat should land within ~10% of the stated calories.
 * Returns ok:true when there isn't enough information to judge.
 */
export function checkMacros(
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  tolerance = 0.1,
): MacroCheck {
  const computed = Math.round(
    protein * MACRO_KCAL.protein + carbs * MACRO_KCAL.carbs + fat * MACRO_KCAL.fat,
  )
  const stated = Math.round(kcal)
  if (stated <= 0 || computed <= 0) {
    return { computed, stated, driftPct: 0, ok: true }
  }
  const driftPct = (computed - stated) / stated
  const ok = Math.abs(driftPct) <= tolerance
  return {
    computed,
    stated,
    driftPct,
    ok,
    message: ok
      ? undefined
      : `Macros work out to ${computed.toLocaleString('en-AU')} cal, but you've entered ${stated.toLocaleString('en-AU')}.`,
  }
}

/** Parse a number out of loose user input ('1,450 kJ' → 1450). */
export function parseEnergyInput(raw: string): { value: number; unit?: InputUnit } {
  const cleaned = raw.replace(/,/g, '').trim()
  const n = parseFloat(cleaned.replace(/[^0-9.]/g, ''))
  const value = isFinite(n) ? n : 0
  if (/kj/i.test(cleaned)) return { value, unit: 'kj' }
  if (/k?cal/i.test(cleaned)) return { value, unit: 'kcal' }
  return { value }
}
