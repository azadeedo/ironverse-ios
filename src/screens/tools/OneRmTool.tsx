// 1RM estimator (Epley) with a rep-max table and an honest caveat about drift.

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Badge } from '@/components/ui'
import { fmtKg } from '@/lib/fmt'
import { DRIFT_REPS, ONE_RM_CAVEAT, estimate1RM, repMaxTable } from '@/lib/onerm'
import { Stepper, ToolCard } from './shared'

export function OneRmTool() {
  const [kg, setKg] = useState(60)
  const [reps, setReps] = useState(5)
  const e1rm = estimate1RM(kg, reps)
  const table = repMaxTable(e1rm)

  return (
    <ToolCard
      icon={<Calculator size={17} />}
      title="1RM estimator"
      note="Put in a set you actually did and it works out what your one-rep max is likely to be, plus what to load for other rep targets. Useful for picking a starting weight on a lift you have never maxed."
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Weight lifted</div>
          <Stepper value={kg} onChange={setKg} step={2.5} min={0} max={400} label="weight" />
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Reps completed</div>
          <Stepper value={reps} onChange={setReps} step={1} min={1} max={30} unit="reps" label="reps" />
        </div>

        <div className="rounded-xl bg-surface3/60 p-4 text-center">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Estimated 1RM</div>
          <div className="big-num mt-1 text-[34px] leading-none text-brand">{fmtKg(e1rm)}</div>
          <div className="mt-1.5 text-[12px] text-ink2">
            Epley · {kg} kg × {reps} {reps === 1 ? 'rep' : 'reps'}
          </div>
        </div>

        {reps > DRIFT_REPS && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2">
              <Badge tone="amber">Over {DRIFT_REPS} reps</Badge>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-ink2">
              At this many reps the formula stops tracking reality — endurance starts deciding when the
              set ends, not strength. Read this number as a ballpark, nothing more.
            </p>
          </div>
        )}

        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Rep-max table</div>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface3/60 text-[11.5px] uppercase tracking-wide text-ink3">
                  <th className="px-3 py-2 font-semibold">Reps</th>
                  <th className="px-3 py-2 font-semibold">Load</th>
                  <th className="px-3 py-2 text-right font-semibold">% of 1RM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.map((r) => (
                  <tr key={r.reps} className={r.drifting ? 'opacity-60' : ''}>
                    <td className="px-3 py-2.5 text-[14px] font-semibold text-ink">{r.reps}</td>
                    <td className="big-num px-3 py-2.5 text-[14px] text-ink">{fmtKg(r.kg)}</td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-ink2">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11.5px] leading-snug text-ink3">{ONE_RM_CAVEAT}</p>
      </div>
    </ToolCard>
  )
}
