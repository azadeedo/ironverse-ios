// ============================================================
// ADVANCED SET TYPES — drop sets, rest-pause, myo-reps, clusters, AMRAP.
//
// ---- STORAGE CHOICE (read this before changing anything) ----
// db/types.ts is NOT touched. A workout's exercise entry is
// `{ exerciseId, sets, swappedFrom? }`; we attach ONE extra optional string
// field, `setModes`, holding a small JSON blob keyed by setIndex:
//
//   { "1": { "mode": "drop", "parts": [{ "reps": 8, "weightKg": 40 }] } }
//
// Why a serialised field on the entry rather than new SetLog fields:
//   • v1/v2 rows have no `setModes` — every reader here defaults to "no mode",
//     so a plain straight-set session is byte-for-byte unchanged.
//   • Dexie stores the entry as plain JSON, so an unknown extra key round-trips
//     safely and `structuredClone` in the session committer keeps it.
//   • It stays WITH the log, so history can label a drop set honestly instead
//     of guessing from the numbers.
//
// ---- HARD-SET HONESTY ----
// `weeklyHardSets` in lib/training counts every completed non-warm-up SetLog
// once. So drops, mini-sets and clusters are NEVER written as extra SetLog
// rows — they live in `parts` on the single working set they belong to. One
// extended set = one hard set, which is the honest count. Their reps and load
// are still recorded, and `extraVolumeKg` lets volume include them.
// ============================================================

import type { SetLog, WorkoutLog } from '@/db/types'
import { achievableLoads, type AnyLoadMode, type LoadSource } from '@/lib/plates'

// ---------- the modes ----------
export type SetMode = 'drop' | 'rest-pause' | 'myo' | 'cluster' | 'amrap'

export interface ModePart {
  /** reps completed in this drop / mini-set / cluster */
  reps: number
  /** load used, when it changed (drop sets) */
  weightKg?: number
  /** seconds, for timed work */
  seconds?: number
}

export interface SetModePlan {
  mode: SetMode
  /** completed extensions, in the order they were done */
  parts: ModePart[]
  /** AMRAP / timed set: the countdown length chosen */
  targetSec?: number
  /** cluster: intra-set rest chosen */
  intraRestSec?: number
  /** drop: how many drops he's aiming for */
  targetParts?: number
}

export type SetModeMap = Record<number, SetModePlan>

/** The WorkoutLog exercise entry, plus our serialised mode field. */
export type ModedEntry = WorkoutLog['exercises'][number] & { setModes?: string }

export interface ModeInfo {
  label: string
  /** one-line tag used in lists and history */
  short: string
  /** what it actually is */
  what: string
  /** when it's worth using — and when it isn't */
  when: string
  /** the rest the guide drives between parts, in seconds */
  partRestSec: number
  /** what one "part" is called in the UI */
  partNoun: string
  /** does a part use a lighter load? */
  dropsLoad?: boolean
}

export const MODE_INFO: Record<SetMode, ModeInfo> = {
  drop: {
    label: 'Drop set',
    short: 'Drop',
    what: 'Take the working set to near failure, strip the load straight away and keep going with no real rest. Usually one or two drops.',
    when: 'Best on machines, cables and dumbbells where you can change the load in seconds. Worth it on your last set of an isolation lift when you want more stimulus without more time. Not worth it on heavy barbell work.',
    partRestSec: 10,
    partNoun: 'drop',
    dropsLoad: true,
  },
  'rest-pause': {
    label: 'Rest-pause',
    short: 'Rest-pause',
    what: 'Work set to 0-1 reps in reserve, rack it, rest 15-20 seconds, then squeeze out another mini-set at the same load. Repeat once or twice.',
    when: 'Good on stable lifts you can re-rack safely on your own. A cheap way to add hard reps when you are short on time. Skip it on lifts where failing is awkward.',
    partRestSec: 18,
    partNoun: 'mini-set',
  },
  myo: {
    label: 'Myo-reps',
    short: 'Myo',
    what: 'One activation set taken close to failure, then short clusters of 3-5 reps with about 15 seconds between them, stopping when the reps fall off.',
    when: 'Made for isolation and machine work with a lighter load (12-20 rep range). High stimulus per minute. Keep it away from heavy compounds.',
    partRestSec: 15,
    partNoun: 'cluster',
  },
  cluster: {
    label: 'Cluster set',
    short: 'Cluster',
    what: 'Break one set into small blocks with a fixed intra-set rest — for example 3 + 3 + 3 with 20 seconds between each block.',
    when: 'Lets you hold a heavier load for more total reps. Useful on strength work when the goal is quality reps rather than pure fatigue.',
    partRestSec: 20,
    partNoun: 'cluster',
  },
  amrap: {
    label: 'AMRAP / timed',
    short: 'AMRAP',
    what: 'A countdown instead of a rep target: work for the time set, then log the reps you actually got.',
    when: 'Good as a finisher, or as an honest benchmark you can compare week to week. Not for lifts where form breaks down when you chase reps.',
    partRestSec: 0,
    partNoun: 'round',
  },
}

