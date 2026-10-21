// Strength analytics from REAL logged sets (IV-02, IV-09, IV-14, IV-27, IV-33, IV-37).
// Rules: actual lifted records are kept apart from estimates; estimated 1RM is
// only shown as a headline for low-rep compound work; comparisons stay within
// the SAME exercise (so a machine row is never ranked against a barbell bench).

import dayjs from 'dayjs'
import type { Exercise, SetLog, WorkoutLog } from '@/db/types'
import { byId } from '@/data/exercises'
import { e1rm } from './program12'
import { isIsolation } from './quality'

const work = (s: SetLog) => s.done && !s.warmup && !s.failed && (s.reps ?? 0) > 0

/** e1RM is meaningful as a headline only for compound, mostly low-rep exercises */
export function e1rmMeaningful(ex: Exercise | undefined): boolean {
  if (!ex) return false
  if (ex.loadMode === 'bodyweight' || ex.loadMode === 'time') return false
  const iso = isIsolation(ex) || ex.kind === 'core' || (ex.repRange?.[0] ?? 8) >= 10
  return !iso
}

export interface SessionPoint { date: string; topKg: number; topReps: number; volume: number; e1rm: number; sets: number; logId: string }
/** one point per finished session for an exercise, oldest first */
export function sessionSeries(logs: WorkoutLog[], id: string): SessionPoint[] {
  const out: SessionPoint[] = []
  for (const l of [...logs].filter((x) => x.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const sets = l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter(work))
    if (!sets.length) continue
    const top = [...sets].sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0]
    out.push({
      date: l.date, logId: l.id, sets: sets.length,
      topKg: top.weightKg ?? 0, topReps: top.reps ?? 0,
      volume: sets.reduce((v, s) => v + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
      e1rm: Math.max(...sets.map((s) => e1rm(s.weightKg ?? 0, s.reps ?? 0))),
    })
  }
  return out
}

export interface ExerciseRecords {
  heaviest?: { kg: number; reps: number; date: string }
  bestWorkingSet?: { kg: number; reps: number; date: string }
  repRecords: { reps: number; kg: number; date: string }[]
  bestE1rm?: { value: number; date: string }
  bestVolume?: { kg: number; date: string }
  sinceFirst?: { firstDate: string; first: SessionPoint; latest: SessionPoint }
  sincePrevious?: { prev: SessionPoint; latest: SessionPoint }
  sessions: number
}
/**
 * IV-02: actual records (what he lifted) vs estimates (e1RM). Best working set
 * = the set with the most total work at a weight he moved for ≥ 5 reps (or his
 * heaviest if he never did 5) — a "real" set, not a single.
 */
export function exerciseRecords(logs: WorkoutLog[], id: string): ExerciseRecords {
  const series = sessionSeries(logs, id)
  const all: { kg: number; reps: number; date: string }[] = []
  for (const l of logs) if (l.finishedAt) for (const e of l.exercises) if (e.exerciseId === id) for (const s of e.sets) if (work(s)) all.push({ kg: s.weightKg ?? 0, reps: s.reps ?? 0, date: l.date })
  const r: ExerciseRecords = { repRecords: [], sessions: series.length }
  if (!all.length) return r
  const by = (f: (x: { kg: number; reps: number }) => number) => [...all].sort((a, b) => f(b) - f(a) || a.date.localeCompare(b.date))[0]
  r.heaviest = by((x) => x.kg * 1000 + x.reps)
  const real = all.filter((x) => x.reps >= 5)
  r.bestWorkingSet = (real.length ? [...real].sort((a, b) => b.kg * b.reps - a.kg * a.reps || a.date.localeCompare(b.date))[0] : r.heaviest)
  const reps = new Map<number, { reps: number; kg: number; date: string }>()
  for (const x of all) { const cur = reps.get(x.reps); if (!cur || x.kg > cur.kg) reps.set(x.reps, { reps: x.reps, kg: x.kg, date: x.date }) }
  // only keep a rep record if no higher rep count was done at ≥ that weight (the true frontier)
  r.repRecords = [...reps.values()].sort((a, b) => a.reps - b.reps).filter((x) => ![...reps.values()].some((y) => y.reps > x.reps && y.kg >= x.kg))
  const be = by((x) => e1rm(x.kg, x.reps)); r.bestE1rm = { value: e1rm(be.kg, be.reps), date: be.date }
  const bv = [...series].sort((a, b) => b.volume - a.volume)[0]; if (bv) r.bestVolume = { kg: bv.volume, date: bv.date }
  if (series.length >= 2) {
    r.sinceFirst = { firstDate: series[0].date, first: series[0], latest: series[series.length - 1] }
    r.sincePrevious = { prev: series[series.length - 2], latest: series[series.length - 1] }
  }
  return r
}

/** IV-27: series inside the last N weeks */
export function seriesWithin(series: SessionPoint[], weeks: 4 | 8 | 12, today = dayjs().format('YYYY-MM-DD')): SessionPoint[] {
  const from = dayjs(today).subtract(weeks * 7, 'day').format('YYYY-MM-DD')
  return series.filter((p) => p.date >= from)
}

/**
 * IV-09 plateau: several comparable sessions (≥4, spanning ≥14 days) where the
 * newest 3 do not beat the best of everything before them on load, reps at the
 * top load, or estimated strength. One bad day never counts.
 */
