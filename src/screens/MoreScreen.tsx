// MORE — launcher hub: profile card, feature tiles, today's mini timeline,
// one-tap backup. Everything mirrors the Today screen's visual language.

import { AppVersionCard } from '@/components/UpdatePrompt'
import { AthleteCard } from './more/AthleteCard'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Award, BellRing, BookOpen, Briefcase, CalendarCheck, CalendarRange, Camera,
  ChevronRight, ClipboardList, DatabaseBackup, Droplets, Dumbbell, Gauge,
  HeartPulse, Home, Layers, Lightbulb, Pill, Plus, Scale, Search, Settings,
  TrendingUp, Utensils, WifiOff, Watch, Flame, Trophy,
} from 'lucide-react'
import {
  Badge, Button, Card, FOCUS_RING, Field, Input, PageHeader, QuickAction,
  Section, Sheet, Spinner, TAP_TARGET, feedback,
} from '@/components/ui'
import { db, getActivePlan, getProfile, getSetting, saveProfile, setSetting } from '@/db'
import { daysSinceExport, EXPORT_NAG_DAYS, exportBackup, shareOrDownload } from '@/lib/backup'
import { fmtKg } from '@/lib/fmt'
import { todayStr } from '@/lib/id'
import { loadWeeklyInsight, type WeeklyInsight } from '@/lib/insights'
import { dayForDate } from '@/lib/plangen'
import { minutesOf, todayTimeline, type TimelineItem } from '@/lib/schedule'
import { useUI } from '@/lib/store'
import { APP_VERSION, GOAL_META, fmt12, nowMinutes, parseNumber, upsertTodayWeighIn } from './settings/lib'

const TIMELINE_ICONS: Record<TimelineItem['kind'], typeof Droplets> = {
  water: Droplets,
  creatine: Pill,
  workout: Dumbbell,
  'work-start': Briefcase,
  'work-end': Home,
}

const TIMELINE_TONES: Record<TimelineItem['kind'], string> = {
  water: 'text-sky-400',
  creatine: 'text-emerald-400',
  workout: 'text-brand',
  'work-start': 'text-ink2',
  'work-end': 'text-ink2',
}

/** which group each shortcut lives in on More */
const TILE_GROUPS: [string, string[]][] = [
  ['Training', ['/plan', '/exercises', '/programs', '/review', '/cardio']],
  ['Body & progress', ['/progress', '/hub', '/photos', '/anatomy', '/achievements']],
  ['Food & health', ['/calories', '/nutrition-week', '/meal-plan', '/health-scan', '/hydration', '/pill-box']],
  ['App', ['/devices', '/backup', '/whats-new', '/settings']],
]
const TILES = [
  { label: 'Cardio', sub: 'Runs, walks & rope', icon: HeartPulse, to: '/cardio', tint: 'text-rose-400', bg: 'bg-rose-400/12' },
  { label: 'Water & Creatine', sub: 'Reminders & logs', icon: Droplets, to: '/hydration', tint: 'text-sky-400', bg: 'bg-sky-400/12' },
  { label: 'Exercise Library', sub: 'Your full arsenal', icon: BookOpen, to: '/exercises', tint: 'text-violet-400', bg: 'bg-violet-400/12' },
  { label: 'Plan settings', sub: 'Weeks & rebuild', icon: CalendarRange, to: '/plan', tint: 'text-brand', bg: 'bg-brand/12' },
  { label: 'Progress', sub: 'Weight & strength', icon: TrendingUp, to: '/progress', tint: 'text-emerald-400', bg: 'bg-emerald-400/12' },
  { label: 'Coach programs', sub: 'CBum & Nippard', icon: ClipboardList, to: '/programs', tint: 'text-amber-400', bg: 'bg-amber-400/12' },
  { label: 'Weekly review', sub: 'How the week went', icon: CalendarCheck, to: '/review', tint: 'text-cyan-400', bg: 'bg-cyan-400/12' },
  { label: 'Progress photos', sub: 'Side-by-side, on device', icon: Camera, to: '/photos', tint: 'text-fuchsia-400', bg: 'bg-fuchsia-400/12' },
  { label: 'Achievements', sub: 'Earned from your log', icon: Award, to: '/achievements', tint: 'text-amber-300', bg: 'bg-amber-300/12' },
  { label: 'What’s new', sub: 'Every feature, and where', icon: Layers, to: '/whats-new', tint: 'text-sky-400', bg: 'bg-sky-400/12' },
  { label: 'Backup', sub: 'Export & restore', icon: DatabaseBackup, to: '/backup', tint: 'text-emerald-400', bg: 'bg-emerald-400/12' },
  { label: 'Connected devices', sub: 'Watch, camera, honest status', icon: Watch, to: '/devices', tint: 'text-rose-300', bg: 'bg-rose-300/12' },
  { label: 'Calorie centre', sub: 'Target, proposals, undo', icon: Flame, to: '/calories', tint: 'text-orange-400', bg: 'bg-orange-400/12' },
  { label: 'Progress hub', sub: 'Trophies, XP, muscles', icon: Trophy, to: '/hub', tint: 'text-amber-400', bg: 'bg-amber-400/12' },
  { label: 'Pill box', sub: 'Supplements & stock', icon: HeartPulse, to: '/pill-box', tint: 'text-violet-300', bg: 'bg-violet-300/12' },
  { label: 'Body anatomy', sub: 'Real muscles', icon: HeartPulse, to: '/anatomy', tint: 'text-emerald-300', bg: 'bg-emerald-300/12' },
  { label: 'Health scanner', sub: 'Food score out of 100', icon: HeartPulse, to: '/health-scan', tint: 'text-emerald-400', bg: 'bg-emerald-400/12' },
  { label: 'Nutrition chart', sub: '7 / 14 / 30 days', icon: TrendingUp, to: '/nutrition-week', tint: 'text-orange-300', bg: 'bg-orange-300/12' },
  { label: 'Meal planner', sub: 'Plan the next 7 days', icon: CalendarRange, to: '/meal-plan', tint: 'text-lime-400', bg: 'bg-lime-400/12' },
  { label: 'Settings', sub: 'Profile & data', icon: Settings, to: '/settings', tint: 'text-ink2', bg: 'bg-surface3' },
]

