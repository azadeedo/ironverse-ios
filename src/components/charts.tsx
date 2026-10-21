// Tiny dependency-free SVG charts (dark-theme aware via CSS vars).
import { useMemo } from 'react'

const ACCENT = '#fbbf24'

export function LineChart({ points, height = 160, unit = '', accent = ACCENT, secondary, marks, onMark, activeMark }: {
  points: { x: string; y: number }[]
  /** optional annotated points (index into points) drawn as tappable flags */
  marks?: { i: number; label: string }[]
  onMark?: (i: number) => void
  activeMark?: number | null
  /** optional smoothed second series (e.g. weight trend) */
  secondary?: number[]
  height?: number
  unit?: string
  accent?: string
}) {
  const W = 340
  const H = height
  const pad = { l: 34, r: 10, t: 14, b: 22 }
  const data = points.slice(-60)
  const off = points.length - data.length
  const { path, path2, min, max, lastY, px, py } = useMemo(() => {
    if (data.length === 0) return { path: '', path2: '', min: 0, max: 0, lastY: 0, px: (_: number) => 0, py: (_: number) => 0 }
    const ys = data.map((p) => p.y).concat(secondary ?? [])
    let mn = Math.min(...ys)
    let mx = Math.max(...ys)
    if (mx - mn < 1) { mn -= 1; mx += 1 }
    const span = mx - mn
    mn -= span * 0.1; mx += span * 0.1
    const px = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
    const py = (v: number) => pad.t + (1 - (v - mn) / (mx - mn)) * (H - pad.t - pad.b)
    const mk = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
    return {
      path: mk(data.map((p) => p.y)),
      path2: secondary && secondary.length === data.length ? mk(secondary) : '',
      min: mn, max: mx,
      lastY: py(data[data.length - 1].y),
      px, py,
    }
  }, [data, secondary, H])

  if (data.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-[13px] text-ink3">No data yet</div>
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={pad.l} x2={W - pad.r} y1={pad.t + t * (H - pad.t - pad.b)} y2={pad.t + t * (H - pad.t - pad.b)}
          stroke="var(--line)" strokeDasharray="3 5" strokeWidth="1" />
      ))}
      <text x={4} y={pad.t + 5} fontSize="10" fill="var(--ink3)">{Math.round(max)}{unit}</text>
      <text x={4} y={H - pad.b} fontSize="10" fill="var(--ink3)">{Math.round(min)}{unit}</text>
      <text x={pad.l} y={H - 6} fontSize="10" fill="var(--ink3)">{data[0].x}</text>
      <text x={W - pad.r} y={H - 6} fontSize="10" fill="var(--ink3)" textAnchor="end">{data[data.length - 1].x}</text>
      {path2 && <path d={path2} fill="none" stroke="var(--ink3)" strokeWidth="1.6" strokeDasharray="4 4" />}
      <path d={path} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W - pad.r} cy={lastY} r="4" fill={accent} />
      {(marks ?? []).filter((m) => m.i - off >= 0 && m.i - off < data.length).map((m) => {
        const j = m.i - off, x = px(j), y = py(data[j].y), on = activeMark === m.i
        return (
          <g key={m.i} onClick={() => onMark?.(m.i)} style={{ cursor: onMark ? 'pointer' : undefined }}>
            <title>{m.label}</title>
            <line x1={x} x2={x} y1={y - 4} y2={y - 16} stroke={on ? '#fff' : '#60a5fa'} strokeWidth="1.4" />
            <circle cx={x} cy={y - 18} r={on ? 5.5 : 4.5} fill={on ? '#fff' : '#60a5fa'} stroke="var(--surface, #111)" strokeWidth="1.5" />
            <circle cx={x} cy={y} r="12" fill="transparent" />
          </g>
        )
      })}
    </svg>
  )
}

export function BarChart({ bars, height = 150, unit = '', accent = ACCENT }: {
  bars: { label: string; value: number; hint?: string }[]
  height?: number
  unit?: string
  accent?: string
}) {
  const W = 340
  const H = height
  const pad = { l: 6, r: 6, t: 18, b: 20 }
  const data = bars.slice(-14)
  const max = Math.max(1, ...data.map((b) => b.value))
  const bw = (W - pad.l - pad.r) / data.length
  if (data.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-[13px] text-ink3">No data yet</div>
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {data.map((b, i) => {
        const h = (b.value / max) * (H - pad.t - pad.b)
        const x = pad.l + i * bw + bw * 0.18
        return (
          <g key={i}>
            <rect x={x} y={H - pad.b - h} width={bw * 0.64} height={Math.max(2, h)} rx={4}
              fill={accent} opacity={0.25 + 0.75 * (b.value / max)} />
            {b.value > 0 && bw > 30 && (
              <text x={x + bw * 0.32} y={H - pad.b - h - 5} fontSize="9.5" fill="var(--ink2)" textAnchor="middle">
                {Math.round(b.value)}{unit}
              </text>
            )}
            <text x={x + bw * 0.32} y={H - 6} fontSize="9" fill="var(--ink3)" textAnchor="middle">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function ProgressRing({ value, target, size = 130, stroke = 11, label, sub, accent = ACCENT }: {
  value: number
  target: number
  size?: number
  stroke?: number
  label?: string
  sub?: string
  accent?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, target > 0 ? value / target : 0)
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.2,0.6,0.2,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="big-num text-[22px] leading-none text-ink">{label}</div>
        {sub && <div className="mt-1 text-[11px] text-ink3">{sub}</div>}
      </div>
    </div>
  )
}
