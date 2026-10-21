// Shared bits for the Exercise Library module (list + detail screens).

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { ExerciseAnim } from '@/anim/rig'
import { Badge } from '@/components/ui'
import { equipmentLabel,
  PATTERN_LABELS,
  type EquipmentProfile, type Exercise, type ExerciseKind, type ExerciseMeta,
  type ExerciseTier, type MovementPattern, type Muscle, type WorkoutLog,
} from '@/db/types'
import { MUSCLE_LABELS } from '@/db/types'
import { getCurrentProfile, isAvailable } from '@/lib/equipment'
import { inferQuality, qualityScore, sameRole, isRealUpgrade, upgradeReason } from '@/lib/quality'
import { EXERCISES } from '@/data/exercises'
import { nowIso } from '@/lib/id'

// ---------- constants ----------
export const KIND_ORDER: ExerciseKind[] = ['strength', 'core', 'cardio', 'mobility']
export const KIND_LABELS: Record<ExerciseKind, string> = {
  strength: 'Strength', core: 'Core', cardio: 'Cardio', mobility: 'Mobility',
}

// ---------- live data hooks ----------
export function useProfileLive() {
  return useLiveQuery(() => db.profile.get('me'), [])
}

export function useWorkoutLogsLive(): WorkoutLog[] | undefined {
  return useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])
}

// ---------- visibility-gated mini animation (perf cap for long lists) ----------
/** Renders an ExerciseAnim that only plays while scrolled into view, so a long
 *  list never runs more rAF loops than there are rows on screen. */
export function VisibleAnim({ exercise, size = 72, className = '' }: {
  exercise: Exercise; size?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { rootMargin: '60px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface3/60 ${className}`}
      style={{ width: size, height: size }}
    >
      <ExerciseAnim def={exercise.anim} size={size - 6} playing={visible} />
    </div>
  )
}

// ---------- text helpers ----------
export function equipmentSummary(ex: Exercise): string {
  return ex.equipment.map((e) => equipmentLabel(e)).join(' · ')
}

/** every word of the query must appear in name / muscles / equipment */
export function matchesQuery(ex: Exercise, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = [
    ex.name, ex.id.replace(/-/g, ' '),
    ...ex.primary.map((m) => MUSCLE_LABELS[m]),
    ...ex.secondary.map((m) => MUSCLE_LABELS[m]),
    ...ex.equipment.map((e) => equipmentLabel(e)),
  ].join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}

// ---------- strength maths ----------
/** Epley estimated 1RM. Reps of 1 return the weight itself. */
export function epley1Rm(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30)
}

// ---------- badges ----------
export function MuscleBadges({ muscles, tone = 'brand', max = 3 }: {
  muscles: Muscle[]; tone?: 'brand' | 'gray'; max?: number
}) {
  const shown = muscles.slice(0, max)
  const extra = muscles.length - shown.length
  return (
    <>
      {shown.map((m) => (
        <Badge key={m} tone={tone}>{MUSCLE_LABELS[m]}</Badge>
      ))}
      {extra > 0 && <Badge tone="gray">+{extra}</Badge>}
    </>
  )
}

// ---------- exercise history (derived from workout logs) ----------
export interface HistorySession {
  date: string
  volumeKg: number
  reps: number
  seconds: number
  topWeightKg?: number
}

export interface ExerciseHistory {
  sessions: HistorySession[]        // ascending by date, only sessions with done work
  totalSessions: number
  lastDate?: string
  lastWeightKg?: number             // top weight of the most recent session
  best?: { weightKg: number; reps: number; e1rm: number; date: string }
  bestReps?: number
  bestTimeSec?: number
}

// ============================================================
// v3 — library upgrades: pinning, quality filters, better options.
// ============================================================

/**
 * The pin flag rides on the EXISTING exerciseMeta row. No new Dexie table, no
 * schema bump: Dexie stores the extra keys, and every other writer of this table
 * spreads the existing record, so a pin survives a note or an injury flag.
 */
export interface ExerciseMetaPlus extends ExerciseMeta {
  pinned?: boolean
  pinnedAt?: string
}

export function useExerciseMetaLive(): Map<string, ExerciseMetaPlus> | undefined {
  const rows = useLiveQuery(() => db.exerciseMeta.toArray(), [])
  if (!rows) return undefined
  return new Map((rows as ExerciseMetaPlus[]).map((r) => [r.exerciseId, r]))
}

export function usePinnedLive(): Set<string> {
  const meta = useExerciseMetaLive()
  const out = new Set<string>()
  if (!meta) return out
  for (const [id, m] of meta) if (m.pinned) out.add(id)
  return out
}

export const isPinned = (m?: ExerciseMetaPlus): boolean => m?.pinned === true

