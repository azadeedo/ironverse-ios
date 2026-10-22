// ============================================================
// Apple Watch link (v10, 23 Oct 2026) — iPhone side.
//
// Sends the Watch a small snapshot (application context, {json}) whenever
// something relevant changes, and handles the Watch's actions:
//   water {ml} · creatine · setDone {logId, ex, set, reps?, kg?}
// Every action carries an id; the Watch keeps it queued until we reply
// {ok, id}, and ids already handled are remembered so a resend never doubles up.
// App Store build only; a no-op in a browser. Watch code: ios/App/IronverseWatch.
// ============================================================

import { db, getActivePlan, getProfile, getSetting, setSetting } from '@/db'
import { byId } from '@/data/exercises'
import { isNativeApp } from '@/lib/edition'
import { dayjs } from '@/lib/fmt'
import { newId, todayStr } from '@/lib/id'
import { creatineDoseFor } from '@/lib/owner'
import { recoveryScore } from '@/lib/sleep'
import { targetForDateWith } from '@/screens/food/helpers'
import type { WorkoutLog } from '@/db/types'

const DONE_KEY = 'watch:handledIds'

export interface WatchSnapshot {
  updatedAt: string
  name?: string
  kcalLeft: number; kcalTarget: number
  protein: number; proteinTarget: number
  waterMl: number; waterTargetMl: number
  creatineTaken: boolean; creatineGrams?: number
  steps?: number
  recovery?: number; recoveryZone?: string
  workout?: { logId?: string; title: string; exercises: { index: number; name: string; restSec: number; sets: { reps?: number; kg?: number; done: boolean }[] }[] }
}

/** pure-ish: everything the Watch shows, from the local database */
export async function buildSnapshot(): Promise<WatchSnapshot> {
  const today = todayStr()
  const p = await getProfile()
  const food = await db.foodLog.where('date').equals(today).toArray()
  const water = await db.waterLog.where('date').equals(today).toArray()
  const creatine = await db.creatineLog.where('date').equals(today).first()
  const checkins = await db.checkins.where('date').aboveOrEqual(new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10)).toArray()
  const adj = await db.dayAdjust.get(today)
  const kcal = food.reduce((s, f) => s + f.kcal, 0)
  const target = p ? Math.round(targetForDateWith(today, p, adj ? new Map([[today, adj]]) : undefined)) : 0
  const rec = recoveryScore(checkins.find((c) => c.date === today), checkins, await getSetting<number>('sleep:targetHours', 8))

  // today's session: an unfinished log first, otherwise today's planned day (read-only on the Watch)
  const logs = await db.workoutLogs.where('date').equals(today).toArray()
  const open = logs.filter((l) => !l.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] as WorkoutLog | undefined
  let workout: WatchSnapshot['workout']
  if (open) {
    workout = {
      logId: open.id, title: open.title,
      exercises: open.exercises.map((e, i) => ({
        index: i, name: byId.get(e.exerciseId)?.name ?? e.exerciseId, restSec: 90,
        sets: e.sets.filter((s) => !s.warmup).map((s) => ({ reps: s.reps ?? s.targetReps?.[1], kg: s.weightKg, done: s.done })),
      })),
    }
  } else {
    const plan = await getActivePlan()
    const day = plan?.weeks[0]?.days[0] && (await import('@/screens/today/lib')).resolvePlanDay(plan, today)
    if (day) workout = {
      title: day.day.title,
      exercises: day.day.exercises.map((e, i) => ({ index: i, name: byId.get(e.exerciseId)?.name ?? e.exerciseId, restSec: e.restSec, sets: Array.from({ length: e.sets }, () => ({ reps: e.reps[1], kg: e.weightKg, done: false })) })),
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    name: p?.name,
    kcalLeft: target - Math.round(kcal), kcalTarget: target,
    protein: Math.round(food.reduce((s, f) => s + f.protein, 0)), proteinTarget: p?.proteinTarget ?? 0,
    waterMl: water.reduce((s, w) => s + w.ml, 0), waterTargetMl: p?.waterTargetMl ?? 0,
    creatineTaken: !!creatine?.taken, creatineGrams: p ? creatineDoseFor(p, today).grams : undefined,
    steps: checkins.find((c) => c.date === today)?.steps,
    recovery: rec.score ?? undefined, recoveryZone: rec.zone ?? undefined,
    workout,
  }
}

