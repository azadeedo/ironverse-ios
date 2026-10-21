// ============================================================
// Ramadan mode, prayer-aware scheduling and the long-shift reality check.
//
// Everything here is PRACTICAL COACHING, not medical or religious ruling:
//  - prayer times are the ones HE typed in. Nothing is calculated from a
//    location, nothing is fetched, nothing is authoritative.
//  - Ramadan helpers shift training, water and creatine into the eating
//    window (iftar → suhoor) instead of spreading them across the clock.
//  - the roster helpers exist because a 10-10 pharmacy shift is a real
//    constraint, and pretending otherwise is how plans get abandoned.
//
// Pure functions only — no React, no Dexie, no network.
// ============================================================

import { prayerConfig, ramadanConfig } from '@/db/defaults'
import type { PrayerConfig, Profile, RamadanConfig, WorkDay } from '@/db/types'
import { addMinutes, DAY_NAMES, minutesOf } from './schedule'

// ------------------------------------------------------------
// shared time helpers (all minutes-of-day, wrap-around aware)
// ------------------------------------------------------------

const DAY_MIN = 1440

/** Minutes from `from` forward to `to`, crossing midnight if needed. */
export function forwardSpan(from: string, to: string): number {
  const span = minutesOf(to) - minutesOf(from)
  return span >= 0 ? span : span + DAY_MIN
}

/** '17:45' → '5:45 pm' (same style the rest of the app uses). */
export function fmtTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ============================================================
// RAMADAN
// ============================================================

export const RAMADAN_WINDOW_LABELS: Record<RamadanConfig['trainingWindow'], string> = {
  'before-iftar': 'Just before iftar',
  'after-iftar': 'After iftar',
  'after-taraweeh': 'After taraweeh',
  'before-suhoor': 'Before suhoor',
}

export const RAMADAN_WINDOW_OPTIONS: { value: RamadanConfig['trainingWindow']; label: string }[] =
  (Object.keys(RAMADAN_WINDOW_LABELS) as RamadanConfig['trainingWindow'][])
    .map((value) => ({ value, label: RAMADAN_WINDOW_LABELS[value] }))

/** True when Ramadan mode is on AND today falls inside the optional date range. */
export function isRamadanActive(p?: Profile | null, date = new Date()): boolean {
  const cfg = ramadanConfig(p)
  if (!cfg.enabled) return false
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (cfg.startDate && today < cfg.startDate) return false
  if (cfg.endDate && today > cfg.endDate) return false
  return true
}

/** Length of the eating window, iftar → suhoor, in minutes. */
export function eatingWindowMinutes(cfg: RamadanConfig): number {
  return forwardSpan(cfg.iftarTime, cfg.suhoorTime)
}

export interface RamadanSlot {
  /** suggested session start 'HH:mm' */
  time: string
  /** which window this came from */
  window: RamadanConfig['trainingWindow']
  label: string
  /** one honest line explaining the pick */
  rationale: string
  /** session length this slot was built for */
  sessionMinutes: number
}

/**
 * Suggested training time while fasting, with a one-line reason.
 * Uses the entered isha time for taraweeh when prayer times are switched on,
 * otherwise falls back to iftar + 3h — and says so.
 */
