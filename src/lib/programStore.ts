// Persistence + orchestration for the 12-week program. Everything here is
// additive: existing plans are deactivated (never deleted) when the program
// starts, and can be reactivated from the program screen.

import dayjs from 'dayjs'
import { db, getProfile, getSetting, saveProfile, setSetting, SETTING_KEYS } from '@/db'
import type { DailyCheckin, ExerciseMeta, Plan, PlanExercise, SetLog, WorkoutLog } from '@/db/types'
import { byId } from '@/data/exercises'
import { DAY_ORDER, LIFT_EXERCISE, MAIN_LIFT_OF, STICKING, STICKING_MIN_OBSERVATIONS, STICKING_SUGGESTIONS, type DayKey, type LiftKey } from '@/data/program12'
import { SKILL_TREES, type Level } from '@/data/knowledge'
import { ensureEquipmentProfiles, getCurrentProfile } from './equipment'
import { warmupSets } from './training'
import { newId, nowIso, todayStr } from './id'
import {
  PROGRAM_VERSION, PULL_IDS, buildProgramPlan, dayIdFor, dayKeyForDate, programDayOn, e1rm, mondayBefore, nextTuesday, parseDayId, prescribeAccessory, prescribeMain,
  prescribedSetLogs, programWeekFor, snapLoad, upgradeProgramPlan,
  type Prescription, type ProgramSetup,
} from './program12'

/**
 * The equipment the program's loads are built on. The program is a Flex 24/7
 * program, so it uses the plan's gym profile even when the location switch is
 * on Home (the garage plates top out at 120 kg).
 */
export async function getProgramEquipment(plan?: Plan | null): Promise<import('@/db/types').EquipmentProfile | null> {
  try {
    const all = await ensureEquipmentProfiles()
    const want = plan?.equipmentProfileId ?? (await getProgramPlan())?.equipmentProfileId ?? 'flex'
    return all.find((p) => p.id === want) ?? (await getCurrentProfile())
  } catch {
    return null
  }
}

export async function getProgramSetup(): Promise<ProgramSetup | null> {
  return getSetting<ProgramSetup | null>(SETTING_KEYS.programSetup, null)
}
export async function saveProgramSetup(s: ProgramSetup): Promise<void> {
  await setSetting(SETTING_KEYS.programSetup, s)
}

export async function getProgramPlan(): Promise<Plan | undefined> {
  const plans = await db.plans.toArray()
  return plans.find((p) => p.program === 'p12' && p.active) ?? undefined
}

/**
 * One-time upgrade of program plans built by the old per-weekday template
 * generator to the 48 individually written workouts. The plan keeps its id,
 * start date, repeats and deloads, so workout history stays linked. A copy of
 * the old plan is kept in settings first. Logged workouts are never touched.
 */
export async function ensureProgramUpgraded(): Promise<number> {
  const plans = (await db.plans.toArray()).filter((p) => p.program === 'p12' && (p.programVersion ?? 1) < PROGRAM_VERSION)
  if (!plans.length) return 0
  const setup = (await getProgramSetup()) ?? {}
  for (const p of plans) {
    await setSetting(`p12:planBackup:${p.id}:v${p.programVersion ?? 1}`, p)
    await db.plans.put(upgradeProgramPlan(p, setup))
  }
  return plans.length
}

/**
 * Make the owner's 12-week program THE active plan. Runs once at boot (owner's
 * explicit instruction, 2026-10-08): if no 12-week program is active, the
 * newest existing one is switched back on, or a new one is built starting on
 * the Tuesday of THIS week (so today maps to its real program day). Other
 * plans are switched off — never deleted — and remembered so "Pause program"
 * can bring them back. A deliberate pause later is respected (flag).
 */
