// PR Quest · Interactive body + muscle library · Skill trees · Research · Strength journey
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { BookOpen, ChevronRight, ShieldCheck, Trophy } from 'lucide-react'
import { db, getProfile } from '@/db'
import { Badge, Button, Callout, Card, Input, PageHeader, Section, Sheet, Spinner } from '@/components/ui'
import { LineChart } from '@/components/charts'
import { MuscleMap } from '@/anim/MuscleMap'
import { byId } from '@/data/exercises'
import { SKILL_TREES, LEVELS } from '@/data/knowledge'
import { PRINCIPLES, refById } from '@/data/research'
import { LIFT_EXERCISE, STICKING, VOLUME_TARGETS, type LiftKey, type VolumeGroup } from '@/data/program12'
import { MUSCLE_LABELS, type Muscle, type WorkoutLog } from '@/db/types'
import { getCurrentProfile } from '@/lib/equipment'
import { e1rmSeries } from '@/lib/training'
import { E1RM_FORMULA, VOLUME_CALC_NOTE, actualPR, e1rm, estimateFor, loggedVolume, prAttempts, programWeekFor } from '@/lib/program12'
import { LEVEL_NOTE, exercisePRSet, getProgramEquipment, getProgramPlan, getProgramSetup, setPullStage, skillLevels, stickingSummary } from '@/lib/programStore'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'

