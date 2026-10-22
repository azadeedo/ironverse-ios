// ============================================================
// Apple Health (HealthKit) — App Store build only.
//
// Reads what the iPhone, Apple Watch and Health-connected scales already record:
//   steps → daily check-in · weight → weigh-ins (never overwrites one you typed)
//   cardio workouts (runs, walks, rides…) → cardio log · active calories,
//   resting heart rate → Today.
// Writes only weigh-ins, and only when "Save weigh-ins to Apple Health" is on.
// Everything stays on the iPhone. In a browser every call is a safe no-op.
// ============================================================

import { db, getSetting, setSetting } from '@/db'
import type { CardioLog } from '@/db/types'
import { isNativeApp } from '@/lib/edition'
import { dayjs } from '@/lib/fmt'
import { saveCheckin } from '@/lib/programStore'
import type { HealthDataType, Workout } from '@capgo/capacitor-health'

export const HEALTH_KEYS = {
  connected: 'health:connected',
  lastSync: 'health:lastSync',
  writeWeight: 'health:writeWeight',
  today: 'health:today',
} as const

export interface HealthToday { date: string; activeKcal?: number; restingHr?: number; steps?: number }
export interface SyncResult { steps: number; weighIns: number; workouts: number; activeKcal?: number }

const READ: HealthDataType[] = ['steps', 'calories', 'heartRate', 'restingHeartRate', 'weight', 'workouts', 'distance']
const WRITE: HealthDataType[] = ['weight']

async function plugin() {
  return (await import('@capgo/capacitor-health')).Health
}

export async function healthAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false
  try { return (await (await plugin()).isAvailable()).available } catch { return false }
}

export async function healthConnected(): Promise<boolean> {
  return (await getSetting<boolean>(HEALTH_KEYS.connected, false)) === true
}

/** Shows Apple's Health permission sheet, then pulls the last 14 days. */
export async function connectAppleHealth(): Promise<SyncResult> {
  const Health = await plugin()
  await Health.requestAuthorization({ read: READ, write: WRITE })
  await setSetting(HEALTH_KEYS.connected, true)
  return syncAppleHealth(14)
}

export async function disconnectAppleHealth(): Promise<void> {
  // iOS keeps the permission itself (Settings → Health → Data Access); we just stop reading
  await setSetting(HEALTH_KEYS.connected, false)
}

/** cardio kinds Ironverse logs, from HealthKit workout types */
export function cardioKindFor(t: Workout['workoutType']): CardioLog['kind'] | null {
  if (t === 'running' || t === 'runningTreadmill' || t === 'trackAndField') return 'run'
  if (t === 'walking' || t === 'hiking') return 'walk'
  if (t === 'cycling' || t === 'bikingStationary' || t === 'handCycling') return 'bike'
  if (t === 'elliptical') return 'elliptical'
  if (t === 'jumpRope') return 'jump-rope'
  if (t === 'stairClimbing' || t === 'stairClimbingMachine' || t === 'stairs' || t === 'stepTraining') return 'incline-walk'
  return null
}

const iso = (d: dayjs.Dayjs) => d.toISOString()

export async function syncAppleHealth(days = 7): Promise<SyncResult> {
  const out: SyncResult = { steps: 0, weighIns: 0, workouts: 0 }
  if (!isNativeApp() || !(await healthConnected())) return out
  const Health = await plugin()
  const start = dayjs().startOf('day').subtract(days - 1, 'day')
  const end = dayjs()

  // steps, one total per day
  try {
    const { samples } = await Health.queryAggregated({ dataType: 'steps', startDate: iso(start), endDate: iso(end), bucket: 'day', aggregation: 'sum' })
    for (const s of samples) {
      const date = dayjs(s.startDate).format('YYYY-MM-DD')
      const n = Math.round(s.values.sum ?? s.value ?? 0)
      if (n > 0) { await saveCheckin({ date, steps: n }); out.steps++ }
    }
  } catch { /* steps not shared */ }

  // weight — the last reading of each day, only on days with no weigh-in yet
  try {
    const { samples } = await Health.readSamples({ dataType: 'weight', startDate: iso(start.subtract(23, 'day')), endDate: iso(end), limit: 200, ascending: true })
    const byDay = new Map<string, number>()
    for (const s of samples) if (s.value > 30 && s.value < 300) byDay.set(dayjs(s.startDate).format('YYYY-MM-DD'), Math.round(s.value * 10) / 10)
    for (const [date, kg] of byDay) {
      if ((await db.weighIns.where('date').equals(date).count()) > 0) continue
      await db.weighIns.put({ id: `hk-w-${date}`, date, weightKg: kg, note: 'Apple Health' })
      out.weighIns++
    }
  } catch { /* weight not shared */ }

  // cardio workouts (Apple Watch, Strava, treadmill apps…) → cardio log
  try {
    const { workouts } = await Health.queryWorkouts({ startDate: iso(start), endDate: iso(end), limit: 100 })
    for (const w of workouts) {
      const kind = cardioKindFor(w.workoutType)
      if (!kind || w.duration < 120) continue
      const id = `hk-${w.platformId ?? w.startDate}`
      if (await db.cardioLog.get(id)) continue
      const km = w.totalDistance ? Math.round(w.totalDistance / 10) / 100 : undefined
      const row: CardioLog = {
        id, date: dayjs(w.startDate).format('YYYY-MM-DD'), kind, seconds: Math.round(w.duration),
        distanceKm: km, calories: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned) : undefined,
        avgPaceSecPerKm: km && km > 0.2 && (kind === 'run' || kind === 'walk') ? Math.round(w.duration / km) : undefined,
        note: `Apple Health${w.sourceName ? ` · ${w.sourceName}` : ''}`, createdAt: w.endDate,
      }
      await db.cardioLog.put(row)
      out.workouts++
    }
  } catch { /* workouts not shared */ }

  // today's active calories + latest resting heart rate for the Today screen
  const today: HealthToday = { date: dayjs().format('YYYY-MM-DD') }
  try {
    const { samples } = await Health.queryAggregated({ dataType: 'calories', startDate: iso(dayjs().startOf('day')), endDate: iso(end), bucket: 'day', aggregation: 'sum' })
    const k = samples.reduce((s, x) => s + (x.values.sum ?? x.value ?? 0), 0)
    if (k > 0) today.activeKcal = out.activeKcal = Math.round(k)
  } catch { /* active energy not shared */ }
  try {
    const { samples } = await Health.readSamples({ dataType: 'restingHeartRate', startDate: iso(dayjs().subtract(7, 'day')), endDate: iso(end), limit: 1, ascending: false })
    if (samples[0]) today.restingHr = Math.round(samples[0].value)
  } catch { /* resting HR not shared */ }
  const c = await db.checkins.get(today.date)
  today.steps = c?.steps
  await setSetting(HEALTH_KEYS.today, today)
  await setSetting(HEALTH_KEYS.lastSync, new Date().toISOString())
  return out
}

/** called after a weigh-in is saved in Ironverse */
export async function saveWeighInToHealth(kg: number, dateIso?: string): Promise<void> {
  if (!isNativeApp() || !(await healthConnected())) return
  if (!(await getSetting<boolean>(HEALTH_KEYS.writeWeight, false))) return
  try { await (await plugin()).saveSample({ dataType: 'weight', value: kg, unit: 'kilogram', startDate: dateIso, endDate: dateIso }) } catch { /* write not allowed */ }
}
