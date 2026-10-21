import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { backupBeforeUpgrade } from './lib/migrate'

// Updates wait for his OK (UpdatePrompt) — no reload in the middle of a set.
// Everything he types is saved to IndexedDB as he goes, so accepting is safe.
const updateSW = registerSW({
  immediate: true,
  // remember it too: when an update is already waiting at launch this fires BEFORE the UI mounts
  onNeedRefresh() { (window as unknown as { __ivNeedRefresh?: boolean }).__ivNeedRefresh = true; window.dispatchEvent(new CustomEvent('iv:update-ready')) },
  onRegisteredSW(_url, reg) {
    if (!reg) return
    ;(window as unknown as { __ivReg?: ServiceWorkerRegistration }).__ivReg = reg
    // look for a new build every hour and whenever the app comes back to the foreground
    setInterval(() => { void reg.update().catch(() => undefined) }, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update().catch(() => undefined) })
  },
})
;(window as unknown as { __ivUpdate?: (reload?: boolean) => Promise<void> }).__ivUpdate = updateSW

// Copy the whole database aside BEFORE Dexie opens it at a newer schema version.
// A failure here never blocks the app — it just means no extra copy was made.
void backupBeforeUpgrade()
  .catch((e) => console.warn('pre-upgrade backup skipped', e))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
