// v6 session upgrades: any-decimal kg/lb entry with per-machine increments,
// "too heavy today" attempts (history is never rewritten), sticking points,
// set-1 check, discomfort, add-an-exercise / custom machine, feel + PR moments.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Plus, Search, Sparkles, Trophy } from 'lucide-react'
import { Button, Callout, Card, Field, Input, Select, Sheet } from '@/components/ui'
import { HeroBanner } from '@/components/program'
import { db } from '@/db'
import { EXERCISES, byId, registerCustomExercises } from '@/data/exercises'
import { STICKING, type LiftKey } from '@/data/program12'
import { MUSCLE_LABELS, type CustomExercise, type ExerciseMeta, type Muscle, type SetLog, type WorkoutLog } from '@/db/types'
import { newId, nowIso } from '@/lib/id'

export const LB = 0.45359237
export const toKg = (v: number, u: 'kg' | 'lb') => (u === 'lb' ? v * LB : v)
export const fromKg = (kg: number, u: 'kg' | 'lb') => (u === 'lb' ? kg / LB : kg)
const r2 = (n: number) => Math.round(n * 100) / 100

export function liftOf(exerciseId: string): LiftKey | null {
  if (exerciseId === 'barbell-squat' || exerciseId === 'paused-squat') return 'squat'
  if (['barbell-bench-press', 'paused-bench-press', 'close-grip-bench-press'].includes(exerciseId)) return 'bench'
  if (exerciseId === 'barbell-deadlift' || exerciseId === 'paused-deadlift') return 'deadlift'
  return null
}

/** Displayed weight in the exercise's own unit, with the converted value underneath when not kg. */
export function weightText(s: SetLog, unit: 'kg' | 'lb'): { main: string; sub?: string } {
  if (s.weightKg === undefined) return { main: '—' }
  const shown = s.unit === unit && s.entered !== undefined ? s.entered : r2(fromKg(s.weightKg, unit))
  return unit === 'lb' ? { main: `${shown} lb`, sub: `≈ ${r2(s.weightKg)} kg` } : { main: `${r2(s.weightKg)} kg` }
}

// ---------- weight entry ----------
export function WeightSheet({ open, onClose, set, exerciseName, meta, onSave, onSaveMeta }: {
  open: boolean; onClose: () => void; set: SetLog | null; exerciseName: string; meta?: ExerciseMeta
  onSave: (kg: number, unit: 'kg' | 'lb', entered: number) => void
  onSaveMeta: (patch: Partial<ExerciseMeta>) => void
}) {
  const [unit, setUnit] = useState<'kg' | 'lb'>(meta?.unit ?? 'kg')
  const [val, setVal] = useState('')
  const [incs, setIncs] = useState((meta?.increments ?? []).join(', '))
  if (!open || !set) return null
  const base = set.weightKg !== undefined ? r2(fromKg(set.weightKg, unit)) : undefined
  const v = parseFloat((val || (base !== undefined ? String(base) : '')).replace(',', '.'))
  const steps = (meta?.unit === unit ? meta?.increments : undefined) ?? []
  const save = () => {
    if (!(v >= 0)) return
    onSave(r2(toKg(v, unit)), unit, r2(v))
    if (unit !== (meta?.unit ?? 'kg')) onSaveMeta({ unit })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={`Weight — ${exerciseName}`}>
      <div className="space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Unit">
          {(['kg', 'lb'] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)}
              className={`pressable h-11 flex-1 rounded-xl text-[15px] font-bold ${unit === u ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{u}</button>
          ))}
        </div>
        <Input autoFocus inputMode="decimal" placeholder={base !== undefined ? String(base) : 'e.g. 22.5'} value={val} onChange={(e) => setVal(e.target.value)} aria-label={`Weight in ${unit}`} className="text-center text-[28px] font-bold" />
        <div className="text-center text-[13px] text-ink3">{Number.isFinite(v) ? (unit === 'lb' ? `≈ ${r2(v * LB)} kg` : `≈ ${r2(v / LB)} lb`) : 'Any decimal works — 1.25, 7.5, 22.7…'}</div>
        {steps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{steps.map((s) => <button key={s} type="button" onClick={() => setVal(String(s))} className="pressable rounded-lg bg-surface3 px-3 py-2 text-[13px] font-semibold">{s} {unit}</button>)}</div>
        )}
        <Button full onClick={save}>Use this weight</Button>
        <details className="rounded-xl bg-surface2 p-3">
          <summary className="cursor-pointer text-[13px] font-semibold">This machine's weights</summary>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {([['lb', 10, 10, 300, 'lb · goes up in 10s'], ['lb', 5, 5, 200, 'lb · 5s'], ['kg', 5, 5, 150, 'kg · 5s'], ['kg', 2.5, 2.5, 120, 'kg · 2.5s']] as const).map(([u, step, from, to, label]) => (
                <button key={label} type="button" onClick={() => {
                  const list: number[] = []; for (let x = from; x <= to + 0.001; x += step) list.push(Math.round(x * 100) / 100)
                  setUnit(u); setIncs(list.join(', ')); onSaveMeta({ unit: u, increments: list })
                }} className={`pressable rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${meta?.unit === u && meta?.increments?.[1] !== undefined && Math.abs((meta.increments[1] - meta.increments[0]) - step) < 0.01 ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{label}</button>
              ))}
            </div>
            <div className="text-[11.5px] text-ink3">Pick the one that matches the machine's pin stack — suggestions, weight changes and progression will only use those numbers (and show pounds).</div>
            <Field label={`Available weights in ${unit} (comma separated)`} hint="Progression suggestions will only pick from these. Leave blank to use the normal plate maths.">
              <Input value={incs} onChange={(e) => setIncs(e.target.value)} placeholder="e.g. 10, 20, 30, 40, 50" />
            </Field>
            <Button small variant="secondary" onClick={() => {
              const list = incs.split(/[,\s]+/).map((x) => parseFloat(x)).filter((x) => x > 0).sort((a, b) => a - b)
              onSaveMeta({ unit, increments: list.length ? list : undefined })
            }}>Save machine weights</Button>
          </div>
        </details>
      </div>
    </Sheet>
  )
}

