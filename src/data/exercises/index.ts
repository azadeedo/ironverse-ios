// Exercise registry. Agents add exercises in the per-group files; everything
// merges here. Reference examples live in _reference.ts — copy their pose style.

import type { CustomExercise, Exercise, LoadMode, Muscle } from '@/db/types'
import { REFERENCE_EXERCISES } from './_reference'
import { CHEST_SHOULDERS_TRICEPS } from './push'
import { BACK_BICEPS } from './pull'
import { LEGS_CORE_CARDIO } from './legs'
import { GYM_EXERCISES } from './gym'
import { GYM_MACHINES_2 } from './gym2'
import { GYM_MACHINES_3 } from './gym3'
import { PROGRAM_EXERCISES } from './program'

export const EXERCISES: Exercise[] = dedupe([
  ...REFERENCE_EXERCISES,
  ...CHEST_SHOULDERS_TRICEPS,
  ...BACK_BICEPS,
  ...LEGS_CORE_CARDIO,
  ...GYM_EXERCISES,
  ...GYM_MACHINES_2,
  ...GYM_MACHINES_3,
  ...PROGRAM_EXERCISES,
])

function dedupe(list: Exercise[]): Exercise[] {
  const seen = new Set<string>()
  return list.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

export const byId = new Map(EXERCISES.map((e) => [e.id, e]))

export function exercisesFor(muscle: Muscle): Exercise[] {
  return EXERCISES.filter((e) => e.primary.includes(muscle) || e.secondary.includes(muscle))
}

export function alternativesFor(id: string): Exercise[] {
  const ex = byId.get(id)
  if (!ex) return []
  const listed = (ex.alternatives ?? []).map((a) => byId.get(a)).filter(Boolean) as Exercise[]
  if (listed.length >= 3) return listed
  // fall back to same-primary-muscle exercises
  const same = EXERCISES.filter(
    (e) => e.id !== id && e.kind === ex.kind && e.primary.some((m) => ex.primary.includes(m)),
  )
  return dedupe([...listed, ...same]).slice(0, 6)
}

// ---------- v6: user-created exercises and machines ----------
// Custom exercises live in Dexie (db.customExercises). They are merged into this
// registry at boot and whenever one is added, so every screen that looks an
// exercise up by id — sessions, history, PRs, volume — treats them the same.

const CATEGORY_LOAD: Record<CustomExercise['category'], LoadMode> = {
  barbell: 'barbell', dumbbell: 'stack', cable: 'stack', smith: 'smith', 'plate-loaded': 'stack',
  selectorised: 'stack', bodyweight: 'bodyweight', cardio: 'time', machine: 'stack', other: 'stack',
}

export function customToExercise(c: CustomExercise): Exercise {
  return {
    id: c.id,
    name: c.name,
    kind: c.category === 'cardio' ? 'cardio' : 'strength',
    equipment: c.category === 'bodyweight' ? ['bodyweight'] : c.category === 'barbell' ? ['barbell'] : ['plate-loaded-machine'],
    primary: c.primary.length ? c.primary : ['full-body'],
    secondary: c.secondary,
    loadMode: CATEGORY_LOAD[c.category] ?? 'stack',
    repRange: [8, 12],
    instructions: [c.machine ? `Machine: ${c.machine}.` : 'Your own exercise.', ...(c.notes ? [c.notes] : [])],
    anim: { prop: 'none', poses: [{}] },
    custom: true,
  } as Exercise & { custom: true }
}

export function registerCustomExercises(list: CustomExercise[]): void {
  for (const c of list) {
    const ex = customToExercise(c)
    const at = EXERCISES.findIndex((e) => e.id === c.id)
    if (at >= 0) EXERCISES[at] = ex
    else EXERCISES.push(ex)
    byId.set(ex.id, ex)
  }
}

export function isCustomExercise(id: string): boolean {
  return (byId.get(id) as (Exercise & { custom?: boolean }) | undefined)?.custom === true
}
