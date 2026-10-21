// IV-24 — fast "Log meal" sheet (design from your reference): sticky search,
// meal chips, Recent (same portion again), starred Favourites, All foods with
// one-tap +. Tap a row to change the grams first. Everything the old Add food
// sheet did is one tap away ("More options").
import { useMemo, useState } from 'react'
import { ChevronRight, Plus, ScanBarcode, Star } from 'lucide-react'
import { db } from '@/db'
import { Button, Input, Sheet } from '@/components/ui'
import type { FoodCategory } from '@/data/foods'
import type { MealKey } from '@/db/types'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'
import { MEALS, scaledMacros, type CatalogFood } from './helpers'
import { touchFood, useCatalog, useRecents, type RecentItem } from './useFoodData'

const MEAL_ICON: Record<MealKey, string> = { breakfast: '🥣', lunch: '🥗', dinner: '🍗', snacks: '🍎' }
const CAT_ICON: Record<FoodCategory, string> = { protein: '🍗', carbs: '🍚', 'fruit-veg': '🥦', fats: '🥑', meals: '🍲', snacks: '🍫', drinks: '🥤', 'middle-eastern': '🧆', supplements: '💊' }
const icon = (f?: CatalogFood) => (f?.category ? CAT_ICON[f.category] : '🍽️')