export async function ensureProgramActive(today = todayStr()): Promise<'already' | 'reactivated' | 'created' | 'skipped'> {
  const all = await db.plans.toArray()
  if (all.some((p) => p.program === 'p12' && p.active)) return 'already'
  if (await getSetting<boolean>('p12:autoActivated', false)) return 'skipped'
  const prevActive = all.filter((p) => p.active && p.program !== 'p12').map((p) => p.id)
  const existing = all.filter((p) => p.program === 'p12').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const d = dayjs(today), back = (d.day() - 2 + 7) % 7
  const start = d.subtract(back, 'day').format('YYYY-MM-DD')
  let result: 'reactivated' | 'created' = 'created'
  // read everything BEFORE the transaction (it only covers plans + settings)
  const me = await getProfile()
  const setup: ProgramSetup = (await getProgramSetup()) ?? { bodyweightKg: me?.weightKg, goalWeightKg: 85 }
  await db.transaction('rw', db.plans, db.settings, async () => {
    for (const p of all) if (p.active) await db.plans.put({ ...p, active: false })
    if (existing) { await db.plans.put({ ...existing, active: true }); result = 'reactivated' }
    else {
      await db.plans.put(buildProgramPlan({ start, setup, pullStage: setup.pullStage, cannotDo: setup.cannotDo }))
      await setSetting(SETTING_KEYS.programSetup, { ...setup, completedAt: setup.completedAt ?? nowIso() })
    }
    await setSetting('p12:prevActive', prevActive)
    await setSetting('p12:autoActivated', true)
  })
  return result
}

/**
 * One-time fix (owner's stated facts, 2026-10-08: 26 years old, 169 cm, ~98 kg,
 * goal ~85 kg). The very first build seeded GUESSES — 180 cm, born 2001 and a
 * hard-coded 2,956 kcal target that sits ABOVE his maintenance. Height/age
 * guesses are replaced; the calorie + protein targets are recalculated only if
 * they are still the untouched seed values (a target he set himself is kept).
 */
export async function fixSeedProfileOnce(): Promise<string | null> {
  if (await getSetting<boolean>('v7:profileFix', false)) return null
  const me = await getProfile()
  if (!me) return null
  const next = { ...me }
  const changed: string[] = []
  if (me.heightCm === 180) { next.heightCm = 169; changed.push('height 169 cm') }
  if (me.birthYear === 2001) { next.birthYear = 2000; changed.push('age 26') }
  if (me.calorieTarget === 2956) {
    if (me.activityLevel === 'light') next.activityLevel = 'moderate' // 4 lifting days + cardio + 8k steps
    const { recommendedTargets } = await import('./nutrition')
    const t = recommendedTargets({ ...next, goal: next.goal ?? 'lose-fat' })
    next.calorieTarget = t.calories
    next.proteinTarget = t.protein
    changed.push(`target ${t.calories} kcal / ${t.protein} g protein`)
  }
  if (changed.length) await saveProfile(next)
  await setSetting('v7:profileFix', true)
  return changed.length ? changed.join(', ') : null
}

export async function addExerciseToProgram(plan: Plan, dayId: string, id: string, range: [number, number]): Promise<Plan> {
  const m = /^p12-w(\d+)-(\w+)$/.exec(dayId)
  const next: Plan = {
    ...plan,
    weeks: plan.weeks.map((w) => ({
      ...w,
      days: w.days.map((dd) => {
        const mm = /^p12-w(\d+)-(\w+)$/.exec(dd.id)
        const same = m && mm ? mm[2] === m[2] && Number(mm[1]) >= Number(m[1]) : dd.id === dayId
        return same && !dd.exercises.some((e) => e.exerciseId === id)
          ? { ...dd, exercises: [...dd.exercises, { exerciseId: id, sets: 3, reps: range, restSec: 90, role: 'accessory' as const, note: 'Added by you', userAdded: true, order: dd.exercises.length + 1 }] }
          : dd
      }),
    })),
  }
  await db.plans.put(next)
  return next
}

