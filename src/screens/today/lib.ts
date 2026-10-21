// Today-screen helpers: plan-day resolution, streak maths, reminder syncing,
// protein pacing, adaptive targets, Ramadan/prayer fallbacks and long-shift
// honesty. Local to the Today module — never touches shared libs.

import { dayjs } from '@/lib/fmt'
import type {
  FoodLogEntry, MealKey, Plan, PlanDay, PrayerConfig, Profile, RamadanConfig, ReminderConfig,
} from '@/db/types'
import { dayForDate } from '@/lib/plangen'
import { dayIdFor, programDayOn, programWeekFor } from '@/lib/program12'
import { addMinutes, minutesOf, todayTimeline, type TimelineItem } from '@/lib/schedule'
import { cancelKey, ensurePermission, scheduleAt } from '@/lib/notify'

// ---------- plan day for a calendar date ----------

export interface TodayPlanDay {
  day: PlanDay
  weekIndex: number
  weekLabel: string
  /** 1-based position within the training week */
  dayNumber: number
}

/** Which plan day (if any) falls on `dateStr` — thin adapter over plangen's calendar mapping. */
export function resolvePlanDay(plan: Plan, dateStr: string): TodayPlanDay | null {
  // the 12-week program honours repeated weeks; the generic calendar does not
  if (plan.program === 'p12') {
    const on = programDayOn(plan, dateStr)
    const pw = programWeekFor(plan, dateStr)
    if (!on || !pw.started || pw.finished) return null
    const dk = on.dk
    const week = plan.weeks[on.week - 1]
    const idx = week?.days.findIndex((d) => d.id === dayIdFor(on.week, dk)) ?? -1
    if (!week || idx < 0) return null
    return { day: week.days[idx], weekIndex: week.index, weekLabel: week.label, dayNumber: idx + 1 }
  }
  const ref = dayForDate(plan, dateStr)
  if (!ref) return null
  return { day: ref.day, weekIndex: ref.week.index, weekLabel: ref.week.label, dayNumber: ref.dayIndex + 1 }
}

// ---------- streak ----------

