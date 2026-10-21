// Exercise page: real records, comparisons, 4/8/12-week charts, prediction range
// and plateau help (IV-02, IV-09, IV-14, IV-27, IV-33A/B).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { db } from '@/db'
import { Badge, Button, Card } from '@/components/ui'
import { LineChart } from '@/components/charts'
import type { Exercise } from '@/db/types'
import { useUI } from '@/lib/store'
import { nowIso } from '@/lib/id'
import { detectPlateau, e1rmMeaningful, exerciseRecords, predictE1rm, seriesWithin, sessionSeries } from '@/lib/strength'

type Metric = 'load' | 'reps' | 'volume' | 'e1rm'
const d = (s: string) => dayjs(s).format('D MMM YY')
const diff = (a: number, b: number, unit: string) => `${a - b >= 0 ? '+' : ''}${Math.round((a - b) * 10) / 10}${unit}`

export function ExerciseProgress({ ex }: { ex: Exercise }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const meta = useLiveQuery(() => db.exerciseMeta.get(ex.id), [ex.id])
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8)
  const meaningful = e1rmMeaningful(ex)
  const [metric, setMetric] = useState<Metric>('load')
  const rec = useMemo(() => (logs ? exerciseRecords(logs, ex.id) : null), [logs, ex.id])
  const series = useMemo(() => (logs ? sessionSeries(logs, ex.id) : []), [logs, ex.id])
  const plateau = useMemo(() => (logs ? detectPlateau(logs, ex.id) : null), [logs, ex.id])
  if (!rec) return null
  if (!rec.sessions) return <Card className="p-4 text-[13px] text-ink3">No sets logged for {ex.name} yet — records and charts appear after your first session.</Card>
  const pts = seriesWithin(series, weeks)
  const val = (p: (typeof series)[number]) => (metric === 'load' ? p.topKg : metric === 'reps' ? p.topReps : metric === 'volume' ? Math.round(p.volume) : Math.round(p.e1rm))
  const pred = meaningful ? predictE1rm(series) : null
  const metrics: [Metric, string][] = [['load', 'Top load'], ['reps', 'Reps at top'], ['volume', 'Volume'], ...(meaningful ? [['e1rm', 'Est. 1RM']] as [Metric, string][] : [])]
  return (
    <div className="space-y-3">
      <Card className="space-y-2 p-4 text-[13px]">
        <div className="flex items-center justify-between"><b className="text-[15px]">Records</b><Badge tone="green">actual lifts</Badge></div>
        {rec.heaviest && <div><span className="text-ink3">Heaviest lifted: </span><b>{rec.heaviest.kg} kg × {rec.heaviest.reps}</b> · {d(rec.heaviest.date)}</div>}
        {rec.bestWorkingSet && <div><span className="text-ink3">Best working set: </span><b>{rec.bestWorkingSet.kg} kg × {rec.bestWorkingSet.reps}</b> · {d(rec.bestWorkingSet.date)}</div>}
        {rec.bestVolume && <div><span className="text-ink3">Most volume in a session: </span><b>{Math.round(rec.bestVolume.kg).toLocaleString()} kg</b> · {d(rec.bestVolume.date)}</div>}
        {rec.repRecords.length > 0 && (
          <div><div className="text-ink3">Rep records (heaviest weight at each rep count):</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{rec.repRecords.slice(0, 10).map((r) => <span key={r.reps} className="rounded-lg bg-surface3 px-2 py-1 text-[12px]"><b>{r.reps}</b> × {r.kg} kg</span>)}</div></div>
        )}
        {meaningful && rec.bestE1rm && <div className="text-ink2"><span className="text-ink3">Estimated 1RM (estimate, not a lift): </span>{Math.round(rec.bestE1rm.value)} kg · {d(rec.bestE1rm.date)}</div>}
        {!meaningful && <div className="text-[11.5px] text-ink3">Estimated 1RM isn’t used here — for high-rep and isolation work, rep records and best working sets tell the real story.</div>}
      </Card>

      {(rec.sinceFirst || rec.sincePrevious) && (
        <Card className="grid grid-cols-2 gap-2 p-3 text-center text-[12px]">
          {rec.sinceFirst && <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Since first session ({d(rec.sinceFirst.firstDate)})</div><b className="text-[15px]">{diff(rec.sinceFirst.latest.topKg, rec.sinceFirst.first.topKg, ' kg')}</b><div className="text-ink3">{rec.sinceFirst.first.topKg}×{rec.sinceFirst.first.topReps} → {rec.sinceFirst.latest.topKg}×{rec.sinceFirst.latest.topReps}</div></div>}
          {rec.sincePrevious && <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Since last time ({d(rec.sincePrevious.prev.date)})</div><b className="text-[15px]">{diff(rec.sincePrevious.latest.topKg, rec.sincePrevious.prev.topKg, ' kg')}</b><div className="text-ink3">{rec.sincePrevious.prev.topKg}×{rec.sincePrevious.prev.topReps} → {rec.sincePrevious.latest.topKg}×{rec.sincePrevious.latest.topReps}</div></div>}
        </Card>
      )}

      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          {([4, 8, 12] as const).map((w) => <button key={w} type="button" onClick={() => setWeeks(w)} className={`pressable rounded-full px-3 py-1 text-[12px] font-semibold ${weeks === w ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{w} wk</button>)}
          <span className="mx-1 text-ink3">·</span>
          {metrics.map(([m, l]) => <button key={m} type="button" onClick={() => setMetric(m)} className={`pressable rounded-full px-3 py-1 text-[12px] font-semibold ${metric === m ? 'bg-brand/20 text-brand' : 'bg-surface3 text-ink2'}`}>{l}</button>)}
        </div>
        {pts.length >= 2 ? <LineChart points={pts.map((p) => ({ x: dayjs(p.date).format('D/M'), y: val(p) }))} height={130} unit={metric === 'reps' ? '' : ' kg'} />
          : <div className="py-4 text-center text-[12.5px] text-ink3">{pts.length} session in the last {weeks} weeks — need 2 to draw a trend.</div>}
        <div className="text-[11px] text-ink3">Compared only with your own {ex.name} sessions — never against a different exercise or machine.</div>
      </Card>

      {pred && (
        <Card className="p-4 text-[13px]">
          <div className="flex items-center gap-2"><b>Strength forecast</b><Badge tone="gray">{pred.confidence} confidence</Badge></div>
          <div className="mt-1">If the current trend holds, your estimated 1RM in 4 weeks may be <b>{pred.in4w[0]}–{pred.in4w[1]} kg</b> (now ≈ {pred.now} kg).</div>
          <div className="mt-1 text-[11.5px] text-ink3">{pred.basis}. A prediction, not a record and not a reason to attempt a max.</div>
        </Card>
      )}

      {plateau && (
        <Card className="space-y-2 border border-amber-400/30 p-4 text-[13px]">
          <b>Possible plateau</b>
          <div className="text-ink2">{plateau.detail}</div>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink2">{plateau.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
          {meta?.holdLoadUntil && meta.holdLoadUntil >= dayjs().format('YYYY-MM-DD')
            ? <div className="text-emerald-300">Plan approved: hold the load and add reps until {dayjs(meta.holdLoadUntil).format('D MMM')}.</div>
            : <div className="flex flex-wrap gap-2">
                <Button small onClick={() => void db.exerciseMeta.put({ ...(meta ?? { exerciseId: ex.id }), exerciseId: ex.id, holdLoadUntil: dayjs().add(14, 'day').format('YYYY-MM-DD'), updatedAt: nowIso() }).then(() => toast('Approved — loads hold for 2 weeks while you add reps'))}>Approve: hold load, add reps (2 weeks)</Button>
                <Button small variant="secondary" onClick={() => navigate('/program')}>Review volume / deload</Button>
              </div>}
          <div className="text-[11px] text-ink3">Nothing changes unless you approve it.</div>
        </Card>
      )}
    </div>
  )
}
