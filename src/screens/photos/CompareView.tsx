// Side-by-side comparison with a draggable wipe between two photos.
// Defaults to the earliest and latest shot of the same pose.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, GripVertical } from 'lucide-react'
import type { PhotoPose, ProgressPhoto } from '@/db/types'
import { Card, EmptyState, Field, Section, Select } from '@/components/ui'
import { dayjs } from '@/lib/fmt'
import { POSES, photoAt, poseLabel, useBlobUrl } from './helpers'

function optionLabel(p: ProgressPhoto): string {
  return `${dayjs(p.date).format('D MMM YYYY')}${p.weightKg ? ` · ${p.weightKg.toFixed(1)} kg` : ''}`
}

function Caption({ side, photo }: { side: 'left' | 'right'; photo: ProgressPhoto }) {
  return (
    <div
      className={`absolute bottom-2 ${side === 'left' ? 'left-2' : 'right-2'} rounded-lg bg-black/60 px-2 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm`}
    >
      {dayjs(photo.date).format('D MMM YY')}
      {photo.weightKg ? ` · ${photo.weightKg.toFixed(1)} kg` : ''}
    </div>
  )
}

/** where each body region sits in a standard full-length progress photo (portrait 3:4) */
const REGIONS = {
  full: { label: 'Whole body', s: 1, x: 50, y: 50 },
  shoulders: { label: 'Shoulders & arms', s: 2.1, x: 50, y: 26 },
  chest: { label: 'Chest', s: 2.2, x: 50, y: 30 },
  abs: { label: 'Abs & waist', s: 2.3, x: 50, y: 45 },
  legs: { label: 'Legs', s: 1.7, x: 50, y: 72 },
  calves: { label: 'Calves', s: 2.4, x: 50, y: 88 },
} as const
type RegionKey = keyof typeof REGIONS

