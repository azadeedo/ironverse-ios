// Weekly training streak (Hevy / Strava style): consecutive weeks where he hit his
// planned number of sessions. Only counts finished workouts.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { todayStr } from '@/lib/id'
import { weekStreak } from '@/lib/shareCard'

export function StreakCard({ target }: { target: number }) {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  if (!logs) return null
  const t = Math.max(1, target)
  const { weeks, thisWeek } = weekStreak(logs, t, todayStr())
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-surface2 px-4 py-3 shadow-card">
      <div className="text-[30px]">{weeks >= 4 ? '🔥' : weeks ? '⚡' : '🎯'}</div>
      <div className="min-w-0 flex-1">
        <b className="text-[15px]">{weeks ? `${weeks}-week streak` : 'Start a streak this week'}</b>
        <div className="text-[12px] text-ink3">{thisWeek} of {t} workouts this week{thisWeek >= t ? ' — week done ✓' : ` · ${t - thisWeek} to go to keep it alive`}</div>
      </div>
      <div className="flex gap-1">{Array.from({ length: t }, (_, i) => <i key={i} className={`h-2.5 w-2.5 rounded-full ${i < thisWeek ? 'bg-brand' : 'bg-surface3'}`} />)}</div>
    </div>
  )
}
