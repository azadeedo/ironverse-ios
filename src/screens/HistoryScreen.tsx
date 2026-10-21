// TRAINING HISTORY — a month at a glance. Every day he trained, what it was,
// how long it took, how much he moved and what he broke that day. Tap a day to
// open that session's log.
// Route: /history

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, CalendarDays, ChevronLeft, ChevronRight, Clock, Layers } from 'lucide-react'
import { Badge, Button, Card, EmptyState, PageHeader, Sheet, Spinner, StatCard } from '@/components/ui'
import { BarChart } from '@/components/charts'
import { dayjs, fmtDayShort, fmtInt } from '@/lib/fmt'
import { prsByDate, sessionsPerWeek, trainingDays, type DatedPR, type TrainingDay } from '@/lib/prs'
import { useWorkoutLogsLive } from './exercises/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { byId } from '@/data/exercises'
import type { WorkoutLog } from '@/db/types'

/** History detail: program week/day, readiness, and planned vs actual for every set (unit kept as entered). */
function ProgramLogDetail({ log }: { log: WorkoutLog }) {
  const plan = useLiveQuery(() => (log.planId ? db.plans.get(log.planId) : undefined), [log.planId])
  const cardio = useLiveQuery(() => db.cardioLog.where('date').equals(log.date).toArray(), [log.date]) ?? []
  const m = /^p12-w(\d+)-(tue|wed|thu|fri)$/.exec(log.dayId ?? '')
  const pd = plan?.weeks.flatMap((w) => w.days).find((d) => d.id === log.dayId)
  const c = log.checkin
  const dur = log.finishedAt ? Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 60000) : undefined
  const fmtW = (st: WorkoutLog['exercises'][number]['sets'][number]) => st.weightKg === undefined ? 'BW' : st.unit === 'lb' && st.entered !== undefined ? `${st.entered} lb` : `${st.weightKg} kg`
  return (
    <div className="mt-3 space-y-2 text-[12.5px]">
      <div className="flex flex-wrap gap-1.5">
        {m && <Badge tone="brand">Program week {m[1]} · {m[2][0].toUpperCase() + m[2].slice(1)}</Badge>}
        {c && <Badge tone="gray">Readiness {((c.sleep + c.energy + (6 - c.soreness) + c.readiness) / 4).toFixed(1)}/5</Badge>}
        {dur !== undefined && <Badge tone="gray">{dur} min</Badge>}
        {cardio.length > 0 && <Badge tone="green">Cardio {Math.round(cardio.reduce((n, x) => n + x.seconds, 0) / 60)} min</Badge>}
      </div>
      {log.exercises.map((e, i) => {
        const pe = pd?.exercises.find((x) => x.exerciseId === e.exerciseId)
        const work = e.sets.filter((st) => !st.warmup)
        return (
          <div key={i} className="rounded-xl bg-surface3/50 p-2.5">
            <div className="flex items-center gap-1.5 font-semibold">{pe?.supersetGroup && <span className="text-brand">{pe.supersetGroup}</span>}{byId.get(e.exerciseId)?.name ?? e.exerciseId}{e.extra && <Badge tone="gray">extra</Badge>}</div>
            {pe && <div className="text-ink3">Planned: {pe.sets} × {pe.reps[0] === pe.reps[1] ? pe.reps[0] : `${pe.reps[0]}–${pe.reps[1]}`}{pe.rir ? ` @ ${pe.rir[0] >= 4 ? '4+' : pe.rir[0] === pe.rir[1] ? pe.rir[0] : pe.rir.join('–')} RIR` : ''}</div>}
            <div className="mt-1 space-y-0.5">
              {work.map((st, j) => (
                <div key={j} className="flex justify-between gap-2">
                  <span>Set {j + 1}{st.kind === 'top' ? ' (top)' : st.kind === 'backoff' ? ' (back-off)' : ''}</span>
                  <span className="text-ink3">{st.plannedKg !== undefined ? `planned ${st.plannedKg} kg` : ''}</span>
                  <span className={st.done ? '' : 'text-ink3'}>{st.done ? `${fmtW(st)} × ${st.reps ?? '-'}${st.rir !== undefined ? ` · ${st.rir} RIR` : st.rpe ? ` · RPE ${st.rpe}` : ''}${st.failed ? ' · missed' : ''}` : 'not done'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HistoryScreen() {
  const navigate = useNavigate()
  const logs = useWorkoutLogsLive()
  const [monthAnchor, setMonthAnchor] = useState(() => dayjs().startOf('month'))
  const [picked, setPicked] = useState<string | null>(null)

  const days = useMemo(() => (logs ? trainingDays(logs) : []), [logs])
  const prMap = useMemo(() => (logs ? prsByDate(logs) : new Map<string, DatedPR[]>()), [logs])
  const weeks = useMemo(() => (logs ? sessionsPerWeek(logs, 8) : []), [logs])

  const byDate = useMemo(() => {
    const m = new Map<string, TrainingDay[]>()
    for (const d of days) {
      const list = m.get(d.date)
      if (list) list.push(d)
      else m.set(d.date, [d])
    }
    return m
  }, [days])

  const grid = useMemo(() => {
    const first = monthAnchor.startOf('month')
    const lead = (first.day() + 6) % 7 // Monday-anchored
    const count = first.daysInMonth()
    const cells: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let i = 0; i < count; i++) cells.push(first.add(i, 'day').format('YYYY-MM-DD'))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [monthAnchor])

  const monthKey = monthAnchor.format('YYYY-MM')
  const monthDays = days.filter((d) => d.date.startsWith(monthKey))
  const monthVolume = monthDays.reduce((s, d) => s + d.volumeKg, 0)
  const monthMinutes = monthDays.reduce((s, d) => s + (d.minutes ?? 0), 0)
  const monthSessionDays = new Set(monthDays.map((d) => d.date)).size

  const avgPerWeek = weeks.length
    ? Math.round((weeks.reduce((s, w) => s + w.sessions, 0) / weeks.length) * 10) / 10
    : 0

  const pickedSessions = picked ? (byDate.get(picked) ?? []) : []
  const pickedPRs = picked ? (prMap.get(picked) ?? []) : []

  const today = dayjs().format('YYYY-MM-DD')
  const atCurrentMonth = monthAnchor.isSame(dayjs().startOf('month'))

  if (logs === undefined) {
    return (
      <div>
        <PageHeader title="History" back="/workout" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      <PageHeader
        title="History"
        back="/workout"
        subtitle={days.length === 0 ? 'Nothing logged yet' : `${days.length} sessions logged`}
      />

      {days.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} strokeWidth={1.5} />}
          title="No sessions yet"
          subtitle="Finish a workout and it lands on this calendar with its volume, duration and any records you broke."
        />
      ) : (
        <>
          {/* ---------- month calendar ---------- */}
          <section className="px-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonthAnchor((m) => m.subtract(1, 'month'))}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface3 text-ink"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                  <div className="text-[16px] font-bold text-ink">{monthAnchor.format('MMMM YYYY')}</div>
                  <div className="text-[11.5px] text-ink3">
                    {monthSessionDays} training {monthSessionDays === 1 ? 'day' : 'days'}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Next month"
                  disabled={atCurrentMonth}
                  onClick={() => setMonthAnchor((m) => m.add(1, 'month'))}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface3 text-ink disabled:opacity-30"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d, i) => (
                  <div key={i} className="pb-1 text-center text-[11px] font-semibold text-ink3">{d}</div>
                ))}
                {grid.map((date, i) => {
                  if (!date) return <div key={`b${i}`} className="h-11" />
                  const sessions = byDate.get(date) ?? []
                  const trained = sessions.length > 0
                  const prs = prMap.get(date)?.length ?? 0
                  const isToday = date === today
                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={!trained}
                      onClick={() => setPicked(date)}
                      className={`pressable relative flex h-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold ${
                        trained ? 'bg-brand/15 text-brand' : 'text-ink3'
                      } ${isToday ? 'ring-1 ring-inset ring-brand' : ''} disabled:pointer-events-none`}
                    >
                      {Number(date.slice(-2))}
                      {prs > 0 && (
                        <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-brand" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[11.5px] text-ink3">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-brand/25" /> trained
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> record broken
                </span>
              </div>
            </Card>
          </section>

          {/* ---------- this month ---------- */}
          <section className="grid grid-cols-3 gap-3 px-4 pt-3">
            <StatCard label="Sessions" value={String(monthSessionDays)} sub={monthAnchor.format('MMM')} />
            <StatCard label="Volume" value={`${fmtInt(monthVolume)}`} sub="kg moved" tone="brand" />
            <StatCard
              label="Time"
              value={monthMinutes > 0 ? `${Math.round(monthMinutes / 60)}h` : '—'}
              sub={monthMinutes > 0 ? `${monthMinutes} min` : 'not timed'}
            />
          </section>

          {/* ---------- consistency ---------- */}
          <section className="px-4 pt-4">
            <Card className="p-4">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold text-ink">Consistency</h2>
                <span className="text-[12px] text-ink3">last 8 weeks</span>
              </div>
              <p className="mb-2 text-[12.5px] leading-snug text-ink2">
                Sessions per week. Averaging <span className="font-semibold text-ink">{avgPerWeek}</span> a
                week — the shape of this chart matters more than any single week in it.
              </p>
              <BarChart bars={weeks.map((w) => ({ label: w.label, value: w.sessions }))} height={140} />
            </Card>
          </section>

          {/* ---------- recent sessions ---------- */}
          <section className="px-4 pt-4">
            <h2 className="mb-2 text-[15px] font-semibold text-ink">Recent sessions</h2>
            <Card className="divide-y divide-line overflow-hidden">
              {[...days].reverse().slice(0, 12).map((d) => (
                <button
                  key={d.logId}
                  type="button"
                  onClick={() => navigate(`/session/${d.logId}`)}
                  className="pressable flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium text-ink">{d.title}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink2">
                      {fmtDayShort(d.date)}
                      {d.minutes ? ` · ${d.minutes} min` : ''}
                      {d.volumeKg > 0 ? ` · ${fmtInt(d.volumeKg)} kg` : ''}
                      {!d.finished ? ' · unfinished' : ''}
                    </div>
                  </div>
                  {d.prCount > 0 && <Badge tone="brand">{d.prCount} PR</Badge>}
                  <ChevronRight size={18} className="shrink-0 text-ink3" />
                </button>
              ))}
            </Card>
          </section>
        </>
      )}

      {/* ---------- day sheet ---------- */}
      <Sheet open={picked !== null} onClose={() => setPicked(null)} title={picked ? fmtDayShort(picked) : ''}>
        {pickedSessions.map((s) => (
          <Card key={s.logId} className="mb-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[16px] font-bold text-ink">{s.title}</div>
                <div className="mt-0.5 text-[12.5px] text-ink2">
                  {s.hardSets} working {s.hardSets === 1 ? 'set' : 'sets'}
                  {s.finished ? '' : ' · unfinished'}
                  {(() => {
                    const l = logs?.find((x) => x.id === s.logId)
                    if (!l) return null
                    const bits = [l.status === 'completed' ? 'completed' : l.status === 'partial' ? 'partial' : '', l.feel ? `felt ${l.feel.replace('-', ' ')}` : '', l.discomfort?.length ? `${l.discomfort.length} discomfort note${l.discomfort.length === 1 ? '' : 's'}` : '', l.extras?.length ? `${l.extras.length} extra exercise${l.extras.length === 1 ? '' : 's'}` : ''].filter(Boolean)
                    return bits.length ? ` · ${bits.join(' · ')}` : null
                  })()}
                </div>
              </div>
              {s.prCount > 0 && <Badge tone="brand">{s.prCount} PR</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface3/60 p-2.5">
                <div className="flex items-center gap-1.5 text-ink3">
                  <Clock size={13} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Duration</span>
                </div>
                <div className="big-num mt-1 text-[19px] leading-none text-ink">
                  {s.minutes ? `${s.minutes} min` : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-surface3/60 p-2.5">
                <div className="flex items-center gap-1.5 text-ink3">
                  <Layers size={13} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Volume</span>
                </div>
                <div className="big-num mt-1 text-[19px] leading-none text-ink">
                  {s.volumeKg > 0 ? `${fmtInt(s.volumeKg)} kg` : '—'}
                </div>
              </div>
            </div>
            {(() => { const l = logs?.find((x) => x.id === s.logId); return l ? <ProgramLogDetail log={l} /> : null })()}
            <Button full className="mt-3" onClick={() => navigate(`/session/${s.logId}`)}>
              Open this session
            </Button>
            <Button full variant="secondary" className="mt-2" onClick={() => navigate(`/replay/${s.logId}`)}>
              Replay (read-only) or copy
            </Button>
          </Card>
        ))}

        {pickedPRs.length > 0 && (
          <>
            <h3 className="mb-2 mt-1 text-[13px] font-semibold uppercase tracking-wide text-ink3">
              Broken that day
            </h3>
            <Card className="divide-y divide-line overflow-hidden">
              {pickedPRs.map((p, i) => (
                <div key={`${p.exerciseId}-${p.kind}-${i}`} className="flex items-start gap-2.5 px-4 py-3">
                  <Award size={15} className="mt-0.5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink">{p.name}</div>
                    <div className="text-[12.5px] leading-snug text-ink2">{p.detail}</div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </Sheet>
    </div>
  )
}
