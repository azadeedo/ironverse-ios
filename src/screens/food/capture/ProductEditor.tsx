// Fix a scanned product, or create one the databases don't know (15 Nov 2026).
// What you save here becomes your verified version of that barcode: every later scan
// of it uses your numbers before any database.

import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { barcodeChecksumOk, macroCheck, normaliseBarcode, saveUserProduct, type ScannedProduct } from '@/lib/barcode'

const num = (s: string) => {
  const v = parseFloat(String(s).replace(',', '.'))
  return Number.isFinite(v) && v >= 0 ? v : 0
}
const str = (v: number | undefined) => (v === undefined || v === null ? '' : String(v))

export function ProductEditor({ start, onSaved, onCancel }: {
  start: Partial<ScannedProduct> & { barcode: string }
  onSaved: (p: ScannedProduct) => void
  onCancel: () => void
}) {
  const p100 = start.per100
  const [f, setF] = useState({
    barcode: start.barcode ?? '',
    name: start.name && !/^Product \d+$/.test(start.name) ? start.name : '',
    brand: start.brand ?? '',
    serving: str(start.servingGrams),
    kcal: str(p100?.kcal),
    protein: str(p100?.protein),
    carbs: str(p100?.carbs),
    fat: str(p100?.fat),
    fibre: str(p100?.fibre),
    sugar: str(p100?.sugar),
    sodium: str(p100?.sodium),
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const per100 = { kcal: Math.round(num(f.kcal)), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat), fibre: f.fibre ? num(f.fibre) : undefined }
  const code = normaliseBarcode(f.barcode)
  const warn = macroCheck(per100)
  const codeWarn = code && !barcodeChecksumOk(code) ? 'That number fails the barcode check digit — check it against the digits under the bars.' : null
  const ok = !!code && !!f.name.trim() && per100.kcal > 0

  const save = async () => {
    if (!ok) return
    setSaving(true)
    try {
      const saved = await saveUserProduct({
        barcode: code,
        name: f.name.trim(),
        brand: f.brand.trim() || undefined,
        per100: { ...per100, sugar: f.sugar ? num(f.sugar) : undefined, sodium: f.sodium ? num(f.sodium) : undefined, satFat: start.per100?.satFat },
        servingGrams: f.serving ? num(f.serving) || undefined : undefined,
        servingName: start.servingName,
        dietTags: start.dietTags ?? [],
        cached: true,
        fetchedAt: new Date().toISOString(),
      } as ScannedProduct)
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, k: keyof typeof f, unit: string, mode: 'decimal' | 'numeric' | 'text' = 'decimal') => (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink3">{label}</span>
      <div className="relative mt-1">
        <Input inputMode={mode} value={f[k]} onChange={set(k)} />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-ink3">{unit}</span>}
      </div>
    </label>
  )

  return (
    <div>
      <h3 className="text-[18px] font-bold text-ink">{start.name ? 'Fix this product' : 'Add this product'}</h3>
      <p className="mt-1 text-[12.5px] text-ink3">Copy it from the nutrition panel (per 100 g). Saved as your checked version: next time you scan this barcode, these numbers are used first.</p>
      <div className="mt-3 space-y-2.5">
        {field('Barcode', 'barcode', '', 'numeric')}
        {codeWarn && <p className="text-[12px] text-amber-400">{codeWarn}</p>}
        {field('Product name', 'name', '', 'text')}
        {field('Brand', 'brand', '', 'text')}
        {field('Serving size', 'serving', 'g')}
        <div className="grid grid-cols-2 gap-2">
          {field('Calories per 100 g', 'kcal', 'cal')}
          {field('Protein', 'protein', 'g')}
          {field('Carbs', 'carbs', 'g')}
          {field('Fat', 'fat', 'g')}
          {field('Fibre (optional)', 'fibre', 'g')}
          {field('Sugar (optional)', 'sugar', 'g')}
        </div>
        {field('Sodium (optional)', 'sodium', 'mg')}
        <p className="text-[11.5px] text-ink3">Label in kJ only? Calories = kJ ÷ 4.184.</p>
        {warn && <p className="rounded-xl bg-amber-500/10 p-2.5 text-[12.5px] text-amber-300">{warn}</p>}
      </div>
      <Button full className="mt-4" disabled={!ok || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save my version'}</Button>
      <Button full variant="secondary" small className="mt-2" onClick={onCancel}>Cancel</Button>
    </div>
  )
}
