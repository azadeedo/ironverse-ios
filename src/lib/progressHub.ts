// Progress hub engine — everything computed from REAL records (IV-07, 11, 13,
// 19, 20, 21, 28, 29, 30, 31, 32, 33D). Estimates are labelled as estimates.

import dayjs from 'dayjs'
import type { CardioLog, DailyCheckin, Muscle, Plan, WeighIn, WorkoutLog } from '@/db/types'
import { byId } from '@/data/exercises'
import { LIFT_EXERCISE } from '@/data/program12'
import { e1rm } from './program12'
import { exerciseRecords, sessionSeries } from './strength'

const work = (s: { done: boolean; warmup?: boolean; failed?: boolean; reps?: number }) => s.done && !s.warmup && !s.failed && (s.reps ?? 0) > 0
const fin = (l: WorkoutLog) => !!l.finishedAt && !l.skipped
const D = (x: string | dayjs.Dayjs) => dayjs(x).format('YYYY-MM-DD')

// ---------- IV-13 consistency heatmap ----------
export type DayState = 'done' | 'partial' | 'missed' | 'planned' | 'rest' | 'skipped' | 'today'
export function trainingWeekdays(plan: Plan | null | undefined): number[] {
  if (plan?.program === 'p12') return [2, 3, 4, 5]
  return plan?.trainingWeekdays?.length ? plan.trainingWeekdays : [1, 3, 5]
}
export function heatmap(plan: Plan | null | undefined, logs: WorkoutLog[], skipDates: Set<string>, from: string, to: string, today = D(dayjs())) {
  const wd = trainingWeekdays(plan)
  const byDate = new Map<string, WorkoutLog[]>()
  for (const l of logs) if (fin(l)) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l])
  const days: { date: string; state: DayState; sessions: number }[] = []
  for (let d = dayjs(from); !d.isAfter(dayjs(to)); d = d.add(1, 'day')) {
    const k = D(d), ls = byDate.get(k) ?? [], planned = wd.includes(d.day())
    let state: DayState
    if (ls.length) state = ls.some((l) => l.status === 'partial') ? 'partial' : 'done'
    else if (skipDates.has(k)) state = 'skipped'
    else if (k === today) state = planned ? 'today' : 'rest'
    else if (k > today) state = planned ? 'planned' : 'rest'
    else state = planned ? 'missed' : 'rest' // planned rest days are NEVER missed
    days.push({ date: k, state, sessions: ls.length })
  }
  const done = days.filter((x) => x.state === 'done' || x.state === 'partial').length
  const missed = days.filter((x) => x.state === 'missed').length
  return { days, done, missed, consistency: done + missed ? Math.round((done / (done + missed)) * 100) : null }
}

