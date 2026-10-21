// Bodyweight-relative strength — his best estimated 1RMs measured against his
// own profile weight. A comparison with himself, not with anyone else.

import { useMemo } from 'react'
import { Scale } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { WorkoutLog } from '@/db/types'
import { fmtDayShort, fmtKg } from '@/lib/fmt'
import { RELATIVE_NOTE, relativeStrength } from '@/lib/onerm'
import { exercisePRs } from '@/lib/prs'
import { ToolCard } from './shared'

export function RelativeTool({ logs, bodyweightKg }: {
  logs: WorkoutLog[]
  bodyweightKg?: number
}) {
  const rows = useMemo(() => {
    if (!bodyweightKg || bodyweightKg <= 0) return []
    const bests = exercisePRs(logs)
      .filter((r) => r.bestE1rm && !r.thin)
      .map((r) => ({
        exerciseId: r.exerciseId,
        name: r.name,
        e1rm: r.bestE1rm!.value,
        date: r.bestE1rm!.date,
      }))
    return relativeStrength(bests, bodyweightKg).slice(0, 10)
  }, [logs, bodyweightKg])

  return (
    <ToolCard
      icon={<Scale size={17} />}
      title="Strength for your bodyweight"
      note="Your best estimated 1RM on each lift, divided by your current bodyweight. Handy while your weight is moving — a lift can stay the same and still get relatively stronger."
    >
      {!bodyweightKg || bodyweightKg <= 0 ? (
        <p className="text-[13px] leading-snug text-ink2">
          No bodyweight on your profile yet. Add one in Settings and this fills in.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] leading-snug text-ink2">
          Not enough logged yet. Once a lift has a few weighted sessions behind it, it shows up here with
          its bodyweight multiple.
        </p>
      ) : (
        <>
          <div className="mb-2 text-[12px] text-ink3">
            Against a bodyweight of {fmtKg(bodyweightKg)}
          </div>
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.exerciseId} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold text-ink">{r.name}</div>
                  <div className="text-[12px] text-ink3">
                    {fmtKg(r.e1rm)} est. 1RM · {fmtDayShort(r.date)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="big-num text-[17px] leading-none text-brand">{r.multiple.toFixed(2)}×</div>
                  <div className="mt-1"><Badge tone="gray">{r.band}</Badge></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-snug text-ink3">{RELATIVE_NOTE}</p>
    </ToolCard>
  )
}
