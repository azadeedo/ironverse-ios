// /plan/build — "Build my own program" (owner, 23 Oct 2026).
// Name it, pick how many weeks and which weekdays, then add your own exercises
// to each day (only what this location has), with sets, reps and rest.
// Saved as an ordinary Plan, so the Workout tab, sessions, history and PRs all
// work exactly as they do for a generated plan. Older plans are deactivated,
// never deleted — they stay under Coach programs → "Back to my own plan".

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Card, Field, Input, PageHeader, Section, Sheet } from '@/components/ui'
import { db, getProfile } from '@/db'
import { EXERCISES, byId } from '@/data/exercises'
import { getCurrentProfile, isAvailable } from '@/lib/equipment'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import type { Exercise, Muscle, Plan, PlanDay, PlanExercise } from '@/db/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DraftDay { title: string; exercises: PlanExercise[] }

function estMinutes(ex: PlanExercise[]): number {
  return Math.round(ex.reduce((s, px) => s + px.sets * (45 + px.restSec), 0) / 60) + 8
}

export default function BuildProgramScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const profile = useLiveQuery(() => getProfile(), [])
  const eq = useLiveQuery(() => getCurrentProfile(), [])
  const [name, setName] = useState('My program')
  const [weeks, setWeeks] = useState(6)
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5])
  const [days, setDays] = useState<DraftDay[]>([{ title: 'Day A', exercises: [] }, { title: 'Day B', exercises: [] }, { title: 'Day C', exercises: [] }])
  const [picking, setPicking] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()))
  const patchDay = (i: number, fn: (d: DraftDay) => DraftDay) => setDays((all) => all.map((d, j) => (j === i ? fn(d) : d)))
  const patchEx = (i: number, k: number, patch: Partial<PlanExercise>) =>
    patchDay(i, (d) => ({ ...d, exercises: d.exercises.map((px, j) => (j === k ? { ...px, ...patch } : px)) }))
  const move = (i: number, k: number, by: number) => patchDay(i, (d) => {
    const ex = [...d.exercises]; const t = k + by
    if (t < 0 || t >= ex.length) return d
    ;[ex[k], ex[t]] = [ex[t], ex[k]]
    return { ...d, exercises: ex }
  })

  function addExercise(i: number, ex: Exercise) {
    const compound = ex.kind === 'strength' && (ex.primary.length + (ex.secondary?.length ?? 0)) >= 3
    const px: PlanExercise = { exerciseId: ex.id, sets: 3, reps: ex.repRange ?? (compound ? [6, 10] : [10, 15]), restSec: compound ? 120 : 75 }
    if (ex.loadMode === 'time') px.timeSec = 45
    patchDay(i, (d) => ({ ...d, exercises: [...d.exercises, px] }))
    setPicking(null)
  }

  const ready = name.trim() && weekdays.length > 0 && days.some((d) => d.exercises.length > 0)

  async function save() {
    if (!ready || busy || !profile) return
    setBusy(true)
    try {
      const used = days.filter((d) => d.exercises.length > 0)
      const planDays: PlanDay[] = used.map((d) => {
        const focus = [...new Set(d.exercises.flatMap((px) => byId.get(px.exerciseId)?.primary ?? []))] as Muscle[]
        return { id: newId(), title: d.title.trim() || 'Workout', focus, exercises: d.exercises, estMinutes: estMinutes(d.exercises), estCalories: Math.round(estMinutes(d.exercises) * 6) }
      })
      const plan: Plan = {
        id: newId(),
        name: name.trim(),
        weeks: Array.from({ length: weeks }, (_, w) => ({ index: w + 1, label: `Week ${w + 1}`, days: planDays.map((d) => ({ ...d, id: newId() })) })),
        startDate: todayStr(),
        trainingWeekdays: weekdays,
        active: true,
        createdAt: nowIso(),
        sourceLabel: 'Built by you',
      }
      if (eq) plan.equipmentProfileId = eq.id
      await db.transaction('rw', db.plans, async () => {
        await db.plans.toCollection().modify((p) => { p.active = false })
        await db.plans.add(plan)
      })
      toast(`“${plan.name}” is your plan now — older plans are kept`)
      navigate('/workout')
    } finally { setBusy(false) }
  }

  return (
    <div className="pb-28">
      <PageHeader title="Build my own program" back="/plan" subtitle={eq ? `Exercises for ${eq.name} — switch location on the Workout tab first to build for another place.` : undefined} />
      <Section>
        <Card className="space-y-3 p-4">
          <Field label="Program name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Length</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 4, 6, 8, 12].map((n) => (
                <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWeeks(n)} className={`pressable rounded-xl py-2.5 text-[14px] font-bold ${weeks === n ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{n} wk</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Training days ({weekdays.length})</div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w, d) => (
                <button key={w} type="button" aria-pressed={weekdays.includes(d)} onClick={() => toggleDay(d)} className={`pressable rounded-lg py-2 text-[12.5px] font-bold ${weekdays.includes(d) ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{w}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink3">Your workouts below rotate across these days in order (A, B, C, A…).</p>
          </div>
        </Card>
      </Section>

      {days.map((d, i) => (
        <Section key={i} title={`Workout ${i + 1}`}>
          <Card className="p-4">
            <div className="flex gap-2">
              <Input aria-label={`Workout ${i + 1} name`} value={d.title} onChange={(e) => patchDay(i, (x) => ({ ...x, title: e.target.value }))} />
              {days.length > 1 && <Button small variant="secondary" aria-label="Remove workout" onClick={() => setDays((all) => all.filter((_, j) => j !== i))}><Trash2 size={15} /></Button>}
            </div>
            {d.exercises.length === 0 && <p className="mt-3 text-[13px] text-ink3">No exercises yet.</p>}
            <div className="mt-2 space-y-2">
              {d.exercises.map((px, k) => {
                const ex = byId.get(px.exerciseId)
                return (
                  <div key={`${px.exerciseId}-${k}`} className="rounded-xl bg-surface3 p-3">
                    <div className="flex items-center gap-2">
                      <b className="flex-1 text-[14px]">{ex?.name ?? px.exerciseId}</b>
                      <button type="button" aria-label="Move up" className="p-1 text-ink3" onClick={() => move(i, k, -1)}><ArrowUp size={15} /></button>
                      <button type="button" aria-label="Move down" className="p-1 text-ink3" onClick={() => move(i, k, 1)}><ArrowDown size={15} /></button>
                      <button type="button" aria-label="Remove" className="p-1 text-red-400" onClick={() => patchDay(i, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) }))}><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5 text-[11px] text-ink3">
                      <label>Sets<Input inputMode="numeric" value={String(px.sets)} onChange={(e) => patchEx(i, k, { sets: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)) })} /></label>
                      <label>Reps from<Input inputMode="numeric" value={String(px.reps[0])} onChange={(e) => patchEx(i, k, { reps: [Math.max(1, parseInt(e.target.value, 10) || 1), px.reps[1]] })} /></label>
                      <label>Reps to<Input inputMode="numeric" value={String(px.reps[1])} onChange={(e) => patchEx(i, k, { reps: [px.reps[0], Math.max(px.reps[0], parseInt(e.target.value, 10) || px.reps[0])] })} /></label>
                      <label>Rest (s)<Input inputMode="numeric" value={String(px.restSec)} onChange={(e) => patchEx(i, k, { restSec: Math.max(15, Math.min(600, parseInt(e.target.value, 10) || 60)) })} /></label>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button small variant="secondary" className="mt-3" onClick={() => setPicking(i)}><Plus size={15} /> Add exercise</Button>
            {d.exercises.length > 0 && <div className="mt-2 text-[11.5px] text-ink3">About {estMinutes(d.exercises)} min</div>}
          </Card>
        </Section>
      ))}
      <Section>
        <Button full variant="outline" onClick={() => setDays((all) => [...all, { title: `Day ${String.fromCharCode(65 + all.length)}`, exercises: [] }])}><Plus size={15} /> Add another workout</Button>
      </Section>

      <div className="fixed inset-x-0 z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-xl" style={{ bottom: 'calc(var(--sab) + 58px)' }}>
        <Button full disabled={!ready || busy} onClick={() => void save()}>{busy ? 'Saving…' : `Save & start ${weeks}-week program`}</Button>
      </div>
      {picking !== null && eq && <ExercisePickSheet available={(ex) => isAvailable(ex, eq)} onPick={(ex) => addExercise(picking, ex)} onClose={() => setPicking(null)} />}
    </div>
  )
}

