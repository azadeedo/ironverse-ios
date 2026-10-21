// ============================================================
// The editable draft — the step between "the computer guessed" and "it's in
// the log". NOTHING here writes to the food log; the parent does that only
// after onConfirm fires.
//
// Every number is editable. Moving the grams slider rescales kcal and macros
// proportionally, because the honest unit of an estimate is the portion, not
// the calorie count. Per-gram values are the source of truth so dragging the
// slider back and forth never drifts.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkPlus, Check, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Input } from '@/components/ui'
import { db } from '@/db'
import type { EnergyUnit, FoodItem } from '@/db/types'
import { fmtEnergy } from '@/lib/energy'
import { autoDietTags, cautionReason, isHalalHidden, primaryTagLabel } from '@/lib/halal'
import { newId } from '@/lib/id'
import { useUI } from '@/lib/store'
import { round1 } from '../helpers'
import type { DraftItem } from './types'

export const HONEST_LABEL = 'Estimate — check it if it matters.'

interface PerGram {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
}

interface Row {
  id: string
  name: string
  grams: number
  /** per ONE gram — rescaling multiplies these, so it never drifts */
  per: PerGram
  confidence?: number
  barcode?: string
  savedToFoods?: boolean
}

const div = (value: number | undefined, grams: number): number | undefined => {
  if (value === undefined) return undefined
  return grams > 0 ? value / grams : 0
}

function toRow(item: DraftItem): Row {
  const g = item.grams > 0 ? item.grams : 100
  return {
    id: newId(),
    name: item.name,
    grams: Math.round(g),
    per: {
      kcal: item.kcal / g,
      protein: item.protein / g,
      carbs: item.carbs / g,
      fat: item.fat / g,
      fibre: div(item.fibre, g),
      sugar: div(item.sugar, g),
      sodium: div(item.sodium, g),
      satFat: div(item.satFat, g),
    },
    confidence: item.confidence,
    barcode: item.barcode,
  }
}

const scale = (v: number | undefined, g: number, r = 1): number | undefined =>
  v === undefined ? undefined : Math.round(v * g * 10 ** r) / 10 ** r

export function rowToItem(r: Row): DraftItem {
  const g = Math.max(0, Math.round(r.grams))
  return {
    name: r.name.trim() || 'Item',
    grams: g,
    kcal: Math.round(r.per.kcal * g),
    protein: round1(r.per.protein * g),
    carbs: round1(r.per.carbs * g),
    fat: round1(r.per.fat * g),
    fibre: scale(r.per.fibre, g),
    sugar: scale(r.per.sugar, g),
    sodium: r.per.sodium === undefined ? undefined : Math.round(r.per.sodium * g),
    satFat: scale(r.per.satFat, g),
    confidence: r.confidence,
    barcode: r.barcode,
  }
}

/** slider ceiling that always leaves headroom above the current portion */
function sliderMax(grams: number): number {
  const wanted = Math.max(400, grams * 2.5)
  return Math.ceil(wanted / 50) * 50
}

function confidenceTone(c: number): { label: string; tone: 'green' | 'amber' | 'red' } {
  if (c >= 0.75) return { label: `Fairly sure · ${Math.round(c * 100)}%`, tone: 'green' }
  if (c >= 0.45) return { label: `Rough · ${Math.round(c * 100)}%`, tone: 'amber' }
  return { label: `Very rough · ${Math.round(c * 100)}%`, tone: 'red' }
}

const numOrNull = (s: string): number | null => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

