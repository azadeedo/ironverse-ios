// Progress → weak points.
//
// Muscle groups quietly getting less volume than everything else, and lifts
// that lag their own stablemates. weakPoints() does the maths against his real
// logs and measurements; this only renders it — and always renders the caveat,
// because these are observations with a suggested fix, never a diagnosis.

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dumbbell, Lightbulb, Scale, SearchCheck } from 'lucide-react'
import { db } from '@/db'
import { Badge, Card, Section, Segmented, Spinner } from '@/components/ui'
import { weakPoints, type WeakPoint } from '@/lib/volume'

const WINDOWS: { value: '4' | '8' | '12'; label: string }[] = [
  { value: '4', label: '4 weeks' },
  { value: '8', label: '8 weeks' },
  { value: '12', label: '12 weeks' },
]

function KindIcon({ kind }: { kind: WeakPoint['kind'] }) {
  return kind === 'volume'
    ? <Scale size={16} className="mt-0.5 shrink-0 text-brand" />
    : <Dumbbell size={16} className="mt-0.5 shrink-0 text-brand" />
}

function Observation({ o }: { o: WeakPoint }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <KindIcon kind={o.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14.5px] font-semibold text-ink">{o.title}</span>
            <Badge tone={o.strength === 'clear' ? 'amber' : 'gray'}>
              {o.strength === 'clear' ? 'Clear gap' : 'Worth a look'}
            </Badge>
            <Badge tone="gray">{o.kind === 'volume' ? 'Volume' : 'Lift balance'}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{o.detail}</p>
          <div className="mt-2 rounded-xl bg-surface3 p-2.5">
            <div className="flex items-start gap-2">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-brand" />
              <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink2">{o.fix}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WeakPointsCard() {
  const [win, setWin] = useState<'4' | '8' | '12'>('4')
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])

  const report = useMemo(() => {
    if (!logs) return null
    try {
      return weakPoints(logs, measurements ?? [], { weeks: Number(win) })
    } catch {
      return null
    }
  }, [logs, measurements, win])

  return (
    <Section title="Weak points">
      <div className="mb-2">
        <Segmented options={WINDOWS} value={win} onChange={setWin} />
      </div>

      {logs === undefined || report === null ? (
        <Card className="p-4">
          <div className="flex justify-center py-6"><Spinner /></div>
        </Card>
      ) : report.observations.length === 0 ? (
        <Card className="p-4">
          <div className="flex items-start gap-2.5">
            <SearchCheck size={16} className="mt-0.5 shrink-0 text-ink3" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">
                {report.sessions < 3 ? 'Not enough logged yet' : 'Nothing standing out'}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
                {report.sessions < 3
                  ? report.caveat
                  : `${report.sessions} sessions across the last ${report.weeks} weeks and no muscle is getting materially less than the rest, and no lift lags its stablemates enough to mention. Keep going.`}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {report.observations.map((o, i) => (
              <Observation key={`${o.kind}-${o.title}-${i}`} o={o} />
            ))}
          </div>
          <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink3">
            {report.caveat} Nothing here is a diagnosis — ratios between lifts vary a lot with
            build, limb length and training history.
          </p>
        </Card>
      )}
    </Section>
  )
}

export default WeakPointsCard
