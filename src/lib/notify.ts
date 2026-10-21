// Best-effort reminders for a serverless PWA.
// While the app is OPEN (foreground or installed standalone), timers fire real
// system notifications via the service worker registration (falls back to
// in-app toasts). True background push needs a push server — out of scope,
// so the Today timeline + badges keep the schedule visible instead.

import { useUI } from './store'
import { isNativeApp } from './edition'
// iOS app only — every function there returns early in a browser
import * as native from '@/native/notifications'

export function notificationsSupported(): boolean {
  if (isNativeApp()) return true // iOS app: local notifications
  return typeof Notification !== 'undefined'
}

export async function ensurePermission(): Promise<boolean> {
  if (isNativeApp()) return native.nativePermission(true)
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

export async function showNotification(title: string, body: string, tag?: string): Promise<void> {
  const toast = useUI.getState().toast
  if (isNativeApp() && (await native.nativeShowNow(title, body, tag))) return
  if (!isNativeApp() && notificationsSupported() && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) {
        await reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' })
        return
      }
      new Notification(title, { body, tag, icon: '/icon-192.png' })
      return
    } catch { /* fall through */ }
  }
  toast(`${title} — ${body}`, 'info')
}

type Cancel = () => void
const timers = new Map<string, number>()

/** schedule a same-day notification at 'HH:mm'; replaces any timer with the same key */
/** `stillNeeded` is re-checked when the timer fires — if it says no, nothing is shown */
export function scheduleAt(key: string, hhmm: string, title: string, body: string, stillNeeded?: () => Promise<boolean>): Cancel {
  cancelKey(key)
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  const delay = target.getTime() - now.getTime()
  if (delay <= 0) return () => {}
  native.trackPending({ key, at: target.getTime(), title, body })
  const id = window.setTimeout(() => {
    timers.delete(key)
    native.untrackPending(key)
    void (stillNeeded ? stillNeeded().catch(() => true) : Promise.resolve(true)).then((need) => { if (need) void showNotification(title, body, key) })
  }, delay)
  timers.set(key, id)
  return () => cancelKey(key)
}

export function cancelKey(key: string): void {
  const id = timers.get(key)
  native.untrackPending(key)
  if (id !== undefined) {
    clearTimeout(id)
    timers.delete(key)
  }
}

export function cancelAll(): void {
  for (const id of timers.values()) clearTimeout(id)
  timers.clear()
  native.untrackAll()
}

/** app badge (supported on installed PWAs in some browsers) */
export function setBadge(n: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (n > 0) void nav.setAppBadge?.(n)
    else void nav.clearAppBadge?.()
  } catch { /* unsupported */ }
}
