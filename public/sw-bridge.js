// One-time bridge from the old auto-updating service worker (v1.x) to the
// "ask before updating" worker (2.0+). Phones still running v1.x have no
// Update button, so the FIRST 2.x install activates by itself (exactly how v1
// always updated — workout edits are saved to the device on every tap). After
// that a marker cache exists and every later update waits for "Update now".
let bridging = false
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.has('iv-prompt-mode-v1').then((seen) => {
      if (seen) return
      bridging = true
      return caches.open('iv-prompt-mode-v1').then(() => self.skipWaiting())
    }),
  )
})
// take over the open v1 page so its old updater reloads it onto 2.0 (as v1 always did)
self.addEventListener('activate', (event) => {
  if (bridging) event.waitUntil(self.clients.claim())
})
