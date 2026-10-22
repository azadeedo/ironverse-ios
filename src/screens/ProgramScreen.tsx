// /program — the 12-week physique program with the SBD side quest.
// First run shows the setup questionnaire (nothing is guessed). After that:
// week X/12, phase, the four days with status, missed-session handling,
// readiness check-in, cardio + steps, weekly volume and links to everything else.

import { getCurrentProfile, localiseLogToProfile } from '@/lib/equipment'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import {
  Activity, BookOpen, CalendarClock, CheckCircle2, ChevronRight, CircleDashed, Footprints, GitBranch,
  HeartPulse, Pause, Play, RefreshCw, Repeat, SkipForward, Trophy, User, Weight,
} from 'lucide-react'
import { db, getProfile } from '@/db'
import { Badge, Button, Callout, Card, ConfirmDialog, Field, Input, PageHeader, Section, Select, Sheet, Spinner, Toggle } from '@/components/ui'
import { HeroBanner, PhaseTimeline } from '@/components/program'
import { heroForWeek } from '@/data/brand'
import { useUI } from '@/lib/store'
import { todayStr } from '@/lib/id'
import {
  CARDIO_NOTE, DAY_LABEL, DAY_ORDER, PHASES, STEP_NOTE, VOLUME_NOTE, VOLUME_TARGETS,
  type DayKey, type VolumeGroup,
} from '@/data/program12'
import { byId } from '@/data/exercises'
import {
  cardioFor, dateOfDay, loggedVolume, mondayBefore, nextTuesday, plannedVolume, programWeekFor,
  readinessAdvice, stepTargetFor, weekStatus, type DayStatus, type ProgramSetup,
} from '@/lib/program12'
import {
  buildProgramSession, clearManualWeek, getProgramPlan, getAnyProgramPlan, getProgramSetup, getSkips, pauseProgram, recentCheckins, repeatWeek,
  resumeProgram, saveCheckin, setManualWeek, setProgramStart, skipProgramDay, skipWeek, startProgram, unskipWeek,
} from '@/lib/programStore'
import { weekReviewDue } from '@/lib/weekReview'
import type { CardioLog, Plan, PlanDay, PlanExercise } from '@/db/types'
import { newId, nowIso } from '@/lib/id'
import { upsertTodayWeighIn } from './settings/lib'
import { ed } from '@/lib/edition'

export default function ProgramScreen() {
  const [params] = useSearchParams()
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  const paused = useLiveQuery(async () => (await getAnyProgramPlan()) ?? null, [])
  const setup = useLiveQuery(() => getProgramSetup(), [])
  if (plan === undefined || setup === undefined || paused === undefined) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  if (!plan || params.get('setup') === '1') return <SetupForm existing={setup ?? undefined} pausedPlan={!plan ? paused : null} />
  return <Dashboard plan={plan} />
}

// ============================================================
// SETUP
// ============================================================
const CANNOT_OPTIONS = ['barbell-squat', 'barbell-deadlift', 'barbell-rdl', 'hack-squat', 'dumbbell-bulgarian-split-squat', 'hanging-knee-raise', 'overhead-cable-extension', 'incline-dumbbell-press', 'chest-supported-row', 'reverse-pec-deck']

