// Hydration ring + quick-add. Whole card links to /hydration.

import { useNavigate } from 'react-router-dom'
import { ChevronRight, Droplets } from 'lucide-react'
import { Card } from '@/components/ui'
import { ProgressRing } from '@/components/charts'
import { db } from '@/db'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'

const WATER = '#38bdf8'
const QUICK = [250, 500, 750]

export function WaterCard({ today, totalMl, targetMl }: { today: string; totalMl: number; targetMl: number }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)

  async function add(ml: number) {
    await db.waterLog.add({ id: newId(), date: today, ml, at: nowIso() })
    toast(`+${ml} ml water logged`, 'success')
  }

  const done = targetMl > 0 && totalMl >= targetMl
  return (
    <Card className="flex h-full flex-col p-3.5" onClick={() => navigate('/hydration')}>
      <div className="flex items-center gap-1.5">
        <Droplets size={15} className="text-sky-400" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">Water</span>
        <ChevronRight size={15} className="text-ink3" />
      </div>
      <div className="flex flex-1 items-center justify-center py-2">
        <ProgressRing
          value={totalMl}
          target={targetMl}
          size={104}
          stroke={10}
          accent={WATER}
          label={`${(totalMl / 1000).toFixed(1)}L`}
          sub={done ? 'target hit ✓' : `of ${(targetMl / 1000).toFixed(1)}L`}
        />
      </div>
      <div className="flex gap-1.5">
        {QUICK.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={(e) => { e.stopPropagation(); void add(ml) }}
            className="pressable flex-1 rounded-lg bg-sky-400/12 py-2 text-[11.5px] font-bold tabular-nums text-sky-400"
          >
            +{ml}
          </button>
        ))}
      </div>
    </Card>
  )
}
