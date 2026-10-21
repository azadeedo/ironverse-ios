// /replay/:logId — a historical workout as a READ-ONLY timeline (IV-16).
// "Copy into a new session" creates a new log; the original is never touched.
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Copy, Lock } from 'lucide-react'
import { db } from '@/db'
import { Badge, Button, Card, PageHeader, Spinner } from '@/components/ui'
import { byId } from '@/data/exercises'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import type { WorkoutLog } from '@/db/types'
import { WatchSummaryCard } from '@/components/WatchSummary'

export default function WorkoutReplay() {
  const { logId } = useParams()
  const navigate = useNavigate()
  const { toast } = useUI()
  const log = useLiveQuery(() => (logId ? db.workoutLogs.get(logId) : undefined), [logId])
  const all = useLiveQuery(() => db.workoutLogs.toArray(), [])
  if (log === undefined || !all) return <div className="flex h-[60svh] items-center justify-center"><Spinner /></div>
  if (!log) return <div className="p-6">Workout not found.</div>
  const before = all.filter((l) => l.finishedAt && l.startedAt < log.startedAt)
  const prevBest = (id: string) => Math.max(0, ...before.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup).map((s) => s.weightKg ?? 0))))
  const times = log.exercises.flatMap((e) => e.sets.filter((s) => s.doneAt).map((s) => s.doneAt!)).sort()
  const restAfter = (t?: string) => { if (!t) return null; const i = times.indexOf(t); return i >= 0 && i < times.length - 1 ? Math.round((new Date(times[i + 1]).getTime() - new Date(t).getTime()) / 1000) : null }
  async function copy() {
    const fresh: WorkoutLog = {
      id: newId(), date: todayStr(), title: `${log!.title} (copy)`, startedAt: nowIso(), status: 'partial',
      ...(log!.planId ? { planId: log!.planId } : {}),
      exercises: log!.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s, i) => ({ setIndex: i, targetReps: s.targetReps, weightKg: s.weightKg, plannedKg: s.weightKg, ...(s.warmup ? { warmup: true } : {}), done: false })) })),
    }
    await db.workoutLogs.put(fresh)
    toast('Copied into a new session — the original is unchanged')
    navigate(`/session/${fresh.id}`)
  }
  const dur = log.finishedAt ? Math.round((new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 60000) : null
  return (
    <div className="pb-8">
      <PageHeader title={log.title} subtitle={`${dayjs(log.date).format('ddd D MMM YYYY')}${dur ? ` · ${dur} min` : ''}`} back="/history" />
      <div className="space-y-3 px-4">
        <div className="flex items-center gap-2 text-[12px] text-ink3"><Lock size={13} /> Read-only replay — nothing here can change the original.</div>
        {log.exercises.map((e, ei) => {
          const pb = prevBest(e.exerciseId)
          return (
            <Card key={ei} className="p-3">
              <div className="flex items-center gap-2"><span className="text-[12px] font-black text-brand">{ei + 1}</span><b className="text-[14.5px]">{byId.get(e.exerciseId)?.name ?? e.exerciseId}</b>{e.extra && <Badge tone="gray">extra</Badge>}</div>
              <div className="mt-1.5 space-y-0.5 text-[12.5px]">
                {e.sets.map((s, si) => {
                  const r = restAfter(s.doneAt)
                  const record = s.done && !s.warmup && (s.weightKg ?? 0) > pb && pb > 0
                  return (
                    <div key={si} className={`flex justify-between ${s.done ? '' : 'text-ink3'}`}>
                      <span>{s.warmup ? 'Warm-up' : `Set ${si + 1}`}{s.doneAt ? ` · ${dayjs(s.doneAt).format('h:mm a')}` : ''}</span>
                      <span>{s.done ? `${s.weightKg ?? 'BW'}${s.weightKg ? ' kg' : ''} × ${s.reps ?? '-'}${s.rir !== undefined ? ` @${s.rir} RIR` : ''}` : 'not done'}{record ? ' 🏆' : ''}{r !== null ? ` · rest ${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}` : ''}</span>
                    </div>
                  )
                })}
              </div>
              {!e.sets.some((s) => s.doneAt) && <div className="mt-1 text-[11px] text-ink3">Rest times weren’t recorded for this workout (they are for workouts from now on).</div>}
            </Card>
          )
        })}
        <WatchSummaryCard logId={log.id} />
        {log.notes && <Card className="p-3 text-[13px]"><b>Notes:</b> {log.notes}</Card>}
        <Button full onClick={() => void copy()}><Copy size={15} /> Copy into a new session</Button>
      </div>
    </div>
  )
}
