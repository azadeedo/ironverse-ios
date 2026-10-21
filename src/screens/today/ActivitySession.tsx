// Start one of the "Move today" activities: pick how long and how hard, then a live timer
// counts minutes and calories (MET × your weight × time). Finishing saves it as exercise done
// today, so it counts against "Move today" straight away.
import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { Button, Sheet } from '@/components/ui'
import { db } from '@/db'
import type { Activity } from '@/lib/goalCoach'
import { metCalories } from '@/lib/nutrition'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { useWakeLock } from '@/screens/cardio/shared'

const LEVELS = [
  { key: 'easy', label: 'Easy', mult: 0.8, hint: 'can chat the whole time' },
  { key: 'normal', label: 'Normal', mult: 1, hint: 'a bit puffed, can still talk' },
  { key: 'hard', label: 'Hard', mult: 1.25, hint: 'short sentences only' },
] as const

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function ActivitySession({ activity, weightKg, suggestMin, onClose }: { activity: Activity; weightKg: number; suggestMin: number; onClose: () => void }) {
  const toast = useUI((s) => s.toast)
  const [mins, setMins] = useState(Math.max(5, Math.min(90, suggestMin)))
  const [level, setLevel] = useState<(typeof LEVELS)[number]['key']>('normal')
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const since = useRef<number | null>(null)
  const base = useRef(0)
  useWakeLock(running)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => { if (since.current) setElapsed(base.current + (Date.now() - since.current) / 1000) }, 500)
    return () => window.clearInterval(id)
  }, [running])

  const met = activity.met * (LEVELS.find((l) => l.key === level)?.mult ?? 1)
  const kcalFor = (sec: number) => metCalories(met, weightKg, sec)
  const target = mins * 60
  const pct = Math.min(100, (elapsed / target) * 100)

  function start() { since.current = Date.now(); setRunning(true); setStarted(true) }
  function pause() { if (since.current) base.current += (Date.now() - since.current) / 1000; since.current = null; setElapsed(base.current); setRunning(false) }
  async function finish() {
    if (running) pause()
    const sec = Math.round(base.current + (since.current ? (Date.now() - since.current) / 1000 : 0))
    if (sec < 30) { onClose(); return }
    await db.cardioLog.add({ id: newId(), date: todayStr(), kind: activity.kind, seconds: sec, calories: kcalFor(sec), note: `${activity.label} (${level})`, createdAt: nowIso() })
    toast(`${activity.label}: ${fmt(sec)} · ${kcalFor(sec)} kcal saved`)
    onClose()
  }

  return (
    <Sheet open onClose={() => (started ? undefined : onClose())} title={activity.label + (activity.together ? ' 👫' : '')}>
      <p className="text-[12.5px] text-ink2">{activity.detail}</p>
      {!started ? (
        <>
          <div className="mt-3 text-[12.5px] font-semibold text-ink2">How long</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[...new Set([10, 20, 30, 45, 60, Math.max(5, Math.min(90, suggestMin))])].sort((a, b) => a - b).map((m) => (
              <button key={m} type="button" onClick={() => setMins(m)} className={`pressable rounded-xl px-3 py-2 text-[13px] font-semibold ${mins === m ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>
                {m} min<span className="block text-[11px] font-normal opacity-80">{metCalories(met, weightKg, m * 60)} kcal</span>
              </button>
            ))}
          </div>
          <div className="mt-3 text-[12.5px] font-semibold text-ink2">How hard</div>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button key={l.key} type="button" onClick={() => setLevel(l.key)} className={`pressable rounded-xl px-2 py-2 text-[13px] font-semibold ${level === l.key ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>
                {l.label}<span className="block text-[10.5px] font-normal opacity-80">{l.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[14px]">{mins} min {level} ≈ <b className="text-brand">{kcalFor(target)} kcal</b></p>
          <Button full className="mt-3" onClick={start}><Play size={16} /> Start</Button>
          <p className="mt-2 text-[11px] text-ink3">Estimate from the activity’s MET value and your {weightKg} kg. If your watch shows a different number, edit it later in Cardio.</p>
        </>
      ) : (
        <>
          <div className="mt-4 text-center">
            <div className="big-num text-[46px] leading-none text-ink">{fmt(elapsed)}</div>
            <div className="mt-1 text-[13px] text-ink2">of {mins} min · <b className="text-brand">{kcalFor(elapsed)} kcal</b> burned</div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface3"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
          {elapsed >= target && <p className="mt-2 text-center text-[13px] font-semibold text-good">✓ Target reached — finish, or keep going for extra.</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {running ? <Button variant="secondary" onClick={pause}><Pause size={16} /> Pause</Button> : <Button variant="secondary" onClick={start}><Play size={16} /> Resume</Button>}
            <Button onClick={() => void finish()}><Square size={16} /> Finish & save</Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink3">The screen stays on while it runs. Time keeps counting correctly even if the phone locks.</p>
        </>
      )}
    </Sheet>
  )
}
