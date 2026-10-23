// Halal mode + energy unit. Both are display/filter preferences — nothing
// stored changes, so flipping them back restores exactly what was there.

import { useNavigate } from 'react-router-dom'
import { Card, Segmented, Toggle } from '@/components/ui'
import { energyUnit, fmtEnergy, halalMode } from '@/db/defaults'
import type { EnergyUnit, Profile } from '@/db/types'

const UNIT_OPTIONS: { value: EnergyUnit; label: string }[] = [
  { value: 'kcal', label: 'Calories' },
  { value: 'kj', label: 'Kilojoules' },
  { value: 'both', label: 'Both' },
]

export function FoodPrefsCard({ profile, onPatch }: {
  profile: Profile
  onPatch: (patch: Partial<Profile>, msg?: string) => void
}) {
  const halal = halalMode(profile)
  const navigate = useNavigate()
  const unit = energyUnit(profile)

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold text-ink">Halal mode</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              Pork and alcohol are hidden from the food search. Gelatine and anything
              unclear still shows, flagged with a “check the label” note — the call
              stays yours.
            </p>
            {halal && (
              <button type="button" onClick={() => navigate('/prayer')} className="pressable mt-2 flex w-full items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-left text-[13px] font-semibold text-emerald-300">
                🕌 Prayer times, Qibla & reminders →
              </button>
            )}
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink3">
              Turning it on also adds: live prayer times on Today, a Qibla compass, prayer reminders, Ramadan and prayer-aware workout planning, a halal check in the Health scanner (halal label,
              pork, alcohol, gelatine and doubtful E-numbers), “not halal” badges on
              scanned barcodes, and halal swaps when you search for something hidden.
            </p>
          </div>
          <Toggle
            checked={halal}
            label="Halal mode"
            onChange={(on) => { onPatch({ halalMode: on }, on ? 'Halal mode on — prayer times added to Today' : 'Halal mode off'); setTimeout(() => { void import('@/lib/muslim').then((m) => m.schedulePrayerReminders()) }, 800) }}
          />
        </div>
      </Card>

      <Card className="mt-3 p-4">
        <div className="text-[14.5px] font-semibold text-ink">Show energy as</div>
        <div className="mt-2.5">
          <Segmented
            options={UNIT_OPTIONS}
            value={unit}
            onChange={(v) => onPatch({ energyUnit: v }, 'Energy unit saved')}
          />
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink2">
          Australian packets label energy in kilojoules, so matching the label saves
          the mental maths at the shelf. Everything is stored in calories either
          way — this only changes what you read.
        </p>
        <div className="mt-2.5 rounded-xl bg-surface3/60 px-3 py-2 text-[12.5px] text-ink2">
          Your target reads as{' '}
          <span className="big-num text-ink">{fmtEnergy(profile.calorieTarget, unit)}</span>
        </div>
      </Card>
    </>
  )
}
