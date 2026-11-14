// ============================================================
// Programme recovery — "I've been away, rebuild my plan" (15 Nov 2026)
//
// Missing one session is handled by moving it. Missing weeks is different, and the
// remaining programme must NOT be squeezed into fewer weeks. What the research behind
// the programme says about a break:
//   • strength and muscle are largely kept for about 3 weeks off; after that some is lost,
//     and most of it comes back quickly once training restarts
//   • coming back, the first week should be lighter (fewer hard sets, ~10% lighter loads)
//     so joints and tendons catch up with the muscles
//   • a break of two weeks or more already did a deload's job, so the next planned
//     deload can be dropped
// The plan is built only from the existing controls (repeat / skip / "I'm on week N" /
// lighter loads for a week), so every logged workout and the plan's history stay exactly
// as they are, and the old schedule is saved so it can be put back.
// ============================================================

import dayjs from 'dayjs'
import type { Plan, WorkoutLog } from '@/db/types'
import { PHASES, parseDayId, programWeekFor } from '@/lib/program12'

export interface RecoveryInput {
  today: string
  /** weeks you have left for the programme (the user's own answer) */
  weeksLeft: number
  /** weeks away; when not given it is worked out from the last finished workout */
  weeksAway?: number
}

export interface RecoveryPlan {
  lastWeekDone: number
  lastWorkout?: string
  weeksAway: number
  /** the programme weeks, in order, one per calendar week from this week */
  sequence: { week: number; note: string }[]
  dropped: { week: number; why: string }[]
  repeated: number[]
  reentryWeek: number
  /** % lighter loads on the re-entry week */
  reentryLighterPct: number
  summary: string[]
}

const isDeload = (w: number) => !!PHASES[w - 1]?.deload

export function lastProgramWorkout(plan: Plan, logs: WorkoutLog[]): { week: number; date?: string } {
  let week = 0
  let date: string | undefined
  for (const l of logs) {
    if (l.planId !== plan.id || !l.finishedAt || !l.dayId) continue
    const w = parseDayId(l.dayId)?.week ?? 0
    if (w > week) week = w
    const d = (l.date ?? l.finishedAt).slice(0, 10)
    if (!date || d > date) date = d
  }
  return { week, date }
}

/** Time away, in whole weeks, since the last finished programme workout (0 if never trained). */
export function weeksAwayFrom(lastDate: string | undefined, today: string): number {
  if (!lastDate) return 0
  return Math.max(0, Math.floor(dayjs(today).diff(dayjs(lastDate), 'day') / 7))
}