// ---------- IV-31 trophy room ----------
export interface Trophy { id: string; kind: 'load' | 'reps' | 'volume' | 'pull-up' | 'consistency' | 'bodyweight'; title: string; detail: string; date: string; logId?: string; exerciseId?: string }
export function trophies(logs: WorkoutLog[], weighIns: WeighIn[], startKg?: number, plan?: Plan | null): Trophy[] {
  const out: Trophy[] = []
  const ids = [...new Set(logs.filter(fin).flatMap((l) => l.exercises.map((e) => e.exerciseId)))]
  for (const id of ids) {
    const ex = byId.get(id); if (!ex) continue
    const r = exerciseRecords(logs, id)
    const logOf = (date: string) => logs.find((l) => fin(l) && l.date === date && l.exercises.some((e) => e.exerciseId === id))?.id
    if (r.heaviest && r.heaviest.kg > 0) out.push({ id: `load-${id}`, kind: 'load', title: `${ex.name}: ${r.heaviest.kg} kg`, detail: `Heaviest lifted — ${r.heaviest.kg} kg × ${r.heaviest.reps}`, date: r.heaviest.date, logId: logOf(r.heaviest.date), exerciseId: id })
    const topReps = [...r.repRecords].sort((a, b) => b.reps - a.reps)[0]
    if (topReps && topReps.reps >= 8) out.push({ id: `reps-${id}`, kind: 'reps', title: `${ex.name}: ${topReps.reps} reps`, detail: `${topReps.reps} reps at ${topReps.kg} kg`, date: topReps.date, logId: logOf(topReps.date), exerciseId: id })
    if (r.bestVolume && r.bestVolume.kg > 0) out.push({ id: `vol-${id}`, kind: 'volume', title: `${ex.name}: ${Math.round(r.bestVolume.kg).toLocaleString()} kg session`, detail: 'Most total work in one session', date: r.bestVolume.date, logId: logOf(r.bestVolume.date), exerciseId: id })
  }
  // pull-up milestones (bodyweight reps on any working set)
  for (const n of [1, 5, 10]) {
    const hit = logs.filter(fin).sort((a, b) => a.date.localeCompare(b.date)).find((l) => l.exercises.some((e) => (e.exerciseId === 'pull-up' || e.exerciseId === 'weighted-pull-up') && e.sets.some((s) => work(s) && (s.reps ?? 0) >= n)))
    if (hit) out.push({ id: `pu-${n}`, kind: 'pull-up', title: `${n} pull-up${n > 1 ? 's' : ''}`, detail: `First set of ${n}+ bodyweight pull-ups`, date: hit.date, logId: hit.id, exerciseId: 'pull-up' })
  }
  // consistency: longest run of weeks with ≥3 finished sessions
  const weeks = new Map<string, number>()
  for (const l of logs.filter(fin)) { const w = D(dayjs(l.date).subtract((dayjs(l.date).day() + 6) % 7, 'day')); weeks.set(w, (weeks.get(w) ?? 0) + 1) }
  let run = 0, best = 0, bestEnd = ''
  for (const w of [...weeks.keys()].sort()) { run = (weeks.get(w) ?? 0) >= 3 && (run === 0 || weeks.has(D(dayjs(w).subtract(7, 'day')))) ? run + 1 : (weeks.get(w) ?? 0) >= 3 ? 1 : 0; if (run > best) { best = run; bestEnd = w } }
  if (best >= 2) out.push({ id: 'consistency', kind: 'consistency', title: `${best} weeks in a row`, detail: '3+ finished workouts every week', date: bestEnd })
  // bodyweight milestones from the start weight (weekly averages, not single days)
  const start = startKg ?? weighIns.sort((a, b) => a.date.localeCompare(b.date))[0]?.weightKg
  if (start) {
    const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
    for (const lost of [2, 5, 8, 10, 13]) {
      const hit = sorted.find((w, i) => { const win = sorted.slice(Math.max(0, i - 3), i + 1); return win.length >= 2 && start - win.reduce((a, b) => a + b.weightKg, 0) / win.length >= lost })
      if (hit) out.push({ id: `bw-${lost}`, kind: 'bodyweight', title: `−${lost} kg`, detail: `Rolling average ${lost} kg below ${start} kg`, date: hit.date })
    }
  }
  void plan
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

// ---------- IV-20 XP & levels (never rewards maxing, extra sessions or under-eating) ----------
export function xp(logs: WorkoutLog[], weighIns: WeighIn[], trophyCount: number) {
  let total = 0
  const perDay = new Set<string>(), perWeek = new Map<string, number>()
  for (const l of logs.filter(fin).sort((a, b) => a.date.localeCompare(b.date))) {
    if (perDay.has(l.date)) continue // one session a day counts — no reward for doubling up
    const w = D(dayjs(l.date).subtract((dayjs(l.date).day() + 6) % 7, 'day'))
    if ((perWeek.get(w) ?? 0) >= 4) continue // the program has 4 days; a 5th earns nothing
    perDay.add(l.date); perWeek.set(w, (perWeek.get(w) ?? 0) + 1)
    total += l.status === 'partial' ? 60 : 100
  }
  for (const n of perWeek.values()) if (n >= 3) total += 150
  total += Math.min(new Set(weighIns.map((w) => w.date)).size, 400) * 10
  total += trophyCount * 40
  let level = 1, need = 500
  let left = total
  while (left >= need) { left -= need; level++; need = Math.round(500 * Math.pow(level, 1.25)) }
  return { total, level, into: left, need, rules: ['Finished workout +100 (partial +60) — max one a day, four a week', 'Week with 3+ workouts +150', 'Weigh-in +10 a day', 'Real record (trophy) +40', 'Nothing for max attempts, extra sessions or eating less'] }
}

// ---------- IV-30 muscle-group analytics ----------
export const GROUPS: Record<string, { label: string; muscles: Muscle[] }> = {
  chest: { label: 'Chest', muscles: ['chest'] },
  back: { label: 'Back', muscles: ['lats', 'upper-back', 'traps', 'lower-back'] },
  shoulders: { label: 'Shoulders', muscles: ['front-delts', 'side-delts', 'rear-delts'] },
  arms: { label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  legs: { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  core: { label: 'Core', muscles: ['abs', 'obliques'] },
}
/** Forgd-style share of hard sets per group + one plain-English suggestion */
export function volumeShare(now: Record<string, { sets: number; perWeek: number; freq: number }>) {
  const total = Object.values(now).reduce((a, v) => a + v.sets, 0)
  const rows = Object.entries(now).map(([g, v]) => ({ g, label: GROUPS[g].label, sets: v.sets, perWeek: v.perWeek, freq: v.freq, pct: total ? Math.round((v.sets / total) * 100) : 0 })).sort((a, b) => b.pct - a.pct)
  if (!total) return { rows, total, insight: 'No finished sets in this period yet.' }
  const top = rows[0], low = rows.filter((r) => r.g !== 'core').sort((a, b) => a.perWeek - b.perWeek)[0]
  const insight = `${top.label} is carrying most of your volume (${top.pct}%).` + (low && low.perWeek < 8 ? ` ${low.label} looks undertrained at ${low.perWeek} sets a week — consider adding 4–6 sets next week.` : ' Every major group gets a reasonable share.')
  return { rows, total, insight }
}
export function groupAnalytics(logs: WorkoutLog[], weeks = 4, today = D(dayjs())) {
  const from = D(dayjs(today).subtract(weeks * 7, 'day')), prevFrom = D(dayjs(from).subtract(weeks * 7, 'day'))
  const calc = (a: string, b: string) => Object.fromEntries(Object.entries(GROUPS).map(([g, def]) => {
    let sets = 0, volume = 0; const days = new Set<string>(); const exs = new Set<string>()
    for (const l of logs) if (fin(l) && l.date >= a && l.date < b) for (const e of l.exercises) {
      const ex = byId.get(e.exerciseId); if (!ex || !ex.primary.some((m) => def.muscles.includes(m))) continue
      const ws = e.sets.filter(work); if (!ws.length) continue
      sets += ws.length; volume += ws.reduce((v, s) => v + (s.weightKg ?? 0) * (s.reps ?? 0), 0); days.add(l.date); exs.add(e.exerciseId)
    }
    return [g, { sets, perWeek: Math.round((sets / weeks) * 10) / 10, freq: Math.round((days.size / weeks) * 10) / 10, volume: Math.round(volume), exercises: [...exs] }]
  })) as Record<string, { sets: number; perWeek: number; freq: number; volume: number; exercises: string[] }>
  const now = calc(from, D(dayjs(today).add(1, 'day'))), prev = calc(prevFrom, from)
  const improved = Object.fromEntries(Object.entries(now).map(([g, v]) => [g, v.exercises.filter((id) => { const s = sessionSeries(logs, id); const a = s.filter((p) => p.date >= from), b = s.filter((p) => p.date < from && p.date >= prevFrom); return a.length && b.length && Math.max(...a.map((p) => p.e1rm)) > Math.max(...b.map((p) => p.e1rm)) }).length]))
  return { now, prev, improved, note: 'Hard sets and volume describe training stimulus — they are not a measurement of muscle growth.' }
}

// ---------- IV-28 / IV-33D recovery estimate ----------
export type RecoveryBand = 'likely-recovering' | 'partly' | 'likely-ready' | 'not-recent'
export function recoveryEstimate(logs: WorkoutLog[], checkins: DailyCheckin[], today = D(dayjs())) {
  const soreness = [...checkins].filter((c) => typeof c.soreness === 'number' && c.date >= D(dayjs(today).subtract(2, 'day'))).sort((a, b) => b.date.localeCompare(a.date))[0]?.soreness
  return Object.entries(GROUPS).map(([g, def]) => {
    let last: string | null = null, sets = 0
    for (const l of [...logs].filter(fin).sort((a, b) => b.date.localeCompare(a.date))) {
      const n = l.exercises.filter((e) => byId.get(e.exerciseId)?.primary.some((m) => def.muscles.includes(m))).reduce((a, e) => a + e.sets.filter(work).length, 0)
      if (n > 0) { last = l.date; sets = n; break }
    }
    const days = last ? dayjs(today).diff(dayjs(last), 'day') : null
    // heavier sessions and reported soreness push the estimate later
    const load = sets >= 10 ? 1 : sets >= 6 ? 0.5 : 0
    const sore = (soreness ?? 0) >= 4 ? 1 : 0
    let band: RecoveryBand = 'not-recent'
    if (days !== null && days <= 7) band = days < 1 + load + sore ? 'likely-recovering' : days < 2 + load + sore ? 'partly' : 'likely-ready'
    return { group: g, label: def.label, lastDate: last, days, sets, band }
  })
}
export const BAND_LABEL: Record<RecoveryBand, string> = { 'likely-recovering': 'Likely still recovering', partly: 'Probably partly recovered', 'likely-ready': 'Likely ready', 'not-recent': 'Not trained recently' }
export const RECOVERY_NOTE = 'An estimate from how recently and how hard you trained each area, plus soreness you logged. It is not a physiological measurement — how you feel on the day wins.'

// ---------- IV-19 / IV-29 goal-date forecast ----------
export function goalForecast(weighIns: WeighIn[], goalKg: number, today = D(dayjs())) {
  const recent = weighIns.filter((w) => w.date >= D(dayjs(today).subtract(42, 'day'))).sort((a, b) => a.date.localeCompare(b.date))
  const weeksMap = new Map<string, number[]>()
  for (const w of recent) { const k = D(dayjs(w.date).subtract((dayjs(w.date).day() + 6) % 7, 'day')); weeksMap.set(k, [...(weeksMap.get(k) ?? []), w.weightKg]) }
  const pts = [...weeksMap.entries()].sort().map(([k, xs]) => ({ x: dayjs(k).diff(dayjs(today), 'day') / 7, y: xs.reduce((a, b) => a + b, 0) / xs.length }))
  if (pts.length < 3) return { status: 'insufficient' as const, weeks: pts.length, text: `Needs weigh-ins in at least 3 different weeks (you have ${pts.length}). Weekly averages are used, so one heavy day never moves it.` }
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0), slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx
  const se = Math.sqrt(pts.reduce((a, p) => a + (p.y - (my + slope * (p.x - mx))) ** 2, 0) / Math.max(1, n - 2) / sxx)
  const nowKg = my + slope * (0 - mx)
  if (slope >= -0.05) return { status: 'flat' as const, kgPerWeek: slope, nowKg, text: `Your weekly average is ${slope > 0.05 ? 'rising' : 'flat'} (${slope >= 0 ? '+' : ''}${slope.toFixed(2)} kg/week) — no goal date until the trend points down.` }
  const togo = nowKg - goalKg
  if (togo <= 0) return { status: 'reached' as const, nowKg, text: 'Your trend is at or below the goal.' }
  const fast = Math.min(-0.05, slope - se), slow = Math.min(-0.05, slope + se)
  const best = dayjs(today).add(Math.round((togo / -fast) * 7), 'day'), mid = dayjs(today).add(Math.round((togo / -slope) * 7), 'day'), worst = dayjs(today).add(Math.round((togo / -slow) * 7), 'day')
  return { status: 'forecast' as const, kgPerWeek: slope, nowKg, range: [D(best), D(mid), D(worst)] as [string, string, string], text: `At ${(-slope).toFixed(2)} kg/week you may reach ${goalKg} kg around ${mid.format('D MMM YYYY')} (likely between ${best.format('D MMM')} and ${worst.format('D MMM YYYY')}). A forecast from your trend, not a promise — water and sodium move single weigh-ins by 1–2 kg.` }
}

// ---------- IV-32 athlete profile (transparent 0–100 scores) ----------
export function athleteProfile(logs: WorkoutLog[], cardio: CardioLog[], plan: Plan | null | undefined, today = D(dayjs())) {
  const s8 = D(dayjs(today).subtract(56, 'day')), s4 = D(dayjs(today).subtract(28, 'day'))
  // strength: average % change of estimated strength within the SAME main lift (first vs last 4 weeks of the window)
  const lifts = Object.values(LIFT_EXERCISE).map((id) => sessionSeries(logs, id).filter((p) => p.date >= s8)).filter((s) => s.length >= 2)
  const strChange = lifts.length ? lifts.reduce((a, s) => a + (s[s.length - 1].e1rm - s[0].e1rm) / s[0].e1rm, 0) / lifts.length : null
  const strength = strChange === null ? null : Math.max(0, Math.min(100, Math.round(50 + strChange * 500)))
  // endurance: share of accessory working sets that reached the TOP of their target range
  let top = 0, all = 0
  for (const l of logs) if (fin(l) && l.date >= s4) for (const e of l.exercises) for (const s of e.sets) if (work(s) && (s.weightKg ?? 0) > 0) { all++; if ((s.reps ?? 0) >= (s.targetReps?.[1] ?? 99)) top++ }
  const endurance = all >= 10 ? Math.round((top / all) * 100) : null
  const hm = heatmap(plan, logs, new Set(), s4, today, today)
  const consistency = hm.consistency
  const cardioMin = cardio.filter((c) => c.date >= D(dayjs(today).subtract(14, 'day'))).reduce((a, c) => a + c.seconds / 60, 0)
  const cardioScore = Math.min(100, Math.round((cardioMin / 120) * 100)) // ~2 h over 2 weeks = the program's typical prescription
  const rung = ['weighted-pull-up', 'pull-up', 'assisted-pull-up', 'lat-pulldown'].find((id) => logs.some((l) => fin(l) && l.exercises.some((e) => e.exerciseId === id && e.sets.some(work))))
  const skills = rung === 'weighted-pull-up' ? 100 : rung === 'pull-up' ? 75 : rung === 'assisted-pull-up' ? 45 : rung ? 25 : null
  return [
    { key: 'strength', label: 'Strength', score: strength, how: 'Change in estimated strength on squat, bench and deadlift over 8 weeks — each lift only against itself. 50 = no change, +10% = 100.' },
    { key: 'endurance', label: 'Muscular endurance', score: endurance, how: 'Share of your working sets in the last 4 weeks that reached the top of their rep range.' },
    { key: 'consistency', label: 'Consistency', score: consistency, how: 'Planned sessions completed in the last 4 weeks (rest days never count against you).' },
    { key: 'cardio', label: 'Cardio', score: cardioScore, how: 'Cardio minutes logged in the last 2 weeks vs about 2 hours.' },
    { key: 'skills', label: 'Exercise skills', score: skills, how: 'Pull-up journey rung: pulldown 25 · assisted 45 · pull-up 75 · weighted 100.' },
  ]
}

// ---------- IV-07 cycle comparison ----------
export function cycleSummaries(plans: Plan[], logs: WorkoutLog[]) {
  return plans.filter((p) => p.program === 'p12').sort((a, b) => (a.programStart ?? '').localeCompare(b.programStart ?? '')).map((p, i) => {
    const ls = logs.filter((l) => fin(l) && l.planId === p.id)
    const best = (id: string) => Math.round(Math.max(0, ...ls.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter(work).map((s) => e1rm(s.weightKg ?? 0, s.reps ?? 0))))))
    return {
      planId: p.id, cycle: p.cycle ?? i + 1, start: p.programStart ?? p.startDate, active: p.active,
      sessions: new Set(ls.map((l) => l.dayId)).size,
      sets: ls.reduce((a, l) => a + l.exercises.reduce((b, e) => b + e.sets.filter(work).length, 0), 0),
      squat: best(LIFT_EXERCISE.squat), bench: best(LIFT_EXERCISE.bench), deadlift: best(LIFT_EXERCISE.deadlift),
    }
  })
}

