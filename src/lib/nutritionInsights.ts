// IV-06.18 — insights from what he actually logged (last 28 days).
// Every insight names the numbers it rests on; nothing is shown from thin data.
import dayjs from 'dayjs'
import type { FoodLogEntry } from '@/db/types'

export interface Insight { id: string; tone: 'good' | 'warn' | 'info'; title: string; detail: string }
type E = Pick<FoodLogEntry, 'date' | 'kcal' | 'protein' | 'meal' | 'name' | 'createdAt'> & { fibre?: number }

export function nutritionInsights(entries: E[], opts: { kcalTarget?: number; proteinTarget?: number; weightKg?: number; today?: string }): Insight[] {
  const today = opts.today ?? dayjs().format('YYYY-MM-DD')
  const byDay = new Map<string, E[]>()
  for (const e of entries) { if (e.date > today) continue; const L = byDay.get(e.date) ?? []; L.push(e); byDay.set(e.date, L) }
  const days = [...byDay.entries()].map(([d, L]) => ({ d, L, kcal: L.reduce((a, e) => a + (e.kcal || 0), 0), protein: L.reduce((a, e) => a + (e.protein || 0), 0), fibre: L.reduce((a, e) => a + (e.fibre || 0), 0) }))
  const out: Insight[] = []
  if (days.length < 3) return [{ id: 'thin', tone: 'info', title: 'Log a few more days', detail: `Insights start after 3 logged days — you have ${days.length}.` }]

  // likely incomplete days
  const thin = days.filter((d) => d.kcal > 0 && d.kcal < 1000)
  if (thin.length) out.push({ id: 'incomplete', tone: 'info', title: `${thin.length} day${thin.length > 1 ? 's look' : ' looks'} half-logged`, detail: `Under 1,000 kcal logged on ${thin.slice(0, 3).map((d) => dayjs(d.d).format('ddd D MMM')).join(', ')}${thin.length > 3 ? '…' : ''}. If you ate more, these days make your averages look lower than reality.` })
  const full = days.filter((d) => d.kcal >= 1000)

  // weekend vs weekday
  const we = full.filter((d) => [0, 6].includes(dayjs(d.d).day())), wk = full.filter((d) => ![0, 6].includes(dayjs(d.d).day()))
  if (we.length >= 2 && wk.length >= 3) {
    const a = (L: typeof full) => L.reduce((x, d) => x + d.kcal, 0) / L.length
    const diff = a(we) - a(wk)
    if (diff > 300) out.push({ id: 'weekend', tone: 'warn', title: `Weekends run ${Math.round(diff)} kcal higher`, detail: `Sat/Sun average ${Math.round(a(we)).toLocaleString('en-AU')} kcal vs ${Math.round(a(wk)).toLocaleString('en-AU')} on weekdays. Over a week that's about ${Math.round(diff * 2).toLocaleString('en-AU')} kcal — often the whole deficit.` })
    else out.push({ id: 'weekend', tone: 'good', title: 'Weekends match weekdays', detail: `Only ${Math.round(Math.abs(diff))} kcal difference — consistent eating makes progress predictable.` })
  }

  // protein target hit rate + per-meal protein (≈0.4 g/kg per meal maximises muscle building — Schoenfeld & Aragon 2018)
  if (opts.proteinTarget && full.length >= 3) {
    const hit = full.filter((d) => d.protein >= opts.proteinTarget! * 0.95).length
    out.push({ id: 'protein', tone: hit / full.length >= 0.7 ? 'good' : 'warn', title: `Protein target hit ${hit} of ${full.length} days`, detail: hit / full.length >= 0.7 ? 'Great — protein is the macro that protects muscle in a deficit.' : `Average ${Math.round(full.reduce((a, d) => a + d.protein, 0) / full.length)} g vs ${opts.proteinTarget} g. Easiest fixes: a protein shake, Greek yoghurt, or an extra palm of meat at lunch.` })
    const perMeal = Math.round((opts.weightKg ?? 80) * 0.4)
    const meals: Record<string, number[]> = {}
    for (const d of full) for (const m of ['breakfast', 'lunch', 'dinner']) { const p = d.L.filter((e) => e.meal === m).reduce((a, e) => a + (e.protein || 0), 0); if (p > 0) (meals[m] ??= []).push(p) }
    const low = Object.entries(meals).map(([m, v]) => [m, v.reduce((a, b) => a + b, 0) / v.length] as const).filter(([, v]) => v < perMeal * 0.6)
    if (low.length) out.push({ id: 'meal-protein', tone: 'info', title: `${low.map(([m]) => m[0].toUpperCase() + m.slice(1)).join(' and ')} ${low.length > 1 ? 'are' : 'is'} light on protein`, detail: `Averaging ${low.map(([m, v]) => `${Math.round(v)} g at ${m}`).join(', ')}. About ${perMeal} g per meal (0.4 g per kg) spreads protein for best muscle building.` })
  }

  // late eating
  const withTime = entries.filter((e) => e.createdAt)
  if (withTime.length >= 15) {
    const late = withTime.filter((e) => new Date(e.createdAt).getHours() >= 21)
    const lateK = late.reduce((a, e) => a + (e.kcal || 0), 0), allK = withTime.reduce((a, e) => a + (e.kcal || 0), 0)
    if (allK && lateK / allK > 0.25) out.push({ id: 'late', tone: 'warn', title: `${Math.round((lateK / allK) * 100)}% of calories logged after 9 pm`, detail: 'Late eating is where most unplanned calories hide. A planned evening snack (protein + fruit) beats grazing.' })
  }

  // top calorie sources
  const byFood = new Map<string, number>()
  for (const d of full) for (const e of d.L) byFood.set(e.name, (byFood.get(e.name) ?? 0) + (e.kcal || 0))
  const top = [...byFood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const tot = full.reduce((a, d) => a + d.kcal, 0)
  if (top.length && tot) out.push({ id: 'top', tone: 'info', title: 'Where most calories come from', detail: top.map(([n, k]) => `${n} (${Math.round((k / tot) * 100)}%)`).join(' · ') + '. Swapping or shrinking the top item moves the needle most.' })

  // fibre
  const fib = full.filter((d) => d.fibre > 0)
  if (fib.length >= 3) { const avg = fib.reduce((a, d) => a + d.fibre, 0) / fib.length; out.push({ id: 'fibre', tone: avg >= 25 ? 'good' : 'warn', title: `Fibre averages ${Math.round(avg)} g a day`, detail: avg >= 25 ? 'On target (25–30 g) — good for fullness and gut health.' : 'Aim for 25–30 g: oats, beans, berries, veg, wholegrain bread — or two fibre gummies on low days.' }) }

  // vs calorie target
  if (opts.kcalTarget && full.length >= 3) {
    const avg = full.reduce((a, d) => a + d.kcal, 0) / full.length, diff = avg - opts.kcalTarget
    out.push({ id: 'target', tone: Math.abs(diff) <= 150 ? 'good' : diff > 0 ? 'warn' : 'info', title: Math.abs(diff) <= 150 ? 'Right on your calorie target' : diff > 0 ? `Averaging ${Math.round(diff)} kcal over target` : `Averaging ${Math.round(-diff)} kcal under target`, detail: `${Math.round(avg).toLocaleString('en-AU')} kcal a day over ${full.length} fully logged days vs ${opts.kcalTarget.toLocaleString('en-AU')}.${diff < -500 ? ' Very low intake can cost muscle and energy — check you logged everything.' : ''}` })
  }
  return out
}
