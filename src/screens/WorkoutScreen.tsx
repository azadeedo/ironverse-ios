// /workout — plan browser: week/day tabs over the active plan, exercise rows
// with live mini animations, plate-perfect load labels, swap + start actions.
//
// The "Training at" switch is a LENS over the saved plan: switching re-derives
// the displayed session through the substitution engine and re-snaps every load
// onto that location's hardware. The plan itself is never rewritten.

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeftRight, Calculator, CalendarDays, ChevronRight, Clock, Dumbbell, Flame, Play,
  RotateCcw, Settings2, Sparkles, Trophy,
} from 'lucide-react'
import { db, getActivePlan, getProfile } from '@/db'
import { byId } from '@/data/exercises'
import { ExerciseAnim } from '@/anim/rig'
import { MuscleMap } from '@/anim/MuscleMap'
import { Badge, Button, Card, IconButton, Section, Spinner } from '@/components/ui'
import { useUI } from '@/lib/store'
import { todayStr } from '@/lib/id'
import { programDayOn, programWeekFor } from '@/lib/program12'
import { TodayTop } from './workout/TodayTop'
import { MEDIA } from '@/data/media'
import {
  HOME_PROFILE_ID, ensureEquipmentProfiles, localiseSession, setCurrentProfile,
} from '@/lib/equipment'
import { effectiveLoadMode, isRampable } from '@/lib/plates'
import { MUSCLE_LABELS, type Exercise, type Muscle, type PlanExercise } from '@/db/types'
import {
  clamp, currentWeekIndex, defaultDayIndex, loadLabel, makeWorkoutLog, repsLabel,
  resnapToProfile, swapExerciseInPlan,
} from './workout/helpers'
import { SwapSheet } from './workout/SwapSheet'
import { HistoryStrip } from './workout/HistoryStrip'
import { LocationSwitch } from './workout/LocationSwitch'
import {
  AdaptSummaryCard, AdaptSummarySheet, adaptChangeCount, adaptUpgradeCount,
} from './workout/AdaptSummary'
import { WarmupSheet, type WarmupTarget } from './workout/WarmupSheet'
import { NextTargetsCard } from './workout/NextTargets'
import { VolumePlannerCard } from './workout/VolumePlanner'
import { TrainingNotices } from './workout/TrainingNotices'