export const SET_MODES: SetMode[] = ['drop', 'rest-pause', 'myo', 'cluster', 'amrap']

// ---------- read / write ----------

/** Every mode on this entry. A v1/v2 entry (no field) reads as empty. */
export function readSetModes(entry: ModedEntry | null | undefined): SetModeMap {
  if (!entry?.setModes) return {}
  try {
    const parsed: unknown = JSON.parse(entry.setModes)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: SetModeMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const idx = Number(k)
      const plan = v as Partial<SetModePlan>
      if (!Number.isFinite(idx) || !plan || typeof plan !== 'object') continue
      if (!SET_MODES.includes(plan.mode as SetMode)) continue
      out[idx] = {
        mode: plan.mode as SetMode,
        parts: Array.isArray(plan.parts) ? plan.parts.filter((p) => typeof p?.reps === 'number') : [],
        targetSec: typeof plan.targetSec === 'number' ? plan.targetSec : undefined,
        intraRestSec: typeof plan.intraRestSec === 'number' ? plan.intraRestSec : undefined,
        targetParts: typeof plan.targetParts === 'number' ? plan.targetParts : undefined,
      }
    }
    return out
  } catch {
    // a corrupt blob must never break the session — fall back to straight sets
    return {}
  }
}

/** The mode on one set, or undefined for a plain straight set. */
export function setModeAt(entry: ModedEntry | null | undefined, setIndex: number): SetModePlan | undefined {
  return readSetModes(entry)[setIndex]
}

/**
 * Write the whole map back onto the entry (mutates the draft — call it inside
 * the session's commit()). Writing an empty map REMOVES the field, so a session
 * where he never used a mode is stored exactly as it always was.
 */
export function writeSetModes(entry: ModedEntry, map: SetModeMap): void {
  const cleaned: SetModeMap = {}
  for (const [k, plan] of Object.entries(map)) {
    if (!plan) continue
    cleaned[Number(k)] = plan
  }
  if (Object.keys(cleaned).length === 0) {
    delete entry.setModes
    return
  }
  entry.setModes = JSON.stringify(cleaned)
}

/** Set (or clear, with `undefined`) the mode on one set. Mutates the draft. */
export function setSetMode(entry: ModedEntry, setIndex: number, plan: SetModePlan | undefined): void {
  const map = readSetModes(entry)
  if (plan) map[setIndex] = plan
  else delete map[setIndex]
  writeSetModes(entry, map)
}

/** Append a completed drop / mini-set / cluster. Mutates the draft. */
export function addModePart(entry: ModedEntry, setIndex: number, part: ModePart): void {
  const map = readSetModes(entry)
  const plan = map[setIndex]
  if (!plan) return
  map[setIndex] = { ...plan, parts: [...plan.parts, part] }
  writeSetModes(entry, map)
}

/** Remove the last logged part (an undo for a mis-tap). Mutates the draft. */
export function popModePart(entry: ModedEntry, setIndex: number): void {
  const map = readSetModes(entry)
  const plan = map[setIndex]
  if (!plan || plan.parts.length === 0) return
  map[setIndex] = { ...plan, parts: plan.parts.slice(0, -1) }
  writeSetModes(entry, map)
}

