// Real 3D anatomy from BodyParts3D (© The Database Center for Life Science,
// CC Attribution-Share Alike 2.1 Japan). The meshes are the real segmented
// muscles, skeleton and skin of the BodyParts3D model, simplified for phones
// by tools/bp3d_build.py into /media/iv-body.bin. Rectus abdominis and
// latissimus dorsi are not in BodyParts3D 4.0, so they are shaped over the
// model's own skin surface (flagged `syn`).
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Muscle } from '@/db/types'
import { anatomyById, anatomySets, heatHex } from '@/lib/anatomy'

interface PartMeta { id: string; kind: 'muscle' | 'bone' | 'skin'; side: string; vo: number; vc: number; io: number; ic: number; syn?: boolean }
export interface BodyFile { min: number[]; max: number[]; parts: PartMeta[]; pos: Uint16Array; idx: Uint16Array; credit: string }

/** parse the IVB1 container written by tools/bp3d_build.py */
export function parseBody(buf: ArrayBuffer): BodyFile {
  const dv = new DataView(buf)
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
  if (magic !== 'IVB1') throw new Error('not an Ironverse body file')
  const hl = dv.getUint32(4, true)
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)))
  const nv = head.parts.reduce((n: number, p: PartMeta) => n + p.vc, 0)
  const ni = head.parts.reduce((n: number, p: PartMeta) => n + p.ic, 0)
  const po = 8 + hl
  const pos = new Uint16Array(buf.slice(po, po + nv * 6))
  const io = po + nv * 6 + ((4 - ((nv * 6) % 4)) % 4)
  const idx = new Uint16Array(buf.slice(io, io + ni * 2))
  return { min: head.min, max: head.max, parts: head.parts, pos, idx, credit: head.credit }
}

let cache: Promise<BodyFile> | null = null
export function loadBody(): Promise<BodyFile> {
  if (!cache) cache = fetch('/media/iv-body.bin').then((r) => { if (!r.ok) throw new Error(`body file ${r.status}`); return r.arrayBuffer() }).then(parseBody)
  cache.catch(() => { cache = null })
  return cache
}

