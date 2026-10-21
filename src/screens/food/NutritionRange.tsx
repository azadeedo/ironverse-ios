// IV-06.02 — nutrition analytics over a range you pick (7 / 14 / 30 days):
// calories against each day's real target, protein against your protein target,
// macro split, logged-day count, and tap a bar for that day's numbers.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { db } from '@/db'
import { Card, PageHeader, Section } from '@/components/ui'
import { targetFor } from '@/lib/calorieTarget'
import { nutritionInsights } from '@/lib/nutritionInsights'
import type { DayAdjust, FoodLogEntry } from '@/db/types'
import { useProfile } from './useFoodData'

export interface DayRow { date: string; kcal: number; protein: number; carbs: number; fat: number; n: number; target: number }
export function rangeRows(entries: Pick<FoodLogEntry, 'date' | 'kcal' | 'protein' | 'carbs' | 'fat'>[], days: number, today: string, target: (d: string) => number): DayRow[] {
  const out: DayRow[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = dayjs(today).subtract(i, 'day').format('YYYY-MM-DD')
    const E = entries.filter((e) => e.date === d)
    out.push({ date: d, n: E.length, target: target(d), kcal: E.reduce((a, e) => a + (e.kcal || 0), 0), protein: E.reduce((a, e) => a + (e.protein || 0), 0), carbs: E.reduce((a, e) => a + (e.carbs || 0), 0), fat: E.reduce((a, e) => a + (e.fat || 0), 0) })
  }
  return out
}

