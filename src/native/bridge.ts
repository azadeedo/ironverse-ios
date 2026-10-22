// ============================================================
// Native iOS shell glue (Capacitor). Loaded only in the App Store build and
// only does anything when actually running inside the iOS app — in a browser
// every call here is a no-op, so the web build behaves exactly as before.
//
//   • status bar: light text over the dark Ironverse header, content under it
//     (the app already pads for the notch with env(safe-area-inset-*))
//   • splash: hidden as soon as React has rendered
//   • haptics: iOS WebKit has no navigator.vibrate, so the app's existing
//     vibrate() calls are routed to the Taptic Engine instead
//   • reminders: the app's timers are handed to iOS when it goes to the
//     background, so they still arrive (see native/notifications.ts)
// ============================================================

import { isNativeApp } from '@/lib/edition'

let started = false

export async function initNative(): Promise<void> {
  if (started || !isNativeApp()) return
  started = true
  document.documentElement.classList.add('native-ios')

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
  } catch { /* plugin missing — the web defaults still look right */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration: 250 })
  } catch { /* auto-hide in capacitor.config covers it */ }

  installVibrateShim()

  try {
    const { App } = await import('@capacitor/app')
    const n = await import('./notifications')
    await App.addListener('pause', () => { void n.handOffPendingToIOS() })
    await App.addListener('resume', () => { void n.reclaimFromIOS() })
  } catch { /* reminders still fire while the app is open */ }

  // Apple Health: refresh on launch and every time the app comes back to the front
  try {
    const { App } = await import('@capacitor/app')
    const h = await import('./health')
    void h.syncAppleHealth(3)
    await App.addListener('resume', () => { void h.syncAppleHealth(3) })
    // weigh-ins typed in Ironverse → Apple Health (only when that switch is on)
    const { db } = await import('@/db')
    const send = (w?: { id?: string; date?: string; weightKg?: number }) => {
      if (w?.weightKg && !String(w.id ?? '').startsWith('hk-')) setTimeout(() => { void h.saveWeighInToHealth(w.weightKg!, w.date ? new Date(`${w.date}T08:00:00`).toISOString() : undefined) }, 0)
    }
    db.weighIns.hook('creating', (_pk, obj) => { send(obj) })
    db.weighIns.hook('updating', (mods, _pk, obj) => { send({ ...obj, ...(mods as object) }) })
  } catch { /* Health unavailable — steps/weigh-ins stay manual */ }
}

/** navigator.vibrate(pattern) → a Taptic tap per pulse (best effort). */
function installVibrateShim(): void {
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
  if (typeof nav.vibrate === 'function') return
  const shim = (pattern: number | number[]): boolean => {
    void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
      const pulses = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0) : [pattern]
      let delay = 0
      const gaps = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 1) : []
      pulses.forEach((ms, i) => {
        if (!(ms > 0)) return
        setTimeout(() => { void Haptics.impact({ style: ms >= 120 ? ImpactStyle.Heavy : ms >= 40 ? ImpactStyle.Medium : ImpactStyle.Light }) }, delay)
        delay += ms + (gaps[i] ?? 0)
      })
    }).catch(() => {})
    return true
  }
  try { Object.defineProperty(navigator, 'vibrate', { value: shim, configurable: true }) } catch { /* read-only — haptics simply stay off */ }
}
