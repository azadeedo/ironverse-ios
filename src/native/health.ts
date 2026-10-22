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
  writeWater: 'health:writeWater',
  writeFood: 'health:writeFood',
  today: 'health:today',
} as const

export interface HealthToday { date: string; activeKcal?: number; restingHr?: number; steps?: number }
export interface SyncResult { steps: number; weighIns: number; workouts: number; activeKcal?: number }

const READ: HealthDataType[] = ['steps', 'calories', 'heartRate', 'restingHeartRate', 'weight', 'workouts', 'distance', 'sleep', 'heartRateVariability']
// v10: optional write-back of water and food energy (own switches)
const WRITE_EXTRA: HealthDataType[] = ['dietaryWater', 'dietaryEnergyConsumed']
const WRITE: HealthDataType[] = ['weight']

// ---------- reliability (v10.1, 23 Oct 2026) ----------
// On the owner's iPhone "Connect" sat on "Connecting…" forever. Every native call
// now has a time limit and is logged, so nothing can hang the screen and the
// Connected devices screen can show exactly which step stalled.
const LOG_KEY = 'health:log'
let logLines: string[] = []
export function logHealth(what: string, err?: unknown): void {
  const msg = err ? `${what}: ${(err as Error)?.message ?? String(err)}` : what
  logLines = [...logLines, `${new Date().toLocaleTimeString()} ${msg}`].slice(-40)
  void setSetting(LOG_KEY, logLines).catch(() => {})
}
export async function healthLog(): Promise<string[]> { return getSetting<string[]>(LOG_KEY, []) }

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => { logHealth(`${what} timed out after ${Math.round(ms / 1000)}s`); reject(new Error(`${what} timed out`)) }, ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); logHealth(`${what} failed`, e); reject(e) })
  })
}

type HP = import('@capgo/capacitor-health').HealthPlugin
async function plugin() {
  const H = (await import('@capgo/capacitor-health')).Health
  return {
    isAvailable: () => withTimeout(H.isAvailable(), 10_000, 'isAvailable'),
    requestAuthorization: (o: Parameters<HP['requestAuthorization']>[0]) => withTimeout(H.requestAuthorization(o), 120_000, 'permission request'),
    readSamples: (o: Parameters<HP['readSamples']>[0]) => withTimeout(H.readSamples(o), 25_000, `read ${o.dataType}`),
    queryAggregated: (o: Parameters<HP['queryAggregated']>[0]) => withTimeout(H.queryAggregated(o), 25_000, `daily ${o.dataType}`),
    queryWorkouts: (o: Parameters<HP['queryWorkouts']>[0]) => withTimeout(H.queryWorkouts(o), 25_000, 'workouts'),
    saveSample: (o: Parameters<HP['saveSample']>[0]) => withTimeout(H.saveSample(o), 15_000, `save ${o.dataType}`),
  }
}

export async function healthAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false
  try { return (await (await plugin()).isAvailable()).available } catch { return false }
}

export async function healthConnected(): Promise<boolean> {
  return (await getSetting<boolean>(HEALTH_KEYS.connected, false)) === true
}

/** Shows Apple's Health permission sheet, then pulls the last 14 days. */
/**
 * Shows Apple's Health permission sheet. Resolves as soon as iOS answers, so the
 * screen can say "Connected" straight away — the first sync runs separately.
 */
export async function connectAppleHealth(): Promise<void> {
  logHealth('connect: asking iOS for Health permission')
  const Health = await plugin()
  const av = await Health.isAvailable()
  if (!av.available) throw new Error(av.reason || 'Apple Health is not available on this device')
  await Health.requestAuthorization({ read: READ, write: [...WRITE, ...WRITE_EXTRA] })
  await setSetting(HEALTH_KEYS.connected, true)
  logHealth('connect: permission answered — connected')
}