export default function NutritionRange() {
  const navigate = useNavigate()
  const profile = useProfile()
  const [days, setDays] = useState(7)
  const [pick, setPick] = useState<string | null>(null)
  const today = dayjs().format('YYYY-MM-DD')
  const since = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD')
  const entries = useLiveQuery(() => db.foodLog.where('date').aboveOrEqual(since).toArray(), [since])
  const month = useLiveQuery(() => db.foodLog.where('date').aboveOrEqual(dayjs().subtract(27, 'day').format('YYYY-MM-DD')).toArray(), [])
  const insights = useMemo(() => (month && profile ? nutritionInsights(month, { kcalTarget: profile.calorieTarget, proteinTarget: profile.proteinTarget, weightKg: profile.weightKg }) : []), [month, profile])
  const trained = useLiveQuery(async () => new Set((await db.workoutLogs.where('date').aboveOrEqual(since).toArray()).filter((l) => l.finishedAt && !l.skipped).map((l) => l.date)), [since])
  const adjusts = useLiveQuery(async () => new Map<string, DayAdjust>((await db.dayAdjust.toArray()).map((a) => [a.date, a])), [])
  const rows = useMemo(() => (profile && entries ? rangeRows(entries, days, today, (d) => targetFor(profile, adjusts, d)) : []), [profile, entries, adjusts, days, today])
  const logged = rows.filter((r) => r.n > 0)
  const avg = (k: keyof DayRow) => (logged.length ? logged.reduce((a, r) => a + (r[k] as number), 0) / logged.length : 0)
  const pTarget = profile?.proteinTarget ?? 0
  const max = Math.max(1, ...rows.map((r) => Math.max(r.kcal, r.target)))
  const sel = rows.find((r) => r.date === pick)
  const macroK = avg('protein') * 4 + avg('carbs') * 4 + avg('fat') * 9
  const W = 340, H = 170, pad = { l: 6, r: 6, t: 10, b: 22 }, bw = (W - pad.l - pad.r) / Math.max(1, rows.length)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)

  return (
    <div className="pb-10">
      <PageHeader title="Nutrition chart" back subtitle="Calories against each day's real target." />
      <div className="mx-4 mb-3 flex gap-1.5">
        {[7, 14, 30].map((n) => <button key={n} type="button" onClick={() => { setDays(n); setPick(null) }} className={`pressable flex-1 rounded-full py-2 text-[12.5px] font-semibold ${days === n ? 'bg-brand text-black' : 'bg-surface2 text-ink2'}`}>{n} days</button>)}
      </div>
      <Card className="mx-4 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {rows.map((r, i) => {
            const x = pad.l + i * bw, over = r.target && r.kcal > r.target * 1.05, col = !r.n ? 'var(--line)' : over ? '#f87171' : '#4ade80'
            return (
              <g key={r.date} onClick={() => setPick(r.date === pick ? null : r.date)} style={{ cursor: 'pointer' }}>
                <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                <rect x={x + bw * 0.15} y={y(r.kcal)} width={bw * 0.7} height={Math.max(r.n ? 2 : 0, H - pad.b - y(r.kcal))} rx={3} fill={col} opacity={pick && pick !== r.date ? 0.4 : 0.9} />
                {r.target > 0 && <line x1={x + bw * 0.05} x2={x + bw * 0.95} y1={y(r.target)} y2={y(r.target)} stroke="#fbbf24" strokeWidth="1.6" />}
                {trained?.has(r.date) && <circle cx={x + bw / 2} cy={H - pad.b + 4} r={2.6} fill="#60a5fa" />}
                {(rows.length <= 14 || i % 5 === 0) && <text x={x + bw / 2} y={H - 7} fontSize="9.5" fill="var(--ink3)" textAnchor="middle">{rows.length <= 7 ? dayjs(r.date).format('dd') : dayjs(r.date).format('D/M')}</text>}
              </g>
            )
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink3"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-green-400" />at or under target</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />over by 5%+</span><span><i className="mr-1 inline-block h-0.5 w-3 bg-amber-400 align-middle" />that day's target</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400" />training day</span></div>
        {sel && (
          <div className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-[12.5px]">
            <b>{dayjs(sel.date).format('ddd D MMM')}</b>{trained?.has(sel.date) ? ' · 🏋️ trained' : ''} — {sel.n ? <>{Math.round(sel.kcal).toLocaleString('en-AU')} of {sel.target.toLocaleString('en-AU')} kcal · P {Math.round(sel.protein)} g · C {Math.round(sel.carbs)} g · F {Math.round(sel.fat)} g</> : 'nothing logged'}
            <button type="button" onClick={() => navigate(`/food?date=${sel.date}`)} className="ml-2 text-brand underline">open day</button>
          </div>
        )}
      </Card>
      {insights.length > 0 && (
        <Section title="Insights (last 4 weeks)">
          {insights.map((i) => (
            <Card key={i.id} className={`mb-2 p-3 text-[13px] ${i.tone === 'warn' ? 'border-amber-400/40' : i.tone === 'good' ? 'border-emerald-400/30' : ''}`}>
              <b className={i.tone === 'warn' ? 'text-amber-400' : i.tone === 'good' ? 'text-emerald-400' : ''}>{i.tone === 'warn' ? '⚠ ' : i.tone === 'good' ? '✓ ' : '💡 '}{i.title}</b>
              <div className="mt-0.5 text-ink2">{i.detail}</div>
            </Card>
          ))}
        </Section>
      )}
      <Section title={`Averages over the ${logged.length} logged day${logged.length === 1 ? '' : 's'}`}>
        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <Card className="p-3"><div className="text-ink3">Calories / day</div><b className="text-[20px]">{Math.round(avg('kcal')).toLocaleString('en-AU')}</b><div className="text-[11.5px] text-ink3">target avg {Math.round(avg('target')).toLocaleString('en-AU')}</div></Card>
          <Card className="p-3"><div className="text-ink3">Protein / day</div><b className="text-[20px]">{Math.round(avg('protein'))} g</b><div className={`text-[11.5px] ${avg('protein') >= pTarget * 0.95 ? 'text-emerald-400' : 'text-amber-400'}`}>target {pTarget} g</div></Card>
        </div>
        {macroK > 0 && (
          <Card className="mt-2 p-3 text-[12.5px]">
            <div className="mb-1.5 text-ink3">Where your calories came from</div>
            <div className="flex h-3 overflow-hidden rounded-full">
              <i className="bg-sky-400" style={{ width: `${(avg('protein') * 4 / macroK) * 100}%` }} />
              <i className="bg-amber-400" style={{ width: `${(avg('carbs') * 4 / macroK) * 100}%` }} />
              <i className="bg-rose-400" style={{ width: `${(avg('fat') * 9 / macroK) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-ink3"><span>Protein {Math.round(avg('protein') * 4 / macroK * 100)}%</span><span>Carbs {Math.round(avg('carbs') * 4 / macroK * 100)}%</span><span>Fat {Math.round(avg('fat') * 9 / macroK * 100)}%</span></div>
          </Card>
        )}
        {trained && trained.size > 0 && logged.length > 1 && (() => { const t = logged.filter((r) => trained.has(r.date)), o = logged.filter((r) => !trained.has(r.date)); const a = (L: DayRow[], k: 'kcal' | 'protein') => L.length ? Math.round(L.reduce((x, r) => x + r[k], 0) / L.length) : 0; return t.length && o.length ? (
          <Card className="mt-2 p-3 text-[12.5px]"><div className="mb-1 text-ink3">Training days vs rest days</div><div className="flex justify-between"><span>🏋️ {t.length} training: <b>{a(t, 'kcal').toLocaleString('en-AU')}</b> kcal · <b>{a(t, 'protein')}</b> g P</span></div><div className="flex justify-between"><span>😴 {o.length} rest: <b>{a(o, 'kcal').toLocaleString('en-AU')}</b> kcal · <b>{a(o, 'protein')}</b> g P</span></div></Card>) : null })()}
        <div className="mt-2 text-[11.5px] text-ink3">{rows.length - logged.length} of {rows.length} days have nothing logged — averages use logged days only, so a missed day never looks like a low day.</div>
      </Section>
    </div>
  )
}
