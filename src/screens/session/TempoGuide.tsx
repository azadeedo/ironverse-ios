// TEMPO — shown while he's working the set, with an optional on-screen guide.
//
// The exercise carries a tempo string like '3-1-1 — slow on the way down'.
// `parseTempo` in @/lib/setmodes turns that into phases; this draws them as a
// bar that fills on the way up and empties on the way down, with the phase name
// and the seconds left in it. No audio, no network, no dependencies — it's a
// rAF loop and a div.
//
// It's OFF until he turns it on, per exercise. An exercise with no tempo string
// renders nothing at all.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gauge, Pause, Play } from 'lucide-react'
import { parseTempo, repSeconds, tempoPhases, type Tempo, type TempoPhase } from '@/lib/setmodes'

/** Where the bar should sit, 0-1, at `t` seconds into the rep. */
function positionAt(phases: TempoPhase[], t: number): { phase: TempoPhase; left: number; pos: number } {
  let acc = 0
  // start of a rep = top of the movement, because the eccentric comes first
  let pos = 1
  for (const p of phases) {
    if (t < acc + p.sec) {
      const f = p.sec > 0 ? (t - acc) / p.sec : 1
      const from = pos
      const to =
        p.label === 'Lower' ? 0 : p.label === 'Lift' ? 1 : from
      return { phase: p, left: Math.max(0, p.sec - (t - acc)), pos: from + (to - from) * f }
    }
    acc += p.sec
    if (p.label === 'Lower') pos = 0
    if (p.label === 'Lift') pos = 1
  }
  const last = phases[phases.length - 1]
  return { phase: last, left: 0, pos }
}

function TempoBar({ tempo }: { tempo: Tempo }) {
  const phases = useMemo(() => tempoPhases(tempo), [tempo])
  const total = useMemo(() => repSeconds(tempo), [tempo])
  const [running, setRunning] = useState(true)
  const [t, setT] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!running) return
    let raf = 0
    startRef.current = performance.now()
    const tick = (now: number) => {
      setT(((now - startRef.current) / 1000) % total)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, total])

  const { phase, left, pos } = positionAt(phases, t)

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div
          className="relative h-[46px] flex-1 overflow-hidden rounded-xl bg-surface3/70"
          role="img"
          aria-label={`Tempo guide, ${phase.label}`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-brand/30"
            style={{ width: `${Math.round(pos * 100)}%` }}
          />
          <div className="relative flex h-full items-center justify-between px-3">
            <span className="shout text-[13px] text-ink">{phase.label}</span>
            <span className="big-num text-[17px] text-brand">{Math.max(1, Math.ceil(left))}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label={running ? 'Pause the tempo guide' : 'Play the tempo guide'}
          onClick={() => setRunning((r) => !r)}
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface3 text-ink2"
        >
          {running ? <Pause size={17} /> : <Play size={17} />}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {phases.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              p === phase ? 'bg-brand/20 text-brand' : 'bg-surface3/60 text-ink3'
            }`}
          >
            {p.label} {p.sec}s
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11.5px] text-ink3">
        One rep is {total}s at this tempo. Follow it if it helps — it's a guide, not a metronome you have to obey.
      </p>
    </div>
  )
}

/**
 * The tempo strip for the current exercise. Returns null when the exercise
 * carries no tempo, or carries one that isn't a tempo at all — so nothing
 * changes for the lifts that never had one.
 */
export function TempoStrip({ tempo, on, onToggle }: {
  /** the raw `Exercise.tempo` string */
  tempo: string | undefined
  on: boolean
  onToggle: (on: boolean) => void
}) {
  const parsed = useMemo(() => parseTempo(tempo), [tempo])
  if (!tempo) return null

  const note = parsed ? tempo.replace(parsed.code, '').replace(/^[\s—–-]+/, '').trim() : tempo

  return (
    <div className="mt-2 rounded-2xl bg-surface2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Gauge size={14} className="shrink-0 text-brand" />
            <span className="shout text-[12.5px] text-brand">Tempo {parsed?.code ?? tempo}</span>
          </div>
          {note && <p className="mt-0.5 text-[12.5px] leading-snug text-ink2">{note}</p>}
        </div>
        {parsed && (
          <button
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(!on)}
            className={`pressable flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold ${
              on ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
            }`}
          >
            {on ? 'Hide guide' : 'Show guide'}
          </button>
        )}
      </div>
      {parsed && on && <TempoBar tempo={parsed} />}
    </div>
  )
}
