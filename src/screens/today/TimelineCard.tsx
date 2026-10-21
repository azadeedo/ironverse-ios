// Vertical schedule timeline: past dimmed, next item highlighted.

import { BellRing, Briefcase, Droplets, Dumbbell, Home, Info, Pill } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { minutesOf, type TimelineItem } from '@/lib/schedule'
import { fmt12 } from './lib'

const ICONS: Record<TimelineItem['kind'], typeof Droplets> = {
  water: Droplets,
  creatine: Pill,
  workout: Dumbbell,
  'work-start': Briefcase,
  'work-end': Home,
}

const ICON_TONES: Record<TimelineItem['kind'], string> = {
  water: 'text-sky-400',
  creatine: 'text-emerald-400',
  workout: 'text-brand',
  'work-start': 'text-ink2',
  'work-end': 'text-ink2',
}

export function TimelineCard({ items, nowMin }: { items: TimelineItem[]; nowMin: number }) {
  const nextIdx = items.findIndex((i) => minutesOf(i.time) >= nowMin)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <BellRing size={15} className="text-brand" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">Today’s schedule</span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink3">
          Nothing scheduled — enable reminders in Settings to build your day.
        </p>
      ) : (
        <div className="relative mt-3">
          {/* connecting line: 64px time col + 12px gap + 14px to dot centre */}
          <div className="absolute bottom-3 top-3 left-[89px] w-px bg-line" />
          {items.map((item, i) => {
            const past = minutesOf(item.time) < nowMin
            const isNext = i === nextIdx
            const Icon = ICONS[item.kind]
            return (
              <div
                key={`${item.kind}-${i}`}
                className={`relative flex items-center gap-3 py-[7px] transition-opacity ${past ? 'opacity-40' : ''}`}
              >
                <div className="w-16 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink2">
                  {fmt12(item.time)}
                </div>
                <div
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isNext
                      ? 'bg-brand text-white shadow-md shadow-brand/30'
                      : `bg-surface3 ${ICON_TONES[item.kind]}`
                  }`}
                >
                  <Icon size={14} strokeWidth={2.4} />
                </div>
                <div className={`min-w-0 flex-1 truncate text-[13.5px] ${isNext ? 'font-bold text-ink' : 'font-medium text-ink2'}`}>
                  {item.label}
                </div>
                {isNext && <Badge tone="brand">Next</Badge>}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-3">
        <Info size={13} className="shrink-0 text-ink3" />
        <p className="text-[11.5px] text-ink3">Reminders ring while Ironverse is open.</p>
      </div>
    </Card>
  )
}
