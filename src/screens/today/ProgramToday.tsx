// Today-screen cards for the 12-week program: phase + next session, PR quest,
// body map, bodyweight goal (98 → 85), steps.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { ChevronRight, Footprints, Scale, Trophy, User } from 'lucide-react'
import { Button, Card, Input } from '@/components/ui'
import { LineChart } from '@/components/charts'
import { db, getSetting } from '@/db'
import { HEALTH_KEYS, syncAppleHealth, type HealthToday } from '@/native/health'
import type { Profile } from '@/db/types'
import { DAY_LABEL, PHASES } from '@/data/program12'
import { cardioText, schemeText } from '@/screens/ProgramScreen'
import { byId } from '@/data/exercises'
import { dateOfDay, dayIdFor, mondayBefore, programDayOn, programWeekFor, weightStats } from '@/lib/program12'
import { getProgramPlan, getCheckin, saveCheckin } from '@/lib/programStore'
import { todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { ed, isNativeApp } from '@/lib/edition'

export function ProgramTodayCard() {
  const navigate = useNavigate()
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  if (plan === undefined) return null
  if (!plan) {
    return (
      <Card className="p-4" onClick={() => navigate('/program')}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold uppercase tracking-wide text-brand">New</div>
            <div className="text-[16px] font-bold">12-week physique program</div>
            <div className="text-[12.5px] text-ink2">Fat loss and muscle first, squat/bench/deadlift PRs as the side quest. Two-minute setup.</div></div>
          <ChevronRight size={18} className="text-ink3" />
        </div>
      </Card>
    )
  }
  const today = todayStr()
  const pw0 = programWeekFor(plan, today)
  const on = programDayOn(plan, today)
  const pw = on ? { ...pw0, week: on.week } : pw0
  const movedAway = plan.moves?.[today]
  const phase = PHASES[pw.week - 1]
  const monday = dayjs(mondayBefore(plan.programStart ?? plan.startDate)).add(pw.calendarWeek * 7, 'day').format('YYYY-MM-DD')
  const dk = on?.dk ?? null
  const nextKey = (['tue', 'wed', 'thu', 'fri'] as const).find((d) => dateOfDay(monday, d) >= today)
  const shown = dk && pw.started ? dk : nextKey ?? 'tue'
  const pd = plan.weeks[pw.week - 1]?.days.find((d) => d.id === dayIdFor(pw.week, shown))
  const main = pd?.exercises.find((e) => e.role === 'main') ?? pd?.exercises[0]
  return (
    <Card className="overflow-hidden border border-brand/25 bg-gradient-to-br from-brand/12 via-surface2 to-surface2 p-4">
      <button type="button" className="pressable w-full text-left" onClick={() => navigate('/program')}>
        <div className="flex items-baseline justify-between"><span className="text-[12px] font-bold uppercase tracking-wide text-brand">Week {pw.week} / 12 · {phase?.name}</span><ChevronRight size={16} className="text-ink3" /></div>
        <div className="mt-1 text-[17px] font-bold leading-tight">{!pw.started ? `Starts ${dayjs(plan.programStart).format('ddd D MMM')}` : dk ? `Today: ${pd?.title ?? ''}${on?.movedFrom ? ` (moved from ${dayjs(on.movedFrom).format('ddd')})` : ''}` : movedAway ? `Today's workout moved to ${dayjs(movedAway).format('ddd D MMM')}` : `Recovery day · next ${DAY_LABEL[shown]}`}</div>
        {pd && <div className="mt-0.5 text-[12.5px] text-ink2">{dk || !pw.started ? '' : `${pd.title} · `}{main ? `${byId.get(main.exerciseId)?.name}: ${schemeText(main)}` : 'Recovery and technique'} · {pd.exercises.length} exercises · ~{pd.estMinutes} min</div>}
        {pd?.cardio && <div className="mt-0.5 text-[11.5px] text-emerald-300">Cardio: {cardioText(pd)}</div>}
        <div className="mt-1 text-[11.5px] text-ink3">Main quest first · side quest: {phase?.sbd}</div>
      </button>
      {dk && pw.started && <Button full className="mt-3" onClick={() => navigate(`/program/day/${pw.week}/${dk}`)}>Open today's session</Button>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button small variant="secondary" onClick={() => navigate('/pr-quest')}><Trophy size={14} /> PR Quest</Button>
        <Button small variant="secondary" onClick={() => navigate('/body')}><User size={14} /> Body map</Button>
      </div>
    </Card>
  )
}

export function GoalWeightCard({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const weighIns = useLiveQuery(() => db.weighIns.toArray(), [])
  if (!weighIns) return null
  const start = profile.startWeightKg ?? [...weighIns].sort((a, b) => a.date.localeCompare(b.date))[0]?.weightKg ?? profile.weightKg
  const goal = profile.goalWeightKg ?? ed(85, profile.weightKg)
  const ws = weightStats(weighIns, start, goal, todayStr())
  const series = ws.weekly.slice(-10).map((w) => ({ x: dayjs(w.week).format('D/M'), y: Math.round(w.avg * 10) / 10 }))
  return (
    <Card className="p-4" onClick={() => navigate('/progress')}>
      <div className="flex items-center gap-2"><Scale size={16} className="text-brand" /><span className="flex-1 text-[15px] font-semibold">{start} → {goal} kg</span>
        {ws.pct !== undefined && <span className="big-num text-[13px] text-brand">{Math.round(ws.pct)}%</span>}</div>
      {ws.latest ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
            <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">7-day avg</div><b className="text-[15px]">{ws.avg7 ? ws.avg7.toFixed(1) : '—'}</b></div>
            <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Lost</div><b className="text-[15px] text-good">{ws.lost !== undefined ? ws.lost.toFixed(1) : '—'}</b></div>
            <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">To go</div><b className="text-[15px]">{ws.remaining !== undefined ? Math.max(0, ws.remaining).toFixed(1) : '—'}</b></div>
          </div>
          {series.length > 1 && <div className="mt-2"><LineChart points={series} height={100} unit="kg" /></div>}
          <div className="mt-1.5 text-[11.5px] text-ink3">Weekly averages — a single day's number is mostly water and food, so it's not judged.</div>
        </>
      ) : <div className="mt-1 text-[12.5px] text-ink3">Log a weigh-in to start the trend.</div>}
    </Card>
  )
}

export function StepsCard({ profile }: { profile: Profile }) {
  const { toast } = useUI()
  const today = todayStr()
  const c = useLiveQuery(() => getCheckin(today), [today])
  const [v, setV] = useState('')
  const target = profile.stepsTarget ?? 8000
  const steps = c?.steps
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2"><Footprints size={16} className="text-brand" /><span className="flex-1 text-[15px] font-semibold">Steps</span>
        <span className="big-num text-[13px] text-ink2">{steps !== undefined ? steps.toLocaleString() : '—'} / {target.toLocaleString()}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface3"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, ((steps ?? 0) / target) * 100)}%` }} /></div>
      <div className="mt-2 flex gap-2">
        <Input inputMode="numeric" placeholder="Steps so far" aria-label="Steps today" value={v} onChange={(e) => setV(e.target.value)} />
        <Button small onClick={() => { const n = parseInt(v.replace(/[,\s]/g, ''), 10); if (!(n >= 0)) return; void saveCheckin({ date: today, steps: n }).then(() => { setV(''); toast('Steps saved') }) }}>Save</Button>
      </div>
      {isNativeApp()
        ? <HealthStepsNote />
        : <div className="mt-1.5 text-[11.5px] text-ink3">Copy it from your phone's Health app. A web app can't read Apple Health directly.</div>}
    </Card>
  )
}

/** App Store build: steps come from Apple Health once it's connected */
function HealthStepsNote() {
  const navigate = useNavigate()
  const connected = useLiveQuery(() => getSetting<boolean>(HEALTH_KEYS.connected, false), [])
  const h = useLiveQuery(() => getSetting<HealthToday | null>(HEALTH_KEYS.today, null), [])
  const fresh = h && h.date === todayStr()
  if (connected) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink3">
        <span className="flex-1">❤️ From Apple Health{fresh && h.activeKcal ? ` · ${h.activeKcal} active kcal` : ''}{fresh && h.restingHr ? ` · resting ${h.restingHr} bpm` : ''}. Typing a number overrides it.</span>
        <button type="button" className="font-semibold text-brand" onClick={() => void syncAppleHealth(3)}>Sync</button>
      </div>
    )
  }
  return (
    <button type="button" onClick={() => navigate('/devices')} className="pressable mt-1.5 w-full rounded-xl bg-surface3 px-3 py-2 text-left text-[12px] text-ink2">
      ❤️ <b>Connect Apple Health</b> — steps, Apple Watch workouts and smart-scale weigh-ins fill in automatically.
    </button>
  )
}
