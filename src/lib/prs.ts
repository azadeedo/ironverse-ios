// ============================================================
// PR LEDGER — what he has actually done, read straight off his real logs.
//
// Nothing here invents data. Every record points at the session that set it,
// so a number can always be traced back to a day. Warm-up sets never count
// (isWorkingSet), which is why a ramp can't quietly become a personal best.
//
// The 1RM maths is Epley and lives in @/lib/training — it is NOT redefined here.
// ============================================================

import { byId } from '@/data/exercises'
import type { Muscle, WorkoutLog } from '@/db/types'
import { dayjs } from '@/lib/fmt'
import {
  bestsPerExercise, epley1RM, isWorkingSet, prsForSet, round1, sessionVolume,
  type ExerciseBest, type PRHit,
} from '@/lib/training'

// ------------------------------------------------------------------
// shapes
// ------------------------------------------------------------------

/** One record, plus the session it came from. */
export interface PRRecord {
  /** kg, reps or kg-volume depending on the record */
  value: number
  date: string
  logId: string
  /** one short human line, safe to render */
  detail: string
}

/** Best reps ever achieved at a specific load. */
export interface LoadBest {
  weightKg: number
  reps: number
  date: string
}

/** Heaviest load ever moved for a given rep count (1/3/5/8/10/12). */
export interface RepBest {
  reps: number
  weightKg: number
  date: string
  /** what that set estimates as a 1RM */
  e1rm: number
}

export interface ExercisePRs {
  exerciseId: string
  name: string
  /** primary muscles, for the muscle-group filter */
  muscles: Muscle[]
  /** sessions in which this lift was worked (working sets only) */
  sessions: number
  /** total working sets logged */
  hardSets: number
  lastTrained?: string
  /** heaviest weight ever moved for at least one rep */
  heaviest?: PRRecord
  /** best estimated 1RM */
  bestE1rm?: PRRecord
  /** biggest single-session volume for this lift */
  bestVolume?: PRRecord
  /** most reps in one set (the number that matters for bodyweight work) */
  bestReps?: PRRecord
  /** best reps at each load he has used, heaviest load first */
  loadBests: LoadBest[]
  /** heaviest load at the classic rep marks */
  repBests: RepBest[]
  /** the most recent date ANY of the above was set */
  lastPRDate?: string
  /** days since that date — how long the current bests have stood */
  standingDays?: number
  /** true when there simply isn't enough logged to call anything a record */
  thin: boolean
}

export const REP_MARKS = [1, 3, 5, 8, 10, 12] as const

// ------------------------------------------------------------------
// per-exercise bests
// ------------------------------------------------------------------

const asc = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)

/**
 * Every lift he has ever logged, with its current bests and the day each was
 * set. Sorted by most recently broken first — that is the list he wants to see.
 */
