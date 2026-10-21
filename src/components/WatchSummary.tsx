// IV-04 — record the Apple Watch end-of-workout summary by hand and link it to
// the Ironverse workout. Nothing is read from the screenshot automatically: the
// numbers are what he types. They are labelled as watch estimates.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Watch } from 'lucide-react'
import { db } from '@/db'
import { Badge, Button, Card, Field, Input, Select, Sheet } from '@/components/ui'
import { useUI } from '@/lib/store'
import { nowIso } from '@/lib/id'
import type { WatchSummary as WS, WorkoutLog } from '@/db/types'

const TYPES = ['Traditional Strength Training', 'Functional Strength Training', 'Indoor Walk', 'Outdoor Walk', 'Indoor Cycle', 'Elliptical', 'Stair Stepper', 'HIIT', 'Other']

export function WatchSummaryCard({ logId }: { logId: string }) {
  const log = useLiveQuery(() => db.workoutLogs.get(logId), [logId])
  const [open, setOpen] = useState(false)
  const [shot, setShot] = useState<string | null>(null)
  if (!log) return null
  const w = log.watch
  return (
    <Card className="p-3.5 text-[13px]">
      <div className="flex items-center gap-2"><Watch size={16} className="text-brand" /><b className="flex-1">Apple Watch summary</b>{w && <Badge tone="gray">watch estimate</Badge>}</div>
      {w ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[12px]">
          {[['Type', w.workoutType], ['Time', w.durationMin ? `${w.durationMin} min` : '—'], ['Active', w.activeKcal ? `${w.activeKcal} kcal` : '—'], ['Total', w.totalKcal ? `${w.totalKcal} kcal` : '—'], ['Avg HR', w.avgHr ? `${w.avgHr} bpm` : '—'], ['HR range', w.minHr || w.maxHr ? `${w.minHr ?? '?'}–${w.maxHr ?? '?'}` : '—']].map(([l, v]) => <div key={l} className="rounded-lg bg-surface3 p-1.5"><div className="text-ink3">{l}</div><b className="text-[12.5px]">{v}</b></div>)}
        </div>
      ) : <div className="mt-1 text-ink3">Add the numbers from your watch’s workout summary — they stay linked to this workout.</div>}
      {w?.screenshot && <button type="button" className="mt-1.5 text-[12px] text-brand" onClick={() => setShot(URL.createObjectURL(w.screenshot!))}>View attached screenshot</button>}
      {shot && <img src={shot} alt="Apple Watch summary screenshot" className="mt-2 max-h-80 rounded-xl" />}
      <Button small variant="secondary" className="mt-2" onClick={() => setOpen(true)}>{w ? 'Edit' : 'Add watch summary'}</Button>
      <div className="mt-1 text-[11px] text-ink3">Watch calories and heart rate are the watch’s estimates — your sets, reps and weights stay the measured record.</div>
      {open && <WatchSheet log={log} onClose={() => setOpen(false)} />}
    </Card>
  )
}

function WatchSheet({ log, onClose }: { log: WorkoutLog; onClose: () => void }) {
  const { toast } = useUI()
  const w = log.watch
  const [f, setF] = useState({ type: w?.workoutType ?? TYPES[0], dur: String(w?.durationMin ?? ''), act: String(w?.activeKcal ?? ''), tot: String(w?.totalKcal ?? ''), avg: String(w?.avgHr ?? ''), min: String(w?.minHr ?? ''), max: String(w?.maxHr ?? ''), dist: String(w?.distanceKm ?? '') })
  const [file, setFile] = useState<File | null>(null)
  const n = (v: string, lo: number, hi: number) => { const x = Number(v.replace(',', '.')); return v.trim() && x >= lo && x <= hi ? x : undefined }
  async function save() {
    const summary: WS = {
      workoutType: f.type, durationMin: n(f.dur, 1, 600), activeKcal: n(f.act, 1, 5000), totalKcal: n(f.tot, 1, 8000),
      avgHr: n(f.avg, 30, 230), minHr: n(f.min, 30, 230), maxHr: n(f.max, 30, 230), distanceKm: n(f.dist, 0.01, 200),
      ...(file ? { screenshot: file } : w?.screenshot ? { screenshot: w.screenshot } : {}), enteredAt: nowIso(), source: 'manual',
    }
    if (summary.minHr && summary.maxHr && summary.minHr > summary.maxHr) { toast('Lowest heart rate is above the highest', 'error'); return }
    if (summary.activeKcal && summary.totalKcal && summary.activeKcal > summary.totalKcal) { toast('Active calories can’t be more than total', 'error'); return }
    await db.workoutLogs.update(log.id, { watch: summary })
    toast('Watch summary saved to this workout'); onClose()
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <Sheet open onClose={onClose} title="Apple Watch summary" tall>
      <div className="space-y-2.5">
        <Field label="Workout type"><Select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Duration (min)"><Input inputMode="numeric" value={f.dur} onChange={set('dur')} /></Field>
          <Field label="Distance (km, optional)"><Input inputMode="decimal" value={f.dist} onChange={set('dist')} /></Field>
          <Field label="Active kcal"><Input inputMode="numeric" value={f.act} onChange={set('act')} /></Field>
          <Field label="Total kcal"><Input inputMode="numeric" value={f.tot} onChange={set('tot')} /></Field>
          <Field label="Avg heart rate"><Input inputMode="numeric" value={f.avg} onChange={set('avg')} /></Field>
          <div className="grid grid-cols-2 gap-1"><Field label="Min HR"><Input inputMode="numeric" value={f.min} onChange={set('min')} /></Field><Field label="Max HR"><Input inputMode="numeric" value={f.max} onChange={set('max')} /></Field></div>
        </div>
        <Field label="Screenshot (optional — kept for reference only)"><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <div className="text-[11.5px] text-ink3">The app does not read numbers out of the screenshot — type them from the summary so nothing is guessed.</div>
        <Button full onClick={() => void save()}>Save to this workout</Button>
      </div>
    </Sheet>
  )
}