export default function WorkoutScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const [params, setParams] = useSearchParams()
  const [swapTarget, setSwapTarget] = useState<PlanExercise | null>(null)
  const [warmupTarget, setWarmupTarget] = useState<WarmupTarget | null>(null)
  const [starting, setStarting] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const profile = useLiveQuery(() => getProfile(), [])
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null, [])
  const eqProfiles = useLiveQuery(() => ensureEquipmentProfiles(), [])

  // --- selection (honours ?week=&day=, defaults to "where you are" in the plan)
  const weekParam = Math.trunc(Number(params.get('week')))
  const dayParam = Math.trunc(Number(params.get('day')))
  const weekIdx = plan
    ? clamp(Number.isFinite(weekParam) && weekParam > 0 ? weekParam : plan.program === 'p12' ? (programDayOn(plan, todayStr())?.week ?? programWeekFor(plan, todayStr()).week) : currentWeekIndex(plan), 1, plan.weeks.length)
    : 1
  const week = plan?.weeks[weekIdx - 1]
  const dayIdx = plan && week
    ? clamp(Number.isFinite(dayParam) && dayParam > 0 ? dayParam : plan.program === 'p12' ? programDayIndex(plan) : defaultDayIndex(plan, week), 1, week.days.length)
    : 1
  const day = week?.days[dayIdx - 1]

  const select = (w: number, d: number) => {
    setParams({ week: String(w), day: String(d) }, { replace: true })
  }

  // --- where he's training right now
  // the 12-week program is a Flex 24/7 program: its loads always use the gym profile
  // 23 Oct 2026 (owner): gym and home must train differently, so the program follows the chosen location too
  const currentEqId = profile?.equipmentProfileId ?? (plan?.program === 'p12' ? plan.equipmentProfileId ?? 'flex' : HOME_PROFILE_ID)
  const currentEq = eqProfiles
    ? eqProfiles.find((p) => p.id === currentEqId) ?? eqProfiles[0] ?? null
    : null

  // --- the session as it runs AT THIS LOCATION (derived, never persisted)
  // localiseSession asks "what is the best way to train this pattern with the
  // kit in THIS room", so the gym's machines actually get used instead of the
  // session looking identical everywhere.
  // The 12-week program's exercises are fixed by design — never "upgraded" by location.
  const isProgram = plan?.program === 'p12'
  const adapt = useMemo(
    // programs: only what this room can't do is swapped (never "upgraded")
    () => (day && currentEq ? localiseSession(day.exercises, currentEq, { upgrade: !isProgram }) : null),
    [day, currentEq, isProgram],
  )
  const bodyweight = profile?.weightKg ?? 80
  const shown = useMemo(
    () => (adapt && currentEq ? resnapToProfile(adapt.exercises, currentEq, bodyweight) : []),
    [adapt, currentEq, bodyweight],
  )

  /** the lifts in the session as it will actually run at this location */
  const sessionExerciseIds = useMemo(() => shown.map((pe) => pe.exerciseId), [shown])

  // --- history for this day slot (same title across all weeks of this plan)
  const dayTitle = day?.title
  const planId = plan?.id
  const historyLogs = useLiveQuery(async () => {
    if (!planId || !dayTitle) return []
    const logs = await db.workoutLogs.where('planId').equals(planId).toArray()
    return logs
      .filter((l) => l.title === dayTitle)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 8)
  }, [planId, dayTitle])

  const todayOpenLog = historyLogs?.find((l) => l.date === todayStr() && !l.finishedAt)

  const summaryKey = `${currentEq?.id ?? '-'}:${day?.id ?? '-'}`
  const changeCount = adaptChangeCount(adapt)
  const upgradeCount = adaptUpgradeCount(adapt)
  /** Which rows are an upgrade rather than a fallback, keyed by the new exercise name. */
  const upgradedNames = useMemo(
    () => new Set((adapt?.swaps ?? []).filter((s) => s.direction === 'upgrade').map((s) => s.to)),
    [adapt],
  )

  async function switchLocation(id: string) {
    if (switching || id === currentEqId) return
    setSwitching(true)
    try {
      await setCurrentProfile(id)
      setDismissedKey(null)
      const next = eqProfiles?.find((p) => p.id === id)
      toast(next ? `Training at ${next.name}` : 'Location changed')
    } finally {
      setSwitching(false)
    }
  }

  async function startWorkout() {
    if (!plan || !week || !day || starting) return
    if (plan.program === 'p12' && !todayOpenLog) { navigate(`/program/day/${week.index}/${['tue', 'wed', 'thu', 'fri'][dayIdx - 1] ?? 'tue'}`); return }
    if (todayOpenLog) {
      navigate(`/session/${todayOpenLog.id}`)
      return
    }
    setStarting(true)
    try {
      const log = makeWorkoutLog(plan, week, day, {
        exercises: shown.length ? shown : day.exercises,
        equipment: currentEq,
      })
      await db.workoutLogs.add(log)
      toast(
        currentEq
          ? `${day.title} at ${currentEq.name} — give it everything`
          : `${day.title} started — give it everything`,
      )
      navigate(`/session/${log.id}`)
    } finally {
      setStarting(false)
    }
  }

  async function handleSwap(next: Exercise) {
    if (!plan || !profile || !swapTarget) return
    // swapTarget may be an adapted entry; the SAVED plan still holds the original
    const originalId = swapTarget.swappedFrom ?? swapTarget.exerciseId
    const updated = swapExerciseInPlan(plan, dayIdx - 1, originalId, next, profile)
    await db.plans.put(updated)
    setSwapTarget(null)
    toast(`Swapped in ${next.name}`)
  }

  // --- loading
  if (profile === undefined || plan === undefined) {
    return (
      <div className="flex h-[70svh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // secondary muscles fed by the day's exercises (beyond the stated focus)
  const secondaryMuscles: Muscle[] = day
    ? [...new Set(shown.flatMap((pe) => byId.get(pe.exerciseId)?.secondary ?? []))]
        .filter((m) => !day.focus.includes(m))
    : []

  return (
    <div className="pb-4">
      {/* header: MY PLAN shout + plan name */}
      <div className="sticky top-0 z-30 bg-surface/85 pt-safe backdrop-blur-xl">
        <div className="flex items-end justify-between gap-2 px-4 pb-2.5 pt-4">
          <div className="min-w-0">
            <div className="shout text-[13px] text-brand">My Plan</div>
            <h1 className="mt-0.5 truncate text-[26px] font-bold leading-tight tracking-tight">
              {plan ? plan.name : 'Workout'}
            </h1>
          </div>
          <IconButton label="Plan settings" onClick={() => navigate('/plan')}>
            <Settings2 size={19} />
          </IconButton>
        </div>
      </div>

      {/* today's exercises FIRST — no scrolling to see what you're doing */}
      {plan?.program === 'p12' && week && day && (() => {
        const dk = (['tue', 'wed', 'thu', 'fri'] as const)[dayIdx - 1] ?? 'tue'
        const on = programDayOn(plan, todayStr())
        const isToday = !!on && dk === on.dk && weekIdx === on.week
        return <TodayTop plan={plan} week={weekIdx} dayKey={dk} isToday={isToday} openLog={todayOpenLog} onStart={() => void startWorkout()} />
      })()}
      {plan?.program === 'p12' && (
        <div className="px-4 pb-2">
          <button type="button" onClick={() => navigate('/program')} className="pressable flex w-full items-center justify-between rounded-xl2 border border-brand/30 bg-brand/10 px-3.5 py-3 text-left">
            <span><span className="block text-[13.5px] font-semibold text-brand">12-week program dashboard</span><span className="block text-[12px] text-ink2">Week overview, check-in, cardio, steps, PR Quest — at home, anything your kit can’t do swaps automatically</span></span>
            <ChevronRight size={18} className="text-brand" />
          </button>
        </div>
      )}
      {/* ------- one-tap location switch ------- */}
      {eqProfiles && eqProfiles.length > 0 && (
        <LocationSwitch
          profiles={eqProfiles}
          currentId={currentEq?.id ?? currentEqId}
          onPick={(id) => void switchLocation(id)}
          busy={switching}
        />
      )}
      {/* v10 (owner): make a program from your equipment, or build your own */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-1 pt-2">
        <button type="button" onClick={() => navigate('/plan')} className="pressable rounded-xl2 bg-surface2 px-3 py-2.5 text-left shadow-card">
          <span className="block text-[13px] font-semibold text-ink">✨ New program</span>
          <span className="block text-[11.5px] text-ink3">From your equipment · 1–16 weeks</span>
        </button>
        <button type="button" onClick={() => navigate('/plan/build')} className="pressable rounded-xl2 bg-surface2 px-3 py-2.5 text-left shadow-card">
          <span className="block text-[13px] font-semibold text-ink">🛠 Build my own</span>
          <span className="block text-[11.5px] text-ink3">Your exercises, sets & reps</span>
        </button>
      </div>

      {!plan || !week || !day ? (
        /* ------- no active plan: hero CTA ------- */
        <Section className="pt-3">
          <Card className="p-5">
            <div className="shout text-[12px] text-brand">No active plan</div>
            <h2 className="mt-1 text-[22px] font-bold leading-tight">Your program starts here</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">
              Generate a progressive multi-week plan built around your rack, cables and bench —
              every prescribed load is one you can actually build from your plates.
            </p>
            <Button full className="mt-4" onClick={() => navigate('/plan')}>
              <Sparkles size={16} /> Build my plan
            </Button>
          </Card>
        </Section>
      ) : (
        <>
          {/* ------- what changed at this location ------- */}
          {adapt && currentEq && changeCount > 0 && dismissedKey !== summaryKey && (
            <AdaptSummaryCard
              adapt={adapt}
              location={currentEq}
              onOpen={() => setSummaryOpen(true)}
              onDismiss={() => setDismissedKey(summaryKey)}
            />
          )}

          {/* ------- week chips ------- */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2">
            {plan.weeks.map((w) => (
              <button
                key={w.index}
                type="button"
                onClick={() => select(w.index, clamp(dayIdx, 1, w.days.length))}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                  w.index === weekIdx ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
                }`}
              >
                {w.index} · {w.label}
              </button>
            ))}
          </div>

          {/* ------- day chips ------- */}
          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4">
            {week.days.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => select(weekIdx, i + 1)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-left ${
                  i + 1 === dayIdx ? 'bg-brand/15 ring-1 ring-brand' : 'bg-surface2'
                }`}
              >
                <div className={`text-[10.5px] font-bold uppercase tracking-wide ${i + 1 === dayIdx ? 'text-brand' : 'text-ink3'}`}>
                  Day {i + 1}
                </div>
                <div className="max-w-[130px] truncate text-[13px] font-semibold text-ink">{d.title}</div>
              </button>
            ))}
          </div>

          {/* ------- selected day summary ------- */}
          <Section className="pt-3.5">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="shout text-[11.5px] text-brand">Week {week.index} · {week.label}</div>
                  <h2 className="mt-0.5 text-[20px] font-bold leading-tight">{day.title}</h2>
                  <div className="mt-1 text-[12.5px] text-ink2">
                    {day.focus.map((m) => MUSCLE_LABELS[m]).join(' · ')}
                  </div>
                  <div className="mt-2.5 flex items-center gap-4 text-[12.5px] font-medium text-ink2">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} className="text-ink3" /> ~{day.estMinutes} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Flame size={14} className="text-ink3" /> ~{day.estCalories} kcal
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  <MuscleMap primary={day.focus} secondary={secondaryMuscles} size={96} />
                </div>
              </div>
              <Button full className="mt-4" onClick={() => void startWorkout()} disabled={starting}>
                {todayOpenLog ? <RotateCcw size={17} /> : <Play size={17} />}
                {todayOpenLog ? 'Resume today’s workout' : 'Start this workout'}
              </Button>
              {currentEq && (
                <p className="mt-2 text-center text-[12px] text-ink3">
                  This session will be logged at {currentEq.name}.
                </p>
              )}
            </Card>
          </Section>

          {/* ------- progression intelligence: what to actually do today ------- */}
          <Section title="Next session targets">
            <NextTargetsCard
              exerciseIds={sessionExerciseIds}
              profile={profile ?? null}
              location={currentEq}
            />
          </Section>

          <Section title="Coaching notices">
            <TrainingNotices exerciseIds={sessionExerciseIds} location={currentEq} />
          </Section>

          <Section title="Weekly volume planner">
            <VolumePlannerCard plan={plan} weekIndex={weekIdx} />
          </Section>

          {/* ------- exercise list ------- */}
          <Section
            title={`Exercises · ${shown.length}`}
            action={changeCount > 0 ? (
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="pressable rounded-full bg-brand/12 px-3 py-1 text-[12px] font-bold text-brand"
              >
                {upgradeCount > 0
                  ? `${upgradeCount} upgraded`
                  : adapt?.swaps.length
                    ? `${adapt.swaps.length} swapped`
                    : `${adapt?.dropped.length} dropped`}
              </button>
            ) : undefined}
          >
            <Card className="divide-y divide-line overflow-hidden">
              {shown.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-ink3">
                  {day.exercises.length === 0
                    ? 'This day has no exercises — regenerate your plan from the settings.'
                    : `Nothing in this session can be trained at ${currentEq?.name ?? 'this location'} — switch back, or add the kit in Plan.`}
                </div>
              )}
              {shown.map((pe, i) => {
                const ex = byId.get(pe.exerciseId)
                const swappedName = pe.swappedFrom ? byId.get(pe.swappedFrom)?.name : undefined
                const rampable = currentEq
                  && isRampable(effectiveLoadMode(ex, currentEq))
                  && pe.weightKg !== undefined
                return (
                  <div
                    key={`${pe.exerciseId}-${i}`}
                    onClick={() => ex && navigate(`/exercise/${ex.id}`)}
                    className={`flex items-center gap-3 px-3 py-2.5 ${ex ? 'pressable cursor-pointer' : ''}`}
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface3">
                      {ex && MEDIA[ex.id]?.video
                        ? <video src={MEDIA[ex.id]!.video} poster={MEDIA[ex.id]!.imgSmall} autoPlay loop muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />
                        : ex && MEDIA[ex.id]
                          ? <img src={MEDIA[ex.id]!.imgSmall ?? MEDIA[ex.id]!.img} alt="" loading="lazy" className="h-full w-full object-cover" />
                        : ex
                          ? <ExerciseAnim def={ex.anim} size={64} playing />
                          : <span className="text-[10px] text-ink3">?</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-ink">
                        {ex ? ex.name : pe.exerciseId}
                      </div>
                      <div className="mt-0.5 text-[13px] text-ink2">
                        {pe.sets} × {repsLabel(pe.reps)}
                        {ex?.loadMode === 'time' ? '' : ' reps'}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] font-semibold text-brand">
                        {currentEq ? loadLabel(pe, ex, currentEq) : loadLabel(pe, ex, profile!)}
                      </div>
                      {swappedName && (() => {
                        const isUpgrade = !!ex && upgradedNames.has(ex.name)
                        return (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={isUpgrade ? 'green' : 'amber'}>
                              {isUpgrade ? 'Upgrade' : 'Swapped'}
                            </Badge>
                            <span className="truncate text-[11.5px] text-ink3">
                              {isUpgrade ? 'instead of' : 'for'} {swappedName}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                    {rampable && (
                      <IconButton
                        label="Warm-up ramp"
                        className="h-9 w-9"
                        onClick={(e) => {
                          e.stopPropagation()
                          setWarmupTarget({ pe })
                        }}
                      >
                        <Flame size={15} />
                      </IconButton>
                    )}
                    <IconButton
                      label="Swap exercise"
                      className="h-9 w-9"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSwapTarget(pe)
                      }}
                    >
                      <ArrowLeftRight size={15} />
                    </IconButton>
                    {ex && <ChevronRight size={17} className="-ml-1 shrink-0 text-ink3" />}
                  </div>
                )
              })}
            </Card>
          </Section>

          {/* ------- what the session-length budget pushed out ------- */}
          {day.trimmed && day.trimmed.length > 0 && (
            <Section>
              <Card className="p-4">
                <div className="flex items-start gap-2.5">
                  <Clock size={17} className="mt-0.5 shrink-0 text-ink3" />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink">
                      {day.trimmed.length} more {day.trimmed.length === 1 ? 'exercise' : 'exercises'} would fit a longer session
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
                      {currentEq?.name ?? 'This location'} has the kit for {day.trimmed.join(', ')}, but
                      they don't fit the {profile?.sessionMinutes ?? 60} minutes you set for a session.
                      Raise your session length in Settings to include them, or superset the isolation
                      work once you're in the gym.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/settings')}
                      className="pressable mt-2.5 inline-flex min-h-[40px] items-center rounded-full bg-brand/12 px-3.5 text-[12.5px] font-bold text-brand"
                    >
                      Change session length
                    </button>
                  </div>
                </div>
              </Card>
            </Section>
          )}

          {/* ------- history for this day ------- */}
          <Section title="Recent sessions · this day">
            <HistoryStrip logs={historyLogs ?? []} />
          </Section>

          {/* ------- the rest of the training section ------- */}
          <Section title="Training">
            <Card className="divide-y divide-line overflow-hidden">
              {[
                { to: '/prs', icon: Trophy, label: 'Personal records', sub: 'Every best you have set, and how long it has stood' },
                { to: '/history', icon: CalendarDays, label: 'Training history', sub: 'Your month at a glance, and how consistent you have been' },
                { to: '/tools', icon: Calculator, label: 'Tools', sub: '1RM, plate maths, warm-up ramps, rest guidance' },
                { to: '/exercises', icon: Dumbbell, label: 'Exercise library', sub: 'All 125, filtered to what you can do where you are' },
              ].map((row) => {
                const Icon = row.icon
                return (
                  <button
                    key={row.to}
                    type="button"
                    onClick={() => navigate(row.to)}
                    className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">{row.label}</span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink2">{row.sub}</span>
                    </span>
                    <ChevronRight size={17} className="shrink-0 text-ink3" />
                  </button>
                )
              })}
            </Card>
          </Section>
        </>
      )}

      <SwapSheet
        target={swapTarget}
        dayExerciseIds={shown.map((pe) => pe.exerciseId)}
        location={currentEq}
        onPick={(next) => void handleSwap(next)}
        onClose={() => setSwapTarget(null)}
      />

      <AdaptSummarySheet
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        adapt={adapt}
        location={currentEq}
      />

      <WarmupSheet
        target={warmupTarget}
        location={currentEq}
        onClose={() => setWarmupTarget(null)}
      />
    </div>
  )
}

/* 12-week program: Tue..Fri → days 1..4; Sat–Mon show Tuesday (the next session) */
function programDayIndex(plan?: import('@/db/types').Plan | null): number {
  const on = plan ? programDayOn(plan, todayStr()) : null
  if (on) return ['tue', 'wed', 'thu', 'fri'].indexOf(on.dk) + 1
  const wd = new Date().getDay(); return wd >= 2 && wd <= 5 ? wd - 1 : 1
}