// ---------- one macro number field ----------
function MacroField({ label, value, onCommit, suffix }: {
  label: string
  value: number
  onCommit: (v: number) => void
  suffix?: string
}) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])
  return (
    <label className="min-w-0 flex-1">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-ink3">
        {label}
      </div>
      <div className="relative">
        <Input
          inputMode="decimal"
          className="px-2.5 py-2 text-[15px]"
          value={text}
          onFocus={() => { focused.current = true }}
          onChange={(e) => {
            setText(e.target.value)
            const n = numOrNull(e.target.value)
            if (n !== null) onCommit(n)
          }}
          onBlur={() => {
            focused.current = false
            const n = numOrNull(text)
            if (n === null) setText(String(value))
            else { onCommit(n); setText(String(n)) }
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink3">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

// ---------- one draft card ----------
function DraftCard({ row, halal, unit, onChange, onRemove, onSave }: {
  row: Row
  halal: boolean
  unit: EnergyUnit
  onChange: (next: Row) => void
  onRemove: () => void
  onSave: () => void
}) {
  const [showMacros, setShowMacros] = useState(false)
  const item = rowToItem(row)
  const tags = useMemo(() => autoDietTags(row.name), [row.name])
  const flagged = isHalalHidden({ dietTags: tags }, halal)
  const caution = cautionReason({ dietTags: tags })
  const max = sliderMax(row.grams)

  const setGrams = (g: number) => onChange({ ...row, grams: Math.max(0, Math.round(g)) })
  const setPer = (key: keyof PerGram, portionValue: number) => {
    const g = row.grams > 0 ? row.grams : 1
    onChange({ ...row, per: { ...row.per, [key]: portionValue / g } })
  }

  return (
    <div className="rounded-2xl bg-surface2 p-3.5 shadow-card">
      <div className="flex items-start gap-2">
        <Input
          value={row.name}
          placeholder="What is it?"
          aria-label="Item name"
          className="py-2 text-[15px] font-semibold"
          onChange={(e) => onChange({ ...row, name: e.target.value })}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.name || 'item'}`}
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface3 text-ink3"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {row.confidence !== undefined && (
          <Badge tone={confidenceTone(row.confidence).tone}>
            {confidenceTone(row.confidence).label}
          </Badge>
        )}
        {row.barcode && <Badge tone="blue">Scanned label</Badge>}
        {flagged && <Badge tone="red">{primaryTagLabel({ dietTags: tags }) ?? 'Check'} — not halal</Badge>}
        {!flagged && caution && <Badge tone="amber">Check the label</Badge>}
      </div>

      {/* portion */}
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={max}
          step={5}
          value={Math.min(row.grams, max)}
          aria-label="Portion in grams"
          onChange={(e) => setGrams(Number(e.target.value))}
          className="h-11 flex-1 accent-amber-500"
        />
        <div className="w-[92px] shrink-0">
          <div className="relative">
            <Input
              inputMode="numeric"
              aria-label="Grams"
              className="px-2.5 py-2 pr-7 text-right text-[15px] font-semibold"
              value={String(row.grams)}
              onChange={(e) => {
                const n = numOrNull(e.target.value)
                setGrams(n === null ? 0 : n)
              }}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink3">g</span>
          </div>
        </div>
      </div>

      {/* totals for this portion */}
      <div className="mt-3 flex gap-2">
        {[
          { label: 'energy', value: fmtEnergy(item.kcal, unit === 'both' ? 'kcal' : unit), strong: true },
          { label: 'protein', value: `${item.protein}g` },
          { label: 'carbs', value: `${item.carbs}g` },
          { label: 'fat', value: `${item.fat}g` },
        ].map((c) => (
          <div key={c.label} className="min-w-0 flex-1 rounded-xl bg-surface3 px-1.5 py-2 text-center">
            <div className={`truncate text-[14px] font-bold ${c.strong ? 'text-brand' : 'text-ink'}`}>{c.value}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink3">{c.label}</div>
          </div>
        ))}
      </div>

      {showMacros && (
        <div className="mt-3 flex gap-2">
          <MacroField label="cal" value={item.kcal} onCommit={(v) => setPer('kcal', v)} />
          <MacroField label="protein" value={item.protein} onCommit={(v) => setPer('protein', v)} suffix="g" />
          <MacroField label="carbs" value={item.carbs} onCommit={(v) => setPer('carbs', v)} suffix="g" />
          <MacroField label="fat" value={item.fat} onCommit={(v) => setPer('fat', v)} suffix="g" />
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowMacros((v) => !v)}
          className="pressable rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-brand"
        >
          {showMacros ? 'Hide numbers' : 'Edit numbers'}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onSave}
          disabled={row.savedToFoods}
          className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-ink2 disabled:opacity-50"
        >
          {row.savedToFoods ? <Check size={14} /> : <BookmarkPlus size={14} />}
          {row.savedToFoods ? 'Saved' : 'Save as my food'}
        </button>
      </div>
    </div>
  )
}

// ---------- the editor ----------
export interface DraftEditorProps {
  seedItems: DraftItem[]
  /** changing this resets the rows (a new photo / a new scan) */
  seedKey: string
  halal: boolean
  unit: EnergyUnit
  confirmLabel: string
  busy?: boolean
  /** shown above the cards — the provenance line */
  note?: string
  onConfirm: (items: DraftItem[]) => void
  footer?: React.ReactNode
}

export function DraftEditor({
  seedItems, seedKey, halal, unit, confirmLabel, busy, note, onConfirm, footer,
}: DraftEditorProps) {
  const toast = useUI((s) => s.toast)
  const [rows, setRows] = useState<Row[]>(() => seedItems.map(toRow))

  useEffect(() => {
    setRows(seedItems.map(toRow))
    // seedKey identifies the capture; seedItems is a fresh array every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey])

  const items = useMemo(() => rows.map(rowToItem), [rows])
  const total = useMemo(
    () => items.reduce(
      (a, i) => ({
        kcal: a.kcal + i.kcal,
        protein: round1(a.protein + i.protein),
        carbs: round1(a.carbs + i.carbs),
        fat: round1(a.fat + i.fat),
        grams: a.grams + i.grams,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
    ),
    [items],
  )

  const patch = (id: string, next: Row) => setRows((rs) => rs.map((r) => (r.id === id ? next : r)))
  const remove = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))

  const addBlank = () => setRows((rs) => [
    ...rs,
    { id: newId(), name: '', grams: 100, per: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
  ])

  const saveAsFood = async (row: Row) => {
    const name = row.name.trim()
    if (!name) {
      toast('Give it a name first', 'info')
      return
    }
    const per100 = (v: number | undefined) => (v === undefined ? undefined : round1(v * 100))
    const food: FoodItem = {
      id: newId(),
      name,
      kcal: Math.round(row.per.kcal * 100),
      protein: round1(row.per.protein * 100),
      carbs: round1(row.per.carbs * 100),
      fat: round1(row.per.fat * 100),
      custom: true,
      useCount: 0,
      dietTags: autoDietTags(name),
      fibre: per100(row.per.fibre),
      sugar: per100(row.per.sugar),
      sodium: row.per.sodium === undefined ? undefined : Math.round(row.per.sodium * 100),
      satFat: per100(row.per.satFat),
    }
    if (row.grams > 0) {
      food.servingGrams = Math.round(row.grams)
      food.servingName = row.barcode ? 'serve' : 'portion'
    }
    if (row.barcode) food.barcode = row.barcode
    try {
      await db.foods.add(food)
      patch(row.id, { ...row, savedToFoods: true })
      toast(`${name} saved to your foods`)
    } catch {
      toast("Couldn't save that one", 'error')
    }
  }

  const canConfirm = rows.length > 0 && rows.some((r) => r.name.trim().length > 0 && r.grams > 0)

  return (
    <div>
      <div className="rounded-xl bg-surface3 px-3 py-2.5">
        <p className="text-[12.5px] font-semibold text-ink">{HONEST_LABEL}</p>
        {note && <p className="mt-0.5 text-[12px] text-ink3">{note}</p>}
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <DraftCard
            key={r.id}
            row={r}
            halal={halal}
            unit={unit}
            onChange={(next) => patch(r.id, next)}
            onRemove={() => remove(r.id)}
            onSave={() => { void saveAsFood(r) }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addBlank}
        className="pressable mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-3.5 text-[14px] font-semibold text-ink2"
      >
        <Plus size={17} /> Add item it missed
      </button>

      <div className="sticky bottom-0 -mx-4 mt-4 bg-surface2/95 px-4 pb-1 pt-3 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink3">Meal total</div>
            <div className="big-num text-[24px] font-bold leading-tight text-brand">
              {fmtEnergy(total.kcal, unit)}
            </div>
          </div>
          <div className="text-right text-[12.5px] text-ink2">
            {total.protein}g P · {total.carbs}g C · {total.fat}g F
            <div className="text-[11.5px] text-ink3">{Math.round(total.grams)}g on the plate</div>
          </div>
        </div>
        <Button full className="mt-3" disabled={!canConfirm || busy} onClick={() => onConfirm(items)}>
          {busy ? 'Saving…' : confirmLabel}
        </Button>
        {footer}
      </div>
    </div>
  )
}