const LIFTS: { key: LiftKey; label: string }[] = [{ key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bench' }, { key: 'deadlift', label: 'Deadlift' }]

// ============================================================
// PR QUEST
// ============================================================
export function PRQuestScreen() {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const setup = useLiveQuery(() => getProgramSetup(), [])
  const weighIns = useLiveQuery(() => db.weighIns.toArray(), [])
  const [coach, setCoach] = useState<LiftKey | null>(null)
  if (!logs || setup === undefined || !weighIns) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  const bwOn = (date?: string) => { if (!date) return undefined; const w = [...weighIns].filter((x) => x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]; return w?.weightKg }
  const stick = stickingSummary(logs)
  return (
    <div className="pb-6">
      <PageHeader title="PR Quest" subtitle="The side quest. Physique and health come first — PRs ride along." back="/program" />
      <div className="space-y-4 px-4">
        <Callout tone="neutral">Testing is optional. Test lifts on separate days when recovery needs it — never all three on one day by default.</Callout>
        {LIFTS.map(({ key, label }) => {
          const id = LIFT_EXERCISE[key]
          const est = estimateFor(id, logs, setup?.[key])
          const pr = actualPR(key, logs, setup ?? {})
          const prs = exercisePRSet(logs, id)
          const series = e1rmSeries(logs, id)
          const st = stick.find((s) => s.lift === key)!
          return (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-2"><Trophy size={18} className="text-brand" /><h2 className="flex-1 text-[18px] font-bold">{label}</h2>
                <Button small onClick={() => setCoach(key)}>Start PR session</Button></div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-surface3 p-2.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink3">Actual 1RM PR</div>
                  <div className="text-[20px] font-bold">{pr ? `${pr.kg} kg` : '—'}</div><div className="text-[11px] text-ink3">{pr ? `${pr.date ? dayjs(pr.date).format('D MMM YY') : ''}${bwOn(pr.date) ? ` · at ${bwOn(pr.date)} kg BW` : ''}` : 'No tested single yet'}</div></div>
                <div className="rounded-xl bg-surface3 p-2.5"><div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink3">Estimated 1RM</div>
                  <div className="text-[20px] font-bold">{est.e1rm ? `${Math.round(est.e1rm)} kg` : '—'}</div><div className="text-[11px] text-ink3">{est.e1rm ? 'estimate — not a PR' : 'No data yet'}</div></div>
              </div>
              <div className="mt-2 text-[12px] text-ink3">{est.detail}</div>
              {series.length > 1 ? <div className="mt-2"><LineChart points={series} height={120} unit="kg" /></div> : <div className="mt-2 text-[12px] text-ink3">The estimated-1RM chart appears after two sessions.</div>}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11.5px]">
                <div className="rounded-lg bg-surface3/60 p-1.5"><div className="text-ink3">Heaviest set</div><b>{prs.bestKg ? `${prs.bestKg.kg}×${prs.bestKg.reps}` : '—'}</b></div>
                <div className="rounded-lg bg-surface3/60 p-1.5"><div className="text-ink3">Rep PR</div><b>{prs.bestReps ? `${prs.bestReps.reps} @ ${prs.bestReps.kg}` : '—'}</b></div>
                <div className="rounded-lg bg-surface3/60 p-1.5"><div className="text-ink3">Volume PR</div><b>{prs.bestVolume ? `${Math.round(prs.bestVolume.kg).toLocaleString()} kg` : '—'}</b></div>
              </div>
              <div className="mt-3 rounded-xl bg-surface3/40 p-3 text-[12.5px]">
                <div className="font-semibold">Where it gets hardest</div>
                {st.total ? <div className="mt-1 text-ink2">{STICKING[key].map((p) => `${p}: ${st.counts[p] ?? 0}`).join(' · ')}</div> : <div className="mt-1 text-ink3">Tag hard sets in the session to see a pattern.</div>}
                {st.trend && st.suggestion ? <div className="mt-1.5 text-ink2"><b>Pattern: {st.trend.toLowerCase()}</b> ({st.counts[st.trend]} of {st.total}). {st.suggestion.why} Possible tools: {st.suggestion.tools.map((t) => byId.get(t)?.name ?? t).join(', ')}. These are options, not a diagnosis.</div>
                  : st.total ? <div className="mt-1 text-[11.5px] text-ink3">No clear pattern yet — at least 4 tagged sets with one area making up half of them.</div> : null}
              </div>
            </Card>
          )
        })}
        <Card className="p-3 text-[12px] leading-relaxed text-ink3">{E1RM_FORMULA}</Card>
      </div>
      {coach && <PRCoachSheet lift={coach} logs={logs} onClose={() => setCoach(null)} />}
    </div>
  )
}

function PRCoachSheet({ lift, logs, onClose }: { lift: LiftKey; logs: WorkoutLog[]; onClose: () => void }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const setup = useLiveQuery(() => getProgramSetup(), [])
  const eq = useLiveQuery(() => getProgramEquipment(), [])
  const checkin = useLiveQuery(() => db.checkins.get(todayStr()).catch(() => undefined), [])
  const plan = useMemo(() => (setup !== undefined && eq !== undefined ? prAttempts(lift, logs, setup ?? {}, eq) : null), [lift, logs, setup, eq])
  const [edits, setEdits] = useState<Record<number, string>>({})
  if (!plan) return null
  const kg = (n: number) => Number(edits[n] ?? plan.attempts[n - 1].kg) || plan.attempts[n - 1].kg
  async function begin() {
    const id = LIFT_EXERCISE[lift]
    const sets = [
      ...plan!.warmups.map((w, i) => ({ setIndex: i, targetReps: [parseInt(w.reps, 10) || 1, parseInt(w.reps, 10) || 1] as [number, number], weightKg: w.kg, done: false, warmup: true })),
      ...[1, 2, 3].map((n, i) => ({ setIndex: plan!.warmups.length + i, targetReps: [1, 1] as [number, number], weightKg: kg(n), plannedKg: kg(n), kind: 'pr-attempt' as const, done: false })),
    ]
    const log: WorkoutLog = {
      id: newId(), date: todayStr(), title: `PR Session — ${lift[0].toUpperCase() + lift.slice(1)}`, startedAt: nowIso(),
      exercises: [{ exerciseId: id, sets }],
      prSession: { lift, attempts: [1, 2, 3].map((n) => ({ planned: kg(n) })) },
      ...(eq ? { equipmentProfileId: eq.id, equipmentProfileName: eq.name } : {}),
    }
    await db.workoutLogs.add(log)
    toast('PR session started — warm up properly, then attempt 1')
    onClose(); navigate(`/session/${log.id}`)
  }
  return (
    <Sheet open onClose={onClose} title={`PR coach — ${lift}`} tall>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
          <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Current PR</div><b>{plan.currentPR ? `${plan.currentPR.kg} kg` : '—'}</b></div>
          <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Recent e1RM</div><b>{plan.estimate.e1rm ? `${Math.round(plan.estimate.e1rm)} kg` : '—'}</b></div>
          <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Readiness</div><b>{checkin?.readiness ? `${checkin.readiness}/5` : 'not logged'}</b></div>
        </div>
        <div className="text-[12.5px] text-ink2">{plan.why}</div>
        <div className="space-y-2">
          {plan.attempts.map((a) => (
            <div key={a.n} className="rounded-xl bg-surface2 p-3">
              <div className="flex items-center gap-2"><b className="flex-1 text-[14px]">Attempt {a.n}</b>
                <Input aria-label={`Attempt ${a.n} kg`} inputMode="decimal" className="w-24 text-right" value={edits[a.n] ?? String(a.kg)} onChange={(e) => setEdits((p) => ({ ...p, [a.n]: e.target.value }))} /><span className="text-ink3">kg</span></div>
              <div className="mt-1 text-[12px] text-ink3">{a.label}</div>
            </div>
          ))}
        </div>
        <Section title="Warm-ups">
          <Card className="divide-y divide-line">{plan.warmups.map((w, i) => <div key={i} className="flex justify-between px-3 py-2 text-[13px]"><span>{w.pct ? `~${Math.round(w.pct * 100)}%` : 'Bar'}</span><span><b>{w.kg} kg</b> × {w.reps}</span></div>)}</Card>
          <div className="mt-1 text-[11.5px] text-ink3">Percentages of your estimated max, snapped to real plates. Skip or repeat rungs as you feel — they are guidance, not rules.</div>
        </Section>
        <Callout tone="warn" icon={<ShieldCheck size={16} />}>{plan.safety} Never attempt a max purely because an equation says you can.</Callout>
        <Button full onClick={() => void begin()}>Start PR session</Button>
      </div>
    </Sheet>
  )
}

// ============================================================
// INTERACTIVE BODY + MUSCLE LIBRARY
// ============================================================
interface LibMuscle { id: string; label: string; muscles: Muscle[]; group: VolumeGroup | null; match?: (exId: string) => boolean; trees: string[] }
const LIBRARY: LibMuscle[] = [
  { id: 'chest', label: 'Chest', muscles: ['chest'], group: 'chest', trees: ['press', 'push'] },
  { id: 'upper-chest', label: 'Upper Chest', muscles: ['chest'], group: 'chest', match: (id) => /incline/.test(id), trees: ['press'] },
  { id: 'lats', label: 'Lats', muscles: ['lats'], group: 'back', trees: ['pull'] },
  { id: 'upper-back', label: 'Upper Back', muscles: ['upper-back'], group: 'back', trees: ['pull'] },
  { id: 'traps', label: 'Traps', muscles: ['traps'], group: 'back', trees: ['hinge'] },
  { id: 'quads', label: 'Quads', muscles: ['quads'], group: 'quads', trees: ['squat'] },
  { id: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'], group: 'hamstrings', trees: ['hinge'] },
  { id: 'glutes', label: 'Glutes', muscles: ['glutes'], group: 'glutes', trees: ['squat', 'hinge'] },
  { id: 'calves', label: 'Calves', muscles: ['calves'], group: 'calves', trees: [] },
  { id: 'side-delts', label: 'Side Delts', muscles: ['side-delts'], group: 'side-delts', trees: [] },
  { id: 'front-delts', label: 'Front Delts', muscles: ['front-delts'], group: null, trees: ['press'] },
  { id: 'rear-delts', label: 'Rear Delts', muscles: ['rear-delts'], group: 'rear-delts', trees: [] },
  { id: 'biceps', label: 'Biceps', muscles: ['biceps'], group: 'biceps', trees: ['pull'] },
  { id: 'triceps', label: 'Triceps', muscles: ['triceps'], group: 'triceps', trees: ['press', 'push'] },
  { id: 'forearms', label: 'Forearms', muscles: ['forearms'], group: 'forearms', trees: ['hinge'] },
  { id: 'core', label: 'Core', muscles: ['abs', 'obliques'], group: 'core', trees: ['core'] },
]
const libFor = (m: Muscle) => LIBRARY.find((l) => l.muscles.includes(m) && !l.match) ?? null

export function BodyScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  const sel = LIBRARY.find((l) => l.id === params.get('m')) ?? null
  if (!logs || plan === undefined) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  const today = todayStr()
  const mon = dayjs(today).subtract((dayjs(today).day() + 6) % 7, 'day').format('YYYY-MM-DD')
  const vol = loggedVolume(logs, mon, today)
  const heat: Partial<Record<Muscle, number>> = {}
  for (const l of LIBRARY) if (l.group && !l.match) for (const m of l.muscles) heat[m] = vol[l.group].direct / Math.max(1, VOLUME_TARGETS[l.group].range[0])
  return (
    <div className="pb-6">
      <PageHeader title="Your body" subtitle="Tap a muscle. Colour = direct sets this week vs your target." back="/program" />
      <div className="space-y-4 px-4">
        <Card className="flex flex-col items-center p-4">
          <MuscleMap primary={[]} heat={heat} size={260} showLabels selected={sel?.muscles[0] ?? null} onTap={(m) => { const l = libFor(m); if (l) setParams({ m: l.id }, { replace: true }) }} />
          <div className="mt-2 text-center text-[11.5px] text-ink3">This shows training you have logged — it does not measure actual muscle growth.</div>
        </Card>
        {sel && <MusclePanel lib={sel} logs={logs} planWeeks={plan ?? null} />}
        <Section title="Muscle library">
          <div className="grid grid-cols-2 gap-2">
            {LIBRARY.map((l) => (
              <button key={l.id} type="button" onClick={() => setParams({ m: l.id }, { replace: true })}
                className={`pressable flex min-h-[48px] items-center justify-between rounded-xl px-3 text-left text-[13.5px] font-semibold ${sel?.id === l.id ? 'bg-brand text-white' : 'bg-surface2'}`}>
                {l.label}<span className="text-[11px] font-normal opacity-80">{l.group ? `${vol[l.group].direct} sets` : ''}</span>
              </button>
            ))}
          </div>
        </Section>
        <div className="text-[11.5px] text-ink3">{VOLUME_CALC_NOTE}</div>
        <Button full variant="secondary" onClick={() => navigate('/skills')}>See skill trees</Button>
      </div>
    </div>
  )
}

function MusclePanel({ lib, logs, planWeeks }: { lib: LibMuscle; logs: WorkoutLog[]; planWeeks: import('@/db/types').Plan | null }) {
  const navigate = useNavigate()
  const today = todayStr()
  const hits = (id: string) => { const ex = byId.get(id); if (!ex) return false; if (lib.match) return lib.match(id) && ex.primary.some((m) => lib.muscles.includes(m)); return ex.primary.some((m) => lib.muscles.includes(m)) }
  const touches = (id: string) => { const ex = byId.get(id); return !!ex && (ex.primary.some((m) => lib.muscles.includes(m)) || ex.secondary.some((m) => lib.muscles.includes(m))) }
  const done = logs.filter((l) => l.finishedAt).sort((a, b) => b.date.localeCompare(a.date))
  const lastLog = done.find((l) => l.exercises.some((e) => hits(e.exerciseId) && e.sets.some((s) => s.done && !s.warmup)))
  const weeks = [...Array(6)].map((_, i) => {
    const mon = dayjs(today).subtract((dayjs(today).day() + 6) % 7, 'day').subtract(i * 7, 'day')
    let direct = 0, contrib = 0
    for (const l of logs) {
      if (l.date < mon.format('YYYY-MM-DD') || l.date > mon.add(6, 'day').format('YYYY-MM-DD')) continue
      for (const e of l.exercises) { const n = e.sets.filter((s) => s.done && !s.warmup).length; if (hits(e.exerciseId)) direct += n; else if (touches(e.exerciseId)) contrib += n * 0.5 }
    }
    return { x: mon.format('D/M'), direct, contrib }
  }).reverse()
  const freq = new Set(done.filter((l) => dayjs(today).diff(dayjs(l.date), 'day') < 28 && l.exercises.some((e) => hits(e.exerciseId))).map((l) => l.date)).size
  const prev = [...new Set(done.flatMap((l) => l.exercises.filter((e) => hits(e.exerciseId)).map((e) => e.exerciseId)))].slice(0, 10)
  let next: { date: string; title: string; ids: string[] } | null = null
  if (planWeeks) {
    for (let i = 0; i < 14 && !next; i++) {
      const d = dayjs(today).add(i, 'day').format('YYYY-MM-DD'), pw = programWeekFor(planWeeks, d), dk = ['', '', 'tue', 'wed', 'thu', 'fri', ''][dayjs(d).day()]
      if (!dk || !pw.started || pw.finished) continue
      const pd = planWeeks.weeks[pw.week - 1]?.days.find((x) => x.id === `p12-w${pw.week}-${dk}`)
      const ids = pd?.exercises.map((e) => e.exerciseId).filter(hits) ?? []
      if (pd && ids.length) next = { date: d, title: pd.title, ids }
    }
  }
  const current = planWeeks ? [...new Set(planWeeks.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))).filter(hits))] : []
  const best = prev.map((id) => ({ id, e: Math.max(0, ...done.flatMap((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.done && !s.warmup).map((s) => e1rm(s.weightKg ?? 0, s.reps ?? 0))))) })).filter((x) => x.e > 0).sort((a, b) => b.e - a.e)[0]
  const t = lib.group ? VOLUME_TARGETS[lib.group] : null
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-baseline justify-between"><h2 className="text-[19px] font-bold">{lib.label}</h2>
        {t && <span className="text-[12px] text-ink3">target {t.range[0] === t.range[1] ? `~${t.range[0]}` : `${t.range[0]}–${t.range[1]}`} direct sets{t.plus ? ` ${t.plus}` : ''}</span>}</div>
      <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">This week</div><b className="text-[16px]">{weeks[5].direct}</b><div className="text-[10.5px] text-ink3">+{weeks[5].contrib} contrib.</div></div>
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Last trained</div><b className="text-[14px]">{lastLog ? dayjs(lastLog.date).format('D MMM') : '—'}</b></div>
        <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Frequency</div><b className="text-[14px]">{freq}</b><div className="text-[10.5px] text-ink3">days / 4 wks</div></div>
      </div>
      <div><div className="mb-1 text-[12px] font-semibold text-ink3">Direct sets per week</div><LineChart points={weeks.map((w) => ({ x: w.x, y: w.direct }))} height={110} /></div>
      <div className="text-[13px]"><b>Next scheduled:</b> {next ? `${dayjs(next.date).format('ddd D MMM')} — ${next.title} (${next.ids.map((i) => byId.get(i)?.name).join(', ')})` : 'not in the next two weeks'}</div>
      <div className="text-[13px]"><b>In your program:</b> {current.length ? current.map((id) => <button key={id} type="button" className="mr-1.5 text-brand" onClick={() => navigate(`/exercise/${id}`)}>{byId.get(id)?.name}</button>) : '—'}</div>
      <div className="text-[13px]"><b>Done before:</b> {prev.length ? prev.map((id) => byId.get(id)?.name ?? id).join(', ') : 'nothing logged yet'}</div>
      {best && <div className="text-[13px]"><b>Strength trend:</b> best estimated 1RM on {byId.get(best.id)?.name}: {Math.round(best.e)} kg (estimate)</div>}
      {lib.trees.length > 0 && <div className="text-[13px]"><b>Skill trees:</b> {lib.trees.map((tid) => <button key={tid} type="button" className="mr-1.5 text-brand" onClick={() => navigate(`/skills#${tid}`)}>{SKILL_TREES.find((s) => s.id === tid)?.title}</button>)}</div>}
    </Card>
  )
}

