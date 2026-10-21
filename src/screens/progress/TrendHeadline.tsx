// The headline number: a 7-day rolling average, with the raw daily dots behind
// it. Water weight swings two kilos; the average doesn't. The raw number is
// still shown underneath — nothing has been taken away.
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge, Card, Section } from '@/components/ui'
import type { WeighIn } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import TrendChart from './TrendChart'
import { rollingSummary, rollingWeight } from './trends'

export default function TrendHeadline({ weighIns, goal }: {
  weighIns: WeighIn[]
  goal?: 'lose-fat' | 'build-muscle' | 'recomp'
}) {
  const rows = rollingWeight(weighIns, 7)
  if (rows.length === 0) return null

  const s = rollingSummary(rows, 14)
  const last = rows[rows.length - 1]
  const delta = s.delta
  const flat = delta !== null && Math.abs(delta) < 0.2
  const wanted = delta === null ? false : goal === 'build-muscle' ? delta > 0 : delta < 0
  const Icon = delta === null || flat ? Minus : delta < 0 ? TrendingDown : TrendingUp
  const tone = delta === null || flat ? 'gray' : wanted ? 'green' : 'amber'

  return (
    <Section title="Weight trend">
      <Card className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="shout text-[11.5px] text-ink3">7-day average</div>
            <div className="big-num mt-0.5 text-[42px] leading-none text-ink">
              {last.avg.toFixed(1)}<span className="ml-1 text-[17px] font-semibold text-ink3">kg</span>
            </div>
            <div className="mt-1 text-[12px] text-ink3">
              raw {last.raw.toFixed(1)} kg on {dayjs(last.date).format('ddd D MMM')} · {last.n} weigh-in{last.n === 1 ? '' : 's'} in the window
            </div>
          </div>
          <Badge tone={tone}>
            <Icon size={12} className="mr-1" />
            {delta === null ? 'building' : flat ? 'steady' : `${Math.abs(delta).toFixed(1)} kg · 14d`}
          </Badge>
        </div>

        <div className="mt-3">
          <TrendChart rows={rows} unit="" />
        </div>
        <p className="mt-1 text-[11.5px] text-ink3">
          The line is the 7-day average, the faint dots are each morning's raw number. Judge the
          line — a single weigh-in can move two kilos on water and salt alone.
        </p>
      </Card>
    </Section>
  )
}
