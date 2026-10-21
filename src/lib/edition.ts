// ============================================================
// Which build is running.
//
// The same source builds two apps:
//   • the web/PWA build (`npm run build`) — behaves exactly as Ironverse always has
//   • the App Store build (`npm run build:ios`, Vite mode "ios") — a public app,
//     so a brand-new install starts EMPTY and runs the first-time setup instead
//     of being pre-filled with the owner's personal profile.
//
// Nothing is removed for the App Store build: the owner-only startup routines
// are kept and still run in the web build. In the App Store build they are
// simply not started on a fresh install. A restored Ironverse backup brings
// every record (and every "already done" flag) across unchanged.
// ============================================================

import { Capacitor } from '@capacitor/core'

type EditionOverride = { __IV_EDITION_OVERRIDE__?: 'web' | 'ios' }

/** true in the App Store (Capacitor iOS) build. Tests can override it. */
export function isAppStoreEdition(): boolean {
  const o = (globalThis as EditionOverride).__IV_EDITION_OVERRIDE__
  if (o) return o === 'ios'
  return import.meta.env?.VITE_EDITION === 'ios'
}

/** true when running inside the native iOS shell (not a browser). */
export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

export const EDITION_LABEL = (): string => (isAppStoreEdition() ? 'iOS App Store edition' : 'Web app')

/**
 * Wording that is personal to the owner (his gym, his goal, his garage) in the
 * web app, and neutral in the App Store build. The web text is returned unchanged.
 */
export function ed<T>(web: T, ios: T): T {
  return isAppStoreEdition() ? ios : web
}
