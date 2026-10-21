// Free run / walk tracker.
// Timestamp-accurate timer (survives throttled tabs), optional GPS distance via
// watchPosition (haversine between fixes, >30 m/s jumps ignored), screen wake
// lock while live, and a finish sheet that saves a CardioLog.

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flag, LocateFixed, MapPinOff, Pause, Play } from 'lucide-react'
import { Button, Card, ConfirmDialog, Field, Input, Sheet, TextArea } from '@/components/ui'
import { db, getProfile } from '@/db'
import { newId, nowIso, todayStr } from '@/lib/id'
import { metCalories } from '@/lib/nutrition'
import { fmtPace } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import { CARDIO_MET, fmtHMS, haversineKm, KIND_LABEL, useWakeLock, vibrate } from './shared'

type Phase = 'idle' | 'running' | 'paused'
type GpsState = 'off' | 'pending' | 'on' | 'denied'

const COACH: Record<'run' | 'walk', string> = {
  run: 'A pace you could hold a broken conversation at beats a heroic sprint you abandon. Show up, clock the minutes.',
  walk: 'Brisk enough that talking takes a little effort. Zero joint cost, real calorie burn — perfect on rest days.',
}

const MAX_SPEED_MS = 30 // implausible for run/walk — GPS jump, ignore
const MAX_ACCURACY_M = 60 // fixes fuzzier than this don't add distance

