// The three ways a coach style can take over, in order of commitment.
//
//  · Just today   — one ProgramOverride (scope 'day').   Plan untouched.
//  · This week    — ProgramOverride rows (scope 'week'). Plan untouched, split kept.
//  · Whole block  — a real Plan; the previous one is DEACTIVATED, never deleted.
//
// This sheet only collects the choice. The screen owns the writes and the
// ConfirmDialog that guards the block.

import { useState } from 'react'
import { CalendarDays, CalendarRange, Layers, Lock, Unlock } from 'lucide-react'
import { Button, Sheet } from '@/components/ui'
import { COACH_BLOCK_WEEKS } from '@/lib/plangen'
import type { Coach } from '@/data/coaches'

export default function ApplySheet({ open, coach, busy, planName, onClose, onDay, onWeek, onBlock }: {
  open: boolean
  coach: Coach | null
  busy?: boolean
  /** name of the plan a block would replace, if any */
  planName?: string | null
  onClose: () => void
  onDay: () => void
  onWeek: () => void
  onBlock: (weeks: number) => void
}) {
  const [weeks, setWeeks] = useState<number>(8)
  if (!coach) return null

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title={`Train like ${coach.name}`} tall>
      <p className="text-[13px] leading-relaxed text-ink2">
        Three levels of commitment. The first two never touch your saved plan — cancel them and
        everything is exactly as it was.
      </p>

      {/* ---- just today ---- */}
      <div className="mt-3 rounded-2xl bg-surface3 p-3.5">
        <div className="flex items-center gap-2">
          <CalendarDays size={17} className="text-brand" />
          <h3 className="text-[15px] font-bold text-ink">Just today</h3>
          <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-emerald-500">
            <Unlock size={13} /> Reversible
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
          Swaps today&rsquo;s session for this style&rsquo;s version of the same muscle group. Same day
          title, same focus, different exercise choices and set/rep prescription. Your plan is
          not modified at all.
        </p>
        <Button full variant="secondary" className="mt-2.5" disabled={busy} onClick={onDay}>
          Use it for today
        </Button>
      </div>

      {/* ---- this week ---- */}
      <div className="mt-2.5 rounded-2xl bg-surface3 p-3.5">
        <div className="flex items-center gap-2">
          <CalendarRange size={17} className="text-brand" />
          <h3 className="text-[15px] font-bold text-ink">This week</h3>
          <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-emerald-500">
            <Unlock size={13} /> Reversible
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
          Every training day this week runs this style, keeping your split exactly as it is.
          Rest days stay rest days. Your plan is still not modified — cancel any time and the
          rest of the week goes back.
        </p>
        <Button full variant="secondary" className="mt-2.5" disabled={busy} onClick={onWeek}>
          Use it for this week
        </Button>
      </div>

      {/* ---- the whole block ---- */}
      <div className="mt-2.5 rounded-2xl border border-line bg-surface3 p-3.5">
        <div className="flex items-center gap-2">
          <Layers size={17} className="text-brand" />
          <h3 className="text-[15px] font-bold text-ink">The whole block</h3>
          <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-amber-500">
            <Lock size={13} /> Changes your plan
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
          Builds a full program in this style — three building weeks then a deload, repeating —
          and makes it your active plan.
          {planName
            ? ` “${planName}” is deactivated, never deleted: bring it back any time from “Back to my own plan”.`
            : ' Anything you had before is kept and can be brought back at any time.'}
        </p>

        <div className="mt-3 flex gap-2">
          {COACH_BLOCK_WEEKS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeeks(w)}
              className={`min-h-[52px] flex-1 rounded-xl px-3 py-2 text-center ${
                weeks === w ? 'bg-brand/15 text-brand ring-1 ring-brand/60' : 'bg-surface2 text-ink2'
              }`}
            >
              <div className="big-num text-[19px] leading-none">{w}</div>
              <div className="mt-0.5 text-[11px] font-semibold">weeks</div>
            </button>
          ))}
        </div>

        <Button full className="mt-3" disabled={busy} onClick={() => onBlock(weeks)}>
          Adopt the {weeks}-week block
        </Button>
      </div>

      <p className="mt-3 pb-2 text-[11.5px] leading-relaxed text-ink3">
        {coach.influence} Your workout history, logs and weigh-ins are never affected by any of
        these three options.
      </p>
    </Sheet>
  )
}
