// Warm-up ramp generator for a given top set, on this location's hardware.

import { useState } from 'react'
import { Flame } from 'lucide-react'
import { Segmented } from '@/components/ui'
import type { EquipmentProfile } from '@/db/types'
import { fmtKg } from '@/lib/fmt'
import { WARMUP_NOTE, warmupTo } from '@/lib/onerm'
import type { AnyLoadMode } from '@/lib/plates'
import { useUI } from '@/lib/store'
import { Stepper, ToolCard } from './shared'

type Mode = 'barbell' | 'curl-bar' | 'smith' | 'stack' | 'dumbbell'
const MODE_LABELS: Record<Mode, string> = {
  barbell: 'Barbell', 'curl-bar': 'Curl bar', smith: 'Smith', stack: 'Cable', dumbbell: 'Dumbbell',
}

export function WarmupTool({ profile }: { profile: EquipmentProfile }) {
  const startRest = useUI((s) => s.startRest)
  const [mode, setMode] = useState<Mode>('barbell')
  const [top, setTop] = useState(80)

  const modes: Mode[] = ['barbell', 'curl-bar', 'smith']
  if (profile.stackStepsKg.length > 0) modes.push('stack')
  if ((profile.dumbbellsKg ?? []).length > 0) modes.push('dumbbell')

  const rungs = warmupTo(mode as AnyLoadMode, top, profile)

  return (
    <ToolCard
      icon={<Flame size={17} />}
      title="Warm-up ramp"
      note="Enter the top set you are building to and it gives you the ladder up to it. Enough to wake the pattern up without spending the session before the first real set."
    >
      <div className="space-y-4">
        <Segmented
          options={modes.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
          value={mode}
          onChange={setMode}
        />
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Top set</div>
          <Stepper value={top} onChange={setTop} step={2.5} min={0} max={400} label="top set" />
        </div>

        {rungs.length === 0 ? (
          <p className="text-[13px] leading-snug text-ink2">
            Nothing to ramp — that load is at or below the lightest thing you can build here. Start with
            the working weight and take the first set easy.
          </p>
        ) : (
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rungs.map((r, i) => (
              <li key={`${r.totalKg}-${i}`} className="flex items-center gap-3 px-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[12px] font-bold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {fmtKg(r.totalKg)} × {r.reps}
                  </div>
                  <div className="truncate text-[12px] text-ink3">{r.tag} · {r.label}</div>
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3 bg-brand/10 px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">
                {rungs.length + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-ink">{fmtKg(top)} — work set</div>
                <div className="text-[12px] text-ink2">Full rest before this one.</div>
              </div>
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={() => startRest(150)}
          className="pressable min-h-[44px] w-full rounded-xl bg-surface3 px-4 text-[13.5px] font-semibold text-ink"
        >
          Start a 2:30 rest timer
        </button>

        <p className="text-[11.5px] leading-snug text-ink3">{WARMUP_NOTE}</p>
      </div>
    </ToolCard>
  )
}
