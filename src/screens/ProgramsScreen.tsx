// /programs — the coach styles.
//
// Two training philosophies, presented honestly and side by side, with three
// levels of commitment behind each one:
//
//   Just today  → ProgramOverride scope 'day'   (plan untouched)
//   This week   → ProgramOverride scope 'week'  (plan untouched, split kept)
//   Whole block → a real Plan; the previous plan is DEACTIVATED, never deleted
//
// Nothing on this screen can lose his work. Every override is cancellable, and
// every plan he has ever had is listed under "Back to my own plan" so it can be
// made active again in one tap.
//
// Integrity: these are our own principle-faithful interpretations of two public
// training approaches. The influence is credited plainly; nothing is presented
// as an official program and nothing is quoted. See data/coaches.ts.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays, CalendarRange, History, Info, Layers, RotateCcw, Undo2,
} from 'lucide-react'
import {
  Badge, Button, Card, ConfirmDialog, ListGroup, ListRow, PageHeader, Section, Spinner,
} from '@/components/ui'
import { db, getActivePlan, getProfile } from '@/db'
import { fmtDate } from '@/lib/fmt'
import { todayStr } from '@/lib/id'
import { mondayOf } from '@/lib/plangen'
import { useUI } from '@/lib/store'
import { COACH_LIST, coachLabel } from '@/data/coaches'
import type { Coach } from '@/data/coaches'
import type { CoachId, Plan, ProgramOverride } from '@/db/types'
import CoachCard from './programs/CoachCard'
import Compare from './programs/Compare'
import PicksSheet from './programs/PicksSheet'
import ApplySheet from './programs/ApplySheet'
import {
  allOverrides, applyBlock, applyDayOverride, applyWeekOverride,
  cancelOverride, cancelOverridesForWeek, restorePlan,
} from './programs/apply'

