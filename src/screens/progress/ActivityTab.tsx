// Progress → Activity: consistency, cardio totals, hydration + creatine habits.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Activity, Droplets, Footprints, Zap } from 'lucide-react'
import { db, getProfile } from '@/db'
import type { CardioLog } from '@/db/types'
import { Button, Card, EmptyState, ListGroup, ListRow, Section, Spinner, StatCard } from '@/components/ui'
import { ProgressRing } from '@/components/charts'
import { dayjs, fmtDuration, fmtPace } from '@/lib/fmt'
import { weekStreak } from './helpers'

interface KindAgg {
  sessions: number
  km: number
  sec: number
  rounds: number
  bestPace: number | null
}

function aggregate(entries: CardioLog[]): KindAgg {
  const agg: KindAgg = { sessions: 0, km: 0, sec: 0, rounds: 0, bestPace: null }
  for (const e of entries) {
    agg.sessions += 1
    agg.km += e.distanceKm ?? 0
    agg.sec += e.seconds
    agg.rounds += e.rounds ?? 0
    if (e.avgPaceSecPerKm && (agg.bestPace === null || e.avgPaceSecPerKm < agg.bestPace)) {
      agg.bestPace = e.avgPaceSecPerKm
    }
  }
  return agg
}

export default function ActivityTab() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const cardio = useLiveQuery(() => db.cardioLog.toArray(), [])
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [])
  const water = useLiveQuery(() => {
    const from = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
    return db.waterLog.where('date').aboveOrEqual(from).toArray()
  }, [])
  const creatine = useLiveQuery(() => {
    const from = dayjs().subtract(29, 'day').format('YYYY-MM-DD')
    return db.creatineLog.where('date').aboveOrEqual(from).toArray()
  }, [])

  const workoutStats = useMemo(() => {
    const completed = (logs ?? []).filter((l) => l.finishedAt)
    const weekFrom = (() => {
      const d = dayjs()
      return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD')
    })()
    const monthFrom = dayjs().startOf('month').format('YYYY-MM-DD')
    return {
      streak: weekStreak(completed.map((l) => l.date)),
      thisWeek: completed.filter((l) => l.date >= weekFrom).length,
      thisMonth: completed.filter((l) => l.date >= monthFrom).length,
      total: completed.length,
    }
  }, [logs])

  const cardioAgg = useMemo(() => {
    const list = cardio ?? []
    return {
      run: aggregate(list.filter((c) => c.kind === 'run')),
      walk: aggregate(list.filter((c) => c.kind === 'walk')),
      rope: aggregate(list.filter((c) => c.kind === 'jump-rope')),
      any: list.length > 0,
    }
  }, [cardio])

  const waterStats = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const w of water ?? []) byDate.set(w.date, (byDate.get(w.date) ?? 0) + w.ml)
    const daysLogged = byDate.size
    const totalMl = [...byDate.values()].reduce((a, b) => a + b, 0)
    return { daysLogged, avgMl: daysLogged ? totalMl / daysLogged : 0 }
  }, [water])

  const creatineStats = useMemo(() => {
    const takenDates = new Set((creatine ?? []).filter((c) => c.taken).map((c) => c.date))
    const taken = takenDates.size
    return { taken, pct: Math.round((taken / 30) * 100) }
  }, [creatine])

  if (!logs || !cardio || !water || !creatine || profile === undefined) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }

  const { streak, thisWeek, thisMonth, total } = workoutStats
  const target = profile?.daysPerWeek ?? 4

  return (
    <>
      {/* ---------- consistency ---------- */}
      <Section title="Consistency">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Week streak"
            value={streak ? `${streak} wk` : '—'}
            sub={streak >= 2 ? 'in a row — keep it rolling' : streak === 1 ? 'this week counts' : 'finish a session to start one'}
            tone={streak >= 2 ? 'brand' : 'default'}
          />
          <StatCard
            label="This week"
            value={String(thisWeek)}
            sub={`target ${target}/wk`}
            tone={thisWeek >= target ? 'green' : 'default'}
          />
          <StatCard label="This month" value={String(thisMonth)} sub="workouts finished" />
          <StatCard label="All time" value={String(total)} sub={total === 1 ? 'workout logged' : 'workouts logged'} />
        </div>
      </Section>

      {/* ---------- cardio ---------- */}
      <Section title="Cardio">
        {!cardioAgg.any ? (
          <Card>
            <EmptyState
              icon={<Activity size={34} strokeWidth={1.5} />}
              title="No cardio logged yet"
              subtitle="Runs, walks and jump rope rounds all count toward the deficit."
              action={<Button small onClick={() => navigate('/cardio')}>Log cardio</Button>}
            />
          </Card>
        ) : (
          <ListGroup>
            {cardioAgg.run.sessions > 0 && (
              <ListRow
                leading={
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/12 text-brand">
                    <Zap size={17} />
                  </div>
                }
                title="Running"
                subtitle={`${cardioAgg.run.sessions} run${cardioAgg.run.sessions === 1 ? '' : 's'} · best pace ${fmtPace(cardioAgg.run.bestPace ?? undefined)}`}
                right={
                  <div>
                    <div className="big-num text-[15px] leading-tight text-ink">{cardioAgg.run.km.toFixed(1)} km</div>
                    <div className="text-[11.5px] text-ink3">{fmtDuration(cardioAgg.run.sec)}</div>
                  </div>
                }
              />
            )}
            {cardioAgg.walk.sessions > 0 && (
              <ListRow
                leading={
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500">
                    <Footprints size={17} />
                  </div>
                }
                title="Walking"
                subtitle={`${cardioAgg.walk.sessions} walk${cardioAgg.walk.sessions === 1 ? '' : 's'} · best pace ${fmtPace(cardioAgg.walk.bestPace ?? undefined)}`}
                right={
                  <div>
                    <div className="big-num text-[15px] leading-tight text-ink">{cardioAgg.walk.km.toFixed(1)} km</div>
                    <div className="text-[11.5px] text-ink3">{fmtDuration(cardioAgg.walk.sec)}</div>
                  </div>
                }
              />
            )}
            {cardioAgg.rope.sessions > 0 && (
              <ListRow
                leading={
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/12 text-purple-500">
                    <Activity size={17} />
                  </div>
                }
                title="Jump rope"
                subtitle={`${cardioAgg.rope.sessions} session${cardioAgg.rope.sessions === 1 ? '' : 's'}${cardioAgg.rope.rounds ? ` · ${cardioAgg.rope.rounds} rounds` : ''}`}
                right={<div className="big-num text-[15px] leading-tight text-ink">{fmtDuration(cardioAgg.rope.sec)}</div>}
              />
            )}
          </ListGroup>
        )}
      </Section>

      {/* ---------- habits ---------- */}
      <Section title="Habits">
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center p-4 text-center">
            <ProgressRing
              value={waterStats.avgMl}
              target={profile?.waterTargetMl ?? 3500}
              size={92}
              stroke={9}
              accent="#38bdf8"
              label={`${(waterStats.avgMl / 1000).toFixed(1)} L`}
              sub="avg / day"
            />
            <div className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-ink">
              <Droplets size={13} className="text-sky-400" /> Water
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink2">
              {waterStats.daysLogged ? `${waterStats.daysLogged}/7 days logged` : 'nothing logged this week'}
            </div>
          </Card>
          <Card className="flex flex-col items-center p-4 text-center">
            <ProgressRing
              value={creatineStats.taken}
              target={30}
              size={92}
              stroke={9}
              label={`${creatineStats.pct}%`}
              sub="adherence"
            />
            <div className="mt-2 text-[12.5px] font-semibold text-ink">Creatine</div>
            <div className="mt-0.5 text-[11.5px] text-ink2">{creatineStats.taken} of the last 30 days</div>
          </Card>
        </div>
        <p className="mt-2 px-1 text-[11.5px] text-ink3">
          Daily habits compound — the rings fill from your Today logs.
        </p>
      </Section>
    </>
  )
}
