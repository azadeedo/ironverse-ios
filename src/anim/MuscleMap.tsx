// Front/back body diagrams with per-muscle highlighting.
// Stylised (not anatomical) rounded shapes on a silhouette; primary muscles
// glow in accent, secondary in a dimmer tint.

import type { Muscle } from '@/db/types'

const ACCENT = '#fbbf24'

export type Region = { muscle: Muscle; d: string; side: 'front' | 'back' }

// Coordinate space: 0..100 wide, 0..190 tall per figure.
export const REGIONS: Region[] = [
  // ---------- front ----------
  { muscle: 'chest', side: 'front', d: 'M32 50 Q50 44 68 50 Q68 66 50 69 Q32 66 32 50 Z' },
  { muscle: 'front-delts', side: 'front', d: 'M24 46 Q30 40 36 44 Q34 54 27 56 Q23 51 24 46 Z M76 46 Q70 40 64 44 Q66 54 73 56 Q77 51 76 46 Z' },
  { muscle: 'side-delts', side: 'front', d: 'M20 50 Q17 44 24 46 Q23 52 22 57 Q19 54 20 50 Z M80 50 Q83 44 76 46 Q77 52 78 57 Q81 54 80 50 Z' },
  { muscle: 'biceps', side: 'front', d: 'M21 60 Q27 58 27 66 Q27 76 22 78 Q17 70 21 60 Z M79 60 Q73 58 73 66 Q73 76 78 78 Q83 70 79 60 Z' },
  { muscle: 'forearms', side: 'front', d: 'M18 82 Q24 80 23 88 Q22 98 17 102 Q14 92 18 82 Z M82 82 Q76 80 77 88 Q78 98 83 102 Q86 92 82 82 Z' },
  { muscle: 'abs', side: 'front', d: 'M42 72 L58 72 Q59 92 55 104 L45 104 Q41 92 42 72 Z' },
  { muscle: 'obliques', side: 'front', d: 'M34 74 Q40 74 40 82 L39 100 Q34 96 33 86 Z M66 74 Q60 74 60 82 L61 100 Q66 96 67 86 Z' },
  { muscle: 'hip-flexors', side: 'front', d: 'M40 106 Q46 108 45 114 L41 118 Q38 112 40 106 Z M60 106 Q54 108 55 114 L59 118 Q62 112 60 106 Z' },
  { muscle: 'quads', side: 'front', d: 'M34 112 Q44 110 45 122 Q45 138 41 148 Q34 146 33 132 Q32 120 34 112 Z M66 112 Q56 110 55 122 Q55 138 59 148 Q66 146 67 132 Q68 120 66 112 Z' },
  { muscle: 'calves', side: 'front', d: 'M36 156 Q42 154 42 162 Q42 172 39 178 Q34 170 36 156 Z M64 156 Q58 154 58 162 Q58 172 61 178 Q66 170 64 156 Z' },
  // ---------- back ----------
  { muscle: 'traps', side: 'back', d: 'M38 38 Q50 32 62 38 L58 52 Q50 48 42 52 Z' },
  { muscle: 'rear-delts', side: 'back', d: 'M24 46 Q30 41 36 45 Q34 54 27 56 Q23 51 24 46 Z M76 46 Q70 41 64 45 Q66 54 73 56 Q77 51 76 46 Z' },
  { muscle: 'upper-back', side: 'back', d: 'M36 52 Q50 48 64 52 Q63 62 50 64 Q37 62 36 52 Z' },
  { muscle: 'lats', side: 'back', d: 'M33 60 Q42 62 45 68 L44 88 Q37 84 34 74 Z M67 60 Q58 62 55 68 L56 88 Q63 84 66 74 Z' },
  { muscle: 'lower-back', side: 'back', d: 'M43 88 L57 88 Q57 100 54 106 L46 106 Q43 100 43 88 Z' },
  { muscle: 'triceps', side: 'back', d: 'M20 58 Q26 57 26 66 Q26 76 21 79 Q16 68 20 58 Z M80 58 Q74 57 74 66 Q74 76 79 79 Q84 68 80 58 Z' },
  { muscle: 'forearms', side: 'back', d: 'M18 82 Q24 80 23 88 Q22 98 17 102 Q14 92 18 82 Z M82 82 Q76 80 77 88 Q78 98 83 102 Q86 92 82 82 Z' },
  { muscle: 'glutes', side: 'back', d: 'M36 106 Q50 100 64 106 Q65 118 50 122 Q35 118 36 106 Z' },
  { muscle: 'hamstrings', side: 'back', d: 'M35 124 Q44 122 45 132 Q45 144 41 152 Q34 148 34 136 Z M65 124 Q56 122 55 132 Q55 144 59 152 Q66 148 66 136 Z' },
  { muscle: 'calves', side: 'back', d: 'M35 156 Q42 153 42 162 Q42 174 38 180 Q33 170 35 156 Z M65 156 Q58 153 58 162 Q58 174 62 180 Q67 170 65 156 Z' },
]

