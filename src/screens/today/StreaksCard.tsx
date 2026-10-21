// STREAKS — water, creatine and training, side by side.
// A gap is a gap, not a failure. Nothing here scolds and nothing resets to
// zero with a red flash: the number just tells the truth about the run he's on.

import { useLiveQuery } from 'dexie-react-hooks'
import { Droplets, Dumbbell, Flame, Pill } from 'lucide-react'
import { Card } from '@/components/ui'
import { db } from '@/db'
import { dayjs } from '@/lib/fmt'
import type { Plan, Profile } from '@/db/types'
import { streakOf, type StreakInfo } from './lib'

interface StreakView {
  key: string
  label: string
  icon: typeof Droplets
  tone: string
  info: StreakInfo
  sub: string
}

function subFor(info: StreakInfo, doneToday: string, openToday: string): string {
  if (info.days === 0) return info.todayDone ? doneToday : openToday
  if (info.todayDone) return `${info.days} ${info.days === 1 ? 'day' : 'days'} running`
  return 'Today’s still open'
}

export function StreaksCard({ profile, plan, today }: {
  profile: Profile
  plan: Plan | undefined
  today: string
}) {
  const trainingWeekdays = plan?.trainingWeekdays ?? []

  const streaks = useLiveQuery(async () => {
    const [water, creatine, workouts, cardio] = await Promise.all([
      db.waterLog.toArray(),
      db.creatineLog.toArray(),
      db.workoutLogs.toArray(),
      db.cardioLog.toArray(),
    ])

    const perDay = new Map<string, number>()
    for (const w of water) perDay.set(w.date, (perDay.get(w.date) ?? 0) + w.ml)
    const waterDays = new Set(
      [...perDay.entries()]
        .filter(([, ml]) => profile.waterTargetMl > 0 && ml >= profile.waterTargetMl)
        .map(([d]) => d),
    )

    const creatineDays = new Set(creatine.filter((c) => c.taken).map((c) => c.date))

    // A training day only counts when something was actually logged; rest days
    // are skipped entirely so they never break the run.
    const trainedDays = new Set<string>([
      ...workouts.filter((w) => w.exercises.some((e) => e.sets.some((s) => s.done))).map((w) => w.date),
      ...cardio.map((c) => c.date),
    ])
    const isRestDay = (date: string) =>
      trainingWeekdays.length > 0 && !trainingWeekdays.includes(dayjs(date).day())

    return {
      water: streakOf(waterDays, today),
      creatine: streakOf(creatineDays, today),
      training: streakOf(trainedDays, today, isRestDay),
    }
  }, [today, profile.waterTargetMl, trainingWeekdays.join(',')])

  if (!streaks) return null

  const views: StreakView[] = [
    {
      key: 'water',
      label: 'Water',
      icon: Droplets,
      tone: 'text-sky-400',
      info: streaks.water,
      sub: subFor(streaks.water, 'Target hit today', 'Target not hit yet'),
    },
    {
      key: 'creatine',
      label: 'Creatine',
      icon: Pill,
      tone: 'text-emerald-400',
      info: streaks.creatine,
      sub: subFor(streaks.creatine, 'Taken today', 'Not taken yet'),
    },
    {
      key: 'training',
      label: 'Training',
      icon: Dumbbell,
      tone: 'text-brand',
      info: streaks.training,
      sub: subFor(streaks.training, 'Logged today', 'Nothing logged yet'),
    },
  ]

  const best = Math.max(...views.map((v) => v.info.days))

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <Flame size={15} className="text-brand" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">Streaks</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {views.map((v) => {
          const Icon = v.icon
          const live = v.info.days > 0
          return (
            <div
              key={v.key}
              className={`rounded-xl px-2.5 py-3 text-center ${live ? 'bg-surface3' : 'bg-surface3/50'}`}
            >
              <Icon size={16} className={`mx-auto ${live ? v.tone : 'text-ink3'}`} />
              <div className={`big-num mt-1.5 text-[24px] leading-none ${live ? 'text-ink' : 'text-ink3'}`}>
                {v.info.days}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-ink2">{v.label}</div>
              <div className="mt-0.5 text-[10.5px] leading-tight text-ink3">{v.sub}</div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink3">
        {best === 0
          ? 'Nothing running right now. One logged day starts all three again — no ground lost.'
          : 'Rest days never break the training run, and a missed day is a gap, not a failure. Pick it back up tomorrow.'}
      </p>
    </Card>
  )
}
