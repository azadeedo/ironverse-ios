// ============================================================
// OVER BUDGET — shown when the day has gone past its target.
// Three honest options, no guilt: take it off the next few days, burn it off,
// or leave it. One bad day inside a good week genuinely doesn't matter.
// ============================================================
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { CalendarMinus, Flame, Footprints, Undo2 } from 'lucide-react'
import { Badge, Button, Card, Segmented } from '@/components/ui'
import { db } from '@/db'
import type { CardioLog, DayAdjust, Profile } from '@/db/types'
import { energyUnit } from '@/db/defaults'
import { fmtEnergy } from '@/lib/energy'
import { metCalories } from '@/lib/nutrition'
import { fmtDayShort } from '@/lib/fmt'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'
import { planCarryOver, targetFloor } from './helpers'
import { ACTIVITIES } from '@/lib/goalCoach'

type Tab = 'tomorrow' | 'burn' | 'leave'

/** Cardio he can actually do, with the MET value used for the estimate. */
const BURN_OPTIONS = ACTIVITIES

export function OverBudgetCard({
  date, profile, eaten, target, adjusts,
}: {
  date: string
  profile: Profile
  eaten: number
  /** today's target, already including any carry-over */
  target: number
  adjusts: Map<string, DayAdjust> | undefined
}) {
  const toast = useUI((s) => s.toast)
  const [tab, setTab] = useState<Tab>('leave')
  const [busy, setBusy] = useState(false)

  const unit = energyUnit(profile)
  const over = Math.round(eaten - target)
  // exercise already done today (not planned) counts toward burning it back
  const doneBurn = useLiveQuery(async () => (await db.cardioLog.where('date').equals(date).toArray()).filter((c) => !String(c.note ?? '').startsWith('Planned')).reduce((n, c) => n + (c.calories ?? 0), 0), [date]) ?? 0
  const toBurn = Math.max(0, over - doneBurn)
  const evening = new Date().getHours() >= 20

  // rows this day already pushed onto later days
  const mine = useMemo(
    () => [...(adjusts?.values() ?? [])].filter((a) => a.sourceDate === date),
    [adjusts, date],
  )
  const plan = useMemo(
    () => planCarryOver(over, date, profile, adjusts),
    [over, date, profile, adjusts],
  )
  const planned = plan.reduce((a, p) => a + Math.abs(p.deltaKcal), 0)

  if (over <= 0) return null

  const takeItOff = async () => {
    if (plan.length === 0) return
    setBusy(true)
    try {
      const rows: DayAdjust[] = plan.map((p) => {
        const existing = adjusts?.get(p.date)
        return {
          date: p.date,
          deltaKcal: Math.round((existing?.deltaKcal ?? 0) + p.deltaKcal),
          reason: `Carried over from ${fmtDayShort(date)}`,
          sourceDate: date,
          createdAt: nowIso(),
        }
      })
      await db.dayAdjust.bulkPut(rows)
      toast(
        rows.length === 1
          ? `Taken off ${fmtDayShort(rows[0].date)}`
          : `Spread over the next ${rows.length} days`,
      )
    } finally {
      setBusy(false)
    }
  }

  const undoTakeOff = async () => {
    setBusy(true)
    try {
      await db.dayAdjust.bulkDelete(mine.map((m) => m.date))
      toast('Carry-over undone — targets back to normal', 'info')
    } finally {
      setBusy(false)
    }
  }

  const burns = BURN_OPTIONS.map((o) => {
    const perMin = metCalories(o.met, profile.weightKg, 60)
    const minutes = perMin > 0 ? Math.round(toBurn / perMin) : 0
    return { ...o, minutes, perMin }
  }).filter((o) => o.minutes > 0)
  // IV-06: never suggest marathon "punishment" cardio — cap the idea at 45 min
  const tooLong = burns.length > 0 && burns.every((o) => o.minutes > 45)

  const addPlannedCardio = async (kind: CardioLog['kind'], minutes: number, label: string) => {
    setBusy(true)
    try {
      await db.cardioLog.add({
        id: newId(),
        date,
        kind,
        seconds: minutes * 60,
        calories: over,
        note: `Planned — burn off ${Math.round(over)}`,
        createdAt: nowIso(),
      })
      toast(`${label} added to today as a plan`)
    } finally {
      setBusy(false)
    }
  }

  /** spread a long burn over several days as planned cardio (today, tomorrow, …) */
  const addSplitCardio = async (kind: CardioLog['kind'], minutes: number, days: number, label: string) => {
    setBusy(true)
    try {
      for (let i = 0; i < days; i++) {
        await db.cardioLog.add({
          id: newId(),
          date: dayjs(date).add(i, 'day').format('YYYY-MM-DD'),
          kind,
          seconds: minutes * 60,
          calories: Math.round(over / days),
          note: `Planned — burn back ${Math.round(over / days)} (${i + 1}/${days})`,
          createdAt: nowIso(),
        })
      }
      toast(`${label}: ${minutes} min a day for ${days} days added as a plan`)
    } finally {
      setBusy(false)
    }
  }

  const floor = targetFloor(profile)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-warn" />
        <h3 className="shout text-[15px] text-ink">Above today’s target</h3>
        {evening && <Badge tone="amber" className="ml-auto">tonight</Badge>}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="big-num text-[32px] leading-none text-warn">
          {Math.abs(over).toLocaleString('en-AU')}
        </span>
        <span className="text-[13.5px] text-ink2">
          {unit === 'kj' ? 'kJ' : 'cal'} over
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-ink3">
        You&rsquo;re {fmtEnergy(over, unit)} over. {fmtEnergy(eaten, unit)} eaten against a{' '}
        {fmtEnergy(target, unit)} target.
      </p>

      {mine.length > 0 && (
        <div className="mt-3 rounded-xl bg-surface3 px-3 py-2.5">
          <p className="text-[12.5px] text-ink2">
            Already taken off{' '}
            {mine
              .map((m) => `${fmtDayShort(m.date)} (${fmtEnergy(Math.abs(m.deltaKcal), unit)})`)
              .join(', ')}
            .
          </p>
          <Button small variant="secondary" className="mt-2" disabled={busy} onClick={() => { void undoTakeOff() }}>
            <Undo2 size={14} /> Undo that
          </Button>
        </div>
      )}

      <Segmented
        className="mt-3"
        options={[
          { value: 'leave', label: 'Leave it' },
          { value: 'tomorrow', label: 'Spread it' },
          { value: 'burn', label: 'Burn it back' },
        ]}
        value={tab}
        onChange={(v) => setTab(v)}
      />

      {tab === 'tomorrow' && (
        <div className="mt-3">
          {plan.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-ink2">
              There&rsquo;s no room left to take it off — the next few days are already
              carrying as much as they safely can. Nothing drops below{' '}
              {fmtEnergy(floor, unit)} a day.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                {plan.map((p) => (
                  <div key={p.date} className="flex items-baseline justify-between text-[13px]">
                    <span className="text-ink2">{fmtDayShort(p.date)}</span>
                    <span className="font-semibold text-ink">
                      &minus;{fmtEnergy(Math.abs(p.deltaKcal), unit)} &rarr;{' '}
                      {fmtEnergy(profile.calorieTarget + (adjusts?.get(p.date)?.deltaKcal ?? 0) + p.deltaKcal, unit)}
                    </span>
                  </div>
                ))}
              </div>
              {planned < over && (
                <p className="mt-2 text-[12px] text-ink3">
                  Only {fmtEnergy(planned, unit)} of it fits without dropping a day below{' '}
                  {fmtEnergy(floor, unit)}. The rest just goes.
                </p>
              )}
              <Button full className="mt-3" disabled={busy} onClick={() => { void takeItOff() }}>
                <CalendarMinus size={16} /> Take it off{' '}
                {plan.length === 1 ? fmtDayShort(plan[0].date) : `the next ${plan.length} days`}
              </Button>
              <p className="mt-2 text-[11.5px] text-ink3">
                Reversible — the undo button puts every day straight back.
              </p>
            </>
          )}
        </div>
      )}

      {tab === 'burn' && (
        <div className="mt-3">
          <p className="text-[12.5px] text-ink3">
            Optional. Movement is good for you — it isn’t a punishment for eating. Worked out at your current {profile.weightKg} kg.
          </p>
          {doneBurn > 0 && <p className="mt-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[12.5px] text-ink2">{toBurn === 0 ? `✓ Your exercise today (${doneBurn} kcal) already covers it.` : `Your exercise today (${doneBurn} kcal) already covers part of it — ${toBurn} kcal left.`}</p>}
          {tooLong && <p className="mt-1.5 rounded-lg bg-surface3 px-2.5 py-2 text-[12.5px] text-ink2">It’s a big one — you can still burn it back. Splitting it over 2–3 days is easier on recovery than one very long session.</p>}
          <div className="mt-2 space-y-2">
            {burns.map((o) => (
              <div key={o.key} className="rounded-xl bg-surface3 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">{o.label}{o.together ? ' 👫' : ''} <span className="text-[11px] font-normal text-ink3">{o.where === 'gym' ? 'gym' : o.where === 'home' ? 'at home' : 'outside'}</span></span>
                  <span className="text-[13.5px] font-bold text-brand">{o.minutes} min</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11.5px] text-ink3">{o.detail}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const kind: CardioLog['kind'] =
                        o.kind
                      void addPlannedCardio(kind, o.minutes, o.label)
                    }}
                    className="pressable shrink-0 rounded-lg bg-surface2 px-2.5 py-1.5 text-[12px] font-semibold text-brand"
                  >
                    Add to today
                  </button>
                  {o.minutes > 45 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const kind: CardioLog['kind'] =
                          o.kind
                        const days = o.minutes > 90 ? 3 : 2
                        void addSplitCardio(kind, Math.ceil(o.minutes / days), days, o.label)
                      }}
                      className="pressable shrink-0 rounded-lg bg-surface2 px-2.5 py-1.5 text-[12px] font-semibold text-brand"
                    >
                      Split over {o.minutes > 90 ? 3 : 2} days
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink3">
            <Footprints size={13} className="mt-0.5 shrink-0" />
            Estimates from MET values and your bodyweight — close enough to plan with, not a
            measurement.
          </p>
        </div>
      )}

      {tab === 'leave' && (
        <div className="mt-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            Leave it. One heavy day inside a good week changes nothing — the week is what
            moves the scale, not the day. Log it honestly, eat normally tomorrow, and it
            disappears into the average.
          </p>
          <p className="mt-2 text-[12.5px] text-ink3">
            Nothing to tap. Don’t skip meals or train extra to “make up” for it — that tends to backfire.
          </p>
        </div>
      )}
    </Card>
  )
}
