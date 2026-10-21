// Warm-up ramp for one exercise, built from the working weight and the plates
// this location actually has. Every rung is a load he can really build.

import { Flame } from 'lucide-react'
import { EmptyState, Sheet } from '@/components/ui'
import { byId } from '@/data/exercises'
import { effectiveLoadMode, isRampable, warmupRamp } from '@/lib/plates'
import type { EquipmentProfile, PlanExercise } from '@/db/types'

export interface WarmupTarget {
  pe: PlanExercise
}

export function WarmupSheet({ target, location, onClose }: {
  /** the plan entry to ramp into (null = closed) */
  target: WarmupTarget | null
  location: EquipmentProfile | null
  onClose: () => void
}) {
  const ex = target ? byId.get(target.pe.exerciseId) : undefined
  const mode = location ? effectiveLoadMode(ex, location) : null
  const working = target?.pe.weightKg
  const rungs = location && mode && working
    ? warmupRamp(mode, working, location)
    : []

  return (
    <Sheet open={!!target} onClose={onClose} title={ex ? `Warm-up · ${ex.name}` : 'Warm-up'}>
      {!isRampable(mode) ? (
        <EmptyState
          icon={<Flame size={30} />}
          title="No ramp needed"
          subtitle="This one is bodyweight or timed — a couple of easy reps and you're in."
        />
      ) : !working ? (
        <EmptyState
          icon={<Flame size={30} />}
          title="Set a working weight first"
          subtitle="Once this exercise has a prescribed load, the ramp builds itself from your plates."
        />
      ) : (
        <>
          <p className="mb-3 text-[13px] leading-relaxed text-ink2">
            Working set{location ? ` at ${location.name}` : ''}:
            {' '}<span className="font-semibold text-ink">{working} kg</span>. Rest 45–60 sec
            between ramp sets — these are rehearsal, not work.
          </p>
          <div className="flex flex-col gap-2">
            {rungs.length === 0 && (
              <div className="rounded-2xl bg-surface3 p-4 text-[13px] text-ink2">
                Your working weight is already the lightest load you can build here — go
                straight in after a few easy reps.
              </div>
            )}
            {rungs.map((r, i) => (
              <div key={`${r.tag}-${r.totalKg}-${i}`} className="flex items-center gap-3 rounded-2xl bg-surface3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/12 text-[11.5px] font-bold text-brand">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold text-ink">{r.label}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink2">{r.tag}</div>
                </div>
                <div className="big-num shrink-0 text-[17px] text-brand">
                  x{r.reps}
                </div>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-3 rounded-2xl bg-brand/10 p-3 ring-1 ring-brand/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[11.5px] font-bold text-white">
                {rungs.length + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-ink">Working sets</div>
                <div className="mt-0.5 text-[12.5px] text-ink2">
                  {target?.pe.sets} sets · {working} kg
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Sheet>
  )
}
