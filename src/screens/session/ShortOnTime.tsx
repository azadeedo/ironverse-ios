// SHORT ON TIME — propose supersets over what's LEFT of the session.
//
// The planner in @/lib/supersets does the thinking: which pairs genuinely
// superset well, why, and how many minutes it honestly saves. This screen's
// only job is to show that reasoning and wait. Nothing is ever applied until
// he ticks pairs and confirms — a silent re-plan mid-session would be the
// worst possible behaviour.

import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Link2, TriangleAlert } from 'lucide-react'
import { Button, Card, EmptyState, Sheet } from '@/components/ui'
import { totalMinutesSaved, type SupersetPair } from '@/lib/supersets'

export function ShortOnTimeSheet({ open, onClose, pairs, minutesNow, remaining, onApply }: {
  open: boolean
  onClose: () => void
  /** proposals over the remaining exercises, best first */
  pairs: SupersetPair[]
  /** estimated minutes the rest of the session takes as it stands */
  minutesNow: number
  /** how many exercises still have work in them */
  remaining: number
  onApply: (chosen: SupersetPair[]) => void
}) {
  const [picked, setPicked] = useState<number[]>([])

  // everything is pre-ticked, because he opened this asking for the time back —
  // but each one can be dropped, and none of it happens without Confirm
  useEffect(() => {
    if (open) setPicked(pairs.map((_, i) => i))
  }, [open, pairs])

  const chosen = useMemo(() => picked.map((i) => pairs[i]).filter(Boolean), [picked, pairs])
  const saved = totalMinutesSaved(chosen)

  return (
    <Sheet open={open} onClose={onClose} title="Short on time?" tall>
      {pairs.length === 0 ? (
        <EmptyState
          icon={<Clock size={30} />}
          title="Nothing worth pairing"
          subtitle={
            remaining <= 1
              ? "There's only one exercise left — just finish it."
              : "None of what's left pairs up without costing you reps. Two heavy lifts stacked together only makes both of them lighter. Trimming a set is the better trade here."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-[13.5px] leading-snug text-ink2">
            {remaining} {remaining === 1 ? 'exercise is' : 'exercises are'} left, about{' '}
            <span className="font-semibold text-ink">{minutesNow} min</span> as written. These pairs are worth
            supersetting — tap one to leave it out. Nothing changes until you confirm.
          </p>

          <div className="flex flex-col gap-2">
            {pairs.map((p, i) => {
              const on = picked.includes(i)
              return (
                <Card key={`${p.aId}-${p.bId}`} className={`p-0 ${on ? 'ring-1 ring-brand/45' : ''}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))}
                    className="pressable w-full px-3.5 py-3 text-left"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${
                          on ? 'border-brand bg-brand text-white' : 'border-line bg-surface2 text-ink3'
                        }`}
                      >
                        {on ? <Check size={14} strokeWidth={3} /> : <Link2 size={12} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold leading-snug text-ink">
                          {p.aName} + {p.bName}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink2">{p.reason}</span>
                        {p.caution && (
                          <span className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-amber-500">
                            <TriangleAlert size={12} className="mt-[2px] shrink-0" />
                            {p.caution}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="big-num block text-[17px] text-brand">-{p.minutesSaved}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink3">min</span>
                      </span>
                    </div>
                  </button>
                </Card>
              )
            })}
          </div>

          <p className="mt-3 text-[12px] leading-snug text-ink3">
            Estimates, not promises — they assume you move straight between the two lifts and take the rest
            that's left over. Your hard-set count doesn't change: same sets, less standing around.
          </p>

          <Button
            full
            className="mt-3"
            disabled={chosen.length === 0}
            onClick={() => onApply(chosen)}
          >
            <Link2 size={17} /> Superset {chosen.length} {chosen.length === 1 ? 'pair' : 'pairs'}
            {saved > 0 ? ` — save about ${saved} min` : ''}
          </Button>
          <Button full variant="secondary" className="mt-2" onClick={onClose}>
            Leave it as it is
          </Button>
        </>
      )}
    </Sheet>
  )
}
