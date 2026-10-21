// Superset / giant-set block. Grouped exercises show as A1 / A2 / A3 chips so
// he can bounce between them without leaving the block — which is how his
// sessions actually run when he's fitting them into an hour.

import { Link2, Link2Off } from 'lucide-react'
import { Card } from '@/components/ui'
import type { GroupInfo } from './helpers'

export function SupersetBar({ info, names, progress, currentIdx, onGo, canGroupNext, nextName, onGroupNext, onUngroup, heavyPair, onTooFar }: {
  info: GroupInfo | null
  /** display name per exercise index in the log */
  names: string[]
  /** 'done/total' per exercise index */
  progress: { done: number; total: number }[]
  currentIdx: number
  onGo: (idx: number) => void
  canGroupNext: boolean
  nextName?: string
  onGroupNext: () => void
  onUngroup: () => void
  /** the machines are too far apart — split and never pair them again */
  onTooFar?: () => void
  /** both lifts are heavy compounds — pairing them costs real performance */
  heavyPair?: boolean
}) {
  if (!info) {
    if (!canGroupNext) return null
    return (
      <div>
        <button
          type="button"
          onClick={onGroupNext}
          className="pressable flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface3/60 px-3 py-2 text-[12.5px] font-semibold text-ink2"
        >
          <Link2 size={14} /> Superset with {nextName}
        </button>
        {heavyPair && (
          <p className="mt-1 px-1 text-center text-[11.5px] leading-snug text-ink3">
            Both are heavy compounds — pairing them saves time but you will lose
            reps on the second one. The planner won't suggest this pair itself.
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className="p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="shout text-[12.5px] text-brand">
          Superset {info.group} · {info.members.length} exercises
        </span>
        <button
          type="button"
          onClick={onUngroup}
          className="pressable flex shrink-0 items-center gap-1 rounded-full bg-surface3 px-2.5 py-1 text-[11.5px] font-semibold text-ink3"
        >
          <Link2Off size={12} /> Ungroup
        </button>
      </div>
      {onTooFar && (
        <button type="button" onClick={onTooFar} className="pressable mb-1.5 w-full rounded-lg bg-surface3/60 px-2 py-1.5 text-[11.5px] font-semibold text-ink2">
          🚶 Machines too far apart — do straight sets &amp; never pair these
        </button>
      )}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {info.members.map((m, i) => {
          const active = m === currentIdx
          const p = progress[m] ?? { done: 0, total: 0 }
          const complete = p.total > 0 && p.done >= p.total
          return (
            <button
              key={m}
              type="button"
              onClick={() => onGo(m)}
              aria-current={active}
              className={`pressable flex min-h-[44px] min-w-0 flex-1 flex-col items-start justify-center rounded-xl px-2.5 py-1.5 text-left transition-colors ${
                active ? 'bg-brand/15 ring-1 ring-brand/45' : 'bg-surface3/60'
              }`}
            >
              <span className={`big-num text-[11px] ${active ? 'text-brand' : complete ? 'text-emerald-500' : 'text-ink3'}`}>
                {info.group}{i + 1} · {p.done}/{p.total}
              </span>
              <span className={`w-full truncate text-[12.5px] font-semibold ${active ? 'text-ink' : 'text-ink2'}`}>
                {names[m]}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink3">
        Tick a set and you're moved straight to the next exercise in the block — the long rest waits until
        you've been round them all.
      </p>
    </Card>
  )
}
