// /saved — everything you've saved, in one place (v10.1, owner request):
// saved workouts (start again in one tap), starred exercises, favourite foods,
// saved meals and your programs. Nothing new is stored here — it gathers what
// is already saved across the app, plus the new saved workouts.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Play, Trash2 } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Section } from '@/components/ui'
import { ExerciseThumb } from '@/components/ExerciseThumb'
import { db, getActivePlan } from '@/db'
import { byId } from '@/data/exercises'
import { seedFoodById } from '@/data/foods'
import { dayjs } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import { deleteSavedWorkout, savedWorkouts, startSavedWorkout } from '@/lib/saved'
import type { ExerciseMetaPlus } from './exercises/shared'

export default function SavedScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const workouts = useLiveQuery(() => savedWorkouts(), []) ?? []
  const pinned = useLiveQuery(async () => (await db.exerciseMeta.toArray() as ExerciseMetaPlus[]).filter((m) => m.pinned).map((m) => m.exerciseId), []) ?? []
  const foods = useLiveQuery(async () => (await db.foods.toArray()).filter((f) => f.favourite), []) ?? []
  const meals = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? []
  const active = useLiveQuery(() => getActivePlan(), [])

  const empty = !workouts.length && !pinned.length && !foods.length && !meals.length
  return (
    <div className="pb-12">
      <PageHeader title="Saved" back subtitle="Workouts, exercises, foods, meals and programs you’ve kept." />

      {empty && (
        <Section><Card><EmptyState title="Nothing saved yet" subtitle="Tap ☆ on an exercise or food, save a meal, or tap “Save as template” when you finish a workout — it all shows up here." /></Card></Section>
      )}

      <Section title={`Saved workouts (${workouts.length})`}>
        {workouts.length === 0
          ? <p className="px-1 text-[12.5px] text-ink3">Finish a workout and tap <b>Save as template</b> to start it again any day.</p>
          : (
            <div className="space-y-2">
              {workouts.map((w) => (
                <Card key={w.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px]">{w.title}</b>
                    <span className="block truncate text-[12px] text-ink3">{w.exercises.length} exercises · {w.exercises.reduce((n, e) => n + e.sets.length, 0)} sets · saved {dayjs(w.savedAt).format('D MMM')}</span>
                    <span className="block truncate text-[11.5px] text-ink3">{w.exercises.slice(0, 4).map((e) => byId.get(e.exerciseId)?.name ?? e.exerciseId).join(' · ')}</span>
                  </div>
                  <Button small onClick={() => void startSavedWorkout(w).then((id) => { toast(`${w.title} — let’s go`); navigate(`/session/${id}`) })}><Play size={14} /> Start</Button>
                  <button type="button" aria-label={`Delete ${w.title}`} className="p-1.5 text-ink3" onClick={() => void deleteSavedWorkout(w.id).then(() => toast('Removed from saved'))}><Trash2 size={16} /></button>
                </Card>
              ))}
            </div>
          )}
      </Section>

      <Section title={`Starred exercises (${pinned.length})`}>
        {pinned.length === 0 ? <p className="px-1 text-[12.5px] text-ink3">Tap ☆ on any exercise to keep it here.</p> : (
          <div className="grid grid-cols-2 gap-2">
            {pinned.map((id) => { const ex = byId.get(id); return ex ? (
              <button key={id} type="button" onClick={() => navigate(`/exercise/${id}`)} className="pressable flex items-center gap-2 rounded-2xl bg-surface2 p-2 text-left shadow-card">
                <ExerciseThumb ex={ex} size={44} /><span className="line-clamp-2 text-[12.5px] font-semibold">{ex.name}</span>
              </button>
            ) : null })}
          </div>
        )}
      </Section>

      <Section title={`Favourite foods (${foods.length})`}>
        {foods.length === 0 ? <p className="px-1 text-[12.5px] text-ink3">Star a food in Add food to keep it one tap away.</p> : (
          <Card className="divide-y divide-line px-3.5">
            {foods.map((f) => <div key={f.id} className="flex justify-between py-2 text-[13px]"><span className="truncate">{f.name ?? seedFoodById.get(f.id)?.name}</span><span className="shrink-0 text-ink3">{Math.round(f.kcal)} kcal / 100 g</span></div>)}
          </Card>
        )}
        <Button small variant="secondary" className="mt-2" onClick={() => navigate('/food')}>Open Food</Button>
      </Section>

      <Section title={`Saved meals (${meals.length})`}>
        {meals.length === 0 ? <p className="px-1 text-[12.5px] text-ink3">Save a meal from Food (⋯ on a meal → Save as meal) or build a recipe.</p> : (
          <Card className="divide-y divide-line px-3.5">
            {meals.map((m) => <div key={m.id} className="flex justify-between py-2 text-[13px]"><span className="truncate">{m.favourite ? '★ ' : ''}{m.name}</span><span className="shrink-0 text-ink3">{m.useCount ?? 0}× logged</span></div>)}
          </Card>
        )}
      </Section>

      <Section title={`Your programs (${plans.length})`}>
        <Card className="divide-y divide-line px-3.5">
          {plans.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((p) => (
            <div key={p.id} className="flex justify-between py-2 text-[13px]"><span className="truncate">{p.name}</span><span className={`shrink-0 ${p.id === active?.id ? 'font-semibold text-emerald-400' : 'text-ink3'}`}>{p.id === active?.id ? 'in use' : `${p.weeks.length} wk`}</span></div>
          ))}
          {!plans.length && <p className="py-2 text-[12.5px] text-ink3">No programs yet.</p>}
        </Card>
        <div className="mt-2 flex gap-2">
          <Button small variant="secondary" onClick={() => navigate('/programs')}>Switch program</Button>
          <Button small variant="secondary" onClick={() => navigate('/plan/build')}>Build my own</Button>
        </div>
      </Section>
    </div>
  )
}
