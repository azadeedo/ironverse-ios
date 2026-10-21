// Shared building blocks for the 12-week program screens.
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gauge, Pause, Play, RotateCcw } from 'lucide-react'
import { ExerciseAnim } from '@/anim/rig'
import { MuscleMap } from '@/anim/MuscleMap'
import type { Exercise } from '@/db/types'
import { MEDIA } from '@/data/media'
import { hero as heroSrc } from '@/data/brand'
import { TRANSFER_LABEL, knowledgeFor, type Transfer } from '@/data/knowledge'
import { PHASES } from '@/data/program12'

/** Looping instructional animation with play / pause / replay / slow motion. No sound, ever. */
export function AnimPlayer({ ex, size = 220 }: { ex: Exercise; size?: number }) {
  const [playing, setPlaying] = useState(true)
  const [slow, setSlow] = useState(false)
  const [reset, setReset] = useState(0)
  if (!ex.anim?.poses?.length || (ex.anim.poses.length === 1 && Object.keys(ex.anim.poses[0]).length === 0)) return null
  return (
    <div className="flex flex-col items-center">
      <ExerciseAnim def={ex.anim} size={size} playing={playing} speed={slow ? 0.45 : 1} resetKey={reset} />
      <div className="mt-1 flex items-center gap-1.5" role="group" aria-label="Animation controls">
        <CtlBtn label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={15} /> : <Play size={15} />}</CtlBtn>
        <CtlBtn label="Replay" onClick={() => { setReset((r) => r + 1); setPlaying(true) }}><RotateCcw size={15} /></CtlBtn>
        <CtlBtn label={slow ? 'Normal speed' : 'Slow motion'} active={slow} onClick={() => setSlow((s) => !s)}><Gauge size={15} /><span className="text-[11px] font-semibold">{slow ? '0.5×' : '1×'}</span></CtlBtn>
      </div>
    </div>
  )
}
function CtlBtn({ children, label, onClick, active }: { children: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className={`pressable flex h-9 min-w-[44px] items-center justify-center gap-1 rounded-full px-3 ${active ? 'bg-brand/20 text-brand' : 'bg-surface3 text-ink2'}`}>
      {children}
    </button>
  )
}

/**
 * Exercise visual: generated demonstration image when one exists (lazy-loaded,
 * mobile-sized WebP), otherwise the animated figure. Never a broken image —
 * a failed load falls back to the animation.
 */
