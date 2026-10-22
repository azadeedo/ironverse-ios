// ============================================================
// SLEEP & RECOVERY (v10, 23 Oct 2026) — pure functions, no storage.
//
// Sleep lives on the daily check-in (DailyCheckin, keyed by the morning's date):
// the 1-5 rating that already existed, plus optional hours, bed/wake times,
// factors and Apple Health stages/heart data. Nothing here diagnoses anything —
// it describes your own log and points at well-established sleep guidance.
// ============================================================

import type { DailyCheckin } from '@/db/types'

export const SLEEP_FACTORS = [
  { id: 'caffeine', label: 'Caffeine after 2 pm', emoji: '☕' },
  { id: 'alcohol', label: 'Alcohol', emoji: '🍺' },
  { id: 'late-meal', label: 'Big late meal', emoji: '🍔' },
  { id: 'screens', label: 'Phone in bed', emoji: '📱' },
  { id: 'stress', label: 'Stressed', emoji: '😣' },
  { id: 'late-training', label: 'Trained late', emoji: '🏋️' },
  { id: 'nap', label: 'Napped', emoji: '😴' },
  { id: 'hot-room', label: 'Hot room', emoji: '🌡️' },
  { id: 'noise', label: 'Noise / woken up', emoji: '🔊' },
  { id: 'sick', label: 'Unwell', emoji: '🤒' },
] as const
export type SleepFactor = (typeof SLEEP_FACTORS)[number]['id']

export const SLEEP_FACES = ['😫', '😕', '😐', '🙂', '😄'] as const
export const SLEEP_WORDS = ['Awful', 'Poor', 'OK', 'Good', 'Great'] as const

/** hours between two 'HH:mm' clock times, crossing midnight when needed */
export function hoursBetween(bed: string, wake: string): number | null {
  const m = (t: string) => { const [h, mm] = t.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(mm) ? h * 60 + mm : NaN }
  const a = m(bed), b = m(wake)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const mins = (b - a + 1440) % 1440
  return mins === 0 ? null : Math.round((mins / 60) * 10) / 10
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sd = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) }

export interface SleepSummary {
  nights: number
  avgHours: number | null
  avgRating: number | null
  /** hours short of target over the period (never negative) */
  debtHours: number
  /** spread of wake-up times in minutes — lower is steadier */
  wakeSpreadMin: number | null
  /** 0-100: how close to a steady schedule */
  consistency: number | null
}

/** rows: the check-ins of the period, any order */
export function summarise(rows: DailyCheckin[], targetHours = 8): SleepSummary {
  const withHours = rows.filter((r) => typeof r.sleepHours === 'number' && r.sleepHours > 0)
  const rated = rows.filter((r) => typeof r.sleep === 'number')
  const wakes = rows.map((r) => r.wakeTime).filter((t): t is string => !!t).map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m })
  const spread = wakes.length >= 3 ? Math.round(sd(wakes)) : null
  return {
    nights: new Set([...withHours, ...rated].map((r) => r.date)).size,
    avgHours: withHours.length ? Math.round(mean(withHours.map((r) => r.sleepHours!)) * 10) / 10 : null,
    avgRating: rated.length ? Math.round(mean(rated.map((r) => r.sleep!)) * 10) / 10 : null,
    debtHours: Math.round(withHours.reduce((d, r) => d + Math.max(0, targetHours - r.sleepHours!), 0) * 10) / 10,
    wakeSpreadMin: spread,
    consistency: spread === null ? null : Math.max(0, Math.min(100, Math.round(100 - spread * (100 / 90)))),
  }
}

export interface FactorEffect { id: SleepFactor; label: string; emoji: string; withAvg: number; withoutAvg: number; nightsWith: number; delta: number }

/** average rating on nights WITH vs WITHOUT each factor — only when both sides have 3+ nights */
export function factorEffects(rows: DailyCheckin[]): FactorEffect[] {
  const rated = rows.filter((r) => typeof r.sleep === 'number')
  const out: FactorEffect[] = []
  for (const f of SLEEP_FACTORS) {
    const yes = rated.filter((r) => r.sleepFactors?.includes(f.id))
    const no = rated.filter((r) => !r.sleepFactors?.includes(f.id))
    if (yes.length < 3 || no.length < 3) continue
    const w = mean(yes.map((r) => r.sleep!)), wo = mean(no.map((r) => r.sleep!))
    out.push({ id: f.id, label: f.label, emoji: f.emoji, withAvg: Math.round(w * 10) / 10, withoutAvg: Math.round(wo * 10) / 10, nightsWith: yes.length, delta: Math.round((w - wo) * 10) / 10 })
  }
  return out.sort((a, b) => a.delta - b.delta)
}

export interface Recovery {
  /** 0-100, or null when there is nothing to go on */
  score: number | null
  zone: 'green' | 'amber' | 'red' | null
  advice: string
  parts: { label: string; value: string; points: number; weight: number }[]
}

