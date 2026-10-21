// Calories + protein vs targets. Whole card links to /food.

import { useNavigate } from 'react-router-dom'
import { Apple, ChevronRight } from 'lucide-react'
import { Card, ProgressBar } from '@/components/ui'
import { fmtInt } from '@/lib/fmt'

export function NutritionCard({ kcal, protein, kcalTarget, proteinTarget }: {
  kcal: number
  protein: number
  kcalTarget: number
  proteinTarget: number
}) {
  const navigate = useNavigate()
  const remaining = kcalTarget - kcal
  const over = remaining < 0

  return (
    <Card className="p-4" onClick={() => navigate('/food')}>
      <div className="flex items-center gap-1.5">
        <Apple size={15} className="text-brand" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">Nutrition</span>
        <ChevronRight size={15} className="text-ink3" />
      </div>

      <div className="mt-2.5 flex items-end justify-between">
        <div>
          <span className={`big-num text-[30px] leading-none ${over ? 'text-red-500' : 'text-ink'}`}>
            {fmtInt(Math.abs(remaining))}
          </span>
          <span className="ml-1.5 text-[13px] font-semibold text-ink2">kcal {over ? 'over' : 'left'}</span>
        </div>
        {kcal === 0 && (
          <span className="text-[12px] font-medium text-ink3">Nothing logged yet</span>
        )}
      </div>

      <div className="mt-3.5 space-y-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between text-[12px]">
            <span className="font-semibold text-ink2">Calories</span>
            <span className="tabular-nums font-semibold text-ink2">
              {fmtInt(kcal)} <span className="text-ink3">/ {fmtInt(kcalTarget)}</span>
            </span>
          </div>
          <ProgressBar pct={kcalTarget > 0 ? (kcal / kcalTarget) * 100 : 0} />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between text-[12px]">
            <span className="font-semibold text-ink2">Protein</span>
            <span className="tabular-nums font-semibold text-ink2">
              {fmtInt(protein)} g <span className="text-ink3">/ {fmtInt(proteinTarget)} g</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface3">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(0, proteinTarget > 0 ? (protein / proteinTarget) * 100 : 0))}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