export function exercisePRs(logs: WorkoutLog[]): ExercisePRs[] {
  const sorted = [...logs].sort(asc)
  const acc = new Map<string, ExercisePRs>()
  /** exerciseId -> load -> best reps at that load */
  const loadMap = new Map<string, Map<number, LoadBest>>()
  /** exerciseId -> reps -> heaviest at that rep count */
  const repMap = new Map<string, Map<number, RepBest>>()

  for (const log of sorted) {
    // one session can list the same exercise twice (extra sets added mid-session)
    const sessionVol = new Map<string, number>()

    for (const entry of log.exercises) {
      const ex = byId.get(entry.exerciseId)
      let row = acc.get(entry.exerciseId)
      if (!row) {
        row = {
          exerciseId: entry.exerciseId,
          name: ex?.name ?? entry.exerciseId,
          muscles: ex?.primary ?? [],
          sessions: 0,
          hardSets: 0,
          loadBests: [],
          repBests: [],
          thin: true,
        }
        acc.set(entry.exerciseId, row)
      }

      let touched = false
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue
        const kg = s.weightKg ?? 0
        const reps = s.reps ?? 0
        if (reps <= 0 && kg <= 0 && !s.timeSec) continue
        touched = true
        row.hardSets += 1

        // most reps in a single set
        if (reps > 0 && (!row.bestReps || reps > row.bestReps.value)) {
          row.bestReps = {
            value: reps,
            date: log.date,
            logId: log.id,
            detail: kg > 0 ? `${reps} reps at ${round1(kg)} kg` : `${reps} reps`,
          }
        }

        if (kg > 0 && reps > 0) {
          sessionVol.set(entry.exerciseId, (sessionVol.get(entry.exerciseId) ?? 0) + kg * reps)

          if (!row.heaviest || kg > row.heaviest.value) {
            row.heaviest = {
              value: round1(kg),
              date: log.date,
              logId: log.id,
              detail: `${round1(kg)} kg for ${reps} ${reps === 1 ? 'rep' : 'reps'}`,
            }
          }

          const est = epley1RM(kg, reps)
          if (!row.bestE1rm || est > row.bestE1rm.value + 0.001) {
            row.bestE1rm = {
              value: round1(est),
              date: log.date,
              logId: log.id,
              detail: `${round1(kg)} kg × ${reps} — estimated, not a tested max`,
            }
          }

          // best reps at this exact load
          let loads = loadMap.get(entry.exerciseId)
          if (!loads) { loads = new Map(); loadMap.set(entry.exerciseId, loads) }
          const atLoad = loads.get(kg)
          if (!atLoad || reps > atLoad.reps) loads.set(kg, { weightKg: kg, reps, date: log.date })

          // heaviest load at the classic rep marks
          let reps2 = repMap.get(entry.exerciseId)
          if (!reps2) { reps2 = new Map(); repMap.set(entry.exerciseId, reps2) }
          for (const mark of REP_MARKS) {
            if (reps < mark) continue
            const cur = reps2.get(mark)
            if (!cur || kg > cur.weightKg) {
              reps2.set(mark, { reps: mark, weightKg: kg, date: log.date, e1rm: round1(epley1RM(kg, mark)) })
            }
          }
        }
      }

      if (touched) {
        row.sessions += 1
        row.lastTrained = log.date
      }
    }

    // single-session volume per lift
    for (const [exerciseId, vol] of sessionVol) {
      const row = acc.get(exerciseId)
      if (!row || vol <= 0) continue
      if (!row.bestVolume || vol > row.bestVolume.value) {
        row.bestVolume = {
          value: Math.round(vol),
          date: log.date,
          logId: log.id,
          detail: `${Math.round(vol).toLocaleString('en-AU')} kg moved in one session`,
        }
      }
    }
  }

  const out: ExercisePRs[] = []
  for (const row of acc.values()) {
    if (row.hardSets === 0) continue
    row.loadBests = [...(loadMap.get(row.exerciseId)?.values() ?? [])]
      .sort((a, b) => b.weightKg - a.weightKg)
    row.repBests = [...(repMap.get(row.exerciseId)?.values() ?? [])]
      .sort((a, b) => a.reps - b.reps)

    const dates = [row.heaviest?.date, row.bestE1rm?.date, row.bestVolume?.date, row.bestReps?.date]
      .filter(Boolean) as string[]
    if (dates.length > 0) {
      row.lastPRDate = dates.sort().slice(-1)[0]
      row.standingDays = Math.max(0, dayjs().startOf('day').diff(dayjs(row.lastPRDate), 'day'))
    }
    // one session with one set is a data point, not a record
    row.thin = row.sessions < 2 || row.hardSets < 3
    out.push(row)
  }

  return out.sort((a, b) => {
    const ad = a.lastPRDate ?? ''
    const bd = b.lastPRDate ?? ''
    if (ad !== bd) return bd.localeCompare(ad)
    return a.name.localeCompare(b.name)
  })
}

/** Just one lift, without rebuilding the whole ledger at the call site. */
export function prsForExercise(logs: WorkoutLog[], exerciseId: string): ExercisePRs | undefined {
  return exercisePRs(logs.filter((l) => l.exercises.some((e) => e.exerciseId === exerciseId)))
    .find((r) => r.exerciseId === exerciseId)
}

// ------------------------------------------------------------------
// when each PR happened (running, in date order)
// ------------------------------------------------------------------

export interface DatedPR extends PRHit {
  date: string
  logId: string
  /** the session it was set in */
  title: string
}

function mergeBest(into: ExerciseBest | undefined, add: ExerciseBest): ExerciseBest {
  if (!into) return { ...add }
  return {
    weightKg: Math.max(into.weightKg, add.weightKg),
    reps: Math.max(into.reps, add.reps),
    e1rm: Math.max(into.e1rm, add.e1rm),
    seen: into.seen || add.seen,
  }
}

