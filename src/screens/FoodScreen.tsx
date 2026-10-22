// /food — advanced nutrition tracker: daily log, macro summary,
// adaptive-TDEE deficit detector, weekly view, full add/edit flow.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Fab, IconButton, PageHeader, Segmented, Spinner } from '@/components/ui'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { FoodLogEntry, MealKey } from '@/db/types'
import { dayjs, fmtDayShort } from '@/lib/fmt'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { ProteinCoach } from './food/ProteinCoach'
import { FitsNow } from './food/FitsNow'
import { LogMealSheet } from './food/LogMealSheet'
import { isMealKey, MEALS, mealForNow, sumEntries, targetForDateWith } from './food/helpers'
import {
  useCatalog, useDayEntries, useIntakeMap, useProfile, useRangeEntries,
  useRecents, useWeighIns,
} from './food/useFoodData'
import { SummaryCard } from './food/SummaryCard'
import { DeficitCard } from './food/DeficitCard'
import { WeekCard } from './food/WeekCard'
import { MealSection } from './food/MealSection'
import { AddFoodSheet } from './food/AddFoodSheet'
import { EntrySheet } from './food/EntrySheet'
import { OverBudgetCard } from './food/OverBudgetCard'
import { WeeklyBudgetCard } from './food/WeeklyBudgetCard'
import { CaptureSheet, type CaptureResult } from './food/capture'
import { Camera, ScanBarcode } from 'lucide-react'
import { pendingProposal } from '@/lib/calorieTarget'
import { useNavigate } from 'react-router-dom'
import { FullWeekCard, OffChartCard, PatternTipsCard } from './food/OvereatingCards'