// ---------- too heavy today ----------
export function TooHeavySheet({ open, onClose, set, unit, onReduce }: {
  open: boolean; onClose: () => void; set: SetLog | null; unit: 'kg' | 'lb'
  onReduce: (attempt: { reps?: number }, newKg: number) => void
}) {
  const [reps, setReps] = useState('')
  if (!open || !set || set.weightKg === undefined) return null
  const kg = set.weightKg
  const opts = [0.95, 0.9, 0.85].map((f) => r2(Math.round((kg * f) / 2.5) * 2.5))
  return (
    <Sheet open onClose={onClose} title="Too heavy today">
      <div className="space-y-3">
        <p className="text-[13.5px] text-ink2">{weightText(set, unit).main} gets recorded as <b>attempted</b>. The lighter weight you finish with is recorded as completed — the plan's original number is kept, never overwritten.</p>
        <Field label="Reps you managed at this weight (optional)"><Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-2">
          {opts.map((o) => <Button key={o} variant="secondary" onClick={() => { onReduce({ reps: parseInt(reps, 10) || undefined }, o); onClose() }}>{unit === 'lb' ? `${r2(o / LB)} lb` : `${o} kg`}</Button>)}
        </div>
        <div className="text-[12px] text-ink3">−5%, −10% or −15%. If this keeps happening the app flags possible overreach and suggests reviewing load and recovery.</div>
      </div>
    </Sheet>
  )
}

// ---------- sticking point ----------
export function StickingPrompt({ lift, value, onPick }: { lift: LiftKey; value?: string; onPick: (v: string | undefined) => void }) {
  return (
    <div className="px-2 pb-2">
      <div className="mb-1 pl-7 text-[11px] font-semibold uppercase tracking-wide text-ink3">Where did it get hardest? (optional)</div>
      <div className="flex flex-wrap gap-1.5 pl-7">
        {[...STICKING[lift], 'Form broke down'].map((p) => (
          <button key={p} type="button" onClick={() => onPick(value === p ? undefined : p)} aria-pressed={value === p}
            className={`pressable rounded-full px-2.5 py-1.5 text-[12px] font-semibold ${value === p ? (p === 'Form broke down' ? 'bg-red-500 text-white' : 'bg-brand text-white') : 'bg-surface3 text-ink2'}`}>{p}</button>
        ))}
      </div>
    </div>
  )
}

