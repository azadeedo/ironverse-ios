// ONBOARDING — friendly 4-step wizard. Prefilled from the seeded profile,
// safe to re-run any time (Settings → Run setup again). Finishing saves the
// profile, records today's weight and builds a fresh training plan.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, CalendarClock, Droplets, Dumbbell, Flame,
  Pill, RefreshCcw, Sparkles, Target, X,
} from 'lucide-react'
import { Button, Card, Field, Input, Segmented, Spinner } from '@/components/ui'
import { db, getProfile, saveProfile } from '@/db'
import { generatePlan } from '@/lib/plangen'
import { projectedKgPerWeek, recommendedTargets, tdeeFormula } from '@/lib/nutrition'
import { useUI } from '@/lib/store'
import type { Profile, WorkDay } from '@/db/types'
import {
  ACTIVITY_OPTIONS, EXPERIENCE_OPTIONS, GOAL_META, SEX_OPTIONS, SLOT_OPTIONS,
  fmtLitres, parseNumber, recommendedWaterMl, upsertTodayWeighIn,
} from './settings/lib'
import { Stepper } from './settings/Stepper'
import { WorkScheduleEditor, scheduleValid } from './settings/WorkScheduleEditor'

const STEP_TITLES = ['About you', 'Your goal', 'Your week', 'Your targets']
const STEP_SUBTITLES = [
  'The basics behind every calculation.',
  'What are we chasing right now?',
  'Training fits around work — not the other way round.',
  'Daily numbers to hit. Tweak anything.',
]

const GOAL_ICONS: Record<Profile['goal'], typeof Flame> = {
  'lose-fat': Flame,
  'build-muscle': Dumbbell,
  recomp: RefreshCcw,
}

interface Draft {
  name: string
  sex: Profile['sex']
  birthYear: string
  heightCm: string
  weightKg: string
  goal: Profile['goal']
  activityLevel: Profile['activityLevel']
  experience: Profile['experience']
  daysPerWeek: number
  sessionMinutes: number
  workSchedule: WorkDay[]
  preferredSlot: Profile['preferredSlot']
  calorieTarget: string
  proteinTarget: string
  waterTargetMl: number
  creatineGrams: number
  creatineTime: string
}

