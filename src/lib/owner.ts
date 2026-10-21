// The owner's own facts, entered for him so he is never asked to set up again
// (his instruction, 2026-10-08), plus the two automatic behaviours he asked for:
//   • calories: 1,850 a day, lowered automatically if his weight stops dropping
//   • creatine: loading dose until Saturday 10 Oct 2026, then the normal dose

import dayjs from 'dayjs'
import { db, getProfile, getSetting, saveProfile, setSetting } from '@/db'
import type { Profile, WorkDay } from '@/db/types'

/** Mon 9–23, Tue 9–18, Wed 9–18, Thu off, Fri off, Sat 9–23, Sun 9–23 (0 = Sunday) */
export const OWNER_WORK: WorkDay[] = [
  { day: 0, working: true, start: '09:00', end: '23:00' },
  { day: 1, working: true, start: '09:00', end: '23:00' },
  { day: 2, working: true, start: '09:00', end: '18:00' },
  { day: 3, working: true, start: '09:00', end: '18:00' },
  { day: 4, working: false },
  { day: 5, working: false },
  { day: 6, working: true, start: '09:00', end: '23:00' },
]
export const OWNER_GYM_TIME = '22:30'
export const OWNER_CALORIES = 1850
export const CREATINE_LOAD_UNTIL = '2026-10-10'

export async function applyOwnerProfileOnce(): Promise<boolean> {
  if (await getSetting<boolean>('v8:ownerProfile', false)) return false
  const me = await getProfile()
  if (!me) return false
  const next: Profile = {
    ...me,
    onboarded: true,                        // never show the setup takeover again
    sex: 'male',
    heightCm: 169,
    birthYear: 2000,                        // 26 in 2026
    goal: 'lose-fat',
    daysPerWeek: 4,                         // Tue / Wed / Thu / Fri
    workSchedule: OWNER_WORK,
    preferredSlot: 'evening',
    gymTime: OWNER_GYM_TIME,
    calorieTarget: OWNER_CALORIES,
    proteinTarget: me.proteinTarget && me.proteinTarget >= 150 ? me.proteinTarget : Math.round((me.weightKg || 98) * 1.9),
    adaptiveCalories: true,                 // lower it automatically if weight stalls
    goalWeightKg: me.goalWeightKg ?? 85,
    startWeightKg: me.startWeightKg ?? Math.max(98, me.weightKg || 98),
    creatineGrams: me.creatineGrams || 5,
    creatineLoadUntil: CREATINE_LOAD_UNTIL,
    creatineLoadGrams: 20,
  }
  await saveProfile(next)
  // the program's four training days drive reminders too
  try {
    const rem = await db.reminders.get('reminders')
    if (rem) await db.reminders.put({ ...rem, workoutEnabled: true, updatedAt: new Date().toISOString() })
  } catch { /* reminders table optional */ }
  await setSetting('v8:ownerProfile', true)
  await setSetting('v7:profileFix', true) // the 1,850 he set wins over the formula target
  return true
}

/** today's creatine dose: loading (default 20 g split into 4 × 5 g) until the load date, then maintenance */
export function creatineDoseFor(p: Profile, date = dayjs().format('YYYY-MM-DD')): { grams: number; loading: boolean; note: string } {
  if (p.creatineLoadUntil && date <= p.creatineLoadUntil) {
    const g = p.creatineLoadGrams ?? 20
    return { grams: g, loading: true, note: `Loading phase until ${dayjs(p.creatineLoadUntil).format('ddd D MMM')} — ${g} g today, split into ${Math.max(1, Math.round(g / 5))} doses of ~5 g with meals. Then ${p.creatineGrams} g a day.` }
  }
  return { grams: p.creatineGrams, loading: false, note: `${p.creatineGrams} g a day — any time, every day.` }
}

/**
 * Weekly automatic calorie check. If the 7-day average weight has not dropped
 * by at least 0.2 kg in each of the last two weeks, lower the target by 100 kcal
 * (never below 1,500, at most once every 14 days). Needs weigh-ins in 3 separate
 * weeks — no data, no change. Every change is recorded and shown with Undo.
 */
export async function autoAdjustCalories(today = dayjs().format('YYYY-MM-DD')): Promise<Profile['calorieAuto'] | null> {
  const me = await getProfile()
  if (!me || me.adaptiveCalories === false) return null
  if (me.calorieAuto && dayjs(today).diff(dayjs(me.calorieAuto.date), 'day') < 14) return null
  const w = await db.weighIns.toArray()
  const avg = (from: number, to: number) => {
    const xs = w.filter((x) => { const d = dayjs(today).diff(dayjs(x.date), 'day'); return d >= from && d < to }).map((x) => x.weightKg)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  const a0 = avg(0, 7), a1 = avg(7, 14), a2 = avg(14, 21)
  if (a0 === null || a1 === null || a2 === null) return null
  const drop1 = a1 - a0, drop2 = a2 - a1
  if (drop1 >= 0.2 || drop2 >= 0.2) return null
  const to = Math.max(1500, me.calorieTarget - 100)
  if (to >= me.calorieTarget) return null
  const change = { date: today, from: me.calorieTarget, to, why: `Your 7-day average weight moved ${(-drop2).toFixed(1)} kg then ${(-drop1).toFixed(1)} kg over the last two weeks — not dropping, so the target comes down 100 kcal.` }
  await saveProfile({ ...me, calorieTarget: to, calorieAuto: change })
  return change
}

export async function undoCalorieAuto(): Promise<void> {
  const me = await getProfile()
  if (!me?.calorieAuto) return
  await saveProfile({ ...me, calorieTarget: me.calorieAuto.from, calorieAuto: { ...me.calorieAuto, date: me.calorieAuto.date, to: me.calorieAuto.from, why: 'Undone by you.' } })
}
