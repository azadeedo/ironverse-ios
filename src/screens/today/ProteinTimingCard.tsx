// PROTEIN TIMING — how much protein is left, split across the meals he
// actually has left today. A nudge with a number on it, never a nag.

import { useNavigate } from 'react-router-dom'
import { Beef, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui'
import type { ProteinPacing } from './lib'

export function ProteinTimingCard({ pacing }: { pacing: ProteinPacing }) {
  const navigate = useNavigate()
  const pct = pacing.target > 0 ? Math.min(100, (pacing.eaten / pacing.target) * 100) : 0

  return (
    <Card className="p-4" onClick={() => navigate('/food')}>
      <div className="flex items-center gap-1.5">
        <Beef size={15} className="text-brand" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">
          Protein timing
        </span>
        <ChevronRight size={15} className="text-ink3" />
      </div>

      <div className="mt-2.5 flex items-end gap-1.5">
        <span
          className={`big-num text-[30px] leading-none ${pacing.done ? 'text-emerald-500' : 'text-ink'}`}
        >
          {pacing.done ? pacing.eaten : pacing.remaining}
        </span>
        <span className="pb-0.5 text-[13px] font-semibold text-ink2">
          g {pacing.done ? 'in' : 'to go'}
        </span>
        <span className="flex-1" />
        <span className="pb-0.5 text-[12px] font-medium tabular-nums text-ink3">
          {pacing.eaten} / {pacing.target} g
        </span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface3">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-ink2">{pacing.line}</p>

      {!pacing.done && pacing.slotsLeft.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {pacing.slotsLeft.map((s) => (
            <span
              key={s.key}
              className="rounded-lg bg-surface3 px-2.5 py-1 text-[11.5px] font-semibold capitalize text-ink2"
            >
              {s.label} · {pacing.perSlot}g
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
