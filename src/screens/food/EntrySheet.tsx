// Edit / delete an existing food log entry.
import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, Field, Input, Segmented, Sheet } from '@/components/ui'
import { db } from '@/db'
import type { FoodLogEntry, MealKey } from '@/db/types'
import { useUI } from '@/lib/store'
import { deleteWithUndo, mutateWithUndo, toastWithUndo } from '@/lib/undo'
import { newId, nowIso } from '@/lib/id'
import dayjs from 'dayjs'
import { fmtInt } from '@/lib/fmt'
import { MEALS, parseNum, round1, scaledMacros, type CatalogFood } from './helpers'

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.short }))

export function EntrySheet({ entry, catalog, onClose }: {
  entry: FoodLogEntry | null
  catalog: CatalogFood[]
  onClose: () => void
}) {
  const toast = useUI((s) => s.toast)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [meal, setMeal] = useState<MealKey>('lunch')
  const [gramsStr, setGramsStr] = useState('')
  const [kcalStr, setKcalStr] = useState('')
  const [pStr, setPStr] = useState('')
  const [cStr, setCStr] = useState('')
  const [fStr, setFStr] = useState('')
  const [toDate, setToDate] = useState('')

  const food = useMemo(
    () => (entry?.foodId ? catalog.find((c) => c.id === entry.foodId) : undefined),
    [entry, catalog],
  )
  const gramMode = Boolean(food || (entry && entry.grams > 0))

  useEffect(() => {
    if (!entry) return
    setMeal(entry.meal)
    setGramsStr(String(entry.grams % 1 === 0 ? entry.grams : round1(entry.grams)))
    setKcalStr(String(entry.kcal))
    setPStr(String(entry.protein))
    setCStr(String(entry.carbs))
    setFStr(String(entry.fat))
    setConfirmOpen(false)
    setToDate(dayjs(entry.date).add(1, 'day').format('YYYY-MM-DD'))
  }, [entry])

  const grams = parseNum(gramsStr) ?? 0

  const preview = useMemo(() => {
    if (!entry) return null
    if (food) return scaledMacros(food, grams)
    if (gramMode && entry.grams > 0) {
      // no food record — scale the entry's own macros linearly
      const k = grams / entry.grams
      return {
        kcal: Math.round(entry.kcal * k),
        protein: round1(entry.protein * k),
        carbs: round1(entry.carbs * k),
        fat: round1(entry.fat * k),
      }
    }
    return {
      kcal: Math.round(parseNum(kcalStr) ?? 0),
      protein: parseNum(pStr) ?? 0,
      carbs: parseNum(cStr) ?? 0,
      fat: parseNum(fStr) ?? 0,
    }
  }, [entry, food, gramMode, grams, kcalStr, pStr, cStr, fStr])

  if (!entry) return null

  const valid = gramMode ? grams > 0 : (parseNum(kcalStr) ?? 0) > 0

  const save = async () => {
    if (!valid || !preview) return
    await db.foodLog.put({
      ...entry,
      meal,
      grams: gramMode ? round1(grams) : entry.grams,
      ...preview,
    })
    toast('Entry updated')
    onClose()
  }

  /** fibre / sugar / sat fat / sodium for the amount shown (IV-06.09) */
  const k = food ? grams / 100 : entry.grams > 0 ? (gramMode ? grams : entry.grams) / entry.grams : 1
  const src = food ?? entry
  const extra = ([['Fibre', src.fibre, 'g'], ['Sugar', src.sugar, 'g'], ['Sat fat', src.satFat, 'g'], ['Sodium', src.sodium, 'mg']] as const)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([l, v, u]) => [l, u === 'mg' ? Math.round((v as number) * k) : round1((v as number) * k), u] as const)
  const serves = food ? [...(food.servingGrams && food.servingName ? [{ name: food.servingName, grams: food.servingGrams }] : []), ...(food.serves ?? [])] : []

  /** copy or move this entry to another day (IV-06.16) */
  const copyTo = async (d: string) => {
    const id = newId()
    await db.foodLog.add({ ...entry, id, date: d, meal, createdAt: nowIso() })
    toastWithUndo(`Copied to ${dayjs(d).format('ddd D MMM')}`, async () => { await db.foodLog.delete(id) }, 'success')
    onClose()
  }
  const moveTo = async (d: string) => {
    await mutateWithUndo(db.foodLog, entry.id, `Moved to ${dayjs(d).format('ddd D MMM')}`, async (row) => { await db.foodLog.put({ ...row, date: d, meal }) })
    onClose()
  }

  const remove = async () => {
    // deleteWithUndo raises its own toast with the Undo pill attached
    await deleteWithUndo(db.foodLog, entry.id, `Deleted ${entry.name}`)
    onClose()
  }

  return (
    <>
      <Sheet open onClose={onClose} title="Edit entry">
        <h3 className="text-[17px] font-bold leading-tight text-ink">{entry.name}</h3>
        {food && (
          <p className="mt-0.5 text-[12.5px] text-ink3">
            {fmtInt(food.kcal)} kcal · {food.protein}g P per 100g
          </p>
        )}

        {gramMode ? (
          <>
          <Field label="Amount in grams" className="mt-4">
            <Input inputMode="decimal" value={gramsStr} onChange={(e) => setGramsStr(e.target.value)} />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0.5, 1, 1.5, 2].map((m) => <button key={m} type="button" onClick={() => setGramsStr(String(round1(entry.grams * m)))} className={`pressable rounded-full px-3 py-1.5 text-[12px] font-semibold ${Math.abs(grams - entry.grams * m) < 0.05 ? 'bg-brand text-black' : 'bg-surface3 text-ink2'}`}>{m === 0.5 ? '½' : m}× <span className="font-normal opacity-70">{round1(entry.grams * m)}g</span></button>)}
            {serves.flatMap((sv) => [1, 2].map((n) => <button key={sv.name + n} type="button" onClick={() => setGramsStr(String(round1(sv.grams * n)))} className="pressable rounded-full bg-surface3 px-3 py-1.5 text-[12px] font-semibold text-ink2">{n} {sv.name} <span className="font-normal opacity-70">{round1(sv.grams * n)}g</span></button>))}
          </div>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            <Field label="Calories (kcal)">
              <Input inputMode="numeric" value={kcalStr} onChange={(e) => setKcalStr(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Protein g">
                <Input inputMode="decimal" value={pStr} onChange={(e) => setPStr(e.target.value)} />
              </Field>
              <Field label="Carbs g">
                <Input inputMode="decimal" value={cStr} onChange={(e) => setCStr(e.target.value)} />
              </Field>
              <Field label="Fat g">
                <Input inputMode="decimal" value={fStr} onChange={(e) => setFStr(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {preview && (
          <div className="mt-4 flex gap-2">
            {([
              ['kcal', fmtInt(preview.kcal)],
              ['protein', `${preview.protein}g`],
              ['carbs', `${preview.carbs}g`],
              ['fat', `${preview.fat}g`],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex-1 rounded-xl bg-surface3 px-2 py-2 text-center">
                <div className={`text-[15px] font-bold ${label === 'kcal' ? 'text-brand' : 'text-ink'}`}>{value}</div>
                <div className="text-[10.5px] font-medium uppercase tracking-wide text-ink3">{label}</div>
              </div>
            ))}
          </div>
        )}

        {extra.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11.5px] text-ink3">
            {extra.map(([l, v, u]) => <div key={l} className="rounded-lg bg-surface2 py-1.5"><b className="block text-[13px] text-ink">{v}{u}</b>{l}</div>)}
          </div>
        )}

        <Field label="Meal" className="mt-4">
          <Segmented options={MEAL_OPTIONS} value={meal} onChange={(v) => setMeal(v)} />
        </Field>

        <Field label="Copy or move to another day" className="mt-4">
          <div className="flex gap-2">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Button small variant="secondary" disabled={!toDate} onClick={() => { void copyTo(toDate) }}>Copy</Button>
            <Button small variant="secondary" disabled={!toDate || toDate === entry.date} onClick={() => { void moveTo(toDate) }}>Move</Button>
          </div>
        </Field>

        <div className="mt-5 space-y-2">
          <Button full disabled={!valid} onClick={save}>Save changes</Button>
          <Button full variant="danger" onClick={() => setConfirmOpen(true)}>
            <Trash2 size={16} /> Delete entry
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { void remove() }}
        title="Delete this entry?"
        message={`“${entry.name}” (${fmtInt(entry.kcal)} kcal) will be removed from ${entry.meal}.`}
      />
    </>
  )
}
