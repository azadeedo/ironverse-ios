// Cardio module shared helpers: MET constants, distance maths, screen wake
// lock, vibration, and the Stepper atom used by the interval/reminder configs.

import { useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { CardioLog } from '@/db/types'

/** every kind a CardioLog can hold (v6 adds the gym machines used for Zone 2) */
export type AnyCardioKind = CardioLog['kind']
/** the kinds with a live tracker screen (GPS run/walk, jump-rope timer) */
export type CardioKind = 'run' | 'walk' | 'jump-rope'

/** MET values for calorie estimates (kcal = MET x kg x hours). Compendium-style
 *  moderate values; the gym machines vary a lot with incline/resistance. */
export const CARDIO_MET: Record<AnyCardioKind, number> = {
  run: 9.8, walk: 3.5, 'jump-rope': 11, 'incline-walk': 5.3, bike: 6.8, elliptical: 5.0,
}

export const KIND_LABEL: Record<AnyCardioKind, string> = {
  run: 'Run', walk: 'Walk', 'jump-rope': 'Jump rope', 'incline-walk': 'Incline walk', bike: 'Stationary bike', elliptical: 'Elliptical',
}

export function isCardioKind(v: string | null | undefined): v is CardioKind {
  return v === 'run' || v === 'walk' || v === 'jump-rope'
}

/** great-circle distance between two GPS fixes, in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** m:ss below an hour, h:mm:ss above */
export function fmtHMS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}

interface WakeSentinel { release: () => Promise<void> }
type WakeLockApi = { request: (type: 'screen') => Promise<WakeSentinel> }

/** Best-effort screen wake lock while `active`; re-acquires when the tab
 *  becomes visible again (the browser drops it on hide). Silent no-op where
 *  unsupported — the timer itself keeps correct time via timestamps. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    let done = false
    let sentinel: WakeSentinel | null = null
    const acquire = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
        if (!wl) return
        const s = await wl.request('screen')
        if (done) await s.release()
        else sentinel = s
      } catch { /* denied or unsupported — screen may sleep */ }
    }
    void acquire()
    const onVis = () => { if (document.visibilityState === 'visible') void acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', onVis)
      if (sentinel) sentinel.release().catch(() => undefined)
    }
  }, [active])
}

export function Stepper({ value, onChange, min, max, step = 1, format }: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}) {
  const btn = 'pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface3 text-ink disabled:opacity-30'
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" aria-label="Decrease" className={btn} disabled={value <= min}
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}>
        <Minus size={16} />
      </button>
      <div className="big-num min-w-[64px] text-center text-[18px] text-ink">{format ? format(value) : value}</div>
      <button type="button" aria-label="Increase" className={btn} disabled={value >= max}
        onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}>
        <Plus size={16} />
      </button>
    </div>
  )
}
