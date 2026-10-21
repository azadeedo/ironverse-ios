// Advanced set types in the live player: pick one per set, then be walked
// through it step by step. Everything here is OPT-IN — a set with no mode is
// the plain straight set it has always been.

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, Layers, Minus, Play, Plus, RotateCcw, Timer, TrendingDown, X, Zap,
} from 'lucide-react'
import { Badge, Button, Card, ListGroup, ListRow, Sheet } from '@/components/ui'
import type { SetLog } from '@/db/types'
import { fmtClock } from '@/lib/fmt'
import {
  guideStep, MODE_INFO, modeSummary, newPlan, SET_MODES,
  type ModePart, type SetMode, type SetModePlan,
} from '@/lib/setmodes'

const MODE_ICON: Record<SetMode, React.ReactNode> = {
  drop: <TrendingDown size={17} />,
  'rest-pause': <Timer size={17} />,
  myo: <Zap size={17} />,
  cluster: <Layers size={17} />,
  amrap: <Play size={17} />,
}

// ---------- chip shown on the set row ----------
export function ModeChip({ label, onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `Set type: ${label}` : 'Add a set type'}
      className={`pressable flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors ${
        label ? 'bg-brand/15 text-brand' : 'bg-surface3/70 text-ink3'
      }`}
    >
      {label ?? 'Set type'}
      {!label && <Plus size={11} strokeWidth={3} />}
    </button>
  )
}