export default function ProgramsScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()

  const profile = useLiveQuery(() => getProfile(), [])
  const activePlan = useLiveQuery(async () => (await getActivePlan()) ?? null, [])
  const plans = useLiveQuery(async () => db.plans.toArray(), [])
  const overrides = useLiveQuery(() => allOverrides(), [])

  const [picksFor, setPicksFor] = useState<Coach | null>(null)
  const [applyFor, setApplyFor] = useState<Coach | null>(null)
  const [blockAsk, setBlockAsk] = useState<{ coach: Coach; weeks: number } | null>(null)
  const [cancelAsk, setCancelAsk] = useState<ProgramOverride | 'week' | null>(null)
  const [restoreAsk, setRestoreAsk] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)

  if (profile === undefined || activePlan === undefined || overrides === undefined) {
    return (
      <div>
        <PageHeader title="Coach programs" back />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  const today = todayStr()
  const monday = mondayOf(today)
  const dayOverride = overrides.find((o) => o.scope === 'day' && o.date === today) ?? null
  const weekOverrides = overrides.filter((o) => o.scope === 'week' && o.date === monday)
  const weekCoach: CoachId | null = weekOverrides[0]?.coach ?? null
  const blockCoach: CoachId | null = activePlan?.coach ?? null

  /** the coach currently steering today's session, whatever the scope */
  const inEffect: CoachId | null = dayOverride?.coach ?? weekCoach ?? blockCoach

  const previousPlans = (plans ?? [])
    .filter((p) => !p.active)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  // ---------- actions ----------

  async function doDay(coach: Coach) {
    if (!profile || busy) return
    setBusy(true)
    try {
      const row = await applyDayOverride(coach.id, profile, activePlan)
      if (!row) { toast('Could not build that session — nothing was changed'); return }
      setApplyFor(null)
      toast(`Today is a ${coach.name} session`)
      navigate('/workout')
    } finally {
      setBusy(false)
    }
  }

  async function doWeek(coach: Coach) {
    if (!profile || busy) return
    setBusy(true)
    try {
      const n = await applyWeekOverride(coach.id, profile, activePlan)
      if (!n) { toast('Could not build that week — nothing was changed'); return }
      setApplyFor(null)
      toast(`This week runs ${coach.name} — your plan is untouched`)
    } finally {
      setBusy(false)
    }
  }

  async function doBlock(coach: Coach, weeks: number) {
    if (!profile || busy) return
    setBusy(true)
    try {
      const fresh = await applyBlock(coach.id, profile, weeks)
      if (!fresh) { toast('Could not build that block — your plan is unchanged'); return }
      setBlockAsk(null)
      setApplyFor(null)
      toast(`${weeks}-week ${coach.name} block is active — your old plan is saved`)
      navigate('/workout')
    } finally {
      setBusy(false)
    }
  }

  async function doCancel(target: ProgramOverride | 'week') {
    setBusy(true)
    try {
      if (target === 'week') await cancelOverridesForWeek(today)
      else await cancelOverride(target.id)
      setCancelAsk(null)
      toast('Back to your plan')
    } finally {
      setBusy(false)
    }
  }

  async function doRestore(plan: Plan) {
    setBusy(true)
    try {
      await restorePlan(plan.id)
      setRestoreAsk(null)
      toast(`“${plan.name}” is active again`)
    } finally {
      setBusy(false)
    }
  }

  // ---------- render ----------

  return (
    <div className="pb-6">
      <PageHeader
        title="Coach programs"
        back
        subtitle="Two ways to train — borrow one for a day, a week, or a block"
      />

      {/* ---------- what is in effect right now ---------- */}
      <Section className="pt-1">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="shout text-[11.5px] text-brand">In effect now</div>
              <h2 className="mt-0.5 text-[19px] font-bold leading-tight">
                {inEffect ? coachLabel(inEffect) : 'Your own plan'}
              </h2>
            </div>
            <Badge tone={inEffect ? 'brand' : 'green'}>
              {dayOverride ? 'Today only'
                : weekCoach ? 'This week'
                : blockCoach ? 'Full block'
                : 'Your plan'}
            </Badge>
          </div>

          {!inEffect && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
              {activePlan
                ? `“${activePlan.name}” is running as you built it. Nothing below has changed it.`
                : 'No active plan yet — generate one on the Plan screen, or adopt a coach block below.'}
            </p>
          )}

          {/* day scope */}
          {dayOverride && (
            <div className="mt-2.5 rounded-xl bg-surface3 p-3">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <CalendarDays size={16} className="text-brand" />
                Today: {dayOverride.title}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
                {dayOverride.note ?? 'Just for today. Your plan is untouched.'}
              </p>
              <Button
                full
                variant="outline"
                className="mt-2.5"
                onClick={() => setCancelAsk(dayOverride)}
              >
                <Undo2 size={15} /> Cancel today&rsquo;s swap
              </Button>
            </div>
          )}

          {/* week scope */}
          {weekCoach && (
            <div className="mt-2.5 rounded-xl bg-surface3 p-3">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <CalendarRange size={16} className="text-brand" />
                This week: {coachLabel(weekCoach)}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
                {weekOverrides.length} session{weekOverrides.length === 1 ? '' : 's'} swapped for
                the week of {fmtDate(monday)}, keeping your split. Your plan is untouched.
              </p>
              <Button full variant="outline" className="mt-2.5" onClick={() => setCancelAsk('week')}>
                <Undo2 size={15} /> Cancel this week&rsquo;s swap
              </Button>
            </div>
          )}

          {/* block scope */}
          {blockCoach && activePlan && (
            <div className="mt-2.5 rounded-xl bg-surface3 p-3">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Layers size={16} className="text-brand" />
                {activePlan.name}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
                {activePlan.sourceLabel ?? coachLabel(blockCoach)} ·{' '}
                {activePlan.blockWeeks ?? activePlan.weeks.length} weeks · started{' '}
                {fmtDate(activePlan.startDate)}.
              </p>
              <Button
                full
                variant="outline"
                className="mt-2.5"
                onClick={() => navigate('/workout')}
              >
                Open the session
              </Button>
            </div>
          )}

          {(dayOverride || weekCoach) && (
            <p className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-ink3">
              <Info size={13} className="mt-[2px] shrink-0" />
              A day swap wins over a week swap. Cancelling either one puts the plan straight back
              — nothing was ever written over it.
            </p>
          )}
        </Card>
      </Section>

      {/* ---------- the two coaches ---------- */}
      <Section title="The styles">
        <div className="grid gap-3 lg:grid-cols-2">
          {COACH_LIST.map((c) => (
            <CoachCard
              key={c.id}
              coach={c}
              active={inEffect === c.id}
              onPicks={() => setPicksFor(c)}
              onUse={() => setApplyFor(c)}
            />
          ))}
        </div>
      </Section>

      {/* ---------- fair comparison ---------- */}
      {COACH_LIST.length >= 2 && (
        <Section title="Choosing between them">
          <Compare a={COACH_LIST[0]} b={COACH_LIST[1]} />
        </Section>
      )}

      {/* ---------- back to his own plan ---------- */}
      <Section title="Back to my own plan">
        {inEffect ? (
          <Card className="mb-3 p-4">
            <p className="text-[13px] leading-relaxed text-ink2">
              {dayOverride || weekCoach
                ? 'Cancel the swap above and your plan is running again immediately.'
                : 'Reactivate any plan below to come straight off the coach block. The block stays saved — you can go back to it the same way.'}
            </p>
          </Card>
        ) : (
          <Card className="mb-3 p-4">
            <p className="text-[13px] leading-relaxed text-ink2">
              You are already on your own plan. Everything you have ever generated is listed
              here — nothing is ever deleted.
            </p>
          </Card>
        )}

        <ListGroup>
          {activePlan && (
            <ListRow
              leading={<RotateCcw size={18} className="text-brand" />}
              title={activePlan.name}
              subtitle={`${activePlan.weeks.length} weeks · started ${fmtDate(activePlan.startDate)}${
                activePlan.sourceLabel ? ` · ${activePlan.sourceLabel}` : ''
              }`}
              right={<Badge tone="green">Active</Badge>}
              chevron={false}
            />
          )}
          {previousPlans.map((p) => (
            <ListRow
              key={p.id}
              leading={<History size={18} className="text-ink3" />}
              title={p.name}
              subtitle={`${p.weeks.length} weeks · started ${fmtDate(p.startDate)}${
                p.sourceLabel ? ` · ${p.sourceLabel}` : ''
              }`}
              right={<span className="text-[13px] font-semibold text-brand">Reactivate</span>}
              chevron={false}
              onClick={() => setRestoreAsk(p)}
            />
          ))}
          {!activePlan && previousPlans.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-ink3">
              No plans saved yet. Generate one on the Plan screen, or adopt a coach block above.
            </div>
          )}
        </ListGroup>

        <Button full variant="outline" className="mt-3" onClick={() => navigate('/plan')}>
          Open my plan settings
        </Button>

        <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink3">
          Adopting a block deactivates the previous plan; it never deletes it. Your workout
          history, logs and weigh-ins are never touched by anything on this screen.
        </p>
      </Section>

      {/* ---------- sheets ---------- */}
      <PicksSheet open={!!picksFor} coach={picksFor} onClose={() => setPicksFor(null)} />

      <ApplySheet
        open={!!applyFor}
        coach={applyFor}
        busy={busy}
        planName={activePlan?.name ?? null}
        onClose={() => setApplyFor(null)}
        onDay={() => { if (applyFor) void doDay(applyFor) }}
        onWeek={() => { if (applyFor) void doWeek(applyFor) }}
        onBlock={(weeks) => { if (applyFor) setBlockAsk({ coach: applyFor, weeks }) }}
      />

      {/* ---------- confirmations ---------- */}
      <ConfirmDialog
        open={!!blockAsk}
        onClose={() => setBlockAsk(null)}
        onConfirm={() => { if (blockAsk) void doBlock(blockAsk.coach, blockAsk.weeks) }}
        title={`Adopt the ${blockAsk?.weeks ?? 8}-week block?`}
        message={
          activePlan
            ? `“${activePlan.name}” will be deactivated — not deleted — and the ${blockAsk?.weeks ?? 8}-week ${blockAsk ? blockAsk.coach.name : 'coach'} block becomes your active plan. You can reactivate your old plan any time from “Back to my own plan”. All workout history is kept.`
            : `The ${blockAsk?.weeks ?? 8}-week ${blockAsk ? blockAsk.coach.name : 'coach'} block becomes your active plan. All workout history is kept.`
        }
        confirmLabel="Adopt the block"
        danger={false}
      />

      <ConfirmDialog
        open={!!cancelAsk}
        onClose={() => setCancelAsk(null)}
        onConfirm={() => { if (cancelAsk) void doCancel(cancelAsk) }}
        title={cancelAsk === 'week' ? 'Cancel this week’s swap?' : 'Cancel today’s swap?'}
        message={
          cancelAsk === 'week'
            ? 'Every coach session booked for this week is removed and your own plan runs again. Sessions you have already logged are kept exactly as they are.'
            : 'Today goes back to the session your plan prescribes. Anything you have already logged today is kept.'
        }
        confirmLabel="Back to my plan"
        danger={false}
      />

      <ConfirmDialog
        open={!!restoreAsk}
        onClose={() => setRestoreAsk(null)}
        onConfirm={() => { if (restoreAsk) void doRestore(restoreAsk) }}
        title={`Reactivate “${restoreAsk?.name ?? 'this plan'}”?`}
        message={
          activePlan
            ? `It becomes your active plan again. “${activePlan.name}” is deactivated, not deleted — it stays in this list and can be brought back the same way. All workout history is kept.`
            : 'It becomes your active plan again. All workout history is kept.'
        }
        confirmLabel="Reactivate"
        danger={false}
      />
    </div>
  )
}
