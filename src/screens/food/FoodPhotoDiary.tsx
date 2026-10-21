// IV-06.03 — food-photo diary: every meal photo you attached, newest first,
// grouped by day with the day's calories. Tap a photo for the entry and its macros.
// Photos never leave the phone.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { db } from '@/db'
import { Card, PageHeader } from '@/components/ui'
import type { FoodLogEntry } from '@/db/types'

const MEAL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' }

export function groupPhotoDays(entries: Pick<FoodLogEntry, 'id' | 'date' | 'kcal' | 'photo'>[]) {
  const byDay = new Map<string, { date: string; kcal: number; photos: string[] }>()
  for (const e of entries) {
    const d = byDay.get(e.date) ?? { date: e.date, kcal: 0, photos: [] }
    d.kcal += e.kcal || 0
    if (e.photo) d.photos.push(e.id)
    byDay.set(e.date, d)
  }
  return [...byDay.values()].filter((d) => d.photos.length).sort((a, b) => b.date.localeCompare(a.date))
}

export default function FoodPhotoDiary() {
  const navigate = useNavigate()
  const since = dayjs().subtract(90, 'day').format('YYYY-MM-DD')
  const entries = useLiveQuery(() => db.foodLog.where('date').aboveOrEqual(since).toArray(), [since])
  const [open, setOpen] = useState<FoodLogEntry | null>(null)
  const days = useMemo(() => groupPhotoDays(entries ?? []), [entries])
  const byId = useMemo(() => new Map((entries ?? []).map((e) => [e.id, e])), [entries])
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const m = new Map<string, string>()
    for (const e of entries ?? []) if (e.photo) m.set(e.id, URL.createObjectURL(e.photo))
    setUrls(m)
    return () => { for (const u of m.values()) URL.revokeObjectURL(u) }
  }, [entries])
  const total = days.reduce((n, d) => n + d.photos.length, 0)

  return (
    <div className="pb-10">
      <PageHeader title="Food photo diary" back subtitle={total ? `${total} meal photos in the last 90 days` : 'Your meal photos, by day'} />
      {!days.length && entries && (
        <Card className="mx-4 p-4 text-[13px] text-ink3">No meal photos yet. When you log food, tap <b>Photo of meal</b> to attach one — it shows up here so you can look back at what you actually ate.</Card>
      )}
      {days.map((d) => (
        <div key={d.date} className="mx-4 mb-4">
          <div className="mb-1.5 flex items-baseline justify-between"><b className="text-[14px]">{dayjs(d.date).format('ddd D MMM')}</b><span className="text-[12px] text-ink3">{Math.round(d.kcal).toLocaleString('en-AU')} kcal logged</span></div>
          <div className="grid grid-cols-3 gap-1.5">
            {d.photos.map((id) => { const e = byId.get(id)!; return (
              <button key={id} type="button" onClick={() => setOpen(e)} className="pressable relative aspect-square overflow-hidden rounded-xl bg-surface2">
                {urls.get(id) && <img src={urls.get(id)} alt={e.name} className="h-full w-full object-cover" />}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-left text-[10.5px] text-white">{MEAL[e.meal] ?? ''} · {Math.round(e.kcal)} kcal</span>
              </button>) })}
          </div>
        </div>
      ))}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/70" onClick={() => setOpen(null)}>
          <div className="w-full rounded-t-3xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            {urls.get(open.id) && <img src={urls.get(open.id)} alt={open.name} className="mb-3 max-h-[46vh] w-full rounded-2xl object-cover" />}
            <div className="text-[16px] font-bold">{open.name}</div>
            <div className="text-[12.5px] text-ink3">{MEAL[open.meal]} · {dayjs(open.date).format('ddd D MMM')} · {Math.round(open.grams)} g{open.estimate ? ' · estimate' : ''}</div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[12px]">
              {[['kcal', open.kcal], ['protein', open.protein], ['carbs', open.carbs], ['fat', open.fat]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-surface2 py-2"><b className="block text-[15px]">{Math.round(v as number)}{l === 'kcal' ? '' : 'g'}</b>{l}</div>)}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => navigate(`/food?date=${open.date}`)} className="pressable flex-1 rounded-2xl bg-surface2 py-3 text-[13px] font-semibold">Open that day</button>
              <button type="button" onClick={() => setOpen(null)} className="pressable flex-1 rounded-2xl bg-brand py-3 text-[13px] font-semibold text-black">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