// ---------- schedule controls (history is never touched) ----------
export async function skipWeek(plan: Plan, week: number): Promise<Plan> {
  const next = { ...plan, skippedWeeks: [...new Set([...(plan.skippedWeeks ?? []), week])] }
  await db.plans.put(next)
  return next
}
export async function unskipWeek(plan: Plan, week: number): Promise<Plan> {
  const next = { ...plan, skippedWeeks: (plan.skippedWeeks ?? []).filter((w) => w !== week) }
  await db.plans.put(next)
  return next
}
/** "I'm on week N" from this calendar week onwards */
export async function setManualWeek(plan: Plan, week: number, today = todayStr()): Promise<Plan> {
  const cw = Math.max(0, programWeekFor(plan, today).calendarWeek)
  const next: Plan = { ...plan, manualWeek: { calendarWeek: cw, week, setAt: nowIso() } }
  await db.plans.put(next)
  return next
}
export async function clearManualWeek(plan: Plan): Promise<Plan> {
  const { manualWeek: _m, ...rest } = plan
  await db.plans.put(rest)
  return rest
}
/** Move the start date (snapped to a Tuesday). Logged workouts keep their own dates and week numbers. */
export async function setProgramStart(plan: Plan, date: string): Promise<Plan> {
  const start = nextTuesday(date)
  const { manualWeek: _m, ...rest } = plan
  const next: Plan = { ...rest, programStart: start, startDate: start }
  await db.plans.put(next)
  return next
}
export { mondayBefore }
export async function getAnyProgramPlan(): Promise<Plan | undefined> {
  const plans = await db.plans.toArray()
  return plans.filter((p) => p.program === 'p12').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

/**
 * Start (or restart) the program. Other active plans are paused, not deleted,
 * and their ids are remembered so they can be switched back on.
 */
export async function startProgram(setup: ProgramSetup, start: string): Promise<Plan> {
  const all = await db.plans.toArray()
  const prevActive = all.filter((p) => p.active && p.program !== 'p12').map((p) => p.id)
  const plan = buildProgramPlan({ start, setup, pullStage: setup.pullStage, cannotDo: setup.cannotDo })
  await db.transaction('rw', db.plans, db.settings, db.profile, db.weighIns, async () => {
    for (const p of all) if (p.active) await db.plans.put({ ...p, active: false })
    await db.plans.put(plan)
    await saveProgramSetup({ ...setup, completedAt: nowIso() })
    await setSetting('p12:prevActive', prevActive)
    const me = await getProfile()
    if (me) {
      await saveProfile({
        ...me,
        ...(setup.heightCm ? { heightCm: setup.heightCm } : {}),
        ...(setup.age ? { birthYear: new Date().getFullYear() - setup.age } : {}),
        ...(setup.goalWeightKg ? { goalWeightKg: setup.goalWeightKg } : {}),
        startWeightKg: me.startWeightKg ?? setup.bodyweightKg ?? me.weightKg,
        stepsTarget: me.stepsTarget ?? 8000,
        ...(setup.bodyweightKg ? { weightKg: setup.bodyweightKg } : {}),
      })
    }
    if (setup.bodyweightKg) {
      const today = todayStr()
      const existing = await db.weighIns.where('date').equals(today).first()
      if (!existing) await db.weighIns.put({ id: newId(), date: today, weightKg: setup.bodyweightKg, note: 'Program setup' })
    }
  })
  return plan
}

/** Pause the program and switch the previously active plans back on. */
export async function pauseProgram(): Promise<void> {
  const prev = await getSetting<string[]>('p12:prevActive', [])
  const all = await db.plans.toArray()
  for (const p of all) {
    if (p.program === 'p12' && p.active) await db.plans.put({ ...p, active: false })
    if (prev.includes(p.id)) await db.plans.put({ ...p, active: true })
  }
}
export async function resumeProgram(id: string): Promise<void> {
  const all = await db.plans.toArray()
  for (const p of all) {
    if (p.id === id) await db.plans.put({ ...p, active: true })
    else if (p.active) await db.plans.put({ ...p, active: false })
  }
}

export async function repeatWeek(plan: Plan, week: number): Promise<Plan> {
  const next = { ...plan, repeatedWeeks: [...(plan.repeatedWeeks ?? []), week] }
  await db.plans.put(next)
  return next
}
export async function setPullStage(plan: Plan, stage: string): Promise<Plan> {
  const setup = (await getProgramSetup()) ?? {}
  const weeks = plan.weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((pe) =>
        (pe.pullProgression || (plan.programVersion ?? 1) < 2) && PULL_IDS.includes(pe.exerciseId) ? { ...pe, exerciseId: stage } : pe),
    })),
  }))
  await saveProgramSetup({ ...setup, pullStage: stage as ProgramSetup['pullStage'] })
  const next = { ...plan, weeks }
  await db.plans.put(next)
  return next
}

// ---------- sessions ----------
export interface BuiltSession { log: WorkoutLog; rx: Map<string, Prescription> }

