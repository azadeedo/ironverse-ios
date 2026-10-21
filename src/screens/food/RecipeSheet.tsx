// ============================================================
// RECIPE BUILDER — build a meal out of several foods with quantities, save it
// as one item ("My shawarma bowl"), then log the whole thing in one tap.
// Editable later; macros always recompute from the ingredients, so a recipe
// can never drift out of step with what's actually in it.
// ============================================================

import { useMemo, useState } from 'react'
import { Check, Plus, Search, Trash2, X } from 'lucide-react'
import {
  Button, Card, ConfirmDialog, Field, Input, SearchBar, Sheet,
} from '@/components/ui'
import { db } from '@/db'
import { energyUnit, halalMode } from '@/db/defaults'
import type { Profile, Recipe, RecipeIngredient } from '@/db/types'
import { fmtEnergy } from '@/lib/energy'
import { filterHalal } from '@/lib/halal'
import { newId, nowIso } from '@/lib/id'
import { useUI } from '@/lib/store'
import type { CatalogFood } from './helpers'

export interface RecipeSheetProps {
  /** null = creating a new recipe */
  recipe: Recipe | null
  catalog: CatalogFood[]
  profile?: Profile
  onClose: () => void
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Scale a catalog food to a gram amount. */
function ingredientFrom(food: CatalogFood, grams: number): RecipeIngredient {
  const f = grams / 100
  return {
    foodId: food.id,
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * f),
    protein: round1(food.protein * f),
    carbs: round1(food.carbs * f),
    fat: round1(food.fat * f),
  }
}

export function totalsOf(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
      grams: acc.grams + i.grams,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  )
}