export default function CompareView({ photos, initial }: {
  photos: ProgressPhoto[]
  initial: { a: ProgressPhoto; b: ProgressPhoto } | null
}) {
  const [pose, setPose] = useState<PhotoPose>(initial?.a.pose ?? 'front')
  const [aId, setAId] = useState(initial?.a.id ?? '')
  const [bId, setBId] = useState(initial?.b.id ?? '')
  const [pct, setPct] = useState(50)
  const [view, setView] = useState<'wipe' | 'side' | 'ghost'>('wipe')
  const [ghost, setGhost] = useState(50)
  // IV-26: zoom both photos to the same body region (works in every view)
  const [region, setRegion] = useState<RegionKey>('full')
  const zoomStyle: React.CSSProperties = region === 'full' ? {} : { transform: `scale(${REGIONS[region].s})`, transformOrigin: `${REGIONS[region].x}% ${REGIONS[region].y}%` }
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const list = useMemo(
    () => photos.filter((p) => p.pose === pose).sort((x, y) => x.date.localeCompare(y.date)),
    [photos, pose],
  )

  // keep the two selections valid whenever the pose (or the library) changes
  useEffect(() => {
    if (list.length === 0) return
    const has = (id: string) => list.some((p) => p.id === id)
    if (!has(aId)) setAId(list[0].id)
    if (!has(bId)) setBId(list[list.length - 1].id)
  }, [list, aId, bId])

  const a = list.find((p) => p.id === aId) ?? list[0] ?? null
  const b = list.find((p) => p.id === bId) ?? list[list.length - 1] ?? null
  const aUrl = useBlobUrl(a?.blob ?? null)
  const bUrl = useBlobUrl(b?.blob ?? null)

  function move(clientX: number) {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return
    setPct(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }

  const posesWithTwo = POSES.filter((p) => photos.filter((x) => x.pose === p.value).length >= 2)

  if (photos.length < 2) {
    return (
      <Section title="Compare">
        <Card>
          <EmptyState
            icon={<ArrowLeftRight size={32} strokeWidth={1.5} />}
            title="Two photos and the slider appears"
            subtitle="Take the same pose again in a few weeks — that's when this gets useful."
          />
        </Card>
      </Section>
    )
  }

  return (
    <Section title="Compare">
      {posesWithTwo.length > 0 && (
        <div className="mb-3">
          <Field label="Pose">
            <Select value={pose} onChange={(e) => setPose(e.target.value as PhotoPose)}>
              {POSES.map((p) => {
                const n = photos.filter((x) => x.pose === p.value).length
                return (
                  <option key={p.value} value={p.value} disabled={n < 2}>
                    {p.label}{n < 2 ? ` (need 2, have ${n})` : ` · ${n} photos`}
                  </option>
                )
              })}
            </Select>
          </Field>
        </div>
      )}

      {list.length < 2 || !a || !b ? (
        <Card>
          <EmptyState
            icon={<ArrowLeftRight size={32} strokeWidth={1.5} />}
            title={`Only ${list.length} ${poseLabel(pose).toLowerCase()} photo so far`}
            subtitle="Pick a pose with at least two shots, or take another one in this pose."
          />
        </Card>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {([['First vs latest', -1], ['4 weeks ago', 28], ['12 weeks ago', 84]] as const).map(([l, d]) => (
              <button key={l} type="button" onClick={() => { const today = list[list.length - 1].date; const x = d < 0 ? list[0] : photoAt(list, pose, d, today); if (x) { setAId(x.id); setBId(list[list.length - 1].id) } }}
                className="pressable rounded-full bg-surface3 px-3 py-1.5 text-[12px] font-semibold text-ink2">{l} → now</button>
            ))}
          </div>
          <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {(Object.keys(REGIONS) as RegionKey[]).map((k) => (
              <button key={k} type="button" onClick={() => setRegion(k)} className={`pressable shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${region === k ? 'bg-brand text-black' : 'bg-surface3 text-ink2'}`}>{REGIONS[k].label}</button>
            ))}
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-surface3 p-1 text-[12.5px] font-semibold">
            {([['wipe', 'Wipe'], ['side', 'Side by side'], ['ghost', 'Ghost overlay']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`rounded-lg py-1.5 ${view === v ? 'bg-surface2 text-ink' : 'text-ink3'}`}>{l}</button>
            ))}
          </div>
          {view === 'side' && (
            <Card className="grid grid-cols-2 gap-0.5 overflow-hidden bg-black">
              {[{ p: a, u: aUrl, s: 'left' as const }, { p: b, u: bUrl, s: 'right' as const }].map((x) => (
                <div key={x.s} className="relative aspect-[3/4] overflow-hidden">{x.u && <img src={x.u} alt={`${poseLabel(pose)} on ${x.p.date}`} className="absolute inset-0 h-full w-full object-contain" style={zoomStyle} />}<Caption side={x.s} photo={x.p} /></div>
              ))}
            </Card>
          )}
          {view === 'ghost' && (
            <Card className="overflow-hidden">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-black">
                {aUrl && <img src={aUrl} alt="" className="absolute inset-0 h-full w-full object-contain" style={zoomStyle} />}
                {bUrl && <img src={bUrl} alt="" className="absolute inset-0 h-full w-full object-contain" style={{ ...zoomStyle, opacity: ghost / 100 }} />}
                <Caption side="left" photo={a} /><Caption side="right" photo={b} />
              </div>
              <div className="px-3 py-2"><input type="range" min={0} max={100} value={ghost} onChange={(e) => setGhost(Number(e.target.value))} className="w-full" aria-label="Blend between the two photos" />
                <div className="flex justify-between text-[11px] text-ink3"><span>{dayjs(a.date).format('D MMM')}</span><span>{dayjs(b.date).format('D MMM')}</span></div></div>
            </Card>
          )}
          {view === 'wipe' && <Card className="overflow-hidden">
            <div
              ref={boxRef}
              className="relative aspect-[3/4] w-full touch-none select-none overflow-hidden bg-black"
              onPointerDown={(e) => {
                dragging.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                move(e.clientX)
              }}
              onPointerMove={(e) => { if (dragging.current) move(e.clientX) }}
              onPointerUp={(e) => {
                dragging.current = false
                e.currentTarget.releasePointerCapture(e.pointerId)
              }}
              onPointerCancel={() => { dragging.current = false }}
            >
              {aUrl && (
                <img src={aUrl} alt={`${poseLabel(pose)} on ${a.date}`} className="absolute inset-0 h-full w-full object-contain" style={zoomStyle} />
              )}
              {bUrl && (
                <img
                  src={bUrl}
                  alt={`${poseLabel(pose)} on ${b.date}`}
                  className="absolute inset-0 h-full w-full object-contain"
                  style={{ ...zoomStyle, clipPath: `inset(0 0 0 ${Math.max(0, Math.min(100, REGIONS[region].x + (pct - REGIONS[region].x) / REGIONS[region].s))}%)` }}
                />
              )}
              <div className="absolute inset-y-0 w-[2px] bg-white/85" style={{ left: `${pct}%` }} />
              <div
                className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-lg"
                style={{ left: `${pct}%` }}
              >
                <GripVertical size={20} />
              </div>
              <Caption side="left" photo={a} />
              <Caption side="right" photo={b} />
            </div>
          </Card>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Left / earlier">
              <Select value={a.id} onChange={(e) => setAId(e.target.value)}>
                {list.map((p) => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
              </Select>
            </Field>
            <Field label="Right / later">
              <Select value={b.id} onChange={(e) => setBId(e.target.value)}>
                {list.map((p) => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
              </Select>
            </Field>
          </div>

          <p className="mt-2 text-[11.5px] text-ink3">
            Drag the handle to wipe between them.
            {a.weightKg && b.weightKg
              ? ` ${(b.weightKg - a.weightKg) >= 0 ? '+' : '−'}${Math.abs(b.weightKg - a.weightKg).toFixed(1)} kg across ${dayjs(b.date).diff(dayjs(a.date), 'day')} days.`
              : ' Log weight with a photo and the change shows up here.'}
          </p>
        </>
      )}
    </Section>
  )
}
