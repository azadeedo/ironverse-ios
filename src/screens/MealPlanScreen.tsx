// IV-06.08 — seven-day meal planner. Plans live in setting 'mealplan:v1' and are
// NEVER counted as eaten: "Log this meal" copies them into the food log only after
// you confirm, on the planned date.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Plus, Trash2 } from 'lucide-react'
import { db, getProfile, getSetting, setSetting } from '@/db'
import { Button, Card, ConfirmDialog, Input, PageHeader, Section, Sheet } from '@/components/ui'
import type { DayAdjust, FoodItem, MealKey } from '@/db/types'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { MEALS, targetForDateWith } from './food/helpers'
import { useCatalog } from './food/useFoodData'

export interface PlanItem { id: string; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; foodId?: string }
export interface MealPlanStore { days: Record<string, Partial<Record<MealKey, PlanItem[]>>>; logged: Record<string, string> }
const KEY = 'mealplan:v1'
const EMPTY: MealPlanStore = { days: {}, logged: {} }

export function planTotals(items: PlanItem[]) {
  return items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}
export function itemFromFood(f: FoodItem, grams: number): PlanItem {
  const k = grams / 100
  return { id: newId(), name: f.name, grams, kcal: Math.round(f.kcal * k), protein: Math.round(f.protein * k * 10) / 10, carbs: Math.round(f.carbs * k * 10) / 10, fat: Math.round(f.fat * k * 10) / 10, foodId: f.id }
}

export default function MealPlanScreen() {
  const { toast } = useUI()
  const store = useLiveQuery(() => getSetting<MealPlanStore>(KEY, EMPTY), []) ?? EMPTY
  const profile = useLiveQuery(() => getProfile(), [])
  const adjusts = useLiveQuery(async () => new Map<string, DayAdjust>((await db.dayAdjust.toArray()).map((a) => [a.date, a])), [])
  const [day, setDay] = useState(todayStr())
  const [adding, setAdding] = useState<MealKey | null>(null)
  const [logging, setLogging] = useState<MealKey | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => dayjs(todayStr()).add(i, 'day').format('YYYY-MM-DD'))
  const dp = store.days[day] ?? {}
  const all = MEALS.flatMap((m) => dp[m.key] ?? [])
  const tot = planTotals(all)
  const target = profile ? targetForDateWith(day, profile, adjusts) : 0
  const write = (next: MealPlanStore) => setSetting(KEY, next)
  async function addItem(meal: MealKey, it: PlanItem) {
    const d = { ...dp, [meal]: [...(dp[meal] ?? []), it] }
    await write({ ...store, days: { ...store.days, [day]: d } }); toast(`${it.name} planned`)
  }
  async function removeItem(meal: MealKey, id: string) {
    const d = { ...dp, [meal]: (dp[meal] ?? []).filter((x) => x.id !== id) }
    await write({ ...store, days: { ...store.days, [day]: d } })
  }
  async function copyToNext() {
    const t = dayjs(day).add(1, 'day').format('YYYY-MM-DD')
    const d: Partial<Record<MealKey, PlanItem[]>> = {}
    for (const m of MEALS) d[m.key] = (dp[m.key] ?? []).map((x) => ({ ...x, id: newId() }))
    await write({ ...store, days: { ...store.days, [t]: d } }); toast(`Copied to ${dayjs(t).format('dddd')}`)
  }
  async function logMeal(meal: MealKey) {
    const items = dp[meal] ?? []
    for (const it of items) await db.foodLog.add({ id: newId(), date: day, meal, foodId: it.foodId, name: it.name, grams: it.grams, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, createdAt: nowIso(), source: 'manual' })
    await write({ ...store, logged: { ...store.logged, [`${day}:${meal}`]: nowIso() } })
    toast(`${items.length} item${items.length === 1 ? '' : 's'} logged to ${meal}`)
  }
  return (
    <div className="pb-10">
      <PageHeader title="Meal planner" back subtitle="Plan the week. Nothing counts as eaten until you log it." />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2">
        {days.map((d) => {
          const t = planTotals(MEALS.flatMap((m) => store.days[d]?.[m.key] ?? []))
          return (
            <button key={d} type="button" onClick={() => setDay(d)} className={`pressable min-w-[64px] rounded-xl px-2 py-2 text-center ${d === day ? 'bg-brand text-white' : 'bg-surface2 text-ink2'}`}>
              <div className="text-[11px] font-bold uppercase">{d === todayStr() ? 'Today' : dayjs(d).format('ddd')}</div>
              <div className="text-[12px]">{dayjs(d).format('D/M')}</div>
              <div className="text-[10.5px] opacity-80">{t.kcal ? Math.round(t.kcal) : '—'}</div>
            </button>
          )
        })}
      </div>
      <Section>
        <Card className="p-3.5 text-[13px]">
          <div className="flex items-baseline justify-between"><b>{dayjs(day).format('dddd D MMM')}</b><span className={tot.kcal > target ? 'text-amber-400' : 'text-ink2'}>{Math.round(tot.kcal)} / {target} kcal planned</span></div>
          <div className="mt-1 text-[12px] text-ink3">Protein {Math.round(tot.protein)} / {profile?.proteinTarget ?? '—'} g · carbs {Math.round(tot.carbs)} g · fat {Math.round(tot.fat)} g</div>
          {all.length > 0 && <Button small variant="secondary" className="mt-2" onClick={() => void copyToNext()}>Copy this day to the next day</Button>}
        </Card>
        <div className="mt-3 space-y-2.5">
          {MEALS.map((m) => {
            const items = dp[m.key] ?? []; const t = planTotals(items); const done = store.logged[`${day}:${m.key}`]
            return (
              <Card key={m.key} className="p-3.5 text-[13px]">
                <div className="flex items-center gap-2"><b className="flex-1">{m.label}</b><span className="text-[12px] text-ink3">{Math.round(t.kcal)} kcal · {Math.round(t.protein)} g P</span></div>
                {items.map((it) => (
                  <div key={it.id} className="mt-1.5 flex items-center gap-2 text-[12.5px]"><span className="flex-1 truncate">{it.name} · {it.grams} g</span><span className="text-ink3">{it.kcal}</span>
                    <button type="button" aria-label="Remove" onClick={() => void removeItem(m.key, it.id)} className="text-ink3"><Trash2 size={14} /></button></div>
                ))}
                <div className="mt-2 flex gap-2">
                  <Button small variant="secondary" onClick={() => setAdding(m.key)}><Plus size={14} /> Plan food</Button>
                  {items.length > 0 && (done ? <span className="self-center text-[12px] text-emerald-400">Logged ✓</span> : <Button small onClick={() => setLogging(m.key)}>Log this meal</Button>)}
                </div>
              </Card>
            )
          })}
        </div>
      </Section>
      {adding && <AddPlanned onClose={() => setAdding(null)} onPick={(it) => { void addItem(adding, it); setAdding(null) }} />}
      <ConfirmDialog open={!!logging} title="Log this meal?" message={logging ? `Adds ${(dp[logging] ?? []).length} item(s) to ${logging} on ${dayjs(day).format('ddd D MMM')}. Only do this once you have eaten it.` : ''} confirmLabel="Log it" danger={false}
        onConfirm={() => { if (logging) void logMeal(logging); setLogging(null) }} onClose={() => setLogging(null)} />
    </div>
  )
}

