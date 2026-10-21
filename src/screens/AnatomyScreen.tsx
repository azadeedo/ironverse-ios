// IV-10 v2 — real anatomy body map (replaces the capsule mannequin).
// Every muscle is drawn separately with its real name, origin, insertion,
// action and nerve. Front/Back turn the body around, pinch or the +/− buttons
// zoom, "My training" colours each real muscle by this week's hard sets, and
// "Quiz me" asks you to find muscles. Facts: Gray's Anatomy (1918, public
// domain) and OpenStax Anatomy & Physiology 2e (CC BY 4.0).
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { db } from '@/db'
import { Badge, Button, Card, PageHeader, Section } from '@/components/ui'
import { EXERCISES } from '@/data/exercises'
import { MUSCLE_LABELS, type Muscle, type WorkoutLog } from '@/db/types'
import { weeklyHardSets } from '@/lib/training'
import { ANATOMY, LANDMARKS, SILHOUETTE, anatomyById, anatomySets, heatHex, quizPick, searchAnatomy, type AnatomyMuscle, type View } from '@/lib/anatomy'

const Body3D = lazy(() => import('@/components/Body3D'))
const MIRROR = 'matrix(-1 0 0 1 200 0)'
/** training group → the tape measurement that tracks it */
const TAPE_FOR: Partial<Record<Muscle, 'chest' | 'shoulders' | 'biceps' | 'abs' | 'waist' | 'thigh' | 'calf' | 'neck' | 'hips'>> = {
  chest: 'chest', 'front-delts': 'shoulders', 'side-delts': 'shoulders', 'rear-delts': 'shoulders', biceps: 'biceps', triceps: 'biceps', forearms: 'biceps',
  abs: 'waist', obliques: 'waist', quads: 'thigh', hamstrings: 'thigh', calves: 'calf', glutes: 'hips', traps: 'neck', lats: 'chest', 'upper-back': 'chest', 'lower-back': 'waist', 'hip-flexors': 'hips',
}
const FIBRES = Array.from(new Set(ANATOMY.map((m) => m.fibre)))

