// Waist ÷ bodyweight over time. The scale can't tell a good month from a bad
// one on its own; this can.
import { Ratio } from 'lucide-react'
import { Badge, Card, EmptyState, Section } from '@/components/ui'
import { LineChart } from '@/components/charts'
import type { Measurement, WeighIn } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import { waistToWeight, waistToWeightNote } from './trends'

export default function WaistToWeight({ measurements, weighIns }: {
  measurements: Measurement[]
  weighIns: WeighIn[]
}) {
  const points = waistToWeight(measurements, weighIns)

  if (points.length === 0) {
    return (
      <Section title="Waist to weight">
        <Card>
          <EmptyState
            icon={<Ratio size={32} strokeWidth={1.5} />}
            title="Needs a waist measurement and a weigh-in"
            subtitle="Log both within a week or so of each other and this ratio starts tracking what the scale can't."
          />
        </Card>
      </Section>
    )
  }

  const first = points[0]
  const last = points[points.length - 1]
  const delta = Math.round((last.ratio - first.ratio) * 1000) / 1000
  const tone = points.length < 2 || Math.abs(delta) < 0.002 ? 'gray' : delta < 0 ? 'green' : 'amber'

  return (
    <Section title="Waist to weight">
      <Card className="p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[13px] text-ink2">cm of waist per kg of bodyweight</div>
            <div className="big-num mt-0.5 text-[30px] leading-none text-ink">{last.ratio.toFixed(3)}</div>
            <div className="mt-1 text-[12px] text-ink3">
              {last.waistCm} cm waist at {last.weightKg.toFixed(1)} kg · {dayjs(last.date).format('D MMM YYYY')}
            </div>
          </div>
          {points.length >= 2 && (
            <Badge tone={tone}>
              {delta > 0 ? '+' : ''}{Math.abs(delta) < 0.001 ? '±0' : delta.toFixed(3)}
            </Badge>
          )}
        </div>

        {points.length >= 2 && (
          <div className="mt-3">
            {/* charted ×100 (waist cm per 100 kg) so the axis labels stay readable */}
            <LineChart
              points={points.slice(-60).map((p) => ({ x: dayjs(p.date).format('D MMM'), y: Math.round(p.ratio * 1000) / 10 }))}
              height={140}
            />
          </div>
        )}

        <p className="mt-2 text-[12.5px] text-ink2">{waistToWeightNote(points)}</p>
        <p className="mt-1 text-[11.5px] text-ink3">
          Lower is leaner at the same bodyweight. The chart is the same ratio ×100 (waist cm per
          100 kg) so the axis stays readable. Each waist reading is paired with the nearest
          weigh-in within ten days — readings with no weigh-in near them are left out rather than guessed.
        </p>
      </Card>
    </Section>
  )
}
