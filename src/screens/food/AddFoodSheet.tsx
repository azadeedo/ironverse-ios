// Add-food flow: search the seed db + custom foods + recents/favourites/saved
// meals, quick kcal entry, and creating custom foods.
//
// Halal mode hides pork and alcohol and offers substitutes when a search asks
// for them; ambiguous items stay visible with a "check the label" note.
// Energy is entered in calories OR kilojoules and ALWAYS stored as kcal.
import { ScanBarcode } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, History, Star, Utensils, Wand2 } from 'lucide-react'
import {
  Badge, Button, EmptyState, Field, Input, ListRow, SearchBar, Segmented, Sheet,
} from '@/components/ui'
import { db } from '@/db'
import type { FoodLogEntry, MealKey, Profile, Recipe } from '@/db/types'
import { energyUnit, halalMode } from '@/db/defaults'
import {
  FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, foodIdCandidates, type FoodCategory,
} from '@/data/foods'
import {
  autoDietTags, cautionReason, filterHalal, isHalalCaution, primaryTagLabel,
  substitutesForQuery,
} from '@/lib/halal'
import { checkMacros, fmtEnergy, fmtEnergyShort } from '@/lib/energy'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'
import {
  MEALS, parseNum, recipeGrams, recipePerServe, round1, scaledMacros, type CatalogFood,
} from './helpers'
import { setFavourite, touchFood, type RecentItem } from './useFoodData'
import { EnergyInput, energyKcal, useEnergyInputUnit } from './EnergyInput'
import { RecipeSheet } from './RecipeSheet'

type Tab = 'search' | 'meals' | 'quick' | 'new'
type Filter = FoodCategory | 'mine' | null

const MEAL_OPTIONS = MEALS.map((m) => ({ value: m.key, label: m.short }))
const mealLabel = (k: MealKey) => MEALS.find((m) => m.key === k)?.label ?? k

function MacroPreview({ kcal, protein, carbs, fat, unit }: {
  kcal: number; protein: number; carbs: number; fat: number; unit: ReturnType<typeof energyUnit>
}) {
  const cell = (label: string, value: string, strong?: boolean) => (
    <div className="flex-1 rounded-xl bg-surface3 px-2 py-2 text-center">
      <div className={`text-[15px] font-bold ${strong ? 'text-brand' : 'text-ink'}`}>{value}</div>
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-ink3">{label}</div>
    </div>
  )
  return (
    <div className="flex gap-2">
      {cell(unit === 'kj' ? 'energy' : 'calories', fmtEnergyShort(kcal, unit), true)}
      {cell('protein', `${protein}g`)}
      {cell('carbs', `${carbs}g`)}
      {cell('fat', `${fat}g`)}
    </div>
  )
}