export default function OnboardingScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()

  const [base, setBase] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const targetsTouched = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      const p = await getProfile()
      if (!p) return
      const rem = await db.reminders.get('reminders')
      // re-running setup: keep the user's saved targets untouched unless they reset
      targetsTouched.current = p.onboarded
      setBase(p)
      setDraft({
        name: p.name,
        sex: p.sex,
        birthYear: String(p.birthYear),
        heightCm: String(p.heightCm),
        weightKg: String(p.weightKg),
        goal: p.goal,
        activityLevel: p.activityLevel,
        experience: p.experience,
        daysPerWeek: p.daysPerWeek,
        sessionMinutes: p.sessionMinutes,
        workSchedule: p.workSchedule.map((wd) => ({ ...wd })),
        preferredSlot: p.preferredSlot,
        calorieTarget: String(p.calorieTarget),
        proteinTarget: String(p.proteinTarget),
        waterTargetMl: p.waterTargetMl,
        creatineGrams: p.creatineGrams,
        creatineTime: rem?.creatineTime ?? '08:30',
      })
    })()
  }, [])

  // ---------- draft helpers ----------
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d))

  const yearNow = new Date().getFullYear()
  const nums = useMemo(() => {
    if (!draft) return null
    return {
      birthYear: parseNumber(draft.birthYear),
      heightCm: parseNumber(draft.heightCm),
      weightKg: parseNumber(draft.weightKg),
      calorieTarget: parseNumber(draft.calorieTarget),
      proteinTarget: parseNumber(draft.proteinTarget),
    }
  }, [draft])

  /** profile as it would be saved right now (for live target maths) */
  const draftProfile: Profile | null = useMemo(() => {
    if (!base || !draft || !nums) return null
    return {
      ...base,
      name: draft.name.trim() || base.name,
      sex: draft.sex,
      birthYear: Number.isFinite(nums.birthYear) ? nums.birthYear : base.birthYear,
      heightCm: Number.isFinite(nums.heightCm) ? nums.heightCm : base.heightCm,
      weightKg: Number.isFinite(nums.weightKg) ? nums.weightKg : base.weightKg,
      goal: draft.goal,
      activityLevel: draft.activityLevel,
      experience: draft.experience,
      daysPerWeek: draft.daysPerWeek,
      sessionMinutes: draft.sessionMinutes,
      workSchedule: draft.workSchedule,
      preferredSlot: draft.preferredSlot,
    }
  }, [base, draft, nums])

  const recommended = useMemo(() => {
    if (!draftProfile) return null
    const t = recommendedTargets(draftProfile)
    return { ...t, water: recommendedWaterMl(draftProfile.weightKg), tdee: tdeeFormula(draftProfile) }
  }, [draftProfile])

  // ---------- validation per step ----------
  const stepValid = useMemo(() => {
    if (!draft || !nums) return false
    if (step === 0) {
      return (
        draft.name.trim().length > 0 &&
        Number.isFinite(nums.birthYear) && nums.birthYear >= 1920 && nums.birthYear <= yearNow - 13 &&
        Number.isFinite(nums.heightCm) && nums.heightCm >= 120 && nums.heightCm <= 230 &&
        Number.isFinite(nums.weightKg) && nums.weightKg >= 40 && nums.weightKg <= 250
      )
    }
    if (step === 2) return scheduleValid(draft.workSchedule)
    if (step === 3) {
      return (
        Number.isFinite(nums.calorieTarget) && nums.calorieTarget >= 1200 && nums.calorieTarget <= 6000 &&
        Number.isFinite(nums.proteinTarget) && nums.proteinTarget >= 60 && nums.proteinTarget <= 400
      )
    }
    return true
  }, [draft, nums, step, yearNow])

  // ---------- navigation ----------
  function goNext() {
    if (!draft || !recommended) return
    if (step === 2 && !targetsTouched.current) {
      // entering Targets: prefill with fresh recommendations for the drafted body + goal
      patch({
        calorieTarget: String(recommended.calories),
        proteinTarget: String(recommended.protein),
        waterTargetMl: recommended.water,
      })
    }
    setStep((s) => Math.min(3, s + 1))
    scrollRef.current?.scrollTo({ top: 0 })
  }

  function goBack() {
    if (step === 0) {
      if (base?.onboarded) navigate(-1)
      return
    }
    setStep((s) => s - 1)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  // ---------- finish ----------
  async function finish() {
    if (!base || !draft || !nums || !stepValid || busy) return
    setBusy(true)
    try {
      const updated: Profile = {
        ...base,
        name: draft.name.trim(),
        sex: draft.sex,
        birthYear: Math.round(nums.birthYear),
        heightCm: Math.round(nums.heightCm),
        weightKg: Math.round(nums.weightKg * 10) / 10,
        goal: draft.goal,
        activityLevel: draft.activityLevel,
        experience: draft.experience,
        daysPerWeek: draft.daysPerWeek,
        sessionMinutes: draft.sessionMinutes,
        workSchedule: draft.workSchedule,
        preferredSlot: draft.preferredSlot,
        calorieTarget: Math.round(nums.calorieTarget),
        proteinTarget: Math.round(nums.proteinTarget),
        waterTargetMl: draft.waterTargetMl,
        creatineGrams: draft.creatineGrams,
        onboarded: true,
      }
      await saveProfile(updated)
      await upsertTodayWeighIn(updated.weightKg)

      const ts = new Date().toISOString()
      const rem = await db.reminders.get('reminders')
      await db.reminders.put(
        rem
          ? { ...rem, creatineTime: draft.creatineTime, updatedAt: ts }
          : {
              id: 'reminders', waterEnabled: true, waterIntervalMin: 90,
              waterWindow: ['07:00', '21:30'], creatineEnabled: true,
              creatineTime: draft.creatineTime, workoutEnabled: true,
              workoutLeadMin: 30, updatedAt: ts,
            },
      )

      // the owner's 12-week program is never replaced by a profile save: if it
      // is active, the generated plan is stored switched OFF beside it
      const fresh = generatePlan(updated)
      await db.transaction('rw', db.plans, async () => {
        const programActive = (await db.plans.toArray()).some((p) => p.program === 'p12' && p.active)
        if (programActive) await db.plans.add({ ...fresh, active: false })
        else {
          await db.plans.toCollection().modify((p) => { p.active = false })
          await db.plans.add(fresh)
        }
      })

      toast(base.onboarded ? 'Profile updated — new plan ready' : 'You’re set — plan ready. Let’s work.')
      navigate('/')
    } catch {
      toast('Could not finish setup — try again', 'error')
      setBusy(false)
    }
  }

  // ---------- loading ----------
  if (!draft || !base || !recommended) {
    return (
      <div className="flex h-[80svh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const projected = Number.isFinite(nums?.calorieTarget ?? NaN)
    ? projectedKgPerWeek(nums!.calorieTarget, recommended.tdee)
    : null

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-lg flex-col">
      {/* ---------- header: back + progress dots ---------- */}
      <header className="sticky top-0 z-30 bg-surface/90 pt-safe backdrop-blur-xl">
        <div className="flex h-[52px] items-center px-4">
          <div className="w-16">
            {(step > 0 || base.onboarded) && (
              <button
                type="button"
                onClick={goBack}
                aria-label={step === 0 ? 'Close setup' : 'Previous step'}
                className="pressable -ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink2"
              >
                {step === 0 ? <X size={22} /> : <ArrowLeft size={22} />}
              </button>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center gap-2">
            {STEP_TITLES.map((t, i) => (
              <div
                key={t}
                aria-label={`Step ${i + 1}: ${t}${i === step ? ' (current)' : ''}`}
                className={`rounded-full transition-all duration-300 ${
                  i === step ? 'h-2.5 w-7 bg-brand' : i < step ? 'h-2.5 w-2.5 bg-brand/60' : 'h-2.5 w-2.5 bg-surface3'
                }`}
              />
            ))}
          </div>
          <div className="w-16 text-right text-[12px] font-semibold text-ink3">{step + 1} / 4</div>
        </div>
        <div className="px-5 pb-3">
          <h1 className="shout text-[26px] leading-none text-ink">{STEP_TITLES[step]}</h1>
          <p className="mt-1.5 text-[13px] text-ink2">{STEP_SUBTITLES[step]}</p>
        </div>
      </header>

      {/* ---------- step body ---------- */}
      <div ref={scrollRef} className="flex-1 px-4 pb-8 pt-2">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Your name"
                autoComplete="off"
              />
            </Field>
            <Field label="Sex" hint="Used for the calorie formula only.">
              <Segmented options={SEX_OPTIONS} value={draft.sex} onChange={(v) => patch({ sex: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Birth year">
                <Input
                  inputMode="numeric"
                  value={draft.birthYear}
                  onChange={(e) => patch({ birthYear: e.target.value })}
                  placeholder="1995"
                />
              </Field>
              <Field label="Height (cm)">
                <Input
                  inputMode="decimal"
                  value={draft.heightCm}
                  onChange={(e) => patch({ heightCm: e.target.value })}
                  placeholder="180"
                />
              </Field>
            </div>
            <Field label="Current weight (kg)" hint="Logged as today’s weigh-in when you finish.">
              <Input
                inputMode="decimal"
                value={draft.weightKg}
                onChange={(e) => patch({ weightKg: e.target.value })}
                placeholder="98.3"
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              {(Object.keys(GOAL_META) as Profile['goal'][]).map((g) => {
                const meta = GOAL_META[g]
                const Icon = GOAL_ICONS[g]
                const active = draft.goal === g
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => patch({ goal: g })}
                    className={`pressable flex w-full items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-colors ${
                      active ? 'border-brand bg-brand/10' : 'border-transparent bg-surface2 shadow-card'
                    }`}
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15.5px] font-bold text-ink">{meta.label}</div>
                      <div className="mt-0.5 text-[12.5px] text-ink2">{meta.desc}</div>
                    </div>
                    {active && <Check size={20} className="shrink-0 text-brand" strokeWidth={2.6} />}
                  </button>
                )
              })}
            </div>

            <Field label="Daily activity (outside the gym)">
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((o) => {
                  const active = draft.activityLevel === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => patch({ activityLevel: o.value })}
                      className={`pressable flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left ${
                        active ? 'border-brand bg-brand/10' : 'border-transparent bg-surface2 shadow-card'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-ink">{o.label}</div>
                        <div className="text-[12px] text-ink2">{o.desc}</div>
                      </div>
                      {active && <Check size={18} className="shrink-0 text-brand" strokeWidth={2.6} />}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Lifting experience">
              <Segmented options={EXPERIENCE_OPTIONS} value={draft.experience} onChange={(v) => patch({ experience: v })} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3.5">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Days / week</div>
                <Stepper
                  className="mt-2"
                  value={draft.daysPerWeek}
                  onChange={(v) => patch({ daysPerWeek: v })}
                  min={2}
                  max={6}
                  label="training days per week"
                />
              </Card>
              <Card className="p-3.5">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Session length</div>
                <Stepper
                  className="mt-2"
                  value={draft.sessionMinutes}
                  onChange={(v) => patch({ sessionMinutes: v })}
                  min={30}
                  max={90}
                  step={5}
                  format={(v) => `${v}m`}
                  label="session minutes"
                />
              </Card>
            </div>

            <Field label="Work schedule" hint="Workouts get planned around these hours.">
              <WorkScheduleEditor value={draft.workSchedule} onChange={(ws) => patch({ workSchedule: ws })} />
            </Field>

            <Field label="Preferred training slot">
              <Segmented options={SLOT_OPTIONS} value={draft.preferredSlot} onChange={(v) => patch({ preferredSlot: v })} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-brand" />
                <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Recommended for you</span>
              </div>
              <div className="mt-2.5 flex items-end gap-4">
                <div>
                  <div className="big-num text-[26px] text-ink">{recommended.calories.toLocaleString()}</div>
                  <div className="text-[11.5px] text-ink3">kcal / day</div>
                </div>
                <div>
                  <div className="big-num text-[26px] text-ink">{recommended.protein}g</div>
                  <div className="text-[11.5px] text-ink3">protein</div>
                </div>
                <div className="flex-1" />
                <Button
                  small
                  variant="secondary"
                  onClick={() => {
                    targetsTouched.current = false
                    patch({
                      calorieTarget: String(recommended.calories),
                      proteinTarget: String(recommended.protein),
                      waterTargetMl: recommended.water,
                    })
                  }}
                >
                  Use these
                </Button>
              </div>
              <p className="mt-2.5 border-t border-line pt-2.5 text-[12px] leading-relaxed text-ink2">
                Based on your stats and the {GOAL_META[draft.goal].label.toLowerCase()} goal
                (estimated burn ≈ {recommended.tdee.toLocaleString()} kcal/day).
                {projected !== null && Number.isFinite(projected) && (
                  <> At your calorie target that’s roughly <span className="font-semibold text-ink">
                    {Math.abs(projected).toFixed(2)} kg/week {projected <= 0 ? 'down' : 'up'}</span>.</>
                )}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories (kcal)">
                <Input
                  inputMode="numeric"
                  value={draft.calorieTarget}
                  onChange={(e) => { targetsTouched.current = true; patch({ calorieTarget: e.target.value }) }}
                />
              </Field>
              <Field label="Protein (g)">
                <Input
                  inputMode="numeric"
                  value={draft.proteinTarget}
                  onChange={(e) => { targetsTouched.current = true; patch({ proteinTarget: e.target.value }) }}
                />
              </Field>
            </div>

            <Card className="p-3.5">
              <div className="flex items-center gap-1.5">
                <Droplets size={15} className="text-sky-400" />
                <span className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Water target</span>
              </div>
              <Stepper
                className="mt-2"
                value={draft.waterTargetMl}
                onChange={(v) => { targetsTouched.current = true; patch({ waterTargetMl: v }) }}
                min={1500}
                max={6000}
                step={250}
                format={fmtLitres}
                label="daily water"
              />
            </Card>

            <Card className="p-3.5">
              <div className="flex items-center gap-1.5">
                <Pill size={15} className="text-emerald-400" />
                <span className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Creatine</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Stepper
                  className="flex-1"
                  value={draft.creatineGrams}
                  onChange={(v) => patch({ creatineGrams: v })}
                  min={0}
                  max={10}
                  format={(v) => `${v}g`}
                  label="creatine grams"
                />
                <input
                  type="time"
                  aria-label="Creatine reminder time"
                  value={draft.creatineTime}
                  onChange={(e) => e.target.value && patch({ creatineTime: e.target.value })}
                  className="rounded-lg border border-transparent bg-surface3 px-2.5 py-2 text-[14px] font-medium text-ink outline-none focus:border-brand"
                />
              </div>
              {draft.creatineGrams === 0 && (
                <p className="mt-2 text-[12px] text-ink3">Set to 0 if you’re not taking creatine right now.</p>
              )}
            </Card>

            {base.onboarded && (
              <div className="flex items-start gap-2 rounded-xl bg-surface2 px-3.5 py-3 shadow-card">
                <CalendarClock size={16} className="mt-0.5 shrink-0 text-brand" />
                <p className="text-[12.5px] leading-relaxed text-ink2">
                  Finishing rebuilds your training plan with these settings. Workout history stays untouched.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- footer ---------- */}
      <footer className="sticky bottom-0 z-30 border-t border-line bg-surface/90 px-4 pt-3 backdrop-blur-xl" style={{ paddingBottom: 'calc(var(--sab) + 12px)' }}>
        {step < 3 ? (
          <Button full disabled={!stepValid} onClick={goNext}>
            Continue <ArrowRight size={18} />
          </Button>
        ) : (
          <Button full disabled={!stepValid || busy} onClick={() => void finish()}>
            {busy ? <Spinner className="h-5 w-5 border-white/40 border-t-white" /> : (
              <>
                <Target size={18} /> {base.onboarded ? 'Save & rebuild plan' : 'Build my plan'}
              </>
            )}
          </Button>
        )}
        {!stepValid && step === 0 && (
          <p className="mt-2 text-center text-[12px] text-ink3">Fill in your name, birth year, height and weight.</p>
        )}
        {!stepValid && step === 2 && (
          <p className="mt-2 text-center text-[12px] text-ink3">Fix the highlighted work hours to continue.</p>
        )}
        {!stepValid && step === 3 && (
          <p className="mt-2 text-center text-[12px] text-ink3">Calories 1,200–6,000 · protein 60–400g.</p>
        )}
      </footer>
    </div>
  )
}
