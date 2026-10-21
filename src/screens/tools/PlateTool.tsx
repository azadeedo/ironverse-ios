// Plate calculator — what goes on the bar, drawn to scale, using the bars and
// plates the CURRENT equipment profile actually has.

import { useMemo, useState } from 'react'
import { Weight } from 'lucide-react'
import { Badge, Segmented } from '@/components/ui'
import type { EquipmentProfile } from '@/db/types'
import { fmtKg } from '@/lib/fmt'
import { BAR_MODES, buildableRange, planPlates } from '@/lib/onerm'
import { sideBreakdown } from '@/lib/plates'
import { Input } from '@/components/ui'
import type { AnyLoadMode } from '@/lib/plates'
import { Stepper, ToolCard } from './shared'

type Mode = 'barbell' | 'curl-bar' | 'smith' | 'stack' | 'dumbbell'

const MODE_LABELS: Record<Mode, string> = {
  barbell: 'Barbell', 'curl-bar': 'Curl bar', smith: 'Smith', stack: 'Cable', dumbbell: 'Dumbbell',
}

// Plate rendering: bigger plate = taller and thicker. No images, no emoji —
// this is drawn from the numbers so it always matches the real kit.
function plateHeight(kg: number, maxKg: number): number {
  const t = Math.min(1, Math.max(0.28, kg / Math.max(1, maxKg)))
  return 26 + t * 62
}
function plateWidth(kg: number, maxKg: number): number {
  const t = Math.min(1, Math.max(0.25, kg / Math.max(1, maxKg)))
  return 7 + t * 8
}
function plateFill(kg: number, maxKg: number): string {
  const t = Math.min(1, kg / Math.max(1, maxKg))
  // amber ramp, darkest for the heaviest plate
  const light = 76 - t * 26
  return `hsl(${42 - t * 8} 92% ${light}%)`
}

