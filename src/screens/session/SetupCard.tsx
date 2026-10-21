// "How do I set this up?" — bench angle, seat height, pads, pulley position,
// plus the seat numbers he saves for this exact machine.
import { useState } from 'react'
import { setupFor } from '@/data/machineSetup'
import type { ExerciseMeta } from '@/db/types'

export function SetupCard({ exerciseId, cues, meta, onSaveMeta }: {
  exerciseId: string
  cues?: string[]
  meta?: ExerciseMeta
  onSaveMeta: (patch: Partial<ExerciseMeta>) => void
}) {
  const spec = setupFor(exerciseId)
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState(meta?.setupNote ?? '')
  if (!spec && !cues?.length && !meta?.setupNote) return null
  const rows = spec ? ([['Bench', spec.bench], ['Seat', spec.seat], ['Pads', spec.pads], ['Handles', spec.handles], ['Cable', spec.cable], ['Feet', spec.feet]] as const).filter(([, v]) => v) : []
  return (
    <div className="mt-2 rounded-xl bg-surface3/50 px-3 py-2 text-[12.5px]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="pressable flex w-full items-center justify-between text-left font-semibold text-ink2">
        <span>⚙️ Setup{spec?.bench ? ` · bench ${spec.bench.split(' ')[0]}` : ''}{meta?.setupNote ? ` · yours: ${meta.setupNote}` : ''}</span>
        <span className="text-ink3">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {rows.map(([k, v]) => <div key={k}><b className="text-ink">{k}:</b> <span className="text-ink2">{v}</span></div>)}
          {spec?.why && <div className="text-[11.5px] text-ink3">Why: {spec.why}</div>}
          {!rows.length && cues?.map((c, i) => <div key={i} className="text-ink2">• {c}</div>)}
          {rows.length > 0 && cues?.length ? <details><summary className="cursor-pointer text-[11.5px] text-ink3">More setup cues</summary>{cues.map((c, i) => <div key={i} className="text-ink2">• {c}</div>)}</details> : null}
          <div className="flex gap-1.5 pt-1">
            <input value={mine} onChange={(e) => setMine(e.target.value)} placeholder="Your settings, e.g. seat 4, back pad 2" className="min-w-0 flex-1 rounded-lg border border-line bg-surface2 px-2.5 py-2 text-[12.5px] outline-none focus:border-brand" />
            <button type="button" onClick={() => onSaveMeta({ setupNote: mine.trim() || undefined })} className="pressable rounded-lg bg-brand px-3 text-[12px] font-bold text-black">Save</button>
          </div>
        </div>
      )}
    </div>
  )
}