// ---------- set 1 much worse than planned ----------
export function SetOneCheck({ set, onKeep, onReduce, onTarget, onEnd }: { set: SetLog; onKeep: () => void; onReduce: () => void; onTarget: () => void; onEnd: () => void }) {
  return (
    <Callout tone="warn" icon={<AlertTriangle size={16} />}>
      <div className="space-y-2">
        <div className="font-semibold">Set 1 came in well under the target ({set.reps ?? 0} vs {set.targetReps[0]}–{set.targetReps[1]}).</div>
        <div className="text-[12.5px]">Bad days happen. What do you want to do with the rest?</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button small variant="secondary" onClick={onKeep}>Keep load</Button>
          <Button small variant="secondary" onClick={onReduce}>Reduce 5%</Button>
          <Button small variant="secondary" onClick={onTarget}>Lower rep target</Button>
          <Button small variant="danger" onClick={onEnd}>End exercise</Button>
        </div>
      </div>
    </Callout>
  )
}

// ---------- discomfort ----------
const WHERE = ['Lower back', 'Knee', 'Shoulder', 'Elbow', 'Wrist', 'Hip', 'Neck', 'Other']
export function DiscomfortSheet({ open, onClose, exerciseName, repeatCount, onSave, onSwap }: {
  open: boolean; onClose: () => void; exerciseName: string; repeatCount: number
  onSave: (where: string | undefined, note: string) => void; onSwap: () => void
}) {
  const [where, setWhere] = useState<string | undefined>()
  const [note, setNote] = useState('')
  if (!open) return null
  return (
    <Sheet open onClose={onClose} title={`Discomfort — ${exerciseName}`}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{WHERE.map((w) => <button key={w} type="button" onClick={() => setWhere(where === w ? undefined : w)} className={`pressable rounded-full px-3 py-2 text-[13px] ${where === w ? 'bg-brand text-white' : 'bg-surface3'}`}>{w}</button>)}</div>
        <Field label="What did it feel like? (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. pinch at the bottom of the rep" /></Field>
        {repeatCount >= 1 && <Callout tone="warn">You've reported discomfort on this exercise before. Consider swapping to an alternative movement, and if it keeps happening, get it looked at by a physio or GP — the app can't diagnose injuries.</Callout>}
        <Button full onClick={() => { onSave(where, note); onClose() }}>Save</Button>
        <Button full variant="secondary" onClick={() => { onSave(where, note); onClose(); onSwap() }}>Save and swap the exercise</Button>
        <div className="text-[11.5px] text-ink3">Sharp pain, numbness or pain that changes how you move: stop the exercise. Don't train through what looks like an injury.</div>
      </div>
    </Sheet>
  )
}

// ---------- add an exercise (any, or create one) ----------
/** The machine library — every machine the gym is expected to have, plus your custom machines. */
export const MACHINE_LIBRARY: { id: string; group: string }[] = [
  { id: 'leg-press', group: 'Legs' }, { id: 'hack-squat', group: 'Legs' }, { id: 'pendulum-squat', group: 'Legs' },
  { id: 'leg-extension', group: 'Legs' }, { id: 'seated-leg-curl', group: 'Legs' }, { id: 'lying-leg-curl', group: 'Legs' },
  { id: 'abductor-machine', group: 'Legs' }, { id: 'adductor-machine', group: 'Legs' }, { id: 'hip-thrust-machine', group: 'Legs' }, { id: 'glute-drive-machine', group: 'Legs' },
  { id: 'standing-calf-raise-machine', group: 'Legs' }, { id: 'seated-calf-raise-machine', group: 'Legs' },
  { id: 'chest-press-machine', group: 'Chest / shoulders' }, { id: 'incline-chest-press-machine', group: 'Chest / shoulders' }, { id: 'shoulder-press-machine', group: 'Chest / shoulders' },
  { id: 'pec-deck', group: 'Chest / shoulders' }, { id: 'reverse-pec-deck', group: 'Chest / shoulders' }, { id: 'lateral-raise-machine', group: 'Chest / shoulders' },
  { id: 'lat-pulldown', group: 'Back' }, { id: 'machine-high-row', group: 'Back' }, { id: 'iso-lateral-row', group: 'Back' }, { id: 'seated-row-machine', group: 'Back' },
  { id: 'chest-supported-row', group: 'Back' }, { id: 'machine-pullover', group: 'Back' }, { id: 'assisted-pull-up', group: 'Back' },
  { id: 'machine-preacher-curl', group: 'Arms' }, { id: 'biceps-curl-machine', group: 'Arms' }, { id: 'triceps-extension-machine', group: 'Arms' }, { id: 'assisted-dip', group: 'Arms' }, { id: 'seated-dip-machine', group: 'Arms' },
  { id: 'ab-crunch-machine', group: 'Core / back' }, { id: '45-degree-back-extension', group: 'Core / back' },
]