// ---------- picker ----------
export function SetModeSheet({ open, onClose, setNumber, exerciseName, current, onChoose, onClear }: {
  open: boolean
  onClose: () => void
  setNumber: number
  exerciseName: string
  current?: SetMode
  onChoose: (mode: SetMode) => void
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState<SetMode | null>(null)

  useEffect(() => {
    if (open) setExpanded(current ?? null)
  }, [open, current])

  return (
    <Sheet open={open} onClose={onClose} title={`Set ${setNumber} · set type`} tall>
      <p className="mb-3 text-[13.5px] leading-snug text-ink2">
        Turn set {setNumber} of <span className="font-semibold text-ink">{exerciseName}</span> into an intensity
        technique. The app walks you through it and logs every extra rep — but it still counts as{' '}
        <span className="font-semibold text-ink">one hard set</span>, which is the honest way to count it.
      </p>

      <div className="flex flex-col gap-2">
        {SET_MODES.map((m) => {
          const info = MODE_INFO[m]
          const active = current === m
          const open2 = expanded === m
          return (
            <Card key={m} className={`p-0 ${active ? 'ring-1 ring-brand/45' : ''}`}>
              <button
                type="button"
                onClick={() => setExpanded(open2 ? null : m)}
                aria-expanded={open2}
                className="pressable flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
              >
                <span className={active ? 'text-brand' : 'text-ink3'}>{MODE_ICON[m]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-ink">{info.label}</span>
                  <span className="block truncate text-[12px] text-ink3">{info.short}</span>
                </span>
                {active && <Badge tone="brand">On</Badge>}
                <ChevronDown
                  size={17}
                  className={`shrink-0 text-ink3 transition-transform ${open2 ? 'rotate-180' : ''}`}
                />
              </button>
              {open2 && (
                <div className="border-t border-line px-3.5 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink3">What it is</div>
                  <p className="mt-1 text-[13px] leading-snug text-ink2">{info.what}</p>
                  <div className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-ink3">
                    When it's worth it
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-ink2">{info.when}</p>
                  <Button
                    full
                    small
                    className="mt-3"
                    variant={active ? 'secondary' : 'primary'}
                    onClick={() => {
                      onChoose(m)
                      onClose()
                    }}
                  >
                    {active ? `Restart this ${info.label.toLowerCase()}` : `Use ${info.label.toLowerCase()}`}
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {current && (
        <Button
          full
          variant="secondary"
          className="mt-3"
          onClick={() => {
            onClear()
            onClose()
          }}
        >
          <X size={16} /> Back to a straight set
        </Button>
      )}
    </Sheet>
  )
}

// ---------- rep stepper used when logging a part ----------
function RepStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-surface3/70 px-1 py-1">
      <button
        type="button"
        aria-label="fewer reps"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="pressable flex h-9 w-9 items-center justify-center rounded-lg text-ink2"
      >
        <Minus size={16} strokeWidth={2.6} />
      </button>
      <div className="min-w-[42px] text-center leading-none">
        <div className="big-num text-[18px] text-ink">{value}</div>
        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink3">reps</div>
      </div>
      <button
        type="button"
        aria-label="more reps"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="pressable flex h-9 w-9 items-center justify-center rounded-lg text-ink2"
      >
        <Plus size={16} strokeWidth={2.6} />
      </button>
    </div>
  )
}

// ---------- AMRAP countdown ----------
function AmrapClock({ targetSec, onChangeTarget, onDone }: {
  targetSec: number
  onChangeTarget: (sec: number) => void
  onDone: () => void
}) {
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(targetSec)
  const endRef = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000))
      setRemaining(rem)
      if (rem <= 0) {
        setRunning(false)
        try {
          navigator.vibrate?.([160, 80, 160])
        } catch {
          /* unsupported */
        }
        doneRef.current()
      }
    }, 200)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running) setRemaining(targetSec)
  }, [targetSec, running])

  if (running) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-[46px] flex-1 items-center justify-center rounded-xl bg-brand/12">
          <span className="big-num text-[22px] text-brand">{fmtClock(remaining)}</span>
        </div>
        <Button small variant="secondary" onClick={() => setRunning(false)}>
          Stop
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 items-center justify-between rounded-xl bg-surface3/70 px-1 py-1">
        <button
          type="button"
          aria-label="less time"
          onClick={() => onChangeTarget(Math.max(15, targetSec - 15))}
          className="pressable flex h-9 w-9 items-center justify-center rounded-lg text-ink2"
        >
          <Minus size={16} strokeWidth={2.6} />
        </button>
        <span className="big-num text-[18px] text-ink">{fmtClock(targetSec)}</span>
        <button
          type="button"
          aria-label="more time"
          onClick={() => onChangeTarget(Math.min(1800, targetSec + 15))}
          className="pressable flex h-9 w-9 items-center justify-center rounded-lg text-ink2"
        >
          <Plus size={16} strokeWidth={2.6} />
        </button>
      </div>
      <Button
        small
        onClick={() => {
          endRef.current = Date.now() + targetSec * 1000
          setRemaining(targetSec)
          setRunning(true)
        }}
      >
        <Play size={14} fill="currentColor" /> Start
      </Button>
    </div>
  )
}

