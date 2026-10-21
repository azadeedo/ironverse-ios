// 10 km treadmill run: a speed guide before you start, then log the total time (or each km).
// It works out pace per km, average speed and calories, keeps your best, and shows the trend.
// On a program day it offers to move that day's workout to a day off.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Flame, Gauge, Medal, Timer, TrendingDown } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { LineChart } from '@/components/charts'
import { db, getProfile } from '@/db'
import type { CardioLog } from '@/db/types'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { dayIdFor, programDayOn } from '@/lib/program12'
import { freeDays, getProgramPlan, moveMissed, skipProgramDay } from '@/lib/programStore'
import {
  RUN_DISTANCE_KM, bestTenK, fmtTime, nextTargets, paceSec, parseTime, runKcal, speedForPace, speedKmh, splitInfo, tenKRuns, tenKTime,
} from '@/lib/treadmillRun'

export function TreadmillRun() {
  const toast = useUI((s) => s.toast)
  const today = todayStr()
  const profile = useLiveQuery(() => getProfile(), [])
  const runs = useLiveQuery(() => db.cardioLog.toArray(), [])
  const plan = useLiveQuery(() => getProgramPlan(), [])
  const todayLogs = useLiveQuery(() => db.workoutLogs.where('date').equals(today).toArray(), [today])

  const [km, setKm] = useState(String(RUN_DISTANCE_KM))
  const [total, setTotal] = useState('')
  const [incline, setIncline] = useState('1')
  const [useSplits, setUseSplits] = useState(false)
  const [splits, setSplits] = useState<string[]>(Array(10).fill(''))
  const [goal, setGoal] = useState('')
  const [pace, setPace] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const [devKcal, setDevKcal] = useState('')
  const [cadence, setCadence] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState<CardioLog | null>(null)
  const [handled, setHandled] = useState(false)

  const weight = profile?.weightKg ?? 0
  const dist = Math.max(0, parseFloat(km) || 0)
  const inc = Math.max(0, Math.min(15, parseFloat(incline) || 0))
  const splitSecs = splits.map((s) => parseTime(s) ?? 0)
  const splitTotal = splitSecs.reduce((a, b) => a + b, 0)
  // time from: each km, or the total, or (if only the pace is entered) pace × distance
  const paceIn = parseTime(pace) ?? 0
  const secs = useSplits ? splitTotal : (parseTime(total) ?? (paceIn && dist ? Math.round(paceIn * dist) : 0))
  const num = (v: string) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? Math.round(n) : undefined }
  const est = runKcal(dist, secs, weight, inc)
  const kcalShown = num(devKcal) ?? est
  const ready = dist > 0 && secs > 0

  const list = useMemo(() => (runs ? tenKRuns(runs) : []), [runs])
  const best = useMemo(() => (runs ? bestTenK(runs) : null), [runs])
  const last = list[list.length - 1]
  const goalSec = parseTime(goal) ?? (best ? tenKTime(best) - 60 : 3600)

  // today's program workout (only if not done yet)
  const progToday = plan ? programDayOn(plan, today) : null
  const progTitle = plan && progToday ? plan.weeks[progToday.week - 1]?.days.find((d) => d.id === dayIdFor(progToday.week, progToday.dk))?.title : undefined
  const liftedToday = !!todayLogs?.some((l) => l.finishedAt && plan && l.planId === plan.id)
  const offerMove = !!(plan && progToday && !progToday.movedFrom && !liftedToday && !handled)

  async function save() {
    if (!ready || !weight) { toast(weight ? 'Enter your time' : 'Add your weight first (Progress)', 'error'); return }
    const log: CardioLog = {
      id: newId(), date: today, kind: 'run', seconds: secs, distanceKm: Math.round(dist * 100) / 100,
      avgPaceSecPerKm: Math.round(paceSec(secs, dist)), speedKmh: Math.round(speedKmh(secs, dist) * 10) / 10, inclinePct: inc,
      calories: kcalShown, estKcal: est, treadmill: true, note: note.trim() || 'Treadmill run',
      ...(num(devKcal) ? { deviceKcal: num(devKcal) } : {}), ...(num(avgHr) ? { avgHr: num(avgHr) } : {}), ...(num(maxHr) ? { maxHr: num(maxHr) } : {}), ...(num(cadence) ? { cadence: num(cadence) } : {}),
      ...(useSplits ? { splitsSec: splitSecs.filter((x) => x > 0) } : {}), createdAt: nowIso(),
    }
    await db.cardioLog.add(log)
    setSaved(log)
    toast(`Run saved — ${fmtTime(secs)} · ${fmtTime(paceSec(secs, dist))}/km`)
  }

  if (!runs || profile === undefined) return null
  const prevBest = saved && best && best.id !== saved.id ? best : saved ? bestTenK(runs.filter((r) => r.id !== saved.id)) : null
  const isPB = !!(saved && dist >= RUN_DISTANCE_KM - 0.01 && (!prevBest || tenKTime(saved) < tenKTime(prevBest)))
  const info = saved?.splitsSec ? splitInfo(saved.splitsSec) : null
  const series = list.slice(-12).map((l) => ({ x: dayjs(l.date).format('D/M'), y: Math.round((tenKTime(l) / 60) * 10) / 10 }))

  return (
    <div className="space-y-3 px-4 pb-8 pt-2">
      {/* best / last / count */}
      <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-xl bg-surface2 p-2.5"><div className="text-ink3">Best 10 km</div><b className="big-num text-[17px] text-brand">{best ? fmtTime(tenKTime(best)) : '—'}</b></div>
        <div className="rounded-xl bg-surface2 p-2.5"><div className="text-ink3">Last</div><b className="big-num text-[17px]">{last ? fmtTime(tenKTime(last)) : '—'}</b></div>
        <div className="rounded-xl bg-surface2 p-2.5"><div className="text-ink3">Runs</div><b className="big-num text-[17px]">{list.length}</b></div>
      </div>

      {saved ? (
        <Card className="p-4">
          <div className="flex items-center gap-2">{isPB ? <Medal size={18} className="text-brand" /> : <Timer size={18} className="text-brand" />}
            <span className="text-[16px] font-bold">{isPB ? (prevBest ? 'New personal best!' : 'First 10 km logged — that’s your benchmark') : 'Run logged'}</span></div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-surface3 p-2.5"><div className="text-ink3">Time</div><b className="big-num text-[18px]">{fmtTime(saved.seconds)}</b></div>
            <div className="rounded-xl bg-surface3 p-2.5"><div className="text-ink3">Pace</div><b className="big-num text-[18px]">{fmtTime(saved.avgPaceSecPerKm ?? 0)}/km</b></div>
            <div className="rounded-xl bg-surface3 p-2.5"><div className="text-ink3">Avg speed</div><b className="big-num text-[18px]">{saved.speedKmh} km/h</b></div>
            <div className="rounded-xl bg-surface3 p-2.5"><div className="text-ink3">Calories</div><b className="big-num text-[18px]">{saved.calories} kcal</b></div>
          </div>
          {(saved.avgHr || saved.maxHr || saved.cadence) && (
            <p className="mt-2 text-[12.5px] text-ink2">{[saved.avgHr ? `Avg HR ${saved.avgHr}` : '', saved.maxHr ? `max ${saved.maxHr} bpm` : '', saved.cadence ? `cadence ${saved.cadence} spm` : '', saved.deviceKcal && saved.estKcal ? `(app estimate ${saved.estKcal} kcal)` : ''].filter(Boolean).join(' · ')}</p>
          )}
          {prevBest && dist >= RUN_DISTANCE_KM - 0.01 && (
            <p className="mt-2 text-[12.5px] text-ink2">{isPB ? `${fmtTime(tenKTime(prevBest) - tenKTime(saved))} faster than your old best (${fmtTime(tenKTime(prevBest))}).` : `${fmtTime(tenKTime(saved) - tenKTime(prevBest))} off your best (${fmtTime(tenKTime(prevBest))}). Keep going.`}</p>
          )}
          {info && (
            <p className="mt-1.5 text-[12.5px] text-ink2">Fastest km: #{info.fastestKm} ({fmtTime(info.fastest)}) · slowest: #{info.slowestKm} ({fmtTime(info.slowest)}). {info.negative ? 'Second half faster — great pacing.' : info.spread > 30 ? 'You faded — start a little slower next time.' : 'Nice even pacing.'}</p>
          )}
          <Button full variant="secondary" className="mt-3" onClick={() => { setSaved(null); setTotal(''); setPace(''); setAvgHr(''); setMaxHr(''); setDevKcal(''); setCadence(''); setNote(''); setSplits(Array(10).fill('')) }}>Log another run</Button>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-2"><Gauge size={16} className="text-brand" /><span className="text-[15px] font-semibold">Before you start — speed to set</span></div>
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              <span className="text-ink2">Target 10 km time</span>
              <Input className="w-28" inputMode="decimal" placeholder={fmtTime(goalSec).replace(/:/g, '.')} value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Target time" />
            </div>
            <p className="mt-2 text-[14px]">Set the treadmill to <b className="text-brand">{speedForPace(goalSec / RUN_DISTANCE_KM).toFixed(1)} km/h</b> = <b>{fmtTime(goalSec / RUN_DISTANCE_KM)}/km</b> at {inc}% incline.</p>
            {best && <div className="mt-2 flex flex-wrap gap-1.5">{nextTargets(tenKTime(best)).map((t) => (
              <button key={t.label} type="button" className="pressable rounded-full bg-surface3 px-3 py-1 text-[12px] font-semibold text-ink2" onClick={() => setGoal(fmtTime(t.sec))}>{t.label} · {fmtTime(t.sec)}</button>))}</div>}
            <p className="mt-2 text-[11.5px] text-ink3">Tip: 1% incline makes the treadmill feel closer to running outside. Start the first 2 km 0.3–0.5 km/h slower, then settle into the target.</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2"><Timer size={16} className="text-brand" /><span className="text-[15px] font-semibold">Log your run</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
              <label className="flex flex-col gap-1 text-ink3">Distance (km)<Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-ink3">Incline (%)<Input inputMode="decimal" value={incline} onChange={(e) => setIncline(e.target.value)} /></label>
            </div>
            <div className="mt-3 flex gap-1.5">
              <button type="button" onClick={() => setUseSplits(false)} className={`pressable flex-1 rounded-xl py-2 text-[13px] font-semibold ${!useSplits ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>Total time</button>
              <button type="button" onClick={() => setUseSplits(true)} className={`pressable flex-1 rounded-xl py-2 text-[13px] font-semibold ${useSplits ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>Each km</button>
            </div>
            {!useSplits ? (<>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
                <label className="flex flex-col gap-1 text-ink3">Total time — e.g. 58.30 or 1.02.15<Input inputMode="decimal" placeholder="58.30" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
                <label className="flex flex-col gap-1 text-ink3">or average pace — e.g. 5.51<Input inputMode="decimal" placeholder="5.51" value={pace} onChange={(e) => setPace(e.target.value)} /></label>
              </div>
              {(total.trim() || pace.trim()) && <p className="mt-1 text-[11.5px] text-ink3">{total.trim() ? (parseTime(total) ? `Read as ${fmtTime(parseTime(total)!)}` : 'Can’t read that time — try 58.30') : (parseTime(pace) ? `Pace read as ${fmtTime(parseTime(pace)!)}/km` : 'Can’t read that pace — try 5.51')}</p>}
            </>) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {splits.map((v, i) => (
                  <label key={i} className="flex items-center gap-2 text-[12.5px] text-ink3"><span className="w-10">km {i + 1}</span>
                    <Input inputMode="decimal" placeholder="5.45" value={v} onChange={(e) => { const n = [...splits]; n[i] = e.target.value; setSplits(n) }} /></label>
                ))}
              </div>
            )}
            <div className="mt-3 text-[12.5px] font-semibold text-ink2">From your watch / treadmill (optional)</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12.5px]">
              <label className="flex flex-col gap-1 text-ink3">Avg heart rate<Input inputMode="numeric" placeholder="bpm" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-ink3">Max heart rate<Input inputMode="numeric" placeholder="bpm" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-ink3">Calories it says<Input inputMode="numeric" placeholder="kcal" value={devKcal} onChange={(e) => setDevKcal(e.target.value)} /></label>
              <label className="flex flex-col gap-1 text-ink3">Cadence<Input inputMode="numeric" placeholder="steps/min" value={cadence} onChange={(e) => setCadence(e.target.value)} /></label>
            </div>
            <label className="mt-2 flex flex-col gap-1 text-[12.5px] text-ink3">Notes (how it felt, shoes, anything)<Input value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {ready && (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface3 p-2.5 text-center text-[12px]">
                <div><div className="text-ink3">Pace</div><b className="text-[15px]">{fmtTime(paceSec(secs, dist))}/km</b></div>
                <div><div className="text-ink3">Speed</div><b className="text-[15px]">{speedKmh(secs, dist).toFixed(1)} km/h</b></div>
                <div><div className="text-ink3"><Flame size={11} className="inline" /> kcal</div><b className="text-[15px]">{kcalShown}</b>{num(devKcal) ? <div className="text-[10.5px] text-ink3">app estimate {est}</div> : null}</div>
              </div>
            )}
            <Button full className="mt-3" disabled={!ready} onClick={() => void save()}>Save run</Button>
            <p className="mt-1.5 text-[11px] text-ink3">If you enter the watch’s calories, those are used. Otherwise: ACSM running formula from your {weight || '?'} kg, the speed and the incline — an estimate; the treadmill’s own number may differ.</p>
          </Card>
        </>
      )}

      {offerMove && plan && progToday && (
        <Card className="p-4">
          <p className="text-[14px] font-semibold">Running instead of today’s workout?</p>
          <p className="mt-0.5 text-[12.5px] text-ink2">Today is Week {progToday.week} · {progTitle ?? 'your program workout'}. Move it to a day off so the program stays on track:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {freeDays(plan, dayjs(today).add(1, 'day').format('YYYY-MM-DD')).map((d) => (
              <Button key={d} small variant="secondary" onClick={() => void moveMissed(plan, today, d).then(() => { setHandled(true); toast(`${progTitle ?? 'Workout'} moved to ${dayjs(d).format('dddd D MMM')}`) })}>{dayjs(d).format('ddd D MMM')}</Button>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            <button type="button" className="pressable text-[12px] font-semibold text-ink3" onClick={() => void skipProgramDay(plan, progToday.week, progToday.dk, today).then(() => { setHandled(true); toast('Today’s workout skipped') })}>Skip it</button>
            <button type="button" className="pressable text-[12px] font-semibold text-ink3" onClick={() => setHandled(true)}>I’ll still lift today</button>
          </div>
        </Card>
      )}

      {series.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2"><TrendingDown size={16} className="text-brand" /><span className="text-[15px] font-semibold">Your 10 km times (minutes)</span></div>
          {series.length > 1 ? <div className="mt-2"><LineChart points={series} height={110} unit="min" /></div> : <p className="mt-1 text-[12.5px] text-ink3">Log another run to see the trend — lower is better.</p>}
          <div className="mt-2 space-y-1">
            {list.slice(-8).reverse().map((l) => (
              <div key={l.id} className="flex justify-between text-[12.5px]"><span className="text-ink2">{dayjs(l.date).format('ddd D MMM')}{best?.id === l.id ? ' 🏅' : ''}</span>
                <span><b>{fmtTime(tenKTime(l))}</b> · {fmtTime(l.avgPaceSecPerKm ?? paceSec(l.seconds, l.distanceKm ?? 10))}/km · {l.calories ?? '—'} kcal{l.avgHr ? ` · ${l.avgHr} bpm` : ''}</span></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
