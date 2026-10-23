// SETTINGS — grouped controls for profile, targets, schedule, equipment and data.
// Inline editors autosave; sheet editors save explicitly. Weight edits log a weigh-in.

import { DietCard } from './settings/DietCard'
import { halalMode, prayerConfig, ramadanConfig } from '@/db/defaults'
import { PrivacyCard } from './settings/PrivacyCard'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BellRing, Check, Database, Download, Dumbbell, Info, RotateCcw, Search,
  Sparkles, Trash2, Upload, Wrench, X,
  ShieldCheck,
} from 'lucide-react'
import {
  AnchorSection, Badge, Button, Card, ConfirmDialog, FOCUS_RING, Field, Input,
  ListGroup, ListRow, Modal, PageHeader, Section, Segmented, Sheet, Spinner,
  TextArea, scrollToSection,
} from '@/components/ui'
import { matchSettingsSections } from '@/lib/search'
import { db, getProfile, saveProfile } from '@/db'
import { exportBackup, restoreBackup, shareOrDownload } from '@/lib/backup'
import { pickFile } from '@/lib/files'
import { recommendedTargets } from '@/lib/nutrition'
import { useUI } from '@/lib/store'
import { todayStr } from '@/lib/id'
import { fmtKg } from '@/lib/fmt'
import type { Profile, ReminderConfig } from '@/db/types'
import {
  ACTIVITY_OPTIONS, APP_VERSION, EXPERIENCE_OPTIONS, GOAL_META, SEX_OPTIONS,
  SLOT_OPTIONS, fmt12, fmtLitres, parseNumber, parseStackSteps,
  recommendedWaterMl, stackStepsToText, upsertTodayWeighIn,
} from './settings/lib'
import { Stepper } from './settings/Stepper'
import { useTour } from '@/components/Tour'
import { isAppStoreEdition, isNativeApp, ed } from '@/lib/edition'
import { AiKeyCard } from './settings/AiKeyCard'
import { AdaptiveCaloriesCard } from './settings/AdaptiveCaloriesCard'
import { FoodPrefsCard } from './settings/FoodPrefsCard'
import { PrayerCard } from './settings/PrayerCard'
import { RamadanCard } from './settings/RamadanCard'
import { WorkScheduleEditor, scheduleValid } from './settings/WorkScheduleEditor'
import { AppHealthCard } from './settings/AppHealthCard'
import { DisplayCard } from './settings/DisplayCard'
import { FeedbackCard } from './settings/FeedbackCard'

