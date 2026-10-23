// Settings → Food → Diet (v10.2). Pick one; it shapes the carb/fat guides and
// the food search. Works alongside Halal mode.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card } from '@/components/ui'
import { getSetting, setSetting } from '@/db'
import { useUI } from '@/lib/store'
import { DIETS, DIET_KEY, dietById, type DietId } from '@/lib/diets'

export function DietCard() {
  const { toast } = useUI()
  const current = useLiveQuery(() => getSetting<DietId>(DIET_KEY, 'balanced'), []) ?? 'balanced'
  const [open, setOpen] = useState(false)
  const d = dietById(current)
  return (
    <Card className="p-4">
      <div className="text-[14.5px] font-semibold text-ink">Diet</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">Sets your carb and fat guides and what food search shows. Protein stays your own target.</p>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {DIETS.map((x) => (
          <button key={x.id} type="button" aria-pressed={current === x.id}
            onClick={() => void setSetting(DIET_KEY, x.id).then(() => toast(`${x.label} diet on`))}
            className={`pressable rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold ${current === x.id ? 'bg-brand text-black' : 'bg-surface3 text-ink2'}`}>
            {x.emoji} {x.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-surface3/60 px-3 py-2.5 text-[12.5px]">
        <b>{d.emoji} {d.label}</b> — <span className="text-ink2">{d.blurb}</span>
        <button type="button" className="ml-1 font-semibold text-brand" onClick={() => setOpen((v) => !v)}>{open ? 'Hide tips' : 'Tips'}</button>
        {open && <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink2">{d.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      </div>
    </Card>
  )
}
