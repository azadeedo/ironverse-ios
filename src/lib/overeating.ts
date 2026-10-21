// ============================================================
// OVEREATING — the full week, "way over" days, and honest pattern tips.
//
// Calm by design: one big day is mostly water and food weight, not fat; the
// week is the unit that matters; nothing here ever suggests eating below the
// safe floor or "punishing" yourself.
// ============================================================

import dayjs from 'dayjs'
import type { FoodLogEntry } from '@/db/types'

/** ~7,700 kcal ≈ 1 kg of body fat — a widely used approximation, not an exact law. */
export const KCAL_PER_KG_FAT = 7700

export type DayState = 'unlogged' | 'future' | 'under' | 'on' | 'over' | 'way-over' | 'off-chart'

export interface WeekDay {
  date: string
  label: string
  kcal: number
  protein: number
  target: number
  state: DayState
  entries: number
}

export interface WeekView {
  monday: string
  days: WeekDay[]
  budget: number
  eaten: number
  /** budget for days that have happened or are today */
  budgetSoFar: number
  remaining: number
  daysLeft: number
  perDayLeft: number
  overDays: number
  worst: WeekDay | null
  avgLogged: number
  /** eaten so far + average × remaining unlogged days */
  projected: number
  proteinAvg: number
}

export function mondayOf(date: string): string {
  const d = dayjs(date)
  return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

export function dayState(kcal: number, target: number, logged: boolean, future: boolean): DayState {
  if (future) return 'future'
  if (!logged) return 'unlogged'
  if (target <= 0) return 'on'
  const r = kcal / target
  if (r > 1.5) return 'off-chart'
  if (r > 1.25) return 'way-over'
  if (r > 1.05) return 'over'
  if (r >= 0.85) return 'on'
  return 'under'
}

export function weekView(entries: FoodLogEntry[], anyDateInWeek: string, targetFor: (date: string) => number, today: string): WeekView {
  const monday = mondayOf(anyDateInWeek)
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = dayjs(monday).add(i, 'day')
    const date = d.format('YYYY-MM-DD')
    const list = entries.filter((e) => e.date === date)
    const kcal = Math.round(list.reduce((a, e) => a + (Number.isFinite(e.kcal) ? e.kcal : 0), 0))
    const protein = Math.round(list.reduce((a, e) => a + (Number.isFinite(e.protein) ? e.protein : 0), 0))
    const target = Math.round(targetFor(date))
    const future = date > today
    days.push({ date, label: d.format('ddd'), kcal, protein, target, entries: list.length, state: dayState(kcal, target, list.length > 0, future) })
  }
  const budget = days.reduce((a, d) => a + d.target, 0)
  const eaten = days.reduce((a, d) => a + d.kcal, 0)
  const budgetSoFar = days.filter((d) => d.date <= today).reduce((a, d) => a + d.target, 0)
  const open = days.filter((d) => d.date >= today)
  const daysLeft = open.length
  const remaining = budget - eaten
  const logged = days.filter((d) => d.entries > 0)
  const avgLogged = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0
  const unloggedLeft = days.filter((d) => d.entries === 0 && d.date >= today).length
  const over = days.filter((d) => d.state === 'over' || d.state === 'way-over' || d.state === 'off-chart')
  const worst = over.length ? over.reduce((a, b) => (b.kcal - b.target > a.kcal - a.target ? b : a)) : null
  return {
    monday, days, budget, eaten, budgetSoFar, remaining, daysLeft,
    perDayLeft: daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining,
    overDays: over.length, worst, avgLogged,
    projected: eaten + avgLogged * unloggedLeft,
    proteinAvg: logged.length ? Math.round(logged.reduce((a, d) => a + d.protein, 0) / logged.length) : 0,
  }
}

// ---------- a day that went way over ----------
export interface OffChartAdvice {
  level: 'over' | 'way-over' | 'off-chart'
  over: number
  fatKgIfRepeated: number
  headline: string
  facts: string[]
  tips: string[]
}
export function offChartAdvice(kcal: number, target: number, floor: number, proteinEaten: number, proteinTarget: number, hour = new Date().getHours()): OffChartAdvice | null {
  const over = Math.round(kcal - target)
  if (over <= 0 || target <= 0) return null
  const r = kcal / target
  const level: OffChartAdvice['level'] = r > 1.5 ? 'off-chart' : r > 1.25 ? 'way-over' : 'over'
  const facts = [
    `${over.toLocaleString()} kcal over is about ${(over / KCAL_PER_KG_FAT * 1000).toFixed(0)} g of body fat at most — the scale may jump 1–2 kg tomorrow, but that is mostly water, salt and food still in your gut.`,
    'One day does not decide your progress. Your 7-day average does.',
  ]
  const tips: string[] = []
  if (hour < 18) tips.push('There is still time today: make the rest of the day protein and vegetables — lean meat, eggs, Greek yoghurt, salad — and skip the extras.')
  else tips.push('Close the kitchen for tonight. Brush your teeth — it is a simple, surprisingly effective "done eating" signal.')
  tips.push('Go for a 20–30 minute walk. It will not "burn it all off", but it helps digestion, mood and appetite.')
  tips.push('Drink water and get to bed on time — short sleep makes tomorrow\'s hunger worse.')
  tips.push(`Tomorrow: eat normally, not "make up for it". Start with a high-protein breakfast. Never go below about ${floor.toLocaleString()} kcal.`)
  if (proteinTarget > 0 && proteinEaten < proteinTarget * 0.7) tips.push(`Protein is only ${Math.round(proteinEaten)} g of ${proteinTarget} g — low protein days tend to be hungrier days. Front-load protein tomorrow.`)
  if (level !== 'over') tips.push('If you want, "Take it off" below spreads the extra over the next couple of days — optional, reversible, and it never takes a day below your safe floor.')
  if (level === 'off-chart') tips.push('If big days like this keep happening, or eating feels out of control, it is worth talking to your GP or a dietitian — that is a normal, sensible step.')
  return {
    level, over, fatKgIfRepeated: over / KCAL_PER_KG_FAT,
    headline: level === 'off-chart' ? 'Way off the chart today — and that is okay' : level === 'way-over' ? 'Well over today' : 'A little over today',
    facts, tips,
  }
}

