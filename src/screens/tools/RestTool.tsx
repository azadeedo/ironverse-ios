// Rest-interval guidance by rep range, with one tap to start the global timer.

import { Timer } from 'lucide-react'
import { fmtClock } from '@/lib/fmt'
import { REST_BANDS, REST_NOTE } from '@/lib/onerm'
import { useUI } from '@/lib/store'
import { ToolCard } from './shared'

export function RestTool() {
  const startRest = useUI((s) => s.startRest)
  const toast = useUI((s) => s.toast)

  return (
    <ToolCard
      icon={<Timer size={17} />}
      title="Rest intervals"
      note="How long to sit down for, and why. Tap a band to start the floating rest timer at the low end of its range."
    >
      <div className="divide-y divide-line">
        {REST_BANDS.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => {
              startRest(b.range[0])
              toast(`Rest timer started — ${fmtClock(b.range[0])}`)
            }}
            className="pressable flex w-full min-h-[56px] items-start gap-3 py-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold text-ink">{b.label}</div>
              <div className="text-[12px] font-medium text-ink3">{b.reps}</div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink2">{b.why}</p>
            </div>
            <div className="big-num shrink-0 pt-0.5 text-right text-[14px] text-brand">
              {fmtClock(b.range[0])}
              <div className="text-[11px] font-normal text-ink3">to {fmtClock(b.range[1])}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-snug text-ink3">{REST_NOTE}</p>
    </ToolCard>
  )
}
