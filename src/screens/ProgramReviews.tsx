// /program/review/:week — WEEK X COMPLETE (+ "How did this week feel?" and a
// recommendation he can ACCEPT or DECLINE).
// /program/complete — 12 WEEKS COMPLETE review + "Build next 12-week block"
// (a NEW plan; the finished one is kept untouched with its history).

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { HeroBanner } from '@/components/program'
import { heroForWeek } from '@/data/brand'
import dayjs from 'dayjs'
import { Check, Trophy, X } from 'lucide-react'
import { db } from '@/db'
import { Badge, Button, Callout, Card, ConfirmDialog, PageHeader, Section, Spinner } from '@/components/ui'
import { useUI } from '@/lib/store'
import { nowIso, todayStr } from '@/lib/id'
import { PHASES, VOLUME_TARGETS, type VolumeGroup } from '@/data/program12'
import { buildProgramPlan, nextTuesday, programWeekFor } from '@/lib/program12'
import { getProgramPlan, getAnyProgramPlan, getProgramSetup, repeatWeek } from '@/lib/programStore'
import { FEEL_LABEL, exName, programReview, recommendFor, weekSummary, type WeekFeel } from '@/lib/weekReview'
import type { Plan } from '@/db/types'
import { applyBlockChanges, nextBlockChanges, type ChangeKind } from '@/lib/nextBlock'
import { getCurrentProfile } from '@/lib/equipment'
import { ed } from '@/lib/edition'

function useAll() {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const weighIns = useLiveQuery(() => db.weighIns.toArray(), [])
  const cardio = useLiveQuery(() => db.cardioLog.toArray(), [])
  const checkins = useLiveQuery(async () => { try { return await db.checkins.toArray() } catch { return [] } }, [])
  const measurements = useLiveQuery(() => db.measurements.toArray(), [])
  if (!logs || !weighIns || !cardio || !checkins || !measurements) return null
  return { logs, weighIns, cardio, checkins, measurements: measurements.map((m) => ({ date: m.date, waistCm: m.values.waist })) }
}

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl bg-surface3 p-2.5 text-center"><div className="text-[11.5px] text-ink3">{label}</div><b className="text-[17px]">{value}</b>{sub && <div className="text-[10.5px] text-ink3">{sub}</div>}</div>
)

