// Session autoregulation: how he's feeling, the cut-down offer that beats
// skipping, and the deload proposal. Everything here PROPOSES — he accepts or
// dismisses, nothing is imposed and nothing is deleted without a confirm.

import { BatteryLow, Clock, Flame, Scissors, X, Zap } from 'lucide-react'
import { Button, Card, Sheet } from '@/components/ui'
import type { Readiness, TrimPlan, DeloadSignal } from '@/lib/training'

const OPTIONS: { value: Readiness; label: string; icon: React.ReactNode; tone: string }[] = [
  { value: 'wrecked', label: 'Wrecked', icon: <BatteryLow size={16} />, tone: 'text-red-500' },
  { value: 'ok', label: 'OK', icon: <Zap size={16} />, tone: 'text-ink' },
  { value: 'strong', label: 'Strong', icon: <Flame size={16} />, tone: 'text-emerald-500' },
]

/** "How are you feeling?" — one tap, stamped onto WorkoutLog.readiness. */
export function ReadinessBar({ value, onChange, onShortOnTime, trimmed }: {
  value?: Readiness
  onChange: (r: Readiness) => void
  onShortOnTime: () => void
  trimmed?: boolean
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-ink2">How are you feeling?</span>
        <button
          type="button"
          onClick={onShortOnTime}
          className="pressable flex shrink-0 items-center gap-1 rounded-full bg-surface3 px-2.5 py-1 text-[11.5px] font-semibold text-ink2"
        >
          <Clock size={12} /> Short on time
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`pressable flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors ${
                active ? 'bg-brand text-white' : `bg-surface3/70 ${o.tone}`
              }`}
            >
              {o.icon} {o.label}
            </button>
          )
        })}
      </div>
      {trimmed && (
        <p className="mt-2 text-[11.5px] text-ink3">
          Session trimmed on purpose — it's logged that way, so your stats stay honest.
        </p>
      )}
    </Card>
  )
}

/** Keep the top two, trim the accessories. Something beats nothing. */
export function TrimSheet({ open, onClose, plan, lead, onConfirm }: {
  open: boolean
  onClose: () => void
  plan: TrimPlan | null
  /** why we're offering — "Feeling wrecked" / "Short on time" */
  lead: string
  onConfirm: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Cut it down instead?">
      <p className="mb-3 text-[13.5px] leading-snug text-ink2">
        {lead} — don't skip it. Do the work that matters and drop the rest.
      </p>
      {!plan || plan.drop.length === 0 ? (
        <p className="mb-4 rounded-xl bg-surface3/60 px-3.5 py-3 text-[13px] text-ink2">
          {plan?.text ?? 'Nothing left to trim.'}
        </p>
      ) : (
        <>
          <div className="mb-3 rounded-xl bg-emerald-500/10 px-3.5 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-500">Keep</div>
            <div className="mt-1 text-[13.5px] text-ink">{plan.keepNames.join(' · ')}</div>
          </div>
          <div className="mb-4 rounded-xl bg-surface3/60 px-3.5 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink3">Drop</div>
            <div className="mt-1 text-[13.5px] text-ink2">{plan.dropNames.join(' · ')}</div>
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Button full disabled={!plan || plan.drop.length === 0} onClick={onConfirm}>
          <Scissors size={17} /> Trim the session
        </Button>
        <Button full variant="secondary" onClick={onClose}>
          Keep everything
        </Button>
      </div>
    </Sheet>
  )
}

/** A deload PROPOSAL. Dismissible, never sticky, never a diagnosis. */
export function DeloadBanner({ signal, onDismiss }: { signal: DeloadSignal; onDismiss: () => void }) {
  if (!signal.suggest) return null
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
      <BatteryLow size={17} className="mt-0.5 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold uppercase tracking-wide text-amber-500">Worth an easy week</div>
        <p className="mt-0.5 text-[13px] leading-snug text-ink2">{signal.reason}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss deload suggestion"
        onClick={onDismiss}
        className="pressable -mr-0.5 -mt-0.5 shrink-0 rounded-full p-1 text-ink3"
      >
        <X size={16} />
      </button>
    </div>
  )
}
