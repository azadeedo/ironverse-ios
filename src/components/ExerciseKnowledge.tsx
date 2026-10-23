// The v6 exercise page block: why it's programmed, what it unlocks, transfer,
// breathing/bracing/ROM, the program prescription, and performance/PRs.
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { ArrowRight, Sparkles, Target } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { ExerciseMedia, MuscleTiers, RirTag, TransferChips, fmtRest } from '@/components/program'
import { db } from '@/db'
import { byId } from '@/data/exercises'
import { SKILL_TREES, knowledgeFor } from '@/data/knowledge'
import type { Exercise, PlanExercise } from '@/db/types'
import { PATTERN_LABELS } from '@/db/types'
import { inferQuality } from '@/lib/quality'
import { E1RM_FORMULA, pastSessions } from '@/lib/program12'
import { exercisePRSet, getProgramPlan } from '@/lib/programStore'
import { e1rmMeaningful } from '@/lib/strength'
import { ExerciseProgress } from './ExerciseProgress'
import { PathwayCard } from './PathwayCard'

const DIFF = ['', 'Beginner-friendly', 'Easy to learn', 'Moderate skill', 'Technical', 'Highly technical']

export function ExerciseKnowledge({ ex, showMedia = true }: { ex: Exercise; showMedia?: boolean }) {
  const navigate = useNavigate()
  const k = knowledgeFor(ex.id)
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  if (!k) return null
  const rx: PlanExercise | undefined = plan?.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises)).find((e) => e.exerciseId === ex.id)
  const prs = logs ? exercisePRSet(logs, ex.id) : {}
  const past = logs ? pastSessions(logs, ex.id, 2) : []
  const tree = SKILL_TREES.find((t) => t.nodes.some((n) => n.id === ex.id))
  const pattern = inferQuality(ex).pattern
  const link = (id?: string) => (id ? <button type="button" className="text-brand" onClick={() => navigate(`/exercise/${id}`)}>{byId.get(id)?.name ?? id}</button> : null)
  return (
    <div className="space-y-3 px-4 pt-3">
      {showMedia && <ExerciseMedia ex={ex} showAnim={false} />}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-brand"><Sparkles size={15} /> Why am I doing this?</div>
        <p className="mt-1.5 text-[14px] leading-relaxed">{k.why}</p>
        <div className="mt-2.5"><TransferChips id={ex.id} /></div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
          <Badge tone="gray">{PATTERN_LABELS[pattern]}</Badge><Badge tone="gray">{DIFF[k.difficulty]}</Badge>
          {k.source === 'inferred' && <Badge tone="gray">summary built from the exercise data</Badge>}
        </div>
      </Card>
      {(k.regression || k.progression || k.unlocks) && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-brand"><Target size={15} /> What does this help me unlock?</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13.5px]">
            {k.regression && <>{link(k.regression)}<ArrowRight size={14} className="text-ink3" /></>}
            <b>{ex.name}</b>
            {k.progression && <><ArrowRight size={14} className="text-ink3" />{link(k.progression)}</>}
          </div>
          {k.unlocks && k.unlocks.length > 1 && <div className="mt-1.5 text-[12.5px] text-ink2">Path: {[ex.name, ...k.unlocks.map((u) => byId.get(u)?.name ?? u)].join(' → ')}</div>}
          {tree && <button type="button" className="mt-2 text-[12.5px] font-semibold text-brand" onClick={() => navigate(`/skills#${tree.id}`)}>Open the {tree.title} →</button>}
          <div className="mt-1.5 text-[11.5px] text-ink3">Nothing is locked — this is a guide to what tends to come next.</div>
        </Card>
      )}
      <Card className="space-y-2 p-4 text-[13px]">
        <Row label="What this trains" value={[...ex.primary, ...ex.secondary].join(', ').replace(/-/g, ' ')} />
        <Row label="What this develops" value={k.develops.join(', ')} />
        {k.mayHelp.length > 0 && <Row label="What this may help" value={k.mayHelp.join(', ')} />}
        <Row label="What it prepares you for" value={k.preparesFor.join(', ') || '—'} />
        <Row label="What prepares you for it" value={k.preparedBy.join(', ') || '—'} />
        <div className="text-[11.5px] text-ink3">Transfer is "may support", never "guaranteed".</div>
      </Card>
      <Card className="p-4"><div className="mb-2 text-[13px] font-semibold">Primary · secondary · stabilisers</div><div className="flex justify-center"><MuscleTiers ex={ex} size={170} /></div></Card>
      <Card className="space-y-2 p-4 text-[13px]">
        <Row label="Breathing" value={k.breathing} />
        <Row label="Bracing" value={k.bracing} />
        <Row label="Range of motion" value={k.rom} />
      </Card>
      {rx && (
        <Card className="p-4 text-[13px]">
          <div className="text-[13px] font-semibold">In your 12-week program</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">{rx.sets} sets × {rx.reps[0] === rx.reps[1] ? rx.reps[0] : `${rx.reps[0]}–${rx.reps[1]}`} reps <RirTag rir={rx.rir} /> · rest {fmtRest(rx.restSec)}</div>
          <div className="mt-1 text-[11.5px] text-ink3">Sets, reps and RIR change week to week — see the Program screen for each week.</div>
        </Card>
      )}
      <Card className="space-y-1.5 p-4 text-[13px]">
        <div className="font-semibold">Your performance</div>
        <Row label="Last time" value={past[0] ? `${past[0].sets.map((s) => `${s.weightKg ?? 'BW'}×${s.reps ?? '-'}`).join(', ')} · ${dayjs(past[0].date).format('D MMM')}` : 'Not done yet'} />
        <Row label="Time before" value={past[1] ? `${past[1].sets.map((s) => `${s.weightKg ?? 'BW'}×${s.reps ?? '-'}`).join(', ')} · ${dayjs(past[1].date).format('D MMM')}` : '—'} />
        <Row label="Heaviest" value={prs.bestKg ? `${prs.bestKg.kg} kg × ${prs.bestKg.reps} (${dayjs(prs.bestKg.date).format('D MMM YY')})` : '—'} />
        <Row label="Rep PR" value={prs.bestReps ? `${prs.bestReps.reps} reps @ ${prs.bestReps.kg} kg` : '—'} />
        {e1rmMeaningful(ex) && <Row label="Estimated 1RM" value={prs.bestE1rm ? `${Math.round(prs.bestE1rm.value)} kg (estimate, not a PR)` : '—'} />}
        <Row label="Volume PR" value={prs.bestVolume ? `${Math.round(prs.bestVolume.kg).toLocaleString()} kg in one session` : '—'} />
        <div className="pt-1 text-[11px] text-ink3">{E1RM_FORMULA}</div>
      </Card>
      <ExerciseProgress ex={ex} />
      <PathwayCard exerciseId={ex.id} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div><span className="text-ink3">{label}: </span><span>{value}</span></div>
}
