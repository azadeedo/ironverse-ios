// Rolling-average line with the raw daily dots sitting behind it.
// Same visual language as @/components/charts, just with the dots the weight
// trend needs — the average is the story, the dots are the noise.
import { useMemo } from 'react'
import { dayjs } from '@/lib/fmt'

const ACCENT = '#fbbf24'

export default function TrendChart({ rows, height = 180, unit = '', accent = ACCENT }: {
  rows: { date: string; raw: number; avg: number }[]
  height?: number
  unit?: string
  accent?: string
}) {
  const W = 340
  const H = height
  const pad = { l: 34, r: 10, t: 14, b: 22 }
  const data = rows.slice(-90)

  const geo = useMemo(() => {
    if (data.length === 0) return null
    const ys = data.flatMap((r) => [r.raw, r.avg])
    let mn = Math.min(...ys)
    let mx = Math.max(...ys)
    if (mx - mn < 1) { mn -= 1; mx += 1 }
    const span = mx - mn
    mn -= span * 0.12
    mx += span * 0.12
    const px = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
    const py = (v: number) => pad.t + (1 - (v - mn) / (mx - mn)) * (H - pad.t - pad.b)
    return {
      min: mn,
      max: mx,
      dots: data.map((r, i) => ({ cx: px(i), cy: py(r.raw) })),
      path: data.map((r, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(r.avg).toFixed(1)}`).join(' '),
      lastX: px(data.length - 1),
      lastY: py(data[data.length - 1].avg),
    }
  }, [data, H])

  if (!geo) {
    return <div className="flex h-[120px] items-center justify-center text-[13px] text-ink3">No weigh-ins yet</div>
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={pad.l} x2={W - pad.r}
          y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)}
          stroke="var(--line)" strokeDasharray="3 5" strokeWidth="1"
        />
      ))}
      <text x={4} y={pad.t + 5} fontSize="10" fill="var(--ink3)">{geo.max.toFixed(1)}{unit}</text>
      <text x={4} y={H - pad.b} fontSize="10" fill="var(--ink3)">{geo.min.toFixed(1)}{unit}</text>
      <text x={pad.l} y={H - 6} fontSize="10" fill="var(--ink3)">{dayjs(data[0].date).format('D MMM')}</text>
      <text x={W - pad.r} y={H - 6} fontSize="10" fill="var(--ink3)" textAnchor="end">
        {dayjs(data[data.length - 1].date).format('D MMM')}
      </text>
      {geo.dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="2.4" fill="var(--ink3)" opacity="0.55" />
      ))}
      <path d={geo.path} fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={geo.lastX} cy={geo.lastY} r="4.2" fill={accent} />
    </svg>
  )
}