export function ramadanTrainingSlot(p?: Profile | null): RamadanSlot {
  const cfg = ramadanConfig(p)
  const prayer = prayerConfig(p)
  const sessionMinutes = cfg.maintenanceVolume
    ? Math.min(p?.sessionMinutes ?? 60, 40)
    : (p?.sessionMinutes ?? 60)

  switch (cfg.trainingWindow) {
    case 'before-iftar': {
      const time = addMinutes(cfg.iftarTime, -(sessionMinutes + 10))
      return {
        time,
        window: cfg.trainingWindow,
        label: RAMADAN_WINDOW_LABELS[cfg.trainingWindow],
        sessionMinutes,
        rationale: `Finishing at ${fmtTime12(cfg.iftarTime)} means water and food are minutes away — keep it short and skip the finishers.`,
      }
    }
    case 'after-taraweeh': {
      const base = prayer.enabled ? addMinutes(prayer.times.isha, 75) : addMinutes(cfg.iftarTime, 180)
      return {
        time: base,
        window: cfg.trainingWindow,
        label: RAMADAN_WINDOW_LABELS[cfg.trainingWindow],
        sessionMinutes,
        rationale: prayer.enabled
          ? `About 75 minutes after the isha time you entered — food has settled and there is no clock-watching.`
          : `Roughly three hours after iftar. Turn prayer times on and this follows your isha time instead.`,
      }
    }
    case 'before-suhoor': {
      const time = addMinutes(cfg.suhoorTime, -(sessionMinutes + 20))
      return {
        time,
        window: cfg.trainingWindow,
        label: RAMADAN_WINDOW_LABELS[cfg.trainingWindow],
        sessionMinutes,
        rationale: `Train, then eat suhoor at ${fmtTime12(cfg.suhoorTime)} — the best-fed option, but only if you can protect the sleep.`,
      }
    }
    case 'after-iftar':
    default: {
      const time = addMinutes(cfg.iftarTime, 60)
      return {
        time,
        window: 'after-iftar',
        label: RAMADAN_WINDOW_LABELS['after-iftar'],
        sessionMinutes,
        rationale: `An hour after iftar — fluids and a first meal are in, and you still have the whole eating window to refuel afterwards.`,
      }
    }
  }
}

export interface HydrationSlot {
  time: string
  ml: number
  label: string
}

export interface RamadanHydrationPlan {
  targetMl: number
  /** iftar → suhoor, in minutes */
  windowMinutes: number
  windowLabel: string
  slots: HydrationSlot[]
  note: string
}

/**
 * Water target split across the EATING window (iftar → suhoor) rather than
 * across the day — during Ramadan the daytime hours simply aren't available.
 */
export function ramadanHydrationPlan(p?: Profile | null): RamadanHydrationPlan {
  const cfg = ramadanConfig(p)
  const targetMl = p?.waterTargetMl ?? 3500
  const windowMinutes = eatingWindowMinutes(cfg)
  // one checkpoint roughly every 90 minutes, kept between 4 and 7 so it stays
  // something a person will actually do
  const count = Math.max(4, Math.min(7, Math.round(windowMinutes / 90)))
  const step = Math.floor(windowMinutes / count)
  const per = Math.round(targetMl / count / 50) * 50

  const slots: HydrationSlot[] = []
  for (let i = 0; i < count; i++) {
    const time = addMinutes(cfg.iftarTime, i * step)
    const label =
      i === 0 ? 'With iftar'
      : i === count - 1 ? 'With suhoor'
      : `Checkpoint ${i + 1}`
    slots.push({ time, ml: per, label })
  }
  // put any rounding remainder on the iftar glass, where it is easiest to drink
  const assigned = per * count
  if (assigned !== targetMl && slots.length > 0) {
    slots[0] = { ...slots[0], ml: Math.max(0, slots[0].ml + (targetMl - assigned)) }
  }

  return {
    targetMl,
    windowMinutes,
    windowLabel: `${fmtTime12(cfg.iftarTime)} → ${fmtTime12(cfg.suhoorTime)} (${fmtHours(windowMinutes)})`,
    slots,
    note: 'Sipping across the whole window beats sinking a litre at iftar — same total, far less sloshing.',
  }
}

export interface CreatineTiming {
  time: string
  rationale: string
}

/** A creatine time that actually falls inside the eating window. */
export function ramadanCreatineTime(p?: Profile | null): CreatineTiming {
  const cfg = ramadanConfig(p)
  const windowMinutes = eatingWindowMinutes(cfg)
  const offset = Math.min(45, Math.max(15, Math.round(windowMinutes * 0.15)))
  const time = addMinutes(cfg.iftarTime, offset)
  return {
    time,
    rationale: `${fmtTime12(time)} — with the meal after iftar, well inside the eating window. Daily total is what matters, not the exact hour.`,
  }
}

// ============================================================
// PRAYER-AWARE SCHEDULING
// ============================================================

export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type PrayerKey = (typeof PRAYER_KEYS)[number]

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

export interface PrayerClash {
  key: PrayerKey
  label: string
  /** the time he entered for that prayer */
  time: string
  /** minutes kept clear either side */
  bufferMin: number
  /** blocked window as 'HH:mm' strings */
  blockedFrom: string
  blockedTo: string
}

