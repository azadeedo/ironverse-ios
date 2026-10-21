// Ironverse exercise animation engine.
// A side-view articulated figure rendered in SVG, animated by interpolating
// between keyframe poses (see Pose in db/types). Equipment props (bars, cables,
// benches, ropes) are drawn relative to the computed hand/foot positions.

import { useEffect, useRef, useState } from 'react'
import type { ExerciseAnimDef, Pose, PropKind } from '@/db/types'

// ---- rig dimensions (viewBox units) ----
const L = {
  torso: 34, neck: 5, head: 7.5,
  upperArm: 16, forearm: 15,
  thigh: 19, shin: 18, foot: 7,
}

const DEFAULT_POSE: Required<Omit<Pose, 'shoulder2' | 'elbow2' | 'hip2' | 'knee2'>> = {
  x: 0, y: 0, torso: 0, neck: 0, shoulder: 0, elbow: 0, hip: 0, knee: 0, ankle: 0,
}

type FullPose = typeof DEFAULT_POSE & { shoulder2: number; elbow2: number; hip2: number; knee2: number }

function fill(p: Pose): FullPose {
  const base = { ...DEFAULT_POSE, ...p }
  return {
    ...base,
    shoulder2: p.shoulder2 ?? base.shoulder,
    elbow2: p.elbow2 ?? base.elbow,
    hip2: p.hip2 ?? base.hip,
    knee2: p.knee2 ?? base.knee,
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPose(a: FullPose, b: FullPose, t: number): FullPose {
  const out = {} as FullPose
  for (const k of Object.keys(a) as (keyof FullPose)[]) out[k] = lerp(a[k], b[k], t)
  return out
}

const rad = (deg: number) => (deg * Math.PI) / 180

interface Pt { x: number; y: number }

/** forward kinematics — returns all joint points for a pose (origin = hip at 0,0; y down) */
function solve(p: FullPose) {
  const hip: Pt = { x: p.x, y: p.y }
  const tDir = rad(p.torso)
  const shoulder: Pt = { x: hip.x + L.torso * Math.sin(tDir), y: hip.y - L.torso * Math.cos(tDir) }
  const nDir = rad(p.torso + p.neck)
  const neckTop: Pt = { x: shoulder.x + L.neck * Math.sin(nDir), y: shoulder.y - L.neck * Math.cos(nDir) }
  const head: Pt = { x: neckTop.x + (L.head - 1) * Math.sin(nDir), y: neckTop.y - (L.head - 1) * Math.cos(nDir) }

  const arm = (sh: number, el: number) => {
    const aDir = rad(p.torso + sh) // 0 = down along torso, + forward
    const elbow: Pt = { x: shoulder.x + L.upperArm * Math.sin(aDir), y: shoulder.y + L.upperArm * Math.cos(aDir) }
    const fDir = rad(p.torso + sh + el)
    const hand: Pt = { x: elbow.x + L.forearm * Math.sin(fDir), y: elbow.y + L.forearm * Math.cos(fDir) }
    return { elbow, hand }
  }
  const leg = (hp: number, kn: number, ank: number) => {
    const thDir = rad(p.torso + hp)
    const knee: Pt = { x: hip.x + L.thigh * Math.sin(thDir), y: hip.y + L.thigh * Math.cos(thDir) }
    const shDir = rad(p.torso + hp - kn)
    const ankle: Pt = { x: knee.x + L.shin * Math.sin(shDir), y: knee.y + L.shin * Math.cos(shDir) }
    const ftDir = rad(90 + ank) // foot roughly horizontal forward
    const toe: Pt = { x: ankle.x + L.foot * Math.sin(ftDir), y: ankle.y + L.foot * Math.cos(ftDir) }
    return { knee, ankle, toe }
  }

  return {
    hip, shoulder, neckTop, head,
    armN: arm(p.shoulder, p.elbow),
    armF: arm(p.shoulder2, p.elbow2),
    legN: leg(p.hip, p.knee, p.ankle),
    legF: leg(p.hip2, p.knee2, p.ankle),
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// ---------- component ----------
export function ExerciseAnim({ def, size = 220, playing = true, accent = '#fbbf24', className = '', speed = 1, resetKey = 0 }: {
  def: ExerciseAnimDef
  size?: number
  playing?: boolean
  accent?: string
  className?: string
  /** v6: 1 = normal, 0.5 = slow motion */
  speed?: number
  /** v6: change to restart from the first frame */
  resetKey?: number
}) {
  const [phase, setPhase] = useState(0) // 0..1 through the full ping-pong cycle
  const raf = useRef<number>()
  const start = useRef<number>()

  useEffect(() => {
    start.current = undefined
    setPhase(0)
  }, [resetKey])

  useEffect(() => {
    if (!playing) return
    const cycle = ((def.cycle ?? 2.6) * 1000) / Math.max(0.1, speed)
    // resume from the frozen phase instead of jumping
    const from = phase
    start.current = undefined
    const loop = (ts: number) => {
      if (start.current === undefined) start.current = ts - from * cycle
      setPhase(((ts - start.current) % cycle) / cycle)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
    // phase is read once as the resume point; re-running on every frame would restart the loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, playing, speed, resetKey])

  const poses = def.poses.length >= 2 ? def.poses.map(fill) : [fill(def.poses[0] ?? {}), fill(def.poses[0] ?? {})]
  // ping-pong across keyframes: 0..0.5 forward, 0.5..1 backward
  const segCount = poses.length - 1
  const dir = phase < 0.5 ? phase * 2 : (1 - phase) * 2 // 0..1..0
  const pos = dir * segCount
  const seg = Math.min(segCount - 1, Math.floor(pos))
  const t = easeInOut(pos - seg)
  const pose = lerpPose(poses[seg], poses[seg + 1], t)
  const J = solve(pose)

  const inkSoft = 'var(--ink3)'
  const ink = 'var(--ink)'
  const lw = 4.6

  const limb = (a: Pt, b: Pt, c: Pt, color: string, w = lw) => (
    <polyline
      points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
      fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
    />
  )

  // viewBox: figure roughly within [-60..60] x [-75..45] around hip
  const vb = '-62 -80 124 132'
  const lyingRotate = def.lying ? 'rotate(-90)' : undefined

  return (
    <svg viewBox={vb} width={size} height={size} className={className} aria-hidden="true">
      {/* ground */}
      {!def.lying && <line x1={-56} y1={38} x2={56} y2={38} stroke="var(--line)" strokeWidth={1.5} />}
      <g transform={lyingRotate}>
        {propBehind(def.prop, J, accent, phase)}
        {/* far limbs first (dimmer) */}
        {limb(J.hip, J.legF.knee, J.legF.ankle, inkSoft)}
        <line x1={J.legF.ankle.x} y1={J.legF.ankle.y} x2={J.legF.toe.x} y2={J.legF.toe.y} stroke={inkSoft} strokeWidth={lw} strokeLinecap="round" />
        {limb(J.shoulder, J.armF.elbow, J.armF.hand, inkSoft)}
        {/* torso + head */}
        <line x1={J.hip.x} y1={J.hip.y} x2={J.shoulder.x} y2={J.shoulder.y} stroke={ink} strokeWidth={lw + 1.6} strokeLinecap="round" />
        <circle cx={J.head.x} cy={J.head.y} r={L.head} fill="none" stroke={ink} strokeWidth={lw - 0.8} />
        {/* near limbs */}
        {limb(J.hip, J.legN.knee, J.legN.ankle, ink)}
        <line x1={J.legN.ankle.x} y1={J.legN.ankle.y} x2={J.legN.toe.x} y2={J.legN.toe.y} stroke={ink} strokeWidth={lw} strokeLinecap="round" />
        {limb(J.shoulder, J.armN.elbow, J.armN.hand, ink)}
        {propFront(def.prop, J, accent, phase)}
      </g>
    </svg>
  )
}

// ---------- equipment props ----------
type Joints = ReturnType<typeof solve>

function propBehind(kind: PropKind, J: Joints, accent: string, phase: number) {
  switch (kind) {
    case 'smith':
      return (
        <g stroke="var(--line)" strokeWidth={3}>
          <line x1={J.armN.hand.x} y1={-78} x2={J.armN.hand.x} y2={40} />
        </g>
      )
    case 'bench-flat':
      return <rect x={-34} y={6} width={62} height={7} rx={3} fill="var(--surface3)" stroke="var(--line)" strokeWidth={1.5} />
    case 'bench-incline':
      return (
        <g fill="var(--surface3)" stroke="var(--line)" strokeWidth={1.5}>
          <rect x={-12} y={4} width={34} height={7} rx={3} />
          <rect x={-34} y={-26} width={9} height={40} rx={3} transform="rotate(-38 -30 -6)" />
        </g>
      )
    case 'pullup-bar':
      return (
        <g stroke="var(--line)" strokeWidth={3.4} strokeLinecap="round">
          <line x1={-52} y1={J.armN.hand.y} x2={52} y2={J.armN.hand.y} />
          <line x1={48} y1={J.armN.hand.y} x2={48} y2={44} strokeWidth={2.6} />
        </g>
      )
    case 'dip-bars':
      return <line x1={J.armN.hand.x - 16} y1={J.armN.hand.y} x2={J.armN.hand.x + 16} y2={J.armN.hand.y} stroke="var(--line)" strokeWidth={3.4} strokeLinecap="round" />
    case 'cable-down':
      return <line x1={44} y1={-78} x2={J.armN.hand.x} y2={J.armN.hand.y} stroke={accent} strokeWidth={1.8} strokeDasharray="1 3" />
    case 'cable-up':
      return <line x1={38} y1={38} x2={J.armN.hand.x} y2={J.armN.hand.y} stroke={accent} strokeWidth={1.8} strokeDasharray="1 3" />
    case 'rope': {
      // spinning rope: alternate arc above / below based on phase
      const above = Math.sin(phase * Math.PI * 6) > 0
      const hy = J.armN.hand.y
      return (
        <path
          d={above
            ? `M ${J.armN.hand.x - 2} ${hy} Q 0 ${J.head.y - 26} ${-J.armN.hand.x + 2} ${hy}`
            : `M ${J.armN.hand.x - 2} ${hy} Q 0 ${J.legN.toe.y + 12} ${-J.armN.hand.x + 2} ${hy}`}
          fill="none" stroke={accent} strokeWidth={1.8}
        />
      )
    }
    default:
      return null
  }
}

function propFront(kind: PropKind, J: Joints, accent: string, _phase: number) {
  const hand = J.armN.hand
  switch (kind) {
    case 'barbell':
    case 'smith':
      return (
        <g>
          <circle cx={hand.x} cy={hand.y} r={9.5} fill="var(--surface2)" stroke={accent} strokeWidth={3} />
          <circle cx={hand.x} cy={hand.y} r={3.4} fill={accent} />
        </g>
      )
    case 'curl-bar':
      return (
        <g>
          <circle cx={hand.x} cy={hand.y} r={7} fill="var(--surface2)" stroke={accent} strokeWidth={2.6} />
          <circle cx={hand.x} cy={hand.y} r={2.6} fill={accent} />
        </g>
      )
    case 'plate':
      return <circle cx={hand.x} cy={hand.y} r={8} fill="none" stroke={accent} strokeWidth={3.4} />
    case 'cable-down':
    case 'cable-up':
      return <circle cx={hand.x} cy={hand.y} r={3} fill={accent} />
    default:
      return null
  }
}
