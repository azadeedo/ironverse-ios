// Goal coach card — top of Today. Daily weigh-in, the goal maths, today's automatic
// calorie target (with Undo), how much to move, and what to do when the gym is off.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { AlertTriangle, Footprints, Scale, Target, Timer, Undo2 } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { db, getSetting, setSetting } from '@/db'
import type { CardioLog, Plan, Profile } from '@/db/types'
import { currentGoalPlan, goalSettings, runGoalAutoAdjust, saveGoalSettings, targetHistory, undoLastChange } from '@/lib/calorieTarget'
import { ACTIVITIES, QUICK_BURN, type Activity, bestKmPace, fmtPace, minutesToBurn, runPlan, RUN_GOAL_SEC } from '@/lib/goalCoach'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { scheduleAt } from '@/lib/notify'
import { upsertTodayWeighIn } from '@/screens/settings/lib'
import { metCalories } from '@/lib/nutrition'
import { ActivitySession } from './ActivitySession'
import { resolvePlanDay } from './lib'
import { isAppStoreEdition } from '@/lib/edition'

/** rough energy of a normal gym session he'd be replacing */
const SESSION_KCAL = 350

export function GoalCoachCard({ profile, plan, isTrainingDay, trainedToday, eaten, target }: {
  profile: Profile; plan: Plan | null | undefined; isTrainingDay: boolean; trainedToday: boolean; eaten: number; target: number
}) {
  const toast = useUI((s) => s.toast)
  const today = todayStr()
  const [tick, setTick] = useState(0)
  const [w, setW] = useState('')
  const [showSet, setShowSet] = useState(false)
  const [where, setWhere] = useState<'all' | 'home' | 'outside'>('all')
  const [session, setSession] = useState<{ a: Activity; m: number } | null>(null)
  const dismissedOver = useLiveQuery(() => getSetting<string | null>('goal:overDismissed', null), [tick])

  useEffect(() => { void runGoalAutoAdjust(today).then((c) => { if (c) setTick((t) => t + 1) }) }, [today])
  // 10 pm: if you're still over and haven't burned it back, a reminder (rings while the app is open)
  useEffect(() => {
    const stillOver = async () => {
      if ((await getSetting<string | null>('goal:overDismissed', null)) === today) return false
      const eatenNow = (await db.foodLog.where('date').equals(today).toArray()).reduce((a, f) => a + f.kcal, 0)
      const done = (await db.cardioLog.where('date').equals(today).toArray()).filter((c) => !String(c.note ?? '').startsWith('Planned')).reduce((a, c) => a + (c.calories ?? 0), 0)
      return eatenNow - target - done >= 50
    }
    const cancel = scheduleAt('over-22', '22:00', 'You’re over today', 'Burn it back before bed — a brisk walk, skipping or your home gym circuit. Open Today for the minutes.', stillOver)
    return () => cancel()
  }, [today, target])

  const g = useLiveQuery(() => goalSettings(), [tick])
  const goal = useLiveQuery(() => currentGoalPlan(today), [tick, profile.weightKg, profile.calorieTarget])
  const weighedToday = useLiveQuery(() => db.weighIns.where('date').equals(today).first(), [today, tick])
  const weighedYesterday = useLiveQuery(() => db.weighIns.where('date').equals(dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')).first(), [today])
  const changeToday = useLiveQuery(async () => (await targetHistory()).filter((c) => c.source === 'goal-auto' && c.effective === today).pop() ?? null, [today, tick, profile.calorieTarget])
  const yLogs = useLiveQuery(() => db.workoutLogs.where('date').equals(dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')).toArray(), [today])
  // exercise actually done today (planned entries don't count until they're done)
  const doneCardio = useLiveQuery(async () => (await db.cardioLog.where('date').equals(today).toArray()).filter((c) => !String(c.note ?? '').startsWith('Planned')), [today, tick])
  const yCardio = useLiveQuery(() => db.cardioLog.where('date').equals(dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')).toArray(), [today])

  const missedYesterday = useMemo(() => {
    if (!plan || !yLogs || !yCardio) return false
    const y = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')
    return !!resolvePlanDay(plan, y) && !yLogs.some((l) => l.finishedAt) && yCardio.length === 0
  }, [plan, yLogs, yCardio, today])
  const late = new Date().getHours() >= 16
  const skipToday = isTrainingDay && !trainedToday && late

  if (!goal || !g) return null
  const over = Math.max(0, Math.round(eaten - target))
  const burned = (doneCardio ?? []).reduce((a, c) => a + (c.calories ?? 0), 0)
  const needed = goal.moveKcal + over + (skipToday ? SESSION_KCAL : 0)
  const burnKcal = Math.max(0, needed - burned)
  // over the target and not burned back yet → the urgent banner at the very top of Today
  const overLeft = Math.max(0, over - burned)
  const hour = new Date().getHours()
  const quick = QUICK_BURN.map((k) => ACTIVITIES.find((a) => a.key === k)!).filter(Boolean)
  const acts = ACTIVITIES.filter((a) => a.where !== 'gym' && (where === 'all' || a.where === where))

  async function saveWeight() {
    const v = Math.round(parseFloat(w) * 10) / 10
    if (!(v >= 30 && v <= 300)) { toast('Enter a weight between 30 and 300 kg', 'error'); return }
    await upsertTodayWeighIn(v)
    // if the coach already ran today without a change, let it re-work with today's weight
    if (!changeToday) await setSetting('goal:lastRun', null)
    await runGoalAutoAdjust(today)
    setW(''); setTick((t) => t + 1)
    toast(`Weight logged — ${v} kg`)
  }
  async function planIt(kind: CardioLog['kind'], minutes: number, label: string) {
    await db.cardioLog.add({ id: newId(), date: today, kind, seconds: minutes * 60, calories: burnKcal, note: `Planned — ${label}`, createdAt: nowIso() })
    toast(`${label}: ${minutes} min added to today`)
  }

  return (
    <>
    {overLeft >= 50 && dismissedOver !== today && (
      <div className="mb-3 rounded-2xl border border-red-500/50 bg-red-500/12 p-4">
        <div className="text-[16px] font-bold text-ink">{hour >= 22 ? 'It’s 10 pm — burn it back before bed' : hour >= 20 ? 'Tonight: burn it back' : 'You’re over today'}</div>
        <p className="mt-0.5 text-[13px] text-ink2">You’re <b className="text-red-400">{overLeft} kcal over</b>{burned ? ` (after the ${burned} kcal you’ve already done)` : ' and haven’t burned it yet'}. Do one of these now:</p>
        <div className="mt-2 space-y-1.5">
          {quick.map((a) => { const m = minutesToBurn(a, overLeft, goal.current); return (
            <div key={a.key} className="flex items-center justify-between gap-2 rounded-xl bg-surface2 px-3 py-2">
              <div className="min-w-0"><div className="text-[13.5px] font-semibold text-ink">{a.label} · <span className="text-brand">{m > 90 ? `${Math.ceil(m / 2)} min × 2` : `${m} min`}</span></div>
                <div className="text-[11.5px] text-ink3">{a.where === 'outside' ? 'outside' : 'at home'} · ≈ {metCalories(a.met, goal.current, m * 60)} kcal</div></div>
              <button type="button" className="pressable shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white" onClick={() => setSession({ a, m: Math.min(m, 90) })}>Start</button>
            </div>) })}
        </div>
        <button type="button" className="pressable mt-2 text-[12px] font-semibold text-ink3" onClick={() => { void setSetting('goal:overDismissed', today); setTick((t) => t + 1) }}>Not today — I’ll leave it</button>
      </div>
    )}
    <Card className="p-4">
      {!weighedToday && (
        <div className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-[14.5px] font-bold text-ink"><Scale size={16} className="text-amber-500" /> Log your weight today</div>
          <p className="mt-1 text-[12.5px] text-ink2">Every morning, after the toilet, before food. {weighedYesterday ? '' : 'You missed yesterday too — '}Your calories adjust from it.</p>
          <div className="mt-2 flex gap-2">
            <Input inputMode="decimal" placeholder="kg" aria-label="Today's weight in kg" value={w} onChange={(e) => setW(e.target.value)} />
            <Button small onClick={() => void saveWeight()}>Save</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2"><Target size={16} className="text-brand" />
        <span className="flex-1 text-[15px] font-semibold">{goal.goal} kg by {dayjs(goal.date).format('D MMM')}</span>
        <span className="big-num text-[13px] text-ink2">{goal.daysLeft} days</span></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Now (7-day)</div><b className="text-[15px]">{goal.current}</b></div>
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">To go</div><b className="text-[15px]">{goal.kgToGo} kg</b></div>
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Per week</div><b className="text-[15px]">{goal.neededKgPerWeek} kg</b></div>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{goal.summary}</p>
      {goal.onTrack === 'too-fast' && (
        <p className="mt-1.5 flex gap-1.5 rounded-lg bg-surface3 px-2.5 py-2 text-[12px] text-ink2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          Calories never go below {goal.floor.toLocaleString('en-AU')} and the loss is capped at 1% a week — faster than that mostly burns muscle. Extra walking still helps you get closer.</p>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface3 px-3 py-2.5">
        <div><div className="text-[11.5px] text-ink3">Today’s calories {g.auto ? '(set by the goal coach)' : ''}</div>
          <b className="big-num text-[20px]">{profile.calorieTarget.toLocaleString('en-AU')}</b>
          {changeToday && <span className="ml-2 text-[12px] text-ink2">{changeToday.to < changeToday.from ? 'lowered' : 'raised'} from {changeToday.from.toLocaleString('en-AU')}</span>}</div>
        {changeToday && <Button small variant="secondary" onClick={() => { void undoLastChange().then(() => { setTick((t) => t + 1); toast('Calorie change undone') }) }}><Undo2 size={14} /> Undo</Button>}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Eaten</div><b className="text-[14px]">{Math.round(eaten).toLocaleString('en-AU')}</b></div>
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Exercise</div><b className="text-[14px] text-good">−{burned.toLocaleString('en-AU')}</b></div>
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Net</div><b className="text-[14px]">{Math.round(eaten - burned).toLocaleString('en-AU')}</b></div>
      </div>
      <p className="mt-1 text-[11px] text-ink3">Exercise is extra deficit on top of your target — your calories aren’t raised to “eat it back” (watches over-count burn, and it would cancel the loss).</p>
      {burned > 0 && needed > 0 && burnKcal < 50 && (
        <p className="mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[12.5px] text-ink2">✓ Movement done for today — your {burned.toLocaleString('en-AU')} kcal of exercise covers what the goal{over ? ' and today’s extra eating' : ''} needed.</p>
      )}
      {(burnKcal >= 50) && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Footprints size={15} className="text-brand" />
            Move today: about {burnKcal} kcal</div>
          <p className="mt-0.5 text-[12px] text-ink3">
            {[goal.moveKcal ? `${goal.moveKcal} for the goal` : '', over ? `${over} you’re over today` : '', skipToday ? `${SESSION_KCAL} for the missed session` : ''].filter(Boolean).join(' + ')}{burned ? ` − ${burned} already done` : ''}. Pick one — no gym needed.
          </p>
          <div className="mt-2 flex gap-1.5">
            {(['all', 'outside', 'home'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setWhere(k)} className={`pressable rounded-full px-3 py-1 text-[12px] font-semibold ${where === k ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{k === 'all' ? 'All' : k === 'home' ? 'At home' : 'Outside'}</button>
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            {acts.map((a) => { const m = minutesToBurn(a, burnKcal, goal.current); return (
              <div key={a.key} className="flex items-center justify-between gap-2 rounded-xl bg-surface3 px-3 py-2">
                <div className="min-w-0"><div className="text-[13.5px] font-semibold text-ink">{a.label}{a.together ? ' 👫' : ''} · <span className="text-brand">{m > 90 ? `${Math.ceil(m / 2)} min × 2` : `${m} min`}</span> <span className="text-[12px] font-normal text-ink2">≈ {metCalories(a.met, goal.current, m * 60)} kcal</span></div>
                  <div className="text-[11.5px] text-ink3">{a.detail}</div>
                  <div className="text-[11px] text-ink3">{metCalories(a.met, goal.current, 600)} kcal per 10 min</div></div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" className="pressable rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white" onClick={() => setSession({ a, m: Math.min(m, 90) })}>Start</button>
                  <button type="button" className="pressable rounded-lg bg-surface2 px-2.5 py-1 text-[11px] font-semibold text-ink3" onClick={() => void planIt(a.kind, Math.min(m, 90), a.label)}>Plan</button>
                </div>
              </div>) })}
          </div>
          <p className="mt-1.5 text-[11px] text-ink3">Minutes are estimates from your weight and the activity’s MET value.</p>
        </div>
      )}

      {(missedYesterday || skipToday) && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-ink2">
          <b className="text-ink">{skipToday ? 'Can’t make the gym today?' : 'You missed yesterday’s session.'}</b>{' '}
          {skipToday ? 'Do one thing from the list above instead — the home circuit or a brisk walk covers it.' : 'Move it to a day off with the card under Training — and don’t skip two in a row.'}
        </div>
      )}

      {session && <ActivitySession activity={session.a} weightKg={goal.current} suggestMin={session.m} onClose={() => { setSession(null); setTick((t) => t + 1) }} />}
      <button type="button" className="pressable mt-3 text-[12px] font-semibold text-brand" onClick={() => setShowSet((v) => !v)}>{showSet ? 'Hide goal settings' : 'Goal settings'}</button>
      {showSet && (
        <div className="mt-2 space-y-2 rounded-xl bg-surface3 p-3 text-[12.5px]">
          <label className="flex items-center justify-between gap-2">Goal weight (kg)<Input className="w-24" inputMode="decimal" defaultValue={String(g.kg)} onBlur={(e) => { const v = parseFloat(e.target.value); if (v >= 40 && v <= 250) void saveGoalSettings({ kg: v }).then(() => { void setSetting('goal:lastRun', null); setTick((t) => t + 1) }) }} /></label>
          <label className="flex items-center justify-between gap-2">By<input type="date" className="rounded-lg bg-surface2 px-2 py-1.5 text-ink" defaultValue={g.date} onChange={(e) => { if (e.target.value) void saveGoalSettings({ date: e.target.value }).then(() => { void setSetting('goal:lastRun', null); setTick((t) => t + 1) }) }} /></label>
          <label className="flex items-center justify-between gap-2">Change my calories automatically every day<input type="checkbox" checked={g.auto} onChange={(e) => void saveGoalSettings({ auto: e.target.checked }).then(() => setTick((t) => t + 1))} /></label>
          <p className="text-[11.5px] text-ink3">Uses your 7-day average weight and {goal.tdeeSource === 'measured' ? 'your measured burn (from your food log and weight)' : 'an estimated burn until there’s enough food + weight data'} — about {goal.tdee.toLocaleString('en-AU')} kcal a day. Moves at most 150 kcal a day; every change is in the history with Undo.</p>
        </div>
      )}
    </Card>
    </>
  )
}

export function RunGoalCard() {
  const runs = useLiveQuery(() => db.cardioLog.toArray(), [])
  const [open, setOpen] = useState(false)
  const seen = useLiveQuery(() => getSetting<boolean>('run4:open', false), [])
  useEffect(() => { if (seen) setOpen(true) }, [seen])
  if (!runs) return null
  const best = bestKmPace(runs)
  const p = runPlan(best)
  return (
    <Card className="p-4">
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => { setOpen((v) => !v); void setSetting('run4:open', !open) }}>
        <Timer size={16} className="text-brand" /><span className="flex-1 text-[15px] font-semibold">4:00 km goal</span>
        <span className="big-num text-[13px] text-ink2">{best ? `best ${fmtPace(best)}` : 'no 1 km run yet'}</span>
      </button>
      {best && p.gap !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface3"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (RUN_GOAL_SEC / best) * 100)}%` }} /></div>
      )}
      <p className="mt-1.5 text-[12.5px] text-ink2">
        {!best ? 'Run 1 km as fast as you can and log it as a run with distance — that sets your starting point.'
          : p.gap === 0 ? 'You’ve done it — 4:00 or faster. Keep one interval session a week to hold it.'
          : `${p.gap} s/km to find. Next milestone: ${fmtPace(p.next)}/km. ${p.weeks ? `Usually ${p.weeks[0]}–${p.weeks[1]} weeks with 3 runs a week (a rough guide).` : ''}`}
      </p>
      {open && (
        <div className="mt-2 space-y-1.5">
          {p.sessions.map((s) => (
            <div key={s.title} className="rounded-xl bg-surface3 px-3 py-2"><div className="text-[13.5px] font-semibold text-ink">{s.title}</div><div className="text-[12px] text-ink2">{s.detail}</div></div>
          ))}
          <p className="text-[11.5px] text-ink3">3 runs a week: intervals, tempo, easy. Never two hard runs on back-to-back days. {isAppStoreEdition() ? 'Losing body fat' : 'Losing weight toward 85 kg'} makes this easier too — every kg off is roughly 2–3 s/km faster.</p>
        </div>
      )}
    </Card>
  )
}