function blockedWindow(time: string, bufferMin: number): { from: number; to: number } {
  const t = minutesOf(time)
  return { from: t - bufferMin, to: t + bufferMin }
}

function overlaps(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo
}

/**
 * Does a session starting at `startTime` for `durationMin` run into one of the
 * prayer times HE entered (plus his buffer)? Returns the first clash, or null.
 * Returns null whenever prayer awareness is switched off.
 */
export function conflictsWithPrayer(
  startTime: string,
  durationMin: number,
  p?: Profile | null,
): PrayerClash | null {
  const cfg = prayerConfig(p)
  if (!cfg.enabled) return null
  return clashIn(cfg, startTime, durationMin)
}

function clashIn(cfg: PrayerConfig, startTime: string, durationMin: number): PrayerClash | null {
  const from = minutesOf(startTime)
  const to = from + Math.max(0, durationMin)
  const found: PrayerClash[] = []
  for (const key of PRAYER_KEYS) {
    const time = cfg.times[key]
    if (!time) continue
    const w = blockedWindow(time, cfg.bufferMin)
    if (overlaps(from, to, w.from, w.to)) {
      found.push({
        key,
        label: PRAYER_LABELS[key],
        time,
        bufferMin: cfg.bufferMin,
        blockedFrom: addMinutes(time, -cfg.bufferMin),
        blockedTo: addMinutes(time, cfg.bufferMin),
      })
    }
  }
  if (found.length === 0) return null
  found.sort((a, b) => minutesOf(a.time) - minutesOf(b.time))
  return found[0]
}

export interface PrayerSuggestion {
  time: string
  /** 'earlier' finishes before the prayer; 'later' starts after it */
  direction: 'earlier' | 'later'
  reason: string
}

/**
 * Nearest clear start time around the prayers he entered.
 * Tries finishing before the clashing prayer first (it keeps the evening
 * intact), then starting after it. Returns null if neither lands clean —
 * better to say nothing than to invent a slot.
 */
export function suggestAroundPrayer(
  startTime: string,
  durationMin: number,
  p?: Profile | null,
): PrayerSuggestion | null {
  const cfg = prayerConfig(p)
  if (!cfg.enabled) return null
  const clash = clashIn(cfg, startTime, durationMin)
  if (!clash) return null

  // ---- option A: finish 5 min before the blocked window opens
  let candidate = addMinutes(clash.blockedFrom, -(durationMin + 5))
  if (minutesOf(candidate) >= minutesOf('05:00') && !clashIn(cfg, candidate, durationMin)) {
    return {
      time: candidate,
      direction: 'earlier',
      reason: `Starts early enough to be done before ${clash.label} at ${fmtTime12(clash.time)}.`,
    }
  }

  // ---- option B: start once the blocked window closes (walk forward past any
  // back-to-back prayers, e.g. maghrib → isha)
  candidate = addMinutes(clash.blockedTo, 5)
  for (let i = 0; i < PRAYER_KEYS.length; i++) {
    const next = clashIn(cfg, candidate, durationMin)
    if (!next) {
      if (minutesOf(candidate) + durationMin > minutesOf('23:30')) return null
      return {
        time: candidate,
        direction: 'later',
        reason: `Picks up after ${clash.label} — ${fmtTime12(candidate)} leaves the whole session clear.`,
      }
    }
    candidate = addMinutes(next.blockedTo, 5)
  }
  return null
}

// ============================================================
// WORK ROSTER — the pharmacy reality check
// ============================================================

/** A shift at or over this many hours changes what a realistic session is. */
export const LONG_SHIFT_HOURS = 10

/** Length of a work day in hours (0 when it's a day off). */
export function shiftHours(wd?: WorkDay | null): number {
  if (!wd?.working || !wd.start || !wd.end) return 0
  const mins = minutesOf(wd.end) - minutesOf(wd.start)
  return Math.round((mins > 0 ? mins : mins + DAY_MIN) / 6) / 10
}

export function isLongShift(wd?: WorkDay | null): boolean {
  return shiftHours(wd) >= LONG_SHIFT_HOURS
}

