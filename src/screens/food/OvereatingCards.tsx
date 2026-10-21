// Full Mon–Sun week, "way off the chart" day help, and pattern tips.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Lightbulb, TrendingUp } from 'lucide-react'
import { Card, IconButton } from '@/components/ui'
import { db } from '@/db'
import type { DayAdjust, Profile } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { todayStr } from '@/lib/id'
import { mondayOf, offChartAdvice, patternTips, weekView, type DayState } from '@/lib/overeating'
import { targetFloor, targetForDateWith } from './helpers'

const STATE_COLOR: Record<DayState, string> = {
  unlogged: 'var(--surface3)', future: 'var(--surface3)', under: '#38bdf8', on: '#10b981', over: '#f59e0b', 'way-over': '#f97316', 'off-chart': '#ef4444',
}
const STATE_LABEL: Record<DayState, string> = {
  unlogged: 'not logged', future: 'to come', under: 'under', on: 'on target', over: 'over', 'way-over': 'well over', 'off-chart': 'off the chart',
}

export function FullWeekCard({ anchorDate, profile, adjusts, onPickDay }: {
  anchorDate: string; profile: Profile; adjusts: Map<string, DayAdjust> | undefined; onPickDay?: (date: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const monday = dayjs(mondayOf(anchorDate)).add(offset * 7, 'day').format('YYYY-MM-DD')
  const sunday = dayjs(monday).add(6, 'day').format('YYYY-MM-DD')
  const entries = useLiveQuery(() => db.foodLog.where('date').between(monday, sunday, true, true).toArray(), [monday, sunday])
  const today = todayStr()
  const wv = useMemo(() => weekView(entries ?? [], monday, (d) => targetForDateWith(d, profile, adjusts), today), [entries, monday, profile, adjusts, today])
  const max = Math.max(...wv.days.map((d) => Math.max(d.kcal, d.target)), 1)
  const isCurrent = monday === mondayOf(today)
  const past = sunday < today
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-brand" />
        <h3 className="flex-1 text-[15px] font-semibold">Full week</h3>
        <IconButton label="Previous week" onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={18} /></IconButton>
        <button type="button" className="pressable text-[12px] text-ink2" onClick={() => setOffset(0)}>{dayjs(monday).format('D MMM')} – {dayjs(sunday).format('D MMM')}</button>
        <IconButton label="Next week" onClick={() => setOffset((o) => o + 1)}><ChevronRight size={18} /></IconButton>
      </div>
      <div className="mt-3 grid grid-cols-7 items-end gap-1.5" style={{ height: 150 }} role="list" aria-label="Calories per day this week">
        {wv.days.map((d) => (
          <button key={d.date} type="button" role="listitem" onClick={() => onPickDay?.(d.date)}
            aria-label={`${d.label}: ${d.kcal} of ${d.target} kcal, ${STATE_LABEL[d.state]}`}
            className="pressable relative flex h-full flex-col items-center justify-end">
            <div className="absolute inset-x-0 border-t-2 border-dashed border-ink3/50" style={{ bottom: `${(d.target / max) * 118 + 22}px` }} />
            <div className="w-full rounded-t-md" style={{ height: `${Math.max(d.kcal ? 4 : 2, (d.kcal / max) * 118)}px`, background: STATE_COLOR[d.state] }} />
            <div className={`mt-1 text-[11px] font-semibold ${d.date === today ? 'text-brand' : 'text-ink3'}`}>{d.label}</div>
          </button>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-ink3">
        {(['on', 'under', 'over', 'way-over', 'off-chart'] as DayState[]).map((s) => <span key={s} className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: STATE_COLOR[s] }} />{STATE_LABEL[s]}</span>)}
        <span>dashed = that day's target</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Eaten" value={wv.eaten.toLocaleString()} sub={`of ${wv.budget.toLocaleString()}`} />
        <Stat label={wv.remaining < 0 ? 'Over week' : 'Left'} value={Math.abs(wv.remaining).toLocaleString()} sub="kcal" tone={wv.remaining < 0 ? 'bad' : 'good'} />
        <Stat label="Days over" value={`${wv.overDays}`} sub={`of ${wv.days.filter((d) => d.entries > 0).length} logged`} tone={wv.overDays > 2 ? 'warn' : undefined} />
      </div>
      <div className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-ink2">
        {isCurrent && wv.daysLeft > 0 && (
          wv.remaining >= 0
            ? <p>About <b className="text-ink">{wv.perDayLeft.toLocaleString()} kcal a day</b> keeps the week on budget for the {wv.daysLeft} day{wv.daysLeft === 1 ? '' : 's'} left (today included).</p>
            : <p>The week is <b className="text-ink">{Math.abs(wv.remaining).toLocaleString()} kcal over</b>. Don't try to claw it all back — just eat to target from here; the overall trend still counts.</p>
        )}
        {isCurrent && wv.avgLogged > 0 && <p>At your current average ({wv.avgLogged.toLocaleString()}/day) the week finishes around <b className="text-ink">{wv.projected.toLocaleString()}</b> vs {wv.budget.toLocaleString()} budget.</p>}
        {wv.worst && <p>Biggest day: <b className="text-ink">{dayjs(wv.worst.date).format('dddd')}</b>, {(wv.worst.kcal - wv.worst.target).toLocaleString()} kcal over.</p>}
        {past && wv.days.some((d) => d.entries > 0) && <p>{wv.remaining >= 0 ? `Finished ${wv.remaining.toLocaleString()} kcal under budget.` : `Finished ${Math.abs(wv.remaining).toLocaleString()} kcal over budget — about ${Math.round(Math.abs(wv.remaining) / 7700 * 1000)} g of fat at most.`} Protein averaged {wv.proteinAvg} g.</p>}
        {!wv.days.some((d) => d.entries > 0) && <p>Nothing logged this week.</p>}
      </div>
    </Card>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="rounded-xl bg-surface3 px-2 py-2">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-ink3">{label}</div>
      <div className={`text-[16px] font-bold ${tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-ink'}`}>{value}</div>
      <div className="text-[11px] text-ink3">{sub}</div>
    </div>
  )
}

/** Shown on the day view once a day is more than 5% over its target. */
export function OffChartCard({ kcal, target, protein, profile }: { kcal: number; target: number; protein: number; profile: Profile }) {
  const a = offChartAdvice(kcal, target, targetFloor(profile), protein, profile.proteinTarget)
  if (!a) return null
  const tone = a.level === 'off-chart' ? 'border-red-500/30 bg-red-500/8' : a.level === 'way-over' ? 'border-orange-500/30 bg-orange-500/8' : 'border-amber-500/25 bg-amber-500/6'
  return (
    <Card className={`border p-4 ${tone}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className={a.level === 'over' ? 'mt-0.5 text-amber-500' : 'mt-0.5 text-orange-500'} />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{a.headline}</h3>
          <div className="text-[12.5px] text-ink2">{a.over.toLocaleString()} kcal over · {Math.round((kcal / target) * 100)}% of target</div>
        </div>
      </div>
      <div className="mt-2.5 space-y-1.5 text-[12.5px] leading-relaxed text-ink2">{a.facts.map((f, i) => <p key={i}>{f}</p>)}</div>
      <div className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-ink3">What helps</div>
      <ul className="mt-1.5 space-y-1.5">
        {a.tips.map((t, i) => <li key={i} className="flex gap-2 text-[13px] leading-snug"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{t}</li>)}
      </ul>
    </Card>
  )
}

export function PatternTipsCard({ profile, adjusts }: { profile: Profile; adjusts: Map<string, DayAdjust> | undefined }) {
  const today = todayStr()
  const since = dayjs(today).subtract(27, 'day').format('YYYY-MM-DD')
  const entries = useLiveQuery(() => db.foodLog.where('date').between(since, today, true, true).toArray(), [since, today])
  const tips = useMemo(() => patternTips(entries ?? [], (d) => targetForDateWith(d, profile, adjusts), profile.proteinTarget, today), [entries, profile, adjusts, today])
  if (!entries) return null
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2"><Lightbulb size={16} className="text-brand" /><h3 className="text-[15px] font-semibold">Your patterns · last 4 weeks</h3></div>
      <div className="mt-2.5 space-y-2.5">
        {tips.map((t) => (
          <div key={t.id} className="flex gap-2.5">
            <TrendingUp size={15} className={`mt-0.5 shrink-0 ${t.tone === 'good' ? 'text-good' : t.tone === 'warn' ? 'text-warn' : 'text-ink3'}`} />
            <div><div className="text-[13.5px] font-semibold">{t.title}</div><div className="text-[12.5px] leading-relaxed text-ink2">{t.detail}</div></div>
          </div>
        ))}
      </div>
    </Card>
  )
}
