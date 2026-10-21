// Review → Training: sessions vs planned, tonnage, hard sets per muscle
// against the 10-20 evidence range.
import { Dumbbell } from 'lucide-react'
import { Badge, Card, EmptyState, Section, StatCard } from '@/components/ui'
import { HARD_SET_RANGE, type HardSetMarker } from '@/lib/training'
import { dayjs, fmtInt } from '@/lib/fmt'
import type { TrainingStats } from './helpers'

const DOT: Record<HardSetMarker, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}
const BADGE: Record<HardSetMarker, 'green' | 'amber' | 'red'> = {
  green: 'green', amber: 'amber', red: 'red',
}

/** Where a muscle's set count sits on the 0 → 25 scale, with the 10-20 band drawn in. */
function SetBar({ sets, marker }: { sets: number; marker: HardSetMarker }) {
  const scale = 26
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`
  return (
    <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface3">
      <div
        className="absolute inset-y-0 bg-emerald-500/18"
        style={{ left: pct(HARD_SET_RANGE[0]), width: `${((HARD_SET_RANGE[1] - HARD_SET_RANGE[0]) / scale) * 100}%` }}
      />
      <div className={`absolute inset-y-0 left-0 rounded-full ${DOT[marker]} opacity-80`} style={{ width: pct(sets) }} />
    </div>
  )
}

export default function TrainingCard({ t }: { t: TrainingStats }) {
  const planned = t.sessionsPlanned
  const tone = planned > 0 && t.sessionsDone >= planned ? 'green' : t.sessionsDone > 0 ? 'default' : 'default'

  return (
    <Section title="Training">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Sessions"
          value={planned > 0 ? `${t.sessionsDone}/${planned}` : String(t.sessionsDone)}
          sub={planned > 0 ? 'done vs planned' : 'finished this week'}
          tone={tone}
        />
        <StatCard
          label="Tonnage"
          value={t.tonnageKg >= 1000 ? `${(t.tonnageKg / 1000).toFixed(1)} t` : `${fmtInt(t.tonnageKg)} kg`}
          sub={`${t.hard.totalHardSets} hard sets total`}
        />
      </div>

      <Card className="mt-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-ink">Hard sets per muscle</h3>
          <Badge tone="gray">{HARD_SET_RANGE[0]}-{HARD_SET_RANGE[1]} is the range</Badge>
        </div>
        {t.hard.byMuscle.length === 0 ? (
          <EmptyState
            icon={<Dumbbell size={32} strokeWidth={1.5} />}
            title="No hard sets logged"
            subtitle="Completed working sets (warm-ups excluded) show up here, muscle by muscle."
          />
        ) : (
          <>
            <div className="mt-3 space-y-2.5">
              {t.hard.byMuscle.map((m) => (
                <div key={m.muscle}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[m.marker]}`} />
                      <span className="truncate text-[13.5px] font-medium text-ink">{m.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={BADGE[m.marker]}>{m.note}</Badge>
                      <span className="big-num w-[34px] text-right text-[15px] text-ink">{m.sets}</span>
                    </span>
                  </div>
                  <SetBar sets={m.sets} marker={m.marker} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-ink3">
              Green band is 10-20 hard sets a week, which is where most people grow. Under six is
              maintenance at best; over 25 usually costs more in recovery than it buys.
            </p>
          </>
        )}
      </Card>

      {t.sessions.length > 0 && (
        <Card className="mt-3 divide-y divide-line overflow-hidden">
          {t.sessions.map((s, i) => (
            <div key={`${s.date}-${i}`} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{s.title}</div>
                <div className="text-[12px] text-ink3">{dayjs(s.date).format('ddd D MMM')} · {s.sets} hard sets</div>
              </div>
              <div className="big-num shrink-0 text-[14px] text-ink2">{fmtInt(s.volumeKg)} kg</div>
            </div>
          ))}
        </Card>
      )}
    </Section>
  )
}
