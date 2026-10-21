// Missed a program session? Do it on a day off (Sat / Sun / Mon) instead of losing it.
// Also shows the one-time notice after the program restart on 21 Oct 2026.
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { CalendarClock, RotateCcw } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { db, getSetting, setSetting } from '@/db'
import { freeDays, getProgramPlan, getSkips, missedSessions, moveMissed, skipProgramDay } from '@/lib/programStore'
import { todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'

export function MissedSessionCard() {
  const toast = useUI((s) => s.toast)
  const today = todayStr()
  const plan = useLiveQuery(() => getProgramPlan(), [])
  const logs = useLiveQuery(() => db.workoutLogs.where('date').aboveOrEqual(dayjs(today).subtract(8, 'day').format('YYYY-MM-DD')).toArray(), [today])
  const skips = useLiveQuery(async () => (plan ? getSkips(plan.id) : new Set<string>()), [plan?.id])
  const notice = useLiveQuery(() => getSetting<boolean>('p12:restartNoticeSeen', false), [])
  if (!plan || !logs || !skips) return null
  const start = plan.programStart ?? plan.startDate
  const missed = missedSessions(plan, logs, skips, today)
  const free = freeDays(plan, today)
  const showNotice = notice === false && start === '2026-10-20'
  if (!missed.length && !showNotice) return null
  const end = dayjs(start).add(11, 'week').add(3, 'day')
  return (
    <Card className="p-4">
      {showNotice && (
        <div className="mb-3 rounded-xl bg-brand/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink"><RotateCcw size={15} className="text-brand" /> Program restarted from week 1</div>
          <p className="mt-1 text-[12.5px] text-ink2">Week 1 is {dayjs(start).format('ddd D MMM')} – {dayjs(start).add(3, 'day').format('ddd D MMM')}. Week 12 finishes {end.format('ddd D MMM YYYY')}. Your old workouts are still in History.</p>
          <Button small variant="ghost" className="mt-1" onClick={() => void setSetting('p12:restartNoticeSeen', true)}>Got it</Button>
        </div>
      )}
      {missed.map((m) => (
        <div key={m.date} className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 last:mb-0">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink"><CalendarClock size={15} className="text-amber-500" /> You missed {dayjs(m.date).format('dddd D MMM')}</div>
          <p className="mt-0.5 text-[12.5px] text-ink2">Week {m.week} · {m.title}. Do it on one of your days off instead:</p>
          {free.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {free.map((d) => (
                <Button key={d} small variant="secondary" onClick={() => void moveMissed(plan, m.date, d).then(() => toast(`${m.title} moved to ${dayjs(d).format('dddd D MMM')}`))}>
                  {d === today ? 'Today' : dayjs(d).format('ddd D MMM')}
                </Button>
              ))}
            </div>
          ) : <p className="mt-1 text-[12px] text-ink3">No free day left this week — do it as soon as you can, or skip it.</p>}
          <button type="button" className="pressable mt-2 text-[12px] font-semibold text-ink3" onClick={() => void skipProgramDay(plan, m.week, m.day, m.date).then(() => toast('Marked as skipped'))}>Skip it instead</button>
        </div>
      ))}
    </Card>
  )
}