export function RecipeSheet({ recipe, catalog, profile, onClose }: RecipeSheetProps) {
  const { toast } = useUI()
  const unit = energyUnit(profile)
  const halal = halalMode(profile)

  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? 1)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients ?? [])
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [pendingFood, setPendingFood] = useState<CatalogFood | null>(null)
  const [pendingGrams, setPendingGrams] = useState('100')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const totals = useMemo(() => totalsOf(ingredients), [ingredients])
  const perServe = useMemo(() => {
    const s = Math.max(1, servings)
    return {
      kcal: Math.round(totals.kcal / s),
      protein: round1(totals.protein / s),
      carbs: round1(totals.carbs / s),
      fat: round1(totals.fat / s),
    }
  }, [totals, servings])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = filterHalal(catalog, halal)
    if (!q) {
      return [...pool].sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0)).slice(0, 25)
    }
    return pool
      .filter((f) => f.name.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q))
      .slice(0, 40)
  }, [catalog, query, halal])

  const addPending = () => {
    if (!pendingFood) return
    const grams = parseFloat(pendingGrams)
    if (!isFinite(grams) || grams <= 0) return
    setIngredients((prev) => [...prev, ingredientFrom(pendingFood, grams)])
    setPendingFood(null)
    setPendingGrams('100')
    setQuery('')
    setPicking(false)
  }

  const removeAt = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  const changeGrams = (idx: number, grams: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) => {
        if (i !== idx || !isFinite(grams) || grams <= 0) return ing
        // rescale from the ingredient's own per-gram values so edits never drift
        const per = ing.grams > 0 ? 1 / ing.grams : 0
        return {
          ...ing,
          grams,
          kcal: Math.round(ing.kcal * per * grams),
          protein: round1(ing.protein * per * grams),
          carbs: round1(ing.carbs * per * grams),
          fat: round1(ing.fat * per * grams),
        }
      }),
    )
  }

  const save = async () => {
    const title = name.trim()
    if (!title) {
      toast('Give it a name first', 'error')
      return
    }
    if (ingredients.length === 0) {
      toast('Add at least one food', 'error')
      return
    }
    const ts = nowIso()
    if (recipe) {
      await db.recipes.put({
        ...recipe,
        name: title,
        servings: Math.max(1, servings),
        ingredients,
        updatedAt: ts,
      })
      toast('Recipe updated')
    } else {
      await db.recipes.put({
        id: newId(),
        name: title,
        servings: Math.max(1, servings),
        ingredients,
        useCount: 0,
        createdAt: ts,
        updatedAt: ts,
      })
      toast('Recipe saved')
    }
    onClose()
  }

  const remove = async () => {
    if (!recipe) return
    await db.recipes.delete(recipe.id)
    toast('Recipe deleted')
    onClose()
  }

  return (
    <>
      <Sheet open onClose={onClose} title={recipe ? 'Edit recipe' : 'New recipe'} tall>
        <div className="space-y-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My shawarma bowl"
              autoFocus={!recipe}
            />
          </Field>

          <Field label="Makes how many serves?" hint="Logging adds one serve at a time.">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="pressable h-11 w-11 rounded-xl bg-surface3 text-[20px] font-semibold text-ink"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
              >
                −
              </button>
              <div className="big-num min-w-[2.5rem] text-center text-[22px] text-ink">{servings}</div>
              <button
                type="button"
                className="pressable h-11 w-11 rounded-xl bg-surface3 text-[20px] font-semibold text-ink"
                onClick={() => setServings((s) => Math.min(20, s + 1))}
              >
                +
              </button>
            </div>
          </Field>

          {/* ---- ingredients ---- */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-ink">
                Ingredients {ingredients.length > 0 && <span className="text-ink3">· {ingredients.length}</span>}
              </div>
              <button
                type="button"
                className="flex items-center gap-1 text-[13px] font-semibold text-brand"
                onClick={() => setPicking(true)}
              >
                <Plus size={15} /> Add food
              </button>
            </div>

            {ingredients.length === 0 ? (
              <Card className="p-4 text-[13px] text-ink3">
                Nothing in it yet. Add the foods that make up this meal and the macros work
                themselves out.
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {ingredients.map((ing, idx) => (
                  <div key={`${ing.foodId ?? ing.name}-${idx}`} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-ink">{ing.name}</div>
                      <div className="text-[12px] text-ink3">
                        {fmtEnergy(ing.kcal, unit)} · {ing.protein}g P
                      </div>
                    </div>
                    <input
                      inputMode="decimal"
                      value={String(ing.grams)}
                      onChange={(e) => changeGrams(idx, parseFloat(e.target.value))}
                      className="w-16 rounded-lg border border-line bg-surface2 px-2 py-1.5 text-center text-[14px] text-ink outline-none focus:border-brand"
                      aria-label={`${ing.name} grams`}
                    />
                    <span className="text-[12px] text-ink3">g</span>
                    <button
                      type="button"
                      aria-label={`Remove ${ing.name}`}
                      className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-surface3 text-ink3"
                      onClick={() => removeAt(idx)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* ---- totals ---- */}
          {ingredients.length > 0 && (
            <Card className="p-4">
              <div className="mb-1 text-[12px] uppercase tracking-wide text-ink3">Per serve</div>
              <div className="big-num text-[24px] text-ink">{fmtEnergy(perServe.kcal, unit)}</div>
              <div className="mt-1 text-[13px] text-ink2">
                {perServe.protein}g protein · {perServe.carbs}g carbs · {perServe.fat}g fat
              </div>
              {servings > 1 && (
                <div className="mt-2 border-t border-line pt-2 text-[12px] text-ink3">
                  Whole recipe: {fmtEnergy(totals.kcal, unit)} · {round1(totals.protein)}g protein ·{' '}
                  {Math.round(totals.grams)}g total
                </div>
              )}
            </Card>
          )}

          <div className="flex gap-2">
            {recipe && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} />
              </Button>
            )}
            <Button full onClick={save}>
              <Check size={17} /> {recipe ? 'Save changes' : 'Save recipe'}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* ---- food picker ---- */}
      <Sheet open={picking} onClose={() => { setPicking(false); setPendingFood(null) }} title="Add a food" tall>
        {pendingFood ? (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-[15px] font-semibold text-ink">{pendingFood.name}</div>
              <div className="mt-0.5 text-[12px] text-ink3">
                {fmtEnergy(pendingFood.kcal, unit)} · {pendingFood.protein}g P per 100g
              </div>
            </Card>
            <Field label="How much?">
              <div className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  value={pendingGrams}
                  onChange={(e) => setPendingGrams(e.target.value)}
                  autoFocus
                />
                <span className="text-[14px] text-ink3">g</span>
              </div>
            </Field>
            {pendingFood.servingGrams && pendingFood.servingName && (
              <button
                type="button"
                className="text-[13px] font-semibold text-brand"
                onClick={() => setPendingGrams(String(pendingFood.servingGrams))}
              >
                Use 1 {pendingFood.servingName} ({pendingFood.servingGrams}g)
              </button>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" full onClick={() => setPendingFood(null)}>
                <X size={16} /> Back
              </Button>
              <Button full onClick={addPending}>
                <Plus size={16} /> Add
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <SearchBar value={query} onChange={setQuery} placeholder="Search foods" autoFocus />
            <Card className="mt-3 divide-y divide-line">
              {results.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-ink3">
                  <Search size={15} /> Nothing matches that.
                </div>
              ) : (
                results.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() => {
                      setPendingFood(f)
                      setPendingGrams(String(f.servingGrams ?? 100))
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] text-ink">{f.name}</span>
                      <span className="block text-[12px] text-ink3">
                        {fmtEnergy(f.kcal, unit)} · {f.protein}g P per 100g
                      </span>
                    </span>
                    <Plus size={16} className="shrink-0 text-brand" />
                  </button>
                ))
              )}
            </Card>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this recipe?"
        message="Meals you've already logged from it stay in your history."
        confirmLabel="Delete"
      />
    </>
  )
}

export default RecipeSheet
