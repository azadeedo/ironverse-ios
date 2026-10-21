// v9 — "What fits now" (inspired by Bitebro's smarter-pick idea). Uses ONLY
// foods and portions you have actually logged in the last 45 days, plus your
// recipes, and ranks them for what is left today: protein per calorie first,
// never over the calories you have left. One tap logs the same portion again.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Sparkles } from 'lucide-react'
import { db } from '@/db'
import { Card } from '@/components/ui'
import type { FoodLogEntry, MealKey, Profile } from '@/db/types'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'
import { mealForNow } from './helpers'

export interface Pick { key: string; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; times: number; recipeId?: string; foodId?: string }

export function rankPicks(history: FoodLogEntry[], kcalLeft: number, proteinLeft: number, extra: Pick[] = []): Pick[] {
  const by = new Map<string, Pick>()
  for (const e of [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!(e.kcal > 0)) continue
    const k = e.name.trim().toLowerCase()
    const prev = by.get(k)
    by.set(k, { key: k, name: e.name, grams: e.grams, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, times: (prev?.times ?? 0) + 1, foodId: e.foodId, recipeId: e.recipeId })
  }
  for (const x of extra) if (!by.has(x.key)) by.set(x.key, x)
  const score = (p: Pick) => (proteinLeft > 0 ? (p.protein / Math.max(50, p.kcal)) * 100 : 0) + Math.min(p.times, 6) * 0.4 - (p.kcal / Math.max(kcalLeft, 1)) * 0.5
  return [...by.values()].filter((p) => p.kcal <= kcalLeft).sort((a, b) => score(b) - score(a)).slice(0, 5)
}

export function FitsNow({ date, profile, kcalLeft, proteinEaten }: { date: string; profile: Profile; kcalLeft: number; proteinEaten: number }) {
  const { toast } = useUI()
  const since = dayjs(date).subtract(45, 'day').format('YYYY-MM-DD')
  const history = useLiveQuery(() => db.foodLog.where('date').between(since, date, true, false).toArray(), [since, date])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const proteinLeft = Math.max(0, profile.proteinTarget - proteinEaten)
  const picks = useMemo(() => {
    if (!history) return []
    const rx: Pick[] = (recipes ?? []).map((r) => {
      const t = r.ingredients.reduce((a, i) => ({ g: a.g + i.grams, k: a.k + i.kcal, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat }), { g: 0, k: 0, p: 0, c: 0, f: 0 })
      const n = Math.max(1, r.servings)
      return { key: r.name.trim().toLowerCase(), name: `${r.name} (1 serve)`, grams: Math.round(t.g / n), kcal: Math.round(t.k / n), protein: Math.round(t.p / n), carbs: Math.round(t.c / n), fat: Math.round(t.f / n), times: r.useCount ?? 0, recipeId: r.id }
    })
    return rankPicks(history, kcalLeft, proteinLeft, rx)
  }, [history, recipes, kcalLeft, proteinLeft])
  if (kcalLeft < 80 || !history || picks.length === 0) return null
  async function log(p: Pick) {
    const meal: MealKey = mealForNow()
    await db.foodLog.add({ id: newId(), date, meal, name: p.name.replace(/ \(1 serve\)$/, ''), grams: p.grams, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, createdAt: nowIso(), foodId: p.foodId, recipeId: p.recipeId, source: p.recipeId ? 'recipe' : 'manual' })
    toast(`${p.name} logged to ${meal}`)
  }
  return (
    <Card className="p-4 text-[13px]">
      <div className="flex items-center gap-2"><Sparkles size={16} className="text-brand" /><b className="flex-1">What fits now</b><span className="text-[12px] text-ink3">{Math.round(kcalLeft)} kcal · {Math.round(proteinLeft)} g protein left</span></div>
      <div className="mt-2 space-y-1.5">
        {picks.map((p) => (
          <div key={p.key} className="flex items-center gap-2 rounded-xl bg-surface3/60 px-3 py-2">
            <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="text-[11.5px] text-ink3">{Math.round(p.grams)} g · {Math.round(p.kcal)} kcal · {Math.round(p.protein)} g protein{p.times > 1 ? ` · had ${p.times}×` : ''}</div></div>
            <button type="button" onClick={() => void log(p)} className="pressable rounded-lg bg-brand/15 px-2.5 py-1.5 text-[12px] font-semibold text-brand">Log it</button>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[11px] text-ink3">From foods you’ve logged before (same portion) and your recipes — best protein for the calories, never over what’s left.</div>
    </Card>
  )
}