export function AddFoodSheet({
  open, onClose, date, initialMeal, catalog, recents, profile, recipes, onScan,
}: {
  /** open the barcode scanner (camera or photo) */
  onScan?: () => void
  open: boolean
  onClose: () => void
  date: string
  initialMeal: MealKey
  catalog: CatalogFood[]
  recents: RecentItem[]
  profile: Profile
  recipes: Recipe[]
}) {
  const toast = useUI((s) => s.toast)
  const halal = halalMode(profile)
  const unit = energyUnit(profile)

  const [tab, setTab] = useState<Tab>('search')
  const [meal, setMeal] = useState<MealKey>(initialMeal)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>(null)
  const [picked, setPicked] = useState<CatalogFood | null>(null)
  const [mode, setMode] = useState<'grams' | 'serving'>('grams')
  const [gramsStr, setGramsStr] = useState('100')
  const [servingsStr, setServingsStr] = useState('1')
  const [recipeEditor, setRecipeEditor] = useState<{ recipe: Recipe | null } | null>(null)
  // quick add
  const [qName, setQName] = useState('')
  const [qKcal, setQKcal] = useState('')
  const [qP, setQP] = useState('')
  // new food
  const [nName, setNName] = useState('')
  const [nBrand, setNBrand] = useState('')
  const [nKcal, setNKcal] = useState('')
  const [nP, setNP] = useState('')
  const [nC, setNC] = useState('')
  const [nF, setNF] = useState('')
  const [nFibre, setNFibre] = useState('')
  const [nSugar, setNSugar] = useState('')
  const [nSodium, setNSodium] = useState('')
  const [nSatFat, setNSatFat] = useState('')
  const [nMore, setNMore] = useState(false)
  const [nServName, setNServName] = useState('')
  const [nServGrams, setNServGrams] = useState('')

  const [inputUnit, setInputUnit] = useEnergyInputUnit()

  useEffect(() => {
    if (!open) return
    setTab('search'); setMeal(initialMeal); setQuery(''); setFilter(null); setPicked(null)
    setMode('grams'); setGramsStr('100'); setServingsStr('1'); setRecipeEditor(null)
    setQName(''); setQKcal(''); setQP('')
    setNName(''); setNBrand(''); setNKcal(''); setNP(''); setNC(''); setNF('')
    setNFibre(''); setNSugar(''); setNSodium(''); setNSatFat(''); setNMore(false)
    setNServName(''); setNServGrams('')
  }, [open, initialMeal])

  /** everything halal mode allows to be shown */
  const visible = useMemo(() => filterHalal(catalog, halal), [catalog, halal])

  const favourites = useMemo(() => visible.filter((c) => c.favourite).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)), [visible])
  // v6: the foods he actually logs most, automatically — starring stays manual
  const frequent = useMemo(() => visible.filter((c) => !c.favourite && (c.useCount ?? 0) >= 3).sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0)).slice(0, 8), [visible])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = visible
    if (filter === 'mine') list = list.filter((c) => c.custom)
    else if (filter) list = list.filter((c) => c.category === filter)
    if (q) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.brand ?? '').toLowerCase().includes(q),
      )
      list = [...list].sort((a, b) => {
        const as = a.name.toLowerCase().startsWith(q) ? 0 : 1
        const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1
        return as - bs || a.name.localeCompare(b.name)
      })
    }
    return list.slice(0, 60)
  }, [visible, query, filter])

  /** "No pork items — try these:" when a search asks for something hidden */
  const substitutes = useMemo(() => {
    const hint = substitutesForQuery(query, halal)
    if (!hint) return null
    const found: CatalogFood[] = []
    for (const id of hint.ids) {
      const match = catalog.find((c) => foodIdCandidates(id).includes(c.id))
      if (match && !found.some((x) => x.id === match.id)) found.push(match)
    }
    return found.length > 0 ? { label: hint.label, foods: found } : null
  }, [query, halal, catalog])

  const pick = (food: CatalogFood, grams?: number) => {
    setPicked(food)
    if (grams && grams > 0) {
      setMode('grams')
      setGramsStr(String(grams % 1 === 0 ? grams : round1(grams)))
    } else if (food.servingGrams) {
      setMode('serving')
      setServingsStr('1')
      setGramsStr(String(food.servingGrams))
    } else {
      setMode('grams')
      setGramsStr('100')
    }
  }

  const effectiveGrams = useMemo(() => {
    if (!picked) return 0
    if (mode === 'serving' && picked.servingGrams) {
      const s = parseNum(servingsStr)
      return s === null ? 0 : round1(s * picked.servingGrams)
    }
    const g = parseNum(gramsStr)
    return g === null ? 0 : g
  }, [picked, mode, gramsStr, servingsStr])

  const preview = picked ? scaledMacros(picked, effectiveGrams) : null

  async function saveEntry(entry: Omit<FoodLogEntry, 'id' | 'createdAt'>) {
    await db.foodLog.add({ ...entry, id: newId(), createdAt: nowIso() })
    toast(`Added to ${mealLabel(entry.meal)}`)
    onClose()
  }

  const savePicked = async () => {
    if (!picked || effectiveGrams <= 0 || !preview) return
    const k = effectiveGrams / 100
    await saveEntry({
      date, meal, foodId: picked.id, name: picked.name,
      grams: round1(effectiveGrams), ...preview,
      source: 'manual',
      ...(picked.fibre !== undefined ? { fibre: round1(picked.fibre * k) } : {}),
      ...(picked.sugar !== undefined ? { sugar: round1(picked.sugar * k) } : {}),
      ...(picked.sodium !== undefined ? { sodium: Math.round(picked.sodium * k) } : {}),
      ...(picked.satFat !== undefined ? { satFat: round1(picked.satFat * k) } : {}),
    })
    await touchFood(picked)
  }

  const relogRecent = async (r: RecentItem) => {
    const food = r.foodId ? catalog.find((c) => c.id === r.foodId) : undefined
    if (food) { pick(food, r.grams); return }
    await saveEntry({
      date, meal, name: r.name, grams: r.grams,
      kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat,
      source: 'manual',
    })
  }

  // ---------- saved meals ----------
  const logRecipe = async (r: Recipe, serves = 1) => {
    const per = recipePerServe(r)
    await saveEntry({
      date, meal, name: serves === 1 ? r.name : `${r.name} x${serves}`,
      grams: round1(recipeGrams(r) * serves),
      kcal: Math.round(per.kcal * serves),
      protein: round1(per.protein * serves),
      carbs: round1(per.carbs * serves),
      fat: round1(per.fat * serves),
      source: 'recipe',
      recipeId: r.id,
    })
    await db.recipes.update(r.id, { useCount: (r.useCount ?? 0) + 1 })
  }

  // ---------- quick add ----------
  const qKcalVal = energyKcal(qKcal, inputUnit)
  const quickValid = qKcalVal !== null && qKcalVal > 0
  const saveQuick = async () => {
    if (!quickValid || qKcalVal === null) return
    await saveEntry({
      date, meal, name: qName.trim() || 'Quick add', grams: 0,
      kcal: qKcalVal,
      protein: parseNum(qP) ?? 0, carbs: 0, fat: 0,
      estimate: true,
      source: 'quick',
    })
  }

  // ---------- new custom food ----------
  const nKcalVal = energyKcal(nKcal, inputUnit)
  const nPv = parseNum(nP) ?? 0
  const nCv = parseNum(nC) ?? 0
  const nFv = parseNum(nF) ?? 0
  const macroCheck = useMemo(
    () => (nKcalVal && nKcalVal > 0 ? checkMacros(nKcalVal, nPv, nCv, nFv) : null),
    [nKcalVal, nPv, nCv, nFv],
  )
  const newValid = nName.trim().length > 0 && nKcalVal !== null && nKcalVal > 0

  const buildNewFood = (kcal: number): CatalogFood => {
    const servG = parseNum(nServGrams)
    const food: CatalogFood = {
      id: newId(),
      name: nName.trim(),
      kcal,
      protein: nPv,
      carbs: nCv,
      fat: nFv,
      custom: true,
      useCount: 0,
      dietTags: autoDietTags(`${nName} ${nBrand}`),
    }
    if (nBrand.trim()) food.brand = nBrand.trim()
    if (nServName.trim() && servG && servG > 0) {
      food.servingName = nServName.trim()
      food.servingGrams = servG
    }
    const fib = parseNum(nFibre); if (fib !== null && nFibre.trim()) food.fibre = fib
    const sug = parseNum(nSugar); if (sug !== null && nSugar.trim()) food.sugar = sug
    const sod = parseNum(nSodium); if (sod !== null && nSodium.trim()) food.sodium = sod
    const sat = parseNum(nSatFat); if (sat !== null && nSatFat.trim()) food.satFat = sat
    return food
  }

  const saveNewFood = async (kcalOverride?: number) => {
    const kcal = kcalOverride ?? nKcalVal
    if (!nName.trim() || kcal === null || kcal <= 0) return
    const food = buildNewFood(kcal)
    const { category: _c, ...item } = food
    await db.foods.add(item)
    toast('Saved as your food')
    setTab('search')
    pick(food)
  }

  const toggleFav = async () => {
    if (!picked) return
    const fav = !picked.favourite
    await setFavourite(picked, fav)
    setPicked({ ...picked, favourite: fav })
    toast(fav ? 'Added to favourites' : 'Removed from favourites', 'info')
  }

  const foodRow = (food: CatalogFood) => {
    const perServe = food.servingGrams
      ? `${fmtEnergyShort((food.kcal * food.servingGrams) / 100, unit)} / ${food.servingName}`
      : `${fmtEnergyShort(food.kcal, unit)} / 100g`
    const caution = isHalalCaution(food, halal) ? cautionReason(food) : undefined
    const tag = primaryTagLabel(food)
    return (
      <ListRow
        key={food.id}
        title={
          <span className="inline-flex items-center gap-1.5">
            {food.name}
            {food.favourite && <Star size={12} className="fill-brand text-brand" />}
            {caution && tag && <Badge tone="amber">{tag}</Badge>}
          </span>
        }
        subtitle={
          <>
            {perServe} · {food.protein}g P
            {food.brand ? ` · ${food.brand}` : ''}
            {food.custom ? ' · custom' : ''}
            {caution && <span className="text-warn"> · {caution}</span>}
          </>
        }
        chevron={false}
        onClick={() => pick(food)}
      />
    )
  }

  // ---------- amount step ----------
  if (picked) {
    const caution = isHalalCaution(picked, halal) ? cautionReason(picked) : undefined
    const serveOptions = [
      ...(picked.servingGrams
        ? [{ name: picked.servingName ?? 'serving', grams: picked.servingGrams }]
        : []),
      ...(picked.serves ?? []),
    ]
    return (
      <Sheet open={open} onClose={onClose} title="Add food" tall>
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="pressable -ml-1 mb-2 flex items-center gap-0.5 text-[14px] font-medium text-brand"
        >
          <ChevronLeft size={18} /> Back to foods
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold leading-tight text-ink">{picked.name}</h3>
            <p className="mt-0.5 text-[12.5px] text-ink3">
              {picked.brand ? `${picked.brand} · ` : ''}
              {fmtEnergy(picked.kcal, unit)} · {picked.protein}g P per 100g
            </p>
          </div>
          <button
            type="button"
            onClick={toggleFav}
            aria-label="Toggle favourite"
            className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface3"
          >
            <Star size={18} className={picked.favourite ? 'fill-brand text-brand' : 'text-ink3'} />
          </button>
        </div>

        {caution && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-[12.5px] leading-snug text-ink2">{caution}</p>
          </div>
        )}

        {picked.servingGrams && (
          <Segmented
            className="mt-4"
            options={[
              { value: 'serving', label: `${picked.servingName ?? 'serving'} (${picked.servingGrams}g)` },
              { value: 'grams', label: 'grams' },
            ]}
            value={mode}
            onChange={(v) => setMode(v)}
          />
        )}

        {serveOptions.length > 1 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {serveOptions.map((s) => (
              <button
                key={`${s.name}-${s.grams}`}
                type="button"
                onClick={() => { setMode('grams'); setGramsStr(String(s.grams)) }}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold ${
                  mode === 'grams' && gramsStr === String(s.grams)
                    ? 'bg-brand text-white'
                    : 'bg-surface3 text-ink2'
                }`}
              >
                {s.name} · {s.grams}g
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          {mode === 'serving' && picked.servingGrams ? (
            <>
              <Field label={`How many ${picked.servingName ?? 'serving'}s?`}>
                <Input
                  inputMode="decimal" value={servingsStr}
                  onChange={(e) => setServingsStr(e.target.value)}
                />
              </Field>
              <div className="mt-2 flex gap-2">
                {[0.5, 1, 1.5, 2].map((n) => (
                  <button
                    key={n} type="button" onClick={() => setServingsStr(String(n))}
                    className={`pressable flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${servingsStr === String(n) ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Field label="Amount in grams">
                <Input
                  inputMode="decimal" value={gramsStr}
                  onChange={(e) => setGramsStr(e.target.value)}
                />
              </Field>
              <div className="mt-2 flex gap-2">
                {[50, 100, 150, 200].map((n) => (
                  <button
                    key={n} type="button" onClick={() => setGramsStr(String(n))}
                    className={`pressable flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${gramsStr === String(n) ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}
                  >
                    {n}g
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {preview && (
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink3">
              {effectiveGrams > 0 ? `${effectiveGrams}g adds` : 'Enter an amount'}
            </div>
            <MacroPreview {...preview} unit={unit} />
          </div>
        )}

        <Field label="Meal" className="mt-4">
          <Segmented options={MEAL_OPTIONS} value={meal} onChange={(v) => setMeal(v)} />
        </Field>

        <Button full className="mt-5" disabled={effectiveGrams <= 0} onClick={() => { void savePicked() }}>
          Add to {mealLabel(meal)}
        </Button>
      </Sheet>
    )
  }

  // ---------- browse / meals / quick / new ----------
  return (
    <>
      <Sheet open={open} onClose={onClose} title="Add food" tall>
        {onScan && (
          <button type="button" onClick={onScan} className="pressable mb-2.5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-bold text-white">
            <ScanBarcode size={20} /> Scan a barcode
          </button>
        )}
        <Segmented
          options={[
            { value: 'search', label: 'Search' },
            { value: 'meals', label: 'My meals' },
            { value: 'quick', label: 'Quick' },
            { value: 'new', label: 'New food' },
          ]}
          value={tab}
          onChange={(v) => setTab(v)}
        />

        {tab === 'search' && (
          <div className="mt-3">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder={`Search ${visible.length}+ foods`}
              autoFocus={false}
            />
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 py-1">
              {([null, 'mine', ...FOOD_CATEGORIES] as Filter[]).map((c) => (
                <button
                  key={String(c)}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${filter === c ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}
                >
                  {c === null ? 'All' : c === 'mine' ? 'My foods' : FOOD_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            {substitutes && (
              <div className="mt-3 rounded-xl2 bg-surface3 p-3">
                <p className="text-[13px] font-semibold text-ink">
                  No {substitutes.label} items — try these:
                </p>
                <p className="mt-0.5 text-[11.5px] text-ink3">
                  Halal mode is on, so {substitutes.label} is hidden. These do the same job.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {substitutes.foods.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pick(s)}
                      className="pressable rounded-full bg-surface2 px-3 py-2 text-[12.5px] font-semibold text-brand"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!query.trim() && filter === null && (
              <>
                {favourites.length > 0 && (
                  <>
                    <div className="mb-1 mt-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">
                      <Star size={12} className="fill-brand text-brand" /> Favourites
                    </div>
                    <div className="-mx-4 divide-y divide-line">{favourites.map(foodRow)}</div>
                  </>
                )}
                {frequent.length > 0 && (
                  <>
                    <div className="mb-1 mt-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">
                      <Star size={12} /> Frequent
                    </div>
                    <div className="-mx-4 divide-y divide-line">{frequent.map(foodRow)}</div>
                  </>
                )}
                {recents.length > 0 && (
                  <>
                    <div className="mb-1 mt-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">
                      <History size={12} /> Recent
                    </div>
                    <div className="-mx-4 divide-y divide-line">
                      {recents.map((r) => (
                        <ListRow
                          key={r.key}
                          title={r.name}
                          subtitle={`${r.grams > 0 ? `${r.grams}g · ` : ''}${fmtEnergyShort(r.kcal, unit)} · ${r.protein}g P`}
                          chevron={false}
                          onClick={() => { void relogRecent(r) }}
                        />
                      ))}
                    </div>
                  </>
                )}
                {favourites.length === 0 && recents.length === 0 && (
                  <p className="mt-4 text-center text-[13px] text-ink2">
                    Search the food database or browse a category above. Foods you log show up
                    here as recents — favourites live at the top.
                  </p>
                )}
              </>
            )}

            {(query.trim() || filter !== null) && (
              results.length === 0 ? (
                <EmptyState
                  title="No matches"
                  subtitle={`Nothing in the database matches “${query.trim()}”.`}
                  action={
                    <Button small variant="secondary" onClick={() => { setNName(query.trim()); setTab('new') }}>
                      Create “{query.trim() || 'new food'}”
                    </Button>
                  }
                />
              ) : (
                <div className="-mx-4 mt-2 divide-y divide-line">{results.map(foodRow)}</div>
              )
            )}
          </div>
        )}

        {tab === 'meals' && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-ink2">
                Meals you build once and log in one tap.
              </p>
              <Button small variant="secondary" onClick={() => setRecipeEditor({ recipe: null })}>
                <Utensils size={14} /> New meal
              </Button>
            </div>

            {recipes.length === 0 ? (
              <EmptyState
                icon={<Utensils size={24} className="text-ink3" />}
                title="No saved meals yet"
                subtitle="Build one from the foods you already use — “My shawarma bowl”, your usual breakfast — and it logs in a single tap from then on."
                action={
                  <Button small onClick={() => setRecipeEditor({ recipe: null })}>
                    Build a meal
                  </Button>
                }
              />
            ) : (
              <div className="-mx-4 mt-2 divide-y divide-line">
                {recipes.map((r) => {
                  const per = recipePerServe(r)
                  return (
                    <ListRow
                      key={r.id}
                      title={r.name}
                      subtitle={`${fmtEnergyShort(per.kcal, unit)} · ${per.protein}g P per serve · ${r.ingredients.length} item${r.ingredients.length === 1 ? '' : 's'}`}
                      right={
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setRecipeEditor({ recipe: r }) }}
                          className="pressable rounded-lg bg-surface3 px-2.5 py-1.5 text-[12px] font-semibold text-ink2"
                        >
                          Edit
                        </button>
                      }
                      chevron={false}
                      onClick={() => { void logRecipe(r) }}
                    />
                  )
                })}
              </div>
            )}

            <Field label="Meal" className="mt-4">
              <Segmented options={MEAL_OPTIONS} value={meal} onChange={(v) => setMeal(v)} />
            </Field>
          </div>
        )}

        {tab === 'quick' && (
          <div className="mt-4 space-y-3">
            <p className="text-[13px] text-ink2">
              Calories and protein only. It gets logged as an estimate and shows up flagged
              that way — rough beats not logging it.
            </p>
            <Field label="Name (optional)">
              <Input placeholder="e.g. Work lunch" aria-label="Work lunch" value={qName} onChange={(e) => setQName(e.target.value)} />
            </Field>
            <Field label="Energy">
              <EnergyInput
                value={qKcal}
                onChange={setQKcal}
                unit={inputUnit}
                onUnitChange={setInputUnit}
                per="serve"
              />
            </Field>
            <Field label="Protein g (optional)">
              <Input inputMode="decimal" placeholder="0" aria-label="0" value={qP} onChange={(e) => setQP(e.target.value)} />
            </Field>
            {qKcalVal !== null && qKcalVal > 0 && (
              <p className="text-[12.5px] text-ink3">
                Stored as {fmtEnergy(qKcalVal, unit)}.
              </p>
            )}
            <Field label="Meal">
              <Segmented options={MEAL_OPTIONS} value={meal} onChange={(v) => setMeal(v)} />
            </Field>
            <Button full disabled={!quickValid} onClick={() => { void saveQuick() }}>
              Add to {mealLabel(meal)}
            </Button>
          </div>
        )}

        {tab === 'new' && (
          <div className="mt-4 space-y-3">
            <p className="text-[13px] text-ink2">
              Create a food once, log it forever. Enter nutrition per 100g — calories or
              kilojoules, whichever the label shows.
            </p>
            <Field label="Name">
              <Input placeholder="e.g. Mum's lentil soup" aria-label="Mum's lentil soup" value={nName} onChange={(e) => setNName(e.target.value)} />
            </Field>
            <Field label="Brand (optional)">
              <Input placeholder="e.g. Coles" aria-label="Coles" value={nBrand} onChange={(e) => setNBrand(e.target.value)} />
            </Field>
            <Field label="Energy per 100g">
              <EnergyInput
                value={nKcal}
                onChange={setNKcal}
                unit={inputUnit}
                onUnitChange={setInputUnit}
                per="per100g"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Protein g">
                <Input inputMode="decimal" placeholder="0" aria-label="0" value={nP} onChange={(e) => setNP(e.target.value)} />
              </Field>
              <Field label="Carbs g">
                <Input inputMode="decimal" placeholder="0" aria-label="0" value={nC} onChange={(e) => setNC(e.target.value)} />
              </Field>
              <Field label="Fat g">
                <Input inputMode="decimal" placeholder="0" aria-label="0" value={nF} onChange={(e) => setNF(e.target.value)} />
              </Field>
            </div>

            {macroCheck && !macroCheck.ok && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug text-ink2">
                    {macroCheck.message} That&rsquo;s {Math.abs(Math.round(macroCheck.driftPct * 100))}% out.
                    Worth a second look at the label — or just use the macros.
                  </p>
                  <button
                    type="button"
                    onClick={() => { void saveNewFood(macroCheck.computed) }}
                    disabled={!nName.trim()}
                    className="pressable mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                  >
                    <Wand2 size={13} /> Use {fmtEnergyShort(macroCheck.computed, unit)} from the macros
                  </button>
                </div>
              </div>
            )}
            {macroCheck && macroCheck.ok && nKcalVal !== null && nKcalVal > 0 && (
              <p className="text-[12px] text-ink3">
                Macros line up with {fmtEnergy(nKcalVal, unit)} per 100g.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Serving name (optional)">
                <Input placeholder="e.g. bowl" aria-label="bowl" value={nServName} onChange={(e) => setNServName(e.target.value)} />
              </Field>
              <Field label="Serving grams">
                <Input inputMode="numeric" placeholder="e.g. 300" aria-label="300" value={nServGrams} onChange={(e) => setNServGrams(e.target.value)} />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => setNMore((v) => !v)}
              className="pressable text-[13px] font-semibold text-brand"
            >
              {nMore ? 'Hide extra nutrition' : 'Add fibre, sugar, sodium, sat fat'}
            </button>
            {nMore && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Fibre g / 100g">
                  <Input inputMode="decimal" placeholder="0" aria-label="0" value={nFibre} onChange={(e) => setNFibre(e.target.value)} />
                </Field>
                <Field label="Sugar g / 100g">
                  <Input inputMode="decimal" placeholder="0" aria-label="0" value={nSugar} onChange={(e) => setNSugar(e.target.value)} />
                </Field>
                <Field label="Sodium mg / 100g">
                  <Input inputMode="decimal" placeholder="0" aria-label="0" value={nSodium} onChange={(e) => setNSodium(e.target.value)} />
                </Field>
                <Field label="Sat fat g / 100g">
                  <Input inputMode="decimal" placeholder="0" aria-label="0" value={nSatFat} onChange={(e) => setNSatFat(e.target.value)} />
                </Field>
              </div>
            )}

            <Button full disabled={!newValid} onClick={() => { void saveNewFood() }}>
              Save as my food
            </Button>
          </div>
        )}
      </Sheet>

      {recipeEditor && (
        <RecipeSheet
          recipe={recipeEditor.recipe}
          catalog={catalog}
          profile={profile}
          onClose={() => setRecipeEditor(null)}
        />
      )}
    </>
  )
}