/** apply one action from the Watch; returns false if it couldn't be applied */
export async function applyWatchAction(a: Record<string, unknown>): Promise<boolean> {
  const id = String(a.id ?? '')
  const handled = await getSetting<string[]>(DONE_KEY, [])
  if (id && handled.includes(id)) return true // a resend — already done
  const at = typeof a.at === 'string' ? a.at : new Date().toISOString()
  // count it on the day it happened on the wrist (offline actions sync later)
  const date = dayjs(at).isValid() ? dayjs(at).format('YYYY-MM-DD') : todayStr()
  let ok = true
  if (a.type === 'water') {
    const ml = Number(a.ml) || 0
    if (ml > 0) await db.waterLog.put({ id: newId(), date, ml, at, drink: 'Apple Watch' })
  } else if (a.type === 'creatine') {
    const prev = await db.creatineLog.where('date').equals(date).first()
    await db.creatineLog.put({ id: prev?.id ?? newId(), date, taken: true, at })
  } else if (a.type === 'setDone') {
    const log = await db.workoutLogs.get(String(a.logId))
    const ex = Number(a.ex), set = Number(a.set)
    const e = log?.exercises[ex]
    const working = e ? e.sets.filter((s) => !s.warmup) : []
    const target = working[set]
    if (!log || !e || !target) ok = false
    else {
      target.done = true
      if (typeof a.reps === 'number') target.reps = a.reps
      else if (target.reps === undefined) target.reps = target.targetReps?.[1]
      if (typeof a.kg === 'number') target.weightKg = a.kg
      await db.workoutLogs.put(log)
    }
  } else ok = false
  if (id) await setSetting(DONE_KEY, [...handled, id].slice(-300))
  return ok
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
export function schedulePush(): void {
  if (!isNativeApp()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => { void pushToWatch() }, 1200)
}

export async function pushToWatch(): Promise<void> {
  try {
    const { CapgoWatch } = await import('@capgo/capacitor-watch')
    const info = await CapgoWatch.getInfo()
    if (!info.isSupported || !info.isPaired || !info.isWatchAppInstalled) return
    await CapgoWatch.updateApplicationContext({ context: { json: JSON.stringify(await buildSnapshot()) } })
  } catch { /* no watch, or not activated yet */ }
}

export async function watchStatus(): Promise<{ supported: boolean; paired: boolean; installed: boolean; reachable: boolean }> {
  if (!isNativeApp()) return { supported: false, paired: false, installed: false, reachable: false }
  try {
    const { CapgoWatch } = await import('@capgo/capacitor-watch')
    const i = await CapgoWatch.getInfo()
    return { supported: i.isSupported, paired: i.isPaired, installed: i.isWatchAppInstalled, reachable: i.isReachable }
  } catch { return { supported: false, paired: false, installed: false, reachable: false } }
}

export async function initWatch(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { CapgoWatch } = await import('@capgo/capacitor-watch')
    await CapgoWatch.addListener('messageReceivedWithReply', (e) => {
      void applyWatchAction(e.message).then((ok) => {
        void CapgoWatch.replyToMessage({ callbackId: e.callbackId, data: { ok, id: String(e.message.id ?? '') } })
        schedulePush()
      })
    })
    await CapgoWatch.addListener('messageReceived', (e) => { void applyWatchAction(e.message).then(schedulePush) })
    await CapgoWatch.addListener('userInfoReceived', (e) => { void applyWatchAction(e.userInfo).then(schedulePush) })
    await CapgoWatch.addListener('reachabilityChanged', () => schedulePush())
    // keep the Watch current as you log on the phone
    for (const t of [db.workoutLogs, db.waterLog, db.creatineLog, db.foodLog, db.checkins] as const) {
      t.hook('creating', () => { schedulePush() })
      t.hook('updating', () => { schedulePush() })
      t.hook('deleting', () => { schedulePush() })
    }
    schedulePush()
  } catch { /* plugin missing */ }
}
