import { getProgramPlan } from '@/lib/programStore'
// TODAY — the daily command centre. Live cards for workout, water, creatine,
// nutrition and the reminder timeline; welcome takeover until onboarded.

import { useEffect, useMemo, useState } from 'react'
import { WeekGlance } from './today/WeekGlance'
import { StreakCard } from './today/StreakCard'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CalendarCheck, Dumbbell, Flame, Salad, Scale } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { db, getActivePlan, getProfile } from '@/db'
import { todayStr } from '@/lib/id'
import { dayjs, fmtKg } from '@/lib/fmt'
import { slotForDay, todayTimeline } from '@/lib/schedule'
import type { WorkoutLog } from '@/db/types'
import { ensureEquipmentProfiles, HOME_PROFILE_ID, setCurrentProfile } from '@/lib/equipment'
import { useUI } from '@/lib/store'
import { LocationSwitch } from './workout/LocationSwitch'
import { computeStreak, nowMinutes, proteinPacing, resolvePlanDay, syncReminders } from './today/lib'
import { WorkoutCard } from './today/WorkoutCard'
import { WaterCard } from './today/WaterCard'
import { CreatineCard } from './today/CreatineCard'
import { creatineDoseFor } from '@/lib/owner'
import { NutritionCard } from './today/NutritionCard'
import { TimelineCard } from './today/TimelineCard'
import { ProteinTimingCard } from './today/ProteinTimingCard'
import { StreaksCard } from './today/StreaksCard'
import { FaithCard } from './today/FaithCard'
import { AdaptiveTargetCard } from './today/AdaptiveTargetCard'
import { GoalWeightCard, ProgramTodayCard, StepsCard } from './today/ProgramToday'
import { GoalCoachCard, RunGoalCard } from './today/GoalCoachCard'
import { MissedSessionCard } from './today/MissedSessionCard'
import { goalSettings } from '@/lib/calorieTarget'
import { targetForDateWith } from './food/helpers'
import { ed } from '@/lib/edition'
import { ProGate, TrialBanner } from '@/components/ProGate'

