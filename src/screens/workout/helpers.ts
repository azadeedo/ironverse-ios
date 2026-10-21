// Shared helpers for the plan browser (/workout) + plan manager (/plan).

import { byId } from '@/data/exercises'
import { newId, nowIso, todayStr } from '@/lib/id'
import { dayjs } from '@/lib/fmt'
import { effectiveLoadMode, nearestLoad, type AnyLoadMode, type LoadSource } from '@/lib/plates'
import type { AdaptedExercise } from '@/lib/equipment'
import type {
  EquipmentProfile, Exercise, Plan, PlanDay, PlanExercise, PlanWeek, Profile, WorkoutLog,
} from '@/db/types'

export const GOAL_LABELS: Record<Profile['goal'], string> = {
  'lose-fat': 'Lose fat',
  'build-muscle': 'Build muscle',
  recomp: 'Recomposition',
}

/** Mon-first order for weekday chips (day numbers, 0=Sun) */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Which plan week "today" falls in (1-based, clamped to the plan length). */
export function currentWeekIndex(plan: Plan): number {
  const started = dayjs(plan.startDate)
  const diff = dayjs(todayStr()).diff(started, 'day')
  return clamp(Math.floor(diff / 7) + 1, 1, plan.weeks.length)
}

/** Best default day tab: today's slot in the training weekdays, else the first day. */
export function defaultDayIndex(plan: Plan, week: PlanWeek): number {
  const todayDow = dayjs().day()
  const pos = plan.trainingWeekdays.indexOf(todayDow)
  if (pos >= 0 && pos < week.days.length) return pos + 1
  return 1
}

/** Reps as '8–12' (or '10' when the range collapses). */
export function repsLabel(reps: [number, number]): string {
  return reps[0] === reps[1] ? `${reps[0]}` : `${reps[0]}–${reps[1]}`
}

/** The load mode an exercise is really performed in at this location. */
export function modeFor(ex: Exercise | undefined, source: LoadSource): AnyLoadMode | null {
  return effectiveLoadMode(ex, source)
}

/**
 * Human load label for a prescribed exercise: plate breakdown, dumbbell pair,
 * stack, time or bodyweight. `source` is the CURRENT equipment profile (the
 * legacy Profile also satisfies it, so old call sites keep working).
 */
export function loadLabel(pe: PlanExercise, ex: Exercise | undefined, source: LoadSource): string {
  if (!ex) return ''
  if (ex.loadMode === 'time') {
    const sec = pe.timeSec ?? 45
    return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec} sec`
  }
  if (ex.loadMode === 'bodyweight') return 'Bodyweight'
  if (pe.weightKg === undefined) return 'Pick your load'
  const mode = effectiveLoadMode(ex, source) ?? ex.loadMode
  const lp = nearestLoad(mode, pe.weightKg, source)
  return lp ? lp.label : `${pe.weightKg} kg`
}

/**
 * Re-snap every prescribed load onto the hardware THIS location actually has.
 * Swapped-in exercises arrive with no weight (adaptToProfile clears it), so we
 * rebuild one from the exercise's own strength baseline and bodyweight.
 * Nothing here touches the saved plan — it is a lens over it.
 */
export function resnapToProfile(
  list: AdaptedExercise[],
  eq: EquipmentProfile,
  bodyweightKg: number,
): AdaptedExercise[] {
  return list.map((pe) => {
    const ex = byId.get(pe.exerciseId)
    const mode = effectiveLoadMode(ex, eq)
    if (!ex || !mode || mode === 'bodyweight' || mode === 'time') {
      return { ...pe, weightKg: undefined }
    }
    const desired = pe.weightKg ?? (ex.startFactor ? ex.startFactor * bodyweightKg : undefined)
    if (desired === undefined) return { ...pe, weightKg: undefined }
    return { ...pe, weightKg: nearestLoad(mode, desired, eq)?.totalKg }
  })
}

/**
 * Create the WorkoutLog for a plan day (same shape the Today screen uses) — sets
 * prefilled. Pass the exercises as displayed (already adapted + re-snapped) and
 * the equipment profile so the session records WHERE it was trained.
 */
export function makeWorkoutLog(
  plan: Plan,
  week: PlanWeek,
  day: PlanDay,
  opts?: { exercises?: PlanExercise[]; equipment?: EquipmentProfile | null },
): WorkoutLog {
  const source = opts?.exercises ?? day.exercises
  const eq = opts?.equipment
  return {
    id: newId(),
    date: todayStr(),
    planId: plan.id,
    weekIndex: week.index,
    dayId: day.id,
    title: day.title,
    startedAt: nowIso(),
    ...(eq ? { equipmentProfileId: eq.id, equipmentProfileName: eq.name } : {}),
    exercises: source.map((pe) => ({
      exerciseId: pe.exerciseId,
      ...(pe.swappedFrom ? { swappedFrom: pe.swappedFrom } : {}),
      sets: Array.from({ length: pe.sets }, (_, i) => ({
        setIndex: i,
        targetReps: pe.reps,
        weightKg: pe.weightKg,
        timeSec: pe.timeSec,
        done: false,
      })),
    })),
  }
}

/** Carry a prescription over to a replacement exercise, keeping intensity achievable. */
function convertEntry(pe: PlanExercise, next: Exercise, profile: Profile): PlanExercise {
  const oldEx = byId.get(pe.exerciseId)
  const out: PlanExercise = { ...pe, exerciseId: next.id, note: undefined }
  out.reps = next.repRange ?? pe.reps
  if (next.loadMode === 'time') {
    out.weightKg = undefined
    out.timeSec = pe.timeSec ?? 45
    return out
  }
  out.timeSec = undefined
  if (next.loadMode === 'bodyweight') {
    out.weightKg = undefined
    return out
  }
  // Preserve relative intensity: scale the new start weight by how far the old
  // prescription had progressed beyond its own baseline, then snap to real plates.
  let desired: number | undefined
  if (next.startFactor) {
    let ratio = 1
    if (pe.weightKg && oldEx?.startFactor) {
      const base = oldEx.startFactor * profile.weightKg
      if (base > 0) ratio = clamp(pe.weightKg / base, 0.5, 2)
    }
    desired = next.startFactor * profile.weightKg * ratio
  } else if (pe.weightKg) {
    desired = pe.weightKg
  }
  out.weightKg = desired ? nearestLoad(next.loadMode, desired, profile)?.totalKg : undefined
  return out
}

/**
 * Replace an exercise in the SAVED plan: swaps it in this day slot across every
 * week (so the program stays consistent as it progresses).
 */
export function swapExerciseInPlan(
  plan: Plan,
  dayPosition: number, // 0-based index of the day within its week
  oldExerciseId: string,
  next: Exercise,
  profile: Profile,
): Plan {
  const weeks = plan.weeks.map((w) => ({
    ...w,
    days: w.days.map((d, di) => {
      if (di !== dayPosition) return d
      return {
        ...d,
        exercises: d.exercises.map((pe) =>
          pe.exerciseId === oldExerciseId ? convertEntry(pe, next, profile) : pe,
        ),
      }
    }),
  }))
  return { ...plan, weeks }
}