/** Toggle a favourite. Returns the new state. Never throws at the call site. */
export async function togglePinned(exerciseId: string): Promise<boolean> {
  try {
    const existing = (await db.exerciseMeta.get(exerciseId)) as ExerciseMetaPlus | undefined
    const next = !(existing?.pinned === true)
    const row: ExerciseMetaPlus = {
      ...existing,
      exerciseId,
      pinned: next,
      pinnedAt: next ? nowIso() : undefined,
      updatedAt: nowIso(),
    }
    await db.exerciseMeta.put(row)
    return next
  } catch {
    return false
  }
}

/** The equipment profile he is training on right now. */
export function useCurrentEquipment(): EquipmentProfile | undefined {
  return useLiveQuery(() => getCurrentProfile(), [])
}

// ---------- quality helpers for the list filters ----------
export const patternOf = (ex: Exercise): MovementPattern => inferQuality(ex).pattern
export const tierOf = (ex: Exercise): ExerciseTier => inferQuality(ex).tier
export const patternLabel = (p: MovementPattern): string => PATTERN_LABELS[p]

export const TIER_LABELS: Record<ExerciseTier, string> = {
  1: 'Tier 1 — best option',
  2: 'Tier 2 — very good',
  3: 'Tier 3 — solid',
  4: 'Tier 4 — it works',
}

export const TIER_SHORT: Record<ExerciseTier, string> = {
  1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Tier 4',
}

export const TIER_TONE: Record<ExerciseTier, 'brand' | 'green' | 'gray'> = {
  1: 'brand', 2: 'green', 3: 'gray', 4: 'gray',
}

export function availableHere(ex: Exercise, profile?: EquipmentProfile): boolean {
  return profile ? isAvailable(ex, profile) : true
}

// ---------- better options ----------
export interface BetterOption {
  exercise: Exercise
  reason: string
  /** clears the churn margin — genuinely worth switching for */
  strong: boolean
}

/**
 * Same pattern, same role, available at THIS location, ranked by quality.
 * Only exercises that actually score better than the current one are offered —
 * a sideways move is noise, not a suggestion.
 */
export function betterOptions(ex: Exercise, profile?: EquipmentProfile, max = 6): BetterOption[] {
  if (!profile) return []
  const pattern = patternOf(ex)
  const primary = new Set(ex.primary)
  const base = qualityScore(ex)
  return EXERCISES
    .filter((c) => c.id !== ex.id)
    .filter((c) => c.kind === ex.kind)
    .filter((c) => patternOf(c) === pattern)
    .filter((c) => sameRole(ex, c))
    .filter((c) => c.primary.some((m) => primary.has(m)))
    .filter((c) => isAvailable(c, profile))
    .filter((c) => qualityScore(c) < base)
    .sort((a, b) => qualityScore(a) - qualityScore(b))
    .slice(0, max)
    .map((c) => ({
      exercise: c,
      reason: upgradeReason(ex, c, profile.name),
      strong: isRealUpgrade(ex, c),
    }))
}

export function buildHistory(logs: WorkoutLog[], exerciseId: string): ExerciseHistory {
  const sessions: HistorySession[] = []
  let best: ExerciseHistory['best']
  let bestReps = 0
  let bestTimeSec = 0

  for (const log of logs) {
    const entries = log.exercises.filter((e) => e.exerciseId === exerciseId)
    if (entries.length === 0) continue
    let volumeKg = 0
    let reps = 0
    let seconds = 0
    let topWeightKg: number | undefined
    for (const entry of entries) {
      for (const s of entry.sets) {
        if (!s.done) continue
        const r = s.reps ?? 0
        const w = s.weightKg ?? 0
        const t = s.timeSec ?? 0
        reps += r
        seconds += t
        if (w > 0 && r > 0) {
          volumeKg += w * r
          if (topWeightKg === undefined || w > topWeightKg) topWeightKg = w
          const e1rm = epley1Rm(w, r)
          if (!best || e1rm > best.e1rm) best = { weightKg: w, reps: r, e1rm, date: log.date }
        }
        if (r > bestReps) bestReps = r
        if (t > bestTimeSec) bestTimeSec = t
      }
    }
    if (volumeKg > 0 || reps > 0 || seconds > 0) {
      sessions.push({ date: log.date, volumeKg, reps, seconds, topWeightKg })
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date))
  const last = sessions[sessions.length - 1]
  return {
    sessions,
    totalSessions: sessions.length,
    lastDate: last?.date,
    lastWeightKg: last?.topWeightKg,
    best,
    bestReps: bestReps > 0 ? bestReps : undefined,
    bestTimeSec: bestTimeSec > 0 ? bestTimeSec : undefined,
  }
}