export async function buildProgramSession(plan: Plan, week: number, day: DayKey, opts?: {
  checkin?: WorkoutLog['checkin']; adjust?: 'reduce' | 'drop-set'; plannedFor?: string; deload?: boolean
}): Promise<BuiltSession> {
  const pd = plan.weeks[week - 1]?.days.find((d) => d.id === dayIdFor(week, day))
  if (!pd) throw new Error('day not in plan')
  const [logs, setup, eq, metaRows] = await Promise.all([
    db.workoutLogs.toArray(), getProgramSetup(), getProgramEquipment(plan), db.exerciseMeta.toArray(),
  ])
  const meta = new Map<string, ExerciseMeta>(metaRows.map((m) => [m.exerciseId, m]))
  const rx = new Map<string, Prescription>()
  const lift = MAIN_LIFT_OF[day]
  const exercises: WorkoutLog['exercises'] = []
  for (const raw of pd.exercises) {
    // manual deload: main lifts become 2 light sets at 60–70%, accessories about half
    const pe: PlanExercise = opts?.deload
      ? raw.role === 'main'
        ? { ...raw, sets: 2, rir: [4, 5], scheme: { kind: 'straight', intensity: [0.6, 0.7], note: 'Manual deload — about 60–70% of recent working weight.' } }
        : { ...raw, sets: Math.max(1, Math.floor(raw.sets / 2)), rir: [4, 5] }
      : raw
    const r = pe.role === 'main'
      ? prescribeMain(pe, pe.lift ?? (week === 12 && day === 'fri' ? 'deadlift' : lift), week, logs, { ...(setup ?? {}), bodyweightKg: setup?.bodyweightKg ?? (await getProfile())?.weightKg }, eq, meta.get(pe.exerciseId))
      : prescribeAccessory(pe, logs, eq, meta.get(pe.exerciseId), (await getProfile())?.weightKg)
    rx.set(pe.exerciseId, r)
    let sets: SetLog[] = prescribedSetLogs(pe, r)
    // an accepted weekly-review recommendation ("reduce loads next week") — loads only, never structure
    const accepted = plan.loadAdjust?.week === week
    if ((opts?.adjust === 'reduce' || accepted) && (pe.role === 'main' || pe.role === 'compound')) {
      // 2.5–5% lighter, snapped to a load this room (or this machine's own steps) can build
      sets = sets.map((s) => {
        if (!s.weightKg) return s
        const lighter = snapLoad(byId.get(pe.exerciseId), s.weightKg * 0.965, eq, meta.get(pe.exerciseId))
        return { ...s, weightKg: lighter < s.weightKg ? lighter : s.weightKg }
      })
    }
    if (opts?.adjust === 'drop-set' && pe.role !== 'main' && sets.length > 1) sets = sets.slice(0, -1)
    // warm-ups for the big lifts: generated, snapped to real plates, never counted as volume
    if (pe.role === 'main' && pe.warmupRule !== 'none' && eq && sets[0]?.weightKg && r.flags.indexOf('pr-test') < 0) {
      const w = warmupSets(sets[0].weightKg, byId.get(pe.exerciseId), eq)
      sets = [...w, ...sets].map((s, i) => ({ ...s, setIndex: i }))
    }
    exercises.push({ exerciseId: pe.exerciseId, ...(pe.swappedFrom ? { swappedFrom: pe.swappedFrom } : {}), sets })
  }
  const today = todayStr()
  const log: WorkoutLog = {
    id: newId(),
    date: today,
    planId: plan.id,
    weekIndex: week,
    dayId: pd.id,
    title: pd.title,
    startedAt: nowIso(),
    exercises,
    ...(eq ? { equipmentProfileId: eq.id, equipmentProfileName: eq.name } : {}),
    ...(opts?.checkin ? { checkin: opts.checkin } : {}),
    ...(opts?.plannedFor && opts.plannedFor !== today ? { plannedFor: opts.plannedFor } : {}),
    status: 'partial',
  }
  return { log, rx }
}

/**
 * Skips are recorded separately from workouts. (They used to be saved as empty
 * "finished" workouts, which would have counted toward history, streaks and
 * achievements.)
 */
