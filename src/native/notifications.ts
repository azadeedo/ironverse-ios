// Native reminders for the iOS app (@capacitor/local-notifications).
//
// lib/notify.ts keeps working exactly as it does on the web: same-day timers
// while the app is open, re-checked with `stillNeeded` when they fire. iOS
// suspends a backgrounded app's timers, so when the app goes to the background
// every pending timer is handed to iOS as a scheduled local notification, and
// when it comes back those are taken back (cancelled) and the in-app timers
// carry on. Nothing leaves the phone — these are local notifications only.

import { isNativeApp } from '@/lib/edition'

export interface PendingReminder { key: string; at: number; title: string; body: string }

const pending = new Map<string, PendingReminder>()
const handedOff = new Set<number>()

/** stable 31-bit id for a reminder key (iOS needs an integer) */
export function idFor(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return Math.abs(h) % 2_000_000_000 || 1
}

export function trackPending(r: PendingReminder): void { pending.set(r.key, r) }
export function untrackPending(key: string): void { pending.delete(key) }
export function untrackAll(): void { pending.clear() }
export function pendingReminders(): PendingReminder[] { return [...pending.values()] }

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

export async function nativePermission(request: boolean): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const ln = await plugin()
    const cur = await ln.checkPermissions()
    if (cur.display === 'granted') return true
    if (!request || cur.display === 'denied') return false
    return (await ln.requestPermissions()).display === 'granted'
  } catch { return false }
}

export async function nativeShowNow(title: string, body: string, key = `now:${Date.now()}`): Promise<boolean> {
  if (!(await nativePermission(false))) return false
  try {
    const ln = await plugin()
    await ln.schedule({ notifications: [{ id: idFor(key), title, body }] })
    return true
  } catch { return false }
}

/** app → background: give iOS every reminder that is still due later today */
export async function handOffPendingToIOS(): Promise<void> {
  if (!(await nativePermission(false))) return
  const now = Date.now()
  const due = pendingReminders().filter((r) => r.at > now + 1000)
  if (!due.length) return
  try {
    const ln = await plugin()
    await ln.schedule({ notifications: due.map((r) => ({ id: idFor(r.key), title: r.title, body: r.body, schedule: { at: new Date(r.at), allowWhileIdle: true } })) })
    due.forEach((r) => handedOff.add(idFor(r.key)))
  } catch { /* the in-app timers still run when the app is reopened */ }
}

/** app → foreground: take the not-yet-delivered ones back so nothing fires twice */
export async function reclaimFromIOS(): Promise<void> {
  if (!handedOff.size) return
  try {
    const ln = await plugin()
    await ln.cancel({ notifications: [...handedOff].map((id) => ({ id })) })
  } catch { /* already delivered */ }
  handedOff.clear()
}
