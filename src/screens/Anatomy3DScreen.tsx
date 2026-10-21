// IV-10 / IV-26 — interactive 3D body (real WebGL via three.js, not a video).
// A stylised anatomical figure: drag to rotate, pinch to zoom, tap a muscle to
// see what it does, this week's hard sets, when you last trained it, the
// exercises that hit it, and your tape measurement for that body part.
// Honest by design: it is a stylised model, colours show TRAINING, not growth.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { db } from '@/db'
import { Badge, Button, Card, PageHeader, Section } from '@/components/ui'
import { EXERCISES } from '@/data/exercises'
import type { Measurement, Muscle, WorkoutLog } from '@/db/types'
import { weeklyHardSets } from '@/lib/training'

export interface Group { key: string; label: string; muscles: Muscle[]; measure?: keyof Measurement['values']; info: string }
export const GROUPS3D: Group[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest'], measure: 'chest', info: 'Pectorals — pushes the arms forward and across the body (bench press, flyes, dips).' },
  { key: 'shoulders', label: 'Shoulders', muscles: ['front-delts', 'side-delts', 'rear-delts'], measure: 'shoulders', info: 'Deltoids — front, side and rear heads lift the arm in every direction.' },
  { key: 'biceps', label: 'Biceps', muscles: ['biceps'], measure: 'biceps', info: 'Bends the elbow and turns the palm up (curls, chin-ups, rows).' },
  { key: 'triceps', label: 'Triceps', muscles: ['triceps'], measure: 'biceps', info: 'Straightens the elbow — two-thirds of upper-arm size (pushdowns, presses, dips).' },
  { key: 'forearms', label: 'Forearms', muscles: ['forearms'], info: 'Grip and wrist — trained by holding heavy things and wrist curls.' },
  { key: 'abs', label: 'Abs & obliques', muscles: ['abs', 'obliques'], measure: 'abs', info: 'Brace the trunk, flex and twist the spine (planks, leg raises, cable crunches).' },
  { key: 'traps', label: 'Traps', muscles: ['traps'], info: 'Shrug and steady the shoulder blades (shrugs, heavy carries, rows).' },
  { key: 'lats', label: 'Lats & upper back', muscles: ['lats', 'upper-back'], info: 'Pull the arms down and back — the V-taper (pull-ups, pulldowns, rows).' },
  { key: 'lowerback', label: 'Lower back', muscles: ['lower-back'], info: 'Keeps the spine straight under load (deadlifts, back extensions).' },
  { key: 'glutes', label: 'Glutes', muscles: ['glutes'], measure: 'hips', info: 'Extend the hip — the strongest muscles in the body (hip thrusts, squats, RDLs).' },
  { key: 'quads', label: 'Quads', muscles: ['quads'], measure: 'thigh', info: 'Straighten the knee (squats, leg press, leg extensions).' },
  { key: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'], measure: 'thigh', info: 'Bend the knee and extend the hip (leg curls, RDLs).' },
  { key: 'calves', label: 'Calves', muscles: ['calves'], measure: 'calf', info: 'Point the foot — push off every step (calf raises).' },
]
export function setsColour(sets: number): number { return sets === 0 ? 0x3b4a5e : sets < 6 ? 0xb7791f : sets < 10 ? 0xeab308 : sets <= 20 ? 0x22c55e : 0xef4444 }
export function groupSets(byMuscle: Map<Muscle, number>, g: Group): number { return Math.max(0, ...g.muscles.map((m) => byMuscle.get(m) ?? 0)) }

type Part = { g: string; kind: 'capsule' | 'sphere' | 'box'; p: [number, number, number]; s: [number, number, number]; r?: [number, number, number]; mirror?: boolean }
/* the figure: y up, z toward the viewer (front). Units ≈ metres. */
const BASE: Part[] = [
  { g: '', kind: 'sphere', p: [0, 1.66, 0], s: [0.11, 0.13, 0.12] },            // head
  { g: '', kind: 'capsule', p: [0, 1.50, 0], s: [0.05, 0.06, 0.05] },            // neck
  { g: '', kind: 'capsule', p: [0, 1.22, 0], s: [0.17, 0.30, 0.11] },            // torso core
  { g: '', kind: 'capsule', p: [0, 0.93, 0], s: [0.16, 0.10, 0.11] },            // pelvis
  { g: '', kind: 'capsule', p: [0.4, 0.84, 0.02], s: [0.035, 0.05, 0.035], mirror: true }, // hand
  { g: '', kind: 'box', p: [0.12, 0.04, 0.05], s: [0.05, 0.03, 0.12], mirror: true },      // foot
]
const MUSC: Part[] = [
  { g: 'chest', kind: 'sphere', p: [0.085, 1.33, 0.085], s: [0.1, 0.07, 0.05], mirror: true },
  { g: 'shoulders', kind: 'sphere', p: [0.225, 1.38, 0], s: [0.075, 0.075, 0.075], mirror: true },
  { g: 'biceps', kind: 'capsule', p: [0.27, 1.18, 0.03], s: [0.042, 0.11, 0.042], r: [0, 0, 0.12], mirror: true },
  { g: 'triceps', kind: 'capsule', p: [0.275, 1.19, -0.035], s: [0.045, 0.12, 0.042], r: [0, 0, 0.12], mirror: true },
  { g: 'forearms', kind: 'capsule', p: [0.33, 0.97, 0.01], s: [0.04, 0.12, 0.04], r: [0, 0, 0.2], mirror: true },
  { g: 'abs', kind: 'capsule', p: [0, 1.11, 0.085], s: [0.1, 0.13, 0.04] },
  { g: 'traps', kind: 'capsule', p: [0, 1.42, -0.05], s: [0.12, 0.05, 0.05], r: [0, 0, Math.PI / 2] },
  { g: 'lats', kind: 'capsule', p: [0.11, 1.24, -0.075], s: [0.075, 0.16, 0.045], r: [0, 0, -0.18], mirror: true },
  { g: 'lowerback', kind: 'capsule', p: [0, 1.03, -0.085], s: [0.09, 0.08, 0.035] },
  { g: 'glutes', kind: 'sphere', p: [0.075, 0.9, -0.085], s: [0.09, 0.09, 0.07], mirror: true },
  { g: 'quads', kind: 'capsule', p: [0.095, 0.62, 0.035], s: [0.075, 0.2, 0.07], mirror: true },
  { g: 'hamstrings', kind: 'capsule', p: [0.095, 0.62, -0.04], s: [0.07, 0.19, 0.06], mirror: true },
  { g: 'calves', kind: 'capsule', p: [0.1, 0.25, -0.025], s: [0.055, 0.14, 0.055], mirror: true },
  { g: '', kind: 'capsule', p: [0.1, 0.25, 0.02], s: [0.045, 0.15, 0.045], mirror: true }, // shins (base)
]

function meshFor(part: Part, mat: THREE.Material, x: number): THREE.Mesh {
  const geo = part.kind === 'sphere' ? new THREE.SphereGeometry(1, 28, 20) : part.kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CapsuleGeometry(1, 1.4, 10, 20)
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, part.p[1], part.p[2])
  if (part.kind === 'capsule') m.scale.set(part.s[0], part.s[1] / 1.7, part.s[2]); else m.scale.set(part.s[0] * (part.kind === 'box' ? 1 : 1), part.s[1], part.s[2])
  if (part.r) m.rotation.set(part.r[0], part.r[1], x < 0 ? -part.r[2] : part.r[2])
  return m
}