export function ExerciseMedia({ ex, size = 220, showAnim = true }: { ex: Exercise; size?: number; showAnim?: boolean }) {
  const m = MEDIA[ex.id]
  const [failed, setFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  return (
    <div className="flex flex-col items-center gap-2">
      {m?.video && !videoFailed && (
        <figure className="w-full overflow-hidden rounded-2xl bg-surface2">
          <video src={m.video} poster={m.imgSmall ?? m.img} autoPlay loop muted playsInline preload="metadata" aria-label={`${ex.name} — one controlled repetition`}
            className="mx-auto max-h-[60svh] w-full bg-black object-contain" onError={() => setVideoFailed(true)} />
          <figcaption className="px-3 py-1.5 text-[10.5px] text-ink3">One controlled repetition (AI-generated from the reviewed start/finish photo) — slow it down in real life.</figcaption>
        </figure>
      )}
      {m && !failed && (
        <figure className="w-full overflow-hidden rounded-2xl bg-surface2">
          <img src={m.img} srcSet={m.imgSmall ? `${m.imgSmall} 480w, ${m.img} 960w` : undefined} sizes="(max-width: 520px) 100vw, 480px"
            alt={`${ex.name} demonstration`} loading="lazy" decoding="async" width={960} height={720}
            className="aspect-[4/3] w-full object-cover" onError={() => setFailed(true)} />
          {m.credit && <figcaption className="px-3 py-1.5 text-[10.5px] text-ink3">{m.credit}</figcaption>}
        </figure>
      )}
      {showAnim && <AnimPlayer ex={ex} size={m && !failed ? Math.round(size * 0.8) : size} />}
    </div>
  )
}

export function MuscleTiers({ ex, size = 150 }: { ex: Exercise; size?: number }) {
  const k = knowledgeFor(ex.id)
  return (
    <div className="flex flex-col items-center">
      <MuscleMap primary={ex.primary} secondary={ex.secondary} stabilisers={k?.stabilisers ?? []} size={size} showLabels />
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-ink3">
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />Primary</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand/45" />Secondary</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-brand/20" />Stabiliser</span>
      </div>
    </div>
  )
}

const T_TONE: Record<Transfer, string> = {
  direct: 'bg-brand/20 text-brand', supporting: 'bg-emerald-500/15 text-emerald-400', general: 'bg-sky-500/15 text-sky-400',
  hypertrophy: 'bg-purple-500/15 text-purple-400', technique: 'bg-orange-500/15 text-orange-400', stability: 'bg-slate-500/20 text-slate-300',
}
export function TransferChips({ id }: { id: string }) {
  const k = knowledgeFor(id)
  if (!k) return null
  const rows = (['squat', 'bench', 'deadlift'] as const).filter((l) => k.transfer[l])
  if (!rows.length) return <div className="text-[12px] text-ink3">No specific transfer to the big three — this is physique/fitness work.</div>
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((l) => (
        <span key={l} className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${T_TONE[k.transfer[l]!]}`}>
          {l[0].toUpperCase() + l.slice(1)}: {TRANSFER_LABEL[k.transfer[l]!]}
        </span>
      ))}
    </div>
  )
}

export function PhaseTimeline({ current, onPick }: { current: number; onPick?: (w: number) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="list" aria-label="12-week timeline">
      {PHASES.map((p) => {
        const on = p.week === current, done = p.week < current
        return (
          <button key={p.week} type="button" role="listitem" onClick={() => onPick?.(p.week)}
            aria-current={on ? 'step' : undefined}
            className={`pressable flex min-w-[86px] shrink-0 flex-col rounded-xl px-2.5 py-2 text-left ${on ? 'bg-brand text-white' : done ? 'bg-brand/15 text-brand' : p.deload ? 'bg-sky-500/10 text-sky-300' : 'bg-surface2 text-ink2'}`}>
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">Week {p.week}</span>
            <span className="text-[12px] font-semibold leading-tight">{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ExerciseLink({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const navigate = useNavigate()
  return <button type="button" className={`pressable text-left text-brand underline-offset-2 hover:underline ${className}`} onClick={() => navigate(`/exercise/${id}`)}>{children}</button>
}

export function RirTag({ rir }: { rir?: [number, number] }) {
  if (!rir) return null
  const txt = rir[0] >= 4 ? '4+ RIR' : rir[0] === rir[1] ? `${rir[0]} RIR` : `${rir[0]}–${rir[1]} RIR`
  return <span className="rounded-md bg-surface3 px-1.5 py-0.5 text-[11px] font-semibold text-ink2">{txt}</span>
}

export function fmtRest(sec: number): string {
  if (sec >= 180) return `${Math.round(sec / 60 - 1)}–${Math.round(sec / 60 + 1)} min`
  if (sec >= 120) return '2–3 min'
  return `${sec}s`
}

/** Full-width hero image with a dark gradient for text; disappears cleanly if the image is missing. */
export function HeroBanner({ id, children, className = '' }: { id: import('@/data/brand').HeroId; children?: React.ReactNode; className?: string }) {
  const [ok, setOk] = useState(true)
  const h = heroSrc(id)
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-surface2 ${className}`}>
      {ok && <img src={h.small} srcSet={`${h.small} 640w, ${h.src} 1280w`} sizes="(max-width: 520px) 100vw, 520px" alt="" loading="lazy" decoding="async" onError={() => setOk(false)} className="aspect-[16/9] w-full object-cover" />}
      <div className={`${ok ? 'absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent' : ''}`} />
      {children && <div className={`${ok ? 'absolute inset-x-0 bottom-0' : ''} p-4`}>{children}</div>}
    </div>
  )
}
