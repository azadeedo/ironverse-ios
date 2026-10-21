// Progress → strength standards.
//
// Estimated 1RM on his main lifts as a multiple of bodyweight, with the usual
// gym bands drawn behind it. strengthStandards() picks his best lift per
// pattern from his own logs.
//
// Tone rule: encouraging, never shaming. The bands are convention, they move
// with height, limb length, age and years trained, and the only number that
// actually matters is whether his own is climbing — STANDARDS_DISCLAIMER says
// exactly that and is always on screen.

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Award, ChevronRight } from 'lucide-react'
import { db, getProfile } from '@/db'
import { Badge, Button, Card, Section, Spinner } from '@/components/ui'
import { STANDARDS_DISCLAIMER, strengthStandards, type StrengthStandard } from '@/lib/volume'

/** Bands drawn as a track, with his own ratio marked on it. */
function BandScale({ s }: { s: StrengthStandard }) {
  const top = s.bands[s.bands.length - 1]?.x ?? 1
  const scale = Math.max(top * 1.1, s.ratio * 1.05, 0.1)
  const pct = (x: number) => Math.min(100, Math.max(0, (x / scale) * 100))

  return (
    <div className="mt-2">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-surface3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${pct(s.ratio)}%` }}
        />
        {s.bands.map((b) => (
          <div
            key={b.x}
            className="absolute inset-y-0 w-px bg-surface2/80"
            style={{ left: `${pct(b.x)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink3">
        <span>{s.bands[0]?.x}×</span>
        <span>{top}×</span>
      </div>
    </div>
  )
}

function Row({ s, onOpen }: { s: StrengthStandard; onOpen: () => void }) {
  return (
    <div className="pressable cursor-pointer px-4 py-3.5" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
            <Badge tone="brand">{s.level}</Badge>
          </div>
          <div className="big-num mt-1 text-[19px] leading-tight text-brand">
            {s.ratio}× bodyweight
            <span className="ml-1.5 text-[13px] font-medium text-ink2">est. {s.e1rm} kg</span>
          </div>
          <BandScale s={s} />
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{s.context}</p>
        </div>
        <ChevronRight size={17} className="mt-1 shrink-0 text-ink3" />
      </div>
    </div>
  )
}

export function StrengthStandardsCard() {
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [])

  const bodyweight = profile?.weightKg ?? 0

  const rows = useMemo(() => {
    if (!logs || bodyweight <= 0) return []
    try {
      return strengthStandards(logs, bodyweight)
    } catch {
      return []
    }
  }, [logs, bodyweight])

  return (
    <Section title="Strength standards">
      {logs === undefined || profile === undefined ? (
        <Card className="p-4">
          <div className="flex justify-center py-6"><Spinner /></div>
        </Card>
      ) : bodyweight <= 0 ? (
        <Card className="p-4">
          <div className="flex items-start gap-2.5">
            <Award size={16} className="mt-0.5 shrink-0 text-ink3" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Add a bodyweight first</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
                These are multiples of your bodyweight, so there is no honest number to show until
                you log a weigh-in.
              </p>
              <Button small className="mt-3 min-h-[44px]" onClick={() => navigate('/progress?tab=body')}>
                Log a weigh-in
              </Button>
            </div>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-4">
          <div className="flex items-start gap-2.5">
            <Award size={16} className="mt-0.5 shrink-0 text-ink3" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">No main lifts logged yet</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
                Log a weighted press, squat, hinge, overhead press or row and your estimated 1RM
                appears here as a multiple of your {Math.round(bodyweight)} kg bodyweight.
              </p>
              <Button small className="mt-3 min-h-[44px]" onClick={() => navigate('/workout')}>
                Open your plan
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {rows.map((s) => (
              <Row key={s.exerciseId} s={s} onOpen={() => navigate(`/exercise/${s.exerciseId}`)} />
            ))}
          </div>
          <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink3">
            {STANDARDS_DISCLAIMER} Against your current bodyweight of {Math.round(bodyweight)} kg.
          </p>
        </Card>
      )}
    </Section>
  )
}

export default StrengthStandardsCard
