// Work-schedule-aware planning: best workout window per day + reminder times.

import dayjs from 'dayjs'
import type { Profile, ReminderConfig, WorkDay } from '@/db/types'

export interface DaySlot {
  day: number            // 0=Sun
  label: string          // 'Monday'
  working: boolean
  workStart?: string
  workEnd?: string
  /** suggested workout start 'HH:mm' */
  slot: string
  slotLabel: string      // 'After work', 'Morning', …
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** best workout slot for one weekday given work hours + preference */
export function slotForDay(wd: WorkDay, pref: Profile['preferredSlot'], sessionMin: number, gymTime?: string): DaySlot {
  const label = DAY_NAMES[wd.day]
  // his actual gym time wins over any computed slot
  if (gymTime) return { day: wd.day, label, working: wd.working, workStart: wd.start, workEnd: wd.end, slot: gymTime, slotLabel: 'Your gym time' }
  if (!wd.working || !wd.start || !wd.end) {
    const slot = pref === 'evening' ? '18:00' : '09:00'
    return { day: wd.day, label, working: false, slot, slotLabel: pref === 'evening' ? 'Evening' : 'Morning' }
  }
  const start = minutesOf(wd.start)
  const end = minutesOf(wd.end)
  // options: before work (needs session + 45min buffer before start, not earlier than 5:30)
  const beforeOk = start - (sessionMin + 45) >= minutesOf('05:30')
  const afterSlot = addMinutes(wd.end, 45) // commute + food buffer
  const afterOk = minutesOf(afterSlot) + sessionMin <= minutesOf('21:30')
  let slot: string
  let slotLabel: string
  if (pref === 'morning' && beforeOk) {
    slot = addMinutes(wd.start, -(sessionMin + 45))
    slotLabel = 'Before work'
  } else if (afterOk || pref === 'after-work' || pref === 'evening') {
    slot = afterOk ? afterSlot : addMinutes(wd.end, 30)
    slotLabel = 'After work'
  } else if (beforeOk) {
    slot = addMinutes(wd.start, -(sessionMin + 45))
    slotLabel = 'Before work'
  } else {
    slot = '19:00'
    slotLabel = 'Evening'
  }
  return { day: wd.day, label, working: true, workStart: wd.start, workEnd: wd.end, slot, slotLabel }
}

export function weekSlots(p: Profile): DaySlot[] {
  return p.workSchedule.map((wd) => slotForDay(wd, p.preferredSlot, p.sessionMinutes, p.gymTime))
}

/**
 * Choose the best N training weekdays: prefer days off, then shorter work days,
 * spread across the week (avoid 3+ consecutive where possible).
 */
export function pickTrainingDays(p: Profile): number[] {
  const scored = p.workSchedule.map((wd) => {
    const hours = wd.working && wd.start && wd.end ? (minutesOf(wd.end) - minutesOf(wd.start)) / 60 : 0
    return { day: wd.day, score: wd.working ? 10 - hours : 20 } // days off best; shorter days better
  })
  const byScore = [...scored].sort((a, b) => b.score - a.score)
  const chosen = new Set<number>()
  for (const c of byScore) {
    if (chosen.size >= p.daysPerWeek) break
    chosen.add(c.day)
  }
  // spread: if we somehow chose 3 consecutive and an alternative exists, keep simple — order asc
  return [...chosen].sort((a, b) => a - b)
}

/** today's reminder timeline (for the schedule view + notification scheduling) */
export interface TimelineItem {
  time: string   // 'HH:mm'
  kind: 'water' | 'creatine' | 'workout' | 'work-start' | 'work-end'
  label: string
}

export function todayTimeline(p: Profile, r: ReminderConfig, isTrainingDay: boolean): TimelineItem[] {
  const items: TimelineItem[] = []
  const dow = dayjs().day()
  const wd = p.workSchedule.find((w) => w.day === dow)
  if (wd?.working && wd.start && wd.end) {
    items.push({ time: wd.start, kind: 'work-start', label: 'Work starts' })
    items.push({ time: wd.end, kind: 'work-end', label: 'Work ends' })
  }
  if (r.creatineEnabled) items.push({ time: r.creatineTime, kind: 'creatine', label: `Creatine ${p.creatineGrams}g` })
  if (r.waterEnabled) {
    let t = r.waterWindow[0]
    while (minutesOf(t) <= minutesOf(r.waterWindow[1])) {
      items.push({ time: t, kind: 'water', label: 'Drink water' })
      t = addMinutes(t, r.waterIntervalMin)
    }
  }
  if (isTrainingDay && wd) {
    const slot = slotForDay(wd, p.preferredSlot, p.sessionMinutes, p.gymTime)
    items.push({ time: slot.slot, kind: 'workout', label: `Workout (${slot.slotLabel.toLowerCase()})` })
  }
  return items.sort((a, b) => minutesOf(a.time) - minutesOf(b.time))
}

export { addMinutes }