const INSIGHT_TONES = {
  good: 'text-emerald-400',
  neutral: 'text-ink',
  watch: 'text-amber-400',
} as const

export default function MoreScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const today = todayStr()

  const [staleDays, setStaleDays] = useState<number | null>(null)
  useEffect(() => { void daysSinceExport().then(setStaleDays) }, [])

  const [nowMin, setNowMin] = useState(nowMinutes)
  useEffect(() => {
    const id = window.setInterval(() => setNowMin(nowMinutes()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const profile = useLiveQuery(() => getProfile(), [])
  const reminders = useLiveQuery(() => db.reminders.get('reminders'), [])
  const plan = useLiveQuery(() => getActivePlan(), [])
  const [customising, setCustomising] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const tilePrefs = useLiveQuery(() => getSetting<{ pinned: string[]; hidden: string[] }>('more:tiles', { pinned: [], hidden: [] }), []) ?? { pinned: [], hidden: [] }
  const saveTilePrefs = (v: { pinned: string[]; hidden: string[] }) => setSetting('more:tiles', v)
  const orderedTiles = [...TILES.filter((t) => tilePrefs.pinned.includes(t.to)).sort((a, b) => tilePrefs.pinned.indexOf(a.to) - tilePrefs.pinned.indexOf(b.to)), ...TILES.filter((t) => !tilePrefs.pinned.includes(t.to))]
    .filter((t) => customising || showHidden || !tilePrefs.hidden.includes(t.to))
  const latestWeigh = useLiveQuery(() => db.weighIns.orderBy('date').last(), [])
  const [exporting, setExporting] = useState(false)

  // ---------- weekly insight (v4) ----------
  const [insight, setInsight] = useState<WeeklyInsight | null>(null)
  useEffect(() => {
    let alive = true
    void loadWeeklyInsight().then((r) => { if (alive) setInsight(r) })
    return () => { alive = false }
  }, [today])

  // ---------- quick weigh-in (v4) ----------
  const [weighOpen, setWeighOpen] = useState(false)
  const [weighText, setWeighText] = useState('')
  const weighValue = parseNumber(weighText)
  const weighValid = Number.isFinite(weighValue) && weighValue >= 40 && weighValue <= 250

  useEffect(() => {
    if (weighOpen) setWeighText(String(latestWeigh?.weightKg ?? profile?.weightKg ?? ''))
  }, [weighOpen, latestWeigh, profile])

  async function saveWeighIn() {
    if (!weighValid) return
    const kg = Math.round(weighValue * 10) / 10
    await upsertTodayWeighIn(kg)
    const p = await getProfile()
    if (p) await saveProfile({ ...p, weightKg: kg })
    feedback('set')
    toast(`Logged ${fmtKg(kg)} for today`)
    setWeighOpen(false)
  }

  function startTodaysSession() {
    navigate('/workout')
  }

  const isTrainingDay = useMemo(() => (plan ? dayForDate(plan, today) !== null : false), [plan, today])
  const timeline = useMemo(
    () => (profile && reminders ? todayTimeline(profile, reminders, isTrainingDay) : []),
    [profile, reminders, isTrainingDay],
  )
  const nextIdx = timeline.findIndex((i) => minutesOf(i.time) >= nowMin)

  async function doExport() {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await exportBackup()
      await shareOrDownload(blob, `ironverse-backup-${today}.json`, 'Ironverse backup')
      toast('Backup exported')
    } catch {
      toast('Export failed — try again', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (profile === undefined) {
    return (
      <div>
        <PageHeader title="More" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  const weight = latestWeigh?.weightKg ?? profile?.weightKg
  const goalMeta = profile ? GOAL_META[profile.goal] : null

  return (
    <div className="mx-auto max-w-lg pb-8">
      <PageHeader title="More" />

      {/* ---------- global search (v4) ---------- */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => navigate('/search')}
          aria-label="Search exercises, foods, sessions and settings"
          className={`pressable ${FOCUS_RING} ${TAP_TARGET} flex w-full items-center gap-2.5 rounded-xl bg-surface3 px-3.5 py-3 text-left`}
        >
          <Search size={18} className="shrink-0 text-ink3" aria-hidden="true" />
          <span className="flex-1 text-[15px] text-ink3">Search exercises, foods, sessions…</span>
          <ChevronRight size={17} className="shrink-0 text-ink3" aria-hidden="true" />
        </button>
      </div>

      {staleDays !== null && staleDays >= EXPORT_NAG_DAYS && (
        <button
          type="button"
          onClick={() => navigate('/backup')}
          className="pressable mx-4 mb-3 flex w-[calc(100%-2rem)] items-start gap-3 rounded-xl2 border border-amber-500/30 bg-amber-500/10 p-3 text-left"
        >
          <DatabaseBackup size={17} className="mt-0.5 shrink-0 text-amber-400" />
          <span className="text-[13px] leading-relaxed text-ink2">
            Last backup was {staleDays} days ago. Worth grabbing a fresh copy — it takes a second.
          </span>
          <ChevronRight size={16} className="mt-0.5 shrink-0 text-ink3" />
        </button>
      )}

      {/* ---------- profile header card ---------- */}
      <div className="px-4">
        {profile ? (
          <Card className="p-4" onClick={() => navigate('/settings')}>
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-amber-600 text-white shadow-md shadow-brand/25">
                <span className="shout text-[24px] not-italic">{(profile.name.trim()[0] ?? 'I').toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[18px] font-bold text-ink">{profile.name}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {weight !== undefined && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface3 px-2.5 py-1">
                      <Scale size={12.5} className="text-ink2" />
                      <span className="big-num text-[12px] text-ink">{fmtKg(weight)}</span>
                    </span>
                  )}
                  {goalMeta && <Badge tone={goalMeta.tone}>{goalMeta.label}</Badge>}
                </div>
              </div>
              <ChevronRight size={19} className="shrink-0 text-ink3" />
            </div>
          </Card>
        ) : (
          <Card className="p-4" onClick={() => navigate('/onboarding')}>
            <div className="text-[15px] font-semibold text-ink">Finish setting up</div>
            <div className="mt-0.5 text-[13px] text-ink2">Run onboarding to build your profile and plan.</div>
          </Card>
        )}
        {profile && <div className="mt-3"><AthleteCard profile={profile} plan={plan} /></div>}
      </div>

      {/* ---------- quick actions (v4) ---------- */}
      <Section title="Quick actions">
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={<Scale size={20} />}
            label="Log weight"
            sub={latestWeigh ? `Last: ${fmtKg(latestWeigh.weightKg)}` : 'No weigh-in yet'}
            onClick={() => setWeighOpen(true)}
            tint="text-emerald-400"
            bg="bg-emerald-400/12"
          />
          <QuickAction
            icon={<Dumbbell size={20} />}
            label={isTrainingDay ? 'Start today’s session' : 'Open workout'}
            sub={isTrainingDay ? 'Training day' : 'Rest day — browse anyway'}
            onClick={startTodaysSession}
            tint="text-brand"
            bg="bg-brand/12"
          />
          <QuickAction
            icon={<Utensils size={20} />}
            label="Add food"
            sub="Log a meal or a quick add"
            onClick={() => navigate('/food')}
            tint="text-amber-400"
            bg="bg-amber-400/12"
          />
          <QuickAction
            icon={<Camera size={20} />}
            label="Progress photo"
            sub="Stays on this device"
            onClick={() => navigate('/photos')}
            tint="text-fuchsia-400"
            bg="bg-fuchsia-400/12"
          />
        </div>
      </Section>

      {/* ---------- weekly insight (v4) ---------- */}
      <Section title="This week">
        <Card className="p-4">
          {insight === null ? (
            <div className="flex items-center gap-2 py-2 text-ink3">
              <Spinner className="h-4 w-4" />
              <span className="text-[13px]">Reading the last 7 days…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Gauge size={15} className="text-brand" aria-hidden="true" />
                <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">
                  Last 7 days
                </h3>
              </div>

              <p className="mt-2.5 text-[13px] leading-relaxed text-ink2">{insight.paragraph}</p>

              {insight.stats.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-3">
                  {insight.stats.map((s) => (
                    <div key={s.label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink3">{s.label}</dt>
                      <dd className={`big-num mt-0.5 text-[17px] leading-none ${INSIGHT_TONES[s.tone]}`}>
                        {s.value}
                      </dd>
                      {s.sub && <dd className="mt-0.5 text-[11px] text-ink3">{s.sub}</dd>}
                    </div>
                  ))}
                </dl>
              )}

              {insight.suggestion && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-brand/10 p-3">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                  <p className="text-[12.5px] leading-relaxed text-ink2">{insight.suggestion}</p>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <Button small variant="secondary" onClick={() => navigate('/review')}>
                  Full weekly review
                </Button>
                <Button small variant="ghost" onClick={() => navigate('/achievements')}>
                  Achievements
                </Button>
              </div>
            </>
          )}
        </Card>
      </Section>

      {/* ---------- launcher tiles ---------- */}
      <Section title="All sections" className="pt-1" action={<button type="button" className="text-[12.5px] font-semibold text-brand" onClick={() => setCustomising((v) => !v)}>{customising ? 'Done' : 'Customise'}</button>}>
        {customising && <div className="mb-2 text-[12px] text-ink3">Tap ★ to pin a shortcut to the top, 👁 to hide it. Hidden shortcuts stay one tap away under “Show hidden”.</div>}
        {(() => {
          const pinned = orderedTiles.filter((t) => tilePrefs.pinned.includes(t.to))
          const groups: [string, typeof orderedTiles][] = [
            ...(pinned.length ? [['Pinned', pinned] as [string, typeof orderedTiles]] : []),
            ...TILE_GROUPS.map(([name, tos]) => [name, orderedTiles.filter((t) => tos.includes(t.to) && !tilePrefs.pinned.includes(t.to))] as [string, typeof orderedTiles]),
            ['Other', orderedTiles.filter((t) => !tilePrefs.pinned.includes(t.to) && !TILE_GROUPS.some(([, tos]) => tos.includes(t.to)))] as [string, typeof orderedTiles],
          ]
          return groups.filter(([, list]) => list.length).map(([name, list]) => (
            <div key={name} className="mb-4">
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink3">{name}</div>
              <div className="grid grid-cols-2 gap-3">
          {list.map((t) => {
            const Icon = t.icon
            return (
              <Card key={t.to} className={`relative p-3.5 ${tilePrefs.hidden.includes(t.to) ? 'opacity-40' : ''}`} onClick={() => (customising ? undefined : navigate(t.to))}>
                {customising && (
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button type="button" aria-label="Pin" onClick={(e) => { e.stopPropagation(); void saveTilePrefs({ ...tilePrefs, pinned: tilePrefs.pinned.includes(t.to) ? tilePrefs.pinned.filter((x) => x !== t.to) : [...tilePrefs.pinned, t.to] }) }} className={`rounded-full px-1.5 text-[14px] ${tilePrefs.pinned.includes(t.to) ? 'text-amber-400' : 'text-ink3'}`}>★</button>
                    <button type="button" aria-label="Hide" onClick={(e) => { e.stopPropagation(); void saveTilePrefs({ ...tilePrefs, hidden: tilePrefs.hidden.includes(t.to) ? tilePrefs.hidden.filter((x) => x !== t.to) : [...tilePrefs.hidden, t.to] }) }} className="rounded-full px-1.5 text-[13px]">👁</button>
                  </div>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.bg} ${t.tint}`}>
                  <Icon size={20} />
                </div>
                <div className="mt-2.5 text-[14px] font-bold leading-tight text-ink">{t.label}</div>
                <div className="mt-0.5 text-[11.5px] text-ink3">{t.sub}</div>
              </Card>
            )
          })}
              </div>
            </div>
          ))
        })()}
        {!customising && tilePrefs.hidden.length > 0 && (
          <button type="button" className="mt-2 text-[12.5px] text-ink3" onClick={() => setShowHidden((v) => !v)}>{showHidden ? 'Hide' : 'Show'} hidden ({tilePrefs.hidden.length})</button>
        )}

        <Card className="mt-3 p-3.5" onClick={() => void doExport()}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
              {exporting ? <Spinner className="h-5 w-5" /> : <DatabaseBackup size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-ink">Backup</div>
              <div className="mt-0.5 text-[11.5px] text-ink3">Export everything as a JSON file</div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-ink3" />
          </div>
        </Card>
      </Section>

      {/* ---------- today's schedule mini timeline ---------- */}
      <Section title="Today’s schedule">
        <Card className="p-4">
          {timeline.length === 0 ? (
            <div className="py-5 text-center">
              <BellRing size={20} className="mx-auto text-ink3" />
              <p className="mt-2 text-[13px] text-ink3">
                Nothing scheduled — set up reminders in Water &amp; Creatine.
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-3 top-3 left-[89px] w-px bg-line" />
              {timeline.map((item, i) => {
                const past = minutesOf(item.time) < nowMin
                const isNext = i === nextIdx
                const Icon = TIMELINE_ICONS[item.kind]
                return (
                  <div
                    key={`${item.kind}-${i}`}
                    className={`relative flex items-center gap-3 py-[7px] transition-opacity ${past ? 'opacity-40' : ''}`}
                  >
                    <div className="w-16 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink2">
                      {fmt12(item.time)}
                    </div>
                    <div
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isNext ? 'bg-brand text-white shadow-md shadow-brand/30' : `bg-surface3 ${TIMELINE_TONES[item.kind]}`
                      }`}
                    >
                      <Icon size={14} strokeWidth={2.4} />
                    </div>
                    <div className={`min-w-0 flex-1 truncate text-[13.5px] ${isNext ? 'font-bold text-ink' : 'font-medium text-ink2'}`}>
                      {item.label}
                    </div>
                    {isNext && <Badge tone="brand">Next</Badge>}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </Section>

      <div className="px-4 pt-4"><AppVersionCard /></div>

      {/* ---------- footer ---------- */}
      <div className="mt-8 flex flex-col items-center gap-1.5 px-4">
        <div className="flex items-center gap-1.5 text-ink3">
          <WifiOff size={13} />
          <span className="text-[12px] font-medium">Works fully offline — your data never leaves this device.</span>
        </div>
        <span className="text-[11.5px] text-ink3">Ironverse v{APP_VERSION}</span>
        <button
          type="button"
          onClick={() => navigate('/whats-new')}
          className={`pressable ${FOCUS_RING} ${TAP_TARGET} text-[12px] font-semibold text-brand`}
        >
          What’s new in this app
        </button>
      </div>

      {/* ---------- quick weigh-in sheet (v4) ---------- */}
      <Sheet open={weighOpen} onClose={() => setWeighOpen(false)} title="Log today’s weight">
        <div className="space-y-4">
          <Field
            label="Weight (kg)"
            hint={latestWeigh ? `Last logged ${fmtKg(latestWeigh.weightKg)} on ${latestWeigh.date}.` : 'Your first weigh-in.'}
          >
            <Input
              autoFocus
              inputMode="decimal"
              aria-label="Weight in kilograms"
              value={weighText}
              onChange={(e) => setWeighText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && weighValid) void saveWeighIn() }}
            />
          </Field>
          {!weighValid && weighText.trim() !== '' && (
            <p className="text-[12px] text-ink3">Enter a weight between 40 and 250 kg.</p>
          )}
          <Button full disabled={!weighValid} onClick={() => void saveWeighIn()}>
            <Plus size={16} aria-hidden="true" />
            Save weigh-in
          </Button>
          <p className="text-[12px] leading-relaxed text-ink3">
            Saving updates today’s weigh-in if one already exists, so tapping twice
            never creates a duplicate.
          </p>
        </div>
      </Sheet>
    </div>
  )
}
