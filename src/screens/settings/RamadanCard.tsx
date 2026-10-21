// Ramadan mode — shift training, water and creatine into the eating window.
// Practical scheduling only: no rulings, no medical advice, nothing fabricated.

import { Droplets, Moon, Pill } from 'lucide-react'
import { Badge, Card, Toggle } from '@/components/ui'
import { ramadanConfig } from '@/db/defaults'
import type { Profile, RamadanConfig } from '@/db/types'
import {
  RAMADAN_WINDOW_OPTIONS, fmtTime12, isRamadanActive, ramadanCreatineTime,
  ramadanHydrationPlan, ramadanTrainingSlot,
} from '@/lib/islamic'

function TimeRow({ label, value, hint, onChange }: {
  label: string
  value: string
  hint?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-ink3">{hint}</div>}
      </div>
      <input
        type="time"
        aria-label={label}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="shrink-0 rounded-lg border border-transparent bg-surface3 px-2.5 py-2 text-[14px] font-medium text-ink outline-none focus:border-brand"
      />
    </div>
  )
}

export function RamadanCard({ profile, onPatch }: {
  profile: Profile
  onPatch: (patch: Partial<Profile>, msg?: string) => void
}) {
  const cfg = ramadanConfig(profile)
  const active = isRamadanActive(profile)

  const patchRamadan = (patch: Partial<RamadanConfig>, msg = 'Ramadan settings saved') =>
    onPatch({ ramadan: { ...cfg, ...patch } }, msg)

  const slot = ramadanTrainingSlot(profile)
  const water = ramadanHydrationPlan(profile)
  const creatine = ramadanCreatineTime(profile)

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Moon size={16} className="shrink-0 text-brand" />
              <span className="text-[14.5px] font-semibold text-ink">Ramadan mode</span>
              {cfg.enabled && !active && <Badge tone="gray">outside dates</Badge>}
              {active && <Badge tone="brand">active</Badge>}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              Moves training, water and creatine into the eating window instead of
              spreading them across a day you are fasting through. Times are the ones
              you enter here.
            </p>
          </div>
          <Toggle
            checked={cfg.enabled}
            label="Ramadan mode"
            onChange={(on) => patchRamadan({ enabled: on }, on ? 'Ramadan mode on' : 'Ramadan mode off')}
          />
        </div>

        {cfg.enabled && (
          <div className="mt-3 divide-y divide-line border-t border-line">
            <TimeRow
              label="Suhoor"
              hint="Pre-dawn meal"
              value={cfg.suhoorTime}
              onChange={(v) => patchRamadan({ suhoorTime: v })}
            />
            <TimeRow
              label="Iftar"
              hint="Breaking the fast"
              value={cfg.iftarTime}
              onChange={(v) => patchRamadan({ iftarTime: v })}
            />
          </div>
        )}
      </Card>

      {cfg.enabled && (
        <>
          {/* ---------- training window ---------- */}
          <Card className="mt-3 p-4">
            <div className="text-[14.5px] font-semibold text-ink">Train when</div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {RAMADAN_WINDOW_OPTIONS.map((o) => {
                const on = cfg.trainingWindow === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => patchRamadan({ trainingWindow: o.value }, 'Training window saved')}
                    className={`pressable min-h-[44px] rounded-xl border-2 px-3 py-2.5 text-left text-[13.5px] font-semibold ${
                      on ? 'border-brand bg-brand/10 text-ink' : 'border-transparent bg-surface3 text-ink2'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 rounded-xl bg-surface3/70 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink3">Suggested start</span>
                <span className="big-num text-[17px] text-brand">{fmtTime12(slot.time)}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{slot.rationale}</p>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t border-line pt-3">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-ink">Reduced volume</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
                  Treat the month as maintenance — fewer sets, same main lifts, sessions
                  capped around {slot.sessionMinutes} minutes. Holding what you built is
                  the goal while you are fasting; chasing PRs is not.
                </p>
              </div>
              <Toggle
                checked={cfg.maintenanceVolume}
                label="Reduced volume"
                onChange={(v) => patchRamadan({ maintenanceVolume: v })}
              />
            </div>
          </Card>

          {/* ---------- water + creatine ---------- */}
          <Card className="mt-3 p-4">
            <div className="flex items-center gap-1.5">
              <Droplets size={16} className="text-sky-400" />
              <span className="text-[14.5px] font-semibold text-ink">Water across the eating window</span>
            </div>
            <p className="mt-1 text-[12.5px] text-ink2">{water.windowLabel}</p>
            <div className="mt-2.5 space-y-1.5">
              {water.slots.map((s) => (
                <div key={s.time} className="flex items-center gap-3 rounded-lg bg-surface3/60 px-3 py-2">
                  <span className="w-[68px] shrink-0 text-[12.5px] font-semibold tabular-nums text-ink2">{fmtTime12(s.time)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink2">{s.label}</span>
                  <span className="big-num shrink-0 text-[13.5px] text-ink">{s.ml} ml</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink3">{water.note}</p>

            <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
              <Pill size={16} className="shrink-0 text-emerald-400" />
              <p className="text-[12.5px] leading-relaxed text-ink2">{creatine.rationale}</p>
            </div>
          </Card>

          {/* ---------- optional dates ---------- */}
          <Card className="mt-3 p-4">
            <div className="text-[14.5px] font-semibold text-ink">Dates (optional)</div>
            <p className="mt-1 text-[12.5px] text-ink2">
              Set these and Ramadan mode switches itself off afterwards. Leave them blank
              and it stays on until you turn it off.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              {([['Start', 'startDate'], ['End', 'endDate']] as const).map(([label, key]) => (
                <label key={key} className="block">
                  <div className="mb-1.5 text-[13px] font-medium text-ink2">{label}</div>
                  <input
                    type="date"
                    aria-label={`Ramadan ${label.toLowerCase()} date`}
                    value={cfg[key] ?? ''}
                    onChange={(e) => patchRamadan({ [key]: e.target.value || undefined } as Partial<RamadanConfig>, 'Dates saved')}
                    className="w-full rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
                  />
                </label>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  )
}
