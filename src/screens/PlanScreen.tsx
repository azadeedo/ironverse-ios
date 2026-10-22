// /plan — plan manager: current plan overview, training-day schedule, and the
// "generate new plan" flow (settings summary sheet → confirm replace → generate).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarDays, ChevronRight, Dumbbell, MapPin, Plus, Settings2, Sparkles, Target, Timer,
} from 'lucide-react'
import { db, getActivePlan, getProfile } from '@/db'
import { generatePlan } from '@/lib/plangen'
import { DAY_NAMES, slotForDay } from '@/lib/schedule'
import { fmtDate } from '@/lib/fmt'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'
import {
  GYM_PROFILE_ID, HOME_PROFILE_ID, ensureEquipmentProfiles, setCurrentProfile,
} from '@/lib/equipment'
import {
  Badge, Button, Card, ConfirmDialog, ListGroup, ListRow, PageHeader, Section, Sheet, Spinner,
} from '@/components/ui'
import type { EquipmentProfile, WorkDay } from '@/db/types'
import { GOAL_LABELS, WEEK_ORDER } from './workout/helpers'
import { EquipmentEditorSheet } from './workout/EquipmentEditor'
import { ed } from '@/lib/edition'

/** One honest line about what a location actually has. */
function eqSummary(p: EquipmentProfile): string {
  const bits: string[] = [`${p.equipment.length} items`]
  if (p.platePairsKg.length) {
    bits.push(`plates ${p.platePairsKg[0]}–${p.platePairsKg[p.platePairsKg.length - 1]} kg`)
  }
  const dbs = p.dumbbellsKg ?? []
  if (dbs.length) bits.push(`dumbbells to ${dbs[dbs.length - 1]} kg`)
  else bits.push('no dumbbells')
  if (p.builtIn) bits.push('built in')
  return bits.join(' · ')
}

