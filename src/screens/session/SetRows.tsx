// Set rows for the live player: weight/reps steppers stepping through
// ACHIEVABLE loads only, big done checkbox, and an inline countdown for
// timed sets.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Flame, Minus, Pause, Play, Plus, X } from 'lucide-react'
import type { LoadMode, SetLog } from '@/db/types'
import { fmtClock } from '@/lib/fmt'
import { RIR_CHOICES } from '@/lib/training'
import { kgDisplay, stepLoad, type PlateProfile } from './helpers'
import { ModeChip } from './SetModes'

/** Chip + guided-flow slot shared by both row types. Renders nothing when the
 *  set has no mode offered and no mode running — a straight set stays a
 *  straight set, visually identical to how it has always looked. */
function SetExtras({ modeLabel, onModePress, children }: {
  modeLabel?: string
  onModePress?: () => void
  children?: ReactNode
}) {
  if (!onModePress && !children) return null
  return (
    <div className="px-1.5 pb-1">
      {onModePress && (
        <div className="flex pl-9">
          <ModeChip label={modeLabel} onClick={onModePress} />
        </div>
      )}
      {children}
    </div>
  )
}

// ---------- generic stepper ----------
function Stepper({ display, unit, onMinus, onPlus, minusDisabled, plusDisabled, dim, onTap, sub }: {
  display: string
  unit: string
  onTap?: () => void
  sub?: string
  onMinus: () => void
  onPlus: () => void
  minusDisabled?: boolean
  plusDisabled?: boolean
  dim?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface3/70 px-1 py-1">
      <button
        type="button"
        aria-label={`decrease ${unit}`}
        disabled={minusDisabled}
        onClick={onMinus}
        className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink2 disabled:opacity-25"
      >
        <Minus size={16} strokeWidth={2.6} />
      </button>
      <button type="button" disabled={!onTap} onClick={onTap} aria-label={onTap ? `Type a ${unit} value` : undefined} className="flex min-h-[44px] min-w-[48px] flex-1 flex-col items-center justify-center rounded-lg px-0.5 text-center leading-none active:bg-surface3/60 disabled:cursor-default">
        <div className={`big-num text-[17px] ${dim ? 'text-ink3' : 'text-ink'}`}>{display}</div>
        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink3">{sub ?? unit}</div>
      </button>
      <button
        type="button"
        aria-label={`increase ${unit}`}
        disabled={plusDisabled}
        onClick={onPlus}
        className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink2 disabled:opacity-25"
      >
        <Plus size={16} strokeWidth={2.6} />
      </button>
    </div>
  )
}

