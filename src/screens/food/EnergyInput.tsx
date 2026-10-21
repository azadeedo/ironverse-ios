// ============================================================
// Calorie input that speaks kilojoules.
// Australian labels print kJ, so every energy field here takes either unit,
// remembers whichever he used last, and quietly catches the classic mistake of
// typing the kJ number into a calorie box. STORAGE IS ALWAYS kcal.
// ============================================================
import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui'
import { SETTING_KEYS, getSetting, setSetting } from '@/db'
import {
  INPUT_UNIT_OPTIONS, fromKcal, kjSuggestion, looksLikeKilojoules, toKcal,
  type InputUnit,
} from '@/lib/energy'
import { parseNum } from './helpers'

/** Remembered kcal/kJ preference for typing. Falls back to calories. */
export function useEnergyInputUnit(): [InputUnit, (u: InputUnit) => void] {
  const [unit, setUnitState] = useState<InputUnit>('kcal')

  useEffect(() => {
    let alive = true
    void getSetting<InputUnit>(SETTING_KEYS.lastEnergyUnitUsed, 'kcal').then((u) => {
      if (alive && (u === 'kcal' || u === 'kj')) setUnitState(u)
    })
    return () => { alive = false }
  }, [])

  const setUnit = (u: InputUnit) => {
    setUnitState(u)
    void setSetting(SETTING_KEYS.lastEnergyUnitUsed, u)
  }
  return [unit, setUnit]
}

function UnitToggle({ unit, onChange }: { unit: InputUnit; onChange: (u: InputUnit) => void }) {
  return (
    <div className="flex shrink-0 rounded-xl bg-surface3 p-1">
      {INPUT_UNIT_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={unit === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-[46px] rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
            unit === o.value ? 'bg-surface2 text-ink shadow-sm' : 'text-ink2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export interface EnergyInputProps {
  /** raw text the user is typing, in the CURRENT unit */
  value: string
  onChange: (raw: string) => void
  unit: InputUnit
  /** changing the unit converts the number in the box so the meaning is kept */
  onUnitChange: (u: InputUnit) => void
  /** a per-100g field catches kJ at a much lower threshold than a whole serve */
  per?: 'per100g' | 'serve'
  placeholder?: string
}

/**
 * Energy field with a cal/kJ toggle and an inline kilojoule catch.
 * Read the stored value with `energyKcal(value, unit)`.
 */
export function EnergyInput({
  value, onChange, unit, onUnitChange, per = 'per100g', placeholder = '0',
}: EnergyInputProps) {
  const [dismissed, setDismissed] = useState(false)
  const n = parseNum(value)

  useEffect(() => { setDismissed(false) }, [value])

  const switchUnit = (u: InputUnit) => {
    if (u === unit) return
    if (n !== null && value.trim()) {
      // keep the same amount of energy, expressed in the new unit
      const kcal = toKcal(n, unit)
      const next = fromKcal(kcal, u)
      onChange(String(Math.round(next * 10) / 10))
    }
    onUnitChange(u)
  }

  const suspect = unit === 'kcal' && n !== null && looksLikeKilojoules(n, per)
  const hint = suspect && n !== null ? kjSuggestion(n) : null

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <Input
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <UnitToggle unit={unit} onChange={switchUnit} />
      </div>

      {hint && !dismissed && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-brand/10 px-3 py-2.5">
          <Info size={15} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-snug text-ink2">
              That looks like the kilojoule figure off the label. {hint.message}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onUnitChange('kj')}
                className="pressable rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white"
              >
                Yes — it&rsquo;s kJ
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="pressable rounded-lg bg-surface3 px-3 py-1.5 text-[12.5px] font-semibold text-ink2"
              >
                No, it&rsquo;s calories
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Stored kcal for what's currently typed, or null when the box is empty/invalid. */
export function energyKcal(value: string, unit: InputUnit): number | null {
  const n = parseNum(value)
  if (n === null) return null
  return Math.round(toKcal(n, unit))
}
