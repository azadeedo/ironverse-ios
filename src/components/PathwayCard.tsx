import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { db } from '@/db'
import { Badge, Card } from '@/components/ui'
import { byId } from '@/data/exercises'
import { pathwayFor, pathwayStatus } from '@/lib/pathways'

export function PathwayCard({ exerciseId }: { exerciseId: string }) {
  const navigate = useNavigate()
  const p = pathwayFor(exerciseId)
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const profile = useLiveQuery(() => db.profile.toCollection().first(), [])
  if (!p || !logs) return null
  const st = pathwayStatus(p, logs, profile?.weightKg ?? 80)
  return (
    <Card className="p-4 text-[13px]">
      <div className="flex items-center gap-2"><b className="flex-1 text-[15px]">{p.name}</b><Badge tone="gray">from your logged sets</Badge></div>
      <ol className="mt-2 space-y-2">
        {st.stages.map((s, i) => {
          const name = byId.get(s.stage.id)?.name ?? s.stage.id
          const isCur = i === st.current, here = s.stage.id === exerciseId
          return (
            <li key={s.stage.id} className={`rounded-xl p-2.5 ${isCur ? 'bg-brand/12' : 'bg-surface3/60'}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${s.achieved ? 'bg-emerald-500 text-white' : isCur ? 'bg-brand text-white' : 'bg-surface2 text-ink3'}`}>{s.achieved ? '✓' : i + 1}</span>
                <button type="button" className={`flex-1 text-left font-semibold ${here ? 'text-brand' : ''}`} onClick={() => navigate(`/exercise/${s.stage.id}`)}>{name}</button>
                {isCur && <Badge tone="brand">you are here</Badge>}
              </div>
              <div className="mt-1 pl-8 text-[12px] text-ink2">
                Milestone: {s.stage.sets} × {s.stage.reps}{s.minKg ? ` at ${s.minKg} kg+` : ''}{s.stage.note ? ` (${s.stage.note})` : ''} in one session
                {s.achieved ? <> — <b className="text-emerald-400">done {dayjs(s.achieved).format('D MMM YY')}</b></> : s.best ? <> — best so far {s.best.sets} of {s.stage.sets} sets ({dayjs(s.best.date).format('D MMM')})</> : ' — not tried yet'}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="mt-2 text-[11px] text-ink3">Reach a milestone before moving on — it is a guide, not a rule. Nothing in your plan changes unless you swap the exercise yourself.</div>
    </Card>
  )
}
