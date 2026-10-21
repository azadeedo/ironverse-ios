// Persistent rest-timer pill that floats above the tab bar anywhere in the app.
import { useEffect, useState } from 'react'
import { TimerReset, X } from 'lucide-react'
import { fmtClock } from '@/lib/fmt'
import { showNotification } from '@/lib/notify'
import { useUI } from '@/lib/store'

export function RestTimerBar() {
  const restEndsAt = useUI((s) => s.restEndsAt)
  const restTotalSec = useUI((s) => s.restTotalSec)
  const clearRest = useUI((s) => s.clearRest)
  const startRest = useUI((s) => s.startRest)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!restEndsAt) return
    const id = window.setInterval(() => {
      tick((n) => n + 1)
      if (Date.now() >= restEndsAt) {
        void showNotification('Rest done', 'Next set — let’s go.', 'rest')
        try { navigator.vibrate?.([120, 60, 120]) } catch { /* no-op */ }
        clearRest()
      }
    }, 250)
    return () => clearInterval(id)
  }, [restEndsAt, clearRest])

  if (!restEndsAt) return null
  const remaining = Math.max(0, (restEndsAt - Date.now()) / 1000)
  const pct = restTotalSec > 0 ? remaining / restTotalSec : 0

  return (
    <div className="fixed inset-x-0 z-40 flex justify-center" style={{ bottom: 'calc(var(--sab) + 86px)' }}>
      <div className="flex items-center gap-3 rounded-full border border-line bg-surface2/95 px-4 py-2 shadow-sheet backdrop-blur-xl">
        <div className="relative h-8 w-8">
          <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface3)" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - pct)} />
          </svg>
        </div>
        <div>
          <div className="big-num text-[18px] leading-none text-ink">{fmtClock(remaining)}</div>
          <div className="text-[10px] uppercase tracking-wide text-ink3">Rest</div>
        </div>
        <button type="button" className="pressable ml-1 rounded-full bg-surface3 px-2.5 py-1 text-[12px] font-semibold text-ink2"
          onClick={() => startRest(Math.round(remaining) + 30)}>
          +30s
        </button>
        <button type="button" className="pressable text-ink3" onClick={clearRest} aria-label="Dismiss">
          <X size={18} />
        </button>
        <TimerReset size={0} className="hidden" />
      </div>
    </div>
  )
}
