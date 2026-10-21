// /hub — Progress hub. Every number here comes from his own records.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Award, CalendarDays, Gauge, Layers, Repeat, Target, Trophy } from 'lucide-react'
import { db, getProfile, getSetting, setSetting } from '@/db'
import { Badge, Button, Card, Field, Input, PageHeader, Section, Select, Spinner } from '@/components/ui'
import { MuscleMap } from '@/anim/MuscleMap'
import { byId } from '@/data/exercises'
import type { Muscle } from '@/db/types'
import { useUI } from '@/lib/store'
import { newId, todayStr } from '@/lib/id'
import { getAnyProgramPlan, getProgramPlan, getSkips } from '@/lib/programStore'
import { compareWeeklyVolume } from '@/lib/strength'
import {
  athleteProfile, BAND_LABEL, challengeProgress, cycleSummaries, goalForecast, GROUPS, groupAnalytics, heatmap, volumeShare, RECOVERY_NOTE,
  recoveryEstimate, trophies, xp, type Challenge, type DayState,
} from '@/lib/progressHub'

type Tab = 'overview' | 'calendar' | 'trophies' | 'athlete' | 'muscles' | 'cycles' | 'challenges'
const TABS: [Tab, string, typeof Trophy][] = [['overview', 'Overview', Gauge], ['calendar', 'Calendar', CalendarDays], ['trophies', 'Trophies', Trophy], ['athlete', 'Athlete', Award], ['muscles', 'Muscles', Layers], ['cycles', 'Cycles', Repeat], ['challenges', 'Challenges', Target]]
const STATE_COLOR: Record<DayState, string> = { done: 'bg-emerald-500', partial: 'bg-emerald-500/50', missed: 'bg-rose-500/70', planned: 'bg-brand/30', rest: 'bg-surface3', skipped: 'bg-slate-500/50', today: 'bg-brand ring-2 ring-brand/50' }

export default function ProgressHub() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const weighIns = useLiveQuery(() => db.weighIns.toArray(), [])
  const cardio = useLiveQuery(() => db.cardioLog.toArray(), []) ?? []
  const checkins = useLiveQuery(async () => { try { return await db.checkins.toArray() } catch { return [] } }, []) ?? []
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? []
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? (await getAnyProgramPlan()) ?? null, [])
  const profile = useLiveQuery(() => getProfile(), [])
  const measurements = useLiveQuery(() => db.measurements.toArray(), []) ?? []
  const skips = useLiveQuery(async () => (plan ? getSkips(plan.id) : new Set<string>()), [plan?.id])
  const today = todayStr()
  const tro = useMemo(() => (logs && weighIns ? trophies(logs, weighIns, profile?.startWeightKg, plan) : []), [logs, weighIns, profile, plan])
  if (!logs || !weighIns || plan === undefined) return <div className="flex h-[60svh] items-center justify-center"><Spinner /></div>
  const lvl = xp(logs, weighIns, tro.length)
  return (
    <div className="pb-8">
      <PageHeader title="Progress hub" subtitle={`Level ${lvl.level} · ${lvl.total.toLocaleString()} XP`} back="/progress" />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
        {TABS.map(([k, l, I]) => <button key={k} type="button" onClick={() => setTab(k)} className={`pressable flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${tab === k ? 'bg-brand text-white' : 'bg-surface2 text-ink2'}`}><I size={13} /> {l}</button>)}
      </div>
      <div className="space-y-3 px-4">
        {tab === 'overview' && <Overview lvl={lvl} weighIns={weighIns} goal={profile?.goalWeightKg ?? 85} start={profile?.startWeightKg} logs={logs} measurements={measurements} />}
        {tab === 'calendar' && <Calendar plan={plan} logs={logs} skips={skips ?? new Set()} today={today} />}
        {tab === 'trophies' && (
          <div className="space-y-2">
            {tro.length === 0 && <Card className="p-4 text-[13px] text-ink3">Trophies appear as you set real records — every one links to the workout it came from.</Card>}
            {tro.map((t) => (
              <Card key={t.id} className="flex items-center gap-3 p-3">
                <Trophy size={20} className={t.kind === 'bodyweight' ? 'text-emerald-300' : t.kind === 'consistency' ? 'text-sky-300' : 'text-amber-300'} />
                <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold">{t.title}</div><div className="text-[12px] text-ink3">{t.detail} · {dayjs(t.date).format('D MMM YYYY')}</div></div>
                {t.logId ? <Button small variant="ghost" onClick={() => navigate(`/replay/${t.logId}`)}>Workout</Button> : t.exerciseId ? <Button small variant="ghost" onClick={() => navigate(`/exercise/${t.exerciseId}`)}>Exercise</Button> : null}
              </Card>
            ))}
          </div>
        )}
        {tab === 'athlete' && <Athlete logs={logs} cardio={cardio} plan={plan} />}
        {tab === 'muscles' && <Muscles logs={logs} checkins={checkins} />}
        {tab === 'cycles' && <Cycles plans={plans} logs={logs} />}
        {tab === 'challenges' && <Challenges logs={logs} />}
      </div>
    </div>
  )
}

