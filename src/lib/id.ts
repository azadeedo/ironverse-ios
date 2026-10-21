import { nanoid } from 'nanoid'

export const newId = () => nanoid(12)
export const nowIso = () => new Date().toISOString()
/** today as YYYY-MM-DD (local) */
export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
