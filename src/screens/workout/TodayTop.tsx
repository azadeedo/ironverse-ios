// Top of the Workout tab for the 12-week program: TODAY's exercises first —
// no scrolling to find out what you're doing — then the start button, this
// week's four days, and what the app recommends for each lift. Everything that
// was already on the Workout tab stays below this block.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Clock, Dumbbell, Footprints, Play, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { db } from '@/db'
import { Badge, Button, Card } from '@/components/ui'
import { byId } from '@/data/exercises'
import { MEDIA } from '@/data/media'
import { DAY_LABEL, DAY_ORDER, PHASES, type DayKey } from '@/data/program12'
import type { ExerciseMeta, Plan, PlanDay, WorkoutLog } from '@/db/types'
import { dayIdFor, prescribeAccessory, prescribeMain, programWeekFor, type Prescription } from '@/lib/program12'
import { getProgramEquipment, getProgramSetup } from '@/lib/programStore'
import { todayStr } from '@/lib/id'
import { cardioText } from '@/screens/ProgramScreen'
import { MoveWorkout } from './MoveWorkout'

const rng = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`)

export function TodayTop({ plan, week, dayKey, isToday, openLog, onStart }: {
  plan: Plan; week: number; dayKey: DayKey; isToday: boolean; openLog?: WorkoutLog; onStart: () => void
}) {
  const navigate = useNavigate()
  const pd: PlanDay | undefined = plan.weeks[week - 1]?.days.find((d) => d.id === dayIdFor(week, dayKey))
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const setup = useLiveQuery(() => getProgramSetup(), [])
  const eq = useLiveQuery(() => getProgramEquipment(plan), [plan.id])
  const bw = useLiveQuery(async () => (await db.profile.get('me'))?.weightKg, [])
  const meta = useLiveQuery(async () => new Map<string, ExerciseMeta>((await db.exerciseMeta.toArray()).map((m) => [m.exerciseId, m])), [])
  const rx = useMemo(() => {
    const m = new Map<string, Prescription>()
    if (!pd || !logs || setup === undefined) return m
    for (const pe of pd.exercises) {
      try {
        m.set(pe.exerciseId, pe.role === 'main'
          ? prescribeMain(pe, pe.lift ?? 'bench', week, logs, { ...(setup ?? {}), bodyweightKg: setup?.bodyweightKg ?? bw }, eq ?? null, meta?.get(pe.exerciseId))
          : prescribeAccessory(pe, logs, eq ?? null, meta?.get(pe.exerciseId), bw))
      } catch { /* a bad row never blanks the list */ }
    }
    return m
  }, [pd, logs, setup, eq, meta, week, bw])
  if (!pd) return null
  const pw = programWeekFor(plan, todayStr())
  const totalSets = pd.exercises.reduce((n, e) => n + e.sets, 0)
  const monday = logs ? logs : []
  const doneIds = new Set(monday.filter((l) => l.planId === plan.id && l.finishedAt && !l.skipped).map((l) => l.dayId))
  return (
    <div className="space-y-2.5 px-4 pb-2">
      <Card className={`overflow-hidden p-0 ${pd.kind === 'pr' ? 'border border-amber-400/40' : pd.kind === 'deload' ? 'border border-sky-400/30' : 'border border-brand/25'}`}>
        <div className="bg-gradient-to-br from-brand/15 via-surface2 to-surface2 px-4 pb-2.5 pt-3">
          <div className="text-[11.5px] font-black uppercase tracking-[0.14em] text-brand">
            {isToday ? 'Today' : DAY_LABEL[dayKey]} · Week {week} · {PHASES[week - 1]?.name}
          </div>
          <div className="mt-0.5 text-[19px] font-bold leading-tight">{pd.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink2">
            <span className="inline-flex items-center gap-1"><Dumbbell size={13} /> {pd.exercises.length} exercises · {totalSets} sets</span>
            <span className="inline-flex items-center gap-1"><Clock size={13} /> ~{pd.estMinutes} min</span>
            {pd.cardio && <span className="inline-flex items-center gap-1 text-emerald-300"><Footprints size={13} /> {cardioText(pd)}</span>}
          </div>
        </div>
        <div className="divide-y divide-line">
          {pd.exercises.map((pe, i) => {
            const ex = byId.get(pe.exerciseId)
            const m = MEDIA[pe.exerciseId]
            const r = rx.get(pe.exerciseId)
            const kgs = [...new Set((r?.sets ?? []).map((s) => s.kg).filter((k): k is number => !!k))]
            const flag = r?.flags.includes('increase') ? 'up' : r?.flags.includes('maintain') ? 'hold' : null
            return (
              <button key={`${pe.exerciseId}-${i}`} type="button" onClick={() => navigate(`/exercise/${pe.exerciseId}`)} className="pressable flex w-full items-center gap-3 px-3 py-2 text-left">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black">
                  {m?.video ? <video src={m.video} poster={m.imgSmall} autoPlay loop muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />
                    : m ? <img src={m.imgSmall ?? m.img} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {pe.supersetGroup && <span className="text-[12px] font-black text-brand">{pe.supersetGroup}</span>}
                    <span className="truncate text-[14.5px] font-semibold">{ex?.name ?? pe.exerciseId}</span>
                  </div>
                  <div className="text-[12.5px] text-ink2">
                    {pe.scheme?.kind === 'pr-test' ? 'PR attempts (optional)' : pe.scheme?.kind === 'single-backoff' || pe.scheme?.kind === 'top-backoff'
                      ? `1 × ${pe.scheme.topReps} @ RPE ${pe.scheme.topRpe?.join('–')} + ${pe.scheme.backoffSets} × ${rng(pe.scheme.backoffReps ?? [3, 3])}`
                      : `${pe.sets} × ${rng(pe.reps)}`}{pe.rir ? ` · ${pe.rir[0] >= 4 ? '4+' : rng(pe.rir)} RIR` : ''}{pe.perSide ? ' · each side' : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13.5px] font-bold text-brand">{kgs.length ? `${kgs.slice(0, 2).join(' / ')} kg` : ex?.loadMode === 'bodyweight' ? 'BW' : '—'}</div>
                  {flag === 'up' && <div className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-emerald-300"><TrendingUp size={11} /> up</div>}
                  {flag === 'hold' && <div className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-amber-300"><TrendingDown size={11} /> hold</div>}
                </div>
              </button>
            )
          })}
        </div>
        <div className="px-4 pb-3 pt-2">
          <Button full onClick={onStart}>{openLog ? <RotateCcw size={17} /> : <Play size={17} />} {openLog ? 'Resume today’s workout' : isToday ? 'Start today’s workout' : `Start ${DAY_LABEL[dayKey]}’s workout`}</Button>
          <div className="mt-1.5 text-center text-[11px] text-ink3">Weights are recommendations from your last sessions — up when you hit every rep, hold or drop when you didn’t.</div>
        </div>
      </Card>
      <MoveWorkout plan={plan} dayKey={dayKey} />
      <div className="grid grid-cols-4 gap-1.5">
        {DAY_ORDER.map((d) => {
          const id = dayIdFor(pw.week, d)
          const done = doneIds.has(id)
          const cur = d === dayKey && week === pw.week
          return (
            <button key={d} type="button" onClick={() => navigate(`/program/day/${pw.week}/${d}`)}
              className={`pressable flex min-h-[46px] flex-col items-center justify-center rounded-xl text-[11.5px] font-semibold ${cur ? 'bg-brand/20 ring-1 ring-brand text-brand' : 'bg-surface2 text-ink2'}`}>
              <span>{DAY_LABEL[d].slice(0, 3)}</span>
              {done ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className="text-[10px] text-ink3">{plan.weeks[pw.week - 1]?.days.find((x) => x.id === id)?.exercises.length ?? 0} ex</span>}
            </button>
          )
        })}
      </div>
      {!isToday && <Badge tone="gray">Not a training day — showing your next session</Badge>}
    </div>
  )
}