/** A fresh plan with sensible defaults for the mode. */
export function newPlan(mode: SetMode, set?: SetLog): SetModePlan {
  const info = MODE_INFO[mode]
  return {
    mode,
    parts: [],
    targetSec: mode === 'amrap' ? (set?.timeSec ?? 60) : undefined,
    intraRestSec: mode === 'cluster' ? info.partRestSec : undefined,
    targetParts: mode === 'drop' ? 2 : mode === 'rest-pause' || mode === 'myo' ? 3 : undefined,
  }
}

// ---------- honest accounting ----------

/** Reps logged in the extensions, on top of the working set's own reps. */
export function extraReps(plan: SetModePlan | undefined): number {
  return plan?.parts.reduce((n, p) => n + (p.reps || 0), 0) ?? 0
}

/**
 * Volume the extensions added, kg. Parts without their own load fall back to
 * the working set's load (rest-pause, myo and clusters keep the same weight).
 */
export function extraVolumeKg(plan: SetModePlan | undefined, set: SetLog | undefined): number {
  if (!plan || !set?.done || set.warmup) return 0
  return plan.parts.reduce((v, p) => v + (p.reps || 0) * (p.weightKg ?? set.weightKg ?? 0), 0)
}

/** Extra volume across a whole exercise entry. */
export function entryExtraVolumeKg(entry: ModedEntry | null | undefined): number {
  if (!entry) return 0
  const map = readSetModes(entry)
  let total = 0
  for (const [k, plan] of Object.entries(map)) {
    total += extraVolumeKg(plan, entry.sets[Number(k)])
  }
  return total
}

/**
 * Hard sets contributed by one exercise entry, counted exactly the way
 * lib/training.weeklyHardSets counts them: one per completed working SetLog.
 * Extensions add reps and volume, never another hard set.
 */
export function hardSetCount(entry: ModedEntry | null | undefined): number {
  return entry?.sets.filter((s) => s.done && !s.warmup).length ?? 0
}

/** 'Drop set · 8 + 5 + 4 reps' — the label history should show. */
export function modeSummary(plan: SetModePlan | undefined, set: SetLog | undefined): string | undefined {
  if (!plan) return undefined
  const info = MODE_INFO[plan.mode]
  const base = set?.reps
  const reps = [base, ...plan.parts.map((p) => p.reps)].filter((n): n is number => typeof n === 'number' && n > 0)
  if (reps.length <= 1) return info.label
  return `${info.label} · ${reps.join(' + ')} reps`
}

/** Short chip text for a set row. */
export function modeChip(plan: SetModePlan | undefined): string | undefined {
  if (!plan) return undefined
  const info = MODE_INFO[plan.mode]
  return plan.parts.length > 0 ? `${info.short} ×${plan.parts.length}` : info.short
}

// ---------- load maths for drop sets ----------

/**
 * The next ACHIEVABLE load DOWN for a drop, on the current equipment profile.
 * Aims at `pct` lighter (20% by default — the usual drop) and snaps to the
 * heaviest load at or below that, never returning something he can't build.
 */
export function dropLoad(
  mode: AnyLoadMode,
  currentKg: number | undefined,
  source: LoadSource | null | undefined,
  pct = 0.2,
): number | undefined {
  if (currentKg === undefined || !source) return undefined
  const options = achievableLoads(mode, source)
  if (options.length === 0) return undefined
  const below = options.filter((o) => o < currentKg - 0.01)
  if (below.length === 0) return undefined
  const want = currentKg * (1 - pct)
  // heaviest option at or below the target; if the jumps are coarse, take the
  // next one down rather than dropping further than he asked for
  const atOrBelow = below.filter((o) => o <= want + 0.01)
  return atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : below[below.length - 1]
}

// ---------- the guided flow ----------

export interface GuideStep {
  /** what to do right now */
  text: string
  /** the primary action's label, when there is one */
  action?: string
  /** seconds to put on the global rest timer with this step */
  restSec?: number
  /** true once there's nothing left to do on this set */
  done?: boolean
}

/**
 * What the app should tell him next. Deliberately one instruction at a time —
 * mid-set is no place for a wall of text.
 */
