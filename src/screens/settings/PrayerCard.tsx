// Prayer-aware scheduling. The times below are the ones HE types in — Ironverse
// does not calculate them from a location, does not fetch them, and never claims
// they are authoritative. It only keeps a session from landing on top of one.

import { CalendarClock, Info } from 'lucide-react'
import { Badge, Card, Toggle } from '@/components/ui'
import { prayerConfig } from '@/db/defaults'
import type { PrayerConfig, Profile } from '@/db/types'
import {
  PRAYER_KEYS, PRAYER_LABELS, conflictsWithPrayer, fmtTime12, suggestAroundPrayer,
} from '@/lib/islamic'
import { slotForDay } from '@/lib/schedule'
import { Stepper } from './Stepper'

export function PrayerCard({ profile, onPatch }: {
  profile: Profile
  onPatch: (patch: Partial<Profile>, msg?: string) => void
}) {
  const cfg = prayerConfig(profile)

  const patchPrayer = (patch: Partial<PrayerConfig>, msg = 'Prayer settings saved') =>
    onPatch({ prayer: { ...cfg, ...patch } }, msg)

  // live check against today's planned workout slot
  const dow = new Date().getDay()
  const wd = profile.workSchedule.find((w) => w.day === dow) ?? { day: dow as 0, working: false }
  const todaySlot = slotForDay(wd, profile.preferredSlot, profile.sessionMinutes)
  const clash = cfg.enabled ? conflictsWithPrayer(todaySlot.slot, profile.sessionMinutes, profile) : null
  const suggestion = clash ? suggestAroundPrayer(todaySlot.slot, profile.sessionMinutes, profile) : null

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CalendarClock size={16} className="shrink-0 text-brand" />
              <span className="text-[14.5px] font-semibold text-ink">Prayer-aware scheduling</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              Keeps a buffer clear around each prayer when a session is being placed,
              and offers a nearby slot when one would clash.
            </p>
          </div>
          <Toggle
            checked={cfg.enabled}
            label="Prayer-aware scheduling"
            onChange={(on) => patchPrayer({ enabled: on }, on ? 'Prayer times on' : 'Prayer times off')}
          />
        </div>

        <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-surface3/60 px-3 py-2.5 text-[12px] leading-relaxed text-ink2">
          <Info size={13} className="mt-0.5 shrink-0 text-ink3" />
          <span>
            These are <span className="font-semibold text-ink">your entered times</span>, not
            calculated ones. Ironverse has no location and no internet — check your
            usual source and update them as the year moves.
          </span>
        </p>
      </Card>

      {cfg.enabled && (
        <>
          <Card className="mt-3 divide-y divide-line overflow-hidden">
            {PRAYER_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1 text-[14px] font-medium text-ink">{PRAYER_LABELS[key]}</div>
                <input
                  type="time"
                  aria-label={`${PRAYER_LABELS[key]} time`}
                  value={cfg.times[key]}
                  onChange={(e) => e.target.value && patchPrayer({ times: { ...cfg.times, [key]: e.target.value } })}
                  className="shrink-0 rounded-lg border border-transparent bg-surface3 px-2.5 py-2 text-[14px] font-medium text-ink outline-none focus:border-brand"
                />
              </div>
            ))}
          </Card>

          <Card className="mt-3 p-4">
            <div className="text-[14px] font-medium text-ink">Buffer around each prayer</div>
            <div className="mt-2">
              <Stepper
                value={cfg.bufferMin}
                onChange={(v) => patchPrayer({ bufferMin: v })}
                min={0} max={60} step={5}
                format={(v) => `${v} min`}
                label="prayer buffer minutes"
              />
            </div>
            <p className="mt-2 text-[12.5px] text-ink2">
              Kept clear either side — wudu, walking, and not rushing the last set.
            </p>
          </Card>

          <Card className="mt-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-medium text-ink">Today’s planned slot</span>
              <span className="big-num text-[15px] text-ink">{fmtTime12(todaySlot.slot)}</span>
            </div>
            {clash ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="amber">clashes with {clash.label}</Badge>
                  <Badge tone="gray">{fmtTime12(clash.blockedFrom)}–{fmtTime12(clash.blockedTo)} kept clear</Badge>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink2">
                  {suggestion
                    ? suggestion.reason + ` Try ${fmtTime12(suggestion.time)}.`
                    : 'No clean slot nearby today — training either side of the prayer is the call to make yourself.'}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] text-emerald-500">
                Clear of every prayer time you have entered.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  )
}