export function AddExerciseSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (id: string, toProgram: boolean) => void }) {
  const [q, setQ] = useState('')
  const [toProgram, setToProgram] = useState(false)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'existing' | 'machine' | 'custom'>('existing')
  const customs = useLiveQuery(async () => { try { return await db.customExercises.toArray() } catch { return [] } }, []) ?? []
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const match = (e: { name: string; primary: string[]; equipment?: unknown[] }) => !s || e.name.toLowerCase().includes(s) || e.primary.some((m) => m.includes(s)) || (e.equipment ?? []).some((x) => String(x).includes(s))
    if (tab === 'machine') {
      const lib = MACHINE_LIBRARY.map((m) => byId.get(m.id)).filter(Boolean) as typeof EXERCISES
      const mine = customs.filter((c) => c.category === 'machine' || c.category === 'selectorised' || c.category === 'plate-loaded').map((c) => byId.get(c.id)).filter(Boolean) as typeof EXERCISES
      return [...mine, ...lib].filter(match)
    }
    if (tab === 'custom') return customs.map((c) => byId.get(c.id)).filter(Boolean).filter((e) => match(e!)) as typeof EXERCISES
    return EXERCISES.filter(match).slice(0, 40)
  }, [q, tab, customs])
  if (!open) return null
  if (creating) return <CustomExerciseSheet onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onAdd(id, toProgram); onClose() }} />
  return (
    <Sheet open onClose={onClose} title="Add an exercise" tall>
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface3 p-1">
          {([['existing', 'Exercises'], ['machine', 'Machines'], ['custom', 'Custom']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`pressable min-h-[40px] rounded-lg text-[13px] font-semibold ${tab === k ? 'bg-brand text-white' : 'text-ink2'}`}>{l}</button>
          ))}
        </div>
        <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-ink3" /><Input className="pl-9" placeholder={tab === 'machine' ? 'Search machines' : 'Search name, muscle or equipment'} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={toProgram} onChange={(e) => setToProgram(e.target.checked)} className="h-5 w-5 accent-amber-400" /> Add it to my program now (otherwise you're asked after the workout)</label>
        <Button full variant="secondary" onClick={() => setCreating(true)}><Plus size={15} /> {tab === 'machine' ? 'Add a custom machine' : 'Create a new exercise / machine'}</Button>
        {tab === 'custom' && list.length === 0 && <div className="rounded-xl bg-surface2 p-3 text-[12.5px] text-ink3">No custom exercises yet — create one above. It is saved permanently and works like any other exercise.</div>}
        <div className="max-h-[52svh] space-y-1 overflow-y-auto">
          {list.map((e) => (
            <button key={e.id} type="button" onClick={() => { onAdd(e.id, toProgram); onClose() }} className="pressable flex w-full items-center justify-between rounded-xl bg-surface2 px-3 py-2.5 text-left">
              <span><span className="block text-[14px] font-semibold">{e.name}</span><span className="block text-[11.5px] text-ink3">{e.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}</span></span>
              <Plus size={16} className="text-brand" />
            </button>
          ))}
        </div>
        <div className="text-[11.5px] text-ink3">Extra exercises log sets, count toward weekly volume and history. They only change your program if you tick the box.</div>
      </div>
    </Sheet>
  )
}

