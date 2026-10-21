// FIRST-TIME SETUP — the iOS app's 8-screen onboarding (route /welcome).
// Logic lives in lib/firstRun.ts. Every answer is saved as it changes, so an
// interrupted setup resumes on the same screen. Optional answers can be
// skipped and edited later in Settings (the original setup at /onboarding and
// every Settings card still work exactly as before).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Dumbbell, Home as HomeIcon, Building2, Sparkles, Upload, ShieldCheck, Info,
} from 'lucide-react'
import { Button, Card, Field, Input, Segmented, Spinner, Toggle } from '@/components/ui'
import { getProfile } from '@/db'
import type { Profile } from '@/db/types'
import { useUI } from '@/lib/store'
import {
  GOAL_OPTIONS, HOME_KIT, LIFT_LABELS, ONE_RM_FORMULA_NOTE, applyFirstRun, cmToFtIn, draftFromExisting, emptyDraft,
  estimateOneRm, finishFirstRun, ftInToCm, kgToLb, lbToKg, liftOneRm, previewProfile, round1, saveDraft,
  type FirstRunDraft, type GoalKey, type LiftKey, type LiftMode, type TrainingStyle,
} from '@/lib/firstRun'
import { useTour } from '@/components/Tour'

const STEPS = ['Welcome', 'About you', 'Goals', 'Strength', 'Training', 'Personalise', 'Tour', 'Done'] as const
const num = (s: string): number | undefined => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : undefined }

