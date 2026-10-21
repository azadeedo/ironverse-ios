// The hero card: today's training day, resume, done summary, rest or no-plan.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ChevronRight, ClipboardList, Clock, Dumbbell, Flame, Moon, Play, Timer, Zap,
} from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { ProgressBar } from '@/components/ui'
import { db } from '@/db'
import { byId } from '@/data/exercises'
import { newId, nowIso } from '@/lib/id'
import { dayjs, fmtInt } from '@/lib/fmt'
import { nearestLoad } from '@/lib/plates'
import { useUI } from '@/lib/store'
import type { Plan, PlanExercise, Profile, WorkoutLog } from '@/db/types'
import type { DaySlot } from '@/lib/schedule'
import { makeWorkoutLog } from '@/screens/workout/helpers'
import { getCurrentProfile } from '@/lib/equipment'
import { fmt12, type TodayPlanDay } from './lib'

function loadLabel(pe: PlanExercise, profile: Profile): string | null {
  const ex = byId.get(pe.exerciseId)
  if (!ex) return null
  if (pe.timeSec) return `${pe.timeSec}s`
  if (pe.weightKg === undefined) return null
  const plan = nearestLoad(ex.loadMode, pe.weightKg, profile)
  return plan ? `${plan.totalKg % 1 === 0 ? plan.totalKg : plan.totalKg.toFixed(1)} kg` : null
}

