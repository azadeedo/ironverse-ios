// Adaptive calorie target — learn the real TDEE from what actually happened
// (logged intake + measured weight change) instead of trusting a formula that
// was fixed on day one.
//
// The formula number stays visible next to it, always. And the target never
// drops below max(BMR, 1500) — an aggressive number you abandon in a week is
// worse than a sane one you hold.

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Gauge, Info } from 'lucide-react'
import { Badge, Button, Card, Toggle } from '@/components/ui'
import { db } from '@/db'
import { adaptiveCalories, energyUnit, fmtEnergy } from '@/db/defaults'
import type { Profile } from '@/db/types'
import { adaptiveTdee, bmr, projectedKgPerWeek, recommendedTargets, tdeeFormula } from '@/lib/nutrition'

/** Never go below this, whatever the maths says. */
export function calorieFloor(p: Profile): number {
  return Math.max(bmr(p), 1500)
}

/** Goal offset applied to a TDEE estimate, before the floor. */
export function rawTargetFromTdee(p: Profile, tdee: number): number {
  return Math.round(
    p.goal === 'lose-fat' ? tdee - 500
    : p.goal === 'build-muscle' ? tdee + 250
    : tdee - 200,
  )
}

/** Same, clamped so it can never sit under max(BMR, 1500). */
export function targetFromTdee(p: Profile, tdee: number): number {
  return Math.max(calorieFloor(p), rawTargetFromTdee(p, tdee))
}

export function AdaptiveCaloriesCard({ profile, onPatch }: {
  profile: Profile
  onPatch: (patch: Partial<Profile>, msg?: string) => void
}) {
  const [applying, setApplying] = useState(false)
  const on = adaptiveCalories(profile)
  const unit = energyUnit(profile)

  const weighIns = useLiveQuery(() => db.weighIns.orderBy('date').toArray(), [])
  const foodLog = useLiveQuery(() => db.foodLog.toArray(), [])

  const intake = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of foodLog ?? []) m.set(e.date, (m.get(e.date) ?? 0) + e.kcal)
    return m
  }, [foodLog])

  const learned = useMemo(
    () => (weighIns && foodLog ? adaptiveTdee(weighIns, intake, 21) : null),
    [weighIns, foodLog, intake],
  )

  const formulaTdee = tdeeFormula(profile)
  const formulaTarget = recommendedTargets(profile).calories
  const floor = calorieFloor(profile)
  const learnedTarget = learned ? targetFromTdee(profile, learned.tdee) : null
  const flooredOut = learned !== null && rawTargetFromTdee(profile, learned.tdee) < floor

  async function apply() {
    if (learnedTarget === null) return
    setApplying(true)
    try {
      onPatch({ calorieTarget: learnedTarget }, `Target set to ${fmtEnergy(learnedTarget, unit)}`)
    } finally {
      setApplying(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Gauge size={16} className="shrink-0 text-brand" />
            <span className="text-[14.5px] font-semibold text-ink">Adaptive calorie target</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
            Works out what your body is actually burning from the last two to three
            weeks of logged food and weigh-ins, instead of a formula frozen at the
            start. Needs about a week of food logs and two weigh-ins a week apart.
          </p>
        </div>
        <Toggle
          checked={on}
          label="Adaptive calorie target"
          onChange={(v) => onPatch({ adaptiveCalories: v }, v ? 'Adaptive target on' : 'Back to the formula')}
        />
      </div>

      {/* ---------- side by side ---------- */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-surface3/70 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink3">From formula</div>
          <div className="big-num mt-1 text-[19px] leading-none text-ink">
            {fmtEnergy(formulaTarget, unit === 'both' ? 'kcal' : unit)}
          </div>
          <div className="mt-1 text-[11.5px] text-ink3">TDEE {formulaTdee.toLocaleString()} kcal</div>
        </div>
        <div className={`rounded-xl p-3 ${learnedTarget !== null ? 'bg-brand/10' : 'bg-surface3/70'}`}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink3">From your data</div>
          <div className={`big-num mt-1 text-[19px] leading-none ${learnedTarget !== null ? 'text-brand' : 'text-ink3'}`}>
            {learnedTarget !== null ? fmtEnergy(learnedTarget, unit === 'both' ? 'kcal' : unit) : 'Not yet'}
          </div>
          <div className="mt-1 text-[11.5px] text-ink3">
            {learned ? `TDEE ${learned.tdee.toLocaleString()} kcal` : 'Keep logging'}
          </div>
        </div>
      </div>

      {/* ---------- the honest detail ---------- */}
      {learned ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={learned.kgPerWeek < 0 ? 'green' : learned.kgPerWeek > 0 ? 'amber' : 'gray'}>
              {learned.kgPerWeek === 0 ? 'holding steady' : `${learned.kgPerWeek > 0 ? '+' : ''}${learned.kgPerWeek.toFixed(2)} kg/week`}
            </Badge>
            <Badge tone="gray">{learned.daysUsed} days used</Badge>
            <Badge tone="gray">avg {learned.avgIntake.toLocaleString()} kcal eaten</Badge>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink2">
            At {learnedTarget?.toLocaleString()} kcal you would be heading for about{' '}
            <span className="font-semibold text-ink">
              {projectedKgPerWeek(learnedTarget ?? 0, learned.tdee).toFixed(2)} kg a week
            </span>
            . That is measured from your real numbers, not predicted from a formula —
            which also means a bad logging week will move it.
          </p>
          {flooredOut && (
            <p className="text-[12px] font-medium text-amber-400">
              Held at the {floor.toLocaleString()} kcal floor — your BMR sets the bottom, and going under it is not the lever.
            </p>
          )}
          {on && profile.calorieTarget !== learnedTarget && (
            <Button
              small full variant="secondary"
              disabled={applying}
              onClick={() => void apply()}
            >
              Update my target to {(learnedTarget ?? 0).toLocaleString()} kcal
            </Button>
          )}
          {on && profile.calorieTarget === learnedTarget && (
            <p className="text-[12px] font-medium text-emerald-500">Your target is already on the learned number.</p>
          )}
        </div>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-[12px] text-ink3">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Not enough to go on yet — log food on most days and weigh in at least
            twice, a week or more apart. Until then the formula number is what the
            app uses.
          </span>
        </p>
      )}

      <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-ink3">
        Whichever number wins, it never goes below {floor.toLocaleString()} kcal.
      </p>
    </Card>
  )
}