export async function skipProgramDay(plan: Plan, week: number, day: DayKey, date: string): Promise<void> {
  const all = await getSetting<Record<string, { date: string; at: string }>>('p12:skips', {})
  all[`${plan.id}:${dayIdFor(week, day)}`] = { date, at: nowIso() }
  await setSetting('p12:skips', all)
}
export async function getSkips(planId: string): Promise<Set<string>> {
  const all = await getSetting<Record<string, { date: string; at: string }>>('p12:skips', {})
  return new Set(Object.keys(all).filter((k) => k.startsWith(`${planId}:`)).map((k) => k.slice(planId.length + 1)))
}

// ---------- daily check-ins + steps ----------
export async function getCheckin(date: string): Promise<DailyCheckin | undefined> {
  try { return await db.checkins.get(date) } catch { return undefined }
}
export async function saveCheckin(c: Partial<DailyCheckin> & { date: string }): Promise<void> {
  const prev = await getCheckin(c.date)
  await db.checkins.put({ ...prev, ...c, updatedAt: nowIso() } as DailyCheckin)
}
export async function recentCheckins(days = 28): Promise<DailyCheckin[]> {
  const since = dayjs().subtract(days, 'day').format('YYYY-MM-DD')
  try { return (await db.checkins.where('date').aboveOrEqual(since).toArray()).sort((a, b) => a.date.localeCompare(b.date)) } catch { return [] }
}

// ---------- sticking points ----------
export interface StickingSummary {
  lift: LiftKey
  total: number
  counts: Record<string, number>
  trend: string | null
  suggestion: { tools: string[]; why: string } | null
}
export function stickingSummary(logs: WorkoutLog[]): StickingSummary[] {
  return (Object.keys(STICKING) as LiftKey[]).map((lift) => {
    const ids = lift === 'bench' ? [LIFT_EXERCISE.bench, 'paused-bench-press', 'close-grip-bench-press'] : [LIFT_EXERCISE[lift]]
    const counts: Record<string, number> = {}
    let total = 0
    for (const l of logs) for (const e of l.exercises) {
      if (!ids.includes(e.exerciseId)) continue
      for (const s of e.sets) if (s.done && s.sticking && STICKING[lift].includes(s.sticking)) { counts[s.sticking] = (counts[s.sticking] ?? 0) + 1; total++ }
    }
    let trend: string | null = null
    if (total >= STICKING_MIN_OBSERVATIONS) {
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (top && top[1] / total >= 0.5) trend = top[0]
    }
    return { lift, total, counts, trend, suggestion: trend ? STICKING_SUGGESTIONS[`${lift}:${trend}`] ?? null : null }
  })
}

