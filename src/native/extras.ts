// ============================================================
// Native extras (v10, 23 Oct 2026) — App Store build only, no-ops in a browser.
//   • Home-screen quick actions: long-press the app icon → Start workout,
//     Quick log, Log food, Sleep check-in (iOS shows four).
//   • App Store rating prompt: Apple's own sheet, asked after the 3rd, 10th
//     and 30th finished workout (iOS also limits it to 3 times a year).
//   • Face ID / Touch ID app lock (Settings → Privacy), off by default.
// ============================================================

import { db, getSetting, setSetting } from '@/db'
import { isNativeApp } from '@/lib/edition'

export const EXTRA_KEYS = { faceId: 'security:faceIdLock', reviewAskedAt: 'review:askedAtCounts' } as const

const SHORTCUTS = [
  { id: '/workout', title: 'Start workout', description: 'Today’s session' },
  { id: '/food', title: 'Log food', description: 'Add a meal or scan a barcode' },
  { id: '/sleep', title: 'Sleep check-in', description: 'How did you sleep?' },
  { id: '/?quick=1', title: 'Quick log', description: 'Water, weight, sleep, creatine' },
]

export async function initQuickActions(go: (path: string) => void): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { AppShortcuts } = await import('@capawesome/capacitor-app-shortcuts')
    await AppShortcuts.set({ shortcuts: SHORTCUTS })
    await AppShortcuts.addListener('click', (e) => { if (e.shortcutId.startsWith('/')) go(e.shortcutId) })
  } catch { /* quick actions are a nice-to-have */ }
}

const REVIEW_AT = [3, 10, 30]

/** call after a workout is finished */
export async function maybeAskForReview(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const done = (await db.workoutLogs.toArray()).filter((l) => l.finishedAt && !l.skipped).length
    const asked = await getSetting<number[]>(EXTRA_KEYS.reviewAskedAt, [])
    const due = REVIEW_AT.find((n) => done >= n && !asked.includes(n))
    if (!due) return
    await setSetting(EXTRA_KEYS.reviewAskedAt, [...asked, due])
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    setTimeout(() => { void InAppReview.requestReview() }, 1500) // after the finish screen has settled
  } catch { /* never block finishing a workout */ }
}

export async function biometricAvailable(): Promise<{ ok: boolean; kind: string }> {
  if (!isNativeApp()) return { ok: false, kind: 'Face ID' }
  try {
    const { NativeBiometric, BiometryType } = await import('@capgo/capacitor-native-biometric')
    const r = await NativeBiometric.isAvailable({ useFallback: true })
    const kind = r.biometryType === BiometryType.TOUCH_ID ? 'Touch ID' : 'Face ID'
    return { ok: r.isAvailable, kind }
  } catch { return { ok: false, kind: 'Face ID' } }
}

export async function verifyOwner(reason = 'Unlock Ironverse'): Promise<boolean> {
  if (!isNativeApp()) return true
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    await NativeBiometric.verifyIdentity({ reason, title: 'Ironverse', useFallback: true })
    return true
  } catch { return false }
}

export async function lockEnabled(): Promise<boolean> {
  return isNativeApp() && (await getSetting<boolean>(EXTRA_KEYS.faceId, false)) === true
}
