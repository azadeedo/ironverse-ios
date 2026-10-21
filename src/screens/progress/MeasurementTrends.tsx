// Every measured body part charted over time — biceps, chest, waist,
// shoulders, thigh, calf, abs. Additive: the tap-to-expand list above is
// untouched, this is the all-in-one view.
import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { Badge, Card, EmptyState, Section } from '@/components/ui'
import { LineChart } from '@/components/charts'
import type { Measurement } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { measurementSeries, type PartKey } from './trends'

export default function MeasurementTrends({ measurements }: { measurements: Measurement[] }) {
  const series = measurementSeries(measurements)
  const [active, setActive] = useState<PartKey | null>(null)

  if (series.length === 0) {
    return (
      <Section title="Measurement trends">
        <Card>
          <EmptyState
            icon={<Ruler size={32} strokeWidth={1.5} />}
            title="Nothing to chart yet"
            subtitle="Log a tape measurement above and each body part gets its own line here."
          />
        </Card>
      </Section>
    )
  }

  const current = series.find((s) => s.key === active) ?? series[0]

  return (
    <Section title="Measurement trends">
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={`min-h-[38px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
              current.key === s.key ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[13px] text-ink2">{current.label}</div>
            <div className="big-num mt-0.5 text-[30px] leading-none text-ink">
              {current.latest}<span className="ml-1 text-[15px] font-semibold text-ink3">cm</span>
            </div>
          </div>
          {current.points.length >= 2 && (
            <Badge
              tone={
                current.delta === 0 ? 'gray'
                : current.shrinkGood
                  ? (current.delta < 0 ? 'green' : 'amber')
                  : (current.delta > 0 ? 'green' : 'amber')
              }
            >
              {current.delta > 0 ? '+' : ''}{current.delta === 0 ? '±0' : current.delta.toFixed(1)} cm since {dayjs(current.points[0].date).format('MMM YY')}
            </Badge>
          )}
        </div>

        <div className="mt-3">
          {current.points.length >= 2 ? (
            <LineChart
              points={current.points.slice(-60).map((p) => ({ x: dayjs(p.date).format('D MMM'), y: p.value }))}
              height={150}
            />
          ) : (
            <div className="rounded-xl bg-surface3/60 px-3 py-2.5 text-[12.5px] text-ink2">
              Measured once, on {dayjs(current.points[0].date).format('D MMM YYYY')}. One more reading and the line starts.
            </div>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-ink3">
          {current.points.length} reading{current.points.length === 1 ? '' : 's'} · same tape, same tension, same time of day is what makes these comparable.
        </p>
      </Card>
    </Section>
  )
}
