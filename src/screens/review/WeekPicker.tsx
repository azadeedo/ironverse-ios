// Week picker — arrows for stepping, a select for jumping back.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton, Select } from '@/components/ui'
import { nextWeek, prevWeek, recentWeekStarts, weekRange } from './helpers'

export default function WeekPicker({ weekStart, onChange }: {
  weekStart: string
  onChange: (w: string) => void
}) {
  const weeks = recentWeekStarts(16)
  const atLatest = weekStart >= weeks[0]
  const range = weekRange(weekStart)
  // a hand-typed / older week still needs to appear in the list
  const options = weeks.includes(weekStart) ? weeks : [weekStart, ...weeks]

  return (
    <div className="flex items-center gap-2 px-4 pt-1">
      <IconButton label="Previous week" onClick={() => onChange(prevWeek(weekStart))}>
        <ChevronLeft size={20} />
      </IconButton>
      <div className="min-w-0 flex-1">
        <Select value={weekStart} onChange={(e) => onChange(e.target.value)} aria-label="Week">
          {options.map((w) => {
            const r = weekRange(w)
            return <option key={w} value={w}>{r.relative} · {r.label}</option>
          })}
        </Select>
      </div>
      <IconButton
        label="Next week"
        disabled={atLatest}
        className={atLatest ? 'opacity-35' : ''}
        onClick={() => { if (!atLatest) onChange(nextWeek(weekStart)) }}
      >
        <ChevronRight size={20} />
      </IconButton>
      <span className="sr-only">{range.label}</span>
    </div>
  )
}
