// 10 km treadmill run — pace, speed, calories, splits and progress.
// Calories use the ACSM running equation (VO2 = 0.2·speed + 0.9·speed·grade + 3.5 ml/kg/min,
// speed in m/min), the standard estimate for treadmill running. Still an estimate.
import type { CardioLog } from '@/db/types'

export const RUN_DISTANCE_KM = 10

/**
 * Read a time typed any way the phone keypad allows → seconds (null if unreadable):
 *   "58:30", "58.30", "58,30", "58 30" → 58:30 · "1:02:15", "1.02.15" → 1:02:15
 *   digits only: "530" → 5:30, "5830" → 58:30, "10215" → 1:02:15 (last two digits = seconds)
 *   one or two digits: "60" → 60 minutes
 */
export function parseTime(s: string): number | null {
  const t = s.trim().replace(/[.,\s'"’”:;\/-]+/g, ':').replace(/^:+|:+$/g, '')
  if (!t) return null
  let parts: number[]
  if (/^\d+$/.test(t)) {
    if (t.length <= 2) return Number(t) * 60
    const sec = Number(t.slice(-2)), rest = t.slice(0, -2)
    parts = rest.length > 2 ? [Number(rest.slice(0, -2)), Number(rest.slice(-2)), sec] : [Number(rest), sec]
  } else {
    if (!/^\d+(:\d+){1,2}$/.test(t)) return null
    parts = t.split(':').map(Number)
  }
  if (parts.some((x) => !isFinite(x) || x < 0)) return null
  if (parts.length === 2) { if (parts[1] >= 60) return null; return Math.round(parts[0] * 60 + parts[1]) }
  if (parts[1] >= 60 || parts[2] >= 60) return null
  return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2])
}
export function fmtTime(sec: number): string {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}
export const paceSec = (sec: number, km: number) => (km > 0 ? sec / km : 0)
export const speedKmh = (sec: number, km: number) => (sec > 0 ? km / (sec / 3600) : 0)
/** treadmill speed for a pace (sec/km) */
export const speedForPace = (pace: number) => (pace > 0 ? 3600 / pace : 0)

/** kcal for a run at a steady speed and incline (ACSM running equation) */
export function runKcal(km: number, sec: number, weightKg: number, inclinePct = 1): number {
  if (!(km > 0 && sec > 0 && weightKg > 0)) return 0
  const mPerMin = (km * 1000) / (sec / 60)
  const vo2 = 0.2 * mPerMin + 0.9 * mPerMin * (inclinePct / 100) + 3.5
  const met = vo2 / 3.5
  return Math.round(met * weightKg * (sec / 3600))
}

export interface SplitInfo { fastest: number; slowest: number; fastestKm: number; slowestKm: number; negative: boolean; spread: number }
export function splitInfo(splits: number[]): SplitInfo | null {
  const full = splits.filter((x) => x > 0)
  if (full.length < 2) return null
  const fastest = Math.min(...full), slowest = Math.max(...full)
  const half = Math.floor(full.length / 2)
  const first = full.slice(0, half).reduce((a, b) => a + b, 0) / half
  const second = full.slice(full.length - half).reduce((a, b) => a + b, 0) / half
  return { fastest, slowest, fastestKm: full.indexOf(fastest) + 1, slowestKm: full.indexOf(slowest) + 1, negative: second < first, spread: slowest - fastest }
}

/** the 10 km treadmill runs (or any run of 10 km+), oldest first */
export function tenKRuns(logs: CardioLog[]): CardioLog[] {
  return logs.filter((l) => l.kind === 'run' && (l.distanceKm ?? 0) >= RUN_DISTANCE_KM - 0.01).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}
/** time for exactly 10 km (scaled from the average pace if the run was longer) */
export const tenKTime = (l: CardioLog) => Math.round(((l.seconds || 0) / (l.distanceKm || RUN_DISTANCE_KM)) * RUN_DISTANCE_KM)
export function bestTenK(logs: CardioLog[]): CardioLog | null {
  const r = tenKRuns(logs)
  return r.length ? r.reduce((b, l) => (tenKTime(l) < tenKTime(b) ? l : b)) : null
}

/** realistic next targets from the current best: −1 min, −2 min, and the next round number */
export function nextTargets(bestSec: number): { label: string; sec: number }[] {
  const out = [{ label: '1 min faster', sec: bestSec - 60 }, { label: '2 min faster', sec: bestSec - 120 }]
  const round5 = Math.floor((bestSec - 1) / 300) * 300
  if (round5 > 0 && round5 < bestSec - 120) out.push({ label: `Under ${fmtTime(round5)}`, sec: round5 })
  return out.filter((t) => t.sec > 1800)
}
