// /program/day/:week/:day — one program session in full: every exercise card
// with today's prescribed load (and why), warm-ups, RIR, rest, superset blocks,
// and the "why / muscles / prepares you for / progression" detail.

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { ChevronDown, ChevronRight, Flame, Footprints, Info, Play, Repeat, Timer, Trophy } from 'lucide-react'
import { db } from '@/db'
import { Badge, Button, Callout, Card, PageHeader, Spinner } from '@/components/ui'
import { MuscleTiers, RirTag, TransferChips, fmtRest } from '@/components/program'
import { ExerciseAnim } from '@/anim/rig'
import { byId } from '@/data/exercises'
import { knowledgeFor } from '@/data/knowledge'
import { coachingFor } from '@/data/coaching'
import { MEDIA } from '@/data/media'
import { DAY_LABEL, MAIN_LIFT_OF, PHASES, type DayKey } from '@/data/program12'
import { MUSCLE_LABELS, type ExerciseMeta, type PlanExercise } from '@/db/types'
import { getCurrentProfile } from '@/lib/equipment'
import { warmupRamp } from '@/lib/training'
import { dayIdFor, mondayBefore, pastSessions, prescribeAccessory, prescribeMain, programWeekFor, type Prescription } from '@/lib/program12'
import { getProgramEquipment, getProgramPlan, getProgramSetup } from '@/lib/programStore'
import { todayStr } from '@/lib/id'
import { StartSheet, cardioText } from './ProgramScreen'
import { BarGraphic } from './tools/PlateTool'
import { planPlates } from '@/lib/onerm'
import type { AnyLoadMode } from '@/lib/plates'