// ---------- the guided flow ----------
export function SetModeGuide({
  plan, set, setNumber, nextLoadKg, onLogPart, onUndo, onClear, onRest, onUpdatePlan,
}: {
  plan: SetModePlan
  set: SetLog | undefined
  setNumber: number
  /** the suggested drop load for the next drop, already snapped to real plates */
  nextLoadKg?: number
  onLogPart: (part: ModePart) => void
  onUndo: () => void
  onClear: () => void
  /** puts seconds on the global rest timer */
  onRest: (sec: number) => void
  onUpdatePlan: (plan: SetModePlan) => void
}) {
  const info = MODE_INFO[plan.mode]
  const step = guideStep(plan, set, nextLoadKg)
  const [reps, setReps] = useState<number>(set?.reps ?? 8)
  const [logging, setLogging] = useState(false)
  const [timeUp, setTimeUp] = useState(false)

  // a fresh part starts from the last logged one — drops fall off, so this is
  // usually the number he's about to tap down from
  useEffect(() => {
    const last = plan.parts[plan.parts.length - 1]
    setReps(Math.max(1, last?.reps ?? set?.reps ?? 8))
    setLogging(false)
  }, [plan.parts.length, set?.reps])

  const logged = plan.parts.length

  return (
    <Card className="mt-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="shout flex items-center gap-1.5 text-[12.5px] text-brand">
          {MODE_ICON[plan.mode]} {info.label} · set {setNumber}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {logged > 0 && (
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Undo last ${info.partNoun}`}
              className="pressable flex h-7 items-center gap-1 rounded-full bg-surface3 px-2.5 text-[11px] font-semibold text-ink3"
            >
              <RotateCcw size={11} /> Undo
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            aria-label="Turn this back into a straight set"
            className="pressable flex h-7 w-7 items-center justify-center rounded-full bg-surface3 text-ink3"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[13.5px] leading-snug text-ink">{step.text}</p>

      {plan.mode === 'amrap' && set?.done !== true && (
        <AmrapClock
          targetSec={plan.targetSec ?? 60}
          onChangeTarget={(sec) => onUpdatePlan({ ...plan, targetSec: sec })}
          onDone={() => setTimeUp(true)}
        />
      )}

      {plan.mode === 'cluster' && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink3">Intra-set rest</span>
          {[10, 15, 20, 30].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={(plan.intraRestSec ?? 20) === s}
              onClick={() => onUpdatePlan({ ...plan, intraRestSec: s })}
              className={`pressable h-8 min-w-[44px] rounded-full px-2 text-[12px] font-bold ${
                (plan.intraRestSec ?? 20) === s ? 'bg-brand text-white' : 'bg-surface3/70 text-ink3'
              }`}
            >
              {s}s
            </button>
          ))}
        </div>
      )}

      {logged > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.parts.map((p, i) => (
            <Badge key={i} tone="gray">
              {info.partNoun} {i + 1}: {p.reps} reps{p.weightKg !== undefined ? ` @ ${p.weightKg} kg` : ''}
            </Badge>
          ))}
        </div>
      )}

      {!step.done && (step.action || timeUp) && (
        <div className="mt-2.5">
          {logging || timeUp ? (
            <div className="flex items-center gap-2">
              <RepStepper value={reps} onChange={setReps} />
              <Button
                small
                className="flex-1"
                onClick={() => {
                  onLogPart({
                    reps,
                    weightKg: info.dropsLoad ? nextLoadKg : undefined,
                    seconds: plan.mode === 'amrap' ? plan.targetSec : undefined,
                  })
                  setLogging(false)
                  setTimeUp(false)
                  if (step.restSec) onRest(step.restSec)
                }}
              >
                Log {reps} reps
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                small
                className="flex-1"
                disabled={set?.done !== true}
                onClick={() => setLogging(true)}
              >
                {step.action}
              </Button>
              {step.restSec ? (
                <Button small variant="secondary" onClick={() => onRest(step.restSec as number)}>
                  <Timer size={14} /> {step.restSec}s
                </Button>
              ) : null}
            </div>
          )}
          {set?.done !== true && (
            <p className="mt-1.5 text-[11.5px] text-ink3">Tick the working set above first.</p>
          )}
        </div>
      )}

      {step.done && (
        <p className="mt-2 text-[11.5px] text-ink3">
          {modeSummary(plan, set)} — logged as one hard set, with the extra reps recorded against it.
        </p>
      )}
    </Card>
  )
}

// ---------- a compact "what are these?" reference ----------
export function SetModeReference({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Advanced set types" tall>
      <ListGroup>
        {SET_MODES.map((m) => (
          <ListRow
            key={m}
            chevron={false}
            leading={<span className="text-ink3">{MODE_ICON[m]}</span>}
            title={MODE_INFO[m].label}
            subtitle={MODE_INFO[m].what}
          />
        ))}
      </ListGroup>
      <p className="mt-3 text-[12.5px] leading-snug text-ink3">
        None of these are compulsory, and none of them replace getting stronger on the basics. Use one on your
        last set when you want more out of the time you have.
      </p>
    </Sheet>
  )
}

/** Default plan for a mode — re-exported so the screen doesn't import twice. */
export { newPlan }
