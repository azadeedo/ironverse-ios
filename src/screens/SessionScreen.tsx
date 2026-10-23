// LIVE WORKOUT PLAYER — /session/:logId (tab bar hidden by the Shell).
// Loads a WorkoutLog, logs sets against achievable loads, runs rest timers,
// and finishes into a summary with PR detection. Every edit persists to
// Dexie immediately so a killed app resumes cleanly from Today.
//
// v2 adds, without changing anything that already worked: one-tap RIR per set,
// superset blocks (from the plan or grouped ad hoc), warm-up rungs snapped to
// real loads, session autoregulation (readiness + cut-down instead of skipping),
// per-session and per-exercise notes, and an injury flag that substitutes the
// lift until it's cleared.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeftRight, Bandage, Check, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Flame,
  HelpCircle, List, Minus, NotebookPen, Plus, Timer, TrendingDown,
} from 'lucide-react'
import { MuscleMap } from '@/anim/MuscleMap'
import { ExerciseAnim } from '@/anim/rig'
import { RestTimerBar } from '@/components/RestTimerBar'
import { coachingFor } from '@/data/coaching'
import { MEDIA } from '@/data/media'
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Section, Spinner } from '@/components/ui'
import { db, getProfile, getSetting, setSetting } from '@/db'
import type {
  EquipmentProfile, ExerciseMeta, Plan, PlanExercise, Profile, WorkoutLog,
} from '@/db/types'
import { bestSubstitute, getCurrentProfile } from '@/lib/equipment'
import { fmtClock } from '@/lib/fmt'
import { showNotification } from '@/lib/notify'
import { metCalories } from '@/lib/nutrition'
import { byId } from '@/data/exercises'
import { RegressionSheet } from './session/RegressionSheet'
import { nearestLoad, type AnyLoadMode } from '@/lib/plates'
import {
  addModePart, dropLoad, MODE_INFO, modeChip, newPlan, popModePart, readSetModes, setSetMode,
  type ModedEntry, type SetMode, type SetModePlan,
} from '@/lib/setmodes'
import {
  applySupersets, clearSupersets, estimateMinutes, isHeavyCompound, pairKey, suggestSupersets,
  type SupersetPair,
} from '@/lib/supersets'
import { useUI } from '@/lib/store'
import { e1rm, smartRestSec } from '@/lib/restSmart'
import {
  allExerciseMeta, bestsPerExercise, deloadSignal, getSessionSupersets,
  isCompound, planTrim, prsForSet, restSecFor, saveSessionSupersets, setExerciseInjured, setExerciseNote,
  SUPERSET_TRANSITION_SEC, warmupRamp, warmupSets,
  type DeloadSignal, type ExerciseBest, type Readiness, type SupersetMap, type TrimPlan,
} from '@/lib/training'
import {
  adhocFromGroups, avgMet, buzz, computePRs, DEFAULT_REST_SEC, DEFAULT_TIME_SEC, doneSetCount,
  exerciseFor, fmtElapsed, groupInfoAt, groupsOf, loadLabel, loadModeFor, nameFor, prettyName,
  remainingIdx, resolveGroups, toPlanExercises, totalSetCount, totalVolume,
  warmupCount, workingSetCount,
  type LogEntry, type PlateProfile,
} from './session/helpers'
import { SetModeGuide, SetModeReference, SetModeSheet } from './session/SetModes'
import { ShortOnTimeSheet } from './session/ShortOnTime'
import { TempoStrip } from './session/TempoGuide'
import { SetRow, TimedSetRow } from './session/SetRows'
import {
  ExerciseNoteSheet, FinishSheet, JumpSheet, SupersetSheet, SwapSheet, WarmupSheet,
} from './session/Sheets'
import { DeloadBanner, ReadinessBar, TrimSheet } from './session/Autoregulation'
import { SupersetBar } from './session/SupersetBar'
import { SetupCard } from './session/SetupCard'
import { SummaryView, type SummaryData } from './session/SummaryView'
import {
  AddExerciseSheet, DiscomfortSheet, SetOneCheck, StickingPrompt, TooHeavySheet, WeightSheet, liftOf, useDiscomfortCount,
} from './session/V6'

// ---------- elapsed timer (isolated so only it re-renders every second) ----------
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const sec = (Date.now() - new Date(startedAt).getTime()) / 1000
  return <span className="big-num text-[13px] text-brand">{fmtElapsed(sec)}</span>
}

type LoadState = 'loading' | 'missing' | 'ready'