function Figure({ view, mode, sel, byMuscle, onPick, quizWrong }: { view: View; mode: 'anatomy' | 'heat'; sel: string | null; byMuscle: Map<Muscle, number>; onPick: (id: string) => void; quizWrong: string | null }) {
  const ms = ANATOMY.filter((m) => m.view === view)
  return (
    <svg viewBox="0 0 200 440" className="h-full w-full" role="img" aria-label={`Muscle anatomy, ${view} view`}>
      <defs>
        <linearGradient id={`skin-${view}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b2c28" /><stop offset="1" stopColor="#231916" /></linearGradient>
        <linearGradient id={`mus-${view}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#cf5a4e" /><stop offset=".55" stopColor="#a8372f" /><stop offset="1" stopColor="#7b2420" /></linearGradient>
        <radialGradient id={`belly-${view}`} cx=".42" cy=".38" r=".65"><stop offset="0" stopColor="#fff" stopOpacity=".32" /><stop offset=".5" stopColor="#fff" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></radialGradient>
        {FIBRES.map((a) => (
          <pattern key={a} id={`fib-${view}-${a}`} width="1.7" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}>
            <line x1=".4" y1="0" x2=".4" y2="4" stroke="#2a0b09" strokeWidth=".45" strokeOpacity=".55" />
            <line x1="1.2" y1="0" x2="1.2" y2="4" stroke="#ffb3a8" strokeWidth=".25" strokeOpacity=".22" />
          </pattern>
        ))}
        <filter id={`glow-${view}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <path d={SILHOUETTE} fill={`url(#skin-${view})`} />
      <path d={SILHOUETTE} transform={MIRROR} fill={`url(#skin-${view})`} />
      {LANDMARKS[view].map((d, i) => (
        <g key={i} fill="#e8d6bd" opacity=".28"><path d={d} /><path d={d} transform={MIRROR} /></g>
      ))}
      {ms.map((m) => {
        const on = sel === m.id, wrong = quizWrong === m.id
        const fill = mode === 'heat' ? heatHex(anatomySets(byMuscle, m)) : `url(#mus-${view})`
        return (
          <g key={m.id} data-id={m.id} onClick={(e) => { e.stopPropagation(); onPick(m.id) }} className="cursor-pointer" style={{ transition: 'opacity .2s' }} opacity={sel && !on ? 0.72 : 1} filter={on ? `url(#glow-${view})` : undefined}>
            {[undefined, MIRROR].map((tf, k) => m.d.map((d, j) => (
              <g key={`${k}-${j}`} transform={tf}>
                <path d={d} fill={fill} />
                <path d={d} fill={`url(#fib-${view}-${m.fibre})`} />
                <path d={d} fill={`url(#belly-${view})`} />
                <path d={d} fill="none" stroke={on ? '#fbbf24' : wrong ? '#ef4444' : '#1a0b0a'} strokeWidth={on || wrong ? 1.3 : 0.45} strokeLinejoin="round" />
              </g>
            )))}
          </g>
        )
      })}
    </svg>
  )
}

export default function AnatomyScreen() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('front')
  const [dim, setDim] = useState<'2d' | '3d'>('2d')
  const [layers, setLayers] = useState({ skin: false, muscles: true, bones: true })
  const [mode, setMode] = useState<'anatomy' | 'heat'>('anatomy')
  const [sel, setSel] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [q, setQ] = useState('')
  const [quiz, setQuiz] = useState<{ target: AnatomyMuscle; score: number; tries: number; wrong: string | null; msg: string } | null>(null)
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const meas = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])
  const week = useMemo(() => (logs ? weeklyHardSets(logs) : null), [logs])
  const byMuscle = useMemo(() => new Map<Muscle, number>((week?.byMuscle ?? []).map((m) => [m.muscle, m.sets])), [week])

  // pinch / drag / double-tap on the figure
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const gest = useRef<{ d0: number; z0: number; p0: { x: number; y: number }; c0: { x: number; y: number }; moved: boolean; lastTap: number }>({ d0: 0, z0: 1, p0: { x: 0, y: 0 }, c0: { x: 0, y: 0 }, moved: false, lastTap: 0 })
  const clampZ = (z: number) => Math.min(3.2, Math.max(1, z))
  const onDown = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gest.current; g.moved = false; g.z0 = zoom; g.p0 = { ...pan }
    const a = [...pts.current.values()]
    if (a.length === 2) g.d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)
    g.c0 = { x: e.clientX, y: e.clientY }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gest.current, a = [...pts.current.values()]
    if (a.length === 2 && g.d0) { g.moved = true; setZoom(clampZ(g.z0 * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / g.d0)); return }
    const dx = e.clientX - g.c0.x, dy = e.clientY - g.c0.y
    if (Math.hypot(dx, dy) > 6) g.moved = true
    if (g.moved && zoom > 1) setPan({ x: g.p0.x + dx, y: g.p0.y + dy })
  }
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId)
    if (pts.current.size === 0) {
      const g = gest.current, now = Date.now()
      if (!g.moved && now - g.lastTap < 300) { const z = zoom > 1.2 ? 1 : 2; setZoom(z); if (z === 1) setPan({ x: 0, y: 0 }) }
      g.lastTap = g.moved ? 0 : now
      if (zoom <= 1.01) setPan({ x: 0, y: 0 })
    }
  }
  const zoomBy = (f: number) => { const z = clampZ(zoom * f); setZoom(z); if (z === 1) setPan({ x: 0, y: 0 }) }

  const pick = (id: string | null) => {
    if (!id) { if (!quiz) setSel(null); return }
    if (dim === '2d' && gest.current.moved) return
    if (quiz) {
      const right = id === quiz.target.id
      if (right) { const next = quizPick(quiz.target.id); setSel(id); setQuiz({ target: next, score: quiz.score + 1, tries: quiz.tries + 1, wrong: null, msg: `✓ Yes — that's the ${quiz.target.name}.` }); if (dim === '2d' && next.view !== view) setTimeout(() => setView(next.view), 900) }
      else setQuiz({ ...quiz, tries: quiz.tries + 1, wrong: id, msg: `✗ That's the ${anatomyById(id)?.name}. Try again.` })
      return
    }
    setSel((s) => (s === id ? null : id))
  }
  const goTo = (m: AnatomyMuscle) => { if (m.only3d) setDim('3d'); setView(m.view); setSel(m.id); setQ(''); setZoom(1); setPan({ x: 0, y: 0 }) }
  const startQuiz = () => { let t = quizPick(); while (dim === '2d' && t.only3d) t = quizPick(t.id); setSel(null); setView(t.view); setQuiz({ target: t, score: 0, tries: 0, wrong: null, msg: '' }) }

  const m = sel ? anatomyById(sel) : undefined
  const sets = m ? anatomySets(byMuscle, m) : 0
  const last = useMemo(() => {
    if (!m || !logs) return null
    const fin = (logs as WorkoutLog[]).filter((l) => l.finishedAt && !l.skipped).sort((a, b) => b.date.localeCompare(a.date))
    for (const l of fin) if (l.exercises.some((e) => EXERCISES.find((x) => x.id === e.exerciseId)?.primary.some((p) => m.train.includes(p)) && e.sets.some((s) => s.done && !s.warmup))) return l.date
    return null
  }, [m, logs])
  const exs = m ? EXERCISES.filter((e) => e.primary.some((p) => m.train.includes(p))).slice(0, 8) : []
  const hits = searchAnatomy(q).slice(0, 8)

  return (
    <div className="pb-10">
      <PageHeader title="Body anatomy" back subtitle="Real muscles — a 2D chart and a real 3D model. Tap any muscle to learn it." />

      <div className="mx-4 mb-2 flex gap-1.5">
        {(['2d', '3d'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setDim(k)} className={`pressable flex-1 rounded-full py-2 text-[12.5px] font-semibold ${dim === k ? 'bg-white text-black' : 'bg-surface2 text-ink2'}`}>{k === '2d' ? 'Chart (2D)' : 'Real 3D model'}</button>
        ))}
      </div>
      <div className="mx-4 mb-2 flex gap-1.5">
        {(['anatomy', 'heat'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`pressable flex-1 rounded-full py-2 text-[12.5px] font-semibold ${mode === k ? 'bg-brand text-black' : 'bg-surface2 text-ink2'}`}>{k === 'anatomy' ? 'Anatomy' : 'My training this week'}</button>
        ))}
      </div>

      <div className="relative mx-4 h-[62vh] min-h-[420px] overflow-hidden rounded-3xl border border-line bg-[radial-gradient(ellipse_at_50%_35%,#2a2f3a_0%,#12151b_70%)]" style={{ perspective: 1200 }}>
        {dim === '3d' && <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-[13px] text-ink3">Loading 3D…</div>}><Body3D mode={mode} sel={sel} byMuscle={byMuscle} onPick={pick} layers={layers} /></Suspense>}
        {dim === '3d' && (
          <div className="absolute left-2 top-2 flex flex-col gap-1.5">
            {([['skin', 'Skin'], ['muscles', 'Muscles'], ['bones', 'Skeleton']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setLayers((L) => ({ ...L, [k]: !L[k] }))} className={`pressable rounded-full px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur ${layers[k] ? 'bg-brand text-black' : 'bg-black/55 text-white'}`}>{layers[k] ? '✓ ' : ''}{l}</button>
            ))}
          </div>
        )}
        {dim === '2d' && <>
        <div className="absolute inset-0 touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => !quiz && !gest.current.moved && setSel(null)}>
          <div className="absolute inset-0 transition-transform duration-[650ms] ease-out" style={{ transformStyle: 'preserve-3d', transform: `rotateY(${view === 'back' ? 180 : 0}deg)` }}>
            {(['front', 'back'] as View[]).map((v) => (
              <div key={v} className="absolute inset-0 py-3" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: v === 'back' ? 'rotateY(180deg)' : undefined }}>
                <div className="h-full w-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: pts.current.size ? 'none' : 'transform .2s' }}>
                  <Figure view={v} mode={mode} sel={sel} byMuscle={byMuscle} onPick={pick} quizWrong={quiz?.wrong ?? null} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{view === 'front' ? 'Front' : 'Back'}</div>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.35)} className="pressable h-9 w-9 rounded-full bg-black/55 text-[18px] text-white backdrop-blur">+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.35)} className="pressable h-9 w-9 rounded-full bg-black/55 text-[18px] text-white backdrop-blur">−</button>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
          <button type="button" onClick={() => setView('front')} className={`pressable flex-1 rounded-full py-2 text-[12.5px] font-semibold backdrop-blur ${view === 'front' ? 'bg-white text-black' : 'bg-black/55 text-white'}`}>Front</button>
          <button type="button" onClick={() => setView(view === 'front' ? 'back' : 'front')} className="pressable rounded-full bg-black/55 px-4 py-2 text-[12.5px] font-semibold text-white backdrop-blur" aria-label="Turn around">⟲ Turn</button>
          <button type="button" onClick={() => setView('back')} className={`pressable flex-1 rounded-full py-2 text-[12.5px] font-semibold backdrop-blur ${view === 'back' ? 'bg-white text-black' : 'bg-black/55 text-white'}`}>Back</button>
        </div>
        </>}
      </div>

      {mode === 'heat' && (
        <div className="mx-4 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink3">
          {[['#3b4a5e', 'not trained this week'], ['#b7791f', '1–5 sets'], ['#eab308', '6–9'], ['#22c55e', '10–20 (sweet spot)'], ['#ef4444', '20+']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
        </div>
      )}

      <Section>
        {quiz ? (
          <Card className="space-y-2 p-4 text-[13px]">
            <div className="flex items-center gap-2"><b className="flex-1 text-[15px]">Quiz — find the muscle</b><Badge tone="amber">{quiz.score} / {quiz.tries}</Badge></div>
            <div className="text-[18px] font-bold text-brand">{quiz.target.name}</div>
            <div className="text-ink3">Hint: {quiz.target.region.toLowerCase()}, {quiz.target.view} view</div>
            {quiz.msg && <div className={quiz.msg.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}>{quiz.msg}</div>}
            <div className="flex gap-2 pt-1">
              <Button small variant="secondary" onClick={() => { setSel(quiz.target.id); setView(quiz.target.view); setQuiz({ ...quiz, tries: quiz.tries + 1, msg: `It's here — the ${quiz.target.name}.` }); setTimeout(() => { const n = quizPick(quiz.target.id); setQuiz((qq) => qq && { ...qq, target: n, wrong: null, msg: '' }); setView(n.view); setSel(null) }, 1800) }}>Show me</Button>
              <Button small variant="secondary" onClick={() => { setQuiz(null); setSel(null) }}>Stop quiz</Button>
            </div>
          </Card>
        ) : m ? (
          <Card className="space-y-2 p-4 text-[13px]">
            <div className="flex items-start gap-2"><div className="flex-1"><b className="text-[16px]">{m.name}</b><div className="text-[11.5px] italic text-ink3">{m.latin}</div></div><Badge tone={sets >= 10 && sets <= 20 ? 'green' : sets ? 'amber' : 'gray'}>{sets} hard sets this week</Badge></div>
            <div className="text-ink2">{m.action}</div>
            <div className="grid grid-cols-[78px_1fr] gap-x-2 gap-y-1 text-[12.5px]">
              <span className="text-ink3">Origin</span><span>{m.origin}</span>
              <span className="text-ink3">Insertion</span><span>{m.insertion}</span>
              <span className="text-ink3">Nerve</span><span>{m.nerve}</span>
              <span className="text-ink3">Trains as</span><span>{m.train.map((t) => MUSCLE_LABELS[t]).join(', ')}</span>
            </div>
            <div className="text-ink3">Last trained: {last ? `${dayjs(last).format('ddd D MMM')} (${dayjs().diff(dayjs(last), 'day')} days ago)` : 'not in your log yet'}</div>
            {(() => {
              // IV-11: training + tape + photos for the same muscle in one place
              const key = TAPE_FOR[m.train[0]]
              const rows = key ? (meas ?? []).filter((x) => x.values[key] !== undefined).map((x) => ({ d: x.date, v: Number(x.values[key]) })) : []
              if (!key) return null
              if (!rows.length) return <div className="rounded-xl bg-surface2 px-3 py-2 text-[12.5px] text-ink3">No {key} measurements yet — <button type="button" className="text-brand underline" onClick={() => navigate('/progress')}>add one</button> to see growth here.</div>
              const first = rows[0], last = rows[rows.length - 1], ch = last.v - first.v
              const mx = Math.max(...rows.map((r) => r.v)), mn = Math.min(...rows.map((r) => r.v)), span = Math.max(0.5, mx - mn)
              return (
                <div className="rounded-xl bg-surface2 px-3 py-2 text-[12.5px]">
                  <div className="flex items-baseline justify-between"><span><b>Tape · {key}</b> {last.v} cm</span><span className={ch > 0 ? 'text-emerald-400' : ch < 0 ? 'text-amber-400' : 'text-ink3'}>{ch > 0 ? '+' : ''}{ch.toFixed(1)} cm since {dayjs(first.d).format('D MMM')}</span></div>
                  {rows.length > 1 && <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-1 h-6 w-full"><polyline fill="none" stroke="#fbbf24" strokeWidth="1.6" points={rows.map((r, i) => `${(i / (rows.length - 1)) * 100},${22 - ((r.v - mn) / span) * 20}`).join(' ')} /></svg>}
                  <div className="mt-1 flex gap-3"><button type="button" className="text-brand underline" onClick={() => navigate('/progress')}>Measurements</button><button type="button" className="text-brand underline" onClick={() => navigate('/photos')}>Compare photos</button></div>
                </div>
              )
            })()}
            {exs.length > 0 && <div><div className="mb-1 text-[12px] font-semibold text-ink2">Exercises for it</div><div className="flex flex-wrap gap-1.5">{exs.map((e) => <button key={e.id} type="button" onClick={() => navigate(`/exercise/${e.id}`)} className="pressable rounded-full bg-surface3 px-2.5 py-1 text-[12px]">{e.name}</button>)}</div></div>}
          </Card>
        ) : (
          <Card className="p-4 text-[13px] text-ink3">Tap any muscle. Pinch or use + / − to zoom, double-tap to zoom in, and Turn to see the back. “My training” colours each muscle by this week’s hard sets.</Card>
        )}
      </Section>

      <Section title="Find a muscle">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. glutes, soleus, rotator cuff, pectoralis" className="w-full rounded-2xl border border-line bg-surface2 px-4 py-3 text-[14px] outline-none focus:border-brand" />
        {hits.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{hits.map((h) => <button key={h.id} type="button" onClick={() => goTo(h)} className="pressable rounded-full bg-surface3 px-3 py-1.5 text-[12.5px]">{h.name} <span className="text-ink3">· {h.view}</span></button>)}</div>}
        {!quiz && <div className="mt-3"><Button variant="secondary" onClick={startQuiz}>🎯 Quiz me — learn the muscles</Button></div>}
      </Section>

      <Section title="Every muscle on the map">
        {(['Neck', 'Shoulder', 'Chest', 'Arm', 'Forearm', 'Core', 'Back', 'Hip', 'Thigh', 'Leg'] as const).map((r) => {
          const list = ANATOMY.filter((x) => x.region === r)
          return list.length ? (
            <div key={r} className="mb-2"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink3">{r}</div>
              <div className="flex flex-wrap gap-1.5">{list.map((x) => <button key={x.id} type="button" onClick={() => goTo(x)} className={`pressable rounded-full px-2.5 py-1 text-[12px] ${sel === x.id ? 'bg-brand text-black' : 'bg-surface2'}`}>{x.name}</button>)}</div></div>
          ) : null
        })}
      </Section>

      <div className="mx-4 space-y-1 text-[11px] text-ink3">
        <div>Drawn from real anatomy: muscle shapes follow standard anatomical plates; origins, insertions, actions and nerves follow Gray’s Anatomy (1918, public domain) and OpenStax Anatomy &amp; Physiology 2e (CC BY 4.0). Deep muscles (rhomboids, rotator-cuff supraspinatus, psoas) sit under the ones shown and are described in their neighbours.</div>
        <div>3D model: BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan — real segmented muscles, skeleton and skin, simplified for phones. Rectus abdominis and latissimus dorsi are not in BodyParts3D, so in 3D they are shaped over the model’s own skin.</div>
        <div>Colours in “My training” show this week’s sets, not muscle size. <button type="button" onClick={() => navigate('/anatomy/3d')} className="underline">Old rotating model</button></div>
      </div>
    </div>
  )
}
