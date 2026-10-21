// RAMADAN + PRAYER AWARENESS.
//
// When Ramadan mode is on, the training slot and the hydration plan shift to
// the eating window and the card says WHY. When prayer awareness is on and the
// planned session runs into a prayer, the clash is shown alongside the first
// clear slot — never silently rescheduled behind his back.
//
// `@/lib/islamic` is owned by another agent. Everything here has a local
// fallback, so the card renders correctly whether that module exists or not.

import { useEffect, useState } from 'react'
import { Clock, Droplets, Moon, TriangleAlert } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { prayerConfig, ramadanConfig } from '@/db/defaults'
import type { Profile } from '@/db/types'
import type { DaySlot } from '@/lib/schedule'
import {
  coerceHydration, coerceSlotView, fmt12, loadIslamic, localPrayerClash, localRamadanHydration,
  localRamadanSlot, localSuggestAroundPrayer,
  type HydrationStop, type PrayerClash, type TrainingSlotView,
} from './lib'

interface FaithView {
  ramadan: { slot: TrainingSlotView; hydration: HydrationStop[] } | null
  prayer: { clash: PrayerClash; suggested: string | null } | null
}

export function FaithCard({ profile, slot, isTrainingDay }: {
  profile: Profile
  slot: DaySlot | null
  isTrainingDay: boolean
}) {
  const ramadan = ramadanConfig(profile)
  const prayer = prayerConfig(profile)
  const [view, setView] = useState<FaithView | null>(null)

  useEffect(() => {
    let alive = true
    async function build() {
      const mod = await loadIslamic()

      // ---------- Ramadan ----------
      let ramadanView: FaithView['ramadan'] = null
      if (ramadan.enabled) {
        const fallbackSlot = localRamadanSlot(ramadan)
        const fallbackWater = localRamadanHydration(ramadan, profile.waterTargetMl)
        let slotView = fallbackSlot
        let water = fallbackWater
        try {
          if (mod && typeof mod.ramadanTrainingSlot === 'function') {
            slotView = coerceSlotView(await mod.ramadanTrainingSlot(ramadan, profile), fallbackSlot)
          }
        } catch { /* keep the local slot */ }
        try {
          if (mod && typeof mod.ramadanHydrationPlan === 'function') {
            water = coerceHydration(
              await mod.ramadanHydrationPlan(ramadan, profile.waterTargetMl, profile),
              fallbackWater,
            )
          }
        } catch { /* keep the local plan */ }
        ramadanView = { slot: slotView, hydration: water }
      }

      // ---------- prayer clash ----------
      let prayerView: FaithView['prayer'] = null
      const plannedSlot = ramadanView?.slot.time ?? slot?.slot ?? null
      if (prayer.enabled && isTrainingDay && plannedSlot) {
        let clash: PrayerClash | null = localPrayerClash(plannedSlot, profile.sessionMinutes, prayer)
        try {
          if (mod && typeof mod.conflictsWithPrayer === 'function') {
            const res = await mod.conflictsWithPrayer(plannedSlot, profile.sessionMinutes, prayer)
            if (res === false || res === null) clash = null
            else if (res && typeof res === 'object') {
              const r = res as Record<string, unknown>
              const label = typeof r.label === 'string' ? r.label
                : typeof r.name === 'string' ? r.name : clash?.label
              const time = typeof r.time === 'string' ? r.time : clash?.time
              if (label && time) clash = { label, time }
            }
          }
        } catch { /* keep the local verdict */ }

        if (clash) {
          let suggested = localSuggestAroundPrayer(plannedSlot, profile.sessionMinutes, prayer)
          try {
            if (mod && typeof mod.suggestAroundPrayer === 'function') {
              const s = await mod.suggestAroundPrayer(plannedSlot, profile.sessionMinutes, prayer)
              if (typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s)) suggested = s
              else if (s && typeof s === 'object') {
                const t = (s as Record<string, unknown>).time
                if (typeof t === 'string') suggested = t
              }
            }
          } catch { /* keep the local suggestion */ }
          prayerView = { clash, suggested }
        }
      }

      if (alive) setView({ ramadan: ramadanView, prayer: prayerView })
    }
    void build()
    return () => { alive = false }
  }, [
    profile.waterTargetMl, profile.sessionMinutes, isTrainingDay, slot?.slot,
    ramadan.enabled, ramadan.iftarTime, ramadan.suhoorTime, ramadan.trainingWindow,
    prayer.enabled, prayer.bufferMin,
    prayer.times.fajr, prayer.times.dhuhr, prayer.times.asr, prayer.times.maghrib, prayer.times.isha,
  ])

  if (!view || (!view.ramadan && !view.prayer)) return null

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <Moon size={15} className="text-brand" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">
          {view.ramadan ? 'Ramadan' : 'Around prayer'}
        </span>
        {view.ramadan && <Badge tone="brand">Fasting</Badge>}
      </div>

      {view.ramadan && (
        <>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface3 px-3 py-2.5">
            <Clock size={17} className="shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-ink">
                Train {fmt12(view.ramadan.slot.time)}
              </div>
              <div className="text-[12px] font-semibold text-ink2">{view.ramadan.slot.label}</div>
            </div>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{view.ramadan.slot.why}</p>

          {view.ramadan.hydration.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex items-center gap-1.5">
                <Droplets size={14} className="text-sky-400" />
                <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">
                  Water, iftar to suhoor
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {view.ramadan.hydration.map((h, i) => (
                  <div key={`${h.time}-${i}`} className="flex items-center gap-3 text-[12.5px]">
                    <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-ink2">
                      {fmt12(h.time)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink2">{h.label}</span>
                    {h.ml > 0 && (
                      <span className="shrink-0 font-bold tabular-nums text-sky-400">{h.ml} ml</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-ink3">
                Same daily total, packed into the hours you can drink. Sip it across the window rather
                than sinking it all at iftar.
              </p>
            </div>
          )}
        </>
      )}

      {view.prayer && (
        <div className={view.ramadan ? 'mt-3 border-t border-line pt-3' : 'mt-3'}>
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-3 py-2.5">
            <TriangleAlert size={16} className="mt-[1px] shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink">
                That session runs into {view.prayer.clash.label} ({fmt12(view.prayer.clash.time)})
              </div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
                {view.prayer.suggested
                  ? `Starting at ${fmt12(view.prayer.suggested)} keeps the whole session clear, buffer included.`
                  : 'Nothing clear later today — splitting the session or trimming it is the honest option.'}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-ink3">
            Nothing has been moved for you — the plan still says what it said.
          </p>
        </div>
      )}
    </Card>
  )
}
