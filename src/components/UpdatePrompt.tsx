// Non-destructive "Update available" prompt + the App Version card.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { applyUpdate, BUILD, checkForUpdates, RELEASED, VERSION, type UpdateCheck } from '@/lib/version'


/** ' · updated 21 Oct 2026' from the build's release date ('' if unknown) */
function relDate(): string {
  const d = new Date(RELEASED)
  return isNaN(d.getTime()) ? '' : ` · updated ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function UpdatePrompt() {
  const [ready, setReady] = useState(() => !!(window as unknown as { __ivNeedRefresh?: boolean }).__ivNeedRefresh)
  const [later, setLater] = useState(false)
  useEffect(() => {
    if ((window as unknown as { __ivNeedRefresh?: boolean }).__ivNeedRefresh) setReady(true)
    const on = () => { setReady(true); setLater(false) }
    window.addEventListener('iv:update-ready', on)
    return () => window.removeEventListener('iv:update-ready', on)
  }, [])
  if (!ready || later) return null
  return (
    <div role="status" className="fixed inset-x-3 z-[60] rounded-2xl border border-brand/40 bg-surface2/95 p-3 shadow-2xl backdrop-blur-xl" style={{ top: 'calc(var(--sat, 0px) + 8px)' }}>
      <div className="flex items-start gap-2.5">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1 text-[13px]">
          <b>Update available.</b> Your workouts and logs are saved as you go, so updating will not lose anything.
          <div className="mt-2 flex gap-2">
            <Button small onClick={() => void applyUpdate()}>Update now</Button>
            <Button small variant="secondary" onClick={() => setLater(true)}>Later</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppVersionCard() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<UpdateCheck | null>(null)
  return (
    <Card className="space-y-2 p-4 text-[13px]">
      <div className="flex items-baseline justify-between"><b className="text-[15px]">App version</b><span className="big-num text-brand">v{VERSION}</span></div>
      <div className="text-[12px] text-ink3">Build {BUILD} · released {new Date(RELEASED).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      <div className="flex gap-2">
        <Button small variant="secondary" disabled={busy} onClick={() => { setBusy(true); void checkForUpdates().then(setRes).finally(() => setBusy(false)) }}><RefreshCw size={14} /> {busy ? 'Checking…' : 'Check for updates'}</Button>
        <Button small variant="ghost" onClick={() => navigate('/whats-new')}>What’s new</Button>
      </div>
      {res?.state === 'current' && <div className="text-emerald-300">You have the latest version (v{res.live.version}).</div>}
      {res?.state === 'available' && <div className="space-y-1.5 text-amber-200"><div>v{res.live.version} is live (build {res.live.build}). It is downloading — tap Update now when the banner appears, or close and reopen the app.</div><Button small onClick={() => void applyUpdate()}>Update now</Button></div>}
      {res?.state === 'offline' && <div className="text-ink3">Couldn’t reach the server — you may be offline. Everything still works offline.</div>}
      <div className="text-[11px] text-ink3">Updates never require deleting the Home Screen icon. Accept the prompt, or fully close the app and reopen it.</div>
    </Card>
  )
}

// ---------- launch status pill (shown every time the app opens) ----------
const LAST_KEY = 'iv-last-build'
async function updateNow(setMsg: (m: string) => void) {
  const reg = (window as unknown as { __ivReg?: ServiceWorkerRegistration }).__ivReg ?? (await navigator.serviceWorker?.getRegistration().catch(() => undefined))
  setMsg('Downloading the update…')
  try {
    if (reg && !reg.waiting) {
      if (!reg.installing) await reg.update()
      // the new version downloads all its files first — on mobile data this can take a while
      for (let i = 0; i < 240 && !reg.waiting; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (i === 20) setMsg('Still downloading — keep the app open…')
        if (!reg.installing && !reg.waiting && i > 6) { try { await reg.update() } catch { /* offline */ } }
      }
    }
  } catch { /* fall through */ }
  if (reg && !reg.waiting) { setMsg('Could not finish the download — it will finish next time you open the app'); return }
  setMsg('Installing…')
  await applyUpdate()
}
export function LaunchStatus() {
  const [state, setState] = useState<{ kind: 'ok' | 'new' | 'updated' | 'offline'; text: string } | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let last: string | null = null
    try { last = localStorage.getItem(LAST_KEY); localStorage.setItem(LAST_KEY, BUILD) } catch { /* private mode */ }
    const t = window.setTimeout(() => {
      void checkForUpdates().then((r) => {
        if (r.state === 'available') { if (!(window as unknown as { __ivNeedRefresh?: boolean }).__ivNeedRefresh) setState({ kind: 'new', text: `Update ready · v${r.live.version}` }) }
        else if (last && last !== BUILD) setState({ kind: 'updated', text: `Updated to v${VERSION}${relDate()} — your data is unchanged` })
        else if (r.state === 'current') setState({ kind: 'ok', text: `Up to date · v${VERSION}${relDate()}` })
        else setState({ kind: 'offline', text: `Offline — using the saved copy (v${VERSION})` })
      })
    }, 1200)
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!state || state.kind === 'new') return
    const t = window.setTimeout(() => setState(null), state.kind === 'ok' ? 3000 : 4500)
    return () => window.clearTimeout(t)
  }, [state])
  if (!state) return null
  const tone = state.kind === 'new' ? 'bg-amber-900/95 border-amber-400/40' : state.kind === 'offline' ? 'bg-surface2/95 border-line' : 'bg-emerald-950/95 border-emerald-400/30'
  return (
    <div role="status" className={`fixed left-1/2 z-[70] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold text-white shadow-xl ${tone}`} style={{ top: 'calc(var(--sat, 0px) + 10px)' }}>
      <span>{state.kind === 'new' ? '⬆' : state.kind === 'offline' ? '⚠' : '✓'} {msg || state.text}</span>
      {state.kind === 'new' && !msg && <button type="button" onClick={() => void updateNow(setMsg)} className="rounded-full bg-brand px-3 py-1 text-[12.5px] font-extrabold text-black">Update now</button>}
    </div>
  )
}