export default function FirstRunScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { toast } = useUI()
  const startTour = useTour((s) => s.start)
  const [d, setD] = useState<FirstRunDraft | null>(null)
  const [base, setBase] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [targets, setTargets] = useState<{ calories?: number; protein?: number; waterMl?: number }>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      const draft = await draftFromExisting()
      const want = Number(params.get('step'))
      if (Number.isFinite(want) && want > 0) { draft.step = Math.min(STEPS.length - 1, want); void saveDraft(draft) }
      setD(draft)
      setBase((await getProfile()) ?? null)
      // the ?step= hint is used once; from here the saved draft is the source of truth
      if (params.has('step')) setParams({}, { replace: true })
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // always derived from the LATEST draft, so quick successive taps never undo each other
  const update = (fn: (cur: FirstRunDraft) => Partial<FirstRunDraft>) => setD((cur) => {
    if (!cur) return cur
    const next = { ...cur, ...fn(cur) }
    void saveDraft(next)
    return next
  })
  const patch = (p: Partial<FirstRunDraft>) => update(() => p)
  const go = (step: number) => { patch({ step }); scrollRef.current?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }) }

  const preview = useMemo(() => (base && d ? previewProfile(base, d) : null), [base, d])

  if (!d || !base || !preview) return <div className="flex h-[80svh] items-center justify-center"><Spinner /></div>

  async function apply() {
    if (!d || busy) return
    setBusy(true)
    try {
      const r = await applyFirstRun(d, targets)
      setBase(r.profile)
      toast(r.planKind === 'program12' ? '12-week program ready' : r.planKind === 'generated' ? 'Your plan is ready' : 'Your profile is saved')
      go(6)
    } catch {
      toast('Could not save — please try again', 'error')
    } finally { setBusy(false) }
  }

  async function done() {
    await finishFirstRun()
    navigate('/', { replace: true })
  }

  const step = d.step
  const imperial = d.units === 'imperial'

  return (
    <div ref={scrollRef} className="mx-auto flex min-h-[100svh] max-w-lg flex-col">
      {step > 0 && step < 7 && (
        <header className="sticky top-0 z-30 bg-[#0c111c]/95 pt-safe backdrop-blur-xl">
          <div className="flex h-[52px] items-center px-4">
            <div className="w-16">
              {step < 6 && (
                <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="pressable -ml-1.5 flex h-11 w-11 items-center justify-center rounded-full text-ink2">
                  <ArrowLeft size={22} />
                </button>
              )}
            </div>
            <div className="flex flex-1 items-center justify-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((t, i) => (
                <div key={t} className={`rounded-full transition-all duration-300 ${i === step ? 'h-2 w-6 bg-brand' : i < step ? 'h-2 w-2 bg-brand/60' : 'h-2 w-2 bg-surface3'}`} />
              ))}
            </div>
            <div className="w-16 text-right text-[12px] font-semibold text-ink3">{step + 1} / {STEPS.length}</div>
          </div>
        </header>
      )}

      <div key={step} className="page-in flex-1 px-4 pb-10 pt-2">
        {step === 0 && <Welcome onStart={() => go(1)} onRestore={() => navigate('/backup')} prefilled={!!d.prefilledFromBackup} />}

        {step === 1 && (
          <StepBody title="About you" sub="Used for calorie, protein and strength maths. Everything here is optional and editable later in Settings.">
            <Field label="Units">
              <Segmented options={[{ value: 'metric', label: 'Metric (kg, cm)' }, { value: 'imperial', label: 'Imperial (lb, ft)' }]} value={d.units} onChange={(v) => patch({ units: v })} />
            </Field>
            <Field label="Preferred name">
              <Input value={d.name} placeholder="What should we call you?" autoComplete="given-name" onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Age or date of birth">
              <Segmented options={[{ value: 'age', label: 'Age' }, { value: 'dob', label: 'Date of birth' }]} value={d.ageMode} onChange={(v) => patch({ ageMode: v })} />
              <div className="mt-2">
                {d.ageMode === 'age'
                  ? <Input inputMode="numeric" placeholder="e.g. 30" value={d.age ?? ''} onChange={(e) => patch({ age: num(e.target.value) })} />
                  : <Input type="date" value={d.dob ?? ''} onChange={(e) => patch({ dob: e.target.value })} />}
              </div>
            </Field>
            <Field label="Sex (for calorie maths)" hint="Optional — calorie formulas differ slightly by sex.">
              <Segmented options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={d.sex ?? base.sex} onChange={(v) => patch({ sex: v })} />
            </Field>
            {imperial ? (
              <Field label="Height">
                <div className="flex gap-2">
                  <Input inputMode="numeric" placeholder="ft" value={d.heightCm ? cmToFtIn(d.heightCm).ft : ''} onChange={(e) => patch({ heightCm: ftInToCm(num(e.target.value) ?? 0, d.heightCm ? cmToFtIn(d.heightCm).inch : 0) || undefined })} />
                  <Input inputMode="numeric" placeholder="in" value={d.heightCm ? cmToFtIn(d.heightCm).inch : ''} onChange={(e) => patch({ heightCm: ftInToCm(d.heightCm ? cmToFtIn(d.heightCm).ft : 0, num(e.target.value) ?? 0) || undefined })} />
                </div>
              </Field>
            ) : (
              <Field label="Height (cm)"><Input inputMode="decimal" placeholder="e.g. 175" value={d.heightCm ? Math.round(d.heightCm) : ''} onChange={(e) => patch({ heightCm: num(e.target.value) })} /></Field>
            )}
            <WeightField label="Current weight" imperial={imperial} kg={d.weightKg} onChange={(kg) => patch({ weightKg: kg })} />
            <Field label="Training experience">
              <Segmented options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={d.experience ?? base.experience} onChange={(v) => patch({ experience: v })} />
            </Field>
            <Nav onNext={() => go(2)} onSkip={() => go(2)} />
          </StepBody>
        )}

        {step === 2 && (
          <StepBody title="Your goals" sub="Pick as many as you like.">
            <div className="grid grid-cols-1 gap-2">
              {GOAL_OPTIONS.map((g) => {
                const on = d.goals.includes(g.key)
                return (
                  <button key={g.key} type="button" aria-pressed={on}
                    onClick={() => update((cur) => ({ goals: cur.goals.includes(g.key) ? cur.goals.filter((x) => x !== g.key) : [...cur.goals, g.key] as GoalKey[] }))}
                    className={`pressable flex min-h-[56px] items-center gap-3 rounded-xl2 border px-3.5 py-2.5 text-left ${on ? 'border-brand bg-brand/10' : 'border-line bg-surface2'}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-brand bg-brand text-black' : 'border-line'}`}>{on && <Check size={15} strokeWidth={3} />}</span>
                    <span><span className="block text-[14.5px] font-semibold text-ink">{g.label}</span><span className="block text-[12px] text-ink3">{g.desc}</span></span>
                  </button>
                )
              })}
            </div>
            {(d.goals.includes('fat-loss') || d.goals.includes('muscle') || d.goals.includes('recomp')) && (
              <WeightField label="Goal weight" imperial={imperial} kg={d.goalWeightKg} onChange={(kg) => patch({ goalWeightKg: kg })} />
            )}
            <Nav onNext={() => go(3)} onSkip={() => go(3)} />
          </StepBody>
        )}

        {step === 3 && (
          <StepBody title="Strength check" sub="Tell us what you know. You never need to attempt a max lift — “calculate later” is always fine, and Ironverse will estimate from your logged sets.">
            {(Object.keys(LIFT_LABELS) as LiftKey[]).map((k) => (
              <LiftCard key={k} label={LIFT_LABELS[k]} imperial={imperial} value={d.lifts[k]} onChange={(a) => update((cur) => ({ lifts: { ...cur.lifts, [k]: a } }))} />
            ))}
            <Card className="flex gap-2.5 p-3.5 text-[12.5px] leading-relaxed text-ink2">
              <Info size={16} className="mt-0.5 shrink-0 text-brand" />
              <span>{ONE_RM_FORMULA_NOTE}</span>
            </Card>
            <Nav onNext={() => go(4)} onSkip={() => go(4)} />
          </StepBody>
        )}

        {step === 4 && (
          <StepBody title="Training preferences" sub="Your plan is built around these.">
            <Field label={`Training days per week: ${d.daysPerWeek}`}>
              <input type="range" min={1} max={6} value={d.daysPerWeek} aria-label="Training days per week" className="w-full accent-[#fbbf24]" onChange={(e) => patch({ daysPerWeek: Number(e.target.value) })} />
            </Field>
            <Field label="Workout length">
              <Segmented options={[{ value: '30', label: '30 min' }, { value: '45', label: '45' }, { value: '60', label: '60' }, { value: '75', label: '75' }, { value: '90', label: '90' }]} value={String(d.sessionMinutes)} onChange={(v) => patch({ sessionMinutes: Number(v) })} />
            </Field>
            <Field label="Where do you train?">
              <div className="grid grid-cols-2 gap-2">
                {([{ v: 'gym', label: 'Gym', icon: Building2, sub: 'Full commercial gym' }, { v: 'home', label: 'Home', icon: HomeIcon, sub: 'Choose your equipment' }] as const).map((o) => (
                  <button key={o.v} type="button" aria-pressed={d.location === o.v} onClick={() => patch({ location: o.v })}
                    className={`pressable flex min-h-[72px] flex-col items-start rounded-xl2 border p-3 text-left ${d.location === o.v ? 'border-brand bg-brand/10' : 'border-line bg-surface2'}`}>
                    <o.icon size={20} className="text-brand" /><span className="mt-1 text-[14px] font-semibold">{o.label}</span><span className="text-[11.5px] text-ink3">{o.sub}</span>
                  </button>
                ))}
              </div>
            </Field>
            {d.location === 'home' && (
              <Field label="Available equipment" hint="Bodyweight exercises are always included.">
                <div className="flex flex-wrap gap-2">
                  {HOME_KIT.map((k) => {
                    const on = d.homeEquipment.includes(k.id)
                    return (
                      <button key={k.id} type="button" aria-pressed={on} onClick={() => update((cur) => ({ homeEquipment: cur.homeEquipment.includes(k.id) ? cur.homeEquipment.filter((x) => x !== k.id) : [...cur.homeEquipment, k.id] }))}
                        className={`pressable min-h-[40px] rounded-full border px-3 text-[13px] font-medium ${on ? 'border-brand bg-brand/15 text-ink' : 'border-line bg-surface2 text-ink2'}`}>{k.label}</button>
                    )
                  })}
                </div>
              </Field>
            )}
            <Field label="Preferred style">
              <div className="space-y-2">
                {([
                  { v: 'general', label: 'Balanced', sub: 'A mix of strength and muscle work — a good default' },
                  { v: 'strength', label: 'Strength focus', sub: 'Heavier compound lifts, lower reps' },
                  { v: 'hypertrophy', label: 'Muscle focus', sub: 'Moderate weights, more volume' },
                  { v: 'program12', label: 'Ironverse 12-week program', sub: '48 written workouts, 4 days a week, squat/bench/deadlift focus — best for intermediate lifters' },
                ] as { v: TrainingStyle; label: string; sub: string }[]).map((o) => (
                  <button key={o.v} type="button" aria-pressed={d.style === o.v} onClick={() => patch({ style: o.v })}
                    className={`pressable w-full rounded-xl2 border p-3 text-left ${d.style === o.v ? 'border-brand bg-brand/10' : 'border-line bg-surface2'}`}>
                    <div className="text-[14px] font-semibold">{o.label}</div><div className="text-[12px] text-ink3">{o.sub}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Nav onNext={() => go(5)} />
          </StepBody>
        )}

        {step === 5 && (
          <StepBody title="Personalise" sub={`${d.name.trim() ? d.name.trim() + ', here' : 'Here'}’s what Ironverse will set up from your answers. Adjust anything.`}>
            <Card className="space-y-3 p-4">
              <Row label="Daily calories" hint={`Maintenance ≈ ${preview.tdee.toLocaleString()} kcal`}>
                <div className="w-28 shrink-0"><Input inputMode="numeric" className="text-right" value={targets.calories ?? preview.calories} onChange={(e) => setTargets((t) => ({ ...t, calories: num(e.target.value) }))} /></div>
              </Row>
              <Row label="Daily protein (g)">
                <div className="w-28 shrink-0"><Input inputMode="numeric" className="text-right" value={targets.protein ?? preview.protein} onChange={(e) => setTargets((t) => ({ ...t, protein: num(e.target.value) }))} /></div>
              </Row>
              <Row label="Water (ml)">
                <div className="w-28 shrink-0"><Input inputMode="numeric" className="text-right" value={targets.waterMl ?? preview.waterMl} onChange={(e) => setTargets((t) => ({ ...t, waterMl: num(e.target.value) }))} /></div>
              </Row>
            </Card>
            <Card className="space-y-1.5 p-4 text-[13px] text-ink2">
              <div className="text-[14px] font-semibold text-ink">Your plan</div>
              {d.style === 'program12'
                ? <p>The Ironverse 12-week program, starting this week. Weights come from your strength answers and adapt to what you log.</p>
                : <p>A {preview.profile.daysPerWeek}-day plan built for {d.location === 'home' ? 'your home equipment' : 'a full gym'}, ~{preview.profile.sessionMinutes} min a session. It progresses from what you log.</p>}
              {(Object.keys(LIFT_LABELS) as LiftKey[]).some((k) => liftOneRm(d.lifts[k])) && (
                <p className="text-[12.5px]">Strength: {(Object.keys(LIFT_LABELS) as LiftKey[]).filter((k) => liftOneRm(d.lifts[k])).map((k) => `${LIFT_LABELS[k]} ~${fmtW(liftOneRm(d.lifts[k])!, imperial)}`).join(' · ')}</p>
              )}
            </Card>
            <Card className="space-y-3 p-4">
              <Row label="Halal food filter" hint="Hides pork and alcohol, flags unclear items"><Toggle checked={d.halalMode} onChange={(v) => patch({ halalMode: v })} /></Row>
              <Row label="Workout & water reminders" hint="Local notifications on this iPhone"><Toggle checked={d.reminders} onChange={(v) => patch({ reminders: v })} /></Row>
            </Card>
            {d.prefilledFromBackup && (
              <Card className="flex gap-2.5 p-3.5 text-[12.5px] text-ink2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-good" />Prefilled from your restored backup. Your history, logs and current plan are kept exactly as they are.</Card>
            )}
            <Button full onClick={() => void apply()} disabled={busy}>{busy ? 'Setting up…' : 'Set up Ironverse'} <ArrowRight size={18} /></Button>
          </StepBody>
        )}

        {step === 6 && (
          <StepBody title="Quick tour" sub="A 60-second walk through the real app: starting workouts, picking exercises, logging sets, calories, progress, records and settings.">
            <Card className="space-y-2 p-4 text-[13px] text-ink2">
              {['Start a workout', 'Find and choose exercises', 'Log sets, reps and weight', 'Track calories', 'See your progress', 'Personal records', 'Change settings'].map((t, i) => (
                <div key={t} className="flex items-center gap-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 text-[12px] font-bold text-brand">{i + 1}</span>{t}</div>
              ))}
            </Card>
            <Button full onClick={() => startTour('/welcome?step=7')}><Sparkles size={18} /> Show me around</Button>
            <Button full variant="ghost" onClick={() => go(7)}>Skip the tour</Button>
            <p className="text-center text-[12px] text-ink3">You can replay it any time from Settings.</p>
          </StepBody>
        )}

        {step === 7 && (
          <div className="flex min-h-[88svh] flex-col items-center justify-center pt-safe text-center">
            <div className="scale-in flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-amber-600 text-black shadow-lg shadow-brand/30"><Check size={40} strokeWidth={3} /></div>
            <h1 className="shout mt-5 text-[34px] leading-none text-ink">You’re set{d.name.trim() ? `, ${d.name.trim()}` : ''}</h1>
            <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-ink2">Everything is saved on this iPhone as you go. Back it up any time from More → Backup.</p>
            <Button full className="mt-8 max-w-[320px]" onClick={() => void done()}>Go to my dashboard <ArrowRight size={18} /></Button>
          </div>
        )}
      </div>
    </div>
  )
}

function fmtW(kg: number, imperial: boolean) { return imperial ? `${Math.round(kgToLb(kg))} lb` : `${round1(kg)} kg` }

function Welcome({ onStart, onRestore, prefilled }: { onStart: () => void; onRestore: () => void; prefilled: boolean }) {
  return (
    <div className="flex min-h-[94svh] flex-col items-center justify-center pt-safe text-center">
      <div className="relative">
        <div className="pulse-ring absolute inset-0 rounded-3xl bg-brand/40" />
        <img src="/icon-512.png" alt="Ironverse" className="scale-in relative h-24 w-24 rounded-3xl shadow-lg shadow-brand/30" />
      </div>
      <h1 className="shout mt-6 text-[40px] leading-none text-ink">Welcome to Ironverse</h1>
      <p className="mt-3 max-w-[300px] text-[14.5px] leading-relaxed text-ink2">
        Your training, food and progress in one place — planned for the equipment you actually have. Private by design: your data stays on this iPhone.
      </p>
      <div className="mt-7 w-full max-w-[320px] space-y-2 text-left">
        {[{ icon: Dumbbell, t: 'Workouts that adapt to what you log' }, { icon: Sparkles, t: 'Calorie, protein and water targets' }, { icon: ShieldCheck, t: 'No account, works offline' }].map(({ icon: I, t }, i) => (
          <div key={t} className="page-in flex items-center gap-3 rounded-xl bg-surface2 px-3.5 py-3 shadow-card" style={{ animationDelay: `${120 + i * 90}ms` }}>
            <I size={19} className="shrink-0 text-brand" /><span className="text-[13.5px] font-medium">{t}</span>
          </div>
        ))}
      </div>
      <Button full className="mt-8 max-w-[320px]" onClick={onStart}>{prefilled ? 'Continue setup' : 'Get started'} <ArrowRight size={18} /></Button>
      <button type="button" onClick={onRestore} className="pressable mt-3 flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-ink2">
        <Upload size={15} /> I already use Ironverse — restore a backup
      </button>
    </div>
  )
}

function StepBody({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="pb-1 pt-1">
        <h1 className="shout text-[26px] leading-none text-ink">{title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{sub}</p>
      </div>
      {children}
    </div>
  )
}

function Nav({ onNext, onSkip }: { onNext: () => void; onSkip?: () => void }) {
  return (
    <div className="space-y-1 pt-2">
      <Button full onClick={onNext}>Continue <ArrowRight size={18} /></Button>
      {onSkip && <Button full variant="ghost" onClick={onSkip}>Skip for now</Button>}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div><div className="text-[14px] font-medium text-ink">{label}</div>{hint && <div className="text-[11.5px] text-ink3">{hint}</div>}</div>
      {children}
    </div>
  )
}

function WeightField({ label, imperial, kg, onChange }: { label: string; imperial: boolean; kg?: number; onChange: (kg: number | undefined) => void }) {
  const [text, setText] = useState(kg ? String(imperial ? Math.round(kgToLb(kg)) : round1(kg)) : '')
  useEffect(() => { setText(kg ? String(imperial ? Math.round(kgToLb(kg)) : round1(kg)) : '') }, [imperial]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={`${label} (${imperial ? 'lb' : 'kg'})`}>
      <Input inputMode="decimal" value={text} placeholder={imperial ? 'e.g. 180' : 'e.g. 80'} onChange={(e) => {
        setText(e.target.value)
        const n = num(e.target.value)
        onChange(n === undefined ? undefined : imperial ? lbToKg(n) : n)
      }} />
    </Field>
  )
}

function LiftCard({ label, imperial, value, onChange: emit }: { label: string; imperial: boolean; value: { mode: LiftMode; oneRmKg?: number; weightKg?: number; reps?: number }; onChange: (v: { mode: LiftMode; oneRmKg?: number; weightKg?: number; reps?: number }) => void }) {
  const est = value.mode === 'estimate' ? estimateOneRm(value.weightKg, value.reps) : null
  const onChange = emit
  const unit = imperial ? 'lb' : 'kg'
  const toKg = (s: string) => { const n = num(s); return n === undefined ? undefined : imperial ? lbToKg(n) : n }
  const show = (kg?: number) => (kg ? String(imperial ? Math.round(kgToLb(kg)) : round1(kg)) : '')
  return (
    <Card className="space-y-2.5 p-3.5">
      <div className="text-[14.5px] font-semibold">{label}</div>
      <Segmented options={[{ value: 'known', label: 'I know my 1RM' }, { value: 'estimate', label: 'Estimate' }, { value: 'later', label: 'Later' }]} value={value.mode} onChange={(m) => onChange({ ...value, mode: m })} />
      {value.mode === 'known' && (
        <Field label={`One-rep max (${unit})`}><Input inputMode="decimal" defaultValue={show(value.oneRmKg)} onChange={(e) => onChange({ ...value, oneRmKg: toKg(e.target.value) })} /></Field>
      )}
      {value.mode === 'estimate' && (
        <>
          <div className="flex gap-2">
            <Field label={`Weight (${unit})`} className="flex-1"><Input inputMode="decimal" defaultValue={show(value.weightKg)} onChange={(e) => onChange({ ...value, weightKg: toKg(e.target.value) })} /></Field>
            <Field label="Reps" className="w-24"><Input inputMode="numeric" defaultValue={value.reps ?? ''} onChange={(e) => onChange({ ...value, reps: num(e.target.value) })} /></Field>
          </div>
          <div className="text-[12.5px] text-ink2">
            {est ? <>Estimated 1RM: <b className="text-ink">{fmtW(est, imperial)}</b> (approximate)</> : (value.reps ?? 0) > 12 ? 'Use a set of 12 reps or fewer for a useful estimate.' : 'Enter a recent set you did with good form.'}
          </div>
        </>
      )}
      {value.mode === 'later' && <div className="text-[12.5px] text-ink3">No problem — Ironverse estimates it from your logged sets.</div>}
    </Card>
  )
}
