// Daily summary — compact dashboard (v9 redesign, same numbers as before):
// one big calorie ring, three macro bars with targets, protein remaining and
// quick-add actions. Carb/fat targets are guides worked out from the day's
// calories after protein (fat ≈ 25% of calories, carbs the rest).
import { DIET_KEY, dietById, dietMacros, filterDiet } from '@/lib/diets'
import { getSetting } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, PenLine, ScanBarcode } from 'lucide-react'
import { Card } from '@/components/ui'
import { ProgressRing } from '@/components/charts'
import { fmtInt } from '@/lib/fmt'
import type { Profile } from '@/db/types'
import type { MacroTotals } from './helpers'

export function macroGuides(target: number, proteinTarget: number) {
  const fat = Math.round((target * 0.25) / 9)
  const carbs = Math.max(0, Math.round((target - proteinTarget * 4 - fat * 9) / 4))
  return { protein: proteinTarget, carbs, fat }
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{label}</div>
      <div className="text-[13px] font-bold text-ink">{Math.round(value)}<span className="font-medium text-ink3">/{target}g</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-surface3"><div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

export function SummaryCard({ totals, profile, target: dayTarget, onScanMeal, onBarcode, onManual }: {
  totals: MacroTotals; profile: Profile; target?: number
  onScanMeal?: () => void; onBarcode?: () => void; onManual?: () => void
}) {
  // the day's REAL target, including any carry-over
  const target = dayTarget ?? profile.calorieTarget
  const remaining = Math.round(target - totals.kcal)
  const over = remaining < 0
  // v10.2: carb/fat guides follow the chosen diet (Settings → Food → Diet)
  const diet = dietById(useLiveQuery(() => getSetting<string>(DIET_KEY, 'balanced'), []))
  const g = diet.id === 'balanced' ? macroGuides(target, profile.proteinTarget) : dietMacros(target, profile.proteinTarget, diet)
  const pLeft = Math.max(0, Math.round(profile.proteinTarget - totals.protein))
  const quick = onScanMeal || onBarcode || onManual

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <ProgressRing value={totals.kcal} target={target} size={128} stroke={11}
          label={fmtInt(totals.kcal)} sub={`of ${fmtInt(target)} kcal`} accent={over ? '#f87171' : '#fbbf24'} />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink3">{over ? 'Over target' : 'Remaining'}</div>
          <div className={`big-num text-[34px] leading-none ${over ? 'text-bad' : 'text-ink'}`}>{fmtInt(Math.abs(remaining))}</div>
          <div className="text-[12px] text-ink2">kcal {over ? 'over' : 'left'} today</div>
          <div className={`mt-2 rounded-lg px-2 py-1 text-[12px] font-semibold ${pLeft ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
            {pLeft ? `${pLeft} g protein to go` : 'Protein target hit ✓'}
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <MacroBar label="Carbs" value={totals.carbs} target={g.carbs} color="#fbbf24" />
        <MacroBar label="Fat" value={totals.fat} target={g.fat} color="#60a5fa" />
        <MacroBar label="Protein" value={totals.protein} target={g.protein} color="#34d399" />
      </div>
      {quick && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {onScanMeal && <button type="button" onClick={onScanMeal} className="pressable flex flex-col items-center gap-1 rounded-xl bg-surface3 py-2.5 text-[12px] font-semibold text-ink2"><Camera size={18} />Scan meal</button>}
          {onBarcode && <button type="button" onClick={onBarcode} className="pressable flex flex-col items-center gap-1 rounded-xl bg-surface3 py-2.5 text-[12px] font-semibold text-ink2"><ScanBarcode size={18} />Barcode</button>}
          {onManual && <button type="button" onClick={onManual} className="pressable flex flex-col items-center gap-1 rounded-xl bg-brand py-2.5 text-[12px] font-bold text-white"><PenLine size={18} />Add food</button>}
        </div>
      )}
      <div className="mt-2 text-[10.5px] text-ink3">Carb and fat amounts are guides from your calorie and protein targets{diet.id !== 'balanced' ? ` · ${diet.emoji} ${diet.label} diet` : ''}.</div>
    </Card>
  )
}
