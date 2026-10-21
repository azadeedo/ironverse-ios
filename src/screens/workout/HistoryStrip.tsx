// Horizontal strip of recent WorkoutLogs for the selected plan day.

import { CheckCircle2, CircleDashed, MapPin } from 'lucide-react'
import { dayjs, fmtDayShort, fmtDuration, fmtInt } from '@/lib/fmt'
import { workoutProfileName } from '@/db/defaults'
import type { WorkoutLog } from '@/db/types'

function logStats(log: WorkoutLog) {
  const sets = log.exercises.flatMap((e) => e.sets)
  const done = sets.filter((s) => s.done).length
  const durationSec = log.finishedAt
    ? Math.max(0, dayjs(log.finishedAt).diff(dayjs(log.startedAt), 'second'))
    : null
  return { done, total: sets.length, durationSec }
}

export function HistoryStrip({ logs }: { logs: WorkoutLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink3">
        No sessions logged for this day yet — the first one sets the bar.
      </div>
    )
  }
  return (
    <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
      {logs.map((log) => {
        const { done, total, durationSec } = logStats(log)
        const finished = !!log.finishedAt
        return (
          <div key={log.id} className="w-[150px] shrink-0 rounded-2xl bg-surface2 p-3 shadow-card">
            <div className="flex items-center gap-1.5">
              {finished
                ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                : <CircleDashed size={14} className="shrink-0 text-amber-500" />}
              <span className="truncate text-[12.5px] font-semibold text-ink">{fmtDayShort(log.date)}</span>
            </div>
            {log.weekIndex !== undefined && (
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink3">
                Week {log.weekIndex}
              </div>
            )}
            <div className="big-num mt-1.5 text-[17px] text-ink">
              {done}<span className="text-[12px] font-semibold text-ink3">/{total} sets</span>
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink2">
              {log.totalVolumeKg
                ? `${fmtInt(log.totalVolumeKg)} kg lifted`
                : durationSec
                  ? fmtDuration(durationSec)
                  : finished ? 'Completed' : 'In progress'}
            </div>
            {workoutProfileName(log) && (
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink3">
                <MapPin size={11} className="shrink-0 text-brand" />
                <span className="truncate">{workoutProfileName(log)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
