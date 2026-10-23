// Exercise detail — hero animation, muscle map, instructions, achievable-load
// info from the plate maths, personal history, and alternatives.
// Route: /exercise/:id (handles unknown ids gracefully).

import { ExerciseKnowledge } from '@/components/ExerciseKnowledge'
import { ExerciseMedia } from '@/components/program'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight, ChevronRight, CircleHelp, Info, Lightbulb, Pause, Play, Plus,
  Share2, Star, TrendingUp,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, Spinner, StatCard } from '@/components/ui'
import { LineChart } from '@/components/charts'
import { ExerciseAnim } from '@/anim/rig'
import { MuscleMap } from '@/anim/MuscleMap'
import { alternativesFor, byId } from '@/data/exercises'
import { db } from '@/db'
import { equipmentLabel,
  EQUIPMENT_LABELS, MUSCLE_LABELS,
  type Exercise, type LoadMode, type Muscle, type Profile, type SetLog,
} from '@/db/types'
import { barLoads, nearestLoad, nextLoadUp, type LoadPlan } from '@/lib/plates'
import {
  CARRYOVER_CAVEAT, STRENGTH_BLURB, STRENGTH_LABELS, builtByWithData, carryoverFor,
  stallAdvice, type BuiltByReading, type CarryoverEntry, type CarryoverStrength,
} from '@/lib/carryover'
import { dayjs, fmtClock, fmtDayShort, fmtInt, fmtKg, fmtRelative } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import { e1rmSeries, exerciseRollups } from '@/lib/training'
import {
  KIND_LABELS, MuscleBadges, TIER_LABELS, TIER_SHORT, TIER_TONE, VisibleAnim,
  betterOptions, buildHistory, epley1Rm, tierOf, togglePinned,
  useCurrentEquipment, useExerciseMetaLive, useProfileLive, useWorkoutLogsLive,
} from './exercises/shared'

const LOAD_LABELS: Record<LoadMode, string> = {
  barbell: 'Barbell', 'curl-bar': 'Curl bar', smith: 'Smith bar',
  stack: 'Cable stack', bodyweight: 'Bodyweight', plate: 'Plate', time: 'Timed',
}

const WEIGHT_MODES: LoadMode[] = ['barbell', 'curl-bar', 'smith', 'stack', 'plate']

export default function ExerciseDetailScreen() {
  const { id } = useParams()
  const ex = id ? byId.get(id) : undefined
  const navigate = useNavigate()

  if (!ex) {
    return (
      <div>
        <PageHeader title="Exercise" back="/exercises" large={false} />
        <EmptyState
          icon={<CircleHelp size={40} strokeWidth={1.5} />}
          title="Exercise not found"
          subtitle="This link doesn't match anything in your library. It may have been renamed."
          action={<Button small onClick={() => navigate('/exercises')}>Browse exercises</Button>}
        />
      </div>
    )
  }

  // key resets local state (play/pause etc.) when hopping between alternatives
  return <Detail key={ex.id} ex={ex} />
}

