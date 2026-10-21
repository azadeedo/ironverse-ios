// One-tap "Training at:" switch for the Workout tab.
// Switching is a LENS over the saved plan — it never rewrites it.

import { MapPin } from 'lucide-react'
import type { EquipmentProfile } from '@/db/types'

export function LocationSwitch({ profiles, currentId, onPick, busy }: {
  profiles: EquipmentProfile[]
  currentId: string
  onPick: (id: string) => void
  busy?: boolean
}) {
  if (profiles.length === 0) return null
  return (
    <div className="px-4 pt-2">
      <div className="flex items-center gap-2 rounded-2xl bg-surface2 p-1.5 shadow-card">
        <span className="ml-1.5 inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">
          <MapPin size={14} className="text-brand" />
          Training at
        </span>
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {profiles.map((p) => {
            const on = p.id === currentId
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => !on && onPick(p.id)}
                className={`min-h-[44px] shrink-0 rounded-xl px-3.5 text-[13.5px] font-semibold transition-colors disabled:opacity-60 ${
                  on ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
                }`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
