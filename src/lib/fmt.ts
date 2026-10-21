import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
export { dayjs }

export const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD/MM/YYYY') : '')
export const fmtDayShort = (d?: string | null) => (d ? dayjs(d).format('ddd D MMM') : '')
export const fmtRelative = (iso?: string | null) => (iso ? dayjs(iso).fromNow() : '')

export function fmtKg(kg: number | undefined | null): string {
  if (kg === undefined || kg === null) return '—'
  return `${kg % 1 === 0 ? kg : kg.toFixed(1)} kg`
}

export function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`
}

export function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = Math.max(0, Math.round(totalSec % 60))
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtPace(secPerKm?: number): string {
  if (!secPerKm || !isFinite(secPerKm)) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-AU')