export interface Plateau { exerciseId: string; sessions: number; since: string; detail: string; suggestions: string[] }
export function detectPlateau(logs: WorkoutLog[], id: string): Plateau | null {
  const s = sessionSeries(logs, id)
  if (s.length < 4) return null
  const recent = s.slice(-3), before = s.slice(0, -3)
  if (dayjs(recent[recent.length - 1].date).diff(dayjs(recent[0].date), 'day') < 10) return null
  const bestBefore = { kg: Math.max(...before.map((p) => p.topKg)), e: Math.max(...before.map((p) => p.e1rm)) }
  const repsAtTop = Math.max(...before.filter((p) => p.topKg === bestBefore.kg).map((p) => p.topReps))
  const improved = recent.some((p) => p.topKg > bestBefore.kg || (p.topKg === bestBefore.kg && p.topReps > repsAtTop) || p.e1rm > bestBefore.e * 1.01)
  if (improved) return null
  const name = byId.get(id)?.name ?? id
  return {
    exerciseId: id, sessions: recent.length, since: recent[0].date,
    detail: `${name}: no improvement in load, reps or estimated strength over your last ${recent.length} sessions (${dayjs(recent[0].date).format('D MMM')} – ${dayjs(recent[recent.length - 1].date).format('D MMM')}).`,
    suggestions: [
      'Repeat the load and aim for one more rep on the first set before adding weight (rep-first progression).',
      'Check recovery: sleep, total weekly volume for this muscle and how hard the sets before it were.',
      'Try a close variation for 3–4 weeks (same muscle, different angle or machine), then come back.',
      'If several lifts stalled at once, a lighter deload week usually helps more than pushing harder.',
    ],
  }
}

/**
 * IV-14 PB predictor — trend of estimated strength over the last 8 weeks
 * (≥4 sessions). Returns a RANGE with a confidence label. Never an instruction.
 */
export interface Prediction { now: number; in4w: [number, number]; confidence: 'low' | 'moderate'; basis: string }
export function predictE1rm(series: SessionPoint[], today = dayjs().format('YYYY-MM-DD')): Prediction | null {
  const pts = seriesWithin(series, 8, today)
  if (pts.length < 4) return null
  const t0 = dayjs(pts[0].date)
  const xs = pts.map((p) => dayjs(p.date).diff(t0, 'day')), ys = pts.map((p) => p.e1rm)
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (sxx === 0) return null
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx
  const resid = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + slope * (xs[i] - mx))) ** 2, 0) / Math.max(1, n - 2))
  const lastX = dayjs(today).diff(t0, 'day')
  const now = my + slope * (lastX - mx)
  const mid = now + Math.max(0, slope) * 28 // never predict a strength DROP as a goal
  return {
    // never a falsely precise point: at least ±2.5% uncertainty
    now: Math.round(now), in4w: [Math.round(Math.max(now, mid - Math.max(resid * 1.5, now * 0.025))), Math.round(mid + Math.max(resid * 1.5, now * 0.025))],
    confidence: n >= 6 && resid < now * 0.04 ? 'moderate' : 'low',
    basis: `${n} sessions in the last 8 weeks · trend ${slope >= 0 ? '+' : ''}${(slope * 7).toFixed(1)} kg/week of estimated strength`,
  }
}

/** IV-37: honest week-over-week volume comparison with the underlying totals */
export interface VolumeCompare { thisWeek: number; lastWeek: number; sessionsThis: number; sessionsLast: number; pct: number | null; note: string }
export function compareWeeklyVolume(logs: WorkoutLog[], today = dayjs().format('YYYY-MM-DD')): VolumeCompare {
  const mon = dayjs(today).subtract((dayjs(today).day() + 6) % 7, 'day')
  const inWeek = (l: WorkoutLog, w: number) => l.finishedAt && l.date >= mon.subtract(w * 7, 'day').format('YYYY-MM-DD') && l.date < mon.subtract((w - 1) * 7, 'day').format('YYYY-MM-DD')
  const vol = (ls: WorkoutLog[]) => ls.reduce((v, l) => v + l.exercises.reduce((a, e) => a + e.sets.filter(work).reduce((b, s) => b + (s.weightKg ?? 0) * (s.reps ?? 0), 0), 0), 0)
  const tw = logs.filter((l) => l.finishedAt && l.date >= mon.format('YYYY-MM-DD') && l.date <= today), lw = logs.filter((l) => inWeek(l, 1))
  const a = Math.round(vol(tw)), b = Math.round(vol(lw))
  const pct = b > 0 ? Math.round(((a - b) / b) * 100) : null
  const note = b === 0 ? 'No finished sessions last week — a percentage would be meaningless.'
    : lw.length !== tw.length ? `Different number of sessions (${tw.length} vs ${lw.length}) — the percentage mostly reflects that, not harder training.`
      : Math.abs(pct ?? 0) > 60 ? 'A big swing usually comes from a different mix of exercises or a deload week — more volume is not automatically better.'
        : 'Same number of sessions — a fair comparison.'
  return { thisWeek: a, lastWeek: b, sessionsThis: tw.length, sessionsLast: lw.length, pct, note }
}
