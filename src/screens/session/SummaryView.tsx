// Post-workout summary: headline stats, PRs vs history, per-exercise volume.

import { saveWorkoutTemplate } from '@/lib/saved'
import { shareWorkoutCard } from '@/lib/shareCard'
import { useNavigate } from 'react-router-dom'
import { Check, Clock, Dumbbell, Flame, Trophy, Weight } from 'lucide-react'
import type { WorkoutLog } from '@/db/types'
import { fmtDayShort, fmtInt } from '@/lib/fmt'
import { useState } from 'react'
import { Button, Card, ListGroup, ListRow, Section } from '@/components/ui'
import { FeelPrompt, PRCelebration } from './V6'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { byId } from '@/data/exercises'
import { addExerciseToProgram, getProgramPlan } from '@/lib/programStore'
import { useUI } from '@/lib/store'
import { WatchSummaryCard } from '@/components/WatchSummary'

/** After the workout: every extra exercise → KEEP AS ONE-OFF or ADD TO PROGRAM. */
function ExtrasDecision({ log }: { log: WorkoutLog }) {
  const { toast } = useUI()
  const live = useLiveQuery(() => db.workoutLogs.get(log.id), [log.id]) ?? log
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  const extras = [...new Set(live.extras ?? [])]
  if (!extras.length || !plan || !/^p12-w/.test(live.dayId ?? '')) return null
  const decide = async (id: string, d: 'one-off' | 'program') => {
    if (d === 'program') {
      const inPlan = plan.weeks.some((w) => w.days.some((dd) => dd.id === live.dayId && dd.exercises.some((e) => e.exerciseId === id)))
      if (!inPlan) await addExerciseToProgram(plan, live.dayId!, id, (byId.get(id)?.repRange ?? [8, 12]) as [number, number])
    }
    await db.workoutLogs.update(live.id, { extrasDecision: { ...(live.extrasDecision ?? {}), [id]: d } })
    toast(d === 'program' ? `${byId.get(id)?.name ?? 'Exercise'} added to this day of your program from now on` : 'Kept as a one-off — it stays in your history and volume')
  }
  return (
    <div className="px-4 pt-3">
      <Card className="space-y-2 p-3.5">
        <div className="text-[14px] font-semibold">Extra exercises today</div>
        {extras.map((id) => {
          const d = live.extrasDecision?.[id]
          return (
            <div key={id} className="rounded-xl bg-surface3/50 p-2.5">
              <div className="text-[13.5px] font-semibold">{byId.get(id)?.name ?? id}</div>
              {d ? <div className="text-[12px] text-ink3">{d === 'program' ? 'Added to the program' : 'Kept as a one-off'}</div> : (
                <div className="mt-1.5 flex gap-2">
                  <Button small variant="secondary" className="flex-1" onClick={() => void decide(id, 'one-off')}>Keep as one-off</Button>
                  <Button small className="flex-1" onClick={() => void decide(id, 'program')}>Add to program</Button>
                </div>
              )}
            </div>
          )
        })}
        <div className="text-[11px] text-ink3">Either way the sets are logged, count toward weekly volume and stay in history.</div>
      </Card>
    </div>
  )
}
import {
  doneSetCount, exerciseVolume, fmtElapsed, nameFor, totalSetCount, type SessionPR,
} from './helpers'

export interface SummaryData {
  log: WorkoutLog
  durationSec: number
  volumeKg: number
  calories: number
  prs: SessionPR[]
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="p-4 text-center">
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand/12 text-brand">
        {icon}
      </div>
      <div className="big-num text-[22px] leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">{label}</div>
    </Card>
  )
}

