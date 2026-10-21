// "I can't manage today's weight."
//
// Deliberately separate from the swap sheet. Swapping answers "this room does
// not have the kit"; this answers "the kit is here and today is not". Same
// movement pattern, same job in the session, less load or skill demand — so the
// day's structure survives and the set still counts toward the same work.

import { ArrowDownRight, Info, TrendingDown } from 'lucide-react'
import { Badge, Sheet } from '@/components/ui'
import { byId } from '@/data/exercises'
import { loadingDemandOf, regressionsFor } from '@/lib/programming'
import type { EquipmentProfile } from '@/db/types'

export function RegressionSheet({ open, onClose, exerciseId, location, onPick }: {
  open: boolean
  onClose: () => void
  exerciseId: string
  location: EquipmentProfile | null
  onPick: (id: string) => void
}) {
  const ex = byId.get(exerciseId)
  const options = ex ? regressionsFor(ex, location) : []

  return (
    <Sheet open={open} onClose={onClose} title="Not there today?">
      <p className="mb-3 text-[13px] leading-relaxed text-ink2">
        {ex
          ? `Drop ${ex.name} to something that trains the same pattern with less load and skill demand. Sets and reps stay as prescribed — you keep the session, you just stop grinding a weight that is not there today.`
          : 'Pick a lighter way to train the same pattern.'}
      </p>

      {options.length === 0 && (
        <div className="rounded-2xl bg-surface3 p-4 text-[13.5px] leading-relaxed text-ink2">
          Nothing in the library is a genuine step down from this one here. Take
          weight off the bar instead, or shorten the set — that is a better call
          than swapping to something that trains a different job.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {options.map(({ exercise, why }) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => onPick(exercise.id)}
            className="pressable flex min-h-[64px] items-center gap-3 rounded-2xl bg-surface3 p-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
              <ArrowDownRight size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-semibold text-ink">{exercise.name}</span>
                <Badge tone="gray">{loadingDemandOf(exercise)} demand</Badge>
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink2">{why}</span>
            </span>
            <TrendingDown size={16} className="shrink-0 text-ink3" />
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-surface3/60 p-3">
        <Info size={15} className="mt-0.5 shrink-0 text-ink3" />
        <p className="text-[12px] leading-relaxed text-ink3">
          Backing off one session is normal autoregulation, not a failure. If the
          same movement keeps needing this, the app will say so — that usually
          means the prescribed load is wrong rather than that you are.
        </p>
      </div>
    </Sheet>
  )
}
