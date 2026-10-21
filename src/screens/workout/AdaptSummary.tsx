// What changed when the location changed.
// A toast disappears; this doesn't. Every swap is listed with its reason, and
// anything with no stand-in at this location is stated plainly, never hidden.

import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Repeat2, X } from 'lucide-react'
import { byId } from '@/data/exercises'
import { Badge, Sheet } from '@/components/ui'
import type { AdaptResult, LocaliseResult } from '@/lib/equipment'
import type { EquipmentProfile } from '@/db/types'

/**
 * Both engines feed this screen: adaptToProfile (swap what's missing) and
 * localiseSession (also upgrade to the best option in the room). The localised
 * result carries a direction so an upgrade doesn't read as a downgrade.
 */
type AnyAdapt = AdaptResult | LocaliseResult

type AnySwap = AnyAdapt['swaps'][number]

function directionOf(s: AnySwap): 'upgrade' | 'substitute' {
  return 'direction' in s ? s.direction : 'substitute'
}

export function adaptChangeCount(adapt: AnyAdapt | null): number {
  if (!adapt) return 0
  return adapt.swaps.length + adapt.dropped.length
}

/** How many of the changes are genuine upgrades rather than fallbacks. */
export function adaptUpgradeCount(adapt: AnyAdapt | null): number {
  if (!adapt) return 0
  return adapt.swaps.filter((s) => directionOf(s) === 'upgrade').length
}

/** Dismissible card shown under the location switch after a change. */
export function AdaptSummaryCard({ adapt, location, onOpen, onDismiss }: {
  adapt: AnyAdapt
  location: EquipmentProfile
  onOpen: () => void
  onDismiss: () => void
}) {
  const swapped = adapt.swaps.length
  const dropped = adapt.dropped.length
  const upgrades = adaptUpgradeCount(adapt)
  if (swapped + dropped === 0) return null

  const parts: string[] = []
  if (upgrades) parts.push(`${upgrades} upgraded`)
  if (swapped - upgrades) parts.push(`${swapped - upgrades} swapped`)
  if (dropped) parts.push(`${dropped} with no stand-in`)

  return (
    <div className="px-4 pt-2.5">
      <div className="rounded-2xl bg-surface2 p-3.5 shadow-card ring-1 ring-brand/30">
        <div className="flex items-start gap-2.5">
          <Repeat2 size={17} className="mt-0.5 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">
              Built for {location.name}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
              {upgrades > 0
                ? `Every slot is the best option you can train at ${location.name} — ${parts.join(' · ')}. Same muscles, same sets and reps, and your saved plan is untouched.`
                : `Same muscles, same sets and reps — ${parts.join(' · ')}. Your saved plan is untouched.`}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpen}
                className="pressable inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-brand/12 px-3.5 text-[12.5px] font-bold text-brand"
              >
                {swapped ? `${swapped} changed` : `${dropped} dropped`} — see what changed
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="pressable -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Full list of every swap and every drop, with the reason for each. */
export function AdaptSummarySheet({ open, onClose, adapt, location }: {
  open: boolean
  onClose: () => void
  adapt: AnyAdapt | null
  location: EquipmentProfile | null
}) {
  const swaps = adapt?.swaps ?? []
  const dropped = adapt?.dropped ?? []
  return (
    <Sheet open={open} onClose={onClose} title={location ? `At ${location.name}` : 'What changed'}>
      <p className="mb-3 text-[13px] leading-relaxed text-ink2">
        Your plan is the source of truth — this is just how it runs at this location.
        Sets, reps and rest are identical.
      </p>

      {swaps.length === 0 && dropped.length === 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-surface3 p-4 text-[13.5px] text-ink2">
          <Check size={17} className="shrink-0 text-emerald-500" />
          Nothing had to change — everything in this session is available here.
        </div>
      )}

      {swaps.length > 0 && (
        <div className="flex flex-col gap-2">
          {swaps.map((s, i) => {
            const up = directionOf(s) === 'upgrade'
            return (
              <div key={`${s.from}-${i}`} className="rounded-2xl bg-surface3 p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-ink">
                  <span className="text-ink2 line-through decoration-ink3/60">{s.from}</span>
                  {up
                    ? <ArrowUpRight size={14} className="shrink-0 text-emerald-500" />
                    : <ArrowRight size={14} className="shrink-0 text-brand" />}
                  <span>{s.to}</span>
                  <Badge tone={up ? 'green' : 'amber'} className="shrink-0">
                    {up ? 'Upgrade' : 'Stand-in'}
                  </Badge>
                </div>
                {s.reason && (
                  <div className="mt-1 text-[12.5px] text-ink2">{s.reason}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {dropped.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <AlertTriangle size={15} className="shrink-0 text-amber-500" />
            <h3 className="text-[14px] font-semibold text-ink">No stand-in here</h3>
          </div>
          <p className="mb-2 text-[12.5px] leading-relaxed text-ink2">
            These are off the session at this location — there's nothing here that trains
            them closely enough to pretend otherwise.
          </p>
          <div className="flex flex-col gap-2">
            {dropped.map((id) => {
              const ex = byId.get(id)
              return (
                <div key={id} className="flex items-center gap-2 rounded-2xl bg-surface3 p-3">
                  <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                    {ex ? ex.name : id}
                  </div>
                  <Badge tone="amber" className="shrink-0">Skipped</Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Sheet>
  )
}