function DoneBox({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Mark set not done' : 'Mark set done'}
      onClick={onToggle}
      className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
        done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line bg-surface2 text-ink3'
      }`}
    >
      <Check size={22} strokeWidth={3} className={done ? '' : 'opacity-30'} />
    </button>
  )
}

function SetNum({ n, done, focused, warmup }: { n: number; done: boolean; focused: boolean; warmup?: boolean }) {
  return (
    <div
      aria-label={warmup ? 'Warm-up set' : `Set ${n}`}
      className={`big-num flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${
        warmup
          ? done ? 'bg-emerald-500/15 text-emerald-500' : 'bg-orange-500/15 text-orange-400'
          : done ? 'bg-emerald-500/15 text-emerald-500' : focused ? 'bg-brand/15 text-brand' : 'bg-surface3 text-ink3'
      }`}
    >
      {warmup ? <Flame size={13} /> : n}
    </div>
  )
}

// ---------- RIR pills: one tap, optional, never required ----------
export function RirPills({ value, onChange }: {
  value: number | undefined
  onChange: (rir: number | undefined) => void
}) {
  return (
    <div className="flex items-center gap-1.5 pl-9 pr-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink3">RIR</span>
      {RIR_CHOICES.map((c) => {
        const active = value === c.value
        return (
          <button
            key={c.value}
            type="button"
            aria-label={c.hint}
            aria-pressed={active}
            // tapping the active pill clears it — nothing here is compulsory
            onClick={() => onChange(active ? undefined : c.value)}
            className={`pressable h-7 min-w-[30px] rounded-full px-2 text-[12px] font-bold transition-colors ${
              active
                ? c.value === 0 ? 'bg-red-500 text-white' : 'bg-brand text-white'
                : 'bg-surface3/70 text-ink3'
            }`}
          >
            {c.label}
          </button>
        )
      })}
      {value !== undefined && (
        <span className="truncate text-[10.5px] text-ink3">{RIR_CHOICES.find((c) => c.value === value)?.hint} · ≈ RPE {Math.max(5, 10 - value)}</span>
      )}
    </div>
  )
}

// ---------- weighted / bodyweight set ----------
export function SetRow({ set, mode, profile, focused, onWeight, onReps, onToggle, onRir, modeLabel, onModePress, children, weightUnit = 'kg', onWeightTap, onTooHeavy, after }: {
  set: SetLog
  mode: LoadMode
  profile: PlateProfile
  focused: boolean
  onWeight: (kg: number | undefined) => void
  onReps: (reps: number) => void
  onToggle: () => void
  /** optional — when absent the RIR pills aren't offered at all */
  onRir?: (rir: number | undefined) => void
  /** advanced set type on this set, e.g. 'Drop ×2'; undefined = straight set */
  modeLabel?: string
  /** optional — when absent no set-type chip is offered at all */
  onModePress?: () => void
  /** the guided flow for this set's mode, when one is running */
  children?: ReactNode
  /** v6: the exercise's own unit (machines are often lb) */
  weightUnit?: 'kg' | 'lb'
  /** v6: tap the number to type any decimal in kg or lb */
  onWeightTap?: () => void
  /** v6: "too heavy today" — records the attempt and drops the load */
  onTooHeavy?: () => void
  /** v6: e.g. the sticking-point prompt under a done set */
  after?: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focused])
  const lbShown = weightUnit === 'lb' && set.weightKg !== undefined
    ? String(set.unit === 'lb' && set.entered !== undefined ? set.entered : Math.round((set.weightKg / 0.45359237) * 10) / 10)
    : undefined

  const weighted = mode !== 'bodyweight' && mode !== 'time'
  const reps = set.reps ?? set.targetReps[1]
  const down = stepLoad(mode, set.weightKg, -1, profile)
  const up = stepLoad(mode, set.weightKg, 1, profile)
  // effort only means something on a working set you've actually done (or are on)
  const showRir = Boolean(onRir) && !set.warmup && (focused || set.done || set.rir !== undefined)

  return (
    <div
      ref={rowRef}
      className={`rounded-xl px-0.5 py-0.5 transition-colors ${
        focused ? 'bg-brand/10 ring-1 ring-brand/40' : ''
      } ${set.done ? 'opacity-80' : ''} ${set.warmup ? 'opacity-90' : ''}`}
    >
    <div className="grid grid-cols-[28px_1fr_1fr_44px] items-center gap-2 px-1.5 py-1">
      <SetNum n={set.setIndex + 1} done={set.done} focused={focused} warmup={set.warmup} />
      {weighted ? (
        <Stepper
          display={lbShown ?? kgDisplay(set.weightKg)}
          unit={weightUnit}
          sub={lbShown ? `lb ≈${kgDisplay(set.weightKg)}kg` : undefined}
          onTap={onWeightTap}
          dim={set.weightKg === undefined}
          onMinus={() => onWeight(down)}
          onPlus={() => onWeight(up)}
          minusDisabled={set.weightKg === undefined || down === set.weightKg}
          plusDisabled={up === set.weightKg}
        />
      ) : (
        <div className="flex h-[46px] items-center justify-center rounded-xl bg-surface3/40 text-center leading-none">
          <div>
            <div className="text-[15px] font-bold text-ink3">—</div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink3">body</div>
          </div>
        </div>
      )}
      <Stepper
        display={String(reps)}
        unit="reps"
        dim={set.reps === undefined}
        onMinus={() => onReps(Math.max(0, reps - 1))}
        onPlus={() => onReps(Math.min(99, reps + 1))}
        minusDisabled={reps <= 0}
        plusDisabled={reps >= 99}
      />
      <DoneBox done={set.done} onToggle={onToggle} />
    </div>
      {showRir && onRir && (
        <div className="pb-1">
          <RirPills value={set.rir} onChange={onRir} />
        </div>
      )}
      {(set.attempts?.length || (set.plannedKg !== undefined && set.adjusted)) ? (
        <div className="pb-1 pl-9 text-[11px] text-ink3">
          {set.plannedKg !== undefined && `Planned ${kgDisplay(set.plannedKg)} kg`}
          {set.attempts?.length ? ` · tried ${set.attempts.map((a) => `${kgDisplay(a.kg)} kg${a.reps !== undefined ? `×${a.reps}` : ''}`).join(', ')} (too heavy today)` : ''}
          {set.adjusted ? ` · ${set.adjusted}` : ''}
        </div>
      ) : null}
      {onTooHeavy && focused && !set.done && !set.warmup && set.weightKg !== undefined && (
        <div className="pb-1 pl-9"><button type="button" onClick={onTooHeavy} className="pressable min-h-[36px] text-[12px] font-semibold text-amber-400">Too heavy today?</button></div>
      )}
      {after}
      <SetExtras modeLabel={modeLabel} onModePress={onModePress}>
        {children}
      </SetExtras>
    </div>
  )
}

// ---------- timed set with inline countdown ----------
export function TimedSetRow({ set, focused, defaultTimeSec, onTime, onComplete, onToggle, modeLabel, onModePress, children }: {
  set: SetLog
  focused: boolean
  defaultTimeSec: number
  onTime: (sec: number) => void
  onComplete: () => void
  onToggle: () => void
  /** advanced set type on this set; undefined = plain timed set */
  modeLabel?: string
  onModePress?: () => void
  children?: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focused])

  const timeSec = set.timeSec ?? defaultTimeSec
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [remaining, setRemaining] = useState(timeSec)
  const endRef = useRef(0)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  useEffect(() => {
    if (!running || paused) return
    const id = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000))
      setRemaining(rem)
      if (rem <= 0) {
        setRunning(false)
        setPaused(false)
        completeRef.current()
      }
    }, 200)
    return () => clearInterval(id)
  }, [running, paused])

  const start = () => {
    endRef.current = Date.now() + timeSec * 1000
    setRemaining(timeSec)
    setPaused(false)
    setRunning(true)
  }
  const togglePause = () => {
    if (paused) {
      endRef.current = Date.now() + remaining * 1000
      setPaused(false)
    } else {
      setPaused(true)
    }
  }
  const cancel = () => {
    setRunning(false)
    setPaused(false)
    setRemaining(timeSec)
  }

  return (
    <div
      ref={rowRef}
      className={`rounded-xl transition-colors ${focused ? 'bg-brand/10 ring-1 ring-brand/40' : ''} ${
        set.done ? 'opacity-80' : ''
      }`}
    >
    <div className="grid grid-cols-[28px_1fr_auto_44px] items-center gap-2 px-2 py-1.5">
      <SetNum n={set.setIndex + 1} done={set.done} focused={focused} />
      {running ? (
        <div className="flex h-[46px] items-center justify-center rounded-xl bg-brand/12">
          <div className={`big-num text-[20px] ${paused ? 'text-ink3' : 'text-brand'}`}>{fmtClock(remaining)}</div>
        </div>
      ) : (
        <Stepper
          display={fmtClock(timeSec)}
          unit="time"
          onMinus={() => onTime(Math.max(15, timeSec - 15))}
          onPlus={() => onTime(Math.min(1800, timeSec + 15))}
          minusDisabled={timeSec <= 15}
          plusDisabled={timeSec >= 1800}
        />
      )}
      {running ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={paused ? 'Resume' : 'Pause'}
            onClick={togglePause}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-surface3 text-ink"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            type="button"
            aria-label="Cancel timer"
            onClick={cancel}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-surface3 text-ink3"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={set.done}
          className="pressable flex h-9 items-center gap-1 rounded-full bg-brand px-3.5 text-[13px] font-bold text-white disabled:opacity-30"
        >
          <Play size={14} fill="currentColor" /> Start
        </button>
      )}
      <DoneBox done={set.done} onToggle={onToggle} />
    </div>
      <SetExtras modeLabel={modeLabel} onModePress={onModePress}>
        {children}
      </SetExtras>
    </div>
  )
}
