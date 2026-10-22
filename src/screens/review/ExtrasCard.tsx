// Review → "More from your week" (owner request, 23 Oct 2026): records broken,
// the lifts that carried the most work, muscles hit, steps, water, creatine,
// check-ins and Apple Health cardio. Everything comes from what was logged.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Card, Section, StatCard } from '@/components/ui'
import { db } from '@/db'
import { byId } from '@/data/exercises'
import { epley1RM } from '@/lib/training'
import type { WeekRange } from './helpers'

export default function ExtrasCard({ range, waterTargetMl, stepsTarget }: { range: WeekRange; waterTargetMl?: number; stepsTarget?: number }) {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const water = useLiveQuery(() => db.waterLog.where('date').between(range.start, range.end, true, false).toArray(), [range.start, range.end])
  const creatine = useLiveQuery(() => db.creatineLog.where('date').between(range.start, range.end, true, false).toArray(), [range.start, range.end])
  const checkins = useLiveQuery(() => db.checkins.where('date').between(range.start, range.end, true, false).toArray(), [range.start, range.end])
  const cardio = useLiveQuery(() => db.cardioLog.where('date').between(range.start, range.end, true, false).toArray(), [range.start, range.end])

  const m = useMemo(() => {
    if (!logs || !water || !creatine || !checkins || !cardio) return null
    const inWeek = (d: string) => d >= range.start && d < range.end
    const week = logs.filter((l) => inWeek(l.date))
    const before = logs.filter((l) => l.date < range.start)
    const best = (ls: typeof logs, id: string) => {
      let b = 0
      for (const l of ls) for (const e of l.exercises) if (e.exerciseId === id) for (const s of e.sets) if (s.done && s.weightKg && s.reps) b = Math.max(b, epley1RM(s.weightKg, s.reps))
      return b
    }
    const ids = [...new Set(week.flatMap((l) => l.exercises.map((e) => e.exerciseId)))]
    const prs = ids.map((id) => ({ id, now: best(week, id), was: best(before, id) }))
      .filter((r) => r.now > 0 && r.was > 0 && r.now > r.was * 1.005)
      .sort((a, b) => (b.now - b.was) - (a.now - a.was))
    const volume = new Map<string, number>()
    for (const l of week) for (const e of l.exercises) for (const s of e.sets) if (s.done && s.weightKg && s.reps) volume.set(e.exerciseId, (volume.get(e.exerciseId) ?? 0) + s.weightKg * s.reps)
    const topLifts = [...volume].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const muscles = new Set(week.flatMap((l) => l.exercises.filter((e) => e.sets.some((s) => s.done)).flatMap((e) => byId.get(e.exerciseId)?.primary ?? [])))
    const days = Math.max(1, Math.min(7, Math.round((Math.min(Date.now(), new Date(range.end).getTime()) - new Date(range.start).getTime()) / 86400000)))
    const waterAvg = Math.round(water.reduce((s, w) => s + w.ml, 0) / days)
    const steps = checkins.map((c) => c.steps).filter((n): n is number => typeof n === 'number' && n > 0)
    const stepsAvg = steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null
    const avg = (k: 'sleep' | 'energy' | 'readiness') => { const v = checkins.map((c) => c[k]).filter((n): n is number => typeof n === 'number'); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null }
    const health = cardio.filter((c) => c.id.startsWith('hk-'))
    return {
      prs, topLifts, muscles: muscles.size, waterAvg, stepsAvg, stepDays: steps.length,
      creatineDays: new Set(creatine.filter((c) => c.taken).map((c) => c.date)).size, days,
      sleep: avg('sleep'), energy: avg('energy'), readiness: avg('readiness'),
      healthWorkouts: health.length, healthKcal: health.reduce((s, c) => s + (c.calories ?? 0), 0),
      longest: week.reduce((mx, l) => Math.max(mx, l.finishedAt ? (new Date(l.finishedAt).getTime() - new Date(l.startedAt).getTime()) / 60000 : 0), 0),
    }
  }, [logs, water, creatine, checkins, cardio, range])

  if (!m) return null
  const name = (id: string) => byId.get(id)?.name ?? id
  return (
    <Section title="More from your week">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Records broken" value={String(m.prs.length)} sub={m.prs.length ? 'estimated 1-rep max up' : 'none this week'} tone={m.prs.length ? 'green' : 'default'} />
        <StatCard label="Muscles trained" value={String(m.muscles)} sub="with at least one done set" />
        <StatCard label="Steps (avg)" value={m.stepsAvg ? m.stepsAvg.toLocaleString() : '—'} sub={m.stepsAvg ? `${m.stepDays} day${m.stepDays === 1 ? '' : 's'}${stepsTarget ? ` · target ${stepsTarget.toLocaleString()}` : ''}` : 'connect Apple Health or type them on Today'} tone={m.stepsAvg && stepsTarget && m.stepsAvg >= stepsTarget ? 'green' : 'default'} />
        <StatCard label="Water (avg/day)" value={m.waterAvg ? `${(m.waterAvg / 1000).toFixed(1)} L` : '—'} sub={waterTargetMl ? `target ${(waterTargetMl / 1000).toFixed(1)} L` : 'logged on Today'} tone={waterTargetMl && m.waterAvg >= waterTargetMl ? 'green' : 'default'} />
        <StatCard label="Creatine" value={`${m.creatineDays}/${m.days}`} sub="days taken" tone={m.creatineDays >= m.days ? 'green' : 'default'} />
        <StatCard label="Longest session" value={m.longest ? `${Math.round(m.longest)} min` : '—'} sub="start to finish" />
      </div>

      {m.prs.length > 0 && (
        <Card className="mt-3 p-4">
          <div className="mb-1.5 text-[13px] font-semibold">🏆 New records</div>
          {m.prs.slice(0, 5).map((r) => (
            <button key={r.id} type="button" onClick={() => navigate(`/exercise/${r.id}`)} className="pressable flex w-full justify-between py-1 text-left text-[13px]">
              <span className="truncate">{name(r.id)}</span><span className="shrink-0 text-good">{Math.round(r.was)} → {Math.round(r.now)} kg e1RM</span>
            </button>
          ))}
        </Card>
      )}
      {m.topLifts.length > 0 && (
        <Card className="mt-3 p-4">
          <div className="mb-1.5 text-[13px] font-semibold">💪 Most work done</div>
          {m.topLifts.map(([id, kg]) => (
            <div key={id} className="flex justify-between py-1 text-[13px]"><span className="truncate">{name(id)}</span><span className="shrink-0 text-ink2">{Math.round(kg).toLocaleString()} kg moved</span></div>
          ))}
        </Card>
      )}
      {(m.sleep || m.energy || m.readiness || m.healthWorkouts > 0) && (
        <Card className="mt-3 p-4 text-[13px]">
          {(m.sleep || m.energy || m.readiness) && <div><b>Check-ins (1–5):</b> sleep {m.sleep ?? '—'} · energy {m.energy ?? '—'} · readiness {m.readiness ?? '—'}</div>}
          {m.healthWorkouts > 0 && <div className="mt-1">❤️ <b>Apple Health:</b> {m.healthWorkouts} cardio workout{m.healthWorkouts === 1 ? '' : 's'}{m.healthKcal ? `, ${Math.round(m.healthKcal)} kcal` : ''}</div>}
        </Card>
      )}
    </Section>
  )
}