export function WeekReviewScreen() {
  const { week: w } = useParams()
  const week = Math.max(1, Math.min(12, Number(w) || 1))
  const navigate = useNavigate()
  const { toast } = useUI()
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? (await getAnyProgramPlan()) ?? null, [])
  const all = useAll()
  const [feel, setFeel] = useState<WeekFeel | undefined>(undefined)
  if (plan === undefined || !all) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  if (!plan) return <div className="p-6">No program yet.</div>
  const rec0 = plan.weekReviews?.[week]
  const f = feel ?? rec0?.feel
  const sum = weekSummary(plan, week, all)
  const rec = recommendFor(sum, f)
  const decided = rec0?.decision && rec0.recommendation === rec.id

  async function save(decision?: 'accepted' | 'declined') {
    let p: Plan = { ...plan!, weekReviews: { ...(plan!.weekReviews ?? {}), [week]: { feel: f, at: nowIso(), recommendation: rec.id, ...(decision ? { decision } : {}) } } }
    if (decision === 'accepted') {
      if (rec.id === 'repeat-week') { p = await repeatWeek(p, week); toast(`Week ${week} repeats next — later weeks move back one`) }
      if (rec.id === 'deload-next') {
        const cw = programWeekFor(p, todayStr()).calendarWeek + (dayjs().day() >= 5 || dayjs().day() === 0 ? 1 : 0)
        p = { ...p, manualDeloads: [...(p.manualDeloads ?? []), cw] }
        toast('Next week will be built as a deload')
      }
      if (rec.id === 'reduce-loads') { p = { ...p, loadAdjust: { week: Math.min(12, week + 1), pct: 3.5 } }; toast(`Week ${Math.min(12, week + 1)} loads will be suggested ~3.5% lighter`) }
    }
    await db.plans.put(p)
    if (decision === 'declined') toast('Declined — the program stays exactly as written')
    if (!decision) toast('Saved')
  }

  const vol = (Object.keys(VOLUME_TARGETS) as VolumeGroup[]).filter((g) => sum.volume[g].direct > 0)
  return (
    <div className="pb-8">
      <PageHeader title={`Week ${week} complete`} subtitle={`${PHASES[week - 1].name} · ${dayjs(sum.range.from).format('D MMM')}–${dayjs(sum.range.to).format('D MMM')}`} back="/program" />
      <div className="space-y-4 px-4">
        <HeroBanner id={heroForWeek(week)}>
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-amber-300">Week {week} complete</div>
          <div className="text-[22px] font-black text-white">{sum.sessions}/{sum.planned} sessions</div>
          {sum.missedDays.length > 0 && <div className="text-[12.5px] text-white/80">Not logged: {sum.missedDays.map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')}</div>}
        </HeroBanner>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Working sets" value={String(sum.totalSets)} />
          <Stat label="Cardio" value={`${sum.cardio.sessions}`} sub={`${sum.cardio.minutes} min`} />
          <Stat label="Steps / day" value={sum.steps.avg ? Math.round(sum.steps.avg).toLocaleString() : '—'} sub={`${sum.steps.days} days logged`} />
          <Stat label="Bodyweight avg" value={sum.bodyweight.avg ? `${sum.bodyweight.avg.toFixed(1)}` : '—'} sub={sum.bodyweight.change !== undefined ? `${sum.bodyweight.change > 0 ? '+' : ''}${sum.bodyweight.change.toFixed(1)} kg vs last wk` : 'kg'} />
          <Stat label="Readiness" value={sum.readiness.avg ? sum.readiness.avg.toFixed(1) : '—'} sub={`/5 · ${sum.readiness.n} check-ins`} />
          <Stat label="PRs" value={String(sum.prs.length)} />
        </div>
        {(sum.prs.length > 0 || sum.improvements.length > 0) && (
          <Section title="PRs and improvements">
            <Card className="space-y-1.5 p-4 text-[13px]">
              {sum.prs.map((p) => <div key={`pr-${p.exerciseId}`}><Trophy size={13} className="mr-1 inline text-amber-300" /><b>{exName(p.exerciseId)}</b> — {p.detail}</div>)}
              {sum.improvements.map((x) => <div key={`im-${x.exerciseId}`}><b>{exName(x.exerciseId)}</b>: estimated 1RM {Math.round(x.before)} → {Math.round(x.after)} kg</div>)}
            </Card>
          </Section>
        )}
        {vol.length > 0 && (
          <Section title="Volume this week (direct sets)">
            <Card className="grid grid-cols-2 gap-1.5 p-4 text-[12.5px]">
              {vol.map((g) => <div key={g} className="flex justify-between"><span>{VOLUME_TARGETS[g].label}</span><b>{sum.volume[g].direct}</b></div>)}
            </Card>
          </Section>
        )}
        <Section title="How did this week feel?">
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(FEEL_LABEL) as WeekFeel[]).map((k) => (
              <button key={k} type="button" onClick={() => setFeel(k)} className={`pressable min-h-[48px] rounded-xl text-[13px] font-semibold ${f === k ? 'bg-brand text-white' : 'bg-surface2'}`}>{FEEL_LABEL[k]}</button>
            ))}
          </div>
          <div className="mt-1 px-1 text-[11.5px] text-ink3">Used as a signal for the recommendation below — never applied on its own.</div>
        </Section>
        <Section title="Recommended change">
          <Card className="space-y-2 p-4">
            <div className="flex items-center gap-2"><b className="text-[15px]">{rec.title}</b>{rec.structural && <Badge tone="amber">changes structure</Badge>}</div>
            <div className="text-[13px] leading-relaxed text-ink2"><b>Why:</b> {rec.why}</div>
            {decided ? (
              <Callout tone={rec0?.decision === 'accepted' ? 'good' : 'neutral'}>{rec0?.decision === 'accepted' ? 'Accepted.' : 'Declined — program unchanged.'}</Callout>
            ) : rec.id === 'none' || rec.id === 'keep-going' ? (
              <Button full onClick={() => void save('accepted')}><Check size={15} /> OK</Button>
            ) : (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void save('accepted')}><Check size={15} /> Accept</Button>
                <Button className="flex-1" variant="secondary" onClick={() => void save('declined')}><X size={15} /> Decline</Button>
              </div>
            )}
          </Card>
        </Section>
        <Button full variant="ghost" onClick={() => navigate(week >= 12 ? '/program/complete' : '/program')}>{week >= 12 ? 'Open the 12-week review' : 'Back to the program'}</Button>
      </div>
    </div>
  )
}