// ---------- IV-21 personal challenges ----------
export interface Challenge { id: string; kind: 'workouts' | 'reps' | 'improve'; title: string; target: number; exerciseId?: string; start: string; deadline: string; baseline?: number }
export function challengeProgress(c: Challenge, logs: WorkoutLog[]) {
  const inRange = logs.filter((l) => fin(l) && l.date >= c.start && l.date <= c.deadline)
  let value = 0
  if (c.kind === 'workouts') value = new Set(inRange.map((l) => l.date)).size
  if (c.kind === 'reps') value = Math.max(0, ...inRange.flatMap((l) => l.exercises.filter((e) => e.exerciseId === c.exerciseId).flatMap((e) => e.sets.filter(work).map((s) => s.reps ?? 0))))
  if (c.kind === 'improve') { const best = Math.max(0, ...inRange.flatMap((l) => l.exercises.filter((e) => e.exerciseId === c.exerciseId).flatMap((e) => e.sets.filter(work).map((s) => s.weightKg ?? 0)))); value = Math.max(0, best - (c.baseline ?? 0)) }
  const done = value >= c.target
  return { value, done, pct: Math.min(100, Math.round((value / c.target) * 100)), daysLeft: Math.max(0, dayjs(c.deadline).diff(dayjs(), 'day')), expired: !done && dayjs().isAfter(dayjs(c.deadline), 'day') }
}
