// Workout -> weekly volume planner.
//
// What the SELECTED week of the plan is actually set to deliver per muscle,
// with the productive band drawn behind each bar, next to what he has already
// completed this week. plannedWeeklyVolume() does the counting; this file only
// draws it, and it is careful to say the landmarks are rules of thumb.

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '@/db'
import type { Plan } from '@/db/types'
import { Badge, Card, Spinner } from '@/components/ui'
import { dayjs } from '@/lib/fmt'
import { weekStartStr } from '@/lib/training'
import {
  BAND_LABELS, BAND_TONE, VOLUME_DISCLAIMER, VOLUME_LANDMARKS, plannedWeeklyVolume,
  type PlannedMuscleVolume,
} from '@/lib/volume'
import { currentWeekIndex } from './helpers'

const PREVIEW = 6

function MuscleBar({ row, max }: { row: PlannedMuscleVolume; max: number }) {
  const scale = Math.max(1, max)
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`
  const [lo, hi] = VOLUME_LANDMARKS.productive
  const bandLeft = Math.min(100, (lo / scale) * 100)
  const bandWidth = Math.max(0, Math.min(100, (hi / scale) * 100) - bandLeft)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-ink">{row.label}</span>
        <span className="shrink-0 text-[12px] tabular-nums text-ink3">
          <span className="font-semibold text-ink">{row.planned}</span> planned / {row.done} done
        </span>
      </div>

      {/* planned bar, with the productive band drawn behind it */}
      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface3">
        <div
          className="absolute inset-y-0 bg-emerald-500/20"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-300"
          style={{ width: pct(row.planned) }}
        />
      </div>

      {/* completed so far */}
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface3">
        <div
          className="h-full rounded-full bg-ink3/60 transition-[width] duration-300"
          style={{ width: pct(row.done) }}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone={BAND_TONE[row.band]}>{BAND_LABELS[row.band]}</Badge>
        <span className="text-[11.5px] text-ink3">{row.note}</span>
      </div>
    </div>
  )
}

export function VolumePlannerCard({ plan, weekIndex }: {
  plan: Plan | null | undefined
  weekIndex: number
}) {
  const [expanded, setExpanded] = useState(false)
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])

  const weekStart = weekStartStr()
  const summary = useMemo(() => {
    if (!plan || !logs) return null
    try {
      return plannedWeeklyVolume(plan, weekIndex, { logs, weekStart })
    } catch {
      return null
    }
  }, [plan, logs, weekIndex, weekStart])

  const thisPlanWeek = plan ? currentWeekIndex(plan) : 0
  const viewingCurrentWeek = thisPlanWeek === weekIndex

  if (logs === undefined || (plan && summary === null)) {
    return (
      <Card className="p-4">
        <div className="flex justify-center py-6"><Spinner /></div>
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card className="p-4">
        <p className="text-[13px] leading-relaxed text-ink2">
          The planner reads planned sets from your active plan. Build a plan and this fills in
          straight away - nothing here is guessed.
        </p>
      </Card>
    )
  }

  const rows = summary?.byMuscle ?? []
  const planned = summary?.totalPlannedSets ?? 0

  if (rows.length === 0 || planned === 0) {
    return (
      <Card className="p-4">
        <p className="text-[13px] leading-relaxed text-ink2">
          Week {weekIndex} has no sets prescribed against a muscle group yet, so there is nothing
          honest to chart. Add exercises to this week and the planned volume shows up here.
        </p>
      </Card>
    )
  }

  const shown = expanded ? rows : rows.slice(0, PREVIEW)
  const inRange = rows.filter((r) => r.band === 'productive').length

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4">
        <div className="text-[12.5px] leading-relaxed text-ink2">
          Week {weekIndex}{summary?.label ? ` (${summary.label})` : ''} has {planned} sets planned
          across {summary?.days ?? 0} day{(summary?.days ?? 0) === 1 ? '' : 's'}.
          {' '}{inRange} of {rows.length} muscle{rows.length === 1 ? '' : 's'} land inside the
          productive band.
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" /> Planned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink3/60" /> Done so far
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-emerald-500/25" />
            {VOLUME_LANDMARKS.productive[0]}-{VOLUME_LANDMARKS.productive[1]} sets
          </span>
        </div>

        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink3">
          {viewingCurrentWeek
            ? `"Done so far" counts your hard sets from the week beginning ${dayjs(weekStart).format('D MMM')}.`
            : `You are looking at week ${weekIndex}. "Done so far" still counts the current week beginning ${dayjs(weekStart).format('D MMM')}, so the two only line up on week ${thisPlanWeek}.`}
        </p>
      </div>

      <div className="mt-3.5 space-y-3.5 px-4 pb-3">
        {shown.map((row) => (
          <MuscleBar key={row.muscle} row={row} max={summary?.maxPlanned ?? 20} />
        ))}
      </div>

      {rows.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="pressable flex min-h-[46px] w-full items-center justify-center gap-1.5 border-t border-line text-[13px] font-bold text-brand"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expanded ? 'Show fewer' : `Show all ${rows.length} muscles`}
        </button>
      )}

      <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink3">
        {VOLUME_DISCLAIMER}
      </p>
    </Card>
  )
}

export default VolumePlannerCard
