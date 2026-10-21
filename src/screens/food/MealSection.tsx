// One meal group: entries, subtotal, add + copy-yesterday actions.
import { Copy, Plus } from 'lucide-react'
import { Card, ListRow } from '@/components/ui'
import { fmtInt } from '@/lib/fmt'
import type { FoodLogEntry, MealKey } from '@/db/types'
import { seedFoodById } from '@/data/foods'
import { amountLabel, sumEntries } from './helpers'

/** IV-06.10 — where the numbers came from, so estimates are never mistaken for label data */
export function confidenceLabel(e: FoodLogEntry): string {
  if (e.estimate || e.source === 'photo') return '≈ estimate'
  if (e.source === 'quick') return 'quick add'
  if (e.source === 'barcode' || e.barcode) return 'from label'
  if (e.source === 'recipe' || e.recipeId) return 'your recipe'
  if (e.foodId && seedFoodById.has(e.foodId)) return 'food database'
  return e.foodId ? 'saved food' : 'entered by you'
}

export function MealSection({ meal, label, entries, yesterdayCount, onAdd, onCopyYesterday, onEntryTap, onSaveMeal }: {
  meal: MealKey
  label: string
  entries: FoodLogEntry[]
  yesterdayCount: number
  onAdd: (meal: MealKey) => void
  onCopyYesterday: (meal: MealKey) => void
  /** v6: save this meal's items as a one-tap saved meal */
  onSaveMeal?: (meal: MealKey) => void
  onEntryTap: (entry: FoodLogEntry) => void
}) {
  const totals = sumEntries(entries)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
        <h3 className="text-[15px] font-semibold text-ink">{label}</h3>
        {entries.length > 0 && (
          <span className="text-[12.5px] text-ink2">
            <span className="font-semibold text-ink">{fmtInt(totals.kcal)}</span> kcal ·{' '}
            {Math.round(totals.protein)}g P
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="px-4 pb-1 text-[13px] text-ink3">Nothing logged yet</p>
      ) : (
        <div className="divide-y divide-line">
          {entries.map((e) => (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={`${amountLabel(e)} · ${e.protein % 1 === 0 ? e.protein : e.protein.toFixed(1)}g protein · ${confidenceLabel(e)}`}
              right={<span className="text-[14px] font-semibold text-ink">{fmtInt(e.kcal)}</span>}
              chevron={false}
              onClick={() => onEntryTap(e)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={() => onAdd(meal)}
          className="pressable flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-brand"
        >
          <Plus size={16} strokeWidth={2.5} /> Add food
        </button>
        {onSaveMeal && entries.length > 1 && (
          <button
            type="button"
            onClick={() => onSaveMeal(meal)}
            className="pressable flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink2"
          >
            Save as meal
          </button>
        )}
        {yesterdayCount > 0 && (
          <button
            type="button"
            onClick={() => onCopyYesterday(meal)}
            className="pressable ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink2"
          >
            <Copy size={14} /> Copy yesterday ({yesterdayCount})
          </button>
        )}
      </div>
    </Card>
  )
}