export function guideStep(
  plan: SetModePlan,
  set: SetLog | undefined,
  nextLoadKg?: number,
): GuideStep {
  const info = MODE_INFO[plan.mode]
  const n = plan.parts.length
  const target = plan.targetParts ?? 2
  const workDone = set?.done === true

  if (!workDone) {
    switch (plan.mode) {
      case 'drop':
        return { text: 'Working set first — take it to 0-1 reps in reserve, then tick it and strip the weight.' }
      case 'rest-pause':
        return { text: 'Working set to 0-1 reps in reserve, then tick it and start the 15-20s clock.' }
      case 'myo':
        return { text: 'Activation set: same load, close to failure. Tick it and the clusters start.' }
      case 'cluster':
        return { text: `Block one — then ${plan.intraRestSec ?? info.partRestSec}s rest before the next block.` }
      case 'amrap':
        return { text: `Start the clock and keep going for ${plan.targetSec ?? 60}s. Log the reps when it stops.` }
    }
  }

  if (plan.mode === 'amrap') {
    return n > 0
      ? { text: `Logged ${plan.parts[0].reps} reps in ${plan.targetSec ?? 60}s. That's the set.`, done: true }
      : { text: 'Time is up — log the reps you got.', action: 'Log reps' }
  }

  if (n >= target) {
    return { text: `${n} ${info.partNoun}${n === 1 ? '' : 's'} logged — that's the set. Take your full rest.`, done: true }
  }

  if (plan.mode === 'drop') {
    const load = nextLoadKg !== undefined ? `${nextLoadKg} kg` : 'a lighter load'
    return {
      text: `Drop to ${load} and go again straight away — no rest, reps to failure.`,
      action: `Log drop ${n + 1}`,
      restSec: info.partRestSec,
    }
  }

  return {
    text:
      plan.mode === 'cluster'
        ? `Rest ${plan.intraRestSec ?? info.partRestSec}s, then block ${n + 2}.`
        : `Rest ${info.partRestSec}s, then ${info.partNoun} ${n + 1} at the same load.`,
    action: `Log ${info.partNoun} ${n + 1}`,
    restSec: plan.intraRestSec ?? info.partRestSec,
  }
}

// ---------- tempo ----------

export interface Tempo {
  /** eccentric (lowering) seconds */
  down: number
  /** pause in the stretched position */
  pause: number
  /** concentric (lifting) seconds; 0 = as fast as you can control */
  up: number
  /** pause at the top */
  top: number
  /** '3-1-1' */
  code: string
  /** the original string, e.g. '3-1-1 — slow on the way down' */
  raw: string
}

/**
 * Parse a tempo string like '3-1-1', '3010' or '2-0-X-0 — control the drop'.
 * 'X' means explosive and is modelled as 1s so the guide keeps moving.
 * Returns null for anything that isn't a tempo, so callers just skip the guide.
 */
export function parseTempo(raw: string | undefined): Tempo | null {
  if (!raw) return null
  const m = raw.match(/(\d|x|X)\s*[-–/]\s*(\d|x|X)\s*[-–/]\s*(\d|x|X)(?:\s*[-–/]\s*(\d|x|X))?/)
  let nums: number[] | null = null
  if (m) {
    nums = [m[1], m[2], m[3], m[4] ?? '0'].map((c) => (/^[xX]$/.test(c) ? 1 : Number(c)))
  } else {
    const digits = raw.match(/\b(\d)(\d)(\d)(\d)?\b/)
    if (digits) nums = [digits[1], digits[2], digits[3], digits[4] ?? '0'].map(Number)
  }
  if (!nums || nums.some((n) => !Number.isFinite(n))) return null
  const [down, pause, up, top] = nums
  if (down + pause + up + top <= 0) return null
  return {
    down,
    pause,
    up,
    top,
    code: `${down}-${pause}-${up}${top ? `-${top}` : ''}`,
    raw,
  }
}

/** One rep's phases, in order, for the animated guide. */
export interface TempoPhase {
  label: string
  sec: number
}

export function tempoPhases(t: Tempo): TempoPhase[] {
  const out: TempoPhase[] = []
  if (t.down > 0) out.push({ label: 'Lower', sec: t.down })
  if (t.pause > 0) out.push({ label: 'Pause', sec: t.pause })
  out.push({ label: 'Lift', sec: Math.max(t.up, 1) })
  if (t.top > 0) out.push({ label: 'Squeeze', sec: t.top })
  return out
}

export const repSeconds = (t: Tempo): number => tempoPhases(t).reduce((s, p) => s + p.sec, 0)
