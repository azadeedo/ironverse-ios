// Browse one coach's exercise picks, muscle group by muscle group.
// Read-only: nothing here changes a plan. It exists so he can see exactly what
// a coach would put in front of him BEFORE he commits to anything.

import { useState } from 'react'
import { Dumbbell, Info } from 'lucide-react'
import { Badge, Sheet } from '@/components/ui'
import {
  MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, coachPicks,
} from '@/data/coaches'
import type { MuscleGroup, ProgramArchetype } from '@/data/coaches'

export default function PicksSheet({ open, coach, onClose }: {
  open: boolean
  coach: ProgramArchetype | null
  onClose: () => void
}) {
  const [group, setGroup] = useState<MuscleGroup>('chest')
  if (!coach) return null

  const picks = coachPicks(coach, group)
  const rx = coach.prescription

  return (
    <Sheet open={open} onClose={onClose} title={`${coach.name} — the picks`} tall>
      <p className="text-[12.5px] leading-relaxed text-ink3">
        {coach.influence}
      </p>

      {/* group selector */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`min-h-[38px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
              g === group ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
            }`}
          >
            {MUSCLE_GROUP_LABELS[g]}
          </button>
        ))}
      </div>

      {/* prescription for this style */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {([
          ['Compounds', rx.compound],
          ['Isolations', rx.isolation],
          ['Core', rx.core],
        ] as const).map(([label, p]) => (
          <div key={label} className="rounded-xl bg-surface3 px-3 py-2">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink3">{label}</div>
            <div className="big-num mt-0.5 text-[16px] text-ink">
              {p.sets} × {p.reps[0]}–{p.reps[1]}
            </div>
            <div className="text-[11.5px] text-ink3">{p.restSec}s rest</div>
          </div>
        ))}
      </div>

      {/* the picks themselves, best first */}
      <h3 className="mt-4 text-[13px] font-semibold text-ink">
        {MUSCLE_GROUP_LABELS[group]} — in the order this style reaches for them
      </h3>

      {picks.length === 0 ? (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface3 px-3 py-3 text-[13px] text-ink2">
          <Info size={16} className="mt-0.5 shrink-0 text-ink3" />
          <span>
            Nothing listed for {MUSCLE_GROUP_LABELS[group].toLowerCase()} in this style — the
            generator falls back to your usual exercise selection for that muscle.
          </span>
        </div>
      ) : (
        <ol className="mt-2 space-y-2 pb-2">
          {picks.map((p, i) => (
            <li key={p.id} className="rounded-xl bg-surface3 p-3">
              <div className="flex items-start gap-2.5">
                <span className="big-num mt-0.5 w-5 shrink-0 text-[15px] text-brand">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold leading-tight text-ink">
                      {p.exercise.name}
                    </span>
                    <Badge tone={p.role === 'compound' ? 'brand' : 'gray'}>
                      {p.role === 'compound' ? 'Compound' : 'Isolation'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-ink2">{p.why}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-ink3">
                    <Dumbbell size={13} />
                    {p.role === 'compound'
                      ? `${rx.compound.sets} × ${rx.compound.reps[0]}–${rx.compound.reps[1]} · ${rx.compound.restSec}s`
                      : `${rx.isolation.sets} × ${rx.isolation.reps[0]}–${rx.isolation.reps[1]} · ${rx.isolation.restSec}s`}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-1 pb-2 text-[11.5px] leading-relaxed text-ink3">
        Every session is still built from the kit you actually own, and every load is snapped to
        plates you can really put on the bar.
      </p>
    </Sheet>
  )
}