export default function PlanScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const profile = useLiveQuery(() => getProfile(), [])
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null, [])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // v10: program length (owner, 23 Oct 2026) — 5 is the classic wave
  const [weeks, setWeeks] = useState(5)

  // ---- equipment profiles (locations) ----
  const eqProfiles = useLiveQuery(() => ensureEquipmentProfiles(), [])
  const [editing, setEditing] = useState<EquipmentProfile | null>(null)
  const [deleting, setDeleting] = useState<EquipmentProfile | null>(null)
  const currentEqId = profile?.equipmentProfileId ?? HOME_PROFILE_ID

  async function addLocation() {
    const ts = nowIso()
    const fresh: EquipmentProfile = {
      id: newId(),
      name: 'New location',
      equipment: ['bodyweight'],
      barbellKg: 20,
      curlBarKg: 10,
      smithBarKg: 15,
      platePairsKg: [],
      dumbbellsKg: [],
      stackStepsKg: [],
      minIncrementKg: 2.5,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.equipmentProfiles.put(fresh)
    setEditing(fresh)
  }

  async function saveLocation(next: EquipmentProfile) {
    await db.equipmentProfiles.put(next)
    setEditing(null)
    toast(`${next.name} saved`)
  }

  async function deleteLocation(target: EquipmentProfile) {
    await db.equipmentProfiles.delete(target.id)
    if (currentEqId === target.id) await setCurrentProfile(HOME_PROFILE_ID)
    setDeleting(null)
    setEditing(null)
    toast(`${target.name} removed`)
  }

  /**
   * Build ONE PLAN PER LOCATION — Home and Flex 24/7 — and save both active.
   * They are genuinely different programs: the gym plan is selected from the
   * gym's kit (machines and isolation slots a garage cannot offer), the home
   * plan from his rack, cables and bench. getActivePlan() then hands the Workout
   * tab whichever one matches where he is training right now.
   */
  async function doGenerate() {
    if (!profile || busy) return
    setBusy(true)
    try {
      const locations = await ensureEquipmentProfiles()
      // the two built-in locations first, then any custom one he has added
      const order = [HOME_PROFILE_ID, GYM_PROFILE_ID]
      const targets = [...locations].sort(
        (a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99),
      )

      const built = targets.length
        ? targets.map((eq, i) => generatePlan(profile, { equipment: eq, seed: i + 1, weeks }))
        : [generatePlan(profile, { weeks })]

      await db.transaction('rw', db.plans, async () => {
        await db.plans.toCollection().modify((p) => { p.active = false })
        await db.plans.bulkAdd(built)
      })
      setSheetOpen(false)
      toast(
        built.length > 1
          ? `${built.length} plans ready — one for each location`
          : 'New plan ready — let’s work',
      )
      navigate('/workout')
    } finally {
      setBusy(false)
    }
  }

  /** primary action inside the sheet: warn first when a plan would be replaced */
  function onGeneratePressed() {
    if (plan) setConfirmOpen(true)
    else void doGenerate()
  }

  if (profile === undefined || plan === undefined) {
    return (
      <div>
        <PageHeader title="Plan" back="/workout" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  const trainingDays = plan?.trainingWeekdays ?? []
  const slots = trainingDays
    .slice()
    .sort((a, b) => WEEK_ORDER.indexOf(a as (typeof WEEK_ORDER)[number]) - WEEK_ORDER.indexOf(b as (typeof WEEK_ORDER)[number]))
    .map((d) => {
      const wd: WorkDay = profile.workSchedule.find((w) => w.day === d) ?? { day: d as WorkDay['day'], working: false }
      return slotForDay(wd, profile.preferredSlot, profile.sessionMinutes)
    })

  return (
    <div className="pb-4">
      <PageHeader
        title="Plan"
        back="/workout"
        subtitle={ed("Your program, built for your garage", "Your program, built for your equipment")}
        actions={(
          <Button variant="ghost" small onClick={() => navigate('/settings')}>
            <Settings2 size={15} /> Settings
          </Button>
        )}
      />

      {plan ? (
        <>
          {/* ------- current plan card ------- */}
          <Section className="pt-1">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="shout text-[11.5px] text-brand">Current plan</div>
                  <h2 className="mt-0.5 truncate text-[20px] font-bold leading-tight">{plan.name}</h2>
                </div>
                <Badge tone="green">Active</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink2">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={14} className="text-ink3" /> Started {fmtDate(plan.startDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Dumbbell size={14} className="text-ink3" /> {plan.weeks.length} weeks · {trainingDays.length} days/week
                </span>
              </div>
              {/* training weekdays as day chips */}
              <div className="mt-3 flex gap-1.5">
                {WEEK_ORDER.map((d) => {
                  const on = trainingDays.includes(d)
                  return (
                    <div
                      key={d}
                      className={`flex h-9 flex-1 items-center justify-center rounded-lg text-[12px] font-bold ${
                        on ? 'bg-brand/15 text-brand ring-1 ring-brand/60' : 'bg-surface3 text-ink3'
                      }`}
                    >
                      {DAY_NAMES[d].slice(0, 2)}
                    </div>
                  )
                })}
              </div>
              <Button full variant="secondary" className="mt-3.5" onClick={() => navigate('/workout')}>
                Browse the plan <ChevronRight size={16} />
              </Button>
            </Card>
          </Section>

          {/* ------- program weeks overview ------- */}
          <Section title="Program weeks">
            <ListGroup>
              {plan.weeks.map((w) => (
                <ListRow
                  key={w.index}
                  title={`Week ${w.index} · ${w.label}`}
                  subtitle={w.days.map((d) => d.title).join(' · ')}
                  onClick={() => navigate(`/workout?week=${w.index}&day=1`)}
                />
              ))}
            </ListGroup>
          </Section>

          {/* ------- training days + computed workout times ------- */}
          <Section title="Training days">
            <ListGroup>
              {slots.map((s) => (
                <ListRow
                  key={s.day}
                  title={s.label}
                  subtitle={s.working && s.workStart && s.workEnd
                    ? `Work ${s.workStart}–${s.workEnd} · ${s.slotLabel.toLowerCase()}`
                    : `Day off · ${s.slotLabel.toLowerCase()}`}
                  right={<span className="big-num text-[17px] text-brand">{s.slot}</span>}
                  chevron={false}
                />
              ))}
            </ListGroup>
            <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink3">
              Times are picked around your work hours and preferred slot — change either in Settings.
            </p>
          </Section>

          {/* ------- regenerate ------- */}
          <Section title="New plan">
            <Card className="p-4">
              <p className="text-[13.5px] leading-relaxed text-ink2">
                Regenerating builds a fresh progressive program from your current settings and
                bodyweight — one for every location you train at. Your workout history and logs
                are kept.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink3">
                Switching location now switches the whole session, not just a few swaps: the gym
                plan is built from the gym’s machines, the home plan from your rack and cables.
                Accessories also rotate every two weeks, while your main lifts stay put so the
                weight on them still means something.
              </p>
              <Button full className="mt-3" onClick={() => setSheetOpen(true)}>
                <Sparkles size={16} /> Generate new plan
              </Button>
              <Button full variant="outline" className="mt-2" onClick={() => navigate('/plan/build')}>
                <Plus size={16} /> Build my own program
              </Button>
            </Card>
          </Section>
        </>
      ) : (
        /* ------- no plan yet ------- */
        <Section className="pt-1">
          <Card className="p-5">
            <div className="shout text-[12px] text-brand">No active plan</div>
            <h2 className="mt-1 text-[22px] font-bold leading-tight">Let’s build your program</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">
              A progressive multi-week plan generated from your goal, schedule and equipment —
              rack, smith, cables, bench and your exact plate pairs. Nothing you can’t load.
              You get one plan per location, so the gym session is a real gym session.
            </p>
            <Button full className="mt-4" onClick={() => setSheetOpen(true)}>
              <Sparkles size={16} /> Generate my plan
            </Button>
            <Button full variant="outline" className="mt-2" onClick={() => navigate('/plan/build')}>
              <Plus size={16} /> Build my own program
            </Button>
          </Card>
        </Section>
      )}

      {/* ------- where you train ------- */}
      <Section
        title="Where you train"
        action={(
          <Button variant="ghost" small onClick={() => void addLocation()}>
            <Plus size={15} /> Add
          </Button>
        )}
      >
        <ListGroup>
          {(eqProfiles ?? []).map((p) => (
            <ListRow
              key={p.id}
              leading={<MapPin size={18} className={p.id === currentEqId ? 'text-brand' : 'text-ink3'} />}
              title={p.name}
              subtitle={eqSummary(p)}
              right={p.id === currentEqId ? <Badge tone="brand">Current</Badge> : undefined}
              onClick={() => setEditing(p)}
            />
          ))}
          {eqProfiles && eqProfiles.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-ink3">
              No locations yet — add one to describe the kit you have there.
            </div>
          )}
        </ListGroup>
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink3">
          Switch location on the Workout tab. Each location gets its own plan, built from the kit
          that is actually there — switching swaps the whole session, not just a few exercises.
          A plan built somewhere else still works: loads and exercises are re-derived for wherever
          you are.
        </p>
      </Section>

      {/* ------- equipment editor ------- */}
      <EquipmentEditorSheet
        open={!!editing}
        target={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => void saveLocation(next)}
        onDelete={editing && !editing.builtIn ? (p) => setDeleting(p) : undefined}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void deleteLocation(deleting) }}
        title={`Delete ${deleting?.name ?? 'this location'}?`}
        message="Sessions already logged there keep their record. Your plan is not affected."
        confirmLabel="Delete location"
        danger
      />

      {/* ------- generate sheet: settings summary ------- */}
      <Sheet open={sheetOpen} onClose={() => !busy && setSheetOpen(false)} title="Generate new plan">
        <p className="mb-3 text-[13px] leading-relaxed text-ink2">
          Your plan is generated from these settings. Adjust them first if anything looks off.
          One plan is built for each of your locations — switching location on the Workout tab
          then switches the whole session.
        </p>
        <ListGroup className="bg-surface3">
          <ListRow
            leading={<CalendarDays size={18} className="text-brand" />}
            title="Training days"
            right={<span className="text-[15px] font-semibold text-ink">{profile.daysPerWeek} / week</span>}
            chevron={false}
          />
          <ListRow
            leading={<Timer size={18} className="text-brand" />}
            title="Session length"
            right={<span className="text-[15px] font-semibold text-ink">~{profile.sessionMinutes} min</span>}
            chevron={false}
          />
          <ListRow
            leading={<Target size={18} className="text-brand" />}
            title="Goal"
            right={<span className="text-[15px] font-semibold text-ink">{GOAL_LABELS[profile.goal]}</span>}
            chevron={false}
          />
        </ListGroup>
        <div className="mt-3">
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Program length</div>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Program length">
            {[1, 2, 4, 5, 6, 8, 12, 16].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={weeks === n} onClick={() => setWeeks(n)}
                className={`pressable rounded-xl py-2.5 text-[14px] font-bold ${weeks === n ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>
                {n} wk
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink3">
            Built from each location’s equipment (edit it under Locations). Longer programs repeat the
            5-week wave — foundations, build, push, peak, deload — a little heavier each block.
          </p>
        </div>
        <Button
          full
          variant="outline"
          className="mt-3"
          onClick={() => { setSheetOpen(false); navigate('/settings') }}
        >
          <Settings2 size={15} /> Change in Settings
        </Button>
        <Button full className="mt-2" onClick={onGeneratePressed} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <Sparkles size={16} />}
          {busy ? 'Building your plan…' : plan ? 'Generate & replace plan' : 'Generate plan'}
        </Button>
      </Sheet>

      {/* ------- replace warning ------- */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void doGenerate()}
        title="Replace current plan?"
        message={`“${plan?.name ?? 'Your plan'}” will be deactivated and replaced by a fresh program for each of your locations. All workout history and logs are kept.`}
        confirmLabel="Replace plan"
        danger
      />
    </div>
  )
}