export default function ProgramDayScreen() {
  const { week: ws, day: ds } = useParams()
  const navigate = useNavigate()
  const week = Math.min(12, Math.max(1, Number(ws) || 1))
  const day = (['tue', 'wed', 'thu', 'fri'].includes(ds ?? '') ? ds : 'tue') as DayKey
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const setup = useLiveQuery(() => getProgramSetup(), [])
  const eq = useLiveQuery(() => getProgramEquipment(), [])
  const meta = useLiveQuery(async () => new Map<string, ExerciseMeta>((await db.exerciseMeta.toArray()).map((m) => [m.exerciseId, m])), [])
  const [start, setStart] = useState(false)
  const bw = useLiveQuery(async () => (await db.profile.get('me'))?.weightKg, [])

  const pd = plan?.weeks[week - 1]?.days.find((d) => d.id === dayIdFor(week, day))
  const rx = useMemo(() => {
    const m = new Map<string, Prescription>()
    if (!pd || !logs || setup === undefined) return m
    for (const pe of pd.exercises) {
      m.set(pe.exerciseId, pe.role === 'main'
        ? prescribeMain(pe, pe.lift ?? (week === 12 && day === 'fri' ? 'deadlift' : MAIN_LIFT_OF[day]), week, logs, { ...(setup ?? {}), bodyweightKg: setup?.bodyweightKg ?? bw }, eq ?? null, meta?.get(pe.exerciseId))
        : prescribeAccessory(pe, logs, eq ?? null, meta?.get(pe.exerciseId), bw))
    }
    return m
  }, [pd, logs, setup, eq, meta, week, day, bw])

  if (plan === undefined || !logs) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  if (!plan || !pd) {
    return (
      <div><PageHeader title="Program day" back="/program" />
        <div className="px-4"><Callout tone="neutral">No program is active. Set one up from the Program screen.</Callout>
          <Button full className="mt-3" onClick={() => navigate('/program')}>Open the program</Button></div></div>
    )
  }
  const pw = programWeekFor(plan, todayStr())
  const weekMonday = dayjs(mondayBefore(plan.programStart ?? plan.startDate)).add(pw.calendarWeek * 7, 'day').format('YYYY-MM-DD')
  const isThisWeek = pw.week === week
  // group consecutive exercises sharing a superset letter into one block
  const blocks: { letter?: string; items: PlanExercise[] }[] = []
  for (const pe of pd.exercises) {
    const last = blocks[blocks.length - 1]
    if (pe.supersetGroup && last?.letter === pe.supersetGroup) last.items.push(pe)
    else blocks.push({ letter: pe.supersetGroup, items: [pe] })
  }
  return (
    <div className="pb-28">
      <PageHeader title={pd.title} subtitle={`${DAY_LABEL[day]} · Week ${week} · ${PHASES[week - 1].name} · ~${pd.estMinutes} min`} back="/program" />
      <div className="space-y-3 px-4">
        <Card className={`p-3.5 ${pd.kind === 'pr' ? 'border border-amber-400/40 bg-gradient-to-br from-amber-500/25 via-rose-500/10 to-surface2' : pd.kind === 'deload' ? 'border border-sky-400/30 bg-sky-500/5' : pd.kind === 'recovery' ? 'border border-emerald-400/30 bg-emerald-500/5' : 'border border-brand/20'}`}>
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide">
            {pd.kind === 'pr' ? <span className="flex items-center gap-1 text-amber-300"><Trophy size={13} /> PR day — optional side quest</span>
              : pd.kind === 'deload' ? <span className="text-sky-300">Deload</span> : pd.kind === 'recovery' ? <span className="text-emerald-300">Recovery / technique</span>
                : pd.kind === 'light' ? <span className="text-ink2">Maintenance volume</span> : <span className="text-brand">Week {week} · {PHASES[week - 1].name}</span>}
            <span className="text-ink3">· {pd.exercises.length} exercises · {pd.exercises.reduce((n, e) => n + e.sets, 0)} sets</span>
          </div>
          {pd.intent && <div className="mt-1 text-[13.5px] leading-snug">{pd.intent}</div>}
        </Card>
        {!isThisWeek && <Callout tone="neutral">This is week {week}. You are in week {pw.week}{pw.started ? '' : ' (not started yet)'} — loads shown are what the app would suggest today.</Callout>}
        {blocks.map((b, bi) => b.letter && b.items.length > 1 ? (
          <Card key={bi} className="border border-brand/25 p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand"><Repeat size={14} /> Superset {b.letter}</div>
            <div className="space-y-2">
              {b.items.map((pe, i) => <ExerciseCard key={pe.exerciseId} pe={pe} label={`${b.letter}${i + 1}`} rx={rx.get(pe.exerciseId)} logs={logs} />)}
            </div>
            <div className="mt-2 rounded-xl bg-surface3/60 px-3 py-2 text-[12.5px] text-ink2">
              <b>{b.letter}1</b> → <b>{b.letter}2</b> → rest {fmtRest(b.items[0].restSec)} → repeat for {Math.max(...b.items.map((x) => x.sets))} rounds. You can break the superset in the session.
            </div>
          </Card>
        ) : (
          <ExerciseCard key={bi} pe={b.items[0]} rx={rx.get(b.items[0].exerciseId)} logs={logs} />
        ))}
        <Card className="flex items-start gap-3 p-3.5">
          <Footprints size={18} className="mt-0.5 shrink-0 text-emerald-400" />
          <div className="text-[13px]">
            <div className="font-semibold">Cardio today</div>
            <div className="text-ink2">{pd.cardio ? `${cardioText(pd)} — after lifting, conversational (Zone 2) pace.${pd.cardio.note ? ` ${pd.cardio.note}` : ''}` : day === 'thu' && pd.kind !== 'recovery' ? 'None today — keep the legs fresh around deadlifts. Steps still count.' : 'None programmed today. Steps still count.'}</div>
          </div>
        </Card>
      </div>
      {/* sits directly ABOVE the tab bar (it used to slide underneath it) */}
      <div className="fixed inset-x-0 z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-xl" style={{ bottom: 'calc(var(--sab) + 58px)' }}>
        <Button full onClick={() => setStart(true)}><Play size={17} /> Start this session</Button>
      </div>
      {start && <StartSheet plan={plan} day={day} week={isThisWeek ? week : week} weekMonday={weekMonday} onClose={() => setStart(false)} />}
    </div>
  )
}