export default function SessionScreen() {
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const startRest = useUI((s) => s.startRest)
  const [restWhy, setRestWhy] = useState<string | null>(null)
  const clearRest = useUI((s) => s.clearRest)

  const [state, setState] = useState<LoadState>('loading')
  const [log, setLog] = useState<WorkoutLog | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [equip, setEquip] = useState<EquipmentProfile | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [meta, setMeta] = useState<Map<string, ExerciseMeta>>(new Map())
  const [adhoc, setAdhoc] = useState<SupersetMap>({})
  const [deload, setDeload] = useState<DeloadSignal | null>(null)
  const [deloadDismissed, setDeloadDismissed] = useState(false)
  const [exIdx, setExIdx] = useState(0)
  // v10.1: stick-figure diagram is secondary — a tap swaps it in for the picture
  const [showDiagram, setShowDiagram] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [regressOpen, setRegressOpen] = useState(false)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [warmupOpen, setWarmupOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [supersetOpen, setSupersetOpen] = useState(false)
  /** which set the set-type picker is open for (index within the current exercise) */
  const [modeSheetFor, setModeSheetFor] = useState<number | null>(null)
  const [modeRefOpen, setModeRefOpen] = useState(false)
  const [dropDismissed, setDropDismissed] = useState<Record<string, boolean>>({})
  /** tempo guide is opt-in, per exercise, for this session */
  const [tempoOn, setTempoOn] = useState<Record<string, boolean>>({})
  const [shortOpen, setShortOpen] = useState(false)
  const [trim, setTrim] = useState<{ plan: TrimPlan; lead: string } | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  // ---- v6 ----
  const [weightFor, setWeightFor] = useState<number | null>(null)
  const [heavyFor, setHeavyFor] = useState<number | null>(null)
  const [discomfortOpen, setDiscomfortOpen] = useState(false)
  const [addExOpen, setAddExOpen] = useState(false)
  const [set1Ok, setSet1Ok] = useState<Record<string, boolean>>({})

  /** bests across every OTHER finished log — kept in a ref so live PR checks are cheap */
  const bestsRef = useRef<Map<string, ExerciseBest>>(new Map())

  // ---------- load ----------
  useEffect(() => {
    let alive = true
    void (async () => {
      if (!logId) {
        setState('missing')
        return
      }
      const [l, p] = await Promise.all([db.workoutLogs.get(logId), getProfile()])
      if (!alive) return
      if (!l || !p) {
        setState('missing')
        return
      }
      const [pl, eq, metaMap, groups, allLogs] = await Promise.all([
        l.planId ? db.plans.get(l.planId) : Promise.resolve(undefined),
        getCurrentProfile().catch(() => null),
        allExerciseMeta(),
        getSessionSupersets(l.id),
        db.workoutLogs.toArray().catch(() => [] as WorkoutLog[]),
      ])
      if (!alive) return

      const history = allLogs.filter((h) => h.id !== l.id && h.finishedAt)
      bestsRef.current = bestsPerExercise(history)

      // the session records where it was trained; fall back to the current profile
      const source =
        (l.equipmentProfileId && eq && eq.id !== l.equipmentProfileId
          ? await db.equipmentProfiles.get(l.equipmentProfileId).catch(() => undefined)
          : undefined) ?? eq
      if (!alive) return

      // flagged lifts are kept out of sessions and substituted, unless already worked
      let next = l
      if (source && !l.finishedAt) {
        const swapped: string[] = []
        const exercises = l.exercises.map((e) => {
          if (!metaMap.get(e.exerciseId)?.injured) return e
          if (e.sets.some((s) => s.done)) return e
          const sub = bestSubstitute(e.exerciseId, source)
          if (!sub || sub.exercise.id === e.exerciseId) return e
          swapped.push(`${nameFor(e.exerciseId)} → ${sub.exercise.name}`)
          return { ...e, exerciseId: sub.exercise.id, swappedFrom: e.swappedFrom ?? e.exerciseId }
        })
        if (swapped.length > 0) {
          next = { ...l, exercises }
          await db.workoutLogs.put(next).catch(() => undefined)
          if (alive) toast(`Injury swap: ${swapped[0]}${swapped.length > 1 ? ` +${swapped.length - 1}` : ''}`, 'info')
        }
      }
      if (!alive) return

      setLog(next)
      setProfile(p)
      setEquip(source ?? null)
      setPlan(pl ?? null)
      setMeta(metaMap)
      setAdhoc(groups)
      setDeload(deloadSignal(history))
      // resume where work remains
      const idx = next.exercises.findIndex((e) => e.sets.some((s) => !s.done))
      setExIdx(idx === -1 ? Math.max(0, next.exercises.length - 1) : idx)
      if (next.finishedAt) {
        const durationSec = Math.max(
          1,
          Math.round((new Date(next.finishedAt).getTime() - new Date(next.startedAt).getTime()) / 1000),
        )
        setSummary({
          log: next,
          durationSec,
          volumeKg: next.totalVolumeKg ?? Math.round(totalVolume(next)),
          calories: next.calories ?? 0,
          prs: computePRs(next, history),
        })
      }
      setState('ready')
    })().catch(() => {
      if (alive) setState('missing')
    })
    return () => {
      alive = false
    }
    // toast is stable (zustand selector); intentionally keyed on the log only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId])

  // ---------- persist-every-edit committer ----------
  const commit = useCallback(
    (updater: (draft: WorkoutLog) => void) => {
      setLog((prev) => {
        if (!prev) return prev
        const next = structuredClone(prev)
        updater(next)
        void db.workoutLogs.put(next).catch(() => toast('Save failed — storage error', 'error'))
        return next
      })
    },
    [toast],
  )

  // ---------- plan context ----------
  const planDay = useMemo(() => {
    if (!plan || !log?.dayId) return undefined
    const week = log.weekIndex ? plan.weeks.find((w) => w.index === log.weekIndex) : undefined
    return (
      week?.days.find((d) => d.id === log.dayId) ??
      plan.weeks.flatMap((w) => w.days).find((d) => d.id === log.dayId)
    )
  }, [plan, log?.dayId, log?.weekIndex])

  const planExFor = useCallback(
    (entry: LogEntry): PlanExercise | undefined => {
      const target = entry.swappedFrom ?? entry.exerciseId
      return planDay?.exercises.find((pe) => pe.exerciseId === target)
    },
    [planDay],
  )

  // ---------- supersets ----------
  // pairs he marked "too far apart" never run as a superset (they stay straight sets)
  const farPairs = useLiveQuery(() => getSetting<string[]>('superset-far-pairs', []), []) ?? []
  const groups = useMemo(() => {
    if (!log) return []
    const g = resolveGroups(log, (e) => planExFor(e)?.supersetGroup, adhoc)
    if (!farPairs.length) return g
    const far = new Set(farPairs)
    const bad = new Set<string>()
    g.forEach((L, i) => { if (!L) return; g.forEach((M, j) => { if (j > i && M === L && far.has(pairKey(log.exercises[i].exerciseId, log.exercises[j].exerciseId))) bad.add(L) }) })
    return bad.size ? g.map((L) => (L && bad.has(L) ? undefined : L)) : g
  }, [log, planExFor, adhoc, farPairs])
  const groupInfo = useMemo(() => groupInfoAt(groups, exIdx), [groups, exIdx])

  const persistGroups = useCallback(
    (next: SupersetMap) => {
      setAdhoc(next)
      if (log) void saveSessionSupersets(log.id, next)
    },
    [log],
  )

  /**
   * The session read as PlanExercise[], so the pure planner in @/lib/supersets
   * can work on it — index i here is index i in log.exercises.
   */
  const planList = useMemo(
    () =>
      log
        ? toPlanExercises(
            log,
            groups,
            (e) => planExFor(e)?.restSec ?? restSecFor(exerciseFor(e.exerciseId)),
            (e) => planExFor(e),
          )
        : [],
    [log, groups, planExFor],
  )

  /** Write a planner result (a new PlanExercise[]) back onto the session. */
  const applyPlanList = useCallback(
    (next: PlanExercise[]) => {
      if (!log) return
      persistGroups(adhocFromGroups(log, groupsOf(next), (e) => planExFor(e)?.supersetGroup, adhoc))
    },
    [log, adhoc, planExFor, persistGroups],
  )

  /** Superset two exercises ad hoc — the planner picks a fresh, unused letter. */
  const pairUp = useCallback(
    (a: number, b: number) => {
      if (!log || !log.exercises[a] || !log.exercises[b]) return
      const next = applySupersets(planList, [
        {
          a,
          b,
          aId: log.exercises[a].exerciseId,
          bId: log.exercises[b].exerciseId,
          aName: nameFor(log.exercises[a].exerciseId),
          bName: nameFor(log.exercises[b].exerciseId),
          reason: 'Paired by you',
          minutesSaved: 0,
          secondsSaved: 0,
        },
      ])
      applyPlanList(next)
      toast(
        `Superset ${next[a].supersetGroup ?? ''} — ${nameFor(log.exercises[a].exerciseId)} + ${nameFor(
          log.exercises[b].exerciseId,
        )}`.trim(),
      )
    },
    [log, planList, applyPlanList, toast],
  )

  /** Break a whole block apart again. */
  const breakBlock = useCallback(
    (letter: string) => {
      applyPlanList(clearSupersets(planList, [letter]))
      toast(`Superset ${letter} split — straight sets again`, 'info')
    },
    [planList, applyPlanList, toast],
  )

  const remaining = useMemo(() => (log ? remainingIdx(log) : []), [log])

  /** Proposals over what's LEFT — never over sets he's already done. */
  const proposals = useMemo<SupersetPair[]>(() => {
    if (planList.length === 0 || remaining.length < 2) return []
    const left = new Set(remaining)
    return suggestSupersets(planList, {
      skip: (_pe, i) => !left.has(i) || groups[i] !== undefined,
      avoidPair: (x, y) => farPairs.includes(pairKey(x, y)),
      maxPairs: 3,
    })
  }, [planList, remaining, groups, farPairs])

  const minutesLeft = useMemo(
    () => (planList.length ? estimateMinutes(remaining.map((i) => planList[i])) : 0),
    [planList, remaining],
  )

  const entry = log?.exercises[exIdx] ?? null
  // Revelto-style "last time" next to each set: the same exercise in your previous finished session
  const prevWork = useLiveQuery(async () => {
    if (!entry || !log) return null
    const L = (await db.workoutLogs.where('date').belowOrEqual(log.date).toArray())
      .filter((l) => l.id !== log.id && l.finishedAt && !l.skipped).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    for (const l of L) { const e = l.exercises.find((x) => x.exerciseId === entry.exerciseId); const w = e?.sets.filter((x) => x.done && !x.warmup); if (w && w.length) return { date: l.date, sets: w } }
    return null
  }, [entry?.exerciseId, log?.id])
  const lastTimeLine = (s: { warmup?: boolean }, i: number) => {
    if (!prevWork || !entry || s.warmup) return null
    const k = entry.sets.slice(0, i).filter((x) => !x.warmup).length
    const p = prevWork.sets[k]
    if (!p) return null
    return <div className="-mt-1 mb-1 pl-12 text-[11.5px] text-amber-300/90">Last time: {p.reps ?? '—'} reps{p.weightKg ? ` @ ${p.weightKg} kg` : ''}{p.timeSec ? ` · ${p.timeSec}s` : ''} <span className="text-ink3">({dayjs(prevWork.date).format('D MMM')})</span></div>
  }
  const ex = entry ? exerciseFor(entry.exerciseId) : undefined
  const mode = entry ? loadModeFor(entry.exerciseId) : 'barbell'
  const planEx = entry ? planExFor(entry) : undefined
  // per-exercise default rest derived from the lift's role, unless the plan says otherwise
  const restSec = planEx?.restSec ?? (ex ? restSecFor(ex) : DEFAULT_REST_SEC)
  /** plate maths source: the session's equipment profile, else the legacy profile */
  const loadSource: PlateProfile | null = equip ?? profile
  const exMeta = entry ? meta.get(entry.exerciseId) : undefined

  // ---------- set actions ----------
  const toggleSet = (setIdx: number) => {
    if (!log || !entry) return
    const wasDone = entry.sets[setIdx]?.done ?? false
    const wasWarmup = entry.sets[setIdx]?.warmup === true
    const exerciseId = entry.exerciseId
    let logged: { reps?: number; weightKg?: number; rir?: number } | null = null

    commit((d) => {
      const de = d.exercises[exIdx]
      const s = de.sets[setIdx]
      if (!s) return
      s.done = !wasDone
      if (!wasDone) {
        s.doneAt = new Date().toISOString()
        // commit the displayed defaults so totals are honest
        if (loadModeFor(de.exerciseId) === 'time') {
          s.timeSec = s.timeSec ?? planExFor(de)?.timeSec ?? DEFAULT_TIME_SEC
        } else if (s.reps === undefined) {
          s.reps = s.targetReps[1]
        }
        logged = { reps: s.reps, weightKg: s.weightKg, rir: s.rir }
      }
    })

    if (wasDone) return
    // setLog's updater can run after this function returns — read the set as shown instead
    if (!logged) {
      const cur = entry.sets[setIdx]
      if (cur) logged = { reps: cur.reps ?? (loadModeFor(exerciseId) === 'time' ? undefined : cur.targetReps[1]), weightKg: cur.weightKg, rir: cur.rir }
    }

    buzz([60])

    // ---- live PR check (working sets only) ----
    if (!wasWarmup && logged) {
      const set = logged as { reps?: number; weightKg?: number }
      const hits = prsForSet(
        exerciseId,
        { setIndex: setIdx, targetReps: [0, 0], done: true, reps: set.reps, weightKg: set.weightKg },
        bestsRef.current.get(exerciseId),
      ).slice(0, 1)
      for (const hit of hits) {
        const prev = bestsRef.current.get(exerciseId) ?? { weightKg: 0, reps: 0, e1rm: 0, seen: true }
        bestsRef.current.set(exerciseId, {
          seen: true,
          weightKg: Math.max(prev.weightKg, set.weightKg ?? 0),
          reps: Math.max(prev.reps, set.reps ?? 0),
          e1rm: Math.max(prev.e1rm, hit.kind === 'e1rm' ? hit.value : prev.e1rm),
        })
        buzz([90, 50, 90, 50, 180])
        toast(`PR — ${hit.detail}`, 'success')
      }
    }

    // ---- auto-drop (owner's rule): fewer reps than the target at this weight →
    // the remaining sets get lighter right away; the next session builds from the
    // weight that worked and climbs back up slowly once the reps are there again.
    {
      const done = logged as { reps?: number; weightKg?: number } | null
      const tgt = entry.sets[setIdx]?.targetReps
      if (!wasWarmup && done && done.weightKg && done.weightKg > 0 && (done.reps ?? 0) > 0 && tgt && (done.reps ?? 0) < tgt[0] && loadModeFor(exerciseId) !== 'time') {
        const kg = done.weightKg, reps = done.reps!
        // Epley: the weight that should allow the target reps at the same effort
        let next = Math.floor((kg * (1 + reps / 30)) / (1 + tgt[0] / 30) / 2.5) * 2.5
        if (next >= kg) next = kg - 2.5
        next = Math.max(next, Math.round(kg * 0.8 / 2.5) * 2.5)
        const remaining = entry.sets.filter((x, i) => i > setIdx && !x.done && !x.warmup && x.weightKg === kg).length
        if (next > 0 && remaining > 0) {
          commit((d) => {
            d.exercises[exIdx].sets.forEach((x, i) => {
              if (i > setIdx && !x.done && !x.warmup && x.weightKg === kg) { x.weightKg = next; delete x.entered; markAdjusted(x); x.autoDropped = true }
            })
          })
          setSet1Ok((m) => ({ ...m, [`${exIdx}:${exerciseId}`]: true }))
          toast(`${reps} of ${tgt[0]} reps at ${kg} kg — your next ${remaining === 1 ? 'set is' : `${remaining} sets are`} now ${next} kg. Hit the reps and the weight goes back up.`, 'info')
        }
      }
    }

    // ---- research-based rest for THIS set (reps, effort, load vs your best today) ----
    const lg = logged as { reps?: number; weightKg?: number; rir?: number } | null
    const bestToday = Math.max(0, ...entry.sets.filter((x) => x.done && !x.warmup && x.weightKg && x.reps).map((x) => e1rm(x.weightKg!, x.reps!)), lg?.weightKg && lg.reps ? e1rm(lg.weightKg, lg.reps) : 0)
    const adv = smartRestSec({
      ex, compound: isCompound(ex), reps: lg?.reps, targetReps: entry.sets[setIdx]?.targetReps, rir: lg?.rir, rpe: entry.sets[setIdx]?.rpe,
      warmup: wasWarmup, intensity: lg?.weightKg && bestToday ? lg.weightKg / bestToday : undefined, userSec: exMeta?.restSec,
    })
    const restNow = adv.sec
    setRestWhy(`${Math.floor(restNow / 60)}:${String(restNow % 60).padStart(2, '0')} — ${adv.why}`)

    // ---- rest / superset flow ----
    const remainingAfter = totalSetCount(log) - doneSetCount(log) - 1
    if (remainingAfter <= 0) {
      clearRest()
      buzz()
      toast('All sets done — hit Finish', 'success')
      return
    }

    // ---- superset block: A1 set 1 → A2 set 1 → A1 set 2 … ----
    // Warm-ups ramp on one lift, so they never bounce him round the block.
    if (groupInfo && !wasWarmup) {
      // `log` is the pre-commit copy, so count the set just ticked by hand
      const doneOf = (m: number) =>
        log.exercises[m].sets.filter((s) => s.done).length + (m === exIdx ? 1 : 0)
      const leftOf = (m: number) =>
        log.exercises[m].sets.filter((s) => !s.done).length - (m === exIdx ? 1 : 0)
      const order = [
        ...groupInfo.members.slice(groupInfo.position + 1),
        ...groupInfo.members.slice(0, groupInfo.position + 1),
      ]
      const mine = doneOf(exIdx)

      // someone in the block is a round behind → that's the next thing to do,
      // and it IS the rest, so only the walk between stations is timed
      const partner = order.find((m) => leftOf(m) > 0 && doneOf(m) < mine)
      if (partner !== undefined) {
        setExIdx(partner)
        startRest(SUPERSET_TRANSITION_SEC)
        return
      }

      // the lap is complete — this is the one place a full rest belongs
      const nextRound = order.find((m) => leftOf(m) > 0)
      if (nextRound !== undefined) {
        if (nextRound !== exIdx) setExIdx(nextRound)
        startRest(restNow)
        return
      }
    }

    startRest(restNow)
  }

  const timedComplete = (setIdx: number) => {
    if (!entry || entry.sets[setIdx]?.done) return
    buzz([160, 80, 160])
    void showNotification('Time!', `${nameFor(entry.exerciseId)} — set ${setIdx + 1} in the bag.`, 'timed-set')
    toggleSet(setIdx)
  }

  const markAdjusted = (s: WorkoutLog['exercises'][number]['sets'][number]) => {
    if (s.plannedKg === undefined || s.weightKg === undefined) return
    if (s.weightKg < s.plannedKg - 0.01) s.adjusted = 'reduced'
    else if (s.weightKg > s.plannedKg + 0.01) s.adjusted = 'increased'
    else delete s.adjusted
  }
  const setWeight = (setIdx: number, kg: number | undefined) => {
    if (kg === undefined) return
    commit((d) => {
      const s = d.exercises[exIdx].sets[setIdx]
      s.weightKg = kg
      delete s.entered
      markAdjusted(s)
    })
  }
  /** typed weight in kg or lb — the number is kept exactly as entered */
  const setWeightTyped = (setIdx: number, kg: number, unit: 'kg' | 'lb', entered: number) =>
    commit((d) => {
      const sets = d.exercises[exIdx].sets
      // this set, plus every later undone working set that carried the same load
      const from = sets[setIdx].weightKg
      sets.forEach((s, i) => {
        if (i === setIdx || (i > setIdx && !s.done && !s.warmup && s.weightKg === from)) {
          s.weightKg = kg; s.unit = unit; s.entered = entered; markAdjusted(s)
        }
      })
    })
  const saveMeta = (patch: Partial<ExerciseMeta>) => {
    if (!entry) return
    const id = entry.exerciseId
    void db.exerciseMeta.get(id)
      .then((m) => db.exerciseMeta.put({ ...(m ?? { exerciseId: id }), ...patch, exerciseId: id, updatedAt: new Date().toISOString() }))
      .then(refreshMeta)
      .then(() => toast('Saved for this exercise'))
  }
  /** "too heavy today": the attempted load is recorded, the lighter load becomes the working weight */
  const tooHeavy = (setIdx: number, attempt: { reps?: number }, newKg: number) =>
    commit((d) => {
      const sets = d.exercises[exIdx].sets
      const s = sets[setIdx]
      if (s.weightKg === undefined) return
      const old = s.weightKg
      s.attempts = [...(s.attempts ?? []), { kg: old, reps: attempt.reps, failed: true, at: new Date().toISOString(), ...(s.unit ? { unit: s.unit } : {}) }]
      sets.forEach((x, i) => {
        if (i >= setIdx && !x.done && !x.warmup && x.weightKg === old) { x.weightKg = newKg; delete x.entered; markAdjusted(x) }
      })
    })
  const setSticking = (setIdx: number, v: string | undefined) =>
    commit((d) => {
      const s = d.exercises[exIdx].sets[setIdx]
      if (v) s.sticking = v
      else delete s.sticking
    })
  const set1Action = (act: 'keep' | 'reduce' | 'target' | 'end') => {
    if (!entry) return
    setSet1Ok((m) => ({ ...m, [`${exIdx}:${entry.exerciseId}`]: true }))
    if (act === 'keep') return
    commit((d) => {
      const e = d.exercises[exIdx]
      if (act === 'end') {
        e.sets = e.sets.filter((s) => s.done || s.warmup)
        e.sets.forEach((s, i) => { s.setIndex = i })
        e.endedEarly = true
        return
      }
      for (const s of e.sets) {
        if (s.done || s.warmup) continue
        if (act === 'reduce' && s.weightKg) { s.weightKg = Math.round((s.weightKg * 0.95) / 2.5) * 2.5; delete s.entered; markAdjusted(s) }
        if (act === 'target') s.targetReps = [Math.max(1, s.targetReps[0] - 2), Math.max(1, s.targetReps[1] - 2)]
      }
    })
    toast(act === 'end' ? 'Exercise ended — remaining sets recorded as not done' : act === 'reduce' ? 'Remaining sets reduced about 5%' : 'Rep target lowered for the remaining sets')
  }
  const logDiscomfort = (where: string | undefined, note: string) => {
    if (!entry) return
    const id = entry.exerciseId
    commit((d) => { d.discomfort = [...(d.discomfort ?? []), { exerciseId: id, where, note: note || undefined, at: new Date().toISOString() }] })
    toast('Discomfort noted')
  }
  const addExercise = (id: string, toProgram: boolean) => {
    const ex2 = byId.get(id)
    const range = (ex2?.repRange ?? [8, 12]) as [number, number]
    commit((d) => {
      d.exercises.push({
        exerciseId: id,
        extra: true,
        sets: Array.from({ length: 3 }, (_, i) => ({ setIndex: i, targetReps: range, done: false, ...(ex2?.loadMode === 'time' ? { timeSec: DEFAULT_TIME_SEC } : {}) })),
      })
      d.extras = [...(d.extras ?? []), id]
    })
    setExIdx(log ? log.exercises.length : 0)
    toast(`${ex2?.name ?? 'Exercise'} added to today`)
    if (toProgram && plan && log?.dayId) {
      const pat = /^p12-w(\d+)-(\w+)$/
      const m = pat.exec(log.dayId)
      const next = {
        ...plan,
        weeks: plan.weeks.map((w) => ({
          ...w,
          days: w.days.map((dd) => {
            const mm = pat.exec(dd.id)
            const same = m && mm ? mm[2] === m[2] && Number(mm[1]) >= Number(m[1]) : dd.id === log.dayId
            return same && !dd.exercises.some((e) => e.exerciseId === id)
              ? { ...dd, exercises: [...dd.exercises, { exerciseId: id, sets: 3, reps: range, restSec: 90, role: 'accessory' as const, note: 'Added by you' }] }
              : dd
          }),
        })),
      }
      void db.plans.put(next).then(() => { setPlan(next); toast('Also added to your program for this day from now on — that changes the program structure', 'info') })
    }
  }
  const setReps = (setIdx: number, reps: number) =>
    commit((d) => {
      d.exercises[exIdx].sets[setIdx].reps = reps
    })
  const setTime = (setIdx: number, sec: number) =>
    commit((d) => {
      d.exercises[exIdx].sets[setIdx].timeSec = sec
    })
  /** optional effort tag — undefined clears it */
  const setRir = (setIdx: number, rir: number | undefined) =>
    commit((d) => {
      const s = d.exercises[exIdx].sets[setIdx]
      if (rir === undefined) delete s.rir
      else s.rir = rir
    })

  // ---------- advanced set types ----------
  // Modes live on the log entry as one serialised field, so a session where he
  // never used one is stored exactly as it always was. Drops, mini-sets and
  // clusters are recorded as PARTS of their working set, never as extra SetLogs
  // — which is why weeklyHardSets still counts one extended set as one hard set.
  const modes = useMemo(() => readSetModes(entry as ModedEntry | null), [entry])

  const editModes = (fn: (e: ModedEntry) => void) =>
    commit((d) => {
      fn(d.exercises[exIdx] as ModedEntry)
    })

  /** Load for the next drop, snapped to something this profile can build. */
  const dropKgFor = (setIdx: number): number | undefined => {
    if (!loadSource) return undefined
    const plan = modes[setIdx]
    const from = plan?.parts[plan.parts.length - 1]?.weightKg ?? entry?.sets[setIdx]?.weightKg
    return dropLoad(mode, from, loadSource)
  }

  const chooseMode = (setIdx: number, m: SetMode) => {
    editModes((e) => setSetMode(e, setIdx, newPlan(m, entry?.sets[setIdx])))
    toast(`Set ${setIdx + 1} is a ${MODE_INFO[m].label.toLowerCase()} — still logged as one hard set`)
  }

  const clearMode = (setIdx: number) => {
    editModes((e) => setSetMode(e, setIdx, undefined))
    toast('Back to a straight set', 'info')
  }

  const updatePlan = (setIdx: number, plan: SetModePlan) =>
    editModes((e) => setSetMode(e, setIdx, plan))

  const logPart = (setIdx: number, part: { reps: number; weightKg?: number; seconds?: number }) => {
    editModes((e) => addModePart(e, setIdx, part))
    buzz([60])
  }

  const undoPart = (setIdx: number) => editModes((e) => popModePart(e, setIdx))

  const addSet = () => {
    if (!entry) return
    commit((d) => {
      const sets = d.exercises[exIdx].sets
      const last = sets[sets.length - 1]
      sets.push({
        setIndex: sets.length,
        targetReps: last ? [last.targetReps[0], last.targetReps[1]] : [8, 12],
        weightKg: last?.weightKg,
        timeSec: last?.timeSec,
        done: false,
      })
    })
    toast('Set added')
  }

  const removeLastSet = () => {
    commit((d) => {
      const sets = d.exercises[exIdx].sets
      if (sets.length <= 1) return
      sets.pop()
      sets.forEach((s, i) => {
        s.setIndex = i
      })
    })
    toast('Set removed', 'info')
  }

  // ---------- warm-up ----------
  const workingKg = useMemo(() => {
    if (!entry) return undefined
    const working = entry.sets.find((s) => !s.warmup && s.weightKg !== undefined)
    return working?.weightKg ?? planEx?.weightKg
  }, [entry, planEx])

  const rungs = useMemo(
    () => (loadSource && workingKg ? warmupRamp(workingKg, ex, loadSource) : []),
    [loadSource, workingKg, ex],
  )

  const addWarmups = () => {
    if (!loadSource || !workingKg) return
    const built = warmupSets(workingKg, ex, loadSource)
    if (built.length === 0) return
    commit((d) => {
      const sets = d.exercises[exIdx].sets
      d.exercises[exIdx].sets = [...built, ...sets].map((s, i) => ({ ...s, setIndex: i }))
    })
    setWarmupOpen(false)
    toast(`${built.length} warm-up ${built.length === 1 ? 'set' : 'sets'} added — they don't count toward volume`)
  }

  // ---------- notes / injury ----------
  const refreshMeta = useCallback(async () => {
    setMeta(await allExerciseMeta())
  }, [])

  const saveExerciseNote = (note: string) => {
    if (!entry) return
    void setExerciseNote(entry.exerciseId, note)
      .then(refreshMeta)
      .then(() => toast(note.trim() ? 'Note saved' : 'Note cleared'))
      .catch(() => toast('Could not save the note', 'error'))
  }

  const flagInjury = (injured: boolean) => {
    if (!entry || !log) return
    const id = entry.exerciseId
    void setExerciseInjured(id, injured)
      .then(refreshMeta)
      .then(() => {
        if (!injured) {
          toast('Flag cleared — back in your sessions')
          return
        }
        const sub = loadSource && equip ? bestSubstitute(id, equip) : null
        const touched = entry.sets.some((s) => s.done)
        if (sub && sub.exercise.id !== id && !touched) {
          commit((d) => {
            const e = d.exercises[exIdx]
            e.swappedFrom = e.swappedFrom ?? e.exerciseId
            e.exerciseId = sub.exercise.id
            for (const s of e.sets) {
              if (!s.done) s.weightKg = undefined
            }
          })
          setNoteOpen(false)
          toast(`Flagged — ${sub.exercise.name} swapped in${sub.reason ? ` (${sub.reason})` : ''}`, 'info')
        } else {
          toast(
            touched
              ? 'Flagged — it stays in today’s session since you’ve already worked it'
              : 'Flagged — it’ll stay out of future sessions',
            'info',
          )
        }
      })
      .catch(() => toast('Could not save the flag', 'error'))
  }

  // ---------- autoregulation ----------
  const setReadiness = (r: Readiness) => {
    commit((d) => {
      d.readiness = r
    })
    if (r === 'wrecked' && log) {
      setTrim({ plan: planTrim(log), lead: 'Feeling wrecked' })
    } else if (r === 'strong') {
      toast('Strong it is — go get it')
    }
  }

  const offerTrim = (lead: string) => {
    if (!log) return
    setTrim({ plan: planTrim(log), lead })
  }

  const applyTrim = () => {
    if (!trim || !log) return
    const keep = trim.plan.keep
    const dropped = trim.plan.dropNames.length
    commit((d) => {
      d.exercises = keep.map((i) => d.exercises[i])
      d.trimmed = true
    })
    setExIdx((i) => {
      const pos = keep.indexOf(i)
      return pos === -1 ? 0 : pos
    })
    setTrim(null)
    toast(`Trimmed ${dropped} ${dropped === 1 ? 'exercise' : 'exercises'} — finish what's left`, 'info')
  }

  // ---------- swap ----------
  const doSwap = (newId: string, asRegression = false) => {
    if (!log || !profile || !loadSource) return
    const newEx = exerciseFor(newId)
    commit((d) => {
      const e = d.exercises[exIdx]
      const original = e.swappedFrom ?? e.exerciseId
      if (asRegression) {
        // keep the ORIGINAL prescribed lift on the row so weekly volume and the
        // coaching notice both know which movement was backed off from
        e.regressedFrom = e.regressedFrom ?? e.exerciseId
      }
      e.swappedFrom = newId === original ? undefined : original
      e.exerciseId = newId
      const newMode = newEx?.loadMode ?? 'barbell'
      for (const s of e.sets) {
        if (s.done) continue // performed sets keep their logged numbers
        if (newMode === 'bodyweight') {
          s.weightKg = undefined
          s.timeSec = undefined
        } else if (newMode === 'time') {
          s.weightKg = undefined
          s.timeSec = s.timeSec ?? planExFor(e)?.timeSec ?? DEFAULT_TIME_SEC
        } else {
          const desired = newEx?.startFactor
            ? profile.weightKg * newEx.startFactor
            : (s.weightKg ?? 0)
          s.weightKg = nearestLoad(newMode, desired, loadSource)?.totalKg
          s.timeSec = undefined
        }
      }
    })
    setSwapOpen(false)
    setRegressOpen(false)
    toast(
      asRegression
        ? `Backed off to ${newEx?.name ?? prettyName(newId)} — still counts`
        : `Swapped to ${newEx?.name ?? prettyName(newId)}`,
    )
  }

  // ---------- finish / discard ----------
  const finish = async () => {
    if (!log || !profile) return
    clearRest()
    const durationSec = Math.max(1, Math.round((Date.now() - new Date(log.startedAt).getTime()) / 1000))
    const volumeKg = Math.round(totalVolume(log))
    const calories = metCalories(avgMet(log), profile.weightKg, durationSec)
    const allDone = log.exercises.every((e) => e.sets.filter((s) => !s.warmup).every((s) => s.done))
    const finished: WorkoutLog = {
      ...log,
      finishedAt: new Date().toISOString(),
      // v6: completed vs partial is recorded honestly (program week view reads this)
      status: allDone ? 'completed' : 'partial',
      totalVolumeKg: volumeKg,
      calories,
      ...(equip && !log.equipmentProfileId
        ? { equipmentProfileId: equip.id, equipmentProfileName: equip.name }
        : {}),
    }
    try {
      await db.workoutLogs.put(finished)
    } catch {
      toast('Save failed — storage error', 'error')
      return
    }
    setLog(finished)
    setFinishOpen(false)
    const history = (await db.workoutLogs.toArray().catch(() => [] as WorkoutLog[])).filter(
      (h) => h.id !== finished.id && h.finishedAt,
    )
    setSummary({ log: finished, durationSec, volumeKg, calories, prs: computePRs(finished, history) })
    buzz([80, 40, 80, 40, 160])
    toast('Workout saved')
    // v10: Apple's rating sheet after the 3rd / 10th / 30th finished workout (App Store build only)
    void import('@/native/extras').then((x) => x.maybeAskForReview())
  }

  const discard = async () => {
    if (!log) return
    clearRest()
    try {
      await db.workoutLogs.delete(log.id)
    } catch {
      /* already gone */
    }
    toast('Session discarded', 'info')
    navigate('/')
  }

  // ---------- states ----------
  if (state === 'loading') {
    return (
      <div className="flex h-[80svh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (state === 'missing' || !log || !profile) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="pt-safe" />
        <div className="mt-[14svh]">
          <EmptyState
            icon={<Dumbbell size={40} />}
            title="Session not found"
            subtitle="This workout may have been discarded, or the link is stale. Head back and start a fresh one."
            action={<Button onClick={() => navigate('/workout')}>Back to workouts</Button>}
          />
        </div>
      </div>
    )
  }

  if (summary) {
    return <SummaryView data={summary} feel={log.feel} onFeel={(f) => { commit((d) => { d.feel = f }); setSummary((sm) => (sm ? { ...sm, log: { ...sm.log, feel: f } } : sm)) }} />
  }

  if (!entry) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="pt-safe" />
        <div className="mt-[14svh]">
          <EmptyState
            icon={<Dumbbell size={40} />}
            title="Nothing to train"
            subtitle="This session has no exercises in it. Discard it and start one from your plan."
            action={
              <Button variant="danger" onClick={() => setDiscardOpen(true)}>
                Discard session
              </Button>
            }
          />
        </div>
        <ConfirmDialog
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onConfirm={() => void discard()}
          title="Discard this session?"
          message="The empty workout log will be deleted."
          confirmLabel="Discard"
        />
      </div>
    )
  }

  // ---------- derived for the current exercise ----------
  const exCount = log.exercises.length
  const focusIdx = entry.sets.findIndex((s) => !s.done)
  const name = nameFor(entry.exerciseId)
  const working = workingSetCount(log)
  const doneSoFar = doneSetCount(log)
  const showReadinessOnTop = !log.readiness && doneSoFar === 0
  const groupProgress = log.exercises.map((e) => ({
    done: e.sets.filter((s) => s.done).length,
    total: e.sets.length,
  }))
  const exNames = log.exercises.map((e) => nameFor(e.exerciseId))
  const nextIdx = exIdx + 1 < exCount ? exIdx + 1 : -1
  // program main lifts (squat / bench / deadlift side quest) are never offered as a superset
  const canGroupNext = !groupInfo && nextIdx !== -1 && !groups[nextIdx] && planEx?.role !== 'main' && (log.exercises[nextIdx] ? planExFor(log.exercises[nextIdx])?.role !== 'main' : true)
  // pairing two heavy compounds is his call to make, but he should be told the cost
  const heavyPairAhead = (() => {
    if (!canGroupNext || nextIdx === -1) return false
    const a = byId.get(entry.exerciseId)
    const b = byId.get(log.exercises[nextIdx]?.exerciseId ?? '')
    return !!a && !!b && isHeavyCompound(a) && isHeavyCompound(b)
  })()

  let targetLine: string
  if (entry.sets.length === 0) {
    targetLine = 'No sets yet — add one below'
  } else if (focusIdx === -1) {
    targetLine = 'All sets done — nice work'
  } else {
    const s = entry.sets[focusIdx]
    const base = s.warmup ? 'Warm-up set' : `Set ${focusIdx + 1} of ${entry.sets.length}`
    if (mode === 'time') {
      targetLine = `${base} · ${fmtClock(s.timeSec ?? planEx?.timeSec ?? DEFAULT_TIME_SEC)} work · rest ${restSec}s`
    } else {
      const reps =
        s.targetReps[0] === s.targetReps[1]
          ? `${s.targetReps[0]} reps`
          : `${s.targetReps[0]}-${s.targetReps[1]} reps`
      const w = s.weightKg ?? planEx?.weightKg
      const load =
        mode === 'bodyweight'
          ? 'bodyweight'
          : w !== undefined && loadSource
            ? loadLabel(mode, w, loadSource)
            : 'pick a weight'
      targetLine = `${base} · ${reps} · ${load}`
    }
  }

  const elapsedSec = Math.max(0, Math.round((Date.now() - new Date(log.startedAt).getTime()) / 1000))

  const readinessBar = (
    <ReadinessBar
      value={log.readiness}
      onChange={setReadiness}
      onShortOnTime={() => offerTrim('Short on time')}
      trimmed={log.trimmed}
    />
  )

  return (
    <div className="flex min-h-full flex-col">
      {/* ---------- top bar ---------- */}
      <div className="sticky top-0 z-30 bg-surface/90 pt-safe backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2">
          <IconButton label="Minimize session" onClick={() => navigate('/')} className="h-9 w-9 bg-surface3/60">
            <ChevronDown size={21} />
          </IconButton>
          <div className="min-w-0 flex-1 text-center">
            <div className="shout truncate text-[15px] leading-tight text-ink">{log.title}</div>
            <div className="flex items-center justify-center gap-1.5 text-[12px] text-ink3">
              <ElapsedTimer startedAt={log.startedAt} />
              <span>·</span>
              <span>
                {working.done}/{working.total} sets
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFinishOpen(true)}
            className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 text-[13px] font-bold text-white"
          >
            <Check size={15} strokeWidth={3} /> Finish
          </button>
        </div>
        {/* progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2.5">
          {log.exercises.map((e, i) => {
            const allDone = e.sets.length > 0 && e.sets.every((s) => s.done)
            return (
              <button
                key={`${e.exerciseId}-${i}`}
                type="button"
                aria-label={`Go to exercise ${i + 1}: ${nameFor(e.exerciseId)}`}
                onClick={() => setExIdx(i)}
                className={`pressable rounded-full transition-all duration-200 ${
                  i === exIdx ? 'h-2.5 w-6 bg-brand' : allDone ? 'h-2.5 w-2.5 bg-brand/50' : 'h-2.5 w-2.5 bg-surface3'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* ---------- readiness up front, before any work is done ---------- */}
      {showReadinessOnTop && (
        <div className="space-y-2 px-4 pb-1 pt-1">
          {deload && deload.suggest && !deloadDismissed && (
            <DeloadBanner signal={deload} onDismiss={() => setDeloadDismissed(true)} />
          )}
          {readinessBar}
        </div>
      )}

      {/* ---------- current exercise ---------- */}
      <div key={`${exIdx}-${entry.exerciseId}`} className="page-in">
        <div className="px-4 pt-1">
          <div className="flex items-center justify-center gap-1">
            {ex ? (
              <>
                {showDiagram && MEDIA[ex.id] ? <ExerciseAnim def={ex.anim} size={228} /> : MEDIA[ex.id]?.video ? (
                  <video key={ex.id} src={MEDIA[ex.id]!.video} poster={MEDIA[ex.id]!.imgSmall} autoPlay loop muted playsInline preload="metadata"
                    aria-label={`${ex.name} — one controlled repetition`} className="h-[228px] w-[228px] rounded-2xl bg-black object-contain" />
                ) : MEDIA[ex.id] ? (
                  <img key={ex.id} src={MEDIA[ex.id]!.imgSmall ?? MEDIA[ex.id]!.img} alt={`${ex.name} — key positions`} className="h-[228px] w-[228px] rounded-2xl bg-black object-contain" />
                ) : <ExerciseAnim def={ex.anim} size={228} />}
                <div className="flex flex-col items-center gap-1">
                  <MuscleMap primary={ex.primary} secondary={ex.secondary} size={100} />
                  {MEDIA[ex.id] && <button type="button" onClick={() => setShowDiagram((v) => !v)} className="pressable rounded-full bg-surface3 px-2 py-1 text-[10.5px] font-semibold text-ink2">{showDiagram ? '📷 Picture' : '🕺 Diagram'}</button>}
                </div>
              </>
            ) : (
              <div className="flex h-[190px] w-[228px] items-center justify-center rounded-2xl bg-surface2">
                <Dumbbell size={62} className="text-ink3" />
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(`/exercise/${entry.exerciseId}`)}
              className="pressable flex min-w-0 items-center gap-1 text-left"
              aria-label={`${name} details`}
            >
              {groupInfo && <span className="shout shrink-0 text-[15px] text-brand">{groupInfo.label}</span>}
              <h2 className="shout truncate text-[21px] text-ink">{name}</h2>
              <ChevronRight size={19} className="shrink-0 text-ink3" />
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <IconButton
                label="Notes and injury flag"
                onClick={() => setNoteOpen(true)}
                className={exMeta?.injured ? 'bg-red-500/15 text-red-500' : exMeta?.note ? 'bg-brand/15 text-brand' : ''}
              >
                {exMeta?.injured ? <Bandage size={17} /> : <NotebookPen size={17} />}
              </IconButton>
              <IconButton
                label="Too heavy today — easier variation"
                onClick={() => setRegressOpen(true)}
              >
                <TrendingDown size={17} />
              </IconButton>
              <IconButton label="Swap exercise" onClick={() => setSwapOpen(true)}>
                <ArrowLeftRight size={17} />
              </IconButton>
              <IconButton label="Report discomfort" onClick={() => setDiscomfortOpen(true)}>
                <AlertTriangle size={17} />
              </IconButton>
            </div>
          </div>
          {entry.swappedFrom && (
            <div className="mt-0.5 text-[12px] text-ink3">Swapped in for {nameFor(entry.swappedFrom)}</div>
          )}
          <div className="mt-1 text-[13.5px] font-semibold text-brand">{targetLine}</div>
          {(() => {
            const cur = entry.sets.find((x) => !x.done) ?? entry.sets[entry.sets.length - 1]
            const w = cur?.weightKg ?? planEx?.weightKg
            if (!loadSource || w === undefined || !['barbell', 'smith', 'curl-bar'].includes(mode as string)) return null
            const plan = nearestLoad(mode as AnyLoadMode, w, loadSource)
            if (!plan?.perSide) return null
            const colour: Record<number, string> = { 25: 'bg-red-500', 20: 'bg-blue-500', 15: 'bg-yellow-400 text-black', 10: 'bg-green-500', 5: 'bg-white text-black', 2.5: 'bg-zinc-400 text-black', 1.25: 'bg-zinc-300 text-black' }
            return (
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11.5px] text-ink3">
                <span>Each side:</span>
                {plan.perSide.length ? plan.perSide.map((p, i) => <span key={i} className={`rounded-md px-1.5 py-0.5 font-bold ${colour[p] ?? 'bg-surface3 text-ink'}`}>{p}</span>) : <span>empty bar</span>}
                {plan.totalKg !== w && <span className="text-amber-400">· closest you can build is {plan.totalKg} kg</span>}
              </div>
            )
          })()}
          {(() => {
            // drop sets where they make sense: last working set of an isolation / machine / cable / dumbbell lift
            const work = entry.sets.map((x, i) => ({ x, i })).filter(({ x }) => !x.warmup)
            const lastW = work[work.length - 1]
            if (!lastW || lastW.x.done || modes[lastW.i] || isCompound(ex) || mode === 'barbell' || mode === 'bodyweight' || mode === 'time' || work.length < 2) return null
            if (dropDismissed[entry.exerciseId]) return null
            return (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-[12.5px]">
                <span className="flex-1 text-ink2"><b className="text-sky-400">Drop set suggested</b> on your last set — hit the reps, drop ~20–25% and go again. Same growth in less time (Coleman 2023; Sødal 2023 meta-analysis).</span>
                <button type="button" onClick={() => chooseMode(lastW.i, 'drop')} className="pressable rounded-lg bg-sky-500 px-2.5 py-1.5 text-[12px] font-bold text-white">Add</button>
                <button type="button" aria-label="Not this time" onClick={() => setDropDismissed((m) => ({ ...m, [entry.exerciseId]: true }))} className="pressable px-1 text-ink3">✕</button>
              </div>
            )
          })()}
          <SetupCard key={`setup-${entry.exerciseId}`} exerciseId={entry.exerciseId} cues={ex?.setupCues} meta={exMeta} onSaveMeta={saveMeta} />
          {exMeta?.note && (
            <div className="mt-1.5 rounded-xl bg-surface3/50 px-3 py-2 text-[12.5px] leading-snug text-ink2">
              {exMeta.note}
            </div>
          )}
        </div>

        {/* ---------- superset block ---------- */}
        <div className="px-4 pt-2">
          <SupersetBar
            info={groupInfo}
            names={exNames}
            progress={groupProgress}
            currentIdx={exIdx}
            onGo={setExIdx}
            canGroupNext={canGroupNext}
            nextName={nextIdx === -1 ? undefined : exNames[nextIdx]}
            heavyPair={heavyPairAhead}
            onGroupNext={() => {
              if (nextIdx === -1) return
              pairUp(exIdx, nextIdx)
            }}
            onUngroup={() => {
              if (!groupInfo) return
              breakBlock(groupInfo.group)
            }}
            onTooFar={() => {
              if (!groupInfo || !log) return
              const ids = groupInfo.members.map((m) => log.exercises[m].exerciseId)
              const add: string[] = []
              ids.forEach((x, i) => ids.slice(i + 1).forEach((y) => add.push(pairKey(x, y))))
              void setSetting('superset-far-pairs', [...new Set([...farPairs, ...add])])
              breakBlock(groupInfo.group)
              toast('Got it — these stay as straight sets from now on, and the planner won’t pair them again.', 'info')
            }}
          />
          {groupInfo && (
            <button
              type="button"
              onClick={() => setSupersetOpen(true)}
              className="pressable mt-1.5 min-h-[44px] w-full text-center text-[12px] font-semibold text-ink3"
            >
              Add another exercise to the block
            </button>
          )}
          {/* the honest time-saver: propose, explain, wait */}
          {remaining.length >= 2 && (
            <Button
              variant="secondary"
              small
              full
              className="mt-1.5"
              onClick={() => setShortOpen(true)}
            >
              <Timer size={15} /> Short on time? Pair up what's left
            </Button>
          )}
        </div>

        {/* ---------- v7: why this exercise is programmed this way today + coaching ---------- */}
        {(planEx?.whyToday || coachingFor(entry.exerciseId)) && (
          <details className="mx-4 mt-2 rounded-2xl bg-surface2 px-3 py-2 text-[12.5px] leading-snug">
            <summary className="cursor-pointer select-none font-semibold text-brand">Why today · coaching tips</summary>
            {planEx?.whyToday && <div className="mt-1.5"><b>WHY TODAY:</b> {planEx.whyToday}</div>}
            {(() => { const c = coachingFor(entry.exerciseId); return c ? (
              <div className="mt-1.5 space-y-0.5"><div><b className="text-emerald-300">TIP:</b> {c.tip}</div><div><b className="text-sky-300">FEEL:</b> {c.feel}</div><div><b className="text-rose-300">AVOID:</b> {c.avoid}</div><div><b className="text-amber-300">PROGRESSION:</b> {c.progression}</div></div>
            ) : null })()}
          </details>
        )}

        {/* ---------- tempo, when this lift has one ---------- */}
        {ex?.tempo && (
          <div className="px-4">
            <TempoStrip
              tempo={ex.tempo}
              on={tempoOn[entry.exerciseId] === true}
              onToggle={(on) => setTempoOn((prev) => ({ ...prev, [entry.exerciseId]: on }))}
            />
          </div>
        )}

        {/* ---------- sets ---------- */}
        <Section title="Sets" className="mt-2 pb-4">
          {(() => {
            const firstWork = entry.sets.find((s) => !s.warmup)
            const bad = firstWork && firstWork.done && mode !== 'time' && ((firstWork.reps ?? 0) < firstWork.targetReps[0] - 1 || firstWork.failed)
            const undone = entry.sets.some((s) => !s.done && !s.warmup)
            return bad && undone && !set1Ok[`${exIdx}:${entry.exerciseId}`] ? (
              <div className="mb-2"><SetOneCheck set={firstWork} onKeep={() => set1Action('keep')} onReduce={() => set1Action('reduce')} onTarget={() => set1Action('target')} onEnd={() => set1Action('end')} /></div>
            ) : null
          })()}
          {entry.sets.length === 0 ? (
            <Card className="p-5 text-center text-[13px] text-ink2">No sets — add your first one below.</Card>
          ) : (
            <Card className="p-1.5">
              <div className="flex flex-col gap-1">
                {entry.sets.map((s, i) => {
                  const plan = modes[i]
                  // warm-up rungs are ramp work — no intensity techniques there
                  const offerMode = s.warmup ? undefined : () => setModeSheetFor(i)
                  const guide = plan ? (
                    <SetModeGuide
                      plan={plan}
                      set={s}
                      setNumber={i + 1}
                      nextLoadKg={dropKgFor(i)}
                      onLogPart={(part) => logPart(i, part)}
                      onUndo={() => undoPart(i)}
                      onClear={() => clearMode(i)}
                      onRest={(sec) => startRest(sec)}
                      onUpdatePlan={(p) => updatePlan(i, p)}
                    />
                  ) : null
                  return mode === 'time' ? (
                    <TimedSetRow
                      key={`${exIdx}-${i}`}
                      set={s}
                      focused={i === focusIdx}
                      defaultTimeSec={planEx?.timeSec ?? DEFAULT_TIME_SEC}
                      onTime={(sec) => setTime(i, sec)}
                      onComplete={() => timedComplete(i)}
                      onToggle={() => toggleSet(i)}
                      modeLabel={modeChip(plan)}
                      onModePress={offerMode}
                    >
                      {guide}
                    </TimedSetRow>
                  ) : (
                    <Fragment key={`${exIdx}-${i}`}><SetRow
                      set={s}
                      mode={mode}
                      profile={loadSource ?? profile}
                      focused={i === focusIdx}
                      onWeight={(kg) => setWeight(i, kg)}
                      onReps={(r) => setReps(i, r)}
                      onToggle={() => toggleSet(i)}
                      onRir={(rir) => setRir(i, rir)}
                      modeLabel={modeChip(plan)}
                      onModePress={offerMode}
                      weightUnit={exMeta?.unit ?? 'kg'}
                      onWeightTap={() => setWeightFor(i)}
                      onTooHeavy={() => setHeavyFor(i)}
                      after={(() => {
                        const lift = liftOf(entry.exerciseId)
                        if (!lift || !s.done || s.warmup) return null
                        const hard = s.kind === 'top' || s.kind === 'single' || s.kind === 'pr-attempt' || (s.rir !== undefined && s.rir <= 2) || s.sticking !== undefined
                        return hard ? <StickingPrompt lift={lift} value={s.sticking} onPick={(v) => setSticking(i, v)} /> : null
                      })()}
                    >
                      {guide}
                    </SetRow>{lastTimeLine(s, i)}</Fragment>
                  )
                })}
              </div>
            </Card>
          )}
          <Button variant="secondary" small full className="mt-2" onClick={() => setAddExOpen(true)}>
            <Plus size={15} /> Add an extra exercise
          </Button>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" small className="flex-1" onClick={addSet}>
              <Plus size={15} /> Add set
            </Button>
            <Button
              variant="secondary"
              small
              className="flex-1"
              disabled={entry.sets.length <= 1}
              onClick={() => setRemoveOpen(true)}
            >
              <Minus size={15} /> Remove set
            </Button>
          </div>
          {mode !== 'time' && mode !== 'bodyweight' && (
            <Button variant="secondary" small full className="mt-2" onClick={() => setWarmupOpen(true)}>
              <Flame size={15} /> Warm-up sets
            </Button>
          )}
          <button
            type="button"
            onClick={() => setModeRefOpen(true)}
            className="pressable mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-ink3"
          >
            <HelpCircle size={14} /> Drop sets, rest-pause, myo-reps — what are they?
          </button>
          {mode !== 'time' && (
            <div className="mt-2 text-center text-[12px] text-ink3">
              {groupInfo
                ? `Superset ${groupInfo.group} — ${SUPERSET_TRANSITION_SEC}s between exercises, ${restSec}s after a full round.`
                : restWhy ? `Rest ${restWhy}` : `Rest adapts to each set (reps, effort, weight) — the timer starts when you tick a set.`}
            </div>
          )}
        </Section>

        {/* ---------- session controls, once he's underway ---------- */}
        {!showReadinessOnTop && (
          <Section title="Session" className="pb-2">
            <div className="space-y-2">
              {deload && deload.suggest && !deloadDismissed && (
                <DeloadBanner signal={deload} onDismiss={() => setDeloadDismissed(true)} />
              )}
              {readinessBar}
            </div>
          </Section>
        )}
      </div>

      {/* spacer keeps the footer at the bottom on short content */}
      <div className="h-6 grow" />

      {/* ---------- prev / next ---------- */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-surface/90 px-4 backdrop-blur-xl" style={{ paddingBottom: 'var(--sab)' }}>
        <div className="flex items-center gap-2 py-2.5">
          <Button variant="secondary" className="flex-1" disabled={exIdx === 0} onClick={() => setExIdx(exIdx - 1)}>
            <ChevronLeft size={18} /> Prev
          </Button>
          <IconButton label="Exercise list" onClick={() => setJumpOpen(true)}>
            <List size={19} />
          </IconButton>
          {exIdx < exCount - 1 ? (
            <Button variant="secondary" className="flex-1" onClick={() => setExIdx(exIdx + 1)}>
              Next <ChevronRight size={18} />
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setFinishOpen(true)}>
              <Check size={18} strokeWidth={3} /> Finish
            </Button>
          )}
        </div>
      </div>

      {/* global rest pill (the Shell hides its copy on /session) */}
      <RestTimerBar />

      {/* ---------- sheets & dialogs ---------- */}
      <SwapSheet open={swapOpen} onClose={() => setSwapOpen(false)} entry={entry} onSwap={doSwap} />
      <WeightSheet key={`w-${exIdx}-${weightFor}`} open={weightFor !== null} onClose={() => setWeightFor(null)} set={weightFor === null ? null : entry.sets[weightFor] ?? null}
        exerciseName={name} meta={exMeta} onSave={(kg, unit, entered) => { if (weightFor !== null) setWeightTyped(weightFor, kg, unit, entered) }} onSaveMeta={saveMeta} />
      <TooHeavySheet key={`h-${exIdx}-${heavyFor}`} open={heavyFor !== null} onClose={() => setHeavyFor(null)} set={heavyFor === null ? null : entry.sets[heavyFor] ?? null}
        unit={exMeta?.unit ?? 'kg'} onReduce={(a, kg) => { if (heavyFor !== null) tooHeavy(heavyFor, a, kg) }} />
      <DiscomfortGate open={discomfortOpen} onClose={() => setDiscomfortOpen(false)} exerciseId={entry.exerciseId} name={name} onSave={logDiscomfort} onSwap={() => setSwapOpen(true)} />
      <AddExerciseSheet open={addExOpen} onClose={() => setAddExOpen(false)} onAdd={addExercise} />
      <RegressionSheet
        open={regressOpen}
        onClose={() => setRegressOpen(false)}
        exerciseId={entry.exerciseId}
        location={equip}
        onPick={(id) => doSwap(id, true)}
      />
      <JumpSheet
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        log={log}
        currentIdx={exIdx}
        groups={groups}
        onJump={(i) => {
          setExIdx(i)
          setJumpOpen(false)
        }}
      />
      <SupersetSheet
        open={supersetOpen}
        onClose={() => setSupersetOpen(false)}
        log={log}
        currentIdx={exIdx}
        groups={groups}
        onGroupWith={(i) => {
          setSupersetOpen(false)
          const letter = groups[exIdx]
          if (!letter) {
            pairUp(exIdx, i)
            return
          }
          // already in a block — the new exercise joins it rather than starting one
          applyPlanList(
            planList.map((pe, idx) => (idx === i ? { ...pe, supersetGroup: letter } : { ...pe })),
          )
          toast(`Superset ${letter} — ${exNames[i]} added`)
        }}
        onUngroup={() => {
          setSupersetOpen(false)
          applyPlanList(
            planList.map((pe, idx) =>
              idx === exIdx ? { ...pe, supersetGroup: undefined } : { ...pe },
            ),
          )
          toast('Left the superset', 'info')
        }}
      />
      <SetModeSheet
        open={modeSheetFor !== null}
        onClose={() => setModeSheetFor(null)}
        setNumber={(modeSheetFor ?? 0) + 1}
        exerciseName={name}
        current={modeSheetFor === null ? undefined : modes[modeSheetFor]?.mode}
        onChoose={(m) => {
          if (modeSheetFor !== null) chooseMode(modeSheetFor, m)
        }}
        onClear={() => {
          if (modeSheetFor !== null) clearMode(modeSheetFor)
        }}
      />
      <SetModeReference open={modeRefOpen} onClose={() => setModeRefOpen(false)} />
      <ShortOnTimeSheet
        open={shortOpen}
        onClose={() => setShortOpen(false)}
        pairs={proposals}
        minutesNow={minutesLeft}
        remaining={remaining.length}
        onApply={(chosen) => {
          setShortOpen(false)
          if (chosen.length === 0) return
          applyPlanList(applySupersets(planList, chosen))
          const mins = chosen.reduce((s, p) => s + p.secondsSaved, 0) / 60
          toast(
            `${chosen.length} ${chosen.length === 1 ? 'pair' : 'pairs'} supersetted — about ${Math.floor(mins)} min back`,
          )
        }}
      />
      <WarmupSheet
        open={warmupOpen}
        onClose={() => setWarmupOpen(false)}
        exerciseName={name}
        workingKg={workingKg}
        rungs={rungs}
        alreadyAdded={warmupCount(entry.sets)}
        onAdd={addWarmups}
      />
      <ExerciseNoteSheet
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        exerciseName={name}
        note={exMeta?.note ?? ''}
        injured={exMeta?.injured === true}
        injuredSince={exMeta?.injuredSince}
        substituteName={
          equip ? bestSubstitute(entry.exerciseId, equip)?.exercise.name : undefined
        }
        onSaveNote={saveExerciseNote}
        onSetInjured={flagInjury}
      />
      <TrimSheet
        open={trim !== null}
        onClose={() => setTrim(null)}
        plan={trim?.plan ?? null}
        lead={trim?.lead ?? ''}
        onConfirm={applyTrim}
      />
      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        log={log}
        elapsedSec={elapsedSec}
        estCalories={metCalories(avgMet(log), profile.weightKg, elapsedSec)}
        onNotes={(notes) =>
          commit((d) => {
            d.notes = notes.trim() ? notes : undefined
          })
        }
        onFinish={() => void finish()}
        onDiscard={() => {
          setFinishOpen(false)
          setDiscardOpen(true)
        }}
      />
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={removeLastSet}
        title="Remove last set?"
        message={
          entry.sets.length > 0 && entry.sets[entry.sets.length - 1].done
            ? 'The last set is already logged — removing it deletes that logged set.'
            : 'The last set row will be removed from this exercise.'
        }
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => void discard()}
        title="Discard this session?"
        message="The whole workout log, including any sets you ticked, will be deleted. This can't be undone."
        confirmLabel="Discard"
      />
    </div>
  )
}

/** discomfort sheet with the 4-week repeat count for this exercise */
function DiscomfortGate({ open, onClose, exerciseId, name, onSave, onSwap }: { open: boolean; onClose: () => void; exerciseId: string; name: string; onSave: (w: string | undefined, n: string) => void; onSwap: () => void }) {
  const count = useDiscomfortCount(exerciseId)
  return <DiscomfortSheet open={open} onClose={onClose} exerciseName={name} repeatCount={count} onSave={onSave} onSwap={onSwap} />
}
