// One lift's current bests, plus the drill-down sheet with its rep and load
// ladders. Everything shown here came off a real logged set.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell, Layers, Repeat, TrendingUp } from 'lucide-react'
import { Badge, Button, Card, Sheet } from '@/components/ui'
import { fmtDayShort, fmtInt, fmtKg } from '@/lib/fmt'
import type { ExercisePRs, PRRecord } from '@/lib/prs'

export function standingLabel(days?: number): string {
  if (days === undefined) return ''
  if (days <= 0) return 'set today'
  if (days === 1) return 'stood 1 day'
  if (days < 14) return `stood ${days} days`
  if (days < 60) return `stood ${Math.round(days / 7)} weeks`
  return `stood ${Math.round(days / 30)} months`
}

function BestCell({ icon, label, record, unit }: {
  icon: React.ReactNode
  label: string
  record?: PRRecord
  unit: string
}) {
  return (
    <div className="rounded-xl bg-surface3/60 p-2.5">
      <div className="flex items-center gap-1.5 text-ink3">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="big-num mt-1 text-[19px] leading-none text-ink">
        {record ? `${unit === 'kg' ? fmtInt(record.value) : record.value}${unit === 'kg' ? ' kg' : ''}` : '—'}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-ink3">
        {record ? fmtDayShort(record.date) : 'nothing logged'}
      </div>
    </div>
  )
}

export function PRCard({ row }: { row: ExercisePRs }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card className="p-4">
        <button type="button" onClick={() => setOpen(true)} className="pressable flex w-full items-start gap-2 text-left">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold text-ink">{row.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {row.lastPRDate && !row.thin && (
                <Badge tone={(row.standingDays ?? 0) <= 14 ? 'brand' : 'gray'}>
                  {standingLabel(row.standingDays)}
                </Badge>
              )}
              {row.thin && <Badge tone="gray">Not enough data yet</Badge>}
              <span className="text-[12px] text-ink3">
                {row.sessions} {row.sessions === 1 ? 'session' : 'sessions'} · {row.hardSets} hard sets
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-ink3" />
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <BestCell
            icon={<Dumbbell size={13} />} label="Heaviest" record={row.heaviest} unit="kg"
          />
          <BestCell
            icon={<TrendingUp size={13} />} label="Est. 1RM" record={row.bestE1rm} unit="kg"
          />
          <BestCell
            icon={<Layers size={13} />} label="Session volume" record={row.bestVolume} unit="kg"
          />
          <BestCell
            icon={<Repeat size={13} />} label="Most reps" record={row.bestReps} unit=""
          />
        </div>
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title={row.name} tall>
        {row.thin && (
          <p className="mb-3 rounded-xl border border-line bg-surface3/50 p-3 text-[13px] leading-snug text-ink2">
            Only {row.sessions} {row.sessions === 1 ? 'session' : 'sessions'} and {row.hardSets} working{' '}
            {row.hardSets === 1 ? 'set' : 'sets'} logged on this one. The numbers below are what you did,
            not records worth defending yet.
          </p>
        )}

        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink3">Current bests</h3>
        <Card className="divide-y divide-line overflow-hidden">
          {([
            ['Heaviest weight', row.heaviest, 'kg'],
            ['Best estimated 1RM', row.bestE1rm, 'kg'],
            ['Best session volume', row.bestVolume, 'kg'],
            ['Most reps in a set', row.bestReps, ''],
          ] as [string, PRRecord | undefined, string][]).map(([label, rec, unit]) => (
            <div key={label} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium text-ink">{label}</span>
                <span className="big-num shrink-0 text-[15px] text-brand">
                  {rec ? (unit === 'kg' ? fmtKg(rec.value) : `${rec.value} reps`) : '—'}
                </span>
              </div>
              <div className="mt-0.5 text-[12px] text-ink2">
                {rec ? `${rec.detail} · ${fmtDayShort(rec.date)}` : 'Nothing logged for this yet.'}
              </div>
            </div>
          ))}
        </Card>

        {row.repBests.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-ink3">
              Heaviest at each rep mark
            </h3>
            <Card className="divide-y divide-line overflow-hidden">
              {row.repBests.map((r) => (
                <div key={r.reps} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[14px] font-medium text-ink">{r.reps} reps</span>
                  <div className="text-right">
                    <div className="big-num text-[14px] text-ink">{fmtKg(r.weightKg)}</div>
                    <div className="text-[11px] text-ink3">{fmtDayShort(r.date)}</div>
                  </div>
                </div>
              ))}
            </Card>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink3">
              The heaviest load you have taken to at least that many reps.
            </p>
          </>
        )}

        {row.loadBests.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-ink3">
              Best reps at each load
            </h3>
            <Card className="divide-y divide-line overflow-hidden">
              {row.loadBests.slice(0, 10).map((l) => (
                <div key={l.weightKg} className="flex items-center justify-between px-4 py-2.5">
                  <span className="big-num text-[14px] text-ink">{fmtKg(l.weightKg)}</span>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-ink">{l.reps} reps</div>
                    <div className="text-[11px] text-ink3">{fmtDayShort(l.date)}</div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" full onClick={() => setOpen(false)}>Close</Button>
          <Button full onClick={() => navigate(`/exercise/${row.exerciseId}`)}>Open exercise</Button>
        </div>
      </Sheet>
    </>
  )
}
