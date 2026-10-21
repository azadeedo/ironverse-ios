// Big-touch-target numeric stepper (44px buttons) used across onboarding + settings.

import { Minus, Plus } from 'lucide-react'

export function Stepper({ value, onChange, min, max, step = 1, format, label, className = '' }: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  /** custom value renderer, e.g. '60 min' or '3.5 L' */
  format?: (v: number) => string
  /** aria context, e.g. 'days per week' */
  label?: string
  className?: string
}) {
  const snap = (v: number) => Math.round(v * 100) / 100
  const dec = () => onChange(Math.max(min, snap(value - step)))
  const inc = () => onChange(Math.min(max, snap(value + step)))
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        aria-label={`Decrease ${label ?? 'value'}`}
        onClick={dec}
        disabled={value <= min}
        className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface3 text-ink disabled:opacity-30"
      >
        <Minus size={19} strokeWidth={2.4} />
      </button>
      <div className="big-num min-w-[76px] flex-1 text-center text-[21px] text-ink">
        {format ? format(value) : value}
      </div>
      <button
        type="button"
        aria-label={`Increase ${label ?? 'value'}`}
        onClick={inc}
        disabled={value >= max}
        className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface3 text-ink disabled:opacity-30"
      >
        <Plus size={19} strokeWidth={2.4} />
      </button>
    </div>
  )
}