export function WorkoutCard({ profile, plan, dayInfo, slot, todayLog, today }: {
  profile: Profile
  plan: Plan | undefined
  dayInfo: TodayPlanDay | null
  slot: DaySlot | null
  todayLog: WorkoutLog | undefined
  today: string
}) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const [starting, setStarting] = useState(false)

  async function startWorkout() {
    if (!plan || !dayInfo || starting) return
    // the 12-week program starts from its own screen: readiness check-in, prescribed loads, warm-ups
    if (plan.program === 'p12') { navigate('/program'); return }
    setStarting(true)
    try {
      // was: sets with no weights at all — now the same prefilled log the Workout tab builds
      const week = plan.weeks.find((w) => w.index === dayInfo.weekIndex) ?? plan.weeks[0]
      const eq = await getCurrentProfile().catch(() => null)
      const log: WorkoutLog = makeWorkoutLog(plan, week, dayInfo.day, { equipment: eq })
      void newId; void nowIso
      await db.workoutLogs.add(log)
      toast('Workout started — let’s go', 'success')
      navigate(`/session/${log.id}`)
    } finally {
      setStarting(false)
    }
  }

  // ----- unfinished log → resume -----
  if (todayLog && !todayLog.finishedAt) {
    const totalSets = todayLog.exercises.reduce((n, ex) => n + ex.sets.length, 0)
    const doneSets = todayLog.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0)
    return (
      <Card className="overflow-hidden border border-brand/25 bg-gradient-to-br from-brand/15 via-surface2 to-surface2 p-4">
        <div className="flex items-center gap-2">
          <Badge tone="amber">In progress</Badge>
          <span className="text-[12px] font-medium text-ink3">
            started {dayjs(todayLog.startedAt).format('h:mm a')}
          </span>
        </div>
        <h2 className="shout mt-2 text-[24px] leading-tight text-ink">{todayLog.title}</h2>
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold text-ink2">{doneSets} of {totalSets} sets done</span>
            <span className="big-num text-[13px] text-brand">
              {totalSets ? Math.round((doneSets / totalSets) * 100) : 0}%
            </span>
          </div>
          <ProgressBar pct={totalSets ? (doneSets / totalSets) * 100 : 0} />
        </div>
        <Button full className="mt-4" onClick={() => navigate(`/session/${todayLog.id}`)}>
          <Play size={18} fill="currentColor" /> Resume workout
        </Button>
      </Card>
    )
  }

  // ----- finished log → summary chip -----
  if (todayLog && todayLog.finishedAt) {
    const mins = Math.max(1, dayjs(todayLog.finishedAt).diff(dayjs(todayLog.startedAt), 'minute'))
    return (
      <Card className="p-4" onClick={() => navigate(`/session/${todayLog.id}`)}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-emerald-500">Workout complete</div>
            <div className="truncate text-[16px] font-bold text-ink">{todayLog.title}</div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-ink3" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="gray"><Timer size={12} className="mr-1" />{mins} min</Badge>
          {todayLog.totalVolumeKg !== undefined && todayLog.totalVolumeKg > 0 && (
            <Badge tone="gray"><Dumbbell size={12} className="mr-1" />{fmtInt(todayLog.totalVolumeKg)} kg volume</Badge>
          )}
          {todayLog.calories !== undefined && todayLog.calories > 0 && (
            <Badge tone="gray"><Flame size={12} className="mr-1" />{fmtInt(todayLog.calories)} kcal</Badge>
          )}
        </div>
        <p className="mt-2.5 text-[12.5px] text-ink2">Great work. Refuel, hydrate, and rest up.</p>
      </Card>
    )
  }

  // ----- no plan → CTA -----
  if (!plan) {
    return (
      <Card className="overflow-hidden border border-brand/25 bg-gradient-to-br from-brand/15 via-surface2 to-surface2 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
            <ClipboardList size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="shout text-[20px] leading-tight text-ink">No plan yet</h2>
            <p className="mt-0.5 text-[12.5px] text-ink2">Build a program around your rack, cables and bench.</p>
          </div>
        </div>
        <Button full className="mt-4" onClick={() => navigate('/plan')}>
          <Zap size={17} /> Build my plan
        </Button>
      </Card>
    )
  }

  // ----- rest day -----
  if (!dayInfo) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface3 text-ink2">
            <Moon size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="shout text-[20px] leading-tight text-ink">Rest day</h2>
            <p className="mt-0.5 text-[12.5px] text-ink2">Recovery is where the growth happens. Eat well, sleep well.</p>
          </div>
        </div>
        <Button variant="outline" full className="mt-4" onClick={() => navigate('/cardio?start=jump-rope')}>
          <Zap size={16} className="text-brand" /> Optional: easy jump rope
        </Button>
      </Card>
    )
  }

  // ----- training day → hero -----
  const { day } = dayInfo
  const preview = day.exercises.slice(0, 3)
  const more = day.exercises.length - preview.length
  return (
    <Card className="overflow-hidden border border-brand/25 bg-gradient-to-br from-brand/15 via-surface2 to-surface2 p-4">
      <div className="flex items-center gap-2">
        <Badge tone="brand">Week {dayInfo.weekIndex} · {dayInfo.weekLabel}</Badge>
        {slot && (
          <span className="text-[12px] font-semibold text-ink2">
            {slot.slotLabel} · {fmt12(slot.slot)}
          </span>
        )}
      </div>
      <h2 className="shout mt-2 text-[26px] leading-tight text-ink">{day.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-semibold text-ink2">
        <span className="inline-flex items-center gap-1"><Dumbbell size={14} className="text-brand" />{day.exercises.length} exercises</span>
        <span className="inline-flex items-center gap-1"><Clock size={14} className="text-brand" />~{day.estMinutes} min</span>
        <span className="inline-flex items-center gap-1"><Flame size={14} className="text-brand" />~{fmtInt(day.estCalories)} kcal</span>
      </div>

      {preview.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-surface/45 p-3">
          {preview.map((pe, i) => {
            const ex = byId.get(pe.exerciseId)
            const load = loadLabel(pe, profile)
            return (
              <div key={`${pe.exerciseId}-${i}`} className="flex items-center gap-2 text-[13px]">
                <span className="big-num w-4 shrink-0 text-center text-[11px] text-ink3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{ex?.name ?? pe.exerciseId}</span>
                <span className="shrink-0 tabular-nums text-[12px] font-semibold text-ink2">
                  {pe.sets}×{pe.reps[0]}–{pe.reps[1]}{load ? ` · ${load}` : ''}
                </span>
              </div>
            )
          })}
          {more > 0 && <div className="pl-6 text-[12px] font-medium text-ink3">+{more} more</div>}
        </div>
      )}

      <Button full className="mt-4" disabled={starting} onClick={() => void startWorkout()}>
        <Play size={18} fill="currentColor" /> Start workout
      </Button>
    </Card>
  )
}
