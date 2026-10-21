// ADAPTIVE TARGET — today's calorie number, learned from what the scale
// actually did rather than a formula, and respecting any carry-over row for
// today (going over yesterday quietly takes a bite out of today).
//
// Only rendered when profile.adaptiveCalories is on.

import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Info, LineChart as LineIcon } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { db } from '@/db'
import { energyUnit, fmtEnergy } from '@/db/defaults'
import { adaptiveTdee, bmr, projectedKgPerWeek } from '@/lib/nutrition'
import type { Profile } from '@/db/types'

/** Never let a learned or adjusted target fall below this. */
const MIN_KCAL = 1500

function goalDelta(goal: Profile['goal']): number {
  if (goal === 'lose-fat') return -500
  if (goal === 'build-muscle') return 250
  return -200
}

export function AdaptiveTargetCard({
  profile, kcalToday, today,
}: {
  profile: Profile
  kcalToday: number
  today: string
}) {
  const navigate = useNavigate()
  const unit = energyUnit(profile)

  const data = useLiveQuery(async () => {
    const [weighIns, foodRows, adjust] = await Promise.all([
      db.weighIns.toArray(),
      db.foodLog.toArray(),
      // plain table read — the carry-over row for today, if there is one
      db.dayAdjust.get(today),
    ])
    const intake = new Map<string, number>()
    for (const r of foodRows) intake.set(r.date, (intake.get(r.date) ?? 0) + r.kcal)
    return { adaptive: adaptiveTdee(weighIns, intake), adjust }
  }, [today])

  if (data === undefined) return null

  const { adaptive, adjust } = data
  const floor = Math.max(Math.round(bmr(profile)) || 0, MIN_KCAL)
  const delta = adjust?.deltaKcal ?? 0

  const learnedBase = adaptive ? adaptive.tdee + goalDelta(profile.goal) : null
  const base = learnedBase ?? profile.calorieTarget
  const target = Math.max(floor, Math.round(base + delta))
  const remaining = target - kcalToday
  const over = remaining < 0
  const projected = adaptive ? projectedKgPerWeek(target, adaptive.tdee) : null

  return (
    <Card className="p-4" onClick={() => navigate('/food')}>
      <div className="flex items-center gap-1.5">
        <LineIcon size={15} className="text-brand" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">
          Today&rsquo;s adaptive target
        </span>
        {adaptive ? <Badge tone="brand">Learned</Badge> : <Badge tone="gray">Learning</Badge>}
        <ChevronRight size={15} className="text-ink3" />
      </div>

      <div className="mt-2.5 flex items-end justify-between">
        <div>
          <span className="big-num text-[30px] leading-none text-ink">{fmtEnergy(target, unit)}</span>
          <div className="mt-1 text-[12.5px] font-semibold text-ink2">
            {over
              ? `${fmtEnergy(Math.abs(remaining), unit)} over so far`
              : `${fmtEnergy(remaining, unit)} left today`}
          </div>
        </div>
      </div>

      {delta < 0 && (
        <div className="mt-3 rounded-xl bg-surface3 px-3 py-2.5">
          <div className="text-[12.5px] font-semibold text-ink">
            {fmtEnergy(Math.abs(delta), unit)} trimmed from today
          </div>
          <div className="mt-0.5 text-[12px] text-ink2">
            {adjust?.reason || 'Carried over from a day that ran long. Balanced across the week, not punished.'}
          </div>
        </div>
      )}

      {target === floor && Math.round(base + delta) < floor && (
        <p className="mt-2 text-[12px] text-ink2">
          Held at {fmtEnergy(floor, unit)} — that&rsquo;s the floor, whatever the maths says.
        </p>
      )}

      <div className="mt-3 flex items-start gap-1.5 border-t border-line pt-3">
        <Info size={13} className="mt-[2px] shrink-0 text-ink3" />
        {adaptive ? (
          <p className="text-[11.5px] leading-relaxed text-ink3">
            Learned from your real weight trend over the last {adaptive.daysUsed} days — your body is
            burning about {fmtEnergy(adaptive.tdee, unit)} a day at an average intake of{' '}
            {fmtEnergy(adaptive.avgIntake, unit)}.
            {projected !== null && projected !== 0 && (
              <> At this target that&rsquo;s roughly {Math.abs(projected)} kg {projected < 0 ? 'down' : 'up'} a week.</>
            )}{' '}
            It&rsquo;s an estimate, and it updates every time you weigh in.
          </p>
        ) : (
          <p className="text-[11.5px] leading-relaxed text-ink3">
            Still learning. It needs about a week of logged food and two weigh-ins a week apart before
            it can read your real burn rate — until then this is your set target of{' '}
            {fmtEnergy(profile.calorieTarget, unit)}.
          </p>
        )}
      </div>
    </Card>
  )
}
