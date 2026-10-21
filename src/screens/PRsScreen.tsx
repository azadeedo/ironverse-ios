// PERSONAL RECORDS — every lift he has logged, its current bests, the day each
// was set and how long it has stood. Nothing is invented: a lift with almost no
// history says so instead of dressing one set up as a record.
// Route: /prs

import { useMemo, useState } from 'react'
import { Award, Flame, Trophy } from 'lucide-react'
import { Badge, Card, EmptyState, PageHeader, Segmented, Spinner } from '@/components/ui'
import { MUSCLE_LABELS, type Muscle } from '@/db/types'
import { fmtDayShort } from '@/lib/fmt'
import { exercisePRs, recentPRs } from '@/lib/prs'
import { useWorkoutLogsLive } from './exercises/shared'
import { PRCard } from './prs/PRCard'

type SortMode = 'recent' | 'heaviest' | 'name'

const SORTS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: 'Recently broken' },
  { value: 'heaviest', label: 'Heaviest' },
  { value: 'name', label: 'A–Z' },
]

export default function PRsScreen() {
  const logs = useWorkoutLogsLive()
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [sort, setSort] = useState<SortMode>('recent')

  const rows = useMemo(() => (logs ? exercisePRs(logs) : []), [logs])
  const recent = useMemo(() => (logs ? recentPRs(logs, 30) : []), [logs])

  const muscles = useMemo(() => {
    const set = new Set<Muscle>()
    for (const r of rows) for (const m of r.muscles) set.add(m)
    return [...set].sort((a, b) => MUSCLE_LABELS[a].localeCompare(MUSCLE_LABELS[b]))
  }, [rows])

  const shown = useMemo(() => {
    const list = muscle ? rows.filter((r) => r.muscles.includes(muscle)) : rows
    const sorted = [...list]
    if (sort === 'heaviest') {
      sorted.sort((a, b) => (b.bestE1rm?.value ?? b.heaviest?.value ?? 0) - (a.bestE1rm?.value ?? a.heaviest?.value ?? 0))
    } else if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [rows, muscle, sort])

  if (logs === undefined) {
    return (
      <div>
        <PageHeader title="Records" back="/workout" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="Records" back="/workout" />
        <EmptyState
          icon={<Trophy size={40} strokeWidth={1.5} />}
          title="No records yet"
          subtitle="Finish a session with a few working sets logged and your bests start building here. Warm-up sets never count toward a record."
        />
      </div>
    )
  }

  const solid = rows.filter((r) => !r.thin).length

  return (
    <div className="mx-auto max-w-lg pb-8">
      <PageHeader
        title="Records"
        back="/workout"
        subtitle={`${rows.length} ${rows.length === 1 ? 'lift' : 'lifts'} logged · ${solid} with enough history to call a record`}
      />

      {/* last 30 days */}
      <section className="px-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-brand" />
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-brand">Last 30 days</h2>
          </div>
          {recent.length === 0 ? (
            <p className="mt-2 text-[13px] leading-snug text-ink2">
              Nothing broken in the last month. That is normal in a long block — records come in
              clusters, not every week.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {recent.slice(0, 6).map((p, i) => (
                <li key={`${p.exerciseId}-${p.kind}-${i}`} className="flex items-start gap-2.5">
                  <Award size={15} className="mt-0.5 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{p.name}</div>
                    <div className="text-[12px] leading-snug text-ink2">{p.detail}</div>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-ink3">{fmtDayShort(p.date)}</span>
                </li>
              ))}
            </ul>
          )}
          {recent.length > 6 && (
            <p className="mt-2 text-[12px] text-ink3">+{recent.length - 6} more in the last month.</p>
          )}
        </Card>
      </section>

      {/* sort */}
      <section className="px-4 pt-3">
        <Segmented options={SORTS} value={sort} onChange={setSort} />
      </section>

      {/* muscle filter */}
      {muscles.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <button
            type="button"
            onClick={() => setMuscle(null)}
            className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
              muscle === null ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
            }`}
          >
            All
          </button>
          {muscles.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMuscle(m === muscle ? null : m)}
              className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                muscle === m ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
              }`}
            >
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {/* the ledger */}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Trophy size={36} strokeWidth={1.5} />}
          title="Nothing logged for that muscle"
          subtitle="Train it and the records show up here."
        />
      ) : (
        <div className="space-y-3 px-4 pt-1">
          {shown.map((row) => <PRCard key={row.exerciseId} row={row} />)}
        </div>
      )}

      <p className="mt-5 px-6 text-center text-[11.5px] leading-snug text-ink3">
        Estimated 1RMs use the Epley formula on your logged sets. They are estimates, not tested maxes.
      </p>
      <div className="mt-2 flex justify-center">
        <Badge tone="gray">Built from your own logs, on this device</Badge>
      </div>
    </div>
  )
}