/**
 * Walk the logs oldest → newest keeping running bests, so each PR is attributed
 * to the day it was actually broken. One pass over the history, not one per day.
 */
export function prTimeline(logs: WorkoutLog[]): DatedPR[] {
  const sorted = [...logs].sort(asc)
  const bests = new Map<string, ExerciseBest>()
  const out: DatedPR[] = []

  for (const log of sorted) {
    const claimed = new Set<string>()
    for (const entry of log.exercises) {
      // compare the session's BEST set so one lift yields at most one line per kind
      let best = null as (typeof entry.sets)[number] | null
      let bestScore = -1
      for (const s of entry.sets) {
        if (!isWorkingSet(s)) continue
        const score = (s.weightKg ?? 0) > 0
          ? epley1RM(s.weightKg ?? 0, s.reps ?? 0)
          : (s.reps ?? 0) / 1000
        if (score > bestScore) { bestScore = score; best = s }
      }
      if (best) {
        for (const hit of prsForSet(entry.exerciseId, best, bests.get(entry.exerciseId))) {
          const key = `${hit.exerciseId}:${hit.kind}`
          if (claimed.has(key)) continue
          claimed.add(key)
          out.push({ ...hit, date: log.date, logId: log.id, title: log.title })
        }
      }
    }
    // fold this session into the running bests
    const add = bestsPerExercise([log])
    for (const [id, b] of add) bests.set(id, mergeBest(bests.get(id), b))
  }

  return out
}

/** PRs grouped by the day they were set — what the calendar needs. */
export function prsByDate(logs: WorkoutLog[]): Map<string, DatedPR[]> {
  const map = new Map<string, DatedPR[]>()
  for (const pr of prTimeline(logs)) {
    const list = map.get(pr.date)
    if (list) list.push(pr)
    else map.set(pr.date, [pr])
  }
  return map
}

/** Everything broken in the last `days` days, newest first. */
export function recentPRs(logs: WorkoutLog[], days = 30): DatedPR[] {
  const from = dayjs().subtract(days, 'day').format('YYYY-MM-DD')
  return prTimeline(logs)
    .filter((p) => p.date >= from)
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ------------------------------------------------------------------
// session-level roll-up, for the calendar
// ------------------------------------------------------------------

export interface TrainingDay {
  date: string
  logId: string
  title: string
  /** minutes, when both timestamps exist */
  minutes?: number
  volumeKg: number
  hardSets: number
  finished: boolean
  prCount: number
}

export function trainingDays(logs: WorkoutLog[]): TrainingDay[] {
  const prs = prsByDate(logs)
  return [...logs].sort(asc).map((log) => {
    const minutes = log.startedAt && log.finishedAt
      ? Math.max(0, Math.round(dayjs(log.finishedAt).diff(dayjs(log.startedAt), 'minute')))
      : undefined
    let hardSets = 0
    for (const e of log.exercises) for (const s of e.sets) if (isWorkingSet(s)) hardSets += 1
    return {
      date: log.date,
      logId: log.id,
      title: log.title,
      minutes: minutes && minutes > 0 ? minutes : undefined,
      volumeKg: Math.round(sessionVolume(log)),
      hardSets,
      finished: Boolean(log.finishedAt),
      prCount: (prs.get(log.date) ?? []).filter((p) => p.logId === log.id).length,
    }
  })
}

/** Sessions per week for the last `weeks` weeks, oldest first (Monday-anchored). */
export interface WeekCount {
  weekStart: string
  label: string
  sessions: number
}

export function sessionsPerWeek(logs: WorkoutLog[], weeks = 8): WeekCount[] {
  const out: WeekCount[] = []
  const thisMonday = dayjs().subtract((dayjs().day() + 6) % 7, 'day').startOf('day')
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisMonday.subtract(i, 'week')
    const end = start.add(7, 'day')
    const from = start.format('YYYY-MM-DD')
    const to = end.format('YYYY-MM-DD')
    const days = new Set<string>()
    for (const l of logs) {
      if (l.date >= from && l.date < to) days.add(l.date)
    }
    out.push({ weekStart: from, label: start.format('D/M'), sessions: days.size })
  }
  return out
}