export function RunWalkTracker({ kind, onActiveChange }: {
  kind: 'run' | 'walk'
  onActiveChange: (active: boolean) => void
}) {
  const toast = useUI((s) => s.toast)
  const profile = useLiveQuery(() => getProfile(), [])
  const weightKg = profile?.weightKg ?? 98

  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [gps, setGps] = useState<GpsState>('off')
  const [gpsKm, setGpsKm] = useState(0)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  const accumMsRef = useRef(0)
  const resumeAtRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  const watchRef = useRef<number | null>(null)
  const lastFixRef = useRef<{ lat: number; lon: number; t: number } | null>(null)
  const kmRef = useRef(0)

  // finish flow
  const [finish, setFinish] = useState<{ seconds: number; km: number } | null>(null)
  const [distStr, setDistStr] = useState('')
  const [note, setNote] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useWakeLock(phase !== 'idle')
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => {
    onActiveChange(phase !== 'idle' || finish !== null)
  }, [phase, finish, onActiveChange])

  // display ticker
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((accumMsRef.current + (Date.now() - resumeAtRef.current)) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [phase])

  // GPS teardown with the component
  useEffect(() => () => { stopGps() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function stopGps() {
    if (watchRef.current !== null) {
      try { navigator.geolocation?.clearWatch(watchRef.current) } catch { /* noop */ }
      watchRef.current = null
    }
    lastFixRef.current = null
  }

  function startGps() {
    if (!('geolocation' in navigator)) { setGps('off'); return }
    setGps('pending')
    try {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGps('on')
          setAccuracy(Math.round(pos.coords.accuracy))
          if (phaseRef.current !== 'running') { lastFixRef.current = null; return }
          if (pos.coords.accuracy > MAX_ACCURACY_M) return
          const fix = { lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp }
          const last = lastFixRef.current
          if (last && fix.t > last.t) {
            const km = haversineKm(last.lat, last.lon, fix.lat, fix.lon)
            const speedMs = (km * 1000) / ((fix.t - last.t) / 1000)
            if (speedMs <= MAX_SPEED_MS) {
              kmRef.current += km
              setGpsKm(kmRef.current)
            }
          }
          lastFixRef.current = fix
        },
        () => { setGps('denied'); stopGps() },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      )
    } catch { setGps('off') }
  }

  function start() {
    accumMsRef.current = 0
    kmRef.current = 0
    setGpsKm(0)
    setElapsed(0)
    setAccuracy(null)
    resumeAtRef.current = Date.now()
    setPhase('running')
    vibrate(60)
    startGps()
  }

  function pause() {
    accumMsRef.current += Date.now() - resumeAtRef.current
    lastFixRef.current = null // don't count drift across the pause
    setElapsed(Math.floor(accumMsRef.current / 1000))
    setPhase('paused')
    vibrate(40)
  }

  function resume() {
    resumeAtRef.current = Date.now()
    setPhase('running')
    vibrate(40)
  }

  function finishNow() {
    const ms = phase === 'running' ? accumMsRef.current + (Date.now() - resumeAtRef.current) : accumMsRef.current
    const seconds = Math.max(1, Math.round(ms / 1000))
    stopGps()
    setPhase('idle')
    vibrate([80, 60, 80])
    setFinish({ seconds, km: kmRef.current })
    setDistStr(kmRef.current >= 0.05 ? kmRef.current.toFixed(2) : '')
    setNote('')
  }

  function reset() {
    setFinish(null)
    setGps('off')
    setAccuracy(null)
    setElapsed(0)
    setGpsKm(0)
    accumMsRef.current = 0
    kmRef.current = 0
  }

  async function save() {
    if (!finish) return
    const parsed = parseFloat(distStr.replace(',', '.'))
    const distanceKm = isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : undefined
    const calories = metCalories(CARDIO_MET[kind], weightKg, finish.seconds)
    await db.cardioLog.add({
      id: newId(),
      date: todayStr(),
      kind,
      seconds: finish.seconds,
      distanceKm,
      calories,
      avgPaceSecPerKm: distanceKm ? Math.round(finish.seconds / distanceKm) : undefined,
      note: note.trim() || undefined,
      createdAt: nowIso(),
    })
    toast(`${KIND_LABEL[kind]} saved — ${calories} kcal`)
    reset()
  }

  const live = phase !== 'idle'
  const livePace = gpsKm >= 0.05 && elapsed > 0 ? elapsed / gpsKm : undefined
  const liveKcal = metCalories(CARDIO_MET[kind], weightKg, elapsed)

  // finish sheet derived values
  const sheetKm = finish ? parseFloat(distStr.replace(',', '.')) : NaN
  const sheetPace = finish && isFinite(sheetKm) && sheetKm > 0 ? finish.seconds / sheetKm : undefined
  const sheetKcal = finish ? metCalories(CARDIO_MET[kind], weightKg, finish.seconds) : 0

  return (
    <div className="px-4">
      <Card className="mt-3 flex flex-col items-center px-4 pb-5 pt-8">
        <div className={`big-num text-[64px] leading-none ${live ? 'text-ink' : 'text-ink3'}`}>{fmtHMS(elapsed)}</div>
        <div className={`mt-2 text-[11.5px] font-bold uppercase tracking-widest ${phase === 'paused' ? 'text-brand' : 'text-ink3'}`}>
          {phase === 'paused' ? 'Paused' : phase === 'running' ? 'Elapsed' : 'Ready when you are'}
        </div>

        <div className="mt-6 grid w-full grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <div>
            <div className="big-num text-[20px] text-ink">{gps === 'on' ? gpsKm.toFixed(2) : '—'}</div>
            <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">km</div>
          </div>
          <div>
            <div className="big-num text-[20px] text-ink">{livePace ? fmtPace(livePace).replace(' /km', '') : '—'}</div>
            <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">/km</div>
          </div>
          <div>
            <div className="big-num text-[20px] text-brand">{live ? liveKcal : '—'}</div>
            <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">kcal</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 rounded-full bg-surface3 px-3 py-1.5 text-[11.5px] font-medium text-ink2">
          {gps === 'on' ? (
            <><LocateFixed size={13} className="text-emerald-400" /> GPS active{accuracy !== null ? ` · ±${accuracy} m` : ''}</>
          ) : gps === 'pending' ? (
            <><LocateFixed size={13} className="animate-pulse text-brand" /> Locating…</>
          ) : gps === 'denied' ? (
            <><MapPinOff size={13} /> No GPS — add distance when you finish</>
          ) : live ? (
            <><MapPinOff size={13} /> No GPS — add distance when you finish</>
          ) : (
            <><LocateFixed size={13} /> Allow location for live distance & pace (optional)</>
          )}
        </div>

        <div className="mt-5 flex w-full gap-2.5">
          {phase === 'idle' && (
            <Button full onClick={start} className="py-4 text-[16px]">
              <Play size={19} /> Start {KIND_LABEL[kind].toLowerCase()}
            </Button>
          )}
          {phase === 'running' && (
            <>
              <Button variant="secondary" full onClick={pause}><Pause size={17} /> Pause</Button>
              <Button full disabled={elapsed < 5} onClick={finishNow}><Flag size={17} /> Finish</Button>
            </>
          )}
          {phase === 'paused' && (
            <>
              <Button full onClick={resume}><Play size={17} /> Resume</Button>
              <Button variant="outline" full onClick={finishNow}><Flag size={17} /> Finish</Button>
            </>
          )}
        </div>
      </Card>

      {!live && !finish && (
        <Card className="mt-3 p-3.5">
          <p className="text-[13px] leading-relaxed text-ink2">{COACH[kind]}</p>
          <p className="mt-1.5 text-[11.5px] text-ink3">The screen stays awake while tracking (where the browser allows it) and time keeps counting even if it dims.</p>
        </Card>
      )}

      <Sheet open={finish !== null} onClose={() => setConfirmDiscard(true)} title={`${KIND_LABEL[kind]} done`}>
        {finish && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Card className="p-3">
                <div className="big-num text-[20px] text-ink">{fmtHMS(finish.seconds)}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">time</div>
              </Card>
              <Card className="p-3">
                <div className="big-num text-[20px] text-ink">{sheetPace ? fmtPace(sheetPace).replace(' /km', '') : '—'}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">/km</div>
              </Card>
              <Card className="p-3">
                <div className="big-num text-[20px] text-brand">{sheetKcal}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">kcal</div>
              </Card>
            </div>

            <Field
              label="Distance (km)"
              hint={finish.km >= 0.05 ? 'Pre-filled from GPS — adjust if it drifted.' : 'No GPS distance recorded — type it in if you know it, or leave blank.'}
            >
              <Input
                inputMode="decimal"
                placeholder="e.g. 4.2" aria-label="4.2"
                value={distStr}
                onChange={(e) => setDistStr(e.target.value)}
              />
            </Field>

            <Field label="Note (optional)">
              <TextArea rows={2} placeholder="How did it feel?" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <div className="space-y-2 pt-1">
              <Button full onClick={() => void save()}>Save session</Button>
              <Button variant="danger" full onClick={() => setConfirmDiscard(true)}>Discard</Button>
            </div>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => { reset(); toast('Session discarded', 'info') }}
        title="Discard this session?"
        message="Nothing will be saved."
        confirmLabel="Discard"
      />
    </div>
  )
}