// ---------- skill levels (motivational, never locks) ----------
export interface SkillLevel { treeId: string; level: Level; current: string; next?: string; detail: string }
function bestSet(logs: WorkoutLog[], id: string) {
  let kg = 0, reps = 0, e = 0
  for (const l of logs) for (const x of l.exercises) if (x.exerciseId === id) for (const s of x.sets) {
    if (!s.done || s.warmup) continue
    reps = Math.max(reps, s.reps ?? 0); kg = Math.max(kg, s.weightKg ?? 0)
    e = Math.max(e, e1rm(s.weightKg ?? 0, s.reps ?? 0))
  }
  return { kg, reps, e }
}
export function skillLevels(logs: WorkoutLog[], bodyweight: number, pullStage?: string): SkillLevel[] {
  const bw = bodyweight > 0 ? bodyweight : 90
  const rel = (id: string) => bestSet(logs, id).e / bw
  const out: SkillLevel[] = []
  // pull-up journey
  const pu = bestSet(logs, 'pull-up'), wpu = bestSet(logs, 'weighted-pull-up'), lp = bestSet(logs, 'lat-pulldown')
  let pl: Level = 'Foundation', pcur = pullStage ?? 'lat-pulldown', pdet = 'Building pulldown strength.'
  if (wpu.reps >= 5 || pu.reps >= 10) { pl = 'Advanced'; pdet = wpu.reps ? `Weighted pull-ups: ${wpu.reps} reps.` : `${pu.reps} bodyweight pull-ups.` }
  else if (pu.reps >= 1) { pl = 'Competent'; pdet = `Best: ${pu.reps} bodyweight pull-up${pu.reps === 1 ? '' : 's'}.` }
  else if (bestSet(logs, 'assisted-pull-up').reps > 0 || lp.kg >= bw * 0.7) { pl = 'Developing'; pdet = lp.kg ? `Pulldown ${lp.kg} kg (${Math.round(lp.kg / bw * 100)}% of bodyweight).` : 'Assisted pull-ups underway.' }
  out.push({ treeId: 'pull', level: pl, current: pcur, next: pl === 'Advanced' ? undefined : pl === 'Competent' ? 'weighted-pull-up' : pl === 'Developing' ? 'pull-up' : 'assisted-pull-up', detail: pdet })
  // barbell lifts relative to bodyweight (e1RM — estimates)
  const tier = (r: number, a: number, b: number, c: number): Level => (r >= c ? 'Advanced' : r >= b ? 'Competent' : r >= a ? 'Developing' : 'Foundation')
  const sq = rel('barbell-squat'), bp = rel('barbell-bench-press'), dl = rel('barbell-deadlift')
  out.push({ treeId: 'squat', level: tier(sq, 0.75, 1.25, 1.75), current: 'barbell-squat', detail: sq ? `Estimated 1RM ≈ ${sq.toFixed(2)}× bodyweight.` : 'No squats logged yet.' })
  out.push({ treeId: 'press', level: tier(bp, 0.5, 1.0, 1.4), current: 'barbell-bench-press', detail: bp ? `Estimated 1RM ≈ ${bp.toFixed(2)}× bodyweight.` : 'No bench logged yet.' })
  out.push({ treeId: 'hinge', level: tier(dl, 1.0, 1.5, 2.0), current: 'barbell-deadlift', detail: dl ? `Estimated 1RM ≈ ${dl.toFixed(2)}× bodyweight.` : 'No deadlifts logged yet.' })
  const push = bestSet(logs, 'push-up')
  out.push({ treeId: 'push', level: push.reps >= 25 ? 'Advanced' : push.reps >= 15 ? 'Competent' : push.reps >= 5 ? 'Developing' : 'Foundation', current: 'push-up', detail: push.reps ? `Best: ${push.reps} push-ups.` : 'No push-ups logged yet.' })
  const hkr = bestSet(logs, 'hanging-knee-raise'), hlr = bestSet(logs, 'hanging-leg-raise'), aw = bestSet(logs, 'ab-wheel-rollout')
  out.push({ treeId: 'core', level: aw.reps >= 8 ? 'Advanced' : hlr.reps >= 8 ? 'Competent' : hkr.reps >= 10 ? 'Developing' : 'Foundation', current: 'cable-crunch', detail: hkr.reps ? `Hanging knee raises: ${hkr.reps}.` : 'Core work not logged yet.' })
  return out.filter((s) => SKILL_TREES.some((t) => t.id === s.treeId))
}
export const LEVEL_NOTE = 'Levels are motivational markers built from what you have logged (strength levels use estimated 1RM relative to bodyweight). Nothing is locked — you can do any exercise at any time.'

// ---------- per-exercise PRs incl. volume ----------
export interface ExercisePRSet { bestKg?: { kg: number; reps: number; date: string }; bestReps?: { reps: number; kg: number; date: string }; bestE1rm?: { value: number; date: string }; bestVolume?: { kg: number; date: string } }
export function exercisePRSet(logs: WorkoutLog[], id: string): ExercisePRSet {
  const out: ExercisePRSet = {}
  for (const l of logs) {
    if (!l.finishedAt) continue
    for (const e of l.exercises) {
      if (e.exerciseId !== id) continue
      let vol = 0
      for (const s of e.sets) {
        if (!s.done || s.warmup || s.failed) continue
        const kg = s.weightKg ?? 0, reps = s.reps ?? 0
        vol += kg * reps
        if (kg > (out.bestKg?.kg ?? 0)) out.bestKg = { kg, reps, date: l.date }
        if (reps > (out.bestReps?.reps ?? 0)) out.bestReps = { reps, kg, date: l.date }
        const v = e1rm(kg, reps)
        if (v > (out.bestE1rm?.value ?? 0)) out.bestE1rm = { value: v, date: l.date }
      }
      if (vol > (out.bestVolume?.kg ?? 0)) out.bestVolume = { kg: vol, date: l.date }
    }
  }
  return out
}