export function SummaryView({ data, feel, onFeel }: { data: SummaryData; feel?: WorkoutLog['feel']; onFeel?: (f: NonNullable<WorkoutLog['feel']>) => void }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const { log, durationSec, volumeKg, calories, prs } = data
  const fresh = !!log.finishedAt && Date.now() - new Date(log.finishedAt).getTime() < 120000
  const [celebrate, setCelebrate] = useState(fresh && prs.length > 0)
  const done = doneSetCount(log)
  const total = totalSetCount(log)

  return (
    <div className="flex min-h-full flex-col pb-8">
      <div className="pt-safe px-4 pb-2 pt-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check size={34} strokeWidth={3} />
        </div>
        <h1 className="shout text-[26px] leading-tight text-ink">Workout complete</h1>
        <p className="mt-1 text-[14px] text-ink2">
          {log.title} · {fmtDayShort(log.date)}
        </p>
      </div>

      {onFeel && <div className="px-4 pt-2"><FeelPrompt value={feel} onPick={onFeel} /></div>}
      <ExtrasDecision log={log} />
      {/^p12-w(\d+)-fri$/.test(log.dayId ?? '') && <div className="px-4 pt-2"><Button full variant="secondary" onClick={() => navigate(`/program/review/${/^p12-w(\d+)/.exec(log.dayId!)![1]}`)}>Week {/^p12-w(\d+)/.exec(log.dayId!)![1]} complete — open the review</Button></div>}
      {(log.discomfort?.length ?? 0) > 0 && <div className="px-4 pt-2 text-[12.5px] text-amber-300">Discomfort noted on {log.discomfort!.length} exercise{log.discomfort!.length === 1 ? '' : 's'} — if it keeps coming back, swap the movement and get it checked.</div>}
      {celebrate && <PRCelebration prs={prs.map((p) => ({ name: p.name, detail: p.detail, previous: p.prev === null ? undefined : (p.metric === 'reps' ? `${p.prev} reps` : `${Math.round(p.prev)} kg e1RM`), diff: p.prev === null ? undefined : (p.metric === 'reps' ? `+${p.value - p.prev} reps` : `+${Math.round((p.value - p.prev) * 10) / 10} kg`), date: fmtDayShort(log.date) }))} onClose={() => setCelebrate(false)} />}
      <Section className="mt-3">
        <div className="grid grid-cols-2 gap-2.5">
          <Stat icon={<Clock size={16} />} value={fmtElapsed(durationSec)} label="Duration" />
          <Stat icon={<Weight size={16} />} value={`${fmtInt(volumeKg)} kg`} label="Volume" />
          <Stat icon={<Flame size={16} />} value={`${fmtInt(calories)}`} label="est. kcal" />
          <Stat icon={<Dumbbell size={16} />} value={`${done}/${total}`} label="Sets done" />
        </div>
      </Section>

      {prs.length > 0 && (
        <Section title="Personal records" className="mt-1">
          <Card className="divide-y divide-line overflow-hidden">
            {prs.map((pr) => (
              <div key={pr.exerciseId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                  <Trophy size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ink">{pr.name}</div>
                  <div className="truncate text-[12.5px] text-ink2">{pr.detail}</div>
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <div className="px-4 pb-2"><WatchSummaryCard logId={log.id} /></div>

      <Section title="Exercises" className="mt-1">
        <ListGroup>
          {log.exercises.map((e, i) => {
            const vol = exerciseVolume(e.sets)
            const doneN = e.sets.filter((s) => s.done).length
            return (
              <ListRow
                key={`${e.exerciseId}-${i}`}
                title={nameFor(e.exerciseId)}
                subtitle={`${doneN} of ${e.sets.length} sets${e.swappedFrom ? ` · swapped in for ${nameFor(e.swappedFrom)}` : ''}`}
                right={
                  <span className="big-num text-[15px] text-ink2">
                    {vol > 0 ? `${fmtInt(vol)} kg` : '—'}
                  </span>
                }
              />
            )
          })}
        </ListGroup>
      </Section>

      <div className="mt-auto px-4 pt-6">
        <Button full variant="secondary" onClick={() => { void shareWorkoutCard({ log, durationSec, volumeKg, prs: prs.map((p) => ({ name: p.name, detail: p.detail })), names: Object.fromEntries(log.exercises.map((e) => [e.exerciseId, byId.get(e.exerciseId)?.name ?? e.exerciseId])) }) }}>📤 Share workout card</Button>
        <Button full variant="secondary" onClick={() => { void saveWorkoutTemplate(log).then((t) => toast(`Saved “${t.title}” — start it again from More → Saved`)) }}>⭐ Save as template</Button>
        <Button full onClick={() => navigate('/')}>Done</Button>
      </div>
    </div>
  )
}