function AddPlanned({ onClose, onPick }: { onClose: () => void; onPick: (it: PlanItem) => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<FoodItem | null>(null)
  const [grams, setGrams] = useState('100')
  const foods = useCatalog()
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase(); const L = foods ?? []
    return (s ? L.filter((f) => f.name.toLowerCase().includes(s)) : L.filter((f) => f.favourite || (f.useCount ?? 0) > 0))
      .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0)).slice(0, 25)
  }, [q, foods])
  return (
    <Sheet open onClose={onClose} title="Plan a food" tall>
      {!sel ? (
        <>
          <Input autoFocus placeholder="Search foods" aria-label="Search foods" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-2 space-y-1">
            {hits.map((f) => (
              <button key={f.id} type="button" onClick={() => { setSel(f); setGrams(String(f.servingGrams ?? 100)) }} className="pressable flex w-full items-center justify-between rounded-xl bg-surface3/60 px-3 py-2 text-left text-[13px]">
                <span className="truncate">{f.name}{f.brand ? ` · ${f.brand}` : ''}</span><span className="text-[11.5px] text-ink3">{f.kcal} kcal/100 g</span>
              </button>
            ))}
            {hits.length === 0 && <div className="py-4 text-center text-[12.5px] text-ink3">{q ? 'No match — add it once through Add food and it appears here.' : 'Search for a food to plan.'}</div>}
          </div>
        </>
      ) : (
        <div className="space-y-2 text-[13px]">
          <b>{sel.name}</b>
          <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
          <div className="text-ink2">{(() => { const it = itemFromFood(sel, Number(grams) || 0); return `${it.kcal} kcal · ${it.protein} g protein · ${it.carbs} g carbs · ${it.fat} g fat` })()}</div>
          <Button full onClick={() => onPick(itemFromFood(sel, Math.max(1, Number(grams) || 0)))}>Add to plan</Button>
          <Button full variant="ghost" onClick={() => setSel(null)}>Back</Button>
        </div>
      )}
    </Sheet>
  )
}