function Overview({ lvl, weighIns, goal, start, logs, measurements }: { lvl: ReturnType<typeof xp>; weighIns: { date: string; weightKg: number }[]; goal: number; start?: number; logs: import('@/db/types').WorkoutLog[]; measurements: import('@/db/types').Measurement[] }) {
  const f = goalForecast(weighIns as never, goal)
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
  const startKg = start ?? sorted[0]?.weightKg
  const last7 = sorted.filter((w) => w.date >= dayjs().subtract(6, 'day').format('YYYY-MM-DD'))
  const avg7 = last7.length ? last7.reduce((a, b) => a + b.weightKg, 0) / last7.length : undefined
  const waist = measurements.filter((m) => typeof m.values.waist === 'number').sort((a, b) => a.date.localeCompare(b.date))
  const vc = compareWeeklyVolume(logs)
  return (
    <>
      <Card className="p-4">
        <div className="flex items-baseline justify-between"><b className="text-[15px]">Level {lvl.level}</b><span className="text-[12px] text-ink3">{lvl.into}/{lvl.need} XP to level {lvl.level + 1}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface3"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((lvl.into / lvl.need) * 100)}%` }} /></div>
        <details className="mt-2 text-[11.5px] text-ink3"><summary className="cursor-pointer">How XP works</summary><ul className="list-disc pl-5">{lvl.rules.map((r) => <li key={r}>{r}</li>)}</ul></details>
      </Card>
      <Section title="Bodyweight journey">
        <Card className="space-y-2 p-4 text-[13px]">
          <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
            <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Start</div><b className="text-[15px]">{startKg ?? '—'}</b></div>
            <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">7-day avg (actual)</div><b className="text-[15px]">{avg7 ? avg7.toFixed(1) : '—'}</b></div>
            <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Goal</div><b className="text-[15px]">{goal}</b></div>
          </div>
          {startKg && <div className="flex flex-wrap gap-1.5">{[95, 92, 90, 88, 85].filter((m) => m < startKg).map((m) => <Badge key={m} tone={avg7 !== undefined && avg7 <= m ? 'green' : 'gray'}>{m} kg</Badge>)}</div>}
          <div className={f.status === 'forecast' ? '' : 'text-ink2'}><b>Forecast:</b> {f.text}</div>
          {waist.length >= 1 && <div><b>Waist:</b> {waist[0].values.waist} cm ({dayjs(waist[0].date).format('D MMM')}) → {waist[waist.length - 1].values.waist} cm ({dayjs(waist[waist.length - 1].date).format('D MMM')}) <span className="text-ink3">— actual tape measurements</span></div>}
          <div className="text-[11.5px] text-ink3">Daily weight moves 1–2 kg with water, sodium, food in your gut and sleep. Weekly averages are what the forecast uses.</div>
        </Card>
      </Section>
      <Section title="Training volume — this week vs last">
        <Card className="space-y-1 p-4 text-[13px]">
          <div><b>{vc.thisWeek.toLocaleString()} kg</b> in {vc.sessionsThis} session{vc.sessionsThis === 1 ? '' : 's'} vs <b>{vc.lastWeek.toLocaleString()} kg</b> in {vc.sessionsLast}{vc.pct !== null ? ` (${vc.pct >= 0 ? '+' : ''}${vc.pct}%)` : ''}</div>
          <div className="text-[12px] text-ink3">{vc.note}</div>
        </Card>
      </Section>
    </>
  )
}