type SheetKey = 'name' | 'body' | 'goal' | 'activity' | 'experience' | 'targets' | 'stack'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const [params] = useSearchParams()

  const profile = useLiveQuery(() => getProfile(), [])
  const reminders = useLiveQuery(() => db.reminders.get('reminders'), [])

  // ---------- settings filter (v4) ----------
  const [filter, setFilter] = useState('')
  const [highlight, setHighlight] = useState<string | null>(null)
  const jumpedFor = useRef<string | null>(null)

  const matches = useMemo(() => matchSettingsSections(filter), [filter])
  const show = (id: string) => matches === null || matches.has(id)
  const muslim = !!profile && (halalMode(profile) || ramadanConfig(profile).enabled || prayerConfig(profile).enabled)
  const matchList = useMemo(() => (matches ? [...matches] : []), [matches])

  function jumpTo(id: string) {
    scrollToSection(id)
    setHighlight(id)
    window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 2200)
  }

  // deep link: /settings?s=<section>
  useEffect(() => {
    const target = params.get('s')
    if (!target || !profile || jumpedFor.current === target) return
    jumpedFor.current = target
    const id = window.setTimeout(() => jumpTo(target), 140)
    return () => window.clearTimeout(id)
  }, [params, profile])

  // typing in the filter jumps to the best match once it narrows down
  useEffect(() => {
    if (matchList.length === 0 || matchList.length > 3 || !filter.trim()) return
    const id = window.setTimeout(() => jumpTo(matchList[0]), 260)
    return () => window.clearTimeout(id)
  }, [matchList, filter])

  const [sheet, setSheet] = useState<SheetKey | null>(null)
  const [exporting, setExporting] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [pendingReplace, setPendingReplace] = useState<File | null>(null)
  const [eraseStep, setEraseStep] = useState<0 | 1 | 2>(0)

  // throttled toast so inline autosave (toggles, steppers) doesn't spam
  const lastToast = useRef(0)
  async function quietSave(patch: Partial<Profile>, msg = 'Saved') {
    if (!profile) return
    await saveProfile({ ...profile, ...patch })
    const now = Date.now()
    if (now - lastToast.current > 1800) {
      lastToast.current = now
      toast(msg)
    }
  }

  // ---------- data actions ----------
  async function doExport() {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await exportBackup()
      await shareOrDownload(blob, `ironverse-backup-${todayStr()}.json`, 'Ironverse backup')
      toast('Backup exported')
    } catch {
      toast('Export failed — try again', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function doRestore(file: File, mode: 'merge' | 'replace') {
    setRestoring(true)
    try {
      await restoreBackup(file, mode)
      toast(mode === 'replace' ? 'Backup restored — everything replaced' : 'Backup merged in')
    } catch (e) {
      toast((e as Error).message || 'Restore failed', 'error')
    } finally {
      setRestoring(false)
    }
  }

  async function chooseRestore(mode: 'merge' | 'replace') {
    setRestoreOpen(false)
    const [file] = await pickFile('.json,application/json')
    if (!file) return
    if (mode === 'merge') await doRestore(file, 'merge')
    else setPendingReplace(file)
  }

  async function eraseEverything() {
    try {
      await db.delete()
      window.location.reload()
    } catch {
      toast('Could not erase data', 'error')
    }
  }

  // ---------- loading ----------
  if (profile === undefined) {
    return (
      <div>
        <PageHeader title="Settings" back="/more" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }
  if (!profile) {
    return (
      <div>
        <PageHeader title="Settings" back="/more" />
        <p className="px-4 text-[14px] text-ink2">No profile found — restart the app to re-seed.</p>
      </div>
    )
  }

  const yearNow = new Date().getFullYear()

  return (
    <div className="mx-auto max-w-lg pb-10">
      <PageHeader title="Settings" back="/more" subtitle="Everything about you, your week and your gear." />

      {/* ---------- filter (v4) ---------- */}
      <div className="px-4 pt-1">
        <div className="flex items-center gap-2 rounded-xl bg-surface3 px-3 py-2.5">
          <Search size={17} className="shrink-0 text-ink3" aria-hidden="true" />
          <input
            type="search"
            role="searchbox"
            aria-label="Filter settings"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3"
            placeholder="Filter settings — halal, stack, backup…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              aria-label="Clear settings filter"
              className={`pressable ${FOCUS_RING} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3`}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {matches !== null && (
          <p className="mt-1.5 px-1 text-[12px] text-ink3" role="status" aria-live="polite">
            {matches.size === 0
              ? 'No settings section matches that.'
              : `${matches.size} section${matches.size === 1 ? '' : 's'} match — everything else is hidden while filtering.`}
          </p>
        )}
      </div>

      {/* ---------- profile ---------- */}
      {show('profile') && (
      <AnchorSection id="profile" highlight={highlight === 'profile'}>
      <Section title="Profile">
        <ListGroup>
          <ListRow
            title="Name"
            right={<span className="text-[14px] text-ink2">{profile.name}</span>}
            onClick={() => setSheet('name')}
          />
          <ListRow
            title="Body stats"
            subtitle={`Born ${profile.birthYear} (${yearNow - profile.birthYear}) · ${profile.heightCm} cm · ${fmtKg(profile.weightKg)}`}
            onClick={() => setSheet('body')}
          />
          <ListRow
            title="Goal"
            right={<Badge tone={GOAL_META[profile.goal].tone}>{GOAL_META[profile.goal].label}</Badge>}
            onClick={() => setSheet('goal')}
          />
          <ListRow
            title="Activity level"
            right={<span className="text-[14px] text-ink2">{ACTIVITY_OPTIONS.find((o) => o.value === profile.activityLevel)?.label}</span>}
            onClick={() => setSheet('activity')}
          />
          <ListRow
            title="Experience"
            right={<span className="text-[14px] text-ink2">{EXPERIENCE_OPTIONS.find((o) => o.value === profile.experience)?.label}</span>}
            onClick={() => setSheet('experience')}
          />
        </ListGroup>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- targets ---------- */}
      {show('targets') && (
      <AnchorSection id="targets" highlight={highlight === 'targets'}>
      <Section title="Daily targets">
        <ListGroup>
          <ListRow title="Calories" right={<span className="big-num text-[15px] text-ink">{profile.calorieTarget.toLocaleString()} kcal</span>} onClick={() => setSheet('targets')} />
          <ListRow title="Protein" right={<span className="big-num text-[15px] text-ink">{profile.proteinTarget} g</span>} onClick={() => setSheet('targets')} />
          <ListRow title="Water" right={<span className="big-num text-[15px] text-ink">{fmtLitres(profile.waterTargetMl)}</span>} onClick={() => setSheet('targets')} />
          <ListRow
            title="Creatine"
            subtitle={reminders?.creatineEnabled ? `Reminder at ${fmt12(reminders.creatineTime)}` : 'Reminder off'}
            right={<span className="big-num text-[15px] text-ink">{profile.creatineGrams} g</span>}
            onClick={() => setSheet('targets')}
          />
        </ListGroup>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- training week ---------- */}
      {show('training-week') && (
      <AnchorSection id="training-week" highlight={highlight === 'training-week'}>
      <Section title="Training week">
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Days / week</div>
              <Stepper
                className="mt-2"
                value={profile.daysPerWeek}
                onChange={(v) => void quietSave({ daysPerWeek: v }, 'Training days saved')}
                min={2} max={6} label="training days per week"
              />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Session length</div>
              <Stepper
                className="mt-2"
                value={profile.sessionMinutes}
                onChange={(v) => void quietSave({ sessionMinutes: v }, 'Session length saved')}
                min={30} max={90} step={5} format={(v) => `${v}m`} label="session minutes"
              />
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">Preferred slot</div>
            <Segmented
              options={SLOT_OPTIONS}
              value={profile.preferredSlot}
              onChange={(v) => void quietSave({ preferredSlot: v }, 'Preferred slot saved')}
            />
          </div>
        </Card>
        <p className="mt-2 flex items-start gap-1.5 px-1 text-[12px] text-ink3">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            These shape new plans — rebuild from{' '}
            <button type="button" className="font-semibold text-brand" onClick={() => navigate('/plan')}>Plan settings</button>
            {' '}to apply them.
          </span>
        </p>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- work schedule ---------- */}
      {show('work-schedule') && (
      <AnchorSection id="work-schedule" highlight={highlight === 'work-schedule'}>
      <Section title="Work schedule">
        <WorkScheduleEditor
          value={profile.workSchedule}
          onChange={(ws) => void quietSave({ workSchedule: ws }, scheduleValid(ws) ? 'Schedule saved' : 'Saved — check the times')}
        />
        <p className="mt-2 px-1 text-[12px] text-ink3">
          Workout slots and the Today timeline are planned around these hours.
        </p>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- equipment ---------- */}
      {show('equipment') && (
      <AnchorSection id="equipment" highlight={highlight === 'equipment'}>
      <Section title="Equipment">
        <Card className="p-4">
          <div className="flex items-center gap-1.5">
            <Dumbbell size={15} className="text-brand" />
            <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Bar weights</span>
          </div>
          <div className="mt-3 space-y-3">
            {([
              ['Barbell', 'barbellKg', profile.barbellKg] as const,
              ['Curl bar', 'curlBarKg', profile.curlBarKg] as const,
              ['Smith bar', 'smithBarKg', profile.smithBarKg] as const,
            ]).map(([label, key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-20 shrink-0 text-[14px] font-medium text-ink">{label}</div>
                <Stepper
                  className="flex-1"
                  value={val}
                  onChange={(v) => void quietSave({ [key]: v } as Partial<Profile>, 'Bar weight saved')}
                  min={2.5} max={40} step={2.5} format={(v) => fmtKg(v)} label={`${label} weight`}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-line pt-3 text-[12px] text-ink3">
            Used for plate maths — every suggested load stays buildable.
          </p>
        </Card>

        <Card className="mt-3 p-4">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Plate pairs</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {profile.platePairsKg.map((p) => (
              <span key={p} className="inline-flex items-center rounded-full bg-surface3 px-3 py-1.5 text-[13px] font-semibold text-ink">
                2 × {p} kg
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] text-ink3">One pair of each — {fmtKg(profile.platePairsKg.reduce((s, p) => s + p * 2, 0))} of plates total.</p>
        </Card>

        <ListGroup className="mt-3">
          <ListRow
            title="Cable stack steps"
            subtitle={`${profile.stackStepsKg.length} steps · ${Math.min(...profile.stackStepsKg)}–${Math.max(...profile.stackStepsKg)} kg`}
            onClick={() => setSheet('stack')}
          />
        </ListGroup>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- food & energy ---------- */}
      {show('food-energy') && (
      <AnchorSection id="food-energy" highlight={highlight === 'food-energy'}>
        <Section title="Food & energy">
          <FoodPrefsCard profile={profile} onPatch={quietSave} />
          <div className="mt-3"><DietCard /></div>
        </Section>
      </AnchorSection>
      )}

      {show('calorie-target') && (
      <AnchorSection id="calorie-target" highlight={highlight === 'calorie-target'}>
        <Section title="Calorie target">
          <AdaptiveCaloriesCard profile={profile} onPatch={quietSave} />
        </Section>
      </AnchorSection>
      )}

      {/* v10.2: Muslim settings appear with Halal mode on (or if already in use) */}
      {show('ramadan') && muslim && (
      <AnchorSection id="ramadan" highlight={highlight === 'ramadan'}>
        <Section title="Ramadan">
          <RamadanCard profile={profile} onPatch={quietSave} />
        </Section>
      </AnchorSection>
      )}

      {show('prayer') && muslim && (
      <AnchorSection id="prayer" highlight={highlight === 'prayer'}>
        <Section title="Prayer times">
          <PrayerCard profile={profile} onPatch={quietSave} />
        </Section>
      </AnchorSection>
      )}

      {/* ---------- feedback (v4) ---------- */}
      {show('feedback') && (
      <AnchorSection id="feedback" highlight={highlight === 'feedback'}>
        <Section title="Haptics & sound">
          <FeedbackCard />
        </Section>
      </AnchorSection>
      )}

      {/* ---------- display (v4) ---------- */}
      {show('display') && (
      <AnchorSection id="display" highlight={highlight === 'display'}>
        <Section title="Display">
          <DisplayCard />
        </Section>
      </AnchorSection>
      )}

      {/* ---------- app health (v4) ---------- */}
      {show('health') && (
      <AnchorSection id="health" highlight={highlight === 'health'}>
        <Section title="App health & storage">
          <AppHealthCard />
        </Section>
      </AnchorSection>
      )}

      {show('ai') && (
      <AnchorSection id="ai" highlight={highlight === 'ai'}>
        <Section title="Photo calorie estimate">
          <AiKeyCard />
        </Section>
      </AnchorSection>
      )}

      {isNativeApp() && show('privacy') && (
      <AnchorSection id="privacy" highlight={highlight === 'privacy'}>
      <Section title="Privacy">
        <PrivacyCard />
      </Section>
      </AnchorSection>
      )}

      {show('reminders') && (
      <AnchorSection id="reminders" highlight={highlight === 'reminders'}>
      <Section title="Reminders">
        <ListGroup>
          <ListRow
            leading={<BellRing size={19} className="text-brand" />}
            title="Water, creatine & workout alerts"
            subtitle="Intervals, windows and times"
            onClick={() => navigate('/hydration')}
          />
        </ListGroup>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- data ---------- */}
      {show('data') && (
      <AnchorSection id="data" highlight={highlight === 'data'}>
      <Section title="Data">
        <ListGroup>
          <ListRow
            leading={<ShieldCheck size={19} className="text-emerald-400" />}
            title="Backup centre"
            subtitle="Encrypted backup, automatic snapshots and restore with a review first"
            onClick={() => navigate('/backup')}
          />
          <ListRow
            leading={<Download size={19} className="text-brand" />}
            title="Export backup"
            subtitle="Everything as one JSON file"
            right={exporting ? <Spinner className="h-5 w-5" /> : undefined}
            chevron={false}
            onClick={() => void doExport()}
          />
          <ListRow
            leading={<Upload size={19} className="text-sky-400" />}
            title="Restore backup"
            subtitle="Opens the Backup centre — see what is in the file, then merge or replace"
            right={restoring ? <Spinner className="h-5 w-5" /> : undefined}
            onClick={() => navigate('/backup')}
          />
          <ListRow
            leading={<Trash2 size={19} className="text-red-500" />}
            title={<span className="text-red-500">Erase all data</span>}
            subtitle="Deletes every log, plan and setting"
            chevron={false}
            onClick={() => setEraseStep(1)}
          />
        </ListGroup>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- about ---------- */}
      {show('about') && (
      <AnchorSection id="about" highlight={highlight === 'about'}>
      <Section title="About">
        <ListGroup>
          <ListRow
            leading={<Wrench size={19} className="text-ink2" />}
            title="Run setup again"
            subtitle="Re-answer the onboarding questions"
            onClick={() => navigate('/onboarding')}
          />
          <ListRow
            leading={<Sparkles size={19} className="text-brand" />}
            title="Suggest & report"
            subtitle="Ideas, bugs, fixes and additions — sent to the developer"
            onClick={() => navigate('/feedback')}
          />
          {isAppStoreEdition() && (
            <ListRow
              leading={<Sparkles size={19} className="text-brand" />}
              title="Ironverse Pro"
              subtitle="Your plan, restore purchases, manage subscription"
              onClick={() => navigate('/pro')}
            />
          )}
          <div data-tour="replay-tour">
            <ListRow
              leading={<Sparkles size={19} className="text-brand" />}
              title="Replay the app tour"
              subtitle="Where to start workouts, log sets, track calories and more"
              onClick={() => useTour.getState().start('/settings')}
            />
          </div>
          {isAppStoreEdition() && (
            <ListRow
              leading={<Wrench size={19} className="text-ink2" />}
              title="First-time setup"
              subtitle="Goals, strength check and training preferences — your data is kept"
              onClick={() => navigate('/welcome?step=1')}
            />
          )}
          <ListRow
            leading={<Database size={19} className="text-ink2" />}
            title="Ironverse"
            subtitle={ed("Built for your garage — works fully offline", "Built for your equipment — works fully offline")}
            right={<span className="text-[13px] text-ink3">v{APP_VERSION}</span>}
            chevron={false}
          />
        </ListGroup>
      </Section>
      </AnchorSection>
      )}

      {/* ---------- sheets ---------- */}
      <Sheet open={sheet === 'name'} onClose={() => setSheet(null)} title="Name & sex">
        {sheet === 'name' && <NameSheet profile={profile} onClose={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'body'} onClose={() => setSheet(null)} title="Body stats">
        {sheet === 'body' && <BodySheet profile={profile} onClose={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'goal'} onClose={() => setSheet(null)} title="Goal">
        {sheet === 'goal' && <PickSheet
          options={(Object.keys(GOAL_META) as Profile['goal'][]).map((g) => ({ value: g, label: GOAL_META[g].label, desc: GOAL_META[g].desc }))}
          value={profile.goal}
          onPick={async (goal) => { await saveProfile({ ...profile, goal }); toast('Goal saved') }}
          onClose={() => setSheet(null)}
        />}
      </Sheet>
      <Sheet open={sheet === 'activity'} onClose={() => setSheet(null)} title="Activity level">
        {sheet === 'activity' && <PickSheet
          options={ACTIVITY_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
          value={profile.activityLevel}
          onPick={async (activityLevel) => { await saveProfile({ ...profile, activityLevel }); toast('Activity level saved') }}
          onClose={() => setSheet(null)}
        />}
      </Sheet>
      <Sheet open={sheet === 'experience'} onClose={() => setSheet(null)} title="Experience">
        {sheet === 'experience' && <PickSheet
          options={EXPERIENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={profile.experience}
          onPick={async (experience) => { await saveProfile({ ...profile, experience }); toast('Experience saved') }}
          onClose={() => setSheet(null)}
        />}
      </Sheet>
      <Sheet open={sheet === 'targets'} onClose={() => setSheet(null)} title="Daily targets">
        {sheet === 'targets' && <TargetsSheet profile={profile} reminders={reminders} onClose={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'stack'} onClose={() => setSheet(null)} title="Cable stack steps">
        {sheet === 'stack' && <StackSheet profile={profile} onClose={() => setSheet(null)} />}
      </Sheet>

      {/* ---------- restore modal ---------- */}
      <Modal open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Restore backup">
        <p className="mb-4 text-[13.5px] leading-relaxed text-ink2">
          Pick an <span className="font-semibold text-ink">ironverse-backup-….json</span> file.
          Merge keeps current data and adds the backup on top; replace wipes everything first.
        </p>
        <div className="space-y-2">
          <Button full variant="secondary" onClick={() => void chooseRestore('merge')}>Merge with current data</Button>
          <Button full variant="danger" onClick={() => void chooseRestore('replace')}>Replace everything</Button>
          <Button full variant="ghost" onClick={() => setRestoreOpen(false)}>Cancel</Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={pendingReplace !== null}
        onClose={() => setPendingReplace(null)}
        onConfirm={() => { if (pendingReplace) void doRestore(pendingReplace, 'replace') }}
        title="Replace all data?"
        message={`Everything currently in Ironverse will be deleted and replaced with "${pendingReplace?.name ?? ''}". This can’t be undone.`}
        confirmLabel="Replace"
      />

      {/* ---------- erase double-confirm ---------- */}
      <ConfirmDialog
        open={eraseStep === 1}
        onClose={() => setEraseStep((s) => (s === 2 ? s : 0))}
        onConfirm={() => setEraseStep(2)}
        title="Erase all data?"
        message="Profile, plans, workout history, food logs, weigh-ins — everything. Export a backup first if in doubt."
        confirmLabel="Continue"
      />
      <ConfirmDialog
        open={eraseStep === 2}
        onClose={() => setEraseStep(0)}
        onConfirm={() => void eraseEverything()}
        title="Last chance"
        message="This permanently deletes the entire local database and restarts the app."
        confirmLabel="Erase everything"
      />
    </div>
  )
}

// ============================================================
// Sheet bodies (mounted only while open, so state resets cleanly)
// ============================================================

function NameSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { toast } = useUI()
  const [name, setName] = useState(profile.name)
  const [sex, setSex] = useState<Profile['sex']>(profile.sex)
  const valid = name.trim().length > 0
  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="off" />
      </Field>
      <Field label="Sex" hint="Used for the calorie formula only.">
        <Segmented options={SEX_OPTIONS} value={sex} onChange={setSex} />
      </Field>
      <Button
        full disabled={!valid}
        onClick={async () => {
          await saveProfile({ ...profile, name: name.trim(), sex })
          toast('Profile saved')
          onClose()
        }}
      >
        Save
      </Button>
    </div>
  )
}

function BodySheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { toast } = useUI()
  const [birthYear, setBirthYear] = useState(String(profile.birthYear))
  const [heightCm, setHeightCm] = useState(String(profile.heightCm))
  const [weightKg, setWeightKg] = useState(String(profile.weightKg))
  const yearNow = new Date().getFullYear()
  const by = parseNumber(birthYear)
  const h = parseNumber(heightCm)
  const w = parseNumber(weightKg)
  const valid =
    Number.isFinite(by) && by >= 1920 && by <= yearNow - 13 &&
    Number.isFinite(h) && h >= 120 && h <= 230 &&
    Number.isFinite(w) && w >= 40 && w <= 250
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Birth year">
          <Input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
        </Field>
        <Field label="Height (cm)">
          <Input inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </Field>
      </div>
      <Field label="Weight (kg)" hint="A change here is logged as today’s weigh-in.">
        <Input inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
      </Field>
      {!valid && (
        <p className="text-[12px] text-ink3">Birth year 1920–{yearNow - 13} · height 120–230 cm · weight 40–250 kg.</p>
      )}
      <Button
        full disabled={!valid}
        onClick={async () => {
          const newWeight = Math.round(w * 10) / 10
          const weightChanged = Math.abs(newWeight - profile.weightKg) > 0.01
          await saveProfile({ ...profile, birthYear: Math.round(by), heightCm: Math.round(h), weightKg: newWeight })
          if (weightChanged) await upsertTodayWeighIn(newWeight)
          toast(weightChanged ? 'Saved — weight logged for today' : 'Body stats saved')
          onClose()
        }}
      >
        Save
      </Button>
    </div>
  )
}

function PickSheet<T extends string>({ options, value, onPick, onClose }: {
  options: { value: T; label: string; desc?: string }[]
  value: T
  onPick: (v: T) => Promise<void>
  onClose: () => void
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={async () => { await onPick(o.value); onClose() }}
            className={`pressable flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left ${
              active ? 'border-brand bg-brand/10' : 'border-transparent bg-surface3'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold text-ink">{o.label}</div>
              {o.desc && <div className="mt-0.5 text-[12px] text-ink2">{o.desc}</div>}
            </div>
            {active && <Check size={18} className="shrink-0 text-brand" strokeWidth={2.6} />}
          </button>
        )
      })}
    </div>
  )
}

function TargetsSheet({ profile, reminders, onClose }: {
  profile: Profile
  reminders: ReminderConfig | undefined
  onClose: () => void
}) {
  const { toast } = useUI()
  const [kcal, setKcal] = useState(String(profile.calorieTarget))
  const [protein, setProtein] = useState(String(profile.proteinTarget))
  const [waterMl, setWaterMl] = useState(profile.waterTargetMl)
  const [creatine, setCreatine] = useState(profile.creatineGrams)
  const [creatineTime, setCreatineTime] = useState(reminders?.creatineTime ?? '08:30')

  const k = parseNumber(kcal)
  const p = parseNumber(protein)
  const valid =
    Number.isFinite(k) && k >= 1200 && k <= 6000 &&
    Number.isFinite(p) && p >= 60 && p <= 400

  const rec = recommendedTargets(profile)
  const recWater = recommendedWaterMl(profile.weightKg)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { setKcal(String(rec.calories)); setProtein(String(rec.protein)); setWaterMl(recWater) }}
        className="pressable flex w-full items-center gap-2.5 rounded-xl bg-brand/10 px-3.5 py-3 text-left"
      >
        <Sparkles size={17} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">Reset to recommended</div>
          <div className="text-[12px] text-ink2">
            {rec.calories.toLocaleString()} kcal · {rec.protein}g protein · {fmtLitres(recWater)} water
          </div>
        </div>
        <RotateCcw size={16} className="shrink-0 text-brand" />
      </button>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories (kcal)">
          <Input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </Field>
        <Field label="Protein (g)">
          <Input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </Field>
      </div>
      {!valid && <p className="text-[12px] text-ink3">Calories 1,200–6,000 · protein 60–400g.</p>}

      <Field label="Water target">
        <Stepper value={waterMl} onChange={setWaterMl} min={1500} max={6000} step={250} format={fmtLitres} label="daily water" />
      </Field>

      <Field label="Creatine" hint="Grams per day, plus the daily reminder time.">
        <div className="flex items-center gap-3">
          <Stepper className="flex-1" value={creatine} onChange={setCreatine} min={0} max={10} format={(v) => `${v}g`} label="creatine grams" />
          <input
            type="time"
            aria-label="Creatine reminder time"
            value={creatineTime}
            onChange={(e) => e.target.value && setCreatineTime(e.target.value)}
            className="rounded-lg border border-transparent bg-surface3 px-2.5 py-2 text-[14px] font-medium text-ink outline-none focus:border-brand"
          />
        </div>
      </Field>

      <Button
        full disabled={!valid}
        onClick={async () => {
          await saveProfile({
            ...profile,
            calorieTarget: Math.round(k),
            proteinTarget: Math.round(p),
            waterTargetMl: waterMl,
            creatineGrams: creatine,
          })
          if (reminders && reminders.creatineTime !== creatineTime) {
            await db.reminders.put({ ...reminders, creatineTime, updatedAt: new Date().toISOString() })
          }
          toast('Targets saved')
          onClose()
        }}
      >
        Save targets
      </Button>
    </div>
  )
}

function StackSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { toast } = useUI()
  const [text, setText] = useState(stackStepsToText(profile.stackStepsKg))
  const parsed = parseStackSteps(text)
  return (
    <div className="space-y-4">
      <Field
        label="Selectable weights (kg, comma separated)"
        hint="The exact stack pin positions on your cable machine — suggestions only ever land on these."
      >
        <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={3} inputMode="decimal" />
      </Field>
      {parsed.ok ? (
        <p className="text-[12.5px] text-ink2">
          <span className="font-semibold text-emerald-500">{parsed.steps.length} steps</span>
          {' · '}{parsed.steps[0]}–{parsed.steps[parsed.steps.length - 1]} kg
        </p>
      ) : (
        <p className="text-[12.5px] font-medium text-red-400">{parsed.error}</p>
      )}
      <Button
        full disabled={!parsed.ok}
        onClick={async () => {
          if (!parsed.ok) return
          await saveProfile({ ...profile, stackStepsKg: parsed.steps })
          toast('Stack steps saved')
          onClose()
        }}
      >
        Save
      </Button>
    </div>
  )
}