// ---------- patterns across recent weeks ----------
export interface PatternTip { id: string; title: string; detail: string; tone: 'info' | 'warn' | 'good' }
export function patternTips(entries: FoodLogEntry[], targetFor: (date: string) => number, proteinTarget: number, today: string, days = 28): PatternTip[] {
  const since = dayjs(today).subtract(days - 1, 'day').format('YYYY-MM-DD')
  const recent = entries.filter((e) => e.date >= since && e.date <= today)
  const byDate = new Map<string, FoodLogEntry[]>()
  for (const e of recent) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])
  const dates = [...byDate.keys()].sort()
  const out: PatternTip[] = []
  if (dates.length < 5) {
    out.push({ id: 'more-data', title: 'Log a few more days', detail: `Patterns appear after about a week of logging (${dates.length} day${dates.length === 1 ? '' : 's'} so far).`, tone: 'info' })
    return out
  }
  const dayKcal = (d: string) => (byDate.get(d) ?? []).reduce((a, e) => a + e.kcal, 0)
  const weekend = dates.filter((d) => [0, 5, 6].includes(dayjs(d).day()))
  const weekday = dates.filter((d) => ![0, 5, 6].includes(dayjs(d).day()))
  const avg = (l: string[]) => (l.length ? l.reduce((a, d) => a + dayKcal(d), 0) / l.length : 0)
  if (weekend.length >= 2 && weekday.length >= 3) {
    const diff = avg(weekend) - avg(weekday)
    if (diff > 400) out.push({ id: 'weekend', title: 'Weekends run higher', detail: `Fri–Sun averages ${Math.round(diff).toLocaleString()} kcal more than Mon–Thu. Planning one treat meal (rather than all weekend) usually fixes most of it.`, tone: 'warn' })
  }
  const total = recent.reduce((a, e) => a + e.kcal, 0)
  const snacks = recent.filter((e) => e.meal === 'snacks').reduce((a, e) => a + e.kcal, 0)
  if (total > 0 && snacks / total > 0.3) out.push({ id: 'snacks', title: 'Snacks are a big share', detail: `${Math.round((snacks / total) * 100)}% of your calories come from snacks. Swapping two snacks a day for a protein option (yoghurt, jerky, a shake) saves a lot.`, tone: 'warn' })
  const late = recent.filter((e) => new Date(e.createdAt).getHours() >= 21).reduce((a, e) => a + e.kcal, 0)
  if (total > 0 && late / total > 0.2) out.push({ id: 'late', title: 'Late-night eating', detail: `${Math.round((late / total) * 100)}% of calories are logged after 9 pm. A set "kitchen closed" time is one of the simplest fixes.`, tone: 'warn' })
  const pAvg = dates.reduce((a, d) => a + (byDate.get(d) ?? []).reduce((s, e) => s + e.protein, 0), 0) / dates.length
  if (proteinTarget > 0) {
    if (pAvg < proteinTarget * 0.8) out.push({ id: 'protein', title: 'Protein is running low', detail: `Averaging ${Math.round(pAvg)} g vs your ${proteinTarget} g target. Higher protein helps fullness and keeps muscle while you lose fat.`, tone: 'warn' })
    else out.push({ id: 'protein-good', title: 'Protein on point', detail: `Averaging ${Math.round(pAvg)} g a day — great for keeping muscle in a deficit.`, tone: 'good' })
  }
  const overDays = dates.filter((d) => dayKcal(d) > targetFor(d) * 1.05)
  if (overDays.length) {
    const foods = new Map<string, number>()
    for (const d of overDays) for (const e of byDate.get(d) ?? []) foods.set(e.name, (foods.get(e.name) ?? 0) + e.kcal)
    const top = [...foods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    if (top.length) out.push({ id: 'contributors', title: 'Biggest contributors on over days', detail: top.map(([n, k]) => `${n} (${Math.round(k).toLocaleString()} kcal)`).join(' · '), tone: 'info' })
  }
  const expected = dayjs(today).diff(dayjs(dates[0]), 'day') + 1
  if (expected - dates.length >= 3) out.push({ id: 'gaps', title: 'Some days are not logged', detail: `${expected - dates.length} days without any food logged since ${dayjs(dates[0]).format('D MMM')}. Unlogged days are usually the bigger days — even a rough quick-add helps the averages stay honest.`, tone: 'info' })
  const avgAll = avg(dates)
  const avgTarget = dates.reduce((a, d) => a + targetFor(d), 0) / dates.length
  if (avgAll <= avgTarget) out.push({ id: 'on-track', title: 'Your average is on track', detail: `Averaging ${Math.round(avgAll).toLocaleString()} kcal vs ${Math.round(avgTarget).toLocaleString()} target over the logged days. Big days included, the trend is right.`, tone: 'good' })
  return out
}