/**
 * Recovery score for TODAY from last night's sleep plus Apple Health heart data
 * against your own 2-week baseline. Missing pieces are left out and the rest
 * re-weighted, so a manual-only user still gets an honest (sleep-based) score.
 */
export function recoveryScore(today: DailyCheckin | undefined, history: DailyCheckin[], targetHours = 8): Recovery {
  const parts: Recovery['parts'] = []
  if (today?.sleepHours) parts.push({ label: 'Sleep time', value: `${today.sleepHours} h`, points: Math.max(0, Math.min(100, (today.sleepHours / targetHours) * 100)), weight: 35 })
  if (today?.sleep) parts.push({ label: 'Sleep quality', value: SLEEP_WORDS[today.sleep - 1] ?? String(today.sleep), points: (today.sleep - 1) * 25, weight: 25 })
  const base = history.filter((h) => h.date < (today?.date ?? '9999'))
  const rhrBase = base.map((h) => h.restingHr).filter((n): n is number => !!n)
  if (today?.restingHr && rhrBase.length >= 4) {
    const diff = today.restingHr - mean(rhrBase)
    parts.push({ label: 'Resting heart rate', value: `${today.restingHr} bpm (${diff >= 0 ? '+' : ''}${diff.toFixed(0)} vs usual)`, points: Math.max(0, Math.min(100, 70 - diff * 8)), weight: 20 })
  }
  const hrvBase = base.map((h) => h.hrv).filter((n): n is number => !!n)
  if (today?.hrv && hrvBase.length >= 4) {
    const ratio = today.hrv / mean(hrvBase)
    parts.push({ label: 'Heart-rate variability', value: `${today.hrv} ms (${Math.round((ratio - 1) * 100)}% vs usual)`, points: Math.max(0, Math.min(100, 70 + (ratio - 1) * 150)), weight: 20 })
  }
  if (today?.soreness) parts.push({ label: 'Soreness', value: `${today.soreness}/5`, points: (5 - today.soreness) * 25, weight: 10 })
  if (!parts.length) return { score: null, zone: null, advice: 'Rate last night’s sleep to get today’s recovery score.', parts }
  const w = parts.reduce((s, p) => s + p.weight, 0)
  const score = Math.round(parts.reduce((s, p) => s + p.points * p.weight, 0) / w)
  const zone = score >= 67 ? 'green' : score >= 40 ? 'amber' : 'red'
  const advice = zone === 'green' ? 'Well recovered — a good day to push for a rep or weight PR.'
    : zone === 'amber' ? 'Train as planned, but keep a rep or two in reserve and skip the extra sets.'
    : 'Recovery is low — take the lighter option today (fewer sets, or swap for an easy walk) and get to bed early.'
  return { score, zone, advice, parts }
}

/** research-backed guidance shown on the Sleep screen (plain summaries, cited) */
export const SLEEP_RESEARCH: { title: string; body: string; source: string }[] = [
  { title: 'Aim for at least 7 hours', body: 'Adults sleeping less than 7 hours a night regularly is linked with worse health, mood and performance. Many athletes do best with 8 or more.', source: 'Watson et al., 2015 — AASM & Sleep Research Society consensus' },
  { title: 'Short sleep costs strength-endurance more than max strength', body: 'Across studies, one bad night trims maximal strength a little (about 3%) but high-rep and endurance work much more (about 10%). Expect hard sets to feel harder after a short night.', source: 'Craven et al., 2022 — Sports Medicine meta-analysis' },
  { title: 'Sleep is when muscle gets built', body: 'One night without sleep lowered muscle protein synthesis by roughly 18% in young adults and raised cortisol. Consistent sleep protects the work you did in the gym.', source: 'Lamon et al., 2021 — Physiological Reports' },
  { title: 'Sleeping more can make you better', body: 'Athletes who extended sleep toward 10 hours in bed for several weeks sprinted faster, were more accurate and felt better.', source: 'Mah et al., 2011 — Sleep' },
  { title: 'Keep the same wake-up time', body: 'A steady schedule (even on weekends) keeps your body clock stable, which makes falling asleep easier. Your consistency score tracks this.', source: 'Sleep Foundation / AASM sleep hygiene guidance' },
  { title: 'Caffeine lasts longer than you think', body: '400 mg of caffeine even 6 hours before bed measurably reduced sleep. Keep strong coffee and pre-workout to the morning or early afternoon.', source: 'Drake et al., 2013 — Journal of Clinical Sleep Medicine' },
  { title: 'Alcohol wrecks the second half of the night', body: 'Alcohol can help you nod off but fragments sleep and suppresses REM later in the night.', source: 'Ebrahim et al., 2013 — Alcoholism: Clinical & Experimental Research' },
  { title: 'Cool, dark and quiet', body: 'A cool bedroom (around 16–19 °C), darkness and quiet support deeper sleep. A short nap (20–30 min) before 3 pm can top up a short night.', source: 'Sleep Foundation; Lastella et al., 2021 (naps in athletes)' },
]