export default function Anatomy3DScreen() {
  const navigate = useNavigate()
  const mountRef = useRef<HTMLDivElement>(null)
  const ctrlRef = useRef<OrbitControls | null>(null)
  const matsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map())
  const [sel, setSel] = useState<string | null>(null)
  const [spin, setSpin] = useState(true)
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const meas = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])
  const week = useMemo(() => (logs ? weeklyHardSets(logs) : null), [logs])
  const byMuscle = useMemo(() => new Map<Muscle, number>((week?.byMuscle ?? []).map((m) => [m.muscle, m.sets])), [week])

  useEffect(() => {
    const el = mountRef.current; if (!el) return
    const w = el.clientWidth, h = el.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(w, h); el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(35, w / h, 0.1, 20); cam.position.set(0, 1.05, 3.2)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 3); scene.add(key)
    const rim = new THREE.DirectionalLight(0xfbbf24, 0.6); rim.position.set(-2, 2, -3); scene.add(rim)
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a3442, roughness: 0.7, metalness: 0.05 })
    const pickables: THREE.Mesh[] = []
    for (const part of [...BASE, ...MUSC]) {
      const xs = part.mirror ? [part.p[0], -part.p[0]] : [part.p[0]]
      for (const x of xs) {
        let mat: THREE.Material = baseMat
        if (part.g) {
          if (!matsRef.current.has(part.g)) matsRef.current.set(part.g, new THREE.MeshStandardMaterial({ color: 0x3b4a5e, roughness: 0.45, metalness: 0.1, emissive: 0x000000 }))
          mat = matsRef.current.get(part.g)!
        }
        const m = meshFor(part, mat, x); m.userData.g = part.g; scene.add(m); if (part.g) pickables.push(m)
      }
    }
    // upper arm / thigh base so the limbs read as limbs
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.08 })); floor.rotation.x = -Math.PI / 2; scene.add(floor)
    const ctrl = new OrbitControls(cam, renderer.domElement); ctrl.target.set(0, 0.95, 0); ctrl.enablePan = false; ctrl.minDistance = 1.6; ctrl.maxDistance = 4.5
    ctrl.enableDamping = true; ctrl.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; ctrl.autoRotateSpeed = 1.2; ctrlRef.current = ctrl
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = { x: 0, y: 0 }
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(pickables)[0]
      setSel(hit ? (hit.object.userData.g as string) : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp)
    let raf = 0; const loop = () => { ctrl.update(); renderer.render(scene, cam); raf = requestAnimationFrame(loop) }; loop()
    const onResize = () => { const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix() }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); ctrl.dispose(); renderer.dispose(); scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.() }); el.removeChild(renderer.domElement) }
  }, [])

  // colour by this week's hard sets; highlight the selected group
  useEffect(() => {
    for (const g of GROUPS3D) {
      const mat = matsRef.current.get(g.key); if (!mat) continue
      mat.color.setHex(setsColour(groupSets(byMuscle, g)))
      mat.emissive.setHex(sel === g.key ? 0x664400 : 0x000000)
    }
  }, [byMuscle, sel])
  useEffect(() => { if (ctrlRef.current) ctrlRef.current.autoRotate = spin && !sel }, [spin, sel])

  const view = (az: number) => { const c = ctrlRef.current; if (!c) return; setSpin(false); const cam = c.object as THREE.PerspectiveCamera; const d = cam.position.distanceTo(c.target); cam.position.set(Math.sin(az) * d, 1.05, Math.cos(az) * d); c.update() }
  const g = GROUPS3D.find((x) => x.key === sel)
  const last = useMemo(() => {
    if (!g || !logs) return null
    const fin = (logs as WorkoutLog[]).filter((l) => l.finishedAt && !l.skipped).sort((a, b) => b.date.localeCompare(a.date))
    for (const l of fin) if (l.exercises.some((e) => EXERCISES.find((x) => x.id === e.exerciseId)?.primary.some((m) => g.muscles.includes(m)) && e.sets.some((s) => s.done && !s.warmup))) return l.date
    return null
  }, [g, logs])
  const exs = g ? EXERCISES.filter((e) => e.primary.some((m) => g.muscles.includes(m))).slice(0, 8) : []
  const mm = g?.measure && meas?.length ? meas.filter((m) => m.values[g.measure!] !== undefined) : []
  const sets = g ? groupSets(byMuscle, g) : 0

  return (
    <div className="pb-10">
      <PageHeader title="3D body" back subtitle="Drag to rotate, pinch to zoom, tap a muscle." />
      <div className="relative mx-4 h-[52vh] min-h-[340px] overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface2 to-surface">
        <div ref={mountRef} className="absolute inset-0 touch-none" />
        <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
          {[['Front', 0], ['Side', Math.PI / 2], ['Back', Math.PI]].map(([l, a]) => <button key={l as string} type="button" onClick={() => view(a as number)} className="pressable flex-1 rounded-full bg-black/55 py-1.5 text-[12px] font-semibold text-white backdrop-blur">{l}</button>)}
          <button type="button" onClick={() => setSpin((v) => !v)} className={`pressable flex-1 rounded-full py-1.5 text-[12px] font-semibold backdrop-blur ${spin ? 'bg-brand text-black' : 'bg-black/55 text-white'}`}>{spin ? 'Spinning' : 'Spin'}</button>
        </div>
      </div>
      <div className="mx-4 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink3">
        {[[0x3b4a5e, 'not trained this week'], [0xb7791f, '1–5 sets'], [0xeab308, '6–9'], [0x22c55e, '10–20 (sweet spot)'], [0xef4444, '20+']].map(([c, l]) => <span key={l as string} className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `#${(c as number).toString(16).padStart(6, '0')}` }} />{l}</span>)}
      </div>
      <Section>
        {g ? (
          <Card className="space-y-2 p-4 text-[13px]">
            <div className="flex items-center gap-2"><b className="flex-1 text-[16px]">{g.label}</b><Badge tone={sets >= 10 && sets <= 20 ? 'green' : sets ? 'amber' : 'gray'}>{sets} hard sets this week</Badge></div>
            <div className="text-ink2">{g.info}</div>
            <div className="text-ink3">Last trained: {last ? `${dayjs(last).format('ddd D MMM')} (${dayjs().diff(dayjs(last), 'day')} days ago)` : 'not in your log yet'}</div>
            {g.measure && <div className="text-ink3">Tape ({g.measure}): {mm.length ? `${mm[mm.length - 1].values[g.measure]} cm on ${dayjs(mm[mm.length - 1].date).format('D MMM')}${mm.length > 1 ? ` · ${(Number(mm[mm.length - 1].values[g.measure]) - Number(mm[0].values[g.measure])).toFixed(1)} cm since ${dayjs(mm[0].date).format('D MMM')}` : ''}` : 'no measurement yet'}</div>}
            <div><div className="mb-1 text-[12px] font-semibold text-ink2">Exercises for it</div><div className="flex flex-wrap gap-1.5">{exs.map((e) => <button key={e.id} type="button" onClick={() => navigate(`/exercise/${e.id}`)} className="pressable rounded-full bg-surface3 px-2.5 py-1 text-[12px]">{e.name}</button>)}</div></div>
            <div className="flex gap-2 pt-1"><Button small variant="secondary" onClick={() => navigate('/hub')}>Muscle trends</Button><Button small variant="secondary" onClick={() => navigate('/progress')}>Measurements</Button></div>
          </Card>
        ) : <Card className="p-4 text-[13px] text-ink3">Tap any muscle on the model. Colours show this week’s hard sets — a training guide, not a measure of muscle size.</Card>}
      </Section>
      <div className="mx-4 text-[11px] text-ink3">Stylised 3D model for finding muscles quickly — not an anatomical scan of your body.</div>
    </div>
  )
}