/** consecutive days (ending today, or yesterday if today is still empty) with any activity */
export function computeStreak(activeDates: Set<string>, today: string): number {
  let cursor = dayjs(today)
  if (!activeDates.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day')
  let streak = 0
  while (activeDates.has(cursor.format('YYYY-MM-DD'))) {
    streak += 1
    cursor = cursor.subtract(1, 'day')
  }
  return streak
}

// ---------- time formatting ----------

/** '17:45' → '5:45 pm' */
export function fmt12(hhmm: string): string {
  return dayjs(`2000-01-01 ${hhmm}`).format('h:mm a')
}

export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

// ---------- reminder scheduling (same-day, while the app is open) ----------

let permissionAsked = false
let scheduledKeys: string[] = []

function copyFor(item: TimelineItem, p: Profile, dayTitle?: string): [string, string] {
  switch (item.kind) {
    case 'water':
      return ['Hydration', `Time for a drink — ${(p.waterTargetMl / 1000).toFixed(1)} L is today's target.`]
    case 'creatine':
      return ['Creatine', `${p.creatineGrams} g scoop — same time every day works best.`]
    case 'workout':
      return ['Workout time', `${dayTitle ?? 'Training'} — the garage is waiting.`]
    case 'work-start':
      return ['Work starts', 'Head down — training comes later.']
    case 'work-end':
      return ['Work ends', 'Wrap up, refuel, then move.']
  }
}

/**
 * (Re)schedule every future timeline item as a same-day notification.
 * Keys are stable (`water-3`), so re-running simply replaces timers; keys that
 * fell out of the timeline get cancelled. Timers deliberately survive
 * navigation away from Today — they ring while Ironverse stays open.
 */
export async function syncReminders(
  p: Profile,
  r: ReminderConfig,
  isTrainingDay: boolean,
  dayTitle?: string,
): Promise<void> {
  const anyEnabled = r.waterEnabled || r.creatineEnabled || r.workoutEnabled
  if (!anyEnabled) {
    scheduledKeys.forEach(cancelKey)
    scheduledKeys = []
    return
  }
  if (!permissionAsked) {
    permissionAsked = true
    await ensurePermission() // falls back to in-app toasts when denied
  }
  const now = nowMinutes()
  // IV-36: never remind about something already done today
  const done = await doneToday(p)
  const guard = (kind: string) => async () => !(await doneToday(p))[kind as keyof Awaited<ReturnType<typeof doneToday>>]
  const items = todayTimeline(p, r, isTrainingDay).filter((it) => !done[it.kind as keyof typeof done])
  const next: string[] = []
  items.forEach((item, i) => {
    if (minutesOf(item.time) <= now) return
    const key = `${item.kind}-${i}`
    const [title, body] = copyFor(item, p, dayTitle)
    scheduleAt(key, item.time, title, body, guard(item.kind))
    next.push(key)
  })
  // early heads-up before the workout window
  const workout = items.find((i) => i.kind === 'workout')
  if (workout && r.workoutEnabled && r.workoutLeadMin > 0) {
    const lead = addMinutes(workout.time, -r.workoutLeadMin)
    if (minutesOf(lead) > now && minutesOf(lead) < minutesOf(workout.time)) {
      scheduleAt(
        'workout-lead',
        lead,
        `Workout in ${r.workoutLeadMin} min`,
        `${dayTitle ?? 'Training'} at ${fmt12(workout.time)} — start winding up.`,
      )
      next.push('workout-lead')
    }
  }
  for (const key of scheduledKeys) if (!next.includes(key)) cancelKey(key)
  scheduledKeys = next
}

/** what has already been done today — used to skip reminders */
export async function doneToday(p: Profile): Promise<{ water: boolean; creatine: boolean; workout: boolean }> {
  const { db } = await import('@/db')
  const t = dayjs().format('YYYY-MM-DD')
  const [water, crea, logs] = await Promise.all([
    db.waterLog.where('date').equals(t).toArray(),
    db.creatineLog.where('date').equals(t).toArray(),
    db.workoutLogs.where('date').equals(t).toArray(),
  ])
  return {
    water: water.reduce((a, w) => a + w.ml, 0) >= (p.waterTargetMl || 3000),
    creatine: crea.some((c) => c.taken),
    workout: logs.some((l) => !!l.finishedAt && !l.skipped),
  }
}

// ============================================================
// Defensive loaders — helpers other agents are still building.
// A missing module must NEVER break Today, so every call goes through a
// try/catch and every feature has a local fallback that works on its own.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/** `@/lib/islamic` if it exists yet, otherwise null. */
export async function loadIslamic(): Promise<any | null> {
  try {
    // @ts-ignore — another agent owns this module; it may not exist yet.
    return await import('@/lib/islamic')
  } catch {
    return null
  }
}

/** `@/lib/training` if it exists yet, otherwise null. */
export async function loadTraining(): Promise<any | null> {
  try {
    return (await import('@/lib/training')) as any
  } catch {
    return null
  }
}

/**
 * Plan day for a date, preferring plangen's `effectiveDayForDate` (which folds
 * in program overrides) and falling back to the plain calendar mapping.
 */
export async function resolvePlanDayEffective(
  plan: Plan,
  dateStr: string,
): Promise<TodayPlanDay | null> {
  try {
    const pg = (await import('@/lib/plangen')) as any
    if (typeof pg.effectiveDayForDate === 'function') {
      const ref = await pg.effectiveDayForDate(plan, dateStr)
      if (ref && ref.day && ref.week) {
        return {
          day: ref.day,
          weekIndex: ref.week.index ?? 1,
          weekLabel: ref.week.label ?? '',
          dayNumber: (ref.dayIndex ?? 0) + 1,
        }
      }
      if (ref === null) return null
    }
  } catch {
    /* fall through to the plain mapping */
  }
  return resolvePlanDay(plan, dateStr)
}

// ============================================================
// Streaks — kind by design. A missed day is a gap, not a failure.
// ============================================================

export interface StreakInfo {
  /** consecutive qualifying days ending today (or yesterday if today is still open) */
  days: number
  /** true when today already counts */
  todayDone: boolean
}

/**
 * Consecutive qualifying days walking backwards from today.
 * `skip` marks days that don't count either way (rest days for training).
 * Today never breaks a streak — the day isn't over yet.
 */
export function streakOf(
  qualified: Set<string>,
  today: string,
  skip: (date: string) => boolean = () => false,
): StreakInfo {
  const key = (d: ReturnType<typeof dayjs>) => d.format('YYYY-MM-DD')
  const todayDone = qualified.has(today)
  let cursor = dayjs(today)
  if (!todayDone) cursor = cursor.subtract(1, 'day')
  let days = 0
  for (let guard = 0; guard < 400; guard++) {
    const k = key(cursor)
    if (skip(k)) {
      cursor = cursor.subtract(1, 'day')
      continue
    }
    if (!qualified.has(k)) break
    days += 1
    cursor = cursor.subtract(1, 'day')
  }
  return { days, todayDone }
}

/** Honest, never guilt-based copy for a streak count. */
export function streakLine(info: StreakInfo, unitDone: string, unitOpen: string): string {
  if (info.days === 0) return info.todayDone ? unitDone : `Fresh start — ${unitOpen}`
  if (info.days === 1) return info.todayDone ? '1 day in' : 'Yesterday counted'
  return info.todayDone ? `${info.days} days running` : `${info.days} days — today's still open`
}

// ============================================================
// Protein pacing — how much is left, and how it splits across the meals
// he actually has left today.
// ============================================================

export const MEAL_SLOTS: { key: MealKey; label: string; endMin: number }[] = [
  { key: 'breakfast', label: 'breakfast', endMin: 10 * 60 + 30 },
  { key: 'lunch', label: 'lunch', endMin: 15 * 60 },
  { key: 'dinner', label: 'dinner', endMin: 20 * 60 + 30 },
  { key: 'snacks', label: 'a snack', endMin: 24 * 60 },
]

export interface ProteinPacing {
  target: number
  eaten: number
  remaining: number
  /** meal slots still empty and still ahead */
  slotsLeft: { key: MealKey; label: string }[]
  perSlot: number
  /** ready-to-render line, always honest, never a nag */
  line: string
  done: boolean
}

export function proteinPacing(
  entries: FoodLogEntry[],
  target: number,
  nowMin: number,
): ProteinPacing {
  const eaten = Math.round(entries.reduce((s, e) => s + (e.protein || 0), 0))
  const remaining = Math.max(0, Math.round(target - eaten))
  const used = new Set(entries.map((e) => e.meal))

  let slotsLeft = MEAL_SLOTS.filter((s) => !used.has(s.key) && s.endMin > nowMin)
    .map((s) => ({ key: s.key, label: s.label }))
  // late in the day with nothing left on the board — snacks are still a slot
  if (slotsLeft.length === 0 && remaining > 0) slotsLeft = [{ key: 'snacks', label: 'a snack' }]

  const perSlot = slotsLeft.length ? Math.round(remaining / slotsLeft.length) : remaining
  const done = remaining <= 0

  let line: string
  if (done) {
    line = `${eaten}g in — protein's handled for today.`
  } else if (slotsLeft.length === 1) {
    line = `${remaining}g left · all of it on ${slotsLeft[0].label}.`
  } else {
    line = `${remaining}g left · about ${perSlot}g at each of your remaining ${slotsLeft.length} meals.`
  }

  return { target, eaten, remaining, slotsLeft, perSlot, line, done }
}

// ============================================================
// Long-shift honesty — a 10+ hour day with a session parked after it.
// ============================================================

export interface LongShift {
  hours: number
  /** 'HH:mm' the shift ends */
  endsAt: string
  /** the session is scheduled after the shift ends */
  afterWork: boolean
}

export const LONG_SHIFT_HOURS = 10

export function longShiftToday(p: Profile, dateStr: string, slotTime?: string): LongShift | null {
  const wd = p.workSchedule.find((w) => w.day === dayjs(dateStr).day())
  if (!wd?.working || !wd.start || !wd.end) return null
  const hours = (minutesOf(wd.end) - minutesOf(wd.start)) / 60
  if (hours < LONG_SHIFT_HOURS) return null
  const afterWork = slotTime ? minutesOf(slotTime) >= minutesOf(wd.end) : true
  return { hours: Math.round(hours * 10) / 10, endsAt: wd.end, afterWork }
}

/** How many exercises a cut-down version keeps, and roughly how long it runs. */
export function shortVersion(day: PlanDay, keep = 2): { keep: number; minutes: number } {
  const n = Math.min(keep, day.exercises.length)
  const kept = day.exercises.slice(0, n)
  const seconds = kept.reduce((s, pe) => s + pe.sets * ((pe.timeSec ?? 45) + pe.restSec), 0)
  return { keep: n, minutes: Math.max(10, Math.round(seconds / 60) + 5) }
}

// ============================================================
// Ramadan / prayer fallbacks.
// Used verbatim when `@/lib/islamic` isn't there yet, and as the safety net
// when it is but returns something we can't read.
// ============================================================

export interface TrainingSlotView {
  /** 'HH:mm' */
  time: string
  label: string
  why: string
}

const WINDOW_LABELS: Record<RamadanConfig['trainingWindow'], string> = {
  'before-iftar': 'Before iftar',
  'after-iftar': 'After iftar',
  'after-taraweeh': 'After taraweeh',
  'before-suhoor': 'Before suhoor',
}

export function localRamadanSlot(cfg: RamadanConfig): TrainingSlotView {
  switch (cfg.trainingWindow) {
    case 'before-iftar':
      return {
        time: addMinutes(cfg.iftarTime, -75),
        label: WINDOW_LABELS['before-iftar'],
        why: 'Fasted and finishing right on iftar, so food and water land straight after the last set.',
      }
    case 'after-taraweeh':
      return {
        time: addMinutes(cfg.iftarTime, 180),
        label: WINDOW_LABELS['after-taraweeh'],
        why: 'Late, but fed and hydrated — the strongest you will feel all day.',
      }
    case 'before-suhoor':
      return {
        time: addMinutes(cfg.suhoorTime, -75),
        label: WINDOW_LABELS['before-suhoor'],
        why: 'Trained on a full night of food, with suhoor waiting straight afterwards.',
      }
    default:
      return {
        time: addMinutes(cfg.iftarTime, 75),
        label: WINDOW_LABELS['after-iftar'],
        why: 'An hour or so after iftar — food down, water in, before the night gets away.',
      }
  }
}

export interface HydrationStop { time: string; ml: number; label: string }

/** Spread the day's water across the eating window, iftar → suhoor. */
export function localRamadanHydration(cfg: RamadanConfig, targetMl: number): HydrationStop[] {
  const start = minutesOf(cfg.iftarTime)
  const end = minutesOf(cfg.suhoorTime) + (minutesOf(cfg.suhoorTime) < start ? 1440 : 0)
  const stops = 4
  const step = Math.max(30, Math.round((end - start) / stops))
  const per = Math.max(100, Math.round(targetMl / stops / 50) * 50)
  const labels = ['Break the fast', 'After maghrib', 'Through the evening', 'With suhoor']
  return Array.from({ length: stops }, (_, i) => ({
    time: addMinutes(cfg.iftarTime, i * step),
    ml: per,
    label: labels[i] ?? 'Top up',
  }))
}

export const PRAYER_NAMES: { key: keyof PrayerConfig['times']; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
]

export interface PrayerClash { label: string; time: string }

/** Does a session starting at `slot` run into a prayer window? */
export function localPrayerClash(
  slot: string,
  sessionMin: number,
  cfg: PrayerConfig,
): PrayerClash | null {
  const from = minutesOf(slot)
  const to = from + sessionMin
  for (const p of PRAYER_NAMES) {
    const t = minutesOf(cfg.times[p.key])
    if (!Number.isFinite(t)) continue
    const blockFrom = t - cfg.bufferMin
    const blockTo = t + cfg.bufferMin
    if (from < blockTo && to > blockFrom) return { label: p.label, time: cfg.times[p.key] }
  }
  return null
}

/** The first clear start time at or after `slot` (15-minute steps, 6-hour search). */
export function localSuggestAroundPrayer(
  slot: string,
  sessionMin: number,
  cfg: PrayerConfig,
): string | null {
  for (let i = 1; i <= 24; i++) {
    const candidate = addMinutes(slot, i * 15)
    if (minutesOf(candidate) < minutesOf(slot)) break // rolled past midnight
    if (!localPrayerClash(candidate, sessionMin, cfg)) return candidate
  }
  return null
}

/** Coerce whatever the shared module returns into a slot view we can render. */
export function coerceSlotView(value: unknown, fallback: TrainingSlotView): TrainingSlotView {
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) return { ...fallback, time: value }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    const time = typeof v.time === 'string' ? v.time : typeof v.start === 'string' ? v.start : fallback.time
    const label = typeof v.label === 'string' ? v.label : fallback.label
    const why =
      typeof v.why === 'string' ? v.why
      : typeof v.reason === 'string' ? v.reason
      : typeof v.note === 'string' ? v.note
      : fallback.why
    return { time, label, why }
  }
  return fallback
}

/** Coerce a hydration plan into renderable stops. */
export function coerceHydration(value: unknown, fallback: HydrationStop[]): HydrationStop[] {
  if (!Array.isArray(value) || value.length === 0) return fallback
  const out: HydrationStop[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const v = raw as Record<string, unknown>
    const time = typeof v.time === 'string' ? v.time : typeof v.at === 'string' ? v.at : null
    if (!time) continue
    const ml = typeof v.ml === 'number' ? v.ml : typeof v.amountMl === 'number' ? v.amountMl : 0
    const label = typeof v.label === 'string' ? v.label : 'Top up'
    out.push({ time, ml, label })
  }
  return out.length ? out : fallback
}
