// Shared constants + pure helpers for the More / Settings / Onboarding module.
// Screen-local — never imported by other modules' shared libs.

import { db } from '@/db'
import { newId, todayStr } from '@/lib/id'
import type { Profile, WorkDay } from '@/db/types'

/** the REAL version of this build (package.json), plus its build id and release time */
export const APP_VERSION = __APP_VERSION__
export const BUILD_ID = __BUILD_ID__
export const RELEASE_DATE = __RELEASE_DATE__

export const GOAL_META: Record<Profile['goal'], { label: string; desc: string; tone: 'amber' | 'green' | 'blue' }> = {
  'lose-fat': { label: 'Lose fat', desc: 'Steady deficit while keeping your strength', tone: 'amber' },
  'build-muscle': { label: 'Build muscle', desc: 'Small surplus, progressive overload', tone: 'green' },
  recomp: { label: 'Recomp', desc: 'Slight deficit — trade fat for muscle', tone: 'blue' },
}

export const SEX_OPTIONS: { value: Profile['sex']; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

export const ACTIVITY_OPTIONS: { value: Profile['activityLevel']; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk day, little walking' },
  { value: 'light', label: 'Lightly active', desc: 'Some walking, on your feet a bit' },
  { value: 'moderate', label: 'Moderately active', desc: 'Regular movement most days' },
  { value: 'active', label: 'Very active', desc: 'Physical job or lots of daily activity' },
]

export const EXPERIENCE_OPTIONS: { value: Profile['experience']; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const SLOT_OPTIONS: { value: Profile['preferredSlot']; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'morning', label: 'Morning' },
  { value: 'after-work', label: 'After work' },
  { value: 'evening', label: 'Evening' },
]

/** Monday-first display order for week rows. */
export const WEEK_ROW_ORDER: ReadonlyArray<WorkDay['day']> = [1, 2, 3, 4, 5, 6, 0]

/** '17:45' → '5:45 pm' */
export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`
}

export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** ~35 ml per kg bodyweight, snapped to 250 ml — a practical hydration default. */
export function recommendedWaterMl(weightKg: number): number {
  return Math.min(6000, Math.max(1500, Math.round((weightKg * 35) / 250) * 250))
}

/** lenient numeric parse ('98,3' works too) */
export function parseNumber(s: string): number {
  const n = Number(String(s).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** '3500' ml → '3.5 L' */
export function fmtLitres(ml: number): string {
  return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L`
}

// ---------- cable stack steps (comma list) ----------

export function stackStepsToText(steps: number[]): string {
  return steps.join(', ')
}

export type StackParse = { ok: true; steps: number[] } | { ok: false; error: string }

export function parseStackSteps(text: string): StackParse {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  if (parts.length === 0) return { ok: false, error: 'Enter at least one weight, separated by commas.' }
  const steps: number[] = []
  for (const part of parts) {
    const n = parseNumber(part)
    if (!Number.isFinite(n)) return { ok: false, error: `"${part}" is not a number.` }
    if (n < 1 || n > 150) return { ok: false, error: 'Each step must be between 1 and 150 kg.' }
    steps.push(Math.round(n * 2) / 2)
  }
  const unique = [...new Set(steps)].sort((a, b) => a - b)
  if (unique.length > 40) return { ok: false, error: 'That is a lot of steps — 40 max.' }
  return { ok: true, steps: unique }
}

// ---------- weigh-ins ----------

/** Record a weight for today (updates today's entry if one already exists). */
export async function upsertTodayWeighIn(weightKg: number): Promise<void> {
  const today = todayStr()
  const existing = await db.weighIns.where('date').equals(today).first()
  if (existing) await db.weighIns.update(existing.id, { weightKg })
  else await db.weighIns.add({ id: newId(), date: today, weightKg })
  // keep the profile's "latest known" weight in step, like the Body tab does
  const me = await db.profile.get('me')
  if (me) await db.profile.put({ ...me, weightKg, updatedAt: new Date().toISOString() })
}