// ============================================================
// SKILL TREES
// ============================================================
export function SkillsScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const profile = useLiveQuery(() => getProfile(), [])
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  const setup = useLiveQuery(() => getProgramSetup(), [])
  const [confirm, setConfirm] = useState<string | null>(null)
  if (!logs || !profile || plan === undefined) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  const levels = skillLevels(logs, profile.weightKg, setup?.pullStage)
  return (
    <div className="pb-6">
      <PageHeader title="Skill trees" subtitle="Regression → current → progression. Nothing is ever locked." back="/program" />
      <div className="space-y-4 px-4">
        {SKILL_TREES.map((t) => {
          const lv = levels.find((l) => l.treeId === t.id)
          return (
            <Card key={t.id} className="p-4" >
              <div id={t.id} className="flex items-baseline justify-between"><h2 className="text-[17px] font-bold">{t.title}</h2>{lv && <Badge tone={lv.level === 'Advanced' ? 'green' : lv.level === 'Competent' ? 'blue' : lv.level === 'Developing' ? 'amber' : 'gray'}>{lv.level}</Badge>}</div>
              <div className="text-[12.5px] text-ink3">{t.goal}{lv ? ` · ${lv.detail}` : ''}</div>
              <div className="mt-2 flex gap-1">{LEVELS.map((L) => <div key={L} className={`h-1.5 flex-1 rounded-full ${lv && LEVELS.indexOf(L) <= LEVELS.indexOf(lv.level) ? 'bg-brand' : 'bg-surface3'}`} />)}</div>
              <ol className="mt-3 space-y-1.5">
                {t.nodes.map((n, i) => {
                  const isCur = lv?.current === n.id || (t.id === 'pull' && setup?.pullStage === n.id)
                  const ex = byId.get(n.id)
                  return (
                    <li key={n.id} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${isCur ? 'bg-brand/15' : 'bg-surface3/40'}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface3 text-[12px] font-bold">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <button type="button" disabled={!ex} onClick={() => ex && navigate(`/exercise/${n.id}`)} className="pressable text-left text-[14px] font-semibold disabled:opacity-90">{n.label}{isCur ? ' · you are here' : ''}</button>
                        <div className="text-[11.5px] text-ink3">{n.criterion}</div>
                      </div>
                      {i < t.nodes.length - 1 ? <ChevronRight size={15} className="text-ink3" /> : <Trophy size={15} className="text-brand" />}
                    </li>
                  )
                })}
              </ol>
              {t.note && <div className="mt-2 text-[11.5px] text-ink3">{t.note}</div>}
              {t.id === 'pull' && lv?.next && plan && setup?.pullStage !== lv.next && (
                <Button small variant="secondary" className="mt-2" onClick={() => setConfirm(lv.next!)}>You may be ready — switch to {byId.get(lv.next)?.name}?</Button>
              )}
            </Card>
          )
        })}
        <div className="text-[11.5px] text-ink3">{LEVEL_NOTE}</div>
      </div>
      {confirm && plan && (
        <Sheet open onClose={() => setConfirm(null)} title="Change your vertical pull?">
          <div className="space-y-3 text-[13.5px]">
            <p>Every remaining Wednesday and Friday pull slot will use <b>{byId.get(confirm)?.name}</b>. Sessions already logged are untouched.</p>
            <Button full onClick={() => void setPullStage(plan, confirm).then(() => { toast('Vertical pull updated'); setConfirm(null) })}>Yes, switch</Button>
            <Button full variant="secondary" onClick={() => setConfirm(null)}>Not yet</Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ============================================================
// RESEARCH
// ============================================================
export function ResearchScreen() {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="pb-6">
      <PageHeader title="Research" subtitle="Why the program is built the way it is." back="/program" />
      <div className="space-y-2 px-4">
        <Callout tone="neutral" icon={<BookOpen size={16} />}>Sources are published reviews, meta-analyses, position stands and controlled trials. Journal details are given so you can look them up; page numbers and DOIs are left out rather than risk a wrong one. Nothing here is called "scientifically proven best".</Callout>
        {PRINCIPLES.map((p) => (
          <Card key={p.id} className="p-3.5">
            <button type="button" className="pressable flex w-full items-start gap-2 text-left" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              <div className="min-w-0 flex-1"><div className="text-[14.5px] font-semibold">{p.title}</div><div className="text-[12.5px] text-ink2">{p.summary}</div></div>
              <Badge tone={p.strength === 'strong' ? 'green' : p.strength === 'moderate' ? 'blue' : p.strength === 'emerging' ? 'amber' : 'gray'}>{p.strength}</Badge>
            </button>
            {open === p.id && (
              <div className="mt-2 space-y-1.5 border-t border-line pt-2 text-[12.5px]">
                <div><b>In your program:</b> {p.inApp}</div>
                {p.refs.map((r) => { const ref = refById.get(r); return ref ? <div key={r} className="text-ink3">{ref.authors} ({ref.year}). <i>{ref.title}</i>. {ref.source}. <span className="text-ink2">[{ref.kind}]</span></div> : null })}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// STRENGTH JOURNEY
// ============================================================
export function StrengthJourneyScreen() {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const setup = useLiveQuery(() => getProgramSetup(), [])
  const eq = useLiveQuery(() => getProgramEquipment(), [])
  if (!logs || setup === undefined || eq === undefined) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  const pull = logs.filter((l) => l.finishedAt).flatMap((l) => l.exercises.filter((e) => e.exerciseId === 'pull-up').map((e) => ({ x: dayjs(l.date).format('D/M'), y: Math.max(0, ...e.sets.filter((s) => s.done && !s.warmup).map((s) => s.reps ?? 0)) }))).filter((p) => p.y > 0)
  return (
    <div className="pb-6">
      <PageHeader title="Strength journey" subtitle="Where you started · where you are · where you're heading" back="/program" />
      <div className="space-y-3 px-4">
        {LIFTS.map(({ key, label }) => {
          const id = LIFT_EXERCISE[key], series = e1rmSeries(logs, id)
          const start = setup?.[key] ? e1rm(setup[key]!.kg, setup[key]!.reps) : series[0]?.y ?? 0
          const now = estimateFor(id, logs, setup?.[key]).e1rm
          const next = prAttempts(key, logs, setup ?? {}, eq ?? null).attempts[1]?.kg
          return (
            <Card key={key} className="p-4">
              <h2 className="text-[17px] font-bold">{label}</h2>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
                <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Started</div><b className="text-[16px]">{start ? `${Math.round(start)}` : '—'}</b><div className="text-[10px] text-ink3">e1RM kg</div></div>
                <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Now</div><b className="text-[16px] text-brand">{now ? `${Math.round(now)}` : '—'}</b><div className="text-[10px] text-ink3">{now && start ? `${now >= start ? '+' : ''}${Math.round(now - start)} kg` : 'e1RM kg'}</div></div>
                <div className="rounded-xl bg-surface3 p-2"><div className="text-ink3">Heading for</div><b className="text-[16px]">{now ? `${next}` : '—'}</b><div className="text-[10px] text-ink3">next PR attempt</div></div>
              </div>
              {series.length > 1 ? <div className="mt-2"><LineChart points={series} height={120} unit="kg" /></div> : <div className="mt-2 text-[12px] text-ink3">Log a few sessions to draw the line.</div>}
            </Card>
          )
        })}
        <Card className="p-4">
          <h2 className="text-[17px] font-bold">Pull-ups</h2>
          {pull.length ? <><div className="text-[12.5px] text-ink2">Best set: {Math.max(...pull.map((p) => p.y))} reps</div>{pull.length > 1 && <LineChart points={pull} height={110} />}</>
            : <div className="mt-1 text-[12.5px] text-ink3">No bodyweight pull-ups logged yet — your first one will appear here. Follow the Pull-Up Journey in Skill trees.</div>}
        </Card>
        <div className="text-[11.5px] text-ink3">"Started" uses your setup numbers (or your first logged session). All strength numbers here are estimated 1RMs, not tested maxes.</div>
      </div>
    </div>
  )
}

