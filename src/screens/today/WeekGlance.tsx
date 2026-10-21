// IV-36 — compact weekly review: the last 7 days in four numbers + one honest
// line, with a link to the full report. Only uses what was logged.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { db } from '@/db'
import { Card } from '@/components/ui'
import type { FoodLogEntry, Profile, WeighIn, WorkoutLog } from '@/db/types'

export function weekGlance(today: string, logs: WorkoutLog[], food: FoodLogEntry[], weighIns: WeighIn[], profile: Profile) {
  const from = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD')
  const sessions = logs.filter((l) => l.finishedAt && !l.skipped && l.date >= from && l.date <= today).length
  const byDay = new Map<string, { k: number; p: number }>()
  for (const e of food) if (e.date >= from && e.date <= today) { const d = byDay.get(e.date) ?? { k: 0, p: 0 }; d.k += e.kcal; d.p += e.protein; byDay.set(e.date, d) }
  const days = [...byDay.values()]
  const avgKcal = days.length ? Math.round(days.reduce((a, d) => a + d.k, 0) / days.length) : null
  const proteinDays = days.filter((d) => d.p >= profile.proteinTarget * 0.9).length
  const w = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const recent = w.filter((x) => x.date >= from), before = w.filter((x) => x.date < from && x.date >= dayjs(from).subtract(7, 'day').format('YYYY-MM-DD'))
  const avg = (L: WeighIn[]) => (L.length ? L.reduce((a, x) => a + x.weightKg, 0) / L.length : null)
  const a1 = avg(recent), a0 = avg(before)
  const change = a1 !== null && a0 !== null ? Math.round((a1 - a0) * 10) / 10 : null
  const target = profile.daysPerWeek || 4
  const line = days.length < 4 ? `Food logged on ${days.length} of 7 days — log a few more for a fair read.`
    : sessions < target ? `${sessions} of ${target} workouts — aim to fit the missing one in (you can move a workout to a free day).`
      : change !== null && change > 0.3 ? 'Training is on point; weight average is up a little — check the weekend and salty meals before changing anything.'
        : 'Solid week — keep the same plan.'
  return { sessions, target, avgKcal, loggedDays: days.length, proteinDays, change, line }
}

export function WeekGlance({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const from = dayjs(today).subtract(14, 'day').format('YYYY-MM-DD')
  const data = useLiveQuery(async () => {
    const [logs, food, weighIns] = await Promise.all([
      db.workoutLogs.where('date').aboveOrEqual(from).toArray(),
      db.foodLog.where('date').aboveOrEqual(from).toArray(),
      db.weighIns.where('date').aboveOrEqual(from).toArray(),
    ])
    return weekGlance(today, logs, food, weighIns, profile)
  }, [today, profile.proteinTarget, profile.daysPerWeek])
  if (!data) return null
  const cell = (l: string, v: string) => <div className="rounded-xl bg-surface3/60 p-2 text-center"><div className="text-[11px] text-ink3">{l}</div><b className="text-[14px]">{v}</b></div>
  return (
    <Card className="p-3.5 text-[13px]" onClick={() => navigate('/review')}>
      <div className="flex items-center gap-2"><CalendarCheck size={16} className="text-brand" /><b className="flex-1">Last 7 days</b><ChevronRight size={16} className="text-ink3" /></div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {cell('Workouts', `${data.sessions}/${data.target}`)}
        {cell('Avg kcal', data.avgKcal === null ? '—' : String(data.avgKcal))}
        {cell('Protein days', `${data.proteinDays}/${data.loggedDays}`)}
        {cell('Weight', data.change === null ? '—' : `${data.change > 0 ? '+' : ''}${data.change}`)}
      </div>
      <div className="mt-2 text-ink2">{data.line}</div>
    </Card>
  )
}