function Detail({ ex }: { ex: Exercise }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const profile = useProfileLive()
  const logs = useWorkoutLogsLive()
  const meta = useExerciseMetaLive()
  const here = useCurrentEquipment()
  const [playing, setPlaying] = useState(true)
  const [adding, setAdding] = useState(false)

  const pinned = meta?.get(ex.id)?.pinned === true
  const options = useMemo(() => betterOptions(ex, here), [ex, here])
  const rollups = useMemo(() => (logs ? exerciseRollups(logs, ex.id) : []), [logs, ex.id])
  const e1rmPoints = useMemo(() => (logs ? e1rmSeries(logs, ex.id) : []), [logs, ex.id])
  const tier = tierOf(ex)

  const backTarget: string | boolean = (window.history.state?.idx ?? 0) > 0 ? true : '/exercises'

  const history = useMemo(() => (logs ? buildHistory(logs, ex.id) : undefined), [logs, ex.id])

  // most recent unfinished session (today's workout in progress)
  const openSession = useMemo(() => {
    if (!logs) return undefined
    for (let i = logs.length - 1; i >= 0; i--) {
      if (!logs[i].finishedAt) return logs[i]
    }
    return undefined
  }, [logs])
  const inSession = openSession?.exercises.some((e) => e.exerciseId === ex.id) ?? false

  // achievable load suggestion — ALWAYS via the plates lib
  const targetKg =
    history?.lastWeightKg ??
    (ex.startFactor !== undefined && profile ? profile.weightKg * ex.startFactor : undefined)
  const suggestionSource: 'history' | 'estimate' | null =
    history?.lastWeightKg !== undefined ? 'history' : targetKg !== undefined ? 'estimate' : null
  const plan: LoadPlan | null =
    profile && targetKg !== undefined && WEIGHT_MODES.includes(ex.loadMode)
      ? nearestLoad(ex.loadMode, targetKg, profile)
      : null
  const upKg = plan && profile ? nextLoadUp(ex.loadMode, plan.totalKg, profile) : null

  const alternatives = useMemo(() => alternativesFor(ex.id), [ex.id])

  // ---- training carryover (pattern + muscle driven, covers the whole library) ----
  const carriesTo = useMemo(() => carryoverFor(ex.id, { limit: 6 }), [ex.id])
  const feeders = useMemo(() => builtByWithData(ex.id, logs, { limit: 6 }), [ex.id, logs])

  async function addToSession() {
    if (!openSession || adding) return
    setAdding(true)
    try {
      const sets: SetLog[] = [0, 1, 2].map((i) => ({
        setIndex: i,
        targetReps: ex.repRange ?? [8, 12],
        done: false,
        ...(plan ? { weightKg: plan.totalKg } : {}),
        ...(ex.loadMode === 'time' ? { timeSec: 60 } : {}),
      }))
      await db.workoutLogs.put({
        ...openSession,
        exercises: [...openSession.exercises, { exerciseId: ex.id, sets }],
      })
      toast(`Added to “${openSession.title}” — 3 sets`)
    } catch {
      toast('Could not add the exercise', 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="pb-6">
      <PageHeader
        title={ex.name}
        back={backTarget}
        actions={
          <IconButton
            label={pinned ? 'Unpin this exercise' : 'Pin this exercise'}
            className={pinned ? 'text-brand' : 'text-ink3'}
            onClick={() => {
              void togglePinned(ex.id).then((now) => toast(now ? 'Pinned' : 'Unpinned'))
            }}
          >
            <Star size={18} fill={pinned ? 'currentColor' : 'none'} />
          </IconButton>
        }
      />

      {/* hero */}
      <div className="px-4">
        <Card className="relative p-4">
          <div className="flex justify-center">
            {/* v10.1: our demo / real photo first; the stick figure is one tap away */}
            <ExerciseMedia ex={ex} size={260} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <Badge tone="brand">{KIND_LABELS[ex.kind]}</Badge>
            <Badge tone={TIER_TONE[tier]}>{TIER_SHORT[tier]}</Badge>
            <Badge tone="amber">{LOAD_LABELS[ex.loadMode]}</Badge>
            {ex.repRange && ex.loadMode !== 'time' && (
              <Badge tone="gray">{ex.repRange[0]}–{ex.repRange[1]} reps</Badge>
            )}
            {ex.unilateral && <Badge tone="gray">Unilateral</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {ex.equipment.map((e) => (
              <Badge key={e} tone="gray">{equipmentLabel(e)}</Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* v6: why / unlocks / transfer / breathing / performance */}
      <ExerciseKnowledge ex={ex} showMedia={false} />

      {/* add to today's workout */}
      {openSession && (
        <div className="px-4 pt-3">
          <Button
            full
            variant={inSession ? 'secondary' : 'primary'}
            disabled={adding}
            onClick={() => void addToSession()}
          >
            <Plus size={18} />
            {inSession ? 'Add again to today’s workout' : 'Add to today’s workout'}
          </Button>
          {inSession && (
            <p className="mt-1.5 text-center text-[12px] text-ink2">
              Already in “{openSession.title}” — this stacks another 3 sets.
            </p>
          )}
        </div>
      )}

      {/* muscles */}
      <SectionBlock title="Muscles worked">
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <MuscleMap primary={ex.primary} secondary={ex.secondary} size={132} showLabels />
            <div className="min-w-0 flex-1 space-y-3 pt-1">
              <div>
                <LegendDot solid />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <MuscleBadges muscles={ex.primary} max={6} />
                </div>
              </div>
              {ex.secondary.length > 0 && (
                <div>
                  <LegendDot />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <MuscleBadges muscles={ex.secondary} tone="gray" max={6} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </SectionBlock>

      {/* instructions */}
      <SectionBlock title="How to do it">
        <Card className="p-4">
          <ol className="space-y-3">
            {ex.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[12px] font-bold text-brand">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[14px] leading-snug text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
        {ex.tips && ex.tips.length > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-brand" />
              <span className="text-[13px] font-bold uppercase tracking-wide text-brand">Coach’s tips</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {ex.tips.map((t, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-ink">
                  <span className="text-brand">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionBlock>

      {/* works with your gear */}
      <SectionBlock title="Works with your gear">
        {profile ? (
          <GearCard ex={ex} profile={profile} plan={plan} upKg={upKg} source={suggestionSource} />
        ) : (
          <Card className="flex items-center justify-center p-6"><Spinner /></Card>
        )}
      </SectionBlock>

      {/* history */}
      <SectionBlock title="Your history">
        {!history ? (
          <Card className="flex items-center justify-center p-6"><Spinner /></Card>
        ) : history.totalSessions === 0 ? (
          <Card className="p-5 text-center">
            <div className="text-[15px] font-semibold text-ink">No sets logged yet</div>
            <p className="mx-auto mt-1 max-w-[260px] text-[13px] text-ink2">
              Do this exercise in a session and your best set, volume trend and last-used load show up here.
            </p>
          </Card>
        ) : (
          <HistoryBlock ex={ex} history={history} />
        )}
      </SectionBlock>

      {/* estimated 1RM trend */}
      {e1rmPoints.length >= 2 && (
        <SectionBlock title="Estimated 1RM trend">
          <Card className="p-4">
            <LineChart points={e1rmPoints} height={150} unit="" />
            <p className="mt-2 text-[11.5px] leading-snug text-ink3">
              Epley estimate from the best working set of each session. It is a trend line, not a tested
              max — what matters is the direction, not the exact number.
            </p>
          </Card>
        </SectionBlock>
      )}

      {/* last few times he trained it */}
      {rollups.length > 0 && (
        <SectionBlock title="Last few sessions">
          <Card className="divide-y divide-line overflow-hidden">
            {[...rollups].reverse().slice(0, 5).map((r) => (
              <button
                key={r.logId}
                type="button"
                onClick={() => navigate(`/session/${r.logId}`)}
                className="pressable flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-medium text-ink">{fmtDayShort(r.date)}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-ink2">
                    {r.hardSets} {r.hardSets === 1 ? 'set' : 'sets'}
                    {r.topWeightKg > 0 ? ` · top ${fmtKg(r.topWeightKg)}` : ''}
                    {r.bestReps > 0 ? ` · best ${r.bestReps} reps` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {r.e1rm > 0 && <div className="big-num text-[14px] text-brand">{fmtInt(r.e1rm)} kg</div>}
                  <div className="text-[11px] text-ink3">{fmtRelative(r.date)}</div>
                </div>
              </button>
            ))}
          </Card>
        </SectionBlock>
      )}

      {/* better options available where he's training right now */}
      {options.length > 0 && here && (
        <SectionBlock title={`Better options at ${here.name}`}>
          <p className="mb-2 text-[12.5px] leading-snug text-ink2">
            Same movement pattern, same job in a session, ranked by how well they do it — and all of them
            possible with the kit at {here.name} right now. {TIER_LABELS[tier].toLowerCase()} is where this
            one sits.
          </p>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {options.map((o) => (
              <Card
                key={o.exercise.id}
                onClick={() => navigate(`/exercise/${o.exercise.id}`)}
                className="w-[168px] shrink-0 p-3"
              >
                <VisibleAnim exercise={o.exercise} size={72} className="mx-auto" />
                <div className="mt-2 line-clamp-2 text-center text-[12.5px] font-semibold leading-tight text-ink">
                  {o.exercise.name}
                </div>
                <div className="mt-1.5 flex justify-center">
                  <Badge tone={o.strong ? 'brand' : 'gray'}>
                    {o.strong ? 'Clear step up' : 'Slightly better'}
                  </Badge>
                </div>
                <p className="mt-1.5 text-center text-[11px] leading-snug text-ink2">{o.reason}</p>
                <div className="mt-1.5 flex items-center justify-center gap-1 text-ink3">
                  <ArrowUpRight size={12} />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide">
                    {TIER_SHORT[tierOf(o.exercise)]}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </SectionBlock>
      )}

      {/* what getting strong here does for other lifts */}
      {carriesTo.length > 0 && (
        <SectionBlock title="What this carries over to">
          <p className="mb-2 text-[12.5px] leading-snug text-ink2">
            Get better at {ex.name.toLowerCase()} and these are the lifts that should feel easier,
            strongest transfer first.
          </p>
          <Card className="divide-y divide-line overflow-hidden">
            {carriesTo.map((c) => (
              <CarryRow
                key={c.exercise.id}
                entry={c}
                onClick={() => navigate(`/exercise/${c.exercise.id}`)}
              />
            ))}
          </Card>
          <Caveat />
        </SectionBlock>
      )}

      {/* what feeds this lift — the list he wants when it stalls */}
      {feeders.length > 0 && (
        <SectionBlock title="What builds this">
          <p className="mb-2 text-[12.5px] leading-snug text-ink2">
            Lifts that feed {ex.name.toLowerCase()}. When it stalls, this is where to look — and
            where your own logged numbers say a feeder has gone quiet.
          </p>
          <Card className="divide-y divide-line overflow-hidden">
            {feeders.map((f) => (
              <CarryRow
                key={f.exercise.id}
                entry={f}
                reading={f.reading}
                onClick={() => navigate(`/exercise/${f.exercise.id}`)}
              />
            ))}
          </Card>
          <Card className="mt-3 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-brand" />
              <h3 className="text-[13px] font-semibold text-ink">If this lift is stuck</h3>
            </div>
            <ul className="mt-2 space-y-1.5">
              {stallAdvice(ex.name).map((line) => (
                <li key={line} className="flex gap-2 text-[13px] leading-snug text-ink2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Caveat />
        </SectionBlock>
      )}

      {/* alternatives */}
      {alternatives.length > 0 && (
        <SectionBlock title="Swap it for">
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {alternatives.map((a) => (
              <Card
                key={a.id}
                onClick={() => navigate(`/exercise/${a.id}`)}
                className="w-[126px] shrink-0 p-3"
              >
                <VisibleAnim exercise={a} size={72} className="mx-auto" />
                <div className="mt-2 line-clamp-2 text-center text-[12.5px] font-semibold leading-tight text-ink">
                  {a.name}
                </div>
                <div className="mt-0.5 truncate text-center text-[11px] text-ink3">
                  {a.primary[0] ? MUSCLE_LABELS[a.primary[0] as Muscle] : ''}
                </div>
              </Card>
            ))}
          </div>
        </SectionBlock>
      )}
    </div>
  )
}

// ---------- pieces ----------

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4">
      <h2 className="mb-2 mt-5 text-[15px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

// ---------- carryover pieces ----------

const CARRY_TONE: Record<CarryoverStrength, 'brand' | 'green' | 'gray'> = {
  strong: 'brand', some: 'green', indirect: 'gray',
}

function Caveat() {
  return (
    <p className="mt-2 flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-ink3">
      <Info size={13} className="mt-[2px] shrink-0" />
      {CARRYOVER_CAVEAT}
    </p>
  )
}

/** One carryover row — 56px tall, whole row tappable through to that exercise. */
function CarryRow({ entry, reading, onClick }: {
  entry: CarryoverEntry
  reading?: BuiltByReading['reading']
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex min-h-[56px] w-full items-start gap-3 px-4 py-3 text-left"
    >
      <Share2 size={16} className="mt-[3px] shrink-0 text-ink3" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-semibold leading-tight text-ink">
            {entry.exercise.name}
          </span>
          <Badge tone={CARRY_TONE[entry.strength]}>{STRENGTH_LABELS[entry.strength]}</Badge>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-ink2">{entry.why}</p>
        <p className="mt-1 text-[11.5px] leading-snug text-ink3">
          {STRENGTH_BLURB[entry.strength]}
        </p>
        {reading && (
          <p
            className={`mt-1.5 rounded-lg bg-surface3 px-2.5 py-1.5 text-[11.5px] leading-snug ${
              reading.status === 'feeder-behind' ? 'text-brand' : 'text-ink2'
            }`}
          >
            {reading.text}
          </p>
        )}
      </div>
      <ChevronRight size={16} className="mt-[3px] shrink-0 text-ink3" />
    </button>
  )
}

function LegendDot({ solid = false }: { solid?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: '#fbbf24', opacity: solid ? 0.95 : 0.38 }}
      />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink3">
        {solid ? 'Primary' : 'Secondary'}
      </span>
    </div>
  )
}

function LoadChips({ loads, highlight }: { loads: number[]; highlight?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {loads.map((l) => (
        <span
          key={l}
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            l === highlight ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
          }`}
        >
          {l % 1 === 0 ? l : l.toFixed(1)}
        </span>
      ))}
      <span className="text-[11px] text-ink3">kg</span>
    </div>
  )
}

function GearCard({ ex, profile, plan, upKg, source }: {
  ex: Exercise
  profile: Profile
  plan: LoadPlan | null
  upKg: number | null
  source: 'history' | 'estimate' | null
}) {
  const lm = ex.loadMode

  let body: React.ReactNode
  if (lm === 'bodyweight') {
    body = (
      <p className="text-[13.5px] leading-snug text-ink2">
        No load to set up — your body is the resistance. Progress by adding reps, slowing the
        negative, or pausing at the hardest point.
      </p>
    )
  } else if (lm === 'time') {
    body = (
      <p className="text-[13.5px] leading-snug text-ink2">
        Timed effort — chase seconds, not kilos. The session player runs the clock for you.
      </p>
    )
  } else if (lm === 'stack') {
    const steps = profile.stackStepsKg
    body = (
      <>
        <p className="mb-2 text-[13px] text-ink2">
          Cable stack · {steps[0]}–{steps[steps.length - 1]} kg in {steps.length} steps
        </p>
        <LoadChips loads={steps} highlight={plan?.totalKg} />
      </>
    )
  } else if (lm === 'plate') {
    body = (
      <>
        <p className="mb-2 text-[13px] text-ink2">
          Hold a single plate from your pairs — pick the weight that fits the rep range.
        </p>
        <LoadChips loads={profile.platePairsKg} highlight={plan?.totalKg} />
      </>
    )
  } else {
    const barKg = lm === 'barbell' ? profile.barbellKg : lm === 'curl-bar' ? profile.curlBarKg : profile.smithBarKg
    const loads = barLoads(barKg, profile.platePairsKg)
    body = (
      <>
        <p className="mb-2 text-[13px] text-ink2">
          {LOAD_LABELS[lm]} ({barKg} kg) + plate pairs {profile.platePairsKg.join(' / ')} kg — every
          load you can build:
        </p>
        <LoadChips loads={loads} highlight={plan?.totalKg} />
      </>
    )
  }

  return (
    <Card className="p-4">
      {body}
      {plan && (
        <div className="mt-3 space-y-1.5 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-[13px] text-ink2">Suggested load</span>
            <span className="text-right text-[13.5px] font-semibold text-ink">{plan.label}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-[13px] text-ink2">Next step up</span>
            <span className="text-right text-[13.5px] font-semibold text-ink">
              {upKg !== null ? fmtKg(upKg) : 'Top of your range — add reps'}
            </span>
          </div>
          <p className="pt-0.5 text-[11.5px] text-ink3">
            {source === 'history'
              ? 'Based on your last logged set.'
              : 'Estimated from your bodyweight — adjust to how it feels.'}
          </p>
        </div>
      )}
    </Card>
  )
}

function HistoryBlock({ ex, history }: {
  ex: Exercise
  history: ReturnType<typeof buildHistory>
}) {
  const { sessions, best, bestReps, bestTimeSec, lastDate, totalSessions } = history

  const hasVolume = sessions.some((s) => s.volumeKg > 0)
  const hasReps = sessions.some((s) => s.reps > 0)

  const chart = hasVolume
    ? {
        title: 'Volume per session (kg)',
        points: sessions.map((s) => ({ x: dayjs(s.date).format('D/M'), y: Math.round(s.volumeKg) })),
      }
    : hasReps
      ? {
          title: 'Total reps per session',
          points: sessions.map((s) => ({ x: dayjs(s.date).format('D/M'), y: s.reps })),
        }
      : {
          title: 'Minutes per session',
          points: sessions.map((s) => ({ x: dayjs(s.date).format('D/M'), y: Math.round((s.seconds / 60) * 10) / 10 })),
        }

  const bestValue = best
    ? `${fmtKg(best.weightKg)} × ${best.reps}`
    : bestReps !== undefined
      ? `${bestReps} reps`
      : bestTimeSec !== undefined
        ? fmtClock(bestTimeSec)
        : '—'
  const bestSub = best
    ? `≈ ${fmtInt(epley1Rm(best.weightKg, best.reps))} kg est. 1RM`
    : bestReps !== undefined
      ? 'most in one set'
      : bestTimeSec !== undefined
        ? 'longest set'
        : undefined

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Last performed"
          value={lastDate ? fmtDayShort(lastDate) : '—'}
          sub={lastDate ? fmtRelative(lastDate) : undefined}
        />
        <StatCard label="Best set" value={bestValue} sub={bestSub} tone="brand" />
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold text-ink2">{chart.title}</h3>
          <span className="text-[12px] text-ink3">
            {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'}
          </span>
        </div>
        <LineChart points={chart.points} height={150} />
      </Card>
    </div>
  )
}