export function Silhouette() {
  return (
    <g fill="var(--surface3)" stroke="var(--line)" strokeWidth="1">
      {/* head */}
      <circle cx="50" cy="18" r="11" />
      {/* torso */}
      <path d="M30 40 Q50 32 70 40 L67 108 Q50 116 33 108 Z" />
      {/* arms */}
      <path d="M29 42 Q19 46 16 62 Q13 82 14 102 L24 104 Q26 84 27 66 Q28 52 32 44 Z" />
      <path d="M71 42 Q81 46 84 62 Q87 82 86 102 L76 104 Q74 84 73 66 Q72 52 68 44 Z" />
      {/* legs */}
      <path d="M34 106 Q30 130 32 152 Q33 170 36 184 L46 184 Q47 160 47 140 L48 112 Z" />
      <path d="M66 106 Q70 130 68 152 Q67 170 64 184 L54 184 Q53 160 53 140 L52 112 Z" />
    </g>
  )
}

export function MuscleMap({ primary, secondary = [], stabilisers = [], size = 150, showLabels = false, onTap, selected, heat }: {
  primary: Muscle[]
  secondary?: Muscle[]
  /** v6: third, lighter tier */
  stabilisers?: Muscle[]
  size?: number
  showLabels?: boolean
  /** v6: makes every region tappable (interactive body) */
  onTap?: (m: Muscle) => void
  selected?: Muscle | null
  /** v6: per-muscle 0..1 intensity (e.g. weekly sets vs target) — overrides tiers */
  heat?: Partial<Record<Muscle, number>>
}) {
  const paint = (m: Muscle): { fill: string; opacity: number } | null => {
    if (heat) {
      const h = heat[m]
      if (h === undefined) return onTap ? { fill: 'var(--ink3)', opacity: 0.18 } : null
      return { fill: ACCENT, opacity: 0.18 + Math.min(1, Math.max(0, h)) * 0.77 }
    }
    if (primary.includes(m) || primary.includes('full-body')) return { fill: ACCENT, opacity: 0.95 }
    if (secondary.includes(m)) return { fill: ACCENT, opacity: 0.45 }
    if (stabilisers.includes(m)) return { fill: ACCENT, opacity: 0.2 }
    return onTap ? { fill: 'var(--ink3)', opacity: 0.12 } : null
  }
  const height = size * 1.05
  return (
    <div className="flex items-start gap-2">
      {(['front', 'back'] as const).map((side) => (
        <div key={side} className="text-center">
          <svg viewBox="8 2 84 188" width={size / 2.1} height={height} role={onTap ? 'group' : undefined} aria-label={onTap ? `${side} view — tap a muscle` : undefined}>
            <Silhouette />
            {REGIONS.filter((r) => r.side === side).map((r, i) => {
              const p = paint(r.muscle)
              if (!p) return null
              const sel = selected === r.muscle
              return (
                <path
                  key={i}
                  d={r.d}
                  fill={p.fill}
                  opacity={sel ? 1 : p.opacity}
                  stroke={sel ? '#fff' : undefined}
                  strokeWidth={sel ? 1.2 : undefined}
                  style={onTap ? { cursor: 'pointer' } : undefined}
                  role={onTap ? 'button' : undefined}
                  tabIndex={onTap ? 0 : undefined}
                  aria-label={onTap ? r.muscle.replace('-', ' ') : undefined}
                  onClick={onTap ? () => onTap(r.muscle) : undefined}
                  onKeyDown={onTap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(r.muscle) } } : undefined}
                />
              )
            })}
          </svg>
          {showLabels && <div className="mt-1 text-[10px] uppercase tracking-wide text-ink3">{side}</div>}
        </div>
      ))}
    </div>
  )
}
