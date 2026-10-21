// Jump rope interval timer: configurable rounds / work / rest with steppers,
// timestamp-driven countdown (WORK amber / REST dim), vibration + notification
// on every switch, pause/stop, finish sheet -> CardioLog (seconds = work time).

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pause, Play, Square } from 'lucide-react'
import { Button, Card, ConfirmDialog, Field, Sheet, TextArea } from '@/components/ui'
import { ProgressRing } from '@/components/charts'
import { db, getProfile, getSetting, setSetting } from '@/db'
import { newId, nowIso, todayStr } from '@/lib/id'
import { metCalories } from '@/lib/nutrition'
import { ensurePermission, showNotification } from '@/lib/notify'
import { useUI } from '@/lib/store'
import { CARDIO_MET, fmtHMS, Stepper, useWakeLock, vibrate } from './shared'

type Phase = 'idle' | 'ready' | 'work' | 'rest'
interface Cfg { rounds: number; work: number; rest: number }

const DEFAULT_CFG: Cfg = { rounds: 10, work: 60, rest: 30 }
const CFG_KEY = 'cardio:jumpRopeCfg'
const READY_SEC = 3
const NOTIFY_TAG = 'jump-rope'

export function JumpRopeTimer({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const toast = useUI((s) => s.toast)
  const profile = useLiveQuery(() => getProfile(), [])
  const weightKg = profile?.weightKg ?? 98

  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG)
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState(0)
  const [paused, setPaused] = useState(false)
  const [remaining, setRemaining] = useState(0)

  const endsAtRef = useRef(0)
  const pausedLeftRef = useRef(0)
  const workDoneRef = useRef(0)   // completed work seconds
  const roundsDoneRef = useRef(0) // fully completed work rounds

  const [finish, setFinish] = useState<{ rounds: number; seconds: number } | null>(null)
  const [note, setNote] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const live = phase !== 'idle'
  useWakeLock(live)
  useEffect(() => { onActiveChange(live || finish !== null) }, [live, finish, onActiveChange])

  // remember the last-used config
  useEffect(() => {
    void getSetting<Cfg | null>(CFG_KEY, null).then((v) => { if (v) setCfg(v) })
  }, [])
  function patchCfg(p: Partial<Cfg>) {
    setCfg((prev) => {
      const next = { ...prev, ...p }
      void setSetting(CFG_KEY, next)
      return next
    })
  }

  function advance() {
    if (phase === 'ready') {
      endsAtRef.current = Date.now() + cfg.work * 1000
      setPhase('work')
      setRound(1)
      vibrate([150, 80, 150])
      void showNotification('Jump rope', `Round 1 of ${cfg.rounds} — GO`, NOTIFY_TAG)
    } else if (phase === 'work') {
      workDoneRef.current += cfg.work
      roundsDoneRef.current += 1
      if (round >= cfg.rounds) {
        completeAll()
        return
      }
      endsAtRef.current = Date.now() + cfg.rest * 1000
      setPhase('rest')
      vibrate(250)
      void showNotification('Jump rope', `Rest ${cfg.rest}s — round ${round + 1} of ${cfg.rounds} next`, NOTIFY_TAG)
    } else if (phase === 'rest') {
      endsAtRef.current = Date.now() + cfg.work * 1000
      setPhase('work')
      setRound((r) => r + 1)
      vibrate([150, 80, 150])
      void showNotification('Jump rope', `Round ${round + 1} of ${cfg.rounds} — GO`, NOTIFY_TAG)
    }
  }

  function completeAll() {
    vibrate([220, 90, 220, 90, 320])
    void showNotification('Jump rope complete', `${roundsDoneRef.current} rounds in the bank. Strong work.`, NOTIFY_TAG)
    setPhase('idle')
    setPaused(false)
    setFinish({ rounds: roundsDoneRef.current, seconds: workDoneRef.current })
    setNote('')
  }

  // countdown ticker (timestamp-based, immune to interval drift)
  useEffect(() => {
    if (!live || paused) return
    const tick = () => {
      const leftMs = endsAtRef.current - Date.now()
      if (leftMs <= 0) advance()
      else setRemaining(Math.ceil(leftMs / 1000))
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [live, paused, phase, round]) // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    void ensurePermission() // ask during the tap so switch alerts can be real notifications
    workDoneRef.current = 0
    roundsDoneRef.current = 0
    setRound(0)
    endsAtRef.current = Date.now() + READY_SEC * 1000
    setRemaining(READY_SEC)
    setPaused(false)
    setPhase('ready')
    vibrate(60)
  }

  function pause() {
    pausedLeftRef.current = Math.max(0, endsAtRef.current - Date.now())
    setPaused(true)
    vibrate(40)
  }

  function resume() {
    endsAtRef.current = Date.now() + pausedLeftRef.current
    setPaused(false)
    vibrate(40)
  }

  function stopEarly() {
    const leftMs = paused ? pausedLeftRef.current : Math.max(0, endsAtRef.current - Date.now())
    let workDone = workDoneRef.current
    if (phase === 'work') workDone += Math.max(0, cfg.work - Math.ceil(leftMs / 1000))
    setPhase('idle')
    setPaused(false)
    if (workDone < 10) {
      toast('Too short to save — session discarded', 'info')
      return
    }
    setFinish({ rounds: roundsDoneRef.current, seconds: workDone })
    setNote('')
  }

  async function save() {
    if (!finish) return
    const calories = metCalories(CARDIO_MET['jump-rope'], weightKg, finish.seconds)
    await db.cardioLog.add({
      id: newId(),
      date: todayStr(),
      kind: 'jump-rope',
      seconds: finish.seconds,
      rounds: finish.rounds,
      calories,
      note: note.trim() || undefined,
      createdAt: nowIso(),
    })
    toast(`Jump rope saved — ${calories} kcal`)
    setFinish(null)
  }

  const totalSec = cfg.rounds * cfg.work + Math.max(0, cfg.rounds - 1) * cfg.rest
  const estKcal = metCalories(CARDIO_MET['jump-rope'], weightKg, cfg.rounds * cfg.work)
  const phaseTotal = phase === 'work' ? cfg.work : phase === 'rest' ? cfg.rest : READY_SEC
  const sheetKcal = finish ? metCalories(CARDIO_MET['jump-rope'], weightKg, finish.seconds) : 0

  return (
    <div className="px-4">
      {!live && (
        <>
          <Card className="mt-3 p-4">
            <div className="space-y-1">
              {([
                { label: 'Rounds', key: 'rounds' as const, min: 1, max: 30, step: 1, fmt: (v: number) => String(v) },
                { label: 'Work', key: 'work' as const, min: 10, max: 300, step: 5, fmt: (v: number) => `${v}s` },
                { label: 'Rest', key: 'rest' as const, min: 5, max: 180, step: 5, fmt: (v: number) => `${v}s` },
              ]).map((row) => (
                <div key={row.key} className="flex items-center justify-between py-1.5">
                  <div className="text-[15px] font-medium text-ink">{row.label}</div>
                  <Stepper
                    value={cfg[row.key]}
                    min={row.min}
                    max={row.max}
                    step={row.step}
                    format={row.fmt}
                    onChange={(v) => patchCfg({ [row.key]: v })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px] text-ink2">
              <span>Total ~{fmtHMS(totalSec)}</span>
              <span className="font-semibold text-brand">~{estKcal} kcal</span>
            </div>
          </Card>

          <Button full onClick={start} className="mt-3 py-4 text-[16px]">
            <Play size={19} /> Start intervals
          </Button>

          {!finish && (
            <Card className="mt-3 p-3.5">
              <p className="text-[13px] leading-relaxed text-ink2">
                You'll get a buzz and an alert at every switch — no need to watch the screen. Shorter rest keeps the heart rate high; longer work rounds build endurance.
              </p>
            </Card>
          )}
        </>
      )}

      {live && (
        <Card className={`mt-3 flex flex-col items-center px-4 pb-5 pt-6 transition-colors ${phase === 'work' ? 'ring-1 ring-brand/40' : ''}`}>
          <div className="text-[13px] font-bold uppercase tracking-widest text-ink2">
            {phase === 'ready'
              ? 'Starting'
              : phase === 'work'
                ? `Round ${round} of ${cfg.rounds}`
                : `Next: round ${round + 1} of ${cfg.rounds}`}
          </div>

          <div className="relative mt-4 inline-flex items-center justify-center">
            <ProgressRing
              value={remaining}
              target={phaseTotal}
              size={250}
              stroke={13}
              accent={phase === 'work' ? '#fbbf24' : phase === 'rest' ? 'var(--ink3)' : '#34d399'}
              label=""
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className={`big-num text-[76px] leading-none ${paused ? 'text-ink3' : 'text-ink'}`}>{remaining}</div>
              <div className={`shout mt-1.5 text-[18px] ${
                paused ? 'text-ink3' : phase === 'work' ? 'text-brand' : phase === 'rest' ? 'text-ink3' : 'text-emerald-400'
              }`}>
                {paused ? 'Paused' : phase === 'ready' ? 'Get ready' : phase}
              </div>
            </div>
          </div>

          {/* round progress dots */}
          <div className="mt-4 flex max-w-full flex-wrap justify-center gap-1.5 px-2">
            {Array.from({ length: cfg.rounds }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-4 rounded-full ${
                  i < roundsDoneRef.current ? 'bg-brand' : i === round - 1 && phase === 'work' ? 'bg-brand/45' : 'bg-surface3'
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex w-full gap-2.5">
            {paused ? (
              <Button full onClick={resume}><Play size={17} /> Resume</Button>
            ) : (
              <Button variant="secondary" full onClick={pause}><Pause size={17} /> Pause</Button>
            )}
            <Button variant="danger" full onClick={() => setConfirmStop(true)}><Square size={16} /> Stop</Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        onConfirm={stopEarly}
        title="End the session?"
        message="You'll keep the rounds and work time completed so far."
        confirmLabel="End session"
        danger={false}
      />

      <Sheet open={finish !== null} onClose={() => setConfirmDiscard(true)} title="Jump rope done">
        {finish && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Card className="p-3">
                <div className="big-num text-[20px] text-ink">{finish.rounds}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">rounds</div>
              </Card>
              <Card className="p-3">
                <div className="big-num text-[20px] text-ink">{fmtHMS(finish.seconds)}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">work</div>
              </Card>
              <Card className="p-3">
                <div className="big-num text-[20px] text-brand">{sheetKcal}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink3">kcal</div>
              </Card>
            </div>

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
        onConfirm={() => { setFinish(null); toast('Session discarded', 'info') }}
        title="Discard this session?"
        message="Nothing will be saved."
        confirmLabel="Discard"
      />
    </div>
  )
}
