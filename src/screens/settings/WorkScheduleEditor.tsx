// 7-row work-week editor (Monday first): working toggle + start/end time inputs.
// Built here in settings/ and shared with the Onboarding wizard.

import { Card, Toggle } from '@/components/ui'
import { DAY_NAMES, minutesOf } from '@/lib/schedule'
import type { WorkDay } from '@/db/types'
import { WEEK_ROW_ORDER } from './lib'

function rowInvalid(wd: WorkDay): boolean {
  return wd.working && !!wd.start && !!wd.end && minutesOf(wd.start) >= minutesOf(wd.end)
}

/** true when every working day has a valid start < end window */
export function scheduleValid(value: WorkDay[]): boolean {
  return value.every((wd) => !wd.working || (!!wd.start && !!wd.end && minutesOf(wd.start) < minutesOf(wd.end)))
}

export function WorkScheduleEditor({ value, onChange }: {
  value: WorkDay[]
  onChange: (next: WorkDay[]) => void
}) {
  const update = (day: WorkDay['day'], patch: Partial<WorkDay>) => {
    onChange(value.map((wd) => (wd.day === day ? { ...wd, ...patch } : wd)))
  }

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {WEEK_ROW_ORDER.map((dayIdx) => {
        const wd = value.find((w) => w.day === dayIdx) ?? { day: dayIdx, working: false }
        const invalid = rowInvalid(wd)
        return (
          <div key={dayIdx} className="px-4 py-2.5">
            <div className="flex min-h-[40px] items-center gap-3">
              <div className="w-10 shrink-0 text-[14px] font-semibold text-ink">
                {DAY_NAMES[dayIdx].slice(0, 3)}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {wd.working ? (
                  <>
                    <input
                      type="time"
                      aria-label={`${DAY_NAMES[dayIdx]} work start`}
                      value={wd.start ?? '08:00'}
                      onChange={(e) => e.target.value && update(dayIdx, { start: e.target.value })}
                      className={`min-w-0 rounded-lg border bg-surface3 px-2 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand ${invalid ? 'border-red-500/60' : 'border-transparent'}`}
                    />
                    <span className="shrink-0 text-[12px] text-ink3">to</span>
                    <input
                      type="time"
                      aria-label={`${DAY_NAMES[dayIdx]} work end`}
                      value={wd.end ?? '17:00'}
                      onChange={(e) => e.target.value && update(dayIdx, { end: e.target.value })}
                      className={`min-w-0 rounded-lg border bg-surface3 px-2 py-1.5 text-[13px] font-medium text-ink outline-none focus:border-brand ${invalid ? 'border-red-500/60' : 'border-transparent'}`}
                    />
                  </>
                ) : (
                  <span className="text-[13px] font-medium text-ink3">Day off</span>
                )}
              </div>
              <Toggle
                checked={wd.working}
                label={`Working on ${DAY_NAMES[dayIdx]}`}
                onChange={(on) =>
                  update(dayIdx, on
                    ? { working: true, start: wd.start ?? '08:00', end: wd.end ?? '17:00' }
                    : { working: false })
                }
              />
            </div>
            {invalid && (
              <p className="mt-1 pl-[52px] text-[12px] font-medium text-red-400">
                End time must be after start time.
              </p>
            )}
          </div>
        )
      })}
    </Card>
  )
}