export default function TodayScreen() {
  const programPlanId = useLiveQuery(async () => (await getProgramPlan())?.id ?? null, [])
  const navigate = useNavigate()

  // ticks every 30s → timeline dimming stays honest and the date rolls at midnight
  const [nowMin, setNowMin] = useState(nowMinutes)
  useEffect(() => {
    const id = window.setInterval(() => setNowMin(nowMinutes()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const today = todayStr()
  const toast = useUI((s) => s.toast)
  const [switching, setSwitching] = useState(false)

  async function switchLocation(id: string) {
    if (switching) return
    setSwitching(true)
    try {
      await setCurrentProfile(id)
      const next = eqProfiles?.find((p) => p.id === id)
      toast(next ? `Training at ${next.name}` : 'Location changed')
    } finally {
      setSwitching(false)
    }
  }

  // ---------- live data ----------
  const profile = useLiveQuery(() => getProfile(), [])
  const plan = useLiveQuery(() => getActivePlan(), [])
  // where he's training today. Switching here swaps the whole session, because
  // the plan itself is built per location — see getActivePlan.
  const eqProfiles = useLiveQuery(() => ensureEquipmentProfiles(), [])
  const reminders = useLiveQuery(() => db.reminders.get('reminders'), [])
  const todayAdjust = useLiveQuery(() => db.dayAdjust.get(today), [today])
  const todayLogs = useLiveQuery(() => db.workoutLogs.where('date').equals(today).toArray(), [today])
  const waterMl = useLiveQuery(
    async () => (await db.waterLog.where('date').equals(today).toArray()).reduce((s, w) => s + w.ml, 0),
    [today],
  )
  const creatine = useLiveQuery(() => db.creatineLog.where('date').equals(today).first(), [today])
  const foodRows = useLiveQuery(() => db.foodLog.where('date').equals(today).toArray(), [today])
  const food = useLiveQuery(async () => {
    const rows = await db.foodLog.where('date').equals(today).toArray()
    return {
      kcal: rows.reduce((s, r) => s + r.kcal, 0),
      protein: rows.reduce((s, r) => s + r.protein, 0),
    }
  }, [today])
  const latestWeigh = useLiveQuery(() => db.weighIns.orderBy('date').last(), [])
  // the goal coach owns the calorie target while it's on, so the older adaptive card stays out of the way
  const goalAuto = useLiveQuery(async () => (await goalSettings()).auto, [])
  const streak = useLiveQuery(async () => {
    const workoutDates = (await db.workoutLogs.orderBy('date').keys()) as string[]
    const cardioDates = (await db.cardioLog.orderBy('date').keys()) as string[]
    return computeStreak(new Set([...workoutDates, ...cardioDates]), today)
  }, [today])

  // ---------- derived ----------
  const dayInfo = useMemo(() => (plan ? resolvePlanDay(plan, today) : null), [plan, today])
  const isTrainingDay = dayInfo !== null

  const slot = useMemo(() => {
    if (!profile) return null
    const wd = profile.workSchedule.find((w) => w.day === dayjs(today).day())
    return wd ? slotForDay(wd, profile.preferredSlot, profile.sessionMinutes) : null
  }, [profile, today])

  const todayLog: WorkoutLog | undefined = useMemo(() => {
    if (!todayLogs || todayLogs.length === 0) return undefined
    const latest = (arr: WorkoutLog[]) => arr.reduce((a, b) => (a.startedAt > b.startedAt ? a : b))
    const unfinished = todayLogs.filter((l) => !l.finishedAt)
    return unfinished.length ? latest(unfinished) : latest(todayLogs)
  }, [todayLogs])

  const timeline = useMemo(
    () => (profile && reminders ? todayTimeline(profile, reminders, isTrainingDay) : []),
    [profile, reminders, isTrainingDay],
  )

  // ---------- reminder notifications (permission once, then same-day timers) ----------
  useEffect(() => {
    if (!profile?.onboarded || !reminders) return
    void syncReminders(profile, reminders, isTrainingDay, dayInfo?.day.title)
  }, [profile, reminders, isTrainingDay, dayInfo])

  // ---------- loading ----------
  if (profile === undefined) {
    return (
      <div className="flex h-[70svh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // ---------- welcome takeover ----------

  if (!profile.onboarded) {
    return (
      <div className="flex min-h-[92svh] flex-col items-center justify-center px-6 pt-safe text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-amber-600 text-white shadow-lg shadow-brand/30">
          <Dumbbell size={38} strokeWidth={2.2} />
        </div>
        <h1 className="shout mt-5 text-[36px] leading-none text-ink">Ironverse</h1>
        <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-ink2">
          {ed("Your garage gym, planned.", "Your training, planned.")} Training, food, water and progress — all offline, all yours.
        </p>
        <div className="mt-7 w-full max-w-[320px] space-y-2.5 text-left">
          {[
            { icon: CalendarCheck, text: 'A plan built for your rack, cables and bench' },
            { icon: Salad, text: 'Calorie, protein, water and creatine targets' },
            { icon: Flame, text: 'Progress tracking that adapts as you go' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded-xl bg-surface2 px-3.5 py-3 shadow-card">
              <Icon size={19} className="shrink-0 text-brand" />
              <span className="text-[13.5px] font-medium text-ink">{text}</span>
            </div>
          ))}
        </div>
        <Button full className="mt-7 max-w-[320px]" onClick={() => navigate('/onboarding')}>
          Set me up <ArrowRight size={18} />
        </Button>
        <p className="mt-3 text-[12px] text-ink3">Takes about two minutes.</p>
      </div>
    )
  }

  // ---------- daily dashboard ----------
  return (
    <div className="mx-auto max-w-lg pb-6">
      <header className="sticky top-0 z-30 bg-surface/85 pt-safe backdrop-blur-xl">
        <div className="flex items-end justify-between px-4 pb-3 pt-4">
          <div>
            <h1 className="shout text-[32px] leading-none text-ink">Today</h1>
            <p className="mt-1.5 text-[13px] font-medium text-ink2">{dayjs(today).format('dddd, D MMMM')}</p>
          </div>
          <div className="flex items-center gap-2">
            {latestWeigh && (
              <button
                type="button"
                onClick={() => navigate('/progress')}
                className="pressable flex items-center gap-1 rounded-full bg-surface3 px-2.5 py-1.5"
                aria-label="Latest weight — open progress"
              >
                <Scale size={14} className="text-ink2" />
                <span className="big-num text-[12.5px] text-ink">{fmtKg(latestWeigh.weightKg)}</span>
              </button>
            )}
            <div
              className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 ${
                (streak ?? 0) > 0 ? 'bg-brand/12' : 'bg-surface3'
              }`}
              aria-label={`${streak ?? 0} day streak`}
            >
              <Flame
                size={15}
                className={(streak ?? 0) > 0 ? 'text-brand' : 'text-ink3'}
                fill={(streak ?? 0) > 0 ? 'currentColor' : 'none'}
              />
              <span className={`big-num text-[13px] ${(streak ?? 0) > 0 ? 'text-brand' : 'text-ink3'}`}>
                {streak ?? 0}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-1">
        {eqProfiles && eqProfiles.length > 1 && (
          <LocationSwitch
            profiles={eqProfiles}
            currentId={profile.equipmentProfileId ?? HOME_PROFILE_ID}
            onPick={(id) => void switchLocation(id)}
            busy={switching}
          />
        )}

        <TrialBanner />
        <ProGate feature="goalCoach"><GoalCoachCard
          profile={profile}
          plan={plan}
          isTrainingDay={isTrainingDay}
          trainedToday={!!todayLog?.finishedAt}
          eaten={food?.kcal ?? 0}
          target={targetForDateWith(today, profile, todayAdjust ? new Map([[today, todayAdjust]]) : undefined)}
        /></ProGate>
        <div className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink3">Training</div>
        <MissedSessionCard />
        <ProgramTodayCard />
        {programPlanId && plan && programPlanId === plan.id ? (
          <details className="rounded-2xl bg-surface2 px-4 py-2 shadow-card">
            <summary className="cursor-pointer py-1.5 text-[13.5px] font-semibold">Today’s exercises</summary>
            <div className="pb-2 pt-1">
              <WorkoutCard
          profile={profile}
          plan={plan}
          dayInfo={dayInfo}
          slot={slot}
          todayLog={todayLog}
          today={today}
        />
            </div>
          </details>
        ) : (
        <WorkoutCard
          profile={profile}
          plan={plan}
          dayInfo={dayInfo}
          slot={slot}
          todayLog={todayLog}
          today={today}
        />
        )}
        <WeekGlance profile={profile} />
        <button type="button" onClick={() => navigate('/cardio?start=tm10')} className="pressable flex w-full items-center gap-3 rounded-2xl bg-surface2 px-4 py-3 text-left shadow-card">
          <span className="text-[22px]">🏃</span>
          <span className="flex-1"><span className="block text-[15px] font-semibold text-ink">10 km treadmill run</span><span className="block text-[12px] text-ink3">Run instead of lifting today? Log it here — pace, calories, your best.</span></span>
        </button>
        <RunGoalCard />
        <StreakCard target={profile.daysPerWeek || 4} />
        <div className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink3">Daily habits</div>
        <div className="grid grid-cols-2 gap-3">
          <WaterCard today={today} totalMl={waterMl ?? 0} targetMl={profile.waterTargetMl} />
          <CreatineCard
            today={today}
            log={creatine}
            grams={creatineDoseFor(profile, today).grams}
            loading={creatineDoseFor(profile, today).loading}
            hintTime={reminders?.creatineEnabled ? reminders.creatineTime : undefined}
          />
        </div>
        <StepsCard profile={profile} />
        <FaithCard profile={profile} slot={slot} isTrainingDay={Boolean(dayInfo)} />
        <div className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink3">Nutrition</div>
        <NutritionCard
          kcal={food?.kcal ?? 0}
          protein={food?.protein ?? 0}
          kcalTarget={targetForDateWith(today, profile, todayAdjust ? new Map([[today, todayAdjust]]) : undefined)}
          proteinTarget={profile.proteinTarget}
        />
        <ProteinTimingCard
          pacing={proteinPacing(foodRows ?? [], profile.proteinTarget, nowMin)}
        />
        {!goalAuto && <AdaptiveTargetCard profile={profile} kcalToday={food?.kcal ?? 0} today={today} />}
        <div className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink3">Body &amp; progress</div>
        <GoalWeightCard profile={profile} />
        <div className="px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink3">Your day</div>
        <StreaksCard profile={profile} plan={plan} today={today} />
        <TimelineCard items={timeline} nowMin={nowMin} />
      </div>
    </div>
  )
}