function dateLabel(date: string): string {
  const today = todayStr()
  if (date === today) return 'Today'
  if (date === dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')) return 'Yesterday'
  if (date === dayjs(today).add(1, 'day').format('YYYY-MM-DD')) return 'Tomorrow'
  return fmtDayShort(date)
}

export default function FoodScreen() {
  const toast = useUI((s) => s.toast)
  const navigate = useNavigate()
  const proposal = useLiveQuery(() => pendingProposal(), [])
  const [searchParams, setSearchParams] = useSearchParams()
  const [date, setDate] = useState(() => { const q = new URLSearchParams(window.location.search).get('date'); return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayStr() })
  const [view, setView] = useState<'day' | 'week'>('day')
  const [addOpen, setAddOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [addMeal, setAddMeal] = useState<MealKey>(mealForNow())
  const [editing, setEditing] = useState<FoodLogEntry | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureMode, setCaptureMode] = useState<'photo' | 'barcode'>('photo')

  const profile = useProfile()
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const adjusts = useLiveQuery(async () => {
    const rows = await db.dayAdjust.toArray()
    return new Map(rows.map((r) => [r.date, r]))
  }, [])
  const dayEntries = useDayEntries(date)
  const yesterday = dayjs(date).subtract(1, 'day').format('YYYY-MM-DD')
  const yesterdayEntries = useDayEntries(yesterday)
  const weekEntries = useRangeEntries(date, 7)
  // the whole Mon–Sun week of the viewed date (the budget card needs days AFTER it too)
  const wkMon = dayjs(date).subtract((dayjs(date).day() + 6) % 7, 'day').format('YYYY-MM-DD')
  const fullWeekEntries = useLiveQuery(() => db.foodLog.where('date').between(wkMon, dayjs(wkMon).add(6, 'day').format('YYYY-MM-DD'), true, true).toArray(), [wkMon])
  const catalog = useCatalog()
  const recents = useRecents()
  const weighIns = useWeighIns()
  const intakeMap = useIntakeMap()

  // deep link: /food?add=1&meal=lunch
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      const m = searchParams.get('meal')
      setAddMeal(isMealKey(m) ? m : mealForNow())
      setAddOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const totals = useMemo(() => sumEntries(dayEntries ?? []), [dayEntries])

  const byMeal = useMemo(() => {
    const map = new Map<MealKey, FoodLogEntry[]>()
    for (const m of MEALS) map.set(m.key, [])
    for (const e of dayEntries ?? []) map.get(e.meal)?.push(e)
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [dayEntries])

  const yesterdayCounts = useMemo(() => {
    const map = new Map<MealKey, number>()
    for (const m of MEALS) map.set(m.key, 0)
    for (const e of yesterdayEntries ?? []) map.set(e.meal, (map.get(e.meal) ?? 0) + 1)
    return map
  }, [yesterdayEntries])

  const openAdd = (meal: MealKey) => { setAddMeal(meal); setAddOpen(true) }

  const copyYesterday = async (meal: MealKey) => {
    const items = (yesterdayEntries ?? []).filter((e) => e.meal === meal)
    if (items.length === 0) return
    await db.foodLog.bulkAdd(
      // the photo stays on the original entry — copying it would duplicate a large blob every day
      items.map(({ photo: _photo, ...e }) => ({ ...e, id: newId(), date, createdAt: nowIso() })),
    )
    toast(`Copied ${items.length} item${items.length === 1 ? '' : 's'} from yesterday`)
  }

  /** turn a logged meal into a saved meal (recipe) he can re-add in one tap */
  const saveAsMeal = async (meal: MealKey) => {
    const items = (dayEntries ?? []).filter((e) => e.meal === meal)
    if (items.length < 2) return
    const name = prompt('Name this meal', `${MEALS.find((m) => m.key === meal)?.label ?? 'Meal'} — ${items.map((i) => i.name).slice(0, 2).join(' + ')}`)
    if (!name) return
    const ts = nowIso()
    await db.recipes.add({
      id: newId(), name: name.trim(), servings: 1, useCount: 0, createdAt: ts, updatedAt: ts,
      ingredients: items.map((e) => ({ foodId: e.foodId, name: e.name, grams: e.grams, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat })),
    })
    toast(`Saved "${name.trim()}" — find it under Meals when adding food`)
  }

  const loading = !profile || !dayEntries || !weekEntries || !recents || !weighIns || !intakeMap
  if (loading) {
    return (
      <div>
        <PageHeader title="Nutrition" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Nutrition"
        subtitle={`Target ${targetForDateWith(date, profile, adjusts).toLocaleString('en-AU')} kcal${targetForDateWith(date, profile, adjusts) !== profile.calorieTarget ? ` (${profile.calorieTarget.toLocaleString('en-AU')} ${targetForDateWith(date, profile, adjusts) > profile.calorieTarget ? '+' : '−'} carry-over)` : ''} · ${profile.proteinTarget}g protein`}
      />

      {/* date navigator */}
      <div className="flex items-center justify-between px-4 pt-1">
        <IconButton label="Previous day" onClick={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}>
          <ChevronLeft size={20} />
        </IconButton>
        <button
          type="button"
          onClick={() => setDate(todayStr())}
          className="pressable rounded-xl px-4 py-1 text-center"
        >
          <div className="text-[17px] font-bold text-ink">{dateLabel(date)}</div>
          <div className="text-[11.5px] text-ink3">
            {date === todayStr() ? fmtDayShort(date) : 'tap for today'}
          </div>
        </button>
        <IconButton label="Next day" onClick={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <div className="px-4 pt-3">
        <Segmented
          options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* one authoritative target: proposals need his OK (IV-17 / IV-22) */}
      {proposal ? (
        <button type="button" onClick={() => navigate('/calories')} className="pressable mx-4 mt-3 block w-[calc(100%-2rem)] rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-left text-[13px]">
          <b>Recommended: {proposal.from.toLocaleString('en-AU')} → {proposal.to.toLocaleString('en-AU')} kcal.</b> Not applied yet — tap to review, accept or dismiss.
        </button>
      ) : (
        <button type="button" onClick={() => navigate('/calories')} className="pressable px-5 pt-2 text-left text-[11.5px] text-ink3">Target {profile.calorieTarget.toLocaleString('en-AU')} kcal · changes only with your OK · <span className="text-brand">history &amp; adjust</span></button>
      )}

      {view === 'day' ? (
        <div className="space-y-3 px-4 pt-3">
          <SummaryCard totals={totals} profile={profile} target={targetForDateWith(date, profile, adjusts)}
            onScanMeal={() => { setAddMeal(mealForNow()); setCaptureMode('photo'); setCaptureOpen(true) }}
            onBarcode={() => { setAddMeal(mealForNow()); setCaptureMode('barcode'); setCaptureOpen(true) }}
            onManual={() => { setAddMeal(mealForNow()); setQuickOpen(true) }} />
          {(() => {
            // meal budget: what is left, shared across the meals not logged yet
            const tgt = targetForDateWith(date, profile, adjusts)
            const left = Math.round(tgt - totals.kcal), pLeft = Math.round(profile.proteinTarget - totals.protein)
            const open = MEALS.filter((m) => !(byMeal.get(m.key) ?? []).length && m.key !== 'snacks')
            if (left <= 0 || !open.length) return null
            const per = Math.round(left / open.length / 10) * 10
            return (
              <div className="rounded-2xl bg-surface2 px-4 py-3 text-[13px] shadow-card">
                <b>Meal budget:</b> {left.toLocaleString('en-AU')} kcal left — about <b>{per.toLocaleString('en-AU')} kcal</b> for {open.length === 1 ? open[0].label.toLowerCase() : `each of ${open.map((m) => m.label.toLowerCase()).join(', ')}`}
                {pLeft > 0 && <> · aim for ~{Math.round(pLeft / open.length)} g protein in each</>}.
              </div>
            )
          })()}
          {/* v10 order (owner, 23 Oct 2026): alerts, then your meals, then coaching, then tools */}
          <OffChartCard kcal={totals.kcal} target={targetForDateWith(date, profile, adjusts)} protein={totals.protein} profile={profile} />
          <OverBudgetCard
            date={date}
            profile={profile}
            eaten={totals.kcal}
            target={targetForDateWith(date, profile, adjusts)}
            adjusts={adjusts}
          />
          {MEALS.map((m) => (
            <MealSection
              key={m.key}
              meal={m.key}
              label={m.label}
              entries={byMeal.get(m.key) ?? []}
              yesterdayCount={yesterdayCounts.get(m.key) ?? 0}
              onAdd={openAdd}
              onCopyYesterday={(meal) => { void copyYesterday(meal) }}
              onSaveMeal={(meal) => { void saveAsMeal(meal) }}
              onEntryTap={setEditing}
            />
          ))}
          <ProteinCoach date={date} profile={profile} byMeal={byMeal} />
          <FitsNow date={date} profile={profile} kcalLeft={targetForDateWith(date, profile, adjusts) - totals.kcal} proteinEaten={totals.protein} />
          <div>
            <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink3">Food tools</div>
            <div className="grid grid-cols-3 gap-2">
              {([['🧪', 'Health scanner', '/health-scan'], ['⏱️', 'Fasting timer', '/fasting'], ['📅', 'Meal planner', '/meal-plan'], ['📊', 'Nutrition chart', '/nutrition-week'], ['🍔', 'Fast-food guide', '/fast-food'], ['📸', 'Photo diary', '/food-photos'], ['💊', 'Pill box', '/pill-box']] as const).map(([i, l, to]) => (
                <button key={to} type="button" onClick={() => navigate(to)} className="pressable flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-2xl bg-surface2 px-1 text-center text-[11.5px] font-semibold shadow-card"><span className="text-[20px]">{i}</span>{l}</button>
              ))}
            </div>
          </div>
          <DeficitCard profile={profile} weighIns={weighIns} intakeMap={intakeMap} />
        </div>
      ) : (
        <div className="space-y-3 px-4 pt-3">
          <FullWeekCard anchorDate={date} profile={profile} adjusts={adjusts} onPickDay={(d) => { setDate(d); setView('day') }} />
          <PatternTipsCard profile={profile} adjusts={adjusts} />
          <WeekCard endDate={date} entries={weekEntries} profile={profile} adjusts={adjusts} />
          <WeeklyBudgetCard endDate={date} entries={fullWeekEntries ?? weekEntries} profile={profile} adjusts={adjusts} />
          <DeficitCard profile={profile} weighIns={weighIns} intakeMap={intakeMap} />
        </div>
      )}

      <Fab label="Add food" onClick={() => { setAddMeal(mealForNow()); setQuickOpen(true) }}>
        <Plus size={26} strokeWidth={2.4} />
      </Fab>

      {quickOpen && <LogMealSheet open onClose={() => setQuickOpen(false)} date={date} initialMeal={addMeal}
        onMoreOptions={(m) => { setQuickOpen(false); openAdd(m) }}
        onBarcode={(m) => { setQuickOpen(false); setAddMeal(m); setCaptureMode('barcode'); setCaptureOpen(true) }} />}

      <AddFoodSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        date={date}
        initialMeal={addMeal}
        catalog={catalog}
        recents={recents}
        profile={profile}
        recipes={recipes ?? []}
        onScan={() => { setAddOpen(false); setCaptureMode('barcode'); setCaptureOpen(true) }}
      />

      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        meal={addMeal}
        mode={captureMode}
        onConfirm={async (result: CaptureResult) => {
          const ts = nowIso()
          const rows = result.items.map((item, i) => ({
            id: newId(),
            date,
            meal: addMeal,
            name: item.name,
            grams: item.grams,
            kcal: item.kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fibre: item.fibre,
            sugar: item.sugar,
            sodium: item.sodium,
            satFat: item.satFat,
            barcode: item.barcode,
            estimate: result.source === 'photo',
            source: result.source,
            // the photo rides on the first entry so the meal keeps one copy
            photo: i === 0 ? result.photo : undefined,
            createdAt: ts,
          }))
          await db.foodLog.bulkAdd(rows)
          toast(rows.length === 1 ? 'Added' : `Added ${rows.length} items`)
        }}
      />

      {editing && (
        <EntrySheet entry={editing} catalog={catalog} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