export function LogMealSheet({ open, onClose, date, initialMeal, onMoreOptions, onBarcode }: {
  open: boolean; onClose: () => void; date: string; initialMeal: MealKey; onMoreOptions: (meal: MealKey) => void; onBarcode: (meal: MealKey) => void
}) {
  const { toast } = useUI()
  const [meal, setMeal] = useState<MealKey>(initialMeal)
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<{ food?: CatalogFood; recent?: RecentItem } | null>(null)
  const [grams, setGrams] = useState('100')
  const catalog = useCatalog()
  const recents = useRecents() ?? []
  const byId = useMemo(() => new Map(catalog.map((f) => [f.id, f])), [catalog])
  const favs = catalog.filter((f) => f.favourite).slice(0, 8)
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return catalog.filter((f) => f.name.toLowerCase().includes(s) || (f.brand ?? '').toLowerCase().includes(s))
      .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || a.name.localeCompare(b.name)).slice(0, 40)
  }, [q, catalog])
  const serve = (f: CatalogFood) => f.servingGrams ?? 100

  async function logFood(f: CatalogFood, g: number) {
    const m = scaledMacros(f, g)
    await db.foodLog.add({ id: newId(), date, meal, foodId: f.id, name: f.name, grams: g, ...m, createdAt: nowIso(), source: 'manual', fibre: f.fibre ? Math.round(f.fibre * g) / 100 : undefined })
    await touchFood(f)
    toast(`${f.name} · ${g} g → ${meal}`)
  }
  async function logRecent(r: RecentItem, g?: number) {
    const k = g && r.grams ? g / r.grams : 1
    await db.foodLog.add({ id: newId(), date, meal, foodId: r.foodId, name: r.name, grams: Math.round(r.grams * k), kcal: Math.round(r.kcal * k), protein: Math.round(r.protein * k * 10) / 10, carbs: Math.round(r.carbs * k * 10) / 10, fat: Math.round(r.fat * k * 10) / 10, createdAt: nowIso(), source: 'manual' })
    toast(`${r.name} → ${meal}`)
  }
  function confirmPick() {
    const g = Math.max(1, Math.round(Number(grams.replace(',', '.')) || 0))
    if (pick?.food) void logFood(pick.food, g)
    else if (pick?.recent) void logRecent(pick.recent, g)
    setPick(null)
  }
  const row = (key: string, ic: string, name: string, sub: string, kcal: number, onAdd: () => void, onTap: () => void, macros?: string) => (
    <div key={key} className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface3 text-[20px]">{ic}</div>
      <button type="button" onClick={onTap} className="min-w-0 flex-1 text-left">
        <div className="truncate text-[14px] font-semibold">{name}</div>
        <div className="truncate text-[11.5px] text-ink3">{sub}{macros ? ` · ${macros}` : ''}</div>
      </button>
      <span className="text-[13px] font-semibold text-ink2">{kcal} kcal</span>
      <button type="button" aria-label={`Log ${name}`} onClick={onAdd} className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-brand"><Plus size={16} /></button>
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title="Log meal" tall>
      <div className="sticky top-0 z-10 -mx-1 bg-surface2 px-1 pb-2">
        <div className="flex gap-2">
          <Input placeholder="Search foods" aria-label="Search foods" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" aria-label="Scan barcode" onClick={() => onBarcode(meal)} className="pressable flex w-12 shrink-0 items-center justify-center rounded-xl bg-surface3"><ScanBarcode size={20} /></button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {MEALS.map((m) => (
            <button key={m.key} type="button" onClick={() => setMeal(m.key)} className={`pressable flex flex-col items-center rounded-xl py-2 text-[12px] font-semibold ${meal === m.key ? 'bg-brand/15 text-brand ring-1 ring-brand' : 'bg-surface3 text-ink2'}`}>
              <span className="text-[20px]">{MEAL_ICON[m.key]}</span>{m.label}
            </button>
          ))}
        </div>
      </div>

      {pick ? (
        <div className="space-y-2 pt-2 text-[13px]">
          <b className="text-[15px]">{pick.food?.name ?? pick.recent?.name}</b>
          <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">{[0.5, 1, 1.5, 2].map((x) => { const b = pick.food ? serve(pick.food) : pick.recent?.grams ?? 100; return <button key={x} type="button" onClick={() => setGrams(String(Math.round(b * x)))} className="pressable rounded-full bg-surface3 px-3 py-1 text-[12px]">{x === 1 ? '1 serve' : `${x}×`} · {Math.round(b * x)} g</button> })}</div>
          <div className="text-ink2">{(() => { const g = Number(grams) || 0; const m = pick.food ? scaledMacros(pick.food, g) : pick.recent ? { kcal: Math.round(pick.recent.kcal * g / (pick.recent.grams || 1)), protein: Math.round(pick.recent.protein * g / (pick.recent.grams || 1)) } : { kcal: 0, protein: 0 }; return `${m.kcal} kcal · ${m.protein} g protein` })()}</div>
          <Button full onClick={confirmPick}>Log to {meal}</Button>
          <Button full variant="ghost" onClick={() => setPick(null)}>Back</Button>
        </div>
      ) : q.trim() ? (
        <div className="overflow-hidden rounded-2xl bg-surface3/40">
          {hits.map((f) => { const g = serve(f), m = scaledMacros(f, g); return row(f.id, icon(f), f.name, `${f.servingName ? `1 ${f.servingName}, ` : ''}${g} g`, m.kcal, () => void logFood(f, g), () => { setPick({ food: f }); setGrams(String(g)) }, `P ${m.protein}g C ${m.carbs}g F ${m.fat}g`) })}
          {hits.length === 0 && <div className="p-4 text-center text-[13px] text-ink3">Nothing found. Try More options to add a custom food or quick calories.</div>}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {recents.length > 0 && (<>
            <div className="text-[13px] font-bold">Recent</div>
            <div className="overflow-hidden rounded-2xl bg-surface3/40">
              {recents.slice(0, 6).map((r) => row(r.key, icon(r.foodId ? byId.get(r.foodId) : undefined), r.name, `${Math.round(r.grams)} g — same as last time`, Math.round(r.kcal), () => void logRecent(r), () => { setPick({ recent: r }); setGrams(String(Math.round(r.grams))) }))}
            </div>
          </>)}
          {favs.length > 0 && (<>
            <div className="text-[13px] font-bold">Favourites</div>
            <div className="grid grid-cols-2 gap-2">
              {favs.map((f) => { const g = serve(f), m = scaledMacros(f, g); return (
                <button key={f.id} type="button" onClick={() => void logFood(f, g)} className="pressable rounded-2xl bg-surface3/60 p-3 text-left">
                  <div className="flex items-start justify-between"><span className="text-[20px]">{icon(f)}</span><Star size={13} className="fill-amber-400 text-amber-400" /></div>
                  <div className="mt-1 truncate text-[13px] font-semibold">{f.name}</div><div className="text-[11.5px] text-ink3">{g} g · {m.kcal} kcal</div>
                </button>) })}
            </div>
          </>)}
          {recents.length === 0 && favs.length === 0 && <div className="py-6 text-center text-[13px] text-ink3">Search above — foods you log and star appear here for one-tap logging.</div>}
        </div>
      )}
      <button type="button" onClick={() => onMoreOptions(meal)} className="pressable mt-3 flex w-full items-center justify-between rounded-xl bg-surface3 px-4 py-3 text-[13px] font-semibold">
        More options — recipes, custom food, quick calories, photo <ChevronRight size={16} />
      </button>
    </Sheet>
  )
}
