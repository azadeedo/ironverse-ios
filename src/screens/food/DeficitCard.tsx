// Deficit detector — adaptive TDEE learned from real intake + weight trend.
import { Flame, Lock } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import { adaptiveTdee, deficitReadiness, projectedKgPerWeek, tdeeFormula } from '@/lib/nutrition'
import { fmtInt } from '@/lib/fmt'
import type { Profile, WeighIn } from '@/db/types'

function trendWords(kgPerWeek: number): string {
  if (kgPerWeek <= -0.05) return `losing ${Math.abs(kgPerWeek).toFixed(1)} kg/week`
  if (kgPerWeek >= 0.05) return `gaining ${kgPerWeek.toFixed(1)} kg/week`
  return 'holding steady'
}

export function DeficitCard({ profile, weighIns, intakeMap }: {
  profile: Profile
  weighIns: WeighIn[]
  intakeMap: Map<string, number>
}) {
  const adaptive = adaptiveTdee(weighIns, intakeMap)
  const formula = tdeeFormula(profile)

  if (!adaptive) {
    const loggedDays = [...intakeMap.values()].filter((v) => v > 500).length
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-ink3" />
          <h3 className="text-[15px] font-semibold text-ink">Deficit detector</h3>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">
          Log 7+ days of food and 2 weigh-ins (a week or more apart) to unlock your true burn
          rate — measured from your own body, not a formula.
        </p>
        <div className="mt-3 flex gap-2">
          <Badge tone={loggedDays >= 7 ? 'green' : 'gray'}>
            {Math.min(loggedDays, 7)}/7 days logged
          </Badge>
          <Badge tone={weighIns.length >= 2 ? 'green' : 'gray'}>
            {Math.min(weighIns.length, 2)}/2 weigh-ins
          </Badge>
        </div>
        {(() => {
          // say EXACTLY which condition is still unmet (IV-25B)
          const r = deficitReadiness(weighIns, intakeMap)
          return r.missing ? <p className="mt-2 rounded-xl bg-surface3/60 px-3 py-2 text-[12.5px] text-ink2"><b>Still needed:</b> {r.missing}</p> : null
        })()}
        <p className="mt-3 text-[12px] text-ink3">
          Until then the formula estimates your burn at ~{fmtInt(formula)} kcal/day.
        </p>
      </Card>
    )
  }

  const projected = projectedKgPerWeek(profile.calorieTarget, adaptive.tdee)
  const diff = adaptive.tdee - formula
  const compare =
    Math.abs(diff) < 75
      ? `right in line with the formula estimate (${fmtInt(formula)} kcal)`
      : `~${fmtInt(Math.abs(diff))} kcal ${diff > 0 ? 'hotter' : 'cooler'} than the formula said (${fmtInt(formula)} kcal)`

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-brand" />
        <h3 className="text-[15px] font-semibold text-ink">Deficit detector</h3>
        <Badge tone="brand" className="ml-auto">live</Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="big-num text-[30px] leading-none text-brand">{fmtInt(adaptive.tdee)}</span>
        <span className="text-[13px] text-ink2">kcal — your real daily burn</span>
      </div>
      <div className="mt-3 space-y-1.5 text-[13.5px] text-ink2">
        <div>
          Right now you&rsquo;re <span className="font-semibold text-ink">{trendWords(adaptive.kgPerWeek)}</span>{' '}
          on ~{fmtInt(adaptive.avgIntake)} kcal/day.
        </div>
        <div>
          At today&rsquo;s target ({fmtInt(profile.calorieTarget)} kcal) you&rsquo;ll be{' '}
          <span className={`font-semibold ${projected < 0 ? 'text-good' : 'text-ink'}`}>
            {trendWords(projected)}
          </span>.
        </div>
        <div>Your metabolism runs {compare}.</div>
      </div>
      <p className="mt-3 text-[11.5px] text-ink3">
        Measured from {adaptive.daysUsed} days of your logs and weigh-ins.
      </p>
    </Card>
  )
}
