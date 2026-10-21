// Review → Body & cardio: the week's weight movement (smoothed) and the
// distance/minutes that actually got done.
import { Activity, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge, Card, ListGroup, ListRow, Section, StatCard } from '@/components/ui'
import type { BodyStats, CardioStats } from './helpers'

export default function BodyCard({ body, cardio, goal }: {
  body: BodyStats
  cardio: CardioStats
  goal: 'lose-fat' | 'build-muscle' | 'recomp'
}) {
  const d = body.deltaKg
  const flat = d !== null && Math.abs(d) < 0.2
  const wanted = d === null ? false : goal === 'build-muscle' ? d > 0 : d < 0
  const Icon = d === null || flat ? Minus : d < 0 ? TrendingDown : TrendingUp
  const tone = d === null ? 'default' : flat ? 'default' : wanted ? 'green' : 'amber'

  return (
    <Section title="Body & cardio">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Weight trend"
          value={d === null ? '—' : flat ? 'flat' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} kg`}
          sub={
            body.weighIns === 0 ? 'no weigh-ins this week'
            : d === null ? `${body.weighIns} weigh-in · need two to call it`
            : `${body.weighIns} weigh-in${body.weighIns === 1 ? '' : 's'} · smoothed`
          }
          tone={tone}
        />
        <StatCard
          label="Cardio"
          value={cardio.km > 0 ? `${cardio.km.toFixed(1)} km` : cardio.minutes > 0 ? `${cardio.minutes} min` : '—'}
          sub={cardio.sessions ? `${cardio.sessions} session${cardio.sessions === 1 ? '' : 's'} · ${cardio.minutes} min` : 'nothing logged'}
        />
      </div>

      {body.startTrend !== null && body.endTrend !== null && (
        <Card className="mt-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[13px] text-ink2">Trend across the week</div>
              <div className="big-num mt-0.5 text-[22px] text-ink">
                {body.startTrend.toFixed(1)} <span className="text-[15px] text-ink3">→</span> {body.endTrend.toFixed(1)}
                <span className="ml-1 text-[14px] font-semibold text-ink3">kg</span>
              </div>
            </div>
            <Badge tone={tone === 'green' ? 'green' : tone === 'amber' ? 'amber' : 'gray'}>
              <Icon size={12} className="mr-1" />
              {flat || d === null ? 'steady' : `${Math.abs(d).toFixed(1)} kg`}
            </Badge>
          </div>
          <p className="mt-2 text-[11.5px] text-ink3">
            Smoothed, not raw. A single morning can swing two kilos on water alone — the trend is
            the number worth reading.
          </p>
        </Card>
      )}

      {cardio.byKind.length > 0 && (
        <ListGroup className="mt-3">
          {cardio.byKind.map((k) => (
            <ListRow
              key={k.kind}
              leading={
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/12 text-brand">
                  <Activity size={17} />
                </div>
              }
              title={k.label}
              subtitle={`${k.sessions} session${k.sessions === 1 ? '' : 's'} · ${k.minutes} min`}
              right={<div className="big-num text-[15px] text-ink">{k.km > 0 ? `${k.km.toFixed(1)} km` : `${k.minutes} min`}</div>}
            />
          ))}
        </ListGroup>
      )}
    </Section>
  )
}
