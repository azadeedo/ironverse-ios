// Progress → Strength: PRs per exercise, weekly volume, sets per muscle.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { db, getProfile } from '@/db'
import { MUSCLE_LABELS } from '@/db/types'
import { Badge, Button, Card, EmptyState, ListGroup, ListRow, Section, Spinner } from '@/components/ui'
import { BarChart } from '@/components/charts'
import { nextLoadUp } from '@/lib/plates'
import { dayjs, fmtClock, fmtInt } from '@/lib/fmt'
import { collectExerciseStats, setsPerMuscle, weekStartOf, weeklyVolume } from './helpers'

export default function StrengthTab() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [])

  const stats = useMemo(() => collectExerciseStats(logs ?? []), [logs])
  const volumeBars = useMemo(() => weeklyVolume(logs ?? []), [logs])

  const muscleCompare = useMemo(() => {
    const ws = weekStartOf(dayjs())
    const curFrom = ws.format('YYYY-MM-DD')
    const curTo = ws.add(7, 'day').format('YYYY-MM-DD')
    const prevFrom = ws.subtract(7, 'day').format('YYYY-MM-DD')
    const cur = setsPerMuscle(logs ?? [], curFrom, curTo)
    const prev = setsPerMuscle(logs ?? [], prevFrom, curFrom)
    const muscles = [...new Set([...cur.keys(), ...prev.keys()])].sort(
      (a, b) => (cur.get(b) ?? 0) - (cur.get(a) ?? 0) || (prev.get(b) ?? 0) - (prev.get(a) ?? 0),
    )
    const max = Math.max(1, ...muscles.map((m) => Math.max(cur.get(m) ?? 0, prev.get(m) ?? 0)))
    return { cur, prev, muscles, max }
  }, [logs])

  if (!logs || profile === undefined) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }

  if (stats.length === 0) {
    return (
      <div className="px-4 pt-6">
        <Card>
          <EmptyState
            icon={<Trophy size={36} strokeWidth={1.5} />}
            title="No lifts logged yet"
            subtitle="Finish a session and your PRs, weekly volume and muscle balance land here automatically."
            action={<Button small onClick={() => navigate('/workout')}>Open your plan</Button>}
          />
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* ---------- PRs ---------- */}
      <Section title="Personal records">
        <ListGroup>
          {stats.map((st) => {
            const next = st.bestSet && profile
              ? nextLoadUp(st.ex.loadMode, st.bestSet.weightKg, profile)
              : null
            const subtitleBits: string[] = [
              `${st.sessions} session${st.sessions === 1 ? '' : 's'}`,
              `last ${dayjs(st.lastDone).format('D MMM')}`,
            ]
            if (st.bestSet) subtitleBits.push(`best ${st.bestSet.weightKg} kg × ${st.bestSet.reps}`)
            if (next !== null) subtitleBits.push(`next up ${next} kg`)
            return (
              <ListRow
                key={st.ex.id}
                title={st.ex.name}
                subtitle={subtitleBits.join(' · ')}
                onClick={() => navigate(`/exercise/${st.ex.id}`)}
                right={
                  st.bestE1rm !== null ? (
                    <div>
                      <div className="big-num text-[17px] leading-tight text-brand">{Math.round(st.bestE1rm)} kg</div>
                      <div className="text-[10.5px] uppercase tracking-wide text-ink3">est. 1RM</div>
                    </div>
                  ) : st.bestReps !== null ? (
                    <div>
                      <div className="big-num text-[17px] leading-tight text-brand">{st.bestReps} reps</div>
                      <div className="text-[10.5px] uppercase tracking-wide text-ink3">best set</div>
                    </div>
                  ) : st.bestTimeSec !== null ? (
                    <div>
                      <div className="big-num text-[17px] leading-tight text-brand">{fmtClock(st.bestTimeSec)}</div>
                      <div className="text-[10.5px] uppercase tracking-wide text-ink3">best time</div>
                    </div>
                  ) : (
                    <Badge tone="gray">logged</Badge>
                  )
                }
              />
            )
          })}
        </ListGroup>
        <p className="mt-2 px-1 text-[11.5px] text-ink3">
          Estimated 1RM uses the Epley formula from your best set. Next-up loads are always buildable with your plates.
        </p>
      </Section>

      {/* ---------- weekly volume ---------- */}
      <Section title="Weekly volume">
        <Card className="p-4">
          {volumeBars.some((b) => b.value > 0) ? (
            <>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[12px] uppercase tracking-wide text-ink3">kg lifted · last 8 weeks</span>
                <span className="big-num text-[15px] text-ink">{fmtInt(volumeBars[volumeBars.length - 1].value)} kg this week</span>
              </div>
              <BarChart bars={volumeBars} height={150} />
            </>
          ) : (
            <div className="py-6 text-center text-[13px] text-ink3">No volume in the last 8 weeks — the next session starts the chart.</div>
          )}
        </Card>
      </Section>

      {/* ---------- sets per muscle ---------- */}
      <Section title="Sets per muscle">
        <Card className="p-4">
          {muscleCompare.muscles.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-ink3">
              No sets logged this week or last week yet.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-4 text-[11.5px] text-ink3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand" /> This week
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-ink3/50" /> Last week
                </span>
              </div>
              <div className="space-y-3">
                {muscleCompare.muscles.map((m) => {
                  const cur = muscleCompare.cur.get(m) ?? 0
                  const prev = muscleCompare.prev.get(m) ?? 0
                  return (
                    <div key={m}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-medium text-ink">{MUSCLE_LABELS[m]}</span>
                        <span className="text-[12px] tabular-nums text-ink3">
                          <span className="font-semibold text-ink">{cur}</span> vs {prev}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
                          <div
                            className="h-full rounded-full bg-brand transition-[width] duration-300"
                            style={{ width: `${(cur / muscleCompare.max) * 100}%` }}
                          />
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
                          <div
                            className="h-full rounded-full bg-ink3/50 transition-[width] duration-300"
                            style={{ width: `${(prev / muscleCompare.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
        <p className="mt-2 px-1 text-[11.5px] text-ink3">
          Counted from the primary muscles of each exercise you completed sets on.
        </p>
      </Section>
    </>
  )
}