export function buildRecoveryPlan(plan: Plan, logs: WorkoutLog[], input: RecoveryInput): RecoveryPlan {
  const last = lastProgramWorkout(plan, logs)
  const away = input.weeksAway ?? weeksAwayFrom(last.date, input.today)
  const left = Math.max(1, Math.min(16, Math.round(input.weeksLeft)))
  const summary: string[] = []
  const dropped: { week: number; why: string }[] = []

  // where to pick up: a long break (6+ weeks) restarts the current block; otherwise the
  // last week you finished is re-done lighter, then the programme carries on
  const blockStart = last.week >= 9 ? 9 : last.week >= 5 ? 5 : 1
  let reentry = Math.max(1, last.week)
  if (isDeload(reentry)) reentry = Math.min(12, reentry + 1)
  if (away >= 6) reentry = blockStart
  const lighter = away >= 6 ? 15 : away >= 3 ? 10 : away >= 2 ? 5 : 0

  let rest: number[] = []
  for (let w = reentry + 1; w <= 12; w++) if (!(plan.skippedWeeks ?? []).includes(w) || w === 12) rest.push(w)

  // the break already gave the recovery a deload gives
  if (away >= 2) {
    const nextDeload = rest.find((w) => isDeload(w))
    if (nextDeload) { rest = rest.filter((w) => w !== nextDeload); dropped.push({ week: nextDeload, why: 'your time off already did the job of this deload' }) }
  }

  let sequence = [reentry, ...rest]
  // too many weeks for the time left: drop, never squeeze. Least useful first.
  const dropOrder = [...rest.filter((w) => isDeload(w) && w !== 12), 11, 7, 6, 3, 2, 10, 9, 5]
  for (const w of dropOrder) {
    if (sequence.length <= left) break
    if (!sequence.includes(w) || w === 12 || w === reentry) continue
    sequence = sequence.filter((x) => x !== w)
    dropped.push({ week: w, why: w === 11 ? 'PR prep is shortened so the heavy weeks fit' : isDeload(w) ? 'one fewer deload to fit your weeks' : 'not enough weeks — kept the weeks that build the most' })
  }
  if (sequence.length > left) sequence = [...sequence.slice(0, left - 1), 12]
  // spare weeks: repeat the most productive heavy week before the peak
  const repeated: number[] = []
  const filler = [9, 6, 5, 2].find((w) => sequence.includes(w)) ?? sequence[Math.max(0, sequence.length - 2)]
  while (sequence.length < left) {
    const at = sequence.indexOf(filler)
    sequence.splice(at + 1, 0, filler)
    repeated.push(filler)
  }

  summary.push(away >= 1
    ? `You have been away about ${away} week${away === 1 ? '' : 's'}${last.date ? ` (last workout ${dayjs(last.date).format('D MMM')})` : ''}.`
    : 'You have not missed a full week, so the plan barely changes.')
  if (lighter) summary.push(`This week re-does week ${reentry} about ${lighter}% lighter with fewer hard sets, so you ease back in instead of picking up where you stopped.`)
  else summary.push(`You pick up at week ${reentry}.`)
  if (dropped.length) summary.push(`Dropped: ${dropped.map((d) => `week ${d.week} (${d.why})`).join('; ')}.`)
  if (repeated.length) summary.push(`You have spare weeks, so week ${repeated[0]} is repeated${repeated.length > 1 ? ` ${repeated.length} times` : ''} — more practice at the heavy work instead of rushing.`)
  summary.push(`Nothing is squeezed: one programme week per calendar week, ${sequence.length} week${sequence.length === 1 ? '' : 's'} in total. Your logged workouts stay exactly as they are.`)

  return {
    lastWeekDone: last.week,
    lastWorkout: last.date,
    weeksAway: away,
    sequence: sequence.map((w, i) => ({ week: w, note: i === 0 && lighter ? `${PHASES[w - 1]?.name ?? ''} · re-entry, ~${lighter}% lighter` : `${PHASES[w - 1]?.name ?? ''}${repeated.includes(w) && sequence.indexOf(w) !== i ? ' · repeat' : ''}` })),
    dropped,
    repeated,
    reentryWeek: reentry,
    reentryLighterPct: lighter,
    summary,
  }
}

/** The plan with the recovery applied (pure; the caller saves it and keeps the old one). */
export function applyRecovery(plan: Plan, rp: RecoveryPlan, today: string): Plan {
  const cw = Math.max(0, programWeekFor(plan, today).calendarWeek)
  const skipped = new Set<number>((plan.skippedWeeks ?? []).filter((w) => w > rp.reentryWeek))
  rp.dropped.forEach((d) => skipped.add(d.week))
  // weeks before the re-entry week are already behind you; keep them as they were
  ;(plan.skippedWeeks ?? []).filter((w) => w <= rp.reentryWeek).forEach((w) => skipped.add(w))
  skipped.delete(rp.reentryWeek)
  return {
    ...plan,
    skippedWeeks: [...skipped].sort((a, b) => a - b),
    repeatedWeeks: [...(plan.repeatedWeeks ?? []).filter((w) => w < rp.reentryWeek), ...rp.repeated],
    manualWeek: { calendarWeek: cw, week: rp.reentryWeek, setAt: new Date().toISOString() },
    loadAdjust: rp.reentryLighterPct ? { week: rp.reentryWeek, pct: rp.reentryLighterPct } : plan.loadAdjust,
  }
}