function ExercisePickSheet({ available, onPick, onClose }: { available: (ex: Exercise) => boolean; onPick: (ex: Exercise) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return EXERCISES.filter((ex) => (all || available(ex)) && (!s || ex.name.toLowerCase().includes(s) || ex.primary.some((m) => m.includes(s))))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80)
  }, [q, all, available])
  return (
    <Sheet open onClose={onClose} title="Add exercise">
      <div className="flex items-center gap-2 rounded-xl bg-surface3 px-3"><Search size={16} className="text-ink3" /><input autoFocus className="h-11 flex-1 bg-transparent text-[16px] outline-none" placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <label className="mt-2 flex items-center gap-2 text-[12.5px] text-ink2"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show exercises this location can’t do</label>
      <div className="mt-2 max-h-[55svh] divide-y divide-line overflow-y-auto">
        {list.map((ex) => (
          <button key={ex.id} type="button" onClick={() => onPick(ex)} className="pressable block w-full py-2.5 text-left">
            <div className="text-[14px] font-semibold">{ex.name}{!available(ex) && <span className="ml-1.5 text-[11px] text-amber-400">not at this location</span>}</div>
            <div className="text-[12px] text-ink3">{ex.primary.join(', ')} · {ex.kind}</div>
          </button>
        ))}
        {list.length === 0 && <p className="py-4 text-center text-[13px] text-ink3">No matches.</p>}
      </div>
    </Sheet>
  )
}