/** The session length worth attempting after a long day on the floor. */
export function cutDownMinutes(sessionMinutes: number): number {
  return Math.max(20, Math.min(30, Math.round(sessionMinutes / 2 / 5) * 5))
}

/**
 * Honest warning when a session is planned on the back of a 10h+ shift.
 * Returns null when the day is normal — no warning, no noise.
 */
export function longShiftWarning(wd?: WorkDay | null, sessionMinutes = 60): string | null {
  if (!isLongShift(wd)) return null
  const hours = shiftHours(wd)
  const rounded = Number.isInteger(hours) ? hours : Math.round(hours)
  return `You're planning to train after a ${rounded}-hour shift — a ${cutDownMinutes(sessionMinutes)}-minute cut-down session is the realistic win here.`
}

/** Same warning, resolved for one weekday of the saved roster. */
export function longShiftWarningForDay(
  schedule: WorkDay[],
  day: number,
  sessionMinutes = 60,
): string | null {
  return longShiftWarning(schedule.find((w) => w.day === day), sessionMinutes)
}

export interface WorkSlotOption {
  kind: 'pre-work' | 'post-work'
  time: string
  label: string
  /** honest note — including when the slot is a bad idea */
  note: string
  /** false when the slot would need an unreasonable wake-up or a late finish */
  realistic: boolean
}

/**
 * Pre-work and post-work options for one rostered day, both always offered so
 * he can see the trade-off rather than being handed a single answer.
 */
export function workSlotOptions(wd: WorkDay, sessionMinutes = 60): WorkSlotOption[] {
  if (!wd.working || !wd.start || !wd.end) {
    return [{
      kind: 'pre-work',
      time: '09:00',
      label: 'Day off',
      note: 'No shift — train whenever suits, this is the day for the longer session.',
      realistic: true,
    }]
  }
  const hours = shiftHours(wd)
  const long = hours >= LONG_SHIFT_HOURS
  const cut = cutDownMinutes(sessionMinutes)

  const preTime = addMinutes(wd.start, -(sessionMinutes + 45))
  const preOk = minutesOf(preTime) >= minutesOf('05:00')
  const postTime = addMinutes(wd.end, 45)
  const postOk = minutesOf(postTime) + (long ? cut : sessionMinutes) <= minutesOf('22:30')

  return [
    {
      kind: 'pre-work',
      time: preTime,
      label: 'Before work',
      note: preOk
        ? `Up and lifting by ${fmtTime12(preTime)}, done before the ${wd.start} start. Banked before the day can take it.`
        : `Would mean starting at ${fmtTime12(preTime)} — too early to repeat, so treat it as a one-off.`,
      realistic: preOk,
    },
    {
      kind: 'post-work',
      time: postTime,
      label: 'After work',
      note: long
        ? `After a ${Math.round(hours)}-hour shift — aim at ${cut} minutes, main lift plus one back-off set, and call that a win.`
        : postOk
          ? `${fmtTime12(postTime)}, after a shower and something to eat.`
          : `${fmtTime12(postTime)} runs late — a short session or a rest day are both honest answers.`,
      realistic: postOk,
    },
  ]
}

/** Common pharmacy patterns, so a 10-10 is two taps instead of two pickers. */
export const SHIFT_PRESETS: { label: string; start: string; end: string }[] = [
  { label: '9–5', start: '09:00', end: '17:00' },
  { label: '8–6', start: '08:00', end: '18:00' },
  { label: '10–10', start: '10:00', end: '22:00' },
  { label: '7–3', start: '07:00', end: '15:00' },
  { label: '12–8', start: '12:00', end: '20:00' },
]

/** Human summary of a rostered week, e.g. 'Mon–Wed, Sat, Sun · 2 long shifts'. */
export function rosterSummary(schedule: WorkDay[]): string {
  const working = schedule.filter((w) => w.working)
  if (working.length === 0) return 'No work days set'
  const names = working
    .slice()
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
    .map((w) => DAY_NAMES[w.day].slice(0, 3))
  const longs = working.filter(isLongShift).length
  const base = names.join(', ')
  return longs > 0 ? `${base} · ${longs} shift${longs === 1 ? '' : 's'} of ${LONG_SHIFT_HOURS}h+` : base
}
