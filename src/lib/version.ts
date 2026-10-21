// App version + update checks (versioning requirement). The numbers come from
// package.json at BUILD time (vite define) and the deployed /version.json —
// never a hand-typed constant that can drift from what is live.

export const VERSION = __APP_VERSION__
export const BUILD = __BUILD_ID__
export const RELEASED = __RELEASE_DATE__

export interface LiveVersion { app: string; version: string; build: string; commit: string; released: string }

/** what is actually deployed right now (bypasses every cache) */
export async function fetchLiveVersion(): Promise<LiveVersion | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    return (await r.json()) as LiveVersion
  } catch { return null }
}

export type UpdateCheck = { state: 'current'; live: LiveVersion } | { state: 'available'; live: LiveVersion } | { state: 'offline' }

/** compare this build with the deployed one; if newer, ask the service worker to fetch it */
export async function checkForUpdates(): Promise<UpdateCheck> {
  const live = await fetchLiveVersion()
  if (!live) return { state: 'offline' }
  if (live.build === BUILD) return { state: 'current', live }
  const reg = (window as unknown as { __ivReg?: ServiceWorkerRegistration }).__ivReg
  try { await reg?.update() } catch { /* the prompt still appears on next launch */ }
  return { state: 'available', live }
}

/**
 * Switch to the downloaded version. Talks to the waiting service worker
 * directly (SKIP_WAITING) and reloads once it has taken over — the plugin
 * helper is only a fallback, because it misses workers that started waiting
 * before it was listening.
 */
export async function applyUpdate(): Promise<void> {
  const reg = (window as unknown as { __ivReg?: ServiceWorkerRegistration }).__ivReg
    ?? (await navigator.serviceWorker?.getRegistration().catch(() => undefined))
  const waiting = reg?.waiting
  if (waiting && navigator.serviceWorker) {
    let done = false
    const go = () => { if (!done) { done = true; location.reload() } }
    navigator.serviceWorker.addEventListener('controllerchange', go, { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(go, 4000)
    return
  }
  const up = (window as unknown as { __ivUpdate?: (reload?: boolean) => Promise<void> }).__ivUpdate
  if (up) await up(true)
  else location.reload()
}
