import { db } from './index'
import { newId, nowIso, todayStr } from '@/lib/id'
import type { Profile, ReminderConfig, WorkDay } from './types'

/** Default work week: Mon–Fri 8:00–17:00 (editable in Settings → Work schedule). */
function defaultWorkSchedule(): WorkDay[] {
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
    day,
    working: day >= 1 && day <= 5,
    start: day >= 1 && day <= 5 ? '08:00' : undefined,
    end: day >= 1 && day <= 5 ? '17:00' : undefined,
  }))
}

/** Idempotent first-run seed with the owner's known data (from their previous tracking app). */
export async function seedIfNeeded(): Promise<void> {
  const claimed = await db.transaction('rw', db.settings, async () => {
    const seeded = await db.settings.get('seeded:v1')
    if (seeded) return false
    await db.settings.put({ key: 'seeded:v1', value: true })
    return true
  })
  if (!claimed) return

  // SAFETY NET: the flag can be missing while real data is present — a restore
  // from a backup that predates it, or a cleared settings table. Seeding over a
  // populated database would silently replace his profile and targets, so if
  // ANY user data exists we mark it seeded and touch nothing else.
  const [profileCount, weighCount, logCount, foodCount, measCount] = await Promise.all([
    db.profile.count(), db.weighIns.count(), db.workoutLogs.count(),
    db.foodLog.count(), db.measurements.count(),
  ])
  if (profileCount + weighCount + logCount + foodCount + measCount > 0) return

  const ts = nowIso()
  const today = todayStr()

  const profile: Profile = {
    id: 'me',
    name: 'Nouri',
    sex: 'male',
    birthYear: 2000, // owner: 26 years old (2026)
    heightCm: 169,   // owner-stated
    weightKg: 98.3,
    goal: 'lose-fat',
    activityLevel: 'moderate', // 4 lifting days + cardio + steps
    experience: 'intermediate',
    daysPerWeek: 4,
    sessionMinutes: 60,
    workSchedule: defaultWorkSchedule(),
    preferredSlot: 'auto',
    calorieTarget: 2460, // Mifflin-St Jeor × 1.55 − 500 for 98 kg / 169 cm / 26 y
    proteinTarget: 196,
    waterTargetMl: 3500,
    creatineGrams: 5,
    barbellKg: 20,
    curlBarKg: 10,
    smithBarKg: 15,
    platePairsKg: [5, 10, 15, 20],
    stackStepsKg: [6, 11, 17, 22, 28, 34, 39, 45, 51, 56, 62, 68, 74],
    onboarded: false,
    createdAt: ts,
    updatedAt: ts,
  }
  await db.profile.put(profile)

  await db.weighIns.add({ id: newId(), date: today, weightKg: 98.3 })
  await db.measurements.add({
    id: newId(),
    date: today,
    values: { biceps: 39, abs: 121, waist: 104, chest: 114, shoulders: 143, thigh: 64.5, calf: 42 },
  })

  const reminders: ReminderConfig = {
    id: 'reminders',
    waterEnabled: true,
    waterIntervalMin: 90,
    waterWindow: ['07:00', '21:30'],
    creatineEnabled: true,
    creatineTime: '08:30',
    workoutEnabled: true,
    workoutLeadMin: 30,
    updatedAt: ts,
  }
  await db.reminders.put(reminders)
}
