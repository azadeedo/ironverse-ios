// Review → Nutrition: averages vs target, days logged, and the weekly calorie
// budget position (7 × target, honouring any carry-over rows).
import { Card, Section, StatCard } from '@/components/ui'
import type { EnergyUnit } from '@/db/types'
import { fmtEnergyShort } from '@/db/defaults'
import { dayjs } from '@/lib/fmt'
import type { NutritionStats } from './helpers'

export default function NutritionCard({ n, unit }: { n: NutritionStats; unit: EnergyUnit }) {
  const cal = (k: number) => fmtEnergyShort(k, unit)
  const avgTarget = Math.round(n.budgetKcal / 7)
  const over = n.positionKcal > 0
  const spentPct = n.budgetKcal > 0 ? Math.min(140, (n.consumedKcal / n.budgetKcal) * 100) : 0
  const elapsedPct = n.budgetKcal > 0 ? (n.elapsedBudgetKcal / n.budgetKcal) * 100 : 0

  return (
    <Section title="Nutrition">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Avg calories"
          value={n.daysLogged ? cal(n.avgKcal) : '—'}
          sub={n.daysLogged ? `target ${cal(avgTarget)}` : 'nothing logged'}
          tone={!n.daysLogged ? 'default' : n.avgKcal > avgTarget * 1.08 ? 'amber' : 'default'}
        />
        <StatCard
          label="Avg protein"
          value={n.daysLogged ? `${n.avgProtein} g` : '—'}
          sub={`target ${n.proteinTarget} g`}
          tone={!n.daysLogged ? 'default' : n.avgProtein >= n.proteinTarget * 0.95 ? 'green' : 'amber'}
        />
        <StatCard
          label="Days logged"
          value={`${n.daysLogged}/7`}
          sub={n.daysLogged >= 5 ? 'enough to trust the averages' : 'more days = better averages'}
          tone={n.daysLogged >= 5 ? 'green' : 'default'}
        />
        <StatCard
          label="Protein under"
          value={`${n.daysProteinUnder}`}
          sub={n.daysProteinUnder === 1 ? 'day below target' : 'days below target'}
          tone={n.daysProteinUnder >= 3 ? 'amber' : 'default'}
        />
      </div>

      {/* ---------- weekly budget ---------- */}
      <Card className="mt-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink">Weekly calorie budget</h3>
          <span className={`big-num text-[15px] ${over ? 'text-amber-500' : 'text-emerald-500'}`}>
            {over ? '+' : '−'}{cal(Math.abs(n.positionKcal))}
          </span>
        </div>
        <div className="relative mt-2.5 h-3 overflow-hidden rounded-full bg-surface3">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${over ? 'bg-amber-500/80' : 'bg-emerald-500/80'}`}
            style={{ width: `${Math.max(2, Math.min(100, spentPct))}%` }}
          />
          {elapsedPct > 0 && elapsedPct < 100 && (
            <div className="absolute inset-y-0 w-[2px] bg-ink/45" style={{ left: `${elapsedPct}%` }} />
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between text-[12px] text-ink2">
          <span>{cal(n.consumedKcal)} eaten</span>
          <span>{cal(n.budgetKcal)} for the week</span>
        </div>
        <p className="mt-2 text-[11.5px] text-ink3">
          {n.daysElapsed < 7
            ? `The marker is where you are in the week — ${n.daysElapsed} of 7 days, ${cal(n.elapsedBudgetKcal)} of budget so far.`
            : 'Seven days of target against seven days of food.'}
          {n.hasAdjust ? ' Carry-over adjustments are included in the target.' : ''}
          {n.daysLogged < 7 ? ' Unlogged days count as zero, so this reads low if you skipped logging.' : ''}
        </p>
      </Card>

      {/* ---------- day by day ---------- */}
      <Card className="mt-3 p-4">
        <h3 className="text-[14px] font-semibold text-ink">Day by day</h3>
        <div className="mt-2.5 space-y-2">
          {n.days.map((d) => {
            const pct = d.target > 0 ? Math.min(130, (d.kcal / d.target) * 100) : 0
            const proteinPct = n.proteinTarget > 0 ? Math.min(130, (d.protein / n.proteinTarget) * 100) : 0
            return (
              <div key={d.date} className="flex items-center gap-3">
                <span className="w-[34px] shrink-0 text-[12px] font-medium text-ink2">
                  {dayjs(d.date).format('ddd')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-surface3">
                    <div
                      className={`h-full rounded-full ${!d.logged ? 'bg-surface3' : pct > 108 ? 'bg-amber-500/80' : 'bg-brand/85'}`}
                      style={{ width: `${Math.max(d.logged ? 4 : 0, pct)}%` }}
                    />
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface3">
                    <div
                      className={`h-full rounded-full ${proteinPct >= 95 ? 'bg-emerald-500/75' : 'bg-emerald-500/35'}`}
                      style={{ width: `${Math.max(0, proteinPct)}%` }}
                    />
                  </div>
                </div>
                <span className="w-[92px] shrink-0 text-right text-[11.5px] text-ink3">
                  {d.logged ? `${cal(d.kcal)} · ${d.protein}g` : 'not logged'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2.5 text-[11.5px] text-ink3">
          Top bar is calories against that day's target, thin bar underneath is protein.
        </p>
      </Card>
    </Section>
  )
}