const MUSCLE_RED = 0xb23a32
export default function Body3D({ mode, sel, byMuscle, onPick, layers }: {
  mode: 'anatomy' | 'heat'; sel: string | null; byMuscle: Map<Muscle, number>; onPick: (id: string | null) => void
  layers: { skin: boolean; muscles: boolean; bones: boolean }
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const ctrlRef = useRef<OrbitControls | null>(null)
  const matsRef = useRef(new Map<string, THREE.MeshStandardMaterial>())
  const groupsRef = useRef<{ skin: THREE.Group; muscles: THREE.Group; bones: THREE.Group } | null>(null)
  const pickRef = useRef(onPick); pickRef.current = onPick
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const el = mountRef.current; if (!el) return
    let disposed = false, raf = 0
    const w = el.clientWidth, h = el.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(w, h)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(32, w / h, 0.05, 20); cam.position.set(0, 1.0, 3.6)
    scene.add(new THREE.HemisphereLight(0xfff4ea, 0x1b2230, 1.0))
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 2.6, 2.4); scene.add(key)
    const fill = new THREE.DirectionalLight(0xbcd4ff, 0.7); fill.position.set(-2, 1.2, 1.5); scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffc27a, 1.1); rim.position.set(-1.2, 2.2, -2.6); scene.add(rim)
    const back = new THREE.DirectionalLight(0xffffff, 0.8); back.position.set(1.5, 1.5, -2.5); scene.add(back)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.07 })); floor.rotation.x = -Math.PI / 2; scene.add(floor)
    const groups = { skin: new THREE.Group(), muscles: new THREE.Group(), bones: new THREE.Group() }
    scene.add(groups.bones, groups.muscles, groups.skin); groupsRef.current = groups
    const ctrl = new OrbitControls(cam, renderer.domElement); ctrl.target.set(0, 0.95, 0); ctrl.enablePan = true; ctrl.minDistance = 0.5; ctrl.maxDistance = 5
    ctrl.enableDamping = true; ctrlRef.current = ctrl
    const pickables: THREE.Mesh[] = []
    let progress = 0; const tick = setInterval(() => { if (progress < 90) { progress += 7; setPct(progress) } }, 180)

    loadBody().then((B) => {
      if (disposed) return
      const s = [(B.max[0] - B.min[0]) / 65535, (B.max[1] - B.min[1]) / 65535, (B.max[2] - B.min[2]) / 65535]
      const cx = (B.max[0] + B.min[0]) / 2, cy = (B.max[1] + B.min[1]) / 2, z0 = B.min[2]
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc3, roughness: 0.75, metalness: 0 })
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a487, roughness: 0.55, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
      for (const p of B.parts) {
        const P = new Float32Array(p.vc * 3)
        for (let i = 0; i < p.vc; i++) {
          const k = (p.vo + i) * 3
          const x = B.min[0] + B.pos[k] * s[0], y = B.min[1] + B.pos[k + 1] * s[1], z = B.min[2] + B.pos[k + 2] * s[2]
          // BodyParts3D: mm, X = patient left, Y = back, Z = up  →  three: metres, Y up, Z toward the viewer
          P[i * 3] = (x - cx) / 1000; P[i * 3 + 1] = (z - z0) / 1000; P[i * 3 + 2] = -(y - cy) / 1000
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(P, 3))
        g.setIndex(new THREE.BufferAttribute(B.idx.slice(p.io, p.io + p.ic), 1))
        g.computeVertexNormals()
        let mat: THREE.Material = boneMat
        if (p.kind === 'skin') mat = skinMat
        if (p.kind === 'muscle') {
          if (!matsRef.current.has(p.id)) {
            const tint = new THREE.Color(MUSCLE_RED).offsetHSL(((p.id.length * 37) % 9 - 4) / 400, 0, ((p.id.charCodeAt(0) % 7) - 3) / 120)
            matsRef.current.set(p.id, new THREE.MeshStandardMaterial({ color: tint, roughness: 0.42, metalness: 0.02, side: p.syn ? THREE.DoubleSide : THREE.FrontSide, polygonOffset: !!p.syn, polygonOffsetFactor: -1 }))
          }
          mat = matsRef.current.get(p.id)!
        }
        const m = new THREE.Mesh(g, mat)
        m.userData = { id: p.id, kind: p.kind, syn: !!p.syn }
        ;(p.kind === 'muscle' ? groups.muscles : p.kind === 'bone' ? groups.bones : groups.skin).add(m)
        if (p.kind === 'muscle') pickables.push(m)
      }
      clearInterval(tick); setPct(100); setState('ready')
    }).catch(() => { clearInterval(tick); if (!disposed) setState('error') })

    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = { x: 0, y: 0 }
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ptr, cam)
      const hit = ray.intersectObjects(pickables.filter((m) => m.visible && m.parent?.visible))[0]
      pickRef.current(hit ? (hit.object.userData.id as string) : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp)
    const loop = () => { ctrl.update(); renderer.render(scene, cam); raf = requestAnimationFrame(loop) }; loop()
    const onResize = () => { const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix() }
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true; clearInterval(tick); cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); ctrl.dispose()
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.() }); renderer.dispose(); el.removeChild(renderer.domElement)
    }
  }, [])

  // layers
  useEffect(() => { const g = groupsRef.current; if (!g) return; g.skin.visible = layers.skin; g.muscles.visible = layers.muscles; g.bones.visible = layers.bones }, [layers, state])
  // colours: anatomy red or training heat; selected muscle glows gold
  useEffect(() => {
    for (const [id, mat] of matsRef.current) {
      const a = anatomyById(id)
      if (mode === 'heat' && a) mat.color.set(heatHex(anatomySets(byMuscle, a)))
      else mat.color.setHex(MUSCLE_RED).offsetHSL(((id.length * 37) % 9 - 4) / 400, 0, ((id.charCodeAt(0) % 7) - 3) / 120)
      mat.emissive.setHex(sel === id ? 0x8a5a00 : 0x000000)
      mat.transparent = !!sel && sel !== id; mat.opacity = sel && sel !== id ? 0.55 : 1
    }
  }, [mode, sel, byMuscle, state])

  const view = (az: number, y = 1.0, d?: number) => {
    const c = ctrlRef.current; if (!c) return; const cam = c.object as THREE.PerspectiveCamera
    const dist = d ?? cam.position.distanceTo(c.target); c.target.set(0, y > 1.2 ? 1.25 : 0.95, 0)
    cam.position.set(Math.sin(az) * dist, y, Math.cos(az) * dist); c.update()
  }

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0 touch-none" />
      {state !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] text-ink2">
          {state === 'loading' ? <><div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface3"><i className="block h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>Loading the 3D body (3.8 MB, saved for offline after the first time)</> : <>Could not load the 3D body — check your connection. The 2D view works offline.</>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
        {([['Front', 0], ['Side', Math.PI / 2], ['Back', Math.PI]] as const).map(([l, a]) => <button key={l} type="button" onClick={() => view(a, 1.0, 3.6)} className="pressable flex-1 rounded-full bg-black/55 py-2 text-[12.5px] font-semibold text-white backdrop-blur">{l}</button>)}
        <button type="button" onClick={() => view(0, 1.35, 1.6)} className="pressable flex-1 rounded-full bg-black/55 py-2 text-[12.5px] font-semibold text-white backdrop-blur">Upper</button>
      </div>
    </div>
  )
}
