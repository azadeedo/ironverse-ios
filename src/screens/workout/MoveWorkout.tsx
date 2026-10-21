// v9 — "I'm working that day": move one program workout to another date.
// The workout keeps its program week; the original date becomes a rest day.
// Stored on the plan as moves[originalDate] = newDate (undo removes it).
import { useState } from 'react'
import dayjs from 'dayjs'
import { CalendarClock } from 'lucide-react'
import { db } from '@/db'
import { Button, Sheet } from '@/components/ui'
import { DAY_LABEL, DAY_WEEKDAY, type DayKey } from '@/data/program12'
import type { Plan } from '@/db/types'
import { dayKeyForDate, programDayOn } from '@/lib/program12'
import { todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'

export function originalDateFor(plan: Plan, dayKey: DayKey, today = todayStr()): string {
  const on = programDayOn(plan, today)
  if (on?.movedFrom && on.dk === dayKey) return on.movedFrom
  const monday = dayjs(today).subtract((dayjs(today).day() + 6) % 7, 'day')
  return monday.add(DAY_WEEKDAY[dayKey] - 1, 'day').format('YYYY-MM-DD')
}

export function MoveWorkout({ plan, dayKey }: { plan: Plan; dayKey: DayKey }) {
  const { toast } = useUI()
  const [open, setOpen] = useState(false)
  const today = todayStr()
  const orig = originalDateFor(plan, dayKey, today)
  const moves = plan.moves ?? {}
  const movedTo = moves[orig]
  const taken = new Set(Object.values(moves))
  const options = Array.from({ length: 8 }, (_, i) => dayjs(today).add(i, 'day').format('YYYY-MM-DD'))
    .filter((d) => d !== orig && !taken.has(d) && !(dayKeyForDate(d) && !moves[d]))
  async function save(next: Record<string, string>, msg: string) {
    await db.plans.put({ ...plan, moves: next }); toast(msg); setOpen(false)
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pressable flex w-full items-center gap-2 rounded-xl bg-surface3/70 px-3 py-2.5 text-left text-[13px]">
        <CalendarClock size={16} className="text-brand" />
        <span className="flex-1">{movedTo ? <>Moved to <b>{dayjs(movedTo).format('dddd D MMM')}</b> — tap to change</> : <>Working on {DAY_LABEL[dayKey]}? <b>Move this workout</b></>}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Move ${DAY_LABEL[dayKey]}'s workout`}>
        <p className="mb-3 text-[13px] text-ink2">Pick a free day. The workout keeps its week and exercises; {dayjs(orig).format('dddd D MMM')} becomes a rest day. Try to keep a rest day between hard leg sessions.</p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((d) => (
            <Button key={d} variant={movedTo === d ? 'primary' : 'secondary'} onClick={() => void save({ ...moves, [orig]: d }, `Moved to ${dayjs(d).format('dddd')}`)}>
              {d === today ? 'Today' : dayjs(d).format('ddd D MMM')}
            </Button>
          ))}
        </div>
        {options.length === 0 && <p className="text-[13px] text-ink3">No free days in the next week — every day already has a workout.</p>}
        {movedTo && (
          <Button full variant="ghost" className="mt-3" onClick={() => { const n = { ...moves }; delete n[orig]; void save(n, 'Back on its normal day') }}>
            Put it back on {DAY_LABEL[dayKey]}
          </Button>
        )}
      </Sheet>
    </>
  )
}