function SetupForm({ existing, pausedPlan }: { existing?: ProgramSetup; pausedPlan: Plan | null }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const profile = useLiveQuery(() => getProfile(), [])
  const lastWeigh = useLiveQuery(async () => (await db.weighIns.orderBy('date').last()) ?? null, [])
  const [f, setF] = useState<Record<string, string>>({})
  const [cannot, setCannot] = useState<string[]>(existing?.cannotDo ?? [])
  const [busy, setBusy] = useState(false)
  const v = (k: string, d = '') => f[k] ?? d
  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }))
  const n = (k: string, d?: number) => { const x = parseFloat(v(k, d === undefined ? '' : String(d))); return Number.isFinite(x) && x > 0 ? x : undefined }
  const lift = (k: 'squat' | 'bench' | 'deadlift') => {
    const kg = n(`${k}Kg`, existing?.[k]?.kg), reps = n(`${k}Reps`, existing?.[k]?.reps)
    return kg && reps ? { kg, reps: Math.round(reps), date: todayStr() } : undefined
  }
  const start = v('start', nextTuesday(todayStr()))
  const pullUps = n('pullUps', existing?.pullUps) ?? 0
  const autoStage = pullUps >= 6 ? 'pull-up' : pullUps >= 1 ? 'assisted-pull-up' : 'lat-pulldown'

  async function submit() {
    if (busy) return
    if (dayjs(start).day() !== 2 && !confirm('Week 1 normally starts on a Tuesday. Start on this day anyway?')) return
    setBusy(true)
    try {
      const s: ProgramSetup = {
        squat: lift('squat'), bench: lift('bench'), deadlift: lift('deadlift'),
        squatPR: n('squatPR', existing?.squatPR), benchPR: n('benchPR', existing?.benchPR), deadliftPR: n('deadliftPR', existing?.deadliftPR),
        bodyweightKg: n('bw', lastWeigh?.weightKg ?? profile?.weightKg), goalWeightKg: n('goal', existing?.goalWeightKg ?? ed(85, profile?.goalWeightKg ?? profile?.weightKg ?? 85)),
        heightCm: n('height', existing?.heightCm ?? 169), age: n('age', existing?.age ?? 26),
        steps: n('steps', existing?.steps), sleepHours: n('sleep', existing?.sleepHours),
        cardio: (v('cardio', existing?.cardio ?? 'incline-walk') as ProgramSetup['cardio']),
        cannotDo: cannot, pullUps, pullStage: (v('pullStage', existing?.pullStage ?? autoStage) as ProgramSetup['pullStage']),
        pushUps: n('pushUps', existing?.pushUps),
      }
      await startProgram(s, start)
      toast('12-week program started')
      navigate('/program', { replace: true })
    } catch (e) {
      toast(`Could not start: ${(e as Error).message}`, 'error')
    } finally { setBusy(false) }
  }

  const liftRow = (k: 'squat' | 'bench' | 'deadlift', label: string) => (
    <div className="grid grid-cols-[1fr_1fr_1fr] items-end gap-2">
      <div className="pb-2.5 text-[14px] font-semibold">{label}</div>
      <Field label="kg"><Input inputMode="decimal" placeholder="e.g. 120" aria-label="120" defaultValue={existing?.[k]?.kg ?? ''} onChange={set(`${k}Kg`)} /></Field>
      <Field label="reps"><Input inputMode="numeric" placeholder="e.g. 5" aria-label="5" defaultValue={existing?.[k]?.reps ?? ''} onChange={set(`${k}Reps`)} /></Field>
    </div>
  )

  return (
    <div className="pb-8">
      <PageHeader title="12-Week Program" subtitle="Physique first. Squat, bench and deadlift PRs as the side quest." back="/workout" />
      <div className="px-4 pb-3"><HeroBanner id="hero-foundation"><div className="text-[20px] font-black leading-tight text-white">12 weeks. 48 written workouts.</div><div className="text-[12.5px] text-white/85">Build muscle, lose fat, get fitter — squat, bench and deadlift PRs as the side quest.</div></HeroBanner></div>
      <div className="space-y-4 px-4">
        {pausedPlan && (
          <Callout tone="info"><div className="space-y-2"><div>You have a paused program from {dayjs(pausedPlan.programStart).format('D MMM')}.</div>
            <Button small onClick={() => void resumeProgram(pausedPlan.id).then(() => navigate('/program'))}><Play size={14} /> Resume it</Button></div></Callout>
        )}
        <Callout tone="neutral">Answer what you know and skip the rest. Nothing is guessed — loads are only suggested once you give real numbers or log real sets.</Callout>

        <Section title="Best recent lifts (weight × reps)">
          <Card className="space-y-2 p-4">
            {liftRow('squat', 'Squat')}{liftRow('bench', 'Bench')}{liftRow('deadlift', 'Deadlift')}
            <div className="pt-1 text-[12px] text-ink3">A recent hard set, e.g. 100 × 5. Leave blank if you have not done the lift recently.</div>
          </Card>
        </Section>
        <Section title="Tested 1RMs (optional — only if you actually lifted them)">
          <Card className="grid grid-cols-3 gap-2 p-4">
            <Field label="Squat"><Input inputMode="decimal" defaultValue={existing?.squatPR ?? ''} onChange={set('squatPR')} /></Field>
            <Field label="Bench"><Input inputMode="decimal" defaultValue={existing?.benchPR ?? ''} onChange={set('benchPR')} /></Field>
            <Field label="Deadlift"><Input inputMode="decimal" defaultValue={existing?.deadliftPR ?? ''} onChange={set('deadliftPR')} /></Field>
          </Card>
        </Section>
        <Section title="You">
          <Card className="grid grid-cols-2 gap-3 p-4">
            <Field label="Bodyweight now (kg)"><Input inputMode="decimal" defaultValue={lastWeigh?.weightKg ?? profile?.weightKg ?? 98} onChange={set('bw')} /></Field>
            <Field label="Goal (kg)"><Input inputMode="decimal" defaultValue={existing?.goalWeightKg ?? ed(85, profile?.goalWeightKg ?? profile?.weightKg ?? 85)} onChange={set('goal')} /></Field>
            <Field label="Height (cm)"><Input inputMode="decimal" defaultValue={existing?.heightCm ?? 169} onChange={set('height')} /></Field>
            <Field label="Age"><Input inputMode="numeric" defaultValue={existing?.age ?? 26} onChange={set('age')} /></Field>
            <Field label="Steps on a normal day"><Input inputMode="numeric" placeholder="optional" aria-label="optional" defaultValue={existing?.steps ?? ''} onChange={set('steps')} /></Field>
            <Field label="Sleep (hours)"><Input inputMode="decimal" placeholder="optional" aria-label="optional" defaultValue={existing?.sleepHours ?? ''} onChange={set('sleep')} /></Field>
          </Card>
        </Section>
        <Section title="Ability">
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bodyweight pull-ups"><Input inputMode="numeric" defaultValue={existing?.pullUps ?? 0} onChange={set('pullUps')} /></Field>
              <Field label="Push-ups in one set"><Input inputMode="numeric" placeholder="optional" aria-label="optional" defaultValue={existing?.pushUps ?? ''} onChange={set('pushUps')} /></Field>
            </div>
            <Field label="Vertical pull to start with" hint="Suggested from your pull-ups. The app suggests the next step when you are ready — it never switches on its own.">
              <Select value={v('pullStage', existing?.pullStage ?? autoStage)} onChange={set('pullStage')}>
                <option value="lat-pulldown">Lat Pulldown</option><option value="assisted-pull-up">Assisted Pull-Up</option>
                <option value="pull-up">Bodyweight Pull-Up</option><option value="weighted-pull-up">Weighted Pull-Up</option>
              </Select>
            </Field>
            <Field label="Preferred cardio">
              <Select value={v('cardio', existing?.cardio ?? 'incline-walk')} onChange={set('cardio')}>
                <option value="incline-walk">Incline treadmill walk</option><option value="bike">Stationary bike</option><option value="elliptical">Elliptical</option>
              </Select>
            </Field>
          </Card>
        </Section>
        <Section title="Exercises you cannot perform">
          <Card className="divide-y divide-line px-4">
            {CANNOT_OPTIONS.map((id) => (
              <div key={id} className="flex min-h-[48px] items-center justify-between gap-3 py-1.5">
                <span className="text-[14px]">{byId.get(id)?.name ?? id}</span>
                <Toggle checked={cannot.includes(id)} label={`Cannot do ${byId.get(id)?.name}`} onChange={(on) => setCannot((c) => (on ? [...c, id] : c.filter((x) => x !== id)))} />
              </div>
            ))}
          </Card>
          <div className="mt-1.5 px-1 text-[12px] text-ink3">Anything switched on is replaced by the closest alternative. You can swap any exercise later too.</div>
        </Section>
        <Section title="Start">
          <Card className="space-y-2 p-4">
            <Field label="Week 1 starts (Tuesday)"><Input type="date" defaultValue={start} onChange={set('start')} /></Field>
            <div className="text-[12px] text-ink3">{ed("Training Tue–Fri at Flex 24/7 Mickleham. Saturday–Monday are recovery days.", "Training Tue–Fri. Saturday–Monday are recovery days.")}</div>
          </Card>
        </Section>
        <Button full disabled={busy} onClick={() => void submit()}>{busy ? 'Building your 12 weeks…' : existing?.completedAt ? 'Rebuild the program with these answers' : 'Build my 12-week program'}</Button>
        {existing?.completedAt && <Button full variant="secondary" onClick={() => navigate('/program')}>Cancel</Button>}
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD
// ============================================================
const STATE_UI: Record<DayStatus['state'], { label: string; tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'purple'; icon: typeof CheckCircle2 }> = {
  done: { label: 'Done', tone: 'green', icon: CheckCircle2 }, partial: { label: 'Partial', tone: 'amber', icon: CircleDashed },
  missed: { label: 'Missed', tone: 'red', icon: CalendarClock }, skipped: { label: 'Skipped', tone: 'gray', icon: SkipForward },
  today: { label: 'Today', tone: 'amber', icon: Play }, upcoming: { label: 'Upcoming', tone: 'gray', icon: CircleDashed },
  moved: { label: 'Moved', tone: 'purple', icon: Repeat },
}

function Dashboard({ plan }: { plan: Plan }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const today = todayStr()
  const pw = programWeekFor(plan, today)
  const [viewWeek, setViewWeek] = useState<number | null>(null)
  const week = viewWeek ?? pw.week
  const phase = PHASES[week - 1]
  const weekMonday = dayjs(mondayBefore(plan.programStart ?? plan.startDate)).add(pw.calendarWeek * 7, 'day').format('YYYY-MM-DD')
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []) ?? []
  const cardio = useLiveQuery(() => db.cardioLog.where('date').aboveOrEqual(weekMonday).toArray(), [weekMonday]) ?? []
  const checkins = useLiveQuery(() => recentCheckins(28), []) ?? []
  const profile = useLiveQuery(() => getProfile(), [])
  const skips = useLiveQuery(() => getSkips(plan.id), [plan.id]) ?? new Set<string>()
  const status = useMemo(() => weekStatus(plan, weekMonday, pw.week, logs, today, skips), [plan, weekMonday, pw.week, logs, today, skips])
  const [startFor, setStartFor] = useState<DayKey | null>(null)
  const [cardioOpen, setCardioOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | 'pause' | 'repeat' | 'deload' | 'delay' | 'skip'>(null)
  const [schedOpen, setSchedOpen] = useState(false)
  const reviewDue = weekReviewDue(plan, logs, today)

  const missed = status.filter((s) => s.state === 'missed')
  const crx = cardioFor(week)
  const cardioDone = cardio.filter((c) => c.date <= dayjs(weekMonday).add(6, 'day').format('YYYY-MM-DD') && c.seconds >= 8 * 60 && c.kind !== 'jump-rope').length
  const todayCheck = checkins.find((c) => c.date === today)
  const stepsTarget = profile?.stepsTarget ?? 8000
  const stepAdvice = stepTargetFor(checkins, stepsTarget, today)
  const planned = plannedVolume(plan.weeks[week - 1].days)
  const logged = loggedVolume(logs, weekMonday, dayjs(weekMonday).add(6, 'day').format('YYYY-MM-DD'))
  const openToday = logs.find((l) => l.planId === plan.id && l.date === today && !l.finishedAt && !l.skipped)

  async function act(kind: 'pause' | 'repeat' | 'deload' | 'delay' | 'skip') {
    if (kind === 'skip') { await skipWeek(plan, pw.week); toast(`Week ${pw.week} skipped — week ${Math.min(12, pw.week + 1)} starts now. History is unchanged.`) }
    if (kind === 'pause') { await pauseProgram(); toast('Program paused — your previous plan is back'); navigate('/workout') }
    if (kind === 'repeat') { await repeatWeek(plan, pw.week); toast(`Week ${pw.week} will repeat next week`) }
    if (kind === 'delay') { await repeatWeek(plan, 11); toast('PR week delayed by one week (PR Primer repeats)') }
    if (kind === 'deload') {
      await db.plans.put({ ...plan, manualDeloads: [...(plan.manualDeloads ?? []), pw.calendarWeek] })
      toast('This week is now a deload — lighter main lifts, about half the accessory sets')
    }
    setConfirm(null)
  }

  return (
    <div className="pb-6">
      <PageHeader title={`Week ${week} / 12`} subtitle={`${phase.name} · Side quest: ${phase.sbd}`} back="/workout"
        actions={<Button small variant="secondary" onClick={() => navigate('/program?setup=1')}>Setup</Button>} />
      <div className="space-y-4 px-4">
        {!pw.started && <Callout tone="info">Your program starts {dayjs(plan.programStart).format('dddd D MMMM')}. Have a look around — week 1 is ready.</Callout>}
        {pw.finished && <Callout tone="good"><div className="space-y-1.5"><div className="font-semibold">12 weeks complete.</div><div>Review your strength journey and start a new block when you are ready.</div><Button small onClick={() => navigate('/strength-journey')}>Review the 12 weeks</Button></div></Callout>}
        {pw.repeat && <Callout tone="neutral">This is a repeat of week {pw.week}.</Callout>}
        {(plan.manualDeloads ?? []).includes(pw.calendarWeek) && <Callout tone="info">Manual deload this week — sessions are built lighter automatically.</Callout>}

        {reviewDue && viewWeek === null && (
          <Callout tone="good">
            <div className="space-y-1.5"><div className="font-semibold">Week {reviewDue} complete</div>
              <div className="text-[13px]">See what you did, how your body is trending, and tell the app how it felt.</div>
              <Button small onClick={() => navigate(`/program/review/${reviewDue}`)}>Open the week {reviewDue} review</Button></div>
          </Callout>
        )}
        <HeroBanner id={heroForWeek(week)}>
          <div className="text-[11.5px] font-black uppercase tracking-[0.18em] text-amber-300">Week {week} / 12{viewWeek !== null ? ' · preview' : ''}</div>
          <div className="text-[22px] font-black leading-tight text-white">{phase.name}</div>
          <div className="text-[12px] text-white/80">Main quest first · side quest: {phase.sbd}</div>
        </HeroBanner>
        <PhaseTimeline current={week} onPick={(w) => setViewWeek(w === pw.week ? null : w)} />
        {week === 12 ? (
          <Card className="overflow-hidden border border-amber-400/40 bg-gradient-to-br from-amber-500/25 via-rose-500/10 to-surface2 p-4">
            <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-amber-300"><Trophy size={16} /> PR week · final week</div>
            <div className="mt-1 text-[20px] font-black leading-tight">Squat Tuesday · Bench Wednesday · Recovery Thursday · Deadlift Friday</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-ink2">{phase.goal} Every PR attempt is optional — the PR coach builds warm-ups and attempts from what you have actually lifted.</div>
            <Button small className="mt-2.5" onClick={() => navigate('/program/complete')}><Trophy size={14} /> Program review</Button>
            {viewWeek !== null && <Button small variant="ghost" className="mt-2 px-0" onClick={() => setViewWeek(null)}>Back to this week</Button>}
          </Card>
        ) : (
          <Card className={`p-4 ${phase.deload ? 'border border-sky-400/30 bg-sky-500/5' : ''}`}>
            {phase.deload && <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-sky-300">Deload week</div>}
            <div className="text-[13px] leading-relaxed text-ink2">{phase.goal}</div>
            {viewWeek !== null && <Button small variant="ghost" className="mt-2 px-0" onClick={() => setViewWeek(null)}>Back to this week</Button>}
          </Card>
        )}

        {openToday && <Button full onClick={() => navigate(`/session/${openToday.id}`)}><Play size={16} /> Resume today's session</Button>}

        {missed.length > 0 && viewWeek === null && (
          <Callout tone="warn">
            <div className="space-y-2">
              <div className="font-semibold">{missed.length === 1 ? `${DAY_LABEL[missed[0].day]} was missed` : `${missed.length} sessions missed this week`}</div>
              <div className="text-[13px]">Two workouts are never combined into one. Move it to today, skip it, or just continue with the plan.</div>
              {missed.length >= 2 && <Button small variant="secondary" onClick={() => setConfirm('repeat')}><Repeat size={14} /> Repeat this week next week</Button>}
            </div>
          </Callout>
        )}

        <Section title={viewWeek === null ? 'This week' : `Week ${week} preview`}>
          <div className="space-y-2">
            {DAY_ORDER.map((d) => {
              const st = viewWeek === null ? status.find((s) => s.day === d)! : null
              const pd = plan.weeks[week - 1].days[DAY_ORDER.indexOf(d)]
              const main = pd.exercises.find((e) => e.role === 'main')
              const first = main ?? pd.exercises[0]
              const pastLog = !st ? logs.find((l) => l.planId === plan.id && l.dayId === pd.id && l.finishedAt) : undefined
              const ui = st ? STATE_UI[st.state] : pastLog ? STATE_UI[pastLog.status === 'partial' ? 'partial' : 'done'] : null
              return (
                <Card key={d} className="p-3.5">
                  <button type="button" className="pressable flex w-full items-center gap-3 text-left" onClick={() => navigate(`/program/day/${week}/${d}`)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[12px] text-ink3">
                        <span>{DAY_LABEL[d]}{st ? ` · ${dayjs(st.date).format('D MMM')}` : ''}</span>
                        {ui && <Badge tone={ui.tone}>{ui.label}</Badge>}
                      </div>
                      <div className="mt-0.5 text-[15px] font-semibold leading-tight">{pd.title}</div>
                      <div className="mt-0.5 text-[12.5px] text-ink2">
                        {first ? `${byId.get(first.exerciseId)?.name ?? first.exerciseId}: ${schemeText(first)}` : 'Recovery / technique'} · {pd.exercises.length} exercises · ~{pd.estMinutes} min
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[11.5px] text-ink3">{pd.exercises.slice(main ? 1 : 1, 4).map((e) => byId.get(e.exerciseId)?.name ?? e.exerciseId).join(' · ')}{pd.exercises.length > 4 ? ' …' : ''}</div>
                      {pd.cardio && <div className="mt-0.5 text-[11.5px] text-emerald-300">Cardio: {cardioText(pd)}</div>}
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-ink3" />
                  </button>
                  {st && (st.state === 'today' || st.state === 'missed' || st.state === 'upcoming') && viewWeek === null && (
                    <div className="mt-2.5 flex gap-2">
                      {(st.state === 'today' || st.state === 'missed') && <Button small className="flex-1" onClick={() => setStartFor(d)}><Play size={14} /> {st.state === 'missed' ? 'Do it today' : 'Start'}</Button>}
                      {st.state === 'missed' && <Button small variant="secondary" className="flex-1" onClick={() => void skipProgramDay(plan, pw.week, d, st.date).then(() => toast('Marked as skipped — the plan continues'))}><SkipForward size={14} /> Skip</Button>}
                      {st.state === 'upcoming' && <Button small variant="secondary" className="flex-1" onClick={() => setStartFor(d)}><Play size={14} /> Train it today instead</Button>}
                    </div>
                  )}
                  {st?.state === 'done' && st.log && <button type="button" className="mt-2 text-[12.5px] font-semibold text-brand" onClick={() => navigate(`/session/${st.log!.id}`)}>View summary</button>}
                </Card>
              )
            })}
          </div>
        </Section>

        <Section title="All 12 weeks · 48 workouts">
          <Card className="p-2.5">
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
              {PHASES.map((ph) => (
                <WeekRow key={ph.week} plan={plan} week={ph.week} current={pw.week} logs={logs} onPick={(w, d) => navigate(`/program/day/${w}/${d}`)} onWeek={(w) => setViewWeek(w === pw.week ? null : w)} />
              ))}
            </div>
            <div className="px-1 pt-2 text-[11px] text-ink3">Every cell is its own written workout. Tap a day to open it. Ticks are workouts you finished — future weeks are never marked done.</div>
          </Card>
        </Section>

        <Section title="Cardio this week" action={<Button small variant="ghost" onClick={() => setCardioOpen(true)}>+ Log</Button>}>
          <Card className="space-y-2 p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] font-semibold">{crx.sessions[0] === crx.sessions[1] ? crx.sessions[0] : `${crx.sessions[0]}–${crx.sessions[1]}`} × {crx.minutes[0] === crx.minutes[1] ? crx.minutes[0] : `${crx.minutes[0]}–${crx.minutes[1]}`} min{crx.easy ? ' · easy' : ''}</div>
              <Badge tone={cardioDone >= crx.sessions[0] ? 'green' : 'gray'}>{cardioDone} done</Badge>
            </div>
            {crx.note && <div className="text-[12.5px] text-ink2">{crx.note}</div>}
            <div className="text-[12px] leading-relaxed text-ink3">{CARDIO_NOTE}</div>
          </Card>
        </Section>

        <Section title="Steps & recovery">
          <Card className="space-y-3 p-4">
            <StepsAndReadiness today={today} steps={todayCheck?.steps} target={stepsTarget} advice={stepAdvice.why} suggestUp={stepAdvice.suggestUp}
              onRaise={async () => { const me = await getProfile(); if (me) { await db.profile.put({ ...me, stepsTarget: stepsTarget < 9000 ? 9000 : 10000 }); toast('Step target raised') } }} />
            <div className="text-[11.5px] text-ink3">{STEP_NOTE}</div>
          </Card>
        </Section>

        <Section title="Weekly volume (direct sets)">
          <Card className="space-y-2.5 p-4">
            {(Object.keys(VOLUME_TARGETS) as VolumeGroup[]).map((g) => {
              const t = VOLUME_TARGETS[g]
              const pl = planned[g], lg = logged[g]
              const max = Math.max(t.range[1], pl.direct, lg.direct, 1)
              return (
                <div key={g}>
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="font-semibold">{t.label}</span>
                    <span className="text-ink3">{lg.direct}/{pl.direct} planned · target {t.range[0] === t.range[1] ? `~${t.range[0]}` : `${t.range[0]}–${t.range[1]}`}{pl.contribution ? ` · +${pl.contribution} contribution` : ''}</span>
                  </div>
                  <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-surface3">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand/30" style={{ width: `${(pl.direct / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(lg.direct / max) * 100}%` }} />
                    <div className="absolute inset-y-0 bg-emerald-400/50" style={{ left: `${(t.range[0] / max) * 100}%`, width: `${((t.range[1] - t.range[0]) / max) * 100 || 0.8}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="pt-1 text-[11.5px] leading-relaxed text-ink3">{VOLUME_NOTE}</div>
          </Card>
        </Section>

        <Section title="Explore">
          <div className="grid grid-cols-2 gap-2">
            <Tile icon={<Trophy size={18} />} label="PR Quest" sub="Side quest" onClick={() => navigate('/pr-quest')} />
            <Tile icon={<User size={18} />} label="Body map" sub="Muscles + sets" onClick={() => navigate('/body')} />
            <Tile icon={<GitBranch size={18} />} label="Skill trees" sub="Unlocks + levels" onClick={() => navigate('/skills')} />
            <Tile icon={<Activity size={18} />} label="Strength journey" sub="Start → now → next" onClick={() => navigate('/strength-journey')} />
            <Tile icon={<Weight size={18} />} label="Bodyweight" sub={ed("98 → 85 kg", "Weight trend")} onClick={() => navigate('/progress')} />
            <Tile icon={<BookOpen size={18} />} label="Research" sub="Why this program" onClick={() => navigate('/research')} />
          </div>
        </Section>

        <Section title="Program controls">
          <Card className="divide-y divide-line">
            <CtlRow icon={<CalendarClock size={17} />} label="Schedule: start date / current week" sub={plan.manualWeek ? `Manually on week ${plan.manualWeek.week}` : `Started ${dayjs(plan.programStart).format('D MMM YYYY')}`} onClick={() => setSchedOpen(true)} />
            <CtlRow icon={<Repeat size={17} />} label="Repeat this week" sub="Inserts another week " onClick={() => setConfirm('repeat')} />
            <CtlRow icon={<SkipForward size={17} />} label="Skip this week" sub={`Jump from week ${pw.week} to week ${Math.min(12, pw.week + 1)}`} onClick={() => setConfirm('skip')} />
            <CtlRow icon={<HeartPulse size={17} />} label="Make this week a deload" sub="Lighter main lifts, about half the sets" onClick={() => setConfirm('deload')} />
            <CtlRow icon={<CalendarClock size={17} />} label="Delay PR week" sub="Repeats the PR Primer week" onClick={() => setConfirm('delay')} />
            <CtlRow icon={<RefreshCw size={17} />} label="Restart or rebuild" sub="New start date or new answers" onClick={() => navigate('/program?setup=1')} />
            <CtlRow icon={<Pause size={17} />} label="Pause program" sub="Switches your previous plan back on" onClick={() => setConfirm('pause')} />
          </Card>
          <div className="mt-1.5 px-1 text-[12px] text-ink3">Changing the structure is your call — the app warns, it never blocks.</div>
        </Section>
      </div>

      <StartSheet plan={plan} day={startFor} week={pw.week} weekMonday={weekMonday} onClose={() => setStartFor(null)} />
      <CardioSheet open={cardioOpen} onClose={() => setCardioOpen(false)} />
      <ScheduleSheet open={schedOpen} plan={plan} currentWeek={pw.week} onClose={() => setSchedOpen(false)} />
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => confirm && void act(confirm)} danger={false}
        title={confirm === 'pause' ? 'Pause the program?' : confirm === 'repeat' ? `Repeat week ${pw.week}?` : confirm === 'deload' ? 'Deload this week?' : confirm === 'skip' ? `Skip week ${pw.week}?` : 'Delay PR week?'}
        message={confirm === 'skip' ? 'The schedule moves straight to the next week. Workouts you already logged keep their week numbers — nothing in your history changes. You can undo this from Schedule.'
          : confirm === 'pause' ? 'Your logs stay. Your previous plan becomes active again and you can resume this program any time.'
          : confirm === 'repeat' ? 'This shifts every later week back by one, including PR week. Useful after missed sessions.'
            : confirm === 'deload' ? 'This changes the program structure for this week. Sessions you have not started yet will be built lighter.'
              : 'Week 11 (PR Primer) repeats, pushing PR week back a week.'}
        confirmLabel="Yes, do it" />
    </div>
  )
}

export function schemeText(pe: PlanExercise): string {
  const s = pe.scheme
  const rng = (r?: [number, number]) => (!r ? '' : r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`)
  if (s?.kind === 'pr-test') return 'PR test (optional)'
  if (s?.kind === 'top-backoff') return `1 × ${s.topReps} @ RPE ~${s.topRpe?.[0]} + ${s.backoffSets} × ${rng(s.backoffReps)}`
  if (s?.kind === 'single-backoff') return `1 × 1 @ RPE ${rng(s.topRpe)} + ${s.backoffSets} × ${rng(s.backoffReps)}`
  const rir = pe.rir ? ` · ${pe.rir[0] >= 4 ? '4+' : rng(pe.rir)} RIR` : ''
  return `${pe.sets} × ${rng(pe.reps)}${rir}`
}
export function cardioText(pd: PlanDay): string {
  const c = pd.cardio
  if (!c) return ''
  const m = c.minutes[0] === c.minutes[1] ? c.minutes[0] : `${c.minutes[0]}–${c.minutes[1]}`
  return `${m} min ${c.kind === 'incline-walk' ? 'incline walk' : c.kind === 'walk' ? 'easy walk' : 'easy cardio'}${c.optional ? ' (optional)' : ''}`
}

function WeekRow({ plan, week, current, logs, onPick, onWeek }: { plan: Plan; week: number; current: number; logs: import('@/db/types').WorkoutLog[]; onPick: (w: number, d: DayKey) => void; onWeek: (w: number) => void }) {
  const ph = PHASES[week - 1]
  const skipped = (plan.skippedWeeks ?? []).includes(week)
  return (
    <>
      <button type="button" onClick={() => onWeek(week)} className={`pressable rounded-lg px-1.5 py-1 text-left text-[11.5px] leading-tight ${week === current ? 'bg-brand/20 font-bold text-brand' : 'text-ink2'}`}>
        <span className="block font-bold">W{week}</span><span className="block max-w-[92px] truncate text-[10px] text-ink3">{skipped ? 'skipped' : ph.name}</span>
      </button>
      <div className="grid grid-cols-4 gap-1">
        {DAY_ORDER.map((d) => {
          const pd = plan.weeks[week - 1]?.days.find((x) => x.dayKey === d || x.id.endsWith(`-${d}`))
          const done = !!pd && logs.some((l) => l.planId === plan.id && l.dayId === pd.id && l.finishedAt && !l.skipped)
          const kind = pd?.kind
          const tone = kind === 'pr' ? 'bg-amber-500/25 text-amber-200' : kind === 'deload' ? 'bg-sky-500/15 text-sky-200' : kind === 'recovery' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-surface3 text-ink2'
          return (
            <button key={d} type="button" aria-label={`Week ${week} ${DAY_LABEL[d]}`} onClick={() => onPick(week, d)}
              className={`pressable flex min-h-[38px] flex-col items-center justify-center rounded-lg text-[10.5px] font-semibold ${tone} ${week === current ? 'ring-1 ring-brand/50' : ''}`}>
              <span>{DAY_LABEL[d].slice(0, 3)}{done ? ' ✓' : ''}</span>
              <span className="text-[9.5px] font-normal opacity-80">{pd ? `${pd.exercises.length} ex` : ''}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function ScheduleSheet({ open, plan, currentWeek, onClose }: { open: boolean; plan: Plan; currentWeek: number; onClose: () => void }) {
  const { toast } = useUI()
  const [start, setStart] = useState(plan.programStart ?? plan.startDate)
  const [wk, setWk] = useState(String(currentWeek))
  return (
    <Sheet open={open} onClose={onClose} title="Schedule">
      <div className="space-y-4">
        <div className="space-y-2">
          <Field label="Program start date (snaps to a Tuesday)"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Button full variant="secondary" onClick={() => void setProgramStart(plan, start).then((p) => { toast(`Start date set to ${dayjs(p.programStart).format('ddd D MMM')} — the current week is recalculated`); onClose() })}>Save start date</Button>
        </div>
        <div className="space-y-2">
          <Field label="I am on week…"><Select value={wk} onChange={(e) => setWk(e.target.value)}>{PHASES.map((p) => <option key={p.week} value={p.week}>Week {p.week} — {p.name}</option>)}</Select></Field>
          <Button full variant="secondary" onClick={() => void setManualWeek(plan, Number(wk)).then(() => { toast(`From this week on you are on week ${wk}`); onClose() })}>Set manual week</Button>
          {plan.manualWeek && <Button full variant="ghost" onClick={() => void clearManualWeek(plan).then(() => { toast('Back to the calendar schedule'); onClose() })}>Clear manual week (use the calendar)</Button>}
        </div>
        {(plan.skippedWeeks ?? []).length > 0 && (
          <div className="space-y-1.5"><div className="text-[13px] font-semibold">Skipped weeks</div>
            {(plan.skippedWeeks ?? []).map((w) => <Button key={w} small variant="secondary" onClick={() => void unskipWeek(plan, w).then(() => toast(`Week ${w} is back in the schedule`))}>Undo skip of week {w}</Button>)}</div>
        )}
        <div className="text-[11.5px] text-ink3">Changing the schedule never edits or deletes workouts you have logged — they keep their own dates and program weeks.</div>
      </div>
    </Sheet>
  )
}

function Tile({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="pressable flex min-h-[72px] flex-col items-start gap-1 rounded-2xl bg-surface2 p-3 text-left shadow-card">
      <span className="text-brand">{icon}</span>
      <span className="text-[14px] font-semibold leading-tight">{label}</span>
      <span className="text-[11.5px] text-ink3">{sub}</span>
    </button>
  )
}
function CtlRow({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="pressable flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left">
      <span className="text-ink3">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{label}</span><span className="block text-[12px] text-ink3">{sub}</span></span>
      <ChevronRight size={17} className="text-ink3" />
    </button>
  )
}

function StepsAndReadiness({ today, steps, target, advice, suggestUp, onRaise }: { today: string; steps?: number; target: number; advice: string; suggestUp: boolean; onRaise: () => void }) {
  const [val, setVal] = useState('')
  const { toast } = useUI()
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Footprints size={18} className="text-brand" />
        <div className="flex-1 text-[14px]"><b>{steps?.toLocaleString() ?? '—'}</b> <span className="text-ink3">/ {target.toLocaleString()} today</span></div>
      </div>
      <div className="flex gap-2">
        <Input inputMode="numeric" placeholder="Steps today" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Steps today" />
        <Button small onClick={() => { const n = parseInt(val, 10); if (!(n >= 0)) return; void saveCheckin({ date: today, steps: n }).then(() => { setVal(''); toast('Steps saved') }) }}>Save</Button>
      </div>
      <div className="text-[12.5px] text-ink2">{advice}</div>
      {suggestUp && <Button small variant="secondary" onClick={onRaise}>Raise my step target</Button>}
    </div>
  )
}

// ---------- start: readiness check-in then build the session ----------
export function StartSheet({ plan, day, week, weekMonday, onClose }: { plan: Plan; day: DayKey | null; week: number; weekMonday: string; onClose: () => void }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const [c, setC] = useState({ sleep: 3, energy: 3, soreness: 3, readiness: 3 })
  const [bw, setBw] = useState('')
  const [choice, setChoice] = useState<'maintain' | 'reduce' | 'drop-set' | null>(null)
  const [busy, setBusy] = useState(false)
  if (!day) return null
  const adv = readinessAdvice(c)
  const plannedFor = dateOfDay(weekMonday, day)
  async function go(skipCheckin = false) {
    if (busy || !day) return
    setBusy(true)
    try {
      const bwKg = parseFloat(bw)
      if (bwKg > 30 && bwKg < 300) await upsertTodayWeighIn(Math.round(bwKg * 10) / 10)
      if (!skipCheckin) await saveCheckin({ date: todayStr(), ...c })
      const isDeload = (plan.manualDeloads ?? []).includes(programWeekFor(plan, todayStr()).calendarWeek)
      const built = await buildProgramSession(plan, week, day, {
        checkin: skipCheckin ? undefined : { ...c, ...(bwKg > 30 ? { bodyweightKg: bwKg } : {}) },
        deload: isDeload,
        adjust: choice === 'reduce' ? 'reduce' : choice === 'drop-set' ? 'drop-set' : undefined,
        plannedFor,
      })
      // training somewhere other than the program's gym → swap only what this room can't do
      let log = built.log
      const here = await getCurrentProfile()
      if (here && here.id !== (plan.equipmentProfileId ?? 'flex')) {
        const r = localiseLogToProfile(log, here)
        log = r.log
        if (r.swapped) toast(`${r.swapped} exercise${r.swapped === 1 ? '' : 's'} swapped for ${here.name}`)
      }
      await db.workoutLogs.add(log)
      toast(`${log.title} — let's go`)
      onClose()
      navigate(`/session/${log.id}`)
    } catch (e) {
      toast(`Could not start: ${(e as Error).message}`, 'error')
    } finally { setBusy(false) }
  }
  const scale = (k: keyof typeof c, label: string, lo: string, hi: string) => (
    <div>
      <div className="mb-1 flex justify-between text-[12.5px]"><span className="font-semibold">{label}</span><span className="text-ink3">{lo} → {hi}</span></div>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={c[k] === n} onClick={() => setC((p) => ({ ...p, [k]: n }))}
            className={`pressable h-11 flex-1 rounded-xl text-[15px] font-bold ${c[k] === n ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{n}</button>
        ))}
      </div>
    </div>
  )
  return (
    <Sheet open onClose={onClose} title="How are you today?">
      <div className="space-y-3.5">
        {scale('sleep', 'Sleep', 'awful', 'great')}{scale('energy', 'Energy', 'flat', 'high')}
        {scale('soreness', 'Soreness', 'none', 'very sore')}{scale('readiness', 'Readiness', 'not ready', 'ready')}
        <Field label="Bodyweight (optional, kg)"><Input inputMode="decimal" value={bw} onChange={(e) => setBw(e.target.value)} /></Field>
        <Callout tone={adv.level === 'good' ? 'good' : adv.level === 'ok' ? 'neutral' : 'warn'}>{adv.text}</Callout>
        {adv.options.length > 0 && (
          <div className="space-y-1.5">
            {adv.options.map((o) => (
              <button key={o.id} type="button" onClick={() => setChoice(choice === o.id ? null : o.id)}
                className={`pressable w-full rounded-xl border p-3 text-left ${choice === o.id ? 'border-brand bg-brand/10' : 'border-line bg-surface2'}`}>
                <div className="text-[14px] font-semibold">{o.label}</div><div className="text-[12px] text-ink3">{o.detail}</div>
              </button>
            ))}
          </div>
        )}
        <Button full disabled={busy} onClick={() => void go()}><Play size={16} /> {busy ? 'Building session…' : 'Start session'}</Button>
        <Button full variant="ghost" disabled={busy} onClick={() => void go(true)}>Skip the check-in</Button>
      </div>
    </Sheet>
  )
}

function CardioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useUI()
  const [kind, setKind] = useState<CardioLog['kind']>('incline-walk')
  const [min, setMin] = useState('20')
  const [hr, setHr] = useState('')
  const [inc, setInc] = useState('')
  const [spd, setSpd] = useState('')
  async function save() {
    const m = parseFloat(min)
    if (!(m > 0)) return toast('Enter minutes', 'error')
    const me = await getProfile()
    const met = kind === 'incline-walk' ? 5.3 : kind === 'bike' ? 6.8 : kind === 'elliptical' ? 5 : 3.5
    await db.cardioLog.add({
      id: newId(), date: todayStr(), kind, seconds: Math.round(m * 60), createdAt: nowIso(), program: true,
      calories: Math.round(met * (me?.weightKg ?? 90) * (m / 60)),
      ...(parseFloat(hr) > 0 ? { avgHr: parseFloat(hr) } : {}), ...(parseFloat(inc) >= 0 && inc ? { inclinePct: parseFloat(inc) } : {}), ...(parseFloat(spd) > 0 ? { speedKmh: parseFloat(spd) } : {}),
    })
    toast('Cardio logged'); onClose()
  }
  if (!open) return null
  return (
    <Sheet open onClose={onClose} title="Log cardio">
      <div className="space-y-3">
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as CardioLog['kind'])}>
          <option value="incline-walk">Incline treadmill walk</option><option value="bike">Stationary bike</option><option value="elliptical">Elliptical</option><option value="walk">Outdoor walk</option>
        </Select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Minutes"><Input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Avg heart rate (optional)"><Input inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} /></Field>
          {kind === 'incline-walk' && <Field label="Incline % (optional)"><Input inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} /></Field>}
          {kind === 'incline-walk' && <Field label="Speed km/h (optional)"><Input inputMode="decimal" value={spd} onChange={(e) => setSpd(e.target.value)} /></Field>}
        </div>
        <div className="text-[12px] text-ink3">Zone 2 = you can still talk in full sentences. Your own numbers are the right numbers.</div>
        <Button full onClick={() => void save()}>Save</Button>
      </div>
    </Sheet>
  )
}