const CATEGORIES: CustomExercise['category'][] = ['machine', 'selectorised', 'plate-loaded', 'cable', 'barbell', 'dumbbell', 'smith', 'bodyweight', 'cardio', 'other']
const MUSCLES: Muscle[] = ['chest', 'front-delts', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'forearms', 'lats', 'upper-back', 'traps', 'lower-back', 'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves']
export function CustomExerciseSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: '', category: 'machine' as CustomExercise['category'], machine: '', primary: '' as Muscle | '', secondary: [] as Muscle[], unit: 'kg' as 'kg' | 'lb', notes: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const save = async () => {
    if (!f.name.trim() || !f.primary) return
    const c: CustomExercise = {
      id: `custom-${newId()}`, name: f.name.trim(), category: f.category, machine: f.machine.trim() || undefined,
      primary: [f.primary], secondary: f.secondary.filter((m) => m !== f.primary), unit: f.unit, notes: f.notes.trim() || undefined,
      ...(photo ? { photo } : {}), createdAt: nowIso(),
    }
    await db.customExercises.put(c)
    if (f.unit === 'lb') await db.exerciseMeta.put({ exerciseId: c.id, unit: 'lb', updatedAt: nowIso() })
    registerCustomExercises([c])
    onCreated(c.id)
  }
  return (
    <Sheet open onClose={onClose} title="New exercise or machine" tall>
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Hammer Strength Iso Row" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as CustomExercise['category'] })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
          <Field label="Weight unit"><Select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as 'kg' | 'lb' })}><option value="kg">kg</option><option value="lb">lb</option></Select></Field>
        </div>
        <Field label="Machine / brand (optional)"><Input value={f.machine} onChange={(e) => setF({ ...f, machine: e.target.value })} /></Field>
        <Field label="Primary muscle"><Select value={f.primary} onChange={(e) => setF({ ...f, primary: e.target.value as Muscle })}><option value="">Choose…</option>{MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}</Select></Field>
        <div><div className="mb-1.5 text-[13px] font-medium text-ink2">Secondary muscles</div>
          <div className="flex flex-wrap gap-1.5">{MUSCLES.filter((m) => m !== f.primary).map((m) => <button key={m} type="button" onClick={() => setF({ ...f, secondary: f.secondary.includes(m) ? f.secondary.filter((x) => x !== m) : [...f.secondary, m] })} className={`pressable rounded-full px-2.5 py-1.5 text-[12px] ${f.secondary.includes(m) ? 'bg-brand text-white' : 'bg-surface3'}`}>{MUSCLE_LABELS[m]}</button>)}</div></div>
        <Field label="Notes (optional)"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Seat 4, handles neutral" /></Field>
        <Field label="Photo (optional)"><input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></Field>
        <Button full disabled={!f.name.trim() || !f.primary} onClick={() => void save()}>Save — remember it permanently</Button>
      </div>
    </Sheet>
  )
}

// ---------- finish: how did it feel + PR celebration ----------
export function FeelPrompt({ value, onPick }: { value?: WorkoutLog['feel']; onPick: (f: NonNullable<WorkoutLog['feel']>) => void }) {
  const opts: [NonNullable<WorkoutLog['feel']>, string][] = [['easy', 'Easy'], ['good', 'Good'], ['hard', 'Hard'], ['too-hard', 'Too hard']]
  return (
    <Card className="p-4">
      <div className="text-[15px] font-semibold">How did that feel?</div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">{opts.map(([k, l]) => <button key={k} type="button" onClick={() => onPick(k)} aria-pressed={value === k} className={`pressable h-11 rounded-xl text-[13px] font-semibold ${value === k ? 'bg-brand text-white' : 'bg-surface3'}`}>{l}</button>)}</div>
      <div className="mt-2 text-[11.5px] text-ink3">Used as one more signal for next time's loads — never on its own.</div>
    </Card>
  )
}

export function PRCelebration({ prs, onClose }: { prs: { name: string; detail: string; previous?: string; diff?: string; date: string }[]; onClose: () => void }) {
  if (!prs.length) return null
  return (
    <Sheet open onClose={onClose} title="">
      <div className="space-y-3 text-center">
        <HeroBanner id="hero-pr"><div className="flex items-center justify-center gap-2"><Trophy size={26} className="text-amber-300" /><span className="shout text-[26px] text-white">New PR{prs.length > 1 ? 's' : ''}</span></div></HeroBanner>
        {prs.map((p, i) => (
          <Card key={i} className="p-3 text-left">
            <div className="text-[15px] font-semibold">{p.name}</div>
            <div className="text-[13px]"><b>New:</b> {p.detail}</div>
            <div className="text-[12.5px] text-ink3">Previous: {p.previous ?? 'first time logged'}{p.diff ? ` · ${p.diff}` : ''} · {p.date}</div>
          </Card>
        ))}
        <Button full onClick={onClose}><Sparkles size={16} /> Nice</Button>
      </div>
    </Sheet>
  )
}

export function useDiscomfortCount(exerciseId: string): number {
  return useLiveQuery(async () => {
    const d = new Date(Date.now() - 28 * 864e5)
    const since = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const logs = await db.workoutLogs.where('date').aboveOrEqual(since).toArray()
    return logs.reduce((n, l) => n + (l.discomfort ?? []).filter((d) => d.exerciseId === exerciseId).length, 0)
  }, [exerciseId]) ?? 0
}
export { byId }