function ExerciseCard({ pe, label, rx, logs }: { pe: PlanExercise; label?: string; rx?: Prescription; logs: import('@/db/types').WorkoutLog[] }) {
  const navigate = useNavigate()
  const ex = byId.get(pe.exerciseId)
  const k = knowledgeFor(pe.exerciseId)
  const c = coachingFor(pe.exerciseId)
  const media = MEDIA[pe.exerciseId]
  const [open, setOpen] = useState<null | 'why' | 'muscles' | 'prep' | 'prog' | 'coach'>(null)
  const eq = useLiveQuery(() => getProgramEquipment(), [])
  if (!ex) return <Card className="p-3 text-[13px] text-ink3">Unknown exercise {pe.exerciseId}</Card>
  const last = pastSessions(logs, pe.exerciseId, 1)[0]
  const reps = pe.reps[0] === pe.reps[1] ? `${pe.reps[0]}` : `${pe.reps[0]}–${pe.reps[1]}`
  const work = rx?.sets.filter((s) => s.kind !== undefined) ?? []
  const firstKg = work.find((s) => s.kg)?.kg
  const warm = pe.role === 'main' && firstKg && eq ? warmupRamp(firstKg, ex, eq) : []
  const toggle = (t: typeof open) => setOpen(open === t ? null : t)
  return (
    <div className="rounded-2xl bg-surface2 p-3 shadow-card">
      <div className="flex gap-3">
        <div className="shrink-0 overflow-hidden rounded-xl bg-surface3/50">{media?.video ? <video src={media.video} poster={media.imgSmall} autoPlay loop muted playsInline preload="metadata" aria-label={`${ex.name} demonstration`} className="h-[112px] w-[112px] bg-black object-contain" />
          : media ? <img src={media.imgSmall ?? media.img} alt={`${ex.name} start and finish`} loading="lazy" decoding="async" className="h-[84px] w-[112px] object-cover" /> : <ExerciseAnim def={ex.anim} size={84} />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {label && <span className="shout text-[14px] text-brand">{label}</span>}
            <button type="button" className="pressable truncate text-left text-[16px] font-semibold" onClick={() => navigate(`/exercise/${ex.id}`)}>{ex.name}</button>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">{pe.goal && <Badge tone={pe.goal === 'SBD side quest' ? 'amber' : pe.goal === 'Hypertrophy' ? 'purple' : pe.goal === 'Exercise skill' ? 'green' : 'blue'}>{pe.goal}</Badge>}{pe.perSide && <Badge tone="gray">each side</Badge>}{pe.userAdded && <Badge tone="gray">added by you</Badge>}</div>
          <div className="mt-0.5 text-[12px] text-ink3">{ex.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px]">
            <b>{pe.scheme?.kind === 'pr-test' ? 'PR attempts' : pe.scheme?.kind === 'top-backoff' || pe.scheme?.kind === 'single-backoff' ? `1 × ${pe.scheme.topReps} @ RPE ${pe.scheme.topRpe?.join('–')} + ${pe.scheme.backoffSets} × ${pe.scheme.backoffReps?.[0]}` : `${pe.sets} × ${reps}`}</b>
            <RirTag rir={pe.rir} />
            {pe.rpe && pe.scheme?.kind !== 'top-backoff' && pe.scheme?.kind !== 'single-backoff' && <span className="text-ink3">RPE {pe.rpe.join('–')}</span>}
            <span className="flex items-center gap-0.5 text-ink3"><Timer size={12} /> {fmtRest(pe.restSec)}</span>
          </div>
        </div>
      </div>
      {pe.whyToday && <div className="mt-2.5 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-[12.5px] leading-relaxed"><b className="text-brand">WHY TODAY:</b> {pe.whyToday}</div>}
      {c && (
        <div className="mt-2 grid grid-cols-1 gap-1 rounded-xl bg-surface3/40 px-3 py-2 text-[12.5px] leading-snug">
          <div><b className="text-emerald-300">TIP:</b> {c.tip}</div>
          <div><b className="text-sky-300">FEEL:</b> {c.feel}</div>
          <div><b className="text-rose-300">AVOID:</b> {c.avoid}</div>
          <div><b className="text-amber-300">PROGRESSION:</b> {c.progression}</div>
        </div>
      )}
      {pe.pullProgression && <PullJourney current={pe.exerciseId} />}
      {rx && (
        <div className="mt-2.5 rounded-xl bg-brand/8 px-3 py-2">
          <div className="text-[13px] font-semibold text-ink">
            {work.length ? work.map((s) => (s.kg ? `${s.kg} kg` : 'pick a load') + (s.kind === 'top' || s.kind === 'single' ? ' (top)' : s.kind === 'backoff' ? ' (back-off)' : s.kind === 'pr-attempt' ? ' (attempt)' : '')).filter((v, i, a) => a.indexOf(v) === i).join(' · ') : 'Bodyweight'}
          </div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-ink2">{rx.why}</div>
          {rx.flags.includes('overreach') && <div className="mt-1 text-[12px] font-semibold text-amber-400">Possible overreach — see note above.</div>}
        </div>
      )}
      {rx && rx.sets.length > 0 && (
        <div className="mt-2 space-y-1">
          {rx.sets.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-surface3/50 px-2.5 py-1.5 text-[12.5px]">
              <span className="font-bold">SET {i + 1}{s.kind === 'top' ? ' · top' : s.kind === 'single' ? ' · single' : s.kind === 'backoff' ? ' · back-off' : s.kind === 'pr-attempt' ? ' · attempt' : ''}</span>
              <span className="text-ink2">{s.reps[0] === s.reps[1] ? s.reps[0] : `${s.reps[0]}–${s.reps[1]}`} reps{s.rir ? ` · ${s.rir[0] >= 4 ? '4+' : s.rir[0] === s.rir[1] ? s.rir[0] : s.rir.join('–')} RIR` : s.rpe ? ` · RPE ${s.rpe.join('–')}` : ''}</span>
              <b>{s.kg ? `${s.kg} kg` : '—'}</b>
            </div>
          ))}
          <div className="px-1 text-[11px] text-ink3">The program sets the exercise, sets, reps and RIR. The weight is only a recommendation from your history.</div>
        </div>
      )}
      {pe.alternative && pe.alternative !== pe.exerciseId && <div className="mt-1.5 text-[12px] text-ink3">Alternative if busy: <button type="button" className="text-brand" onClick={() => navigate(`/exercise/${pe.alternative}`)}>{byId.get(pe.alternative)?.name ?? pe.alternative}</button></div>}
      {firstKg && eq && (ex.loadMode === 'barbell' || ex.loadMode === 'smith' || ex.loadMode === 'curl-bar') && (() => {
        const b = planPlates(ex.loadMode as AnyLoadMode, firstKg, eq)
        return b && b.perSide.length > 0 ? (
          <div className="mt-2 rounded-xl bg-surface3/40 p-1.5">
            <BarGraphic perSide={b.perSide} barKg={b.barKg} maxPlate={Math.max(...eq.platePairsKg, 1)} />
            <div className="text-center text-[11.5px] text-ink3">{b.totalKg} kg = {b.barKg} kg bar + {b.perSide.join(' + ')} each side</div>
          </div>
        ) : null
      })()}
      {warm.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink2">
          <Flame size={13} className="text-orange-400" /> Warm-ups (not counted as volume): {warm.map((w) => `${w.kg}×${w.reps}`).join(' · ')}
        </div>
      )}
      <div className="mt-2 text-[12px] text-ink3">Last time: {last ? `${last.sets.map((s) => `${s.weightKg ?? 'BW'}×${s.reps ?? '-'}`).join(', ')} (${dayjs(last.date).format('D MMM')})` : 'not done yet'}</div>
      {pe.cue && !c && <div className="mt-1 text-[12.5px] text-ink2"><Info size={12} className="mr-1 inline" />{pe.cue}</div>}
      {pe.note && <div className="mt-1 text-[12px] italic text-ink3">{pe.note}</div>}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {([['why', 'Why this exercise'], ['muscles', 'View muscles'], ['prep', 'What it prepares you for'], ['prog', 'View progression']] as const).map(([t, l]) => (
          <button key={t} type="button" onClick={() => toggle(t)} aria-expanded={open === t}
            className={`pressable flex min-h-[40px] items-center justify-between rounded-xl px-2.5 text-left text-[12px] font-semibold ${open === t ? 'bg-brand/15 text-brand' : 'bg-surface3/60 text-ink2'}`}>
            {l}{open === t ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ))}
      </div>
      {open === 'why' && k && <div className="mt-2 rounded-xl bg-surface3/40 p-3 text-[13px] leading-relaxed">{k.why}<div className="mt-2"><TransferChips id={ex.id} /></div></div>}
      {open === 'muscles' && <div className="mt-2 flex justify-center rounded-xl bg-surface3/40 p-3"><MuscleTiers ex={ex} size={150} /></div>}
      {open === 'prep' && k && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-surface3/40 p-3 text-[12.5px]">
          <div><b>Develops:</b> {k.develops.join(', ') || '—'}</div>
          {k.mayHelp.length > 0 && <div><b>May help:</b> {k.mayHelp.join(', ')}</div>}
          <div><b>Prepares you for:</b> {k.preparesFor.join(', ') || '—'}</div>
          <div><b>What prepares you for it:</b> {k.preparedBy.join(', ') || '—'}</div>
          <div className="text-[11.5px] text-ink3">Transfer is never guaranteed — these are the relationships the program is built around.</div>
        </div>
      )}
      {open === 'prog' && k && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-surface3/40 p-3 text-[12.5px]">
          {k.regression && <><button type="button" className="text-brand" onClick={() => navigate(`/exercise/${k.regression}`)}>{byId.get(k.regression)?.name ?? k.regression}</button><span className="text-ink3">→</span></>}
          <b>{ex.name}</b>
          {k.progression && <><span className="text-ink3">→</span><button type="button" className="text-brand" onClick={() => navigate(`/exercise/${k.progression}`)}>{byId.get(k.progression)?.name ?? k.progression}</button></>}
          {k.unlocks && k.unlocks.length > 1 && <div className="w-full text-[11.5px] text-ink3">Unlock path: {[ex.name, ...k.unlocks.map((u) => byId.get(u)?.name ?? u)].join(' → ')}</div>}
        </div>
      )}
    </div>
  )
}

const PULL_CHAIN = ['lat-pulldown', 'assisted-pull-up', 'pull-up', 'weighted-pull-up']
function PullJourney({ current }: { current: string }) {
  const at = Math.max(0, PULL_CHAIN.indexOf(current))
  return (
    <div className="mt-2 rounded-xl bg-surface3/40 px-3 py-2">
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink3">Pull-up journey — you are here</div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
        {PULL_CHAIN.map((id, i) => (
          <span key={id} className="flex items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 ${i === at ? 'bg-brand font-bold text-white' : i < at ? 'bg-emerald-500/20 text-emerald-200' : 'bg-surface3 text-ink3'}`}>{byId.get(id)?.name ?? id}</span>
            {i < PULL_CHAIN.length - 1 && <span className="text-ink3">→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
