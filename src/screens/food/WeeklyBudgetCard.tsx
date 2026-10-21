// ============================================================
// WEEKLY CALORIE BUDGET — the week as one pot of calories.
// 7 x target, what's gone, what's left. This is the frame that matters:
// a heavy Friday is a Friday problem only if the week doesn't absorb it.
// ============================================================
import { useMemo } from 'react'
import { Wallet } from 'lucide-react'
import { Card, ProgressBar } from '@/components/ui'
import type { DayAdjust, FoodLogEntry, Profile } from '@/db/types'
import { energyUnit } from '@/db/defaults'
import { fmtEnergy, fmtEnergyShort } from '@/lib/energy'
import { dayjs } from '@/lib/fmt'
import { sumEntries, targetForDateWith } from './helpers'

export function WeeklyBudgetCard({ endDate, entries, profile, adjusts }: {
  /** last day of the 7-day window (usually the day being viewed) */
  endDate: string
  entries: FoodLogEntry[]
  profile: Profile
  adjusts: Map<string, DayAdjust> | undefined
}) {
  const unit = energyUnit(profile)

  const { budget, used, remaining, daysLeft, perDayLeft, days } = useMemo(() => {
    // the Mon-Sun week containing endDate, so "days left" actually means something
    const anchor = dayjs(endDate)
    const monday = anchor.subtract((anchor.day() + 6) % 7, 'day')
    const list: { date: string; label: string; target: number; kcal: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = monday.add(i, 'day')
      const date = d.format('YYYY-MM-DD')
      list.push({
        date,
        label: d.format('ddd'),
        target: targetForDateWith(date, profile, adjusts),
        kcal: Math.round(sumEntries(entries.filter((e) => e.date === date)).kcal),
      })
    }
    const total = list.reduce((a, b) => a + b.target, 0)
    const spent = list.reduce((a, b) => a + b.kcal, 0)
    const idx = list.findIndex((d) => d.date === endDate)
    const left = idx < 0 ? 0 : list.length - idx // the viewed day counts as still open
    const rem = total - spent
    return {
      budget: total,
      used: spent,
      remaining: rem,
      daysLeft: left,
      perDayLeft: left > 0 ? Math.round(rem / left) : rem,
      days: list,
    }
  }, [endDate, entries, profile, adjusts])

  const pct = budget > 0 ? (used / budget) * 100 : 0
  const over = remaining < 0

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-brand" />
        <h3 className="text-[15px] font-semibold text-ink">Weekly budget</h3>
        <span className="ml-auto text-[12px] text-ink3">7 days</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface3 px-2 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">Budget</div>
          <div className="text-[14.5px] font-bold text-ink">{fmtEnergyShort(budget, unit)}</div>
          <div className="text-[11px] text-ink3">for the week</div>
        </div>
        <div className="rounded-xl bg-surface3 px-2 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">Used</div>
          <div className="text-[14.5px] font-bold text-ink">{fmtEnergyShort(used, unit)}</div>
          <div className="text-[11px] text-ink3">{Math.round(pct)}% of it</div>
        </div>
        <div className="rounded-xl bg-surface3 px-2 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">
            {over ? 'Over' : 'Left'}
          </div>
          <div className={`text-[14.5px] font-bold ${over ? 'text-warn' : 'text-good'}`}>
            {fmtEnergyShort(Math.abs(remaining), unit)}
          </div>
          <div className="text-[11px] text-ink3">{over ? 'past budget' : 'still yours'}</div>
        </div>
      </div>

      <ProgressBar className="mt-3" pct={pct} />

      <div className="mt-3 space-y-1">
        {days.map((d) => {
          const dOver = d.kcal > d.target
          return (
            <div key={d.date} className="flex items-baseline justify-between text-[12.5px]">
              <span className={d.date === endDate ? 'font-semibold text-ink' : 'text-ink2'}>
                {d.label}
              </span>
              <span className="text-ink3">
                <span className={dOver ? 'font-semibold text-warn' : 'font-semibold text-ink'}>
                  {d.kcal > 0 ? fmtEnergyShort(d.kcal, unit) : '—'}
                </span>{' '}
                / {fmtEnergyShort(d.target, unit)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink2">
        {over
          ? `The week is ${fmtEnergy(Math.abs(remaining), unit)} past its budget. Nothing is ruined — pull the next few days back toward target and the average still lands where you want it.`
          : `${fmtEnergy(Math.abs(remaining), unit)} left across ${daysLeft} day${daysLeft === 1 ? '' : 's'} — about ${fmtEnergy(Math.abs(perDayLeft), unit)} a day. The week is what moves the scale, not any single dinner.`}
      </p>
    </Card>
  )
}
