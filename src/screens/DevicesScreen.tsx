// IV-34 — Connected devices centre. Honest status only.
// Web build: Ironverse is a web app on iPhone, so it cannot read Apple Health /
// Apple Watch directly — every row says what works today and how.
// App Store build (23 Oct 2026): it IS a native app, so Apple Health connects for
// real — and through it the Apple Watch, Health-connected smart scales and any
// heart-rate strap paired with the Watch or another fitness app.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Badge, Button, Card, PageHeader, Section, Toggle } from '@/components/ui'
import { db, getSetting, setSetting } from '@/db'
import { isNativeApp } from '@/lib/edition'
import { useUI } from '@/lib/store'
import { dayjs } from '@/lib/fmt'
import { DeviceGuides } from './devices/DeviceGuides'
import { HEALTH_KEYS, connectAppleHealth, disconnectAppleHealth, healthAvailable, healthLog, probeAppleHealth, syncAppleHealth, type HealthToday } from '@/native/health'

type Row = { name: string; status: 'works' | 'manual' | 'not-possible'; what: string; how?: string; to?: string; cta?: string }

export default function DevicesScreen() {
  const navigate = useNavigate()
  const watchCount = useLiveQuery(async () => (await db.workoutLogs.toArray()).filter((l) => l.watch).length, []) ?? 0
  const camera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const native = isNativeApp()
  const rows: Row[] = native ? [
    { name: 'Camera — barcode & health scanner', status: 'works', what: 'Scan food barcodes in Food, and products in the Health scanner.', to: '/food', cta: 'Open Food' },
    { name: 'Apple Watch workout summary (manual)', status: 'manual', what: `Still here if you want to attach a watch screenshot to a lifting session. ${watchCount} workout${watchCount === 1 ? '' : 's'} have one.`, to: '/history', cta: 'Open History' },
    { name: 'Backups', status: 'works', what: 'Full backup file (plain or passphrase-encrypted) plus automatic snapshots on this phone.', to: '/backup', cta: 'Open Backup' },
  ] : [
    { name: 'Apple Watch workout summary', status: 'manual', what: `Type the numbers from your watch’s summary (type, time, calories, heart rate) and attach a screenshot. Linked to that workout. ${watchCount} workout${watchCount === 1 ? '' : 's'} have a watch summary.`, how: 'Finish a workout → “Add watch summary”, or open any past workout from History → Replay.', to: '/history', cta: 'Open History' },
    { name: 'Apple Health / automatic Watch sync', status: 'not-possible', what: 'Apple only lets native App Store apps read Health data. A home-screen web app cannot — so Ironverse does not pretend to sync.', how: 'Would need a native iOS app (paid Apple developer account). Listed in the report as a future option.' },
    { name: 'Camera — barcode scanner', status: camera ? 'works' : 'manual', what: camera ? 'Your phone camera is available for barcode scanning in Food.' : 'This browser did not expose the camera — type the barcode number instead.', to: '/food', cta: 'Open Food' },
    { name: 'Bluetooth heart-rate straps', status: 'not-possible', what: 'Safari on iPhone does not support Web Bluetooth, so straps cannot connect to a web app.' },
    { name: 'Smart scales', status: 'manual', what: 'Enter weigh-ins by hand (Today → weigh-in). The app averages them weekly so one reading never drives decisions.', to: '/', cta: 'Open Today' },
    { name: 'Backups', status: 'works', what: 'Full backup file (plain or passphrase-encrypted) plus automatic snapshots on this phone.', to: '/backup', cta: 'Open Backup' },
  ]
  const tone = { works: 'green', manual: 'brand', 'not-possible': 'gray' } as const
  const label = { works: 'Works now', manual: 'Manual entry', 'not-possible': 'Not possible in a web app' }
  return (
    <div className="pb-8">
      <PageHeader title="Connected devices" back subtitle={native ? 'Apple Watch, WHOOP, Oura, Garmin, smart scales and more — all through Apple Health.' : 'What connects, what you enter by hand, and what an iPhone web app can’t do.'} />
      {native && <AppleHealthSection />}
      {native && <DeviceGuides />}
      <Section title={native ? 'Also on this iPhone' : undefined}>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <Card key={r.name} className="p-3.5 text-[13px]">
              <div className="flex items-start gap-2"><b className="flex-1 text-[14px]">{r.name}</b><Badge tone={tone[r.status]}>{label[r.status]}</Badge></div>
              <div className="mt-1 text-ink2">{r.what}</div>
              {r.how && <div className="mt-1 text-[12px] text-ink3">{r.how}</div>}
              {r.to && <Button small variant="secondary" className="mt-2" onClick={() => navigate(r.to!)}>{r.cta}</Button>}
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}

function AppleHealthSection() {
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)
  const available = useLiveQuery(() => healthAvailable(), [])
  const connected = useLiveQuery(() => getSetting<boolean>(HEALTH_KEYS.connected, false), [])
  const lastSync = useLiveQuery(() => getSetting<string | null>(HEALTH_KEYS.lastSync, null), [])
  const today = useLiveQuery(() => getSetting<HealthToday | null>(HEALTH_KEYS.today, null), [])
  const writeWeight = useLiveQuery(() => getSetting<boolean>(HEALTH_KEYS.writeWeight, false), [])
  const writeWater = useLiveQuery(() => getSetting<boolean>(HEALTH_KEYS.writeWater, false), [])
  const writeFood = useLiveQuery(() => getSetting<boolean>(HEALTH_KEYS.writeFood, false), [])
  const fromHealth = useLiveQuery(async () => ({
    workouts: await db.cardioLog.filter((c) => c.id.startsWith('hk-')).count(),
    weighIns: await db.weighIns.filter((w) => w.id.startsWith('hk-')).count(),
  }), [])

  const [step, setStep] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const log = useLiveQuery(() => healthLog(), [step, failed, showLog]) ?? []

  // v10.1: connect = permission only (never waits on the sync); the first sync runs in the background
  async function connect() {
    if (busy) return
    setBusy(true); setFailed(null); setStep('Asking your iPhone for permission — tap “Turn On All”, then “Allow”.')
    try {
      await connectAppleHealth()
      setStep(null)
      toast('Apple Health connected')
      void sync(14, true)
    } catch (e) {
      setStep(null)
      setFailed((e as Error).message || 'could not connect')
    } finally { setBusy(false) }
  }
  async function sync(days = 14, quiet = false) {
    setStep('Reading steps, workouts, sleep and weight from Apple Health…')
    try {
      const r = await syncAppleHealth(days)
      if (!quiet || r.steps || r.workouts || r.weighIns) toast(`Synced — ${r.steps} days of steps, ${r.weighIns} weigh-in${r.weighIns === 1 ? '' : 's'}, ${r.workouts} workout${r.workouts === 1 ? '' : 's'}`)
    } catch (e) { setFailed((e as Error).message || 'sync failed') } finally { setStep(null) }
  }
  async function checkAgain() {
    setBusy(true); setFailed(null); setStep('Checking Apple Health…')
    const ok = await probeAppleHealth()
    setBusy(false); setStep(null)
    if (ok) { toast('Apple Health connected'); void sync(14, true) } else setFailed('Apple Health did not answer')
  }

  const items: { name: string; what: string }[] = [
    { name: 'Apple Watch', what: 'Runs, walks, rides and other cardio you record on the Watch land in Cardio with time, distance and calories. Active calories and resting heart rate show on Today.' },
    { name: 'Steps', what: 'Your daily steps fill in on Today automatically — no more copying them across.' },
    { name: 'Sleep, HRV & resting heart rate', what: 'Sleep from your Apple Watch (or any sleep app that saves to Health), heart-rate variability and resting heart rate feed the Sleep screen and your daily recovery score.' },
    { name: 'Smart scales', what: 'Withings, Eufy, Renpho, Garmin and other scales that save to Apple Health become weigh-ins here. A weigh-in you typed is never overwritten.' },
    { name: 'Heart-rate straps', what: 'Straps paired with your Apple Watch or a fitness app that saves to Apple Health (Polar, Wahoo, Garmin…) come through the same way.' },
  ]

  return (
    <Section title="Apple Health">
      <Card className="p-4 text-[13px]">
        <div className="flex items-start gap-2">
          <span className="text-[22px]" aria-hidden>❤️</span>
          <div className="flex-1">
            <b className="text-[15px]">Apple Health</b>
            <div className="text-ink3">{available === false ? 'Not available on this device.' : connected ? `Connected${lastSync ? ` · synced ${dayjs(lastSync).format('D MMM, h:mm a')}` : ''}` : 'Not connected yet'}</div>
          </div>
          <Badge tone={connected ? 'green' : 'brand'}>{connected ? 'Connected' : 'Tap Connect'}</Badge>
        </div>
        {connected && today && today.date === dayjs().format('YYYY-MM-DD') && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface3 py-2"><b className="big-num block text-[16px]">{today.steps?.toLocaleString() ?? '—'}</b><span className="text-[11px] text-ink3">steps</span></div>
            <div className="rounded-xl bg-surface3 py-2"><b className="big-num block text-[16px]">{today.activeKcal ?? '—'}</b><span className="text-[11px] text-ink3">active kcal</span></div>
            <div className="rounded-xl bg-surface3 py-2"><b className="big-num block text-[16px]">{today.restingHr ?? '—'}</b><span className="text-[11px] text-ink3">resting bpm</span></div>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          {!connected
            ? <Button full disabled={busy || available === false} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Connect Apple Health'}</Button>
            : <>
                <Button full disabled={busy || !!step} onClick={() => void sync(14)}>{step ? 'Syncing…' : 'Sync now'}</Button>
                <Button variant="secondary" onClick={() => void disconnectAppleHealth().then(() => toast('Apple Health disconnected'))}>Disconnect</Button>
              </>}
        </div>
        {step && <div className="mt-2 rounded-xl bg-surface3 px-3 py-2 text-[12.5px] text-ink2">⏳ {step}</div>}
        {failed && (
          <div className="mt-2 space-y-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-[12.5px]">
            <div><b>Apple Health didn’t finish connecting</b> ({failed}).</div>
            <div className="text-ink2">If no permission sheet appeared: open the <b>Health</b> app → tap your picture (top right) → <b>Apps</b> (or Privacy → Apps) → <b>Ironverse</b> → <b>Turn On All</b>. Then come back and tap <b>Check again</b>.</div>
            <div className="flex gap-2">
              <Button small onClick={() => void checkAgain()}>Check again</Button>
              <Button small variant="secondary" onClick={() => { window.location.href = 'x-apple-health://' }}>Open Health app</Button>
            </div>
          </div>
        )}
        {!connected && !failed && !step && <div className="mt-2 text-[12px] text-ink3">Already allowed Ironverse in the Health app? <button type="button" className="font-semibold text-brand" onClick={() => void checkAgain()}>Check again</button></div>}
        <button type="button" className="mt-2 text-[11.5px] text-ink3 underline" onClick={() => setShowLog((v) => !v)}>{showLog ? 'Hide' : 'Show'} connection log</button>
        {showLog && <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 text-[10.5px] leading-snug text-ink2">{log.length ? log.join(String.fromCharCode(10)) : 'Nothing logged yet.'}</pre>}
        {connected && (
          <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
            <div className="flex-1"><div className="font-semibold">Save weigh-ins to Apple Health</div><div className="text-[12px] text-ink3">Weigh-ins you log in Ironverse also go to Health.</div></div>
            <Toggle checked={!!writeWeight} label="Save weigh-ins to Apple Health" onChange={(v) => void setSetting(HEALTH_KEYS.writeWeight, v)} />
          </div>
        )}
        {connected && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1"><div className="font-semibold">Save water to Apple Health</div><div className="text-[12px] text-ink3">Each drink you log counts in Health’s water total.</div></div>
            <Toggle checked={!!writeWater} label="Save water to Apple Health" onChange={(v) => void setSetting(HEALTH_KEYS.writeWater, v)} />
          </div>
        )}
        {connected && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1"><div className="font-semibold">Save calories eaten to Apple Health</div><div className="text-[12px] text-ink3">Food energy from what you log (Health’s Nutrition section).</div></div>
            <Toggle checked={!!writeFood} label="Save calories eaten to Apple Health" onChange={(v) => void setSetting(HEALTH_KEYS.writeFood, v)} />
          </div>
        )}
        {connected && fromHealth && <div className="mt-2 text-[12px] text-ink3">From Apple Health so far: {fromHealth.workouts} cardio workout{fromHealth.workouts === 1 ? '' : 's'}, {fromHealth.weighIns} weigh-in{fromHealth.weighIns === 1 ? '' : 's'}.</div>}
        <div className="mt-2 text-[11.5px] text-ink3">Health data stays on your iPhone — it is never uploaded. Change what Ironverse can read any time in the Settings app → Health → Data Access & Devices → Ironverse.</div>
      </Card>
      <div className="mt-2.5 space-y-2">
        {items.map((r) => (
          <Card key={r.name} className="p-3.5 text-[13px]">
            <div className="flex items-start gap-2"><b className="flex-1 text-[14px]">{r.name}</b><Badge tone={connected ? 'green' : 'gray'}>{connected ? 'Via Apple Health' : 'Connect Apple Health'}</Badge></div>
            <div className="mt-1 text-ink2">{r.what}</div>
          </Card>
        ))}
      </div>
    </Section>
  )
}