export function BarGraphic({ perSide, barKg, maxPlate }: {
  perSide: number[]
  barKg: number
  maxPlate: number
}) {
  const W = 340
  const H = 116
  const midY = H / 2
  const centre = W / 2
  const gap = 2
  const sleeveStart = 42

  // plates are laid heaviest-inward, mirrored on both sides
  let offset = sleeveStart
  const shapes: { x: number; w: number; h: number; kg: number }[] = []
  for (const kg of perSide) {
    const w = plateWidth(kg, maxPlate)
    shapes.push({ x: offset, w, h: plateHeight(kg, maxPlate), kg })
    offset += w + gap
  }
  const sleeveEnd = Math.max(offset + 10, sleeveStart + 26)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Bar loaded with ${perSide.join(', ')} kg per side`}>
      {/* bar shaft */}
      <rect
        x={centre - sleeveEnd} y={midY - 4} width={sleeveEnd * 2} height={8} rx={4}
        fill="var(--surface3)"
      />
      <rect x={centre - 40} y={midY - 5} width={80} height={10} rx={5} fill="var(--line)" />
      {/* collars */}
      {[1, -1].map((dir) => (
        <rect
          key={dir}
          x={dir === 1 ? centre + sleeveStart - 8 : centre - sleeveStart}
          y={midY - 7} width={8} height={14} rx={2} fill="var(--ink3)" opacity={0.5}
        />
      ))}
      {/* plates, both sides */}
      {[1, -1].map((dir) =>
        shapes.map((s, i) => {
          const x = dir === 1 ? centre + s.x : centre - s.x - s.w
          return (
            <g key={`${dir}-${i}`}>
              <rect
                x={x} y={midY - s.h / 2} width={s.w} height={s.h} rx={2.5}
                fill={plateFill(s.kg, maxPlate)}
              />
              {dir === 1 && (
                <text
                  x={x + s.w / 2} y={midY + s.h / 2 + 12}
                  fontSize="9.5" fill="var(--ink3)" textAnchor="middle"
                >
                  {s.kg}
                </text>
              )}
            </g>
          )
        }),
      )}
      {perSide.length === 0 && (
        <text x={centre} y={midY + 32} fontSize="11" fill="var(--ink3)" textAnchor="middle">
          empty bar · {barKg} kg
        </text>
      )}
    </svg>
  )
}

export function PlateTool({ profile }: { profile: EquipmentProfile }) {
  const [mode, setMode] = useState<Mode>('barbell')
  const [target, setTarget] = useState(60)

  const available = useMemo(() => {
    const out: Mode[] = []
    if (profile.equipment.includes('barbell')) out.push('barbell')
    if (profile.equipment.includes('curl-bar')) out.push('curl-bar')
    if (profile.equipment.includes('smith')) out.push('smith')
    if (profile.stackStepsKg.length > 0) out.push('stack')
    if ((profile.dumbbellsKg ?? []).length > 0) out.push('dumbbell')
    return out.length > 0 ? out : (['barbell'] as Mode[])
  }, [profile])

  const activeMode: Mode = available.includes(mode) ? mode : available[0]
  const build = planPlates(activeMode as AnyLoadMode, target, profile)
  const range = buildableRange(activeMode as AnyLoadMode, profile)
  const maxPlate = Math.max(...profile.platePairsKg, 1)
  const isBar = BAR_MODES.includes(activeMode as AnyLoadMode)

  return (
    <ToolCard
      icon={<Weight size={17} />}
      title="Plate calculator"
      note={`Type the weight you want and it tells you exactly what to hang on each side — using the bars and plates at ${profile.name}, so the number is never impossible when you get to the rack.`}
    >
      <div className="space-y-4">
        <Segmented
          options={available.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
          value={activeMode}
          onChange={(m) => setMode(m)}
        />

        <Stepper value={target} onChange={setTarget} step={2.5} min={0} max={400} label="target weight" />

        {!build ? (
          <p className="text-[13px] text-ink2">Nothing to load for this mode.</p>
        ) : (
          <>
            {isBar ? (
              <div className="rounded-xl bg-surface3/40 p-2">
                <BarGraphic perSide={build.perSide} barKg={build.barKg} maxPlate={maxPlate} />
              </div>
            ) : (
              <div className="rounded-xl bg-surface3/40 p-4 text-center text-[13px] text-ink2">
                {build.note}
              </div>
            )}

            <div className="rounded-xl bg-surface3/60 p-4 text-center">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Loaded total</div>
              <div className="big-num mt-1 text-[30px] leading-none text-brand">{fmtKg(build.totalKg)}</div>
              <div className="mt-1.5 text-[12.5px] text-ink2">{build.label}</div>
              {build.approximate && (
                <div className="mt-2 flex justify-center">
                  <Badge tone="amber">
                    {build.deltaKg > 0 ? '+' : ''}{build.deltaKg} kg vs your target — nearest you can build
                  </Badge>
                </div>
              )}
            </div>

            {isBar && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink2">Bar</span>
                  <span className="big-num text-[14px] text-ink">{fmtKg(build.barKg)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink2">Per side</span>
                  <span className="text-right text-[14px] font-semibold text-ink">
                    {build.perSide.length ? build.perSide.map((p) => `${p}`).join(' + ') + ' kg' : 'nothing'}
                  </span>
                </div>
              </div>
            )}

            {range && (
              <p className="text-[11.5px] leading-snug text-ink3">
                At {profile.name} this mode builds {fmtKg(range.min)} to {fmtKg(range.max)} across{' '}
                {range.steps} usable loads.
              </p>
            )}
          </>
        )}
      </div>
    </ToolCard>
  )
}

// ---------- IV-03 / IV-15: any bar, any plates, kg or lb, collars ----------
const DEFAULT_PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5], lb: [45, 35, 25, 10, 5, 2.5] }
const DEFAULT_BAR = { kg: 20, lb: 45 }

/** per-side breakdown with the SAME exact engine the app uses everywhere (lib/plates) */
export function customLoad(total: number, bar: number, collarsPerSide: number, plates: number[], pairsEach = 4) {
  const side = (total - bar) / 2 - collarsPerSide
  if (side < 0) return { perSide: [] as number[], loaded: bar + collarsPerSide * 2, exact: Math.abs(side) < 0.001 }
  const pool = plates.flatMap((p) => Array.from({ length: pairsEach }, () => p))
  let perSide = sideBreakdown(side, pool)
  let loaded = bar + 2 * (collarsPerSide + perSide.reduce((a, b) => a + b, 0))
  // not exact → nearest buildable below
  if (Math.abs(loaded - total) > 0.001) {
    for (let t = Math.floor(side * 4) / 4; t >= 0; t -= 0.25) {
      const pb = sideBreakdown(t, pool); const sum = pb.reduce((a, b) => a + b, 0)
      if (Math.abs(sum - t) < 0.001) { perSide = pb; loaded = bar + 2 * (collarsPerSide + sum); break }
    }
  }
  return { perSide, loaded: Math.round(loaded * 100) / 100, exact: Math.abs(loaded - total) < 0.001 }
}

export function CustomPlateCalc() {
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [dir, setDir] = useState<'target' | 'plates'>('target')
  const [target, setTarget] = useState(100)
  const [bar, setBar] = useState(String(DEFAULT_BAR.kg))
  const [collar, setCollar] = useState('0')
  const [plateList, setPlateList] = useState(DEFAULT_PLATES.kg.join(', '))
  const [loadedSide, setLoadedSide] = useState<number[]>([])
  const plates = plateList.split(/[ ,]+/).map(Number).filter((n) => n > 0).sort((a, b) => b - a)
  const barN = Number(bar) || 0, colN = Number(collar) || 0
  const conv = (v: number) => (unit === 'kg' ? `${Math.round(v * 2.20462 * 10) / 10} lb` : `${Math.round(v * 0.453592 * 100) / 100} kg`)
  const res = dir === 'target' ? customLoad(target, barN, colN, plates) : null
  const perSide = dir === 'target' ? res!.perSide : loadedSide
  const total = dir === 'target' ? res!.loaded : Math.round((barN + 2 * (colN + loadedSide.reduce((a, b) => a + b, 0))) * 100) / 100
  const switchUnit = (u: 'kg' | 'lb') => { setUnit(u); setBar(String(DEFAULT_BAR[u])); setPlateList(DEFAULT_PLATES[u].join(', ')); setLoadedSide([]); setTarget(u === 'kg' ? 100 : 225) }
  return (
    <ToolCard icon={<Weight size={17} />} title="Custom bar & plates" note="Any bar, any plate set, kg or lb, with collars — work out the plates for a weight, or the total for the plates you loaded.">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Segmented options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={unit} onChange={(u) => switchUnit(u as 'kg' | 'lb')} />
          <Segmented options={[{ value: 'target', label: 'Weight → plates' }, { value: 'plates', label: 'Plates → total' }]} value={dir} onChange={(v) => setDir(v as 'target' | 'plates')} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <label className="space-y-1"><span className="text-ink3">Bar ({unit})</span><Input inputMode="decimal" value={bar} onChange={(e) => setBar(e.target.value)} /></label>
          <label className="space-y-1"><span className="text-ink3">Collar each side ({unit})</span><Input inputMode="decimal" value={collar} onChange={(e) => setCollar(e.target.value)} /></label>
        </div>
        <label className="block space-y-1 text-[12px]"><span className="text-ink3">Plates available ({unit}, any order — fractions OK)</span><Input value={plateList} onChange={(e) => setPlateList(e.target.value)} /></label>
        {dir === 'target'
          ? <Stepper value={target} onChange={setTarget} step={unit === 'kg' ? 2.5 : 5} min={0} max={unit === 'kg' ? 500 : 1100} label={`target (${unit})`} />
          : <div className="space-y-1.5"><div className="text-[12px] text-ink3">Tap plates to add to EACH side:</div>
              <div className="flex flex-wrap gap-1.5">{plates.map((p) => <button key={p} type="button" onClick={() => setLoadedSide([...loadedSide, p].sort((a, b) => b - a))} className="pressable rounded-lg bg-surface3 px-3 py-2 text-[13px] font-semibold">+{p}</button>)}
                {loadedSide.length > 0 && <button type="button" onClick={() => setLoadedSide([])} className="pressable rounded-lg px-3 py-2 text-[13px] text-brand">Clear</button>}</div></div>}
        <div className="rounded-xl bg-surface3/40 p-2"><BarGraphic perSide={perSide} barKg={barN} maxPlate={Math.max(...plates, 1)} /></div>
        <div className="rounded-xl bg-surface3/60 p-3 text-center">
          <div className="big-num text-[28px] leading-none text-brand">{total} {unit}</div>
          <div className="mt-1 text-[12px] text-ink3">≈ {conv(total)} · per side: {perSide.length ? perSide.join(' + ') : 'nothing'}{colN ? ` + collar ${colN}` : ''}</div>
          {dir === 'target' && res && !res.exact && <div className="mt-1.5 flex justify-center"><Badge tone="amber">Exact {target} {unit} isn’t possible with these plates — nearest below</Badge></div>}
        </div>
      </div>
    </ToolCard>
  )
}