function Calendar({ plan, logs, skips, today }: { plan: import('@/db/types').Plan | null; logs: import('@/db/types').WorkoutLog[]; skips: Set<string>; today: string }) {
  const [month, setMonth] = useState(dayjs(today).startOf('month'))
  // skipped program days → dates (keys are dayIds; map via plan start)
  const skipDates = new Set<string>()
  void skips
  const from = month.startOf('month').format('YYYY-MM-DD'), to = month.endOf('month').format('YYYY-MM-DD')
  const h = heatmap(plan, logs, skipDates, from, to, today)
  const lead = (month.startOf('month').day() + 6) % 7
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <Button small variant="ghost" onClick={() => setMonth(month.subtract(1, 'month'))}>‹</Button>
        <b>{month.format('MMMM YYYY')}</b>
        <Button small variant="ghost" onClick={() => setMonth(month.add(1, 'month'))}>›</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-ink3">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {h.days.map((d) => <div key={d.date} title={`${d.date}: ${d.state}`} className={`flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold ${STATE_COLOR[d.state]}`}>{dayjs(d.date).date()}</div>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {([['done', 'Done'], ['partial', 'Partial'], ['missed', 'Missed'], ['planned', 'Planned'], ['rest', 'Rest day']] as [DayState, string][]).map(([k, l]) => <span key={k} className="flex items-center gap-1"><i className={`inline-block h-3 w-3 rounded ${STATE_COLOR[k]}`} />{l}</span>)}
      </div>
      <div className="mt-2 text-[12.5px]">{h.consistency !== null ? <>Consistency this month: <b>{h.consistency}%</b> ({h.done} done, {h.missed} missed)</> : 'No planned sessions have passed this month yet.'}</div>
      <div className="text-[11px] text-ink3">Rest days never count as missed.</div>
    </Card>
  )
}

function Athlete({ logs, cardio, plan }: { logs: import('@/db/types').WorkoutLog[]; cardio: import('@/db/types').CardioLog[]; plan: import('@/db/types').Plan | null }) {
  const a = athleteProfile(logs, cardio, plan)
  const R = 80, cx = 110, cy = 100, n = a.length
  const pt = (i: number, v: number) => { const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v] }
  const poly = a.map((m, i) => pt(i, (m.score ?? 0) / 100).join(',')).join(' ')
  return (
    <>
      <Card className="flex justify-center p-3">
        <svg viewBox="0 0 220 200" className="h-[200px] w-[220px]" role="img" aria-label="Athlete skill radar">
          {[0.25, 0.5, 0.75, 1].map((r) => <polygon key={r} points={a.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="currentColor" className="text-line" strokeWidth="1" />)}
          <polygon points={poly} fill="rgba(245,158,11,.25)" stroke="#f59e0b" strokeWidth="2" />
          {a.map((m, i) => { const [x, y] = pt(i, 1.18); return <text key={m.key} x={x} y={y} textAnchor="middle" fontSize="9" fill="currentColor" className="text-ink2">{m.label}</text> })}
        </svg>
      </Card>
      {a.map((m) => (
        <Card key={m.key} className="p-3 text-[13px]">
          <div className="flex justify-between"><b>{m.label}</b><span className="big-num">{m.score === null ? 'not enough data' : `${m.score}/100`}</span></div>
          <div className="text-[11.5px] text-ink3">{m.how}</div>
        </Card>
      ))}
      <div className="px-1 text-[11.5px] text-ink3">Each exercise is only ever compared with itself — a machine row’s numbers are never ranked against a barbell bench press.</div>
    </>
  )
}

