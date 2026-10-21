// ============================================================
// Programs — the three ways a coach can take over, and the way back.
//
// Rules this file lives by:
//  · "Just today" and "This week" NEVER touch the saved plan. They write
//    ProgramOverride rows, which the Today screen reads through
//    effectiveDayForDate(). Cancelling deletes only those rows.
//  · "The whole block" writes a real Plan and DEACTIVATES the previous one.
//    Nothing is ever deleted, so "Back to my own plan" can always undo it.
// ============================================================

import { db } from '@/db'
import { newId, nowIso, todayStr } from '@/lib/id'
import {
  buildCoachSession, dayForDate, generateCoachPlan, mondayOf, sanitiseOverride,
} from '@/lib/plangen'
import { getCoach } from '@/data/coaches'
import type { CoachId, Muscle, Plan, ProgramOverride, Profile } from '@/db/types'

/** Fallback focus when the date is a rest day (or there is no plan at all). */
const GENERIC_FOCUS: Muscle[] = ['chest', 'lats', 'front-delts', 'quads', 'biceps', 'abs']

// ---------- reads ----------

/** Every override touching `date` — its own day row plus that week's rows. */
export async function overridesForDate(date: string): Promise<ProgramOverride[]> {
  try {
    const monday = mondayOf(date)
    const rows = await db.programOverrides
      .where('date')
      .anyOf([date, monday])
      .toArray()
    return rows
      .map(sanitiseOverride)
      .filter((o): o is ProgramOverride => o !== null && Boolean(o.id))
  } catch {
    return []
  }
}

export async function allOverrides(): Promise<ProgramOverride[]> {
  try {
    const rows = await db.programOverrides.toArray()
    return rows
      .map((r) => {
        const clean = sanitiseOverride(r)
        return clean && clean.id ? clean : null
      })
      .filter((o): o is ProgramOverride => o !== null)
  } catch {
    return []
  }
}

// ---------- mode 1: just today ----------

/**
 * Swap ONE day for the coach's version. The plan is not modified in any way —
 * cancel this and today goes straight back to what the plan said.
 */
export async function applyDayOverride(
  coachId: CoachId,
  profile: Profile,
  plan: Plan | null | undefined,
  date = todayStr(),
): Promise<ProgramOverride | null> {
  const coach = getCoach(coachId)
  if (!coach) return null

  const ref = plan ? safeDayForDate(plan, date) : null
  const title = ref?.day.title ?? 'Coach session'
  const focus = ref?.day.focus?.length ? ref.day.focus : GENERIC_FOCUS

  const session = buildCoachSession(coachId, profile, { title, focus })
  if (!session) return null

  const row: ProgramOverride = {
    id: newId(),
    coach: coachId,
    scope: 'day',
    date,
    exercises: session.exercises,
    title,
    note: `${coach.name} — just for today. Your plan is untouched.`,
    createdAt: nowIso(),
  }

  // one day override per date: replace rather than stack
  await db.programOverrides.where('date').equals(date).and((o) => o.scope === 'day').delete()
  await db.programOverrides.add(row)
  return row
}

// ---------- mode 2: this week ----------

/**
 * Swap this week's training days for the coach's versions, KEEPING his split:
 * one override per distinct plan-day title, all anchored on the week's Monday.
 * Rest days stay rest days.
 */
export async function applyWeekOverride(
  coachId: CoachId,
  profile: Profile,
  plan: Plan | null | undefined,
  anyDateInWeek = todayStr(),
): Promise<number> {
  const coach = getCoach(coachId)
  if (!coach) return 0
  const monday = mondayOf(anyDateInWeek)

  // the distinct day titles the plan trains this week (in order)
  const days: { title: string; focus: Muscle[] }[] = []
  if (plan) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i)
      const ref = safeDayForDate(plan, d)
      if (!ref) continue
      if (days.some((x) => x.title === ref.day.title)) continue
      days.push({ title: ref.day.title, focus: ref.day.focus })
    }
  }
  if (!days.length) days.push({ title: 'Coach session', focus: GENERIC_FOCUS })

  const rows: ProgramOverride[] = []
  for (const d of days) {
    const session = buildCoachSession(coachId, profile, { title: d.title, focus: d.focus })
    if (!session) continue
    rows.push({
      id: newId(),
      coach: coachId,
      scope: 'week',
      date: monday,
      exercises: session.exercises,
      title: d.title,
      note: `${coach.name} — this week only. Your plan is untouched.`,
      createdAt: nowIso(),
    })
  }
  if (!rows.length) return 0

  await db.programOverrides.where('date').equals(monday).and((o) => o.scope === 'week').delete()
  await db.programOverrides.bulkAdd(rows)
  return rows.length
}

// ---------- mode 3: the whole block ----------

/**
 * Generate a full 4/8/12-week block in the coach's style, make it active and
 * DEACTIVATE the previous plan. The old plan is kept forever — see
 * restorePlan() — and no workout history is affected.
 */
export async function applyBlock(
  coachId: CoachId,
  profile: Profile,
  blockWeeks: number,
): Promise<Plan | null> {
  const fresh = generateCoachPlan(profile, coachId, blockWeeks)
  if (!fresh) return null
  await db.transaction('rw', db.plans, async () => {
    await db.plans.toCollection().modify((p) => { p.active = false })
    await db.plans.add(fresh)
  })
  return fresh
}

// ---------- undo ----------

export async function cancelOverride(id: string): Promise<void> {
  if (!id) return
  await db.programOverrides.delete(id)
}

/** Cancel every override in the week containing `date` (day rows included). */
export async function cancelOverridesForWeek(date = todayStr()): Promise<void> {
  const monday = mondayOf(date)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  await db.programOverrides.where('date').anyOf([...dates, monday]).delete()
}

/** Make a previously saved plan active again. Never deletes anything. */
export async function restorePlan(planId: string): Promise<void> {
  if (!planId) return
  await db.transaction('rw', db.plans, async () => {
    await db.plans.toCollection().modify((p) => { p.active = false })
    await db.plans.update(planId, { active: true })
  })
}

// ---------- small helpers ----------

function safeDayForDate(plan: Plan, date: string) {
  try {
    return dayForDate(plan, date)
  } catch {
    return null
  }
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  d.setDate(d.getDate() + n)
  return todayStr(d)
}
