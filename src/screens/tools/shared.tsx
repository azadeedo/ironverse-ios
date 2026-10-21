// Shared furniture for the Tools screen: the plain-language note that sits
// under every calculator, and a compact numeric stepper with 44px targets.

import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Card } from '@/components/ui'

export function ToolCard({ icon, title, note, children }: {
  icon: ReactNode
  title: string
  /** one short plain-language line: what this is actually for */
  note: string
  children: ReactNode
}) {
  return (
    <section className="px-4 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/12 text-brand">
          {icon}
        </span>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      </div>
      <p className="mb-2.5 text-[12.5px] leading-snug text-ink2">{note}</p>
      <Card className="p-4">{children}</Card>
    </section>
  )
}

export function Stepper({ value, onChange, step = 2.5, min = 0, max = 500, unit = 'kg', label }: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  label?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Decrease ${label ?? 'value'}`}
        onClick={() => onChange(clamp(value - step))}
        className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface3 text-ink"
      >
        <Minus size={20} />
      </button>
      <div className="flex-1 text-center">
        <input
          inputMode="decimal"
          value={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9.]/g, ''))
            if (!Number.isNaN(n)) onChange(clamp(n))
          }}
          className="big-num w-full bg-transparent text-center text-[30px] leading-none text-ink outline-none"
          aria-label={label}
        />
        <div className="mt-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink3">{unit}</div>
      </div>
      <button
        type="button"
        aria-label={`Increase ${label ?? 'value'}`}
        onClick={() => onChange(clamp(value + step))}
        className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface3 text-ink"
      >
        <Plus size={20} />
      </button>
    </div>
  )
}

export function Row({ left, right, sub }: { left: string; right: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[13.5px] text-ink2">{left}</div>
        {sub && <div className="text-[11.5px] text-ink3">{sub}</div>}
      </div>
      <div className="big-num shrink-0 text-[15px] text-ink">{right}</div>
    </div>
  )
}