/** latest weigh-in, for the bodyweight-based milestones */
const r0Kg = (all: { weighIns: { date: string; weightKg: number }[] } | undefined) => { const w = [...(all?.weighIns ?? [])].sort((a, b) => a.date.localeCompare(b.date)); return w.length ? w[w.length - 1].weightKg : undefined }

export function ProgramCompleteScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? (await getAnyProgramPlan()) ?? null, [])
  const all = useAll()
  const [confirm, setConfirm] = useState(false)
  const [eq, setEq] = useState<Awaited<ReturnType<typeof getCurrentProfile>> | null | undefined>(undefined)
  useEffect(() => { void getCurrentProfile().then(setEq).catch(() => setEq(null)) }, [])
  const logsAll = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const [off, setOff] = useState<Record<string, boolean>>({})
  const metaRows = useLiveQuery(() => db.exerciseMeta.toArray(), [])
  const changes = plan && logsAll && eq !== undefined && metaRows ? nextBlockChanges(plan, logsAll, eq ?? null, { bw: r0Kg(all ?? undefined), meta: new Map(metaRows.map((m) => [m.exerciseId, m])) }) : []
  if (plan === undefined || !all) return <div className="flex h-[70svh] items-center justify-center"><Spinner /></div>
  if (!plan) return <div className="p-6">No program yet.</div>
  const r = programReview(plan, all)
  const pw = programWeekFor(plan, todayStr())
  const lift = (k: 'squat' | 'bench' | 'deadlift', label: string) => {
    const x = r.lifts[k]
    return <Stat label={label} value={x.end ? `${Math.round(x.end)} kg` : '—'} sub={x.start && x.end ? `e1RM ${x.end >= x.start ? '+' : ''}${Math.round(x.end - x.start)} kg` : 'estimated 1RM'} />
  }
  async function buildNext() {
    const setup = (await getProgramSetup()) ?? {}
    const start = nextTuesday(dayjs().add(1, 'day').format('YYYY-MM-DD'))
    const built = { ...buildProgramPlan({ start, setup, pullStage: r.pull.now }), cycle: (plan!.cycle ?? 1) + 1, name: `Ironverse 12-Week — Block ${(plan!.cycle ?? 1) + 1}` }
    const next = applyBlockChanges(built, changes.filter((x) => x.optional && !off[x.from]))
    await db.transaction('rw', db.plans, async () => {
      // the finished block stays saved (inactive) with all its history — nothing is overwritten
      for (const p of await db.plans.toArray()) if (p.active) await db.plans.put({ ...p, active: false })
      await db.plans.put(next)
    })
    toast(`Block ${next.cycle} starts ${dayjs(start).format('ddd D MMM')} — block ${plan!.cycle ?? 1} is kept with its history`)
    navigate('/program')
  }
  return (
    <div className="pb-8">
      <PageHeader title="12 weeks complete" subtitle={pw.finished ? 'Program review' : `Preview — you are on week ${pw.week}`} back="/program" />
      <div className="space-y-4 px-4">
        <HeroBanner id="hero-complete">
          <div className="flex items-center gap-2 text-amber-300"><Trophy size={22} /><span className="text-[22px] font-black text-white">12 WEEKS COMPLETE</span></div>
          <div className="text-[13px] text-white/85">{r.sessions} of 48 workouts · {r.consistency}% consistency</div>
        </HeroBanner>
        <Section title="Body">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Start" value={r.startKg ? `${r.startKg} kg` : '—'} />
            <Stat label="Now" value={r.currentKg ? `${r.currentKg} kg` : '—'} />
            <Stat label="Change" value={r.startKg && r.currentKg ? `${(r.currentKg - r.startKg).toFixed(1)} kg` : '—'} sub={ed("goal ~85 kg", "since week 1")} />
            {r.waist && <Stat label="Waist" value={r.waist.now ? `${r.waist.now} cm` : '—'} sub={r.waist.start ? `from ${r.waist.start} cm` : undefined} />}
          </div>
        </Section>
        <Section title="Work done">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Workouts" value={String(r.sessions)} sub="of 48" />
            <Stat label="Total sets" value={r.totalSets.toLocaleString()} />
            <Stat label="Cardio" value={String(r.cardioSessions)} sub={`${r.cardioMinutes} min`} />
            <Stat label="Avg steps" value={r.avgSteps ? r.avgSteps.toLocaleString() : '—'} />
          </div>
        </Section>
        <Section title="Side quest: squat · bench · deadlift">
          <div className="grid grid-cols-3 gap-2">{lift('squat', 'Squat')}{lift('bench', 'Bench')}{lift('deadlift', 'Deadlift')}</div>
        </Section>
        <Section title="Pull-up journey">
          <Card className="p-4 text-[13.5px]">{exName(r.pull.start)} → <b>{exName(r.pull.now)}</b></Card>
        </Section>
        {r.topImprovements.length > 0 && (
          <Section title="Biggest exercise improvements">
            <Card className="space-y-1 p-4 text-[13px]">{r.topImprovements.map((x) => <div key={x.exerciseId}><b>{exName(x.exerciseId)}</b>: {Math.round(x.before)} → {Math.round(x.after)} kg e1RM (+{Math.round((x.after / x.before - 1) * 100)}%)</div>)}</Card>
          </Section>
        )}
        <Section title="Muscle-group volume (direct sets, whole block)">
          <Card className="grid grid-cols-2 gap-1.5 p-4 text-[12.5px]">
            {(Object.keys(VOLUME_TARGETS) as VolumeGroup[]).map((g) => <div key={g} className="flex justify-between"><span>{VOLUME_TARGETS[g].label}</span><b>{r.volume[g].direct}</b></div>)}
          </Card>
        </Section>
        <Section title="Next block — built from your last 12 weeks">
          {changes.length === 0 ? <Card className="p-4 text-[13px] text-ink3">Working out the next block…</Card> : (
            <div className="space-y-2">
              {([['harder', '⬆ Harder now — you earned it', 'text-emerald-400'], ['easier', '🩹 Easier on the joints', 'text-sky-400'], ['angle', '🔄 Fresh angle — these stalled', 'text-amber-400'], ['reps', '🔁 Same exercise, new rep range', 'text-amber-400'], ['keep', '✓ Keeping', 'text-ink2']] as [ChangeKind, string, string][]).map(([k, label, tone]) => {
                const L = changes.filter((c) => c.kind === k)
                if (!L.length) return null
                return (
                  <Card key={k} className="space-y-2 p-4 text-[13px]">
                    <b className={tone}>{label} ({L.length})</b>
                    {L.map((x) => (
                      <label key={x.from} className="flex items-start gap-2.5">
                        {x.optional ? <input type="checkbox" checked={!off[x.from]} onChange={(e) => setOff((m) => ({ ...m, [x.from]: !e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0" /> : <span className="mt-0.5 w-5 shrink-0 text-center text-ink3">•</span>}
                        <span><b>{x.title}</b><span className="block text-[12px] text-ink3">{x.why}</span></span>
                      </label>
                    ))}
                  </Card>
                )
              })}
              <div className="px-1 text-[11.5px] text-ink3">Untick anything you want to leave as it was. Main lifts always stay so your squat, bench and deadlift PRs keep counting; every exercise starts from your latest working weight.</div>
            </div>
          )}
        </Section>
        <Button full onClick={() => setConfirm(true)}>Build next 12-week block</Button>
        <div className="px-1 text-[11.5px] text-ink3">The next block is created as a new program. This one is kept — nothing is overwritten and all history stays.</div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => void buildNext()} danger={false} title="Build the next 12-week block?"
        message="A new program starts next Tuesday, using your current pull-up rung. This block stays saved (inactive) with all of its history." confirmLabel="Build it" />
    </div>
  )
}