/** "Check again": if iOS already has permission, a tiny read works — mark connected. */
export async function probeAppleHealth(): Promise<boolean> {
  try {
    const Health = await plugin()
    await Health.readSamples({ dataType: 'steps', startDate: dayjs().subtract(1, 'day').toISOString(), endDate: dayjs().toISOString(), limit: 5 })
    await setSetting(HEALTH_KEYS.connected, true)
    logHealth('check: Apple Health answered — connected')
    return true
  } catch (e) { logHealth('check failed', e); return false }
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
  logHealth(`sync: last ${days} days`)
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
  } catch (e) { logHealth('steps not shared', e) }

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
  } catch (e) { logHealth('weight not shared', e) }

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
  } catch (e) { logHealth('workouts not shared', e) }

  // v10: sleep (Apple Watch / iPhone / sleep apps) per morning, plus HRV and resting HR
  try {
    const { samples } = await Health.readSamples({ dataType: 'sleep', startDate: iso(start.subtract(1, 'day')), endDate: iso(end), limit: 500, ascending: true })
    const byMorning = new Map<string, { asleep: number; deep: number; rem: number; core: number; awake: number; bed?: string; wake?: string }>()
    for (const sm of samples) {
      const day = dayjs(sm.endDate).format('YYYY-MM-DD')
      const b = byMorning.get(day) ?? { asleep: 0, deep: 0, rem: 0, core: 0, awake: 0 }
      const add = (stage: string | undefined, mins: number) => {
        if (stage === 'deep') { b.deep += mins; b.asleep += mins }
        else if (stage === 'rem') { b.rem += mins; b.asleep += mins }
        else if (stage === 'light' || stage === 'asleep') { b.core += mins; b.asleep += mins }
        else if (stage === 'awake') b.awake += mins
      }
      if (sm.stages?.length) for (const st of sm.stages) add(st.stage, st.durationMinutes)
      else add(sm.sleepState, (new Date(sm.endDate).getTime() - new Date(sm.startDate).getTime()) / 60000)
      if (!b.bed || sm.startDate < b.bed) b.bed = sm.startDate
      if (!b.wake || sm.endDate > b.wake) b.wake = sm.endDate
      byMorning.set(day, b)
    }
    for (const [date, b] of byMorning) {
      if (b.asleep < 60) continue
      const prev = await db.checkins.get(date)
      if (prev?.sleepSource === 'manual' && prev.sleepHours) continue // never overwrite what you typed
      await saveCheckin({ date, sleepHours: Math.round((b.asleep / 60) * 10) / 10, sleepSource: 'health',
        bedTime: b.bed ? dayjs(b.bed).format('HH:mm') : prev?.bedTime, wakeTime: b.wake ? dayjs(b.wake).format('HH:mm') : prev?.wakeTime,
        sleepStages: { deep: Math.round(b.deep), rem: Math.round(b.rem), core: Math.round(b.core), awake: Math.round(b.awake) } })
    }
  } catch (e) { logHealth('sleep not shared', e) }
  for (const [type, key] of [['restingHeartRate', 'restingHr'], ['heartRateVariability', 'hrv']] as const) {
    try {
      const { samples } = await Health.queryAggregated({ dataType: type, startDate: iso(start), endDate: iso(end), bucket: 'day', aggregation: 'average' })
      for (const s2 of samples) {
        const v = Math.round(s2.values.average ?? s2.value ?? 0)
        if (v > 0) await saveCheckin({ date: dayjs(s2.startDate).format('YYYY-MM-DD'), [key]: v })
      }
    } catch (e) { logHealth('not shared', e) }
  }

  // today's active calories + latest resting heart rate for the Today screen
  const today: HealthToday = { date: dayjs().format('YYYY-MM-DD') }
  try {
    const { samples } = await Health.queryAggregated({ dataType: 'calories', startDate: iso(dayjs().startOf('day')), endDate: iso(end), bucket: 'day', aggregation: 'sum' })
    const k = samples.reduce((s, x) => s + (x.values.sum ?? x.value ?? 0), 0)
    if (k > 0) today.activeKcal = out.activeKcal = Math.round(k)
  } catch (e) { logHealth('active energy not shared', e) }
  try {
    const { samples } = await Health.readSamples({ dataType: 'restingHeartRate', startDate: iso(dayjs().subtract(7, 'day')), endDate: iso(end), limit: 1, ascending: false })
    if (samples[0]) today.restingHr = Math.round(samples[0].value)
  } catch (e) { logHealth('resting HR not shared', e) }
  const c = await db.checkins.get(today.date)
  today.steps = c?.steps
  await setSetting(HEALTH_KEYS.today, today)
  await setSetting(HEALTH_KEYS.lastSync, new Date().toISOString())
  logHealth(`sync done: ${out.steps} step days, ${out.weighIns} weigh-ins, ${out.workouts} workouts`)
  return out
}

/** called after a weigh-in is saved in Ironverse */
export async function saveWeighInToHealth(kg: number, dateIso?: string): Promise<void> {
  if (!isNativeApp() || !(await healthConnected())) return
  if (!(await getSetting<boolean>(HEALTH_KEYS.writeWeight, false))) return
  try { await (await plugin()).saveSample({ dataType: 'weight', value: kg, unit: 'kilogram', startDate: dateIso, endDate: dateIso }) } catch (e) { logHealth('write not allowed', e) }
}

/** v10: a water log saved in Ironverse → Apple Health (only when that switch is on) */
export async function saveWaterToHealth(ml: number, atIso?: string): Promise<void> {
  if (!isNativeApp() || !(await healthConnected()) || !(await getSetting<boolean>(HEALTH_KEYS.writeWater, false))) return
  try { await (await plugin()).saveSample({ dataType: 'dietaryWater', value: ml / 1000, unit: 'liter', startDate: atIso, endDate: atIso }) } catch (e) { logHealth('not allowed', e) }
}

/** v10: food energy logged in Ironverse → Apple Health (only when that switch is on) */
export async function saveFoodEnergyToHealth(kcal: number, atIso?: string): Promise<void> {
  if (!isNativeApp() || !(await healthConnected()) || !(await getSetting<boolean>(HEALTH_KEYS.writeFood, false))) return
  try { await (await plugin()).saveSample({ dataType: 'dietaryEnergyConsumed', value: kcal, unit: 'kilocalorie', startDate: atIso, endDate: atIso }) } catch (e) { logHealth('not allowed', e) }
}
