// Weekly view: 7-day kcal bars vs target, averages and adherence.
import { useMemo } from 'react'
import { Card } from '@/components/ui'
import { BarChart } from '@/components/charts'
import { fmtInt, dayjs } from '@/lib/fmt'
import type { DayAdjust, FoodLogEntry, Profile } from '@/db/types'
import { sumEntries, targetForDateWith } from './helpers'

export function WeekCard({ endDate, entries, profile, adjusts }: {
  endDate: string
  entries: FoodLogEntry[]
  profile: Profile
  adjusts?: Map<string, DayAdjust>
}) {
  const target = profile.calorieTarget

  const { bars, avg, loggedDays, onTargetDays, avgProtein } = useMemo(() => {
    const days: { date: string; label: string }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = dayjs(endDate).subtract(i, 'day')
      days.push({ date: d.format('YYYY-MM-DD'), label: d.format('dd') })
    }
    const perDay = days.map((d) => {
      const t = sumEntries(entries.filter((e) => e.date === d.date))
      return { ...d, kcal: Math.round(t.kcal), protein: t.protein, target: targetForDateWith(d.date, profile, adjusts) }
    })
    const logged = perDay.filter((d) => d.kcal > 0)
    const avgKcal = logged.length ? Math.round(logged.reduce((a, b) => a + b.kcal, 0) / logged.length) : 0
    const avgP = logged.length ? Math.round(logged.reduce((a, b) => a + b.protein, 0) / logged.length) : 0
    // each day against ITS target (carry-over days have a lower one)
    const onTarget = logged.filter((d) => d.kcal <= d.target * 1.05).length
    return {
      bars: perDay.map((d) => ({ label: d.label, value: d.kcal })),
      avg: avgKcal,
      loggedDays: logged.length,
      onTargetDays: onTarget,
      avgProtein: avgP,
    }
  }, [endDate, entries, target, profile, adjusts])

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-ink">Last 7 days</h3>
        <span className="text-[12px] text-ink3">target {fmtInt(target)} kcal</span>
      </div>
      {loggedDays === 0 ? (
        <div className="flex h-[130px] items-center justify-center text-[13px] text-ink3">
          Nothing logged this week yet — start with today.
        </div>
      ) : (
        <>
          <div className="mt-2">
            <BarChart bars={bars} height={150} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface3 px-2 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">Average</div>
              <div className={`text-[15px] font-bold ${avg <= target ? 'text-good' : 'text-warn'}`}>
                {fmtInt(avg)}
              </div>
              <div className="text-[11px] text-ink3">kcal/day</div>
            </div>
            <div className="rounded-xl bg-surface3 px-2 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">On target</div>
              <div className="text-[15px] font-bold text-ink">{onTargetDays}/{loggedDays}</div>
              <div className="text-[11px] text-ink3">logged days</div>
            </div>
            <div className="rounded-xl bg-surface3 px-2 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">Protein</div>
              <div className="text-[15px] font-bold text-ink">{avgProtein}g</div>
              <div className="text-[11px] text-ink3">avg/day</div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink2">
            {avg <= target
              ? 'Averaging under target — exactly how the week should look. Keep the streak rolling.'
              : `Averaging ${fmtInt(avg - target)} kcal over target. One lighter dinner or skipped snack per day closes that gap.`}
          </p>
        </>
      )}
    </Card>
  )
}
