// Bottom sheet listing hardware-compatible alternatives for one plan exercise.
// Picking one rewrites the SAVED plan (same day slot in every week).

import { MEDIA } from '@/data/media'
import { ArrowLeftRight } from 'lucide-react'
import { alternativesFor, byId } from '@/data/exercises'
import { ExerciseAnim } from '@/anim/rig'
import { isAvailable } from '@/lib/equipment'
import { Badge, EmptyState, Sheet } from '@/components/ui'
import {
  MUSCLE_LABELS, equipmentLabel, type EquipmentProfile, type Exercise, type PlanExercise,
} from '@/db/types'

export function SwapSheet({ target, dayExerciseIds, location, onPick, onClose }: {
  /** the plan entry being swapped (null = closed) */
  target: PlanExercise | null
  /** ids already in the day — hidden from suggestions to avoid duplicates */
  dayExerciseIds: string[]
  /** only offer what this location actually has ("if it's taken" must be doable) */
  location?: EquipmentProfile | null
  onPick: (next: Exercise) => void
  onClose: () => void
}) {
  const current = target ? byId.get(target.exerciseId) : undefined
  const options = target
    ? alternativesFor(target.exerciseId)
        .filter((e) => !dayExerciseIds.includes(e.id))
        .filter((e) => !location || isAvailable(e, location))
    : []
  return (
    <Sheet open={!!target} onClose={onClose} title="Swap exercise">
      {current && (
        <p className="mb-3 text-[13px] text-ink2">
          Replaces <span className="font-semibold text-ink">{current.name}</span> in this day slot
          for every week of your plan. Your training history stays untouched.
          {location && ` Only what's available at ${location.name} is listed.`}
        </p>
      )}
      {options.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={30} />}
          title="No alternatives available"
          subtitle={location
            ? `Everything ${location.name} has that trains this is already in the workout.`
            : 'Every compatible swap for your equipment is already in this workout.'}
        />
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          {options.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => onPick(ex)}
              className="pressable flex items-center gap-3 rounded-2xl bg-surface3 p-3 text-left"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface2">
                {MEDIA[ex.id]
                  ? <img src={MEDIA[ex.id].imgSmall ?? MEDIA[ex.id].img} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
                  : <ExerciseAnim def={ex.anim} size={64} playing />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-ink">{ex.name}</div>
                <div className="mt-0.5 truncate text-[12.5px] text-ink2">
                  {ex.primary.map((m) => MUSCLE_LABELS[m]).join(' · ')}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ex.equipment.slice(0, 2).map((eq) => (
                    <Badge key={eq} tone="gray">{equipmentLabel(eq)}</Badge>
                  ))}
                </div>
              </div>
              <Badge tone="brand" className="shrink-0">Swap in</Badge>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
