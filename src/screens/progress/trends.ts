// ============================================================
// Progress trend maths — ADDITIVE to progress/helpers.ts, nothing replaced.
// Pure functions: rolling weight average, per-measurement series, and the
// waist-to-weight ratio that tells the truth better than the scale alone.
// ============================================================
import type { Measurement, WeighIn } from '@/db/types'

export type PartKey = 'biceps' | 'chest' | 'waist' | 'shoulders' | 'thigh' | 'calf' | 'abs' | 'neck' | 'hips'

export const TREND_PARTS: { key: PartKey; label: string; shrinkGood: boolean }[] = [
  { key: 'chest', label: 'Chest', shrinkGood: false },
  { key: 'shoulders', label: 'Shoulders', shrinkGood: false },
  { key: 'biceps', label: 'Biceps', shrinkGood: false },
  { key: 'abs', label: 'Abs', shrinkGood: true },
  { key: 'waist', label: 'Waist', shrinkGood: true },
  { key: 'thigh', label: 'Thigh', shrinkGood: false },
  { key: 'calf', label: 'Calf', shrinkGood: false },
]

const DAY = 86400000
const t = (d: string): number => new Date(`${d}T00:00:00`).getTime()

export interface RollingWeightPoint {
  date: string
  /** the raw morning number */
  raw: number
  /** mean of every weigh-in in the trailing window, including this one */
  avg: number
  /** how many weigh-ins went into the average */
  n: number
}

/**
 * Trailing rolling average over a CALENDAR window, so a missed day doesn't
 * distort it. Seven days is enough to wash out water and glycogen swings.
 */
export function rollingWeight(weighIns: WeighIn[], windowDays = 7): RollingWeightPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((w, i) => {
    const from = t(w.date) - (windowDays - 1) * DAY
    let sum = 0
    let n = 0
    for (let j = i; j >= 0; j--) {
      if (t(sorted[j].date) < from) break
      sum += sorted[j].weightKg
      n += 1
    }
    return { date: w.date, raw: w.weightKg, avg: Math.round((sum / n) * 100) / 100, n }
  })
}

/** Latest rolling average and how it moved over the last `days`. */
export function rollingSummary(rows: RollingWeightPoint[], days = 14): {
  latest: number | null
  delta: number | null
  raw: number | null
  window: number
} {
  if (rows.length === 0) return { latest: null, delta: null, raw: null, window: days }
  const last = rows[rows.length - 1]
  const cutoff = t(last.date) - days * DAY
  let ref: RollingWeightPoint | null = null
  for (let i = rows.length - 2; i >= 0; i--) {
    if (t(rows[i].date) <= cutoff) { ref = rows[i]; break }
  }
  return {
    latest: last.avg,
    raw: last.raw,
    delta: ref ? Math.round((last.avg - ref.avg) * 10) / 10 : null,
    window: days,
  }
}

export interface PartSeries {
  key: PartKey
  label: string
  shrinkGood: boolean
  points: { date: string; value: number }[]
  first: number
  latest: number
  delta: number
}

/** One series per measured body part, oldest → newest. Parts never measured are skipped. */
export function measurementSeries(measurements: Measurement[]): PartSeries[] {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date))
  const out: PartSeries[] = []
  for (const part of TREND_PARTS) {
    const points = sorted
      .filter((m) => typeof m.values[part.key] === 'number')
      .map((m) => ({ date: m.date, value: m.values[part.key] as number }))
    if (points.length === 0) continue
    const first = points[0].value
    const latest = points[points.length - 1].value
    out.push({
      key: part.key,
      label: part.label,
      shrinkGood: part.shrinkGood,
      points,
      first,
      latest,
      delta: Math.round((latest - first) * 10) / 10,
    })
  }
  return out
}

export interface WaistWeightPoint {
  date: string
  waistCm: number
  weightKg: number
  /** cm of waist per kg of bodyweight — falling means the weight is staying on better places */
  ratio: number
}

/** How far a weigh-in can be from a tape measurement and still count as the same day-ish. */
const PAIR_WINDOW_DAYS = 10

/**
 * WAIST-TO-WEIGHT. Scale weight alone can't tell a good week from a bad one —
 * waist ÷ bodyweight can. Each waist measurement is paired with the nearest
 * weigh-in within ten days; unpaired measurements are dropped rather than guessed.
 */
export function waistToWeight(measurements: Measurement[], weighIns: WeighIn[]): WaistWeightPoint[] {
  if (weighIns.length === 0) return []
  const scale = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const out: WaistWeightPoint[] = []
  for (const m of [...measurements].sort((a, b) => a.date.localeCompare(b.date))) {
    const waist = m.values.waist
    if (typeof waist !== 'number' || waist <= 0) continue
    let best: WeighIn | null = null
    let bestGap = Infinity
    for (const w of scale) {
      const gap = Math.abs(t(w.date) - t(m.date))
      if (gap < bestGap) { bestGap = gap; best = w }
    }
    if (!best || bestGap > PAIR_WINDOW_DAYS * DAY || best.weightKg <= 0) continue
    out.push({
      date: m.date,
      waistCm: waist,
      weightKg: best.weightKg,
      ratio: Math.round((waist / best.weightKg) * 1000) / 1000,
    })
  }
  return out
}

/** One honest line about what the waist-to-weight ratio did. */
export function waistToWeightNote(points: WaistWeightPoint[]): string {
  if (points.length === 0) return 'Log your waist with the tape and a weigh-in near the same day, and this fills in.'
  if (points.length === 1) return 'One reading so far — measure again in a few weeks and the direction shows up.'
  const first = points[0]
  const last = points[points.length - 1]
  const dRatio = last.ratio - first.ratio
  const dWeight = Math.round((last.weightKg - first.weightKg) * 10) / 10
  const dWaist = Math.round((last.waistCm - first.waistCm) * 10) / 10
  if (Math.abs(dRatio) < 0.002) {
    return `Waist and weight have moved together (${dWaist >= 0 ? '+' : '−'}${Math.abs(dWaist).toFixed(1)} cm, ${dWeight >= 0 ? '+' : '−'}${Math.abs(dWeight).toFixed(1)} kg) — the ratio is holding steady.`
  }
  if (dRatio < 0) {
    return dWeight > 0
      ? `Waist is falling while weight is up ${dWeight.toFixed(1)} kg. That's the shape you want — the scale is the wrong thing to read here.`
      : `Waist is coming down faster than bodyweight. That's fat going, not just water.`
  }
  return dWeight < 0
    ? `Waist has grown relative to bodyweight even though the scale is down ${Math.abs(dWeight).toFixed(1)} kg. Worth checking how the tape is sitting, and how protein has been.`
    : `Waist is gaining faster than bodyweight. Not a disaster — just the signal to tighten the eating before the training.`
}