export function programDayOf(log: WorkoutLog): { week: number; day: DayKey } | null { return parseDayId(log.dayId) }
export { DAY_ORDER }
export type { PlanExercise }

// ---------- restart from week 1 (owner, 21 Oct 2026: "start this week, 19 October") ----------
/**
 * Restart the 12-week program on the Tuesday of `start`'s week. The old plan is switched off
 * (never deleted) so every logged workout stays in history; the new plan keeps the old plan's
 * workouts — swaps, pull rung and exercises he added — but starts clean: week 1, no repeats,
 * skips, manual week or moved days.
 */
export async function restartProgram(start: string): Promise<Plan> {
  // the Tuesday of the Monday-to-Sunday week that contains `start`
  const tue = dayjs(start).subtract((dayjs(start).day() + 6) % 7, 'day').add(1, 'day').format('YYYY-MM-DD')
  const old = (await getProgramPlan()) ?? (await getAnyProgramPlan())
  const setup = (await getProgramSetup()) ?? {}
  const base: Plan = old ?? buildProgramPlan({ start: tue, setup, pullStage: setup.pullStage, cannotDo: setup.cannotDo })
  const { manualWeek: _m, pausedAt: _p, weekReviews: _r, loadAdjust: _l, ...rest } = base
  const next: Plan = { ...rest, id: newId(), startDate: tue, programStart: tue, repeatedWeeks: [], skippedWeeks: [], manualDeloads: [], moves: {}, active: true, createdAt: nowIso() }
  const all = await db.plans.toArray()
  await db.transaction('rw', db.plans, db.settings, async () => {
    for (const p of all) if (p.active) await db.plans.put({ ...p, active: false })
    await db.plans.put(next)
    const log = await getSetting<{ at: string; from?: string; to: string; start: string }[]>('p12:restarts', [])
    log.push({ at: nowIso(), from: old?.id, to: next.id, start: tue })
    await setSetting('p12:restarts', log)
  })
  return next
}
/** One-time: the restart he asked for on 21 Oct 2026 — week 1 = the week of Monday 19 October. */
export async function restartProgramOnce(): Promise<Plan | null> {
  const KEY = 'p12:restart:2026-10-19'
  if (await getSetting<boolean>(KEY, false)) return null
  const cur = await getProgramPlan()
  let plan: Plan | null = null
  if (!cur || (cur.programStart ?? cur.startDate) !== '2026-10-20') plan = await restartProgram('2026-10-19')
  await setSetting(KEY, true)
  return plan
}

// ---------- missed sessions → a day off ----------
export interface MissedSession { date: string; week: number; day: DayKey; title: string }
/** program days in the last 7 days (before today) that weren't done, skipped or moved */
export function missedSessions(plan: Plan, logs: WorkoutLog[], skips: Set<string>, today = todayStr()): MissedSession[] {
  const start = plan.programStart ?? plan.startDate
  const out: MissedSession[] = []
  for (let i = 7; i >= 1; i--) {
    const d = dayjs(today).subtract(i, 'day').format('YYYY-MM-DD')
    if (d < start) continue
    if ((plan.moves ?? {})[d]) continue
    const on = programDayOn(plan, d)
    if (!on || on.movedFrom) continue
    const id = dayIdFor(on.week, on.dk)
    if (skips.has(id)) continue
    if (logs.some((l) => l.planId === plan.id && l.dayId === id && l.finishedAt)) continue
    const pd = plan.weeks[on.week - 1]?.days.find((x) => x.id === id)
    out.push({ date: d, week: on.week, day: on.dk, title: pd?.title ?? 'Workout' })
  }
  return out
}
/** free days (no program workout, nothing moved there) from today over the next week — usually Sat, Sun, Mon */
export function freeDays(plan: Plan, today = todayStr()): string[] {
  const moves = plan.moves ?? {}
  const taken = new Set(Object.values(moves))
  return Array.from({ length: 7 }, (_, i) => dayjs(today).add(i, 'day').format('YYYY-MM-DD'))
    .filter((d) => !taken.has(d) && (dayKeyForDate(d) === null || !!moves[d]))
}
export async function moveMissed(plan: Plan, from: string, to: string): Promise<void> {
  await db.plans.put({ ...plan, moves: { ...(plan.moves ?? {}), [from]: to } })
}