function Muscles({ logs, checkins }: { logs: import('@/db/types').WorkoutLog[]; checkins: import('@/db/types').DailyCheckin[] }) {
  const navigate = useNavigate()
  const [weeks, setWeeks] = useState<4 | 8>(4)
  const [mapMode, setMapMode] = useState<'volume' | 'recovery' | 'frequency'>('volume')
  const g = groupAnalytics(logs, weeks)
  const rec = recoveryEstimate(logs, checkins)
  const heat: Partial<Record<Muscle, number>> = {}
  for (const r of rec) for (const m of GROUPS[r.group].muscles) heat[m] = r.band === 'likely-recovering' ? 1 : r.band === 'partly' ? 0.6 : r.band === 'likely-ready' ? 0.25 : 0.05
  const vs = volumeShare(g.now)
  const maxPct = Math.max(1, ...vs.rows.map((r) => r.pct)), maxF = Math.max(0.1, ...vs.rows.map((r) => r.freq))
  const volHeat: Partial<Record<Muscle, number>> = {}
  for (const r of vs.rows) for (const m of GROUPS[r.g].muscles) volHeat[m] = mapMode === 'frequency' ? Math.min(1, r.freq / maxF) : Math.min(1, r.pct / maxPct)
  return (
    <>
      <div className="px-4 pb-2"><button type="button" onClick={() => navigate('/anatomy')} className="pressable w-full rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-left text-[13px]"><b className="text-brand">Open body anatomy</b> <span className="text-ink3">· real muscles, tap to learn each one</span></button></div>
      <Section title="Body map">
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface3 p-1 text-[12.5px] font-semibold">
            {(['volume', 'recovery', 'frequency'] as const).map((m) => <button key={m} type="button" onClick={() => setMapMode(m)} className={`rounded-lg py-1.5 capitalize ${mapMode === m ? 'bg-surface2 text-ink' : 'text-ink3'}`}>{m}</button>)}
          </div>
          <div className="text-[13px] text-ink2">{mapMode === 'recovery' ? 'Estimated recovery by muscle group — an estimate, not a measurement.' : mapMode === 'frequency' ? 'How many days a week each group is trained.' : vs.insight}</div>
          <div className="flex justify-center"><MuscleMap primary={[]} heat={mapMode === 'recovery' ? heat : volHeat} size={190} showLabels onTap={() => navigate('/body')} /></div>
          {mapMode !== 'recovery' && (
            <div className="space-y-1.5">
              <div className="text-[12px] font-semibold text-ink3">{mapMode === 'frequency' ? 'Days per week' : 'Share of hard sets'} · last {weeks} weeks</div>
              {vs.rows.map((r) => (
                <div key={r.g} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-20">{r.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-surface3"><div className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${mapMode === 'frequency' ? (r.freq / maxF) * 100 : (r.pct / maxPct) * 100}%` }} /></div>
                  <b className="w-12 text-right">{mapMode === 'frequency' ? `${r.freq}×` : `${r.pct}%`}</b>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-ink3">{g.note}</div>
        </Card>
      </Section>
      <Section title="Recovery estimate">
        <Card className="space-y-2 p-4">
          <div className="flex justify-center"><MuscleMap primary={[]} heat={heat} size={190} showLabels onTap={() => navigate('/body')} /></div>
          {rec.map((r) => <div key={r.group} className="flex justify-between text-[12.5px]"><span>{r.label}</span><span className="text-ink2">{BAND_LABEL[r.band]}{r.days !== null ? ` · ${r.days}d ago, ${r.sets} sets` : ''}</span></div>)}
          <div className="text-[11.5px] text-ink3">{RECOVERY_NOTE}</div>
        </Card>
      </Section>
      <Section title="Training by muscle group" action={<div className="flex gap-1">{([4, 8] as const).map((w) => <button key={w} type="button" onClick={() => setWeeks(w)} className={`rounded-full px-2.5 py-0.5 text-[11.5px] ${weeks === w ? 'bg-brand text-white' : 'bg-surface3'}`}>{w} wk</button>)}</div>}>
        <Card className="overflow-x-auto p-3">
          <table className="w-full text-[12.5px]"><thead><tr className="text-ink3"><th className="text-left">Group</th><th>Sets/wk</th><th>Days/wk</th><th>vs prev</th><th>Lifts up</th></tr></thead>
            <tbody>{Object.entries(g.now).map(([k, v]) => <tr key={k} className="border-t border-line"><td className="py-1.5 font-semibold">{GROUPS[k].label}</td><td className="text-center">{v.perWeek}</td><td className="text-center">{v.freq}</td><td className="text-center">{g.prev[k].sets ? `${v.sets - g.prev[k].sets >= 0 ? '+' : ''}${v.sets - g.prev[k].sets}` : '—'}</td><td className="text-center">{g.improved[k]}/{v.exercises.length}</td></tr>)}</tbody></table>
          <div className="mt-2 text-[11px] text-ink3">{g.note}</div>
        </Card>
      </Section>
    </>
  )
}

function Cycles({ plans, logs }: { plans: import('@/db/types').Plan[]; logs: import('@/db/types').WorkoutLog[] }) {
  const navigate = useNavigate()
  const c = cycleSummaries(plans, logs)
  return (
    <>
      {c.map((x) => (
        <Card key={x.planId} className="p-4 text-[13px]">
          <div className="flex justify-between"><b>Cycle {x.cycle}</b>{x.active ? <Badge tone="green">active</Badge> : <Badge tone="gray">saved</Badge>}</div>
          <div className="text-ink3">Started {dayjs(x.start).format('D MMM YYYY')}</div>
          <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[11.5px]">
            {[['Sessions', x.sessions], ['Sets', x.sets], ['Squat', x.squat], ['Bench', x.bench], ['Deadlift', x.deadlift]].map(([l, v]) => <div key={String(l)} className="rounded-lg bg-surface3 p-1.5"><div className="text-ink3">{l}</div><b>{v || '—'}</b></div>)}
          </div>
        </Card>
      ))}
      <div className="px-1 text-[11.5px] text-ink3">Lift numbers are estimated 1RM from your best set in that cycle. Every cycle is kept — starting a new one never overwrites an old one.</div>
      <Button full variant="secondary" onClick={() => navigate('/program/complete')}>Review and start the next cycle</Button>
    </>
  )
}

function Challenges({ logs }: { logs: import('@/db/types').WorkoutLog[] }) {
  const { toast } = useUI()
  const list = useLiveQuery(() => getSetting<Challenge[]>('challenges', []), []) ?? []
  const [kind, setKind] = useState<Challenge['kind']>('workouts')
  const [target, setTarget] = useState('16')
  const [ex, setEx] = useState('pull-up')
  const [weeks, setWeeks] = useState('4')
  const add = async () => {
    const t = Number(target); if (!(t > 0)) return
    const start = todayStr(), deadline = dayjs().add(Number(weeks) * 7, 'day').format('YYYY-MM-DD')
    const baseline = kind === 'improve' ? Math.max(0, ...logs.flatMap((l) => l.exercises.filter((e) => e.exerciseId === ex).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup).map((s) => s.weightKg ?? 0)))) : undefined
    const title = kind === 'workouts' ? `${t} workouts in ${weeks} weeks` : kind === 'reps' ? `${t} reps on ${byId.get(ex)?.name}` : `+${t} kg on ${byId.get(ex)?.name} in ${weeks} weeks`
    await setSetting('challenges', [...list, { id: newId(), kind, title, target: t, exerciseId: kind === 'workouts' ? undefined : ex, start, deadline, baseline }])
    toast('Challenge added')
  }
  return (
    <>
      {list.map((c) => { const p = challengeProgress(c, logs); return (
        <Card key={c.id} className="p-4 text-[13px]">
          <div className="flex justify-between"><b>{c.title}</b>{p.done ? <Badge tone="green">done</Badge> : p.expired ? <Badge tone="gray">ended</Badge> : <span className="text-ink3">{p.daysLeft} days left</span>}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface3"><div className="h-full rounded-full bg-brand" style={{ width: `${p.pct}%` }} /></div>
          <div className="mt-1 text-[12px] text-ink3">{p.value} / {c.target} · until {dayjs(c.deadline).format('D MMM')}</div>
          <Button small variant="ghost" className="mt-1 px-0" onClick={() => void setSetting('challenges', list.filter((x) => x.id !== c.id))}>Remove</Button>
        </Card>) })}
      <Card className="space-y-2 p-4">
        <b className="text-[14px]">New challenge</b>
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as Challenge['kind'])}><option value="workouts">Complete planned workouts</option><option value="reps">Reach a rep count</option><option value="improve">Improve an exercise</option></Select></Field>
        {kind !== 'workouts' && <Field label="Exercise"><Select value={ex} onChange={(e) => setEx(e.target.value)}>{['pull-up', 'barbell-squat', 'barbell-bench-press', 'barbell-deadlift', 'hanging-leg-raise', 'lat-pulldown', 'leg-press'].map((id) => <option key={id} value={id}>{byId.get(id)?.name ?? id}</option>)}</Select></Field>}
        <div className="grid grid-cols-2 gap-2">
          <Field label={kind === 'workouts' ? 'Workouts' : kind === 'reps' ? 'Reps' : 'kg increase'}><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="Weeks"><Input inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} /></Field>
        </div>
        <Button full onClick={() => void add()}>Add challenge</Button>
      </Card>
    </>
  )
}
