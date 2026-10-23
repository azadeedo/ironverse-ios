// ============================================================
// GLOBAL SEARCH — one box over everything in the app.
//
// Entirely offline. The exercise registry and the seed food list are static
// modules; custom foods, recipes and past sessions come out of Dexie. The
// index is built once and cached, then refreshed when the Dexie row counts
// change, so typing stays instant on 300+ foods and 125+ exercises.
//
// Ranking is deliberately simple and predictable: exact name > name starts
// with > word starts with > substring. No fuzzy matching, because a lifter
// searching "dip" wants dips, not "dumbbell incline press".
// ============================================================

import { db } from '@/db'
import { halalMode, isHalalHidden } from '@/db/defaults'
import { EXERCISES, byId as exerciseById } from '@/data/exercises'
import { SEED_FOODS } from '@/data/foods'
import { MUSCLE_LABELS, equipmentLabel } from '@/db/types'
import type { Profile } from '@/db/types'
import { dayjs } from './fmt'

// ---------- result shape ----------

export type SearchGroup = 'exercise' | 'food' | 'session' | 'recipe' | 'setting'

export const GROUP_LABELS: Record<SearchGroup, string> = {
  exercise: 'Exercises',
  food: 'Foods',
  session: 'Past sessions',
  recipe: 'Recipes',
  setting: 'Settings & screens',
}

/** Order groups appear in the results list. */
export const GROUP_ORDER: SearchGroup[] = ['exercise', 'food', 'session', 'setting', 'recipe']

export interface SearchItem {
  key: string
  group: SearchGroup
  title: string
  subtitle?: string
  /** where tapping it goes */
  to: string
  /** lower-cased haystack — name first, then supporting words */
  haystack: string
  /** nudges genuinely-used things up when scores tie (use count, recency) */
  weight: number
}

export interface SearchHit extends SearchItem {
  score: number
}

export interface GroupedResults {
  group: SearchGroup
  label: string
  hits: SearchHit[]
  /** hits beyond the per-group cap */
  more: number
}

// ---------- settings / screen destinations ----------
// Section ids here MUST match the `id` attributes on SettingsScreen sections,
// so search and the in-page settings filter agree on what exists.

export interface SettingsTarget {
  id: string
  title: string
  subtitle: string
  /** extra words people actually type when looking for it */
  keywords: string
  to: string
}

export const SETTINGS_TARGETS: SettingsTarget[] = [
  { id: 'profile', title: 'Profile', subtitle: 'Name, sex, body stats, goal, experience', keywords: 'name age height weight birth year sex male female goal lose fat build muscle recomp activity experience beginner intermediate advanced', to: '/settings?s=profile' },
  { id: 'targets', title: 'Daily targets', subtitle: 'Calories, protein, water, creatine', keywords: 'calories kcal kilojoules protein water litres creatine grams macro target', to: '/settings?s=targets' },
  { id: 'training-week', title: 'Training week', subtitle: 'Days per week, session length, preferred slot', keywords: 'days per week session length minutes morning after work evening slot schedule', to: '/settings?s=training-week' },
  { id: 'work-schedule', title: 'Work schedule', subtitle: 'Working hours per day', keywords: 'work hours shift roster start end job', to: '/settings?s=work-schedule' },
  { id: 'equipment', title: 'Equipment', subtitle: 'Bar weights, plate pairs, cable stack steps', keywords: 'barbell curl bar smith plates stack cable kg gear garage', to: '/settings?s=equipment' },
  { id: 'food-energy', title: 'Food & energy', subtitle: 'Halal mode and kcal / kJ display', keywords: 'halal pork alcohol energy unit kilojoules calories kj display', to: '/settings?s=food-energy' },
  { id: 'calorie-target', title: 'Calorie target', subtitle: 'Adaptive calories from real weight change', keywords: 'adaptive calories tdee deficit surplus auto adjust', to: '/settings?s=calorie-target' },
  { id: 'ramadan', title: 'Ramadan', subtitle: 'Suhoor, iftar and the training window', keywords: 'ramadan fasting suhoor iftar taraweeh fast maintenance', to: '/settings?s=ramadan' },
  { id: 'prayer', title: 'Prayer times', subtitle: 'Fajr to isha, with a buffer around each', keywords: 'prayer salah fajr dhuhr asr maghrib isha buffer', to: '/settings?s=prayer' },
  { id: 'feedback', title: 'Haptics & sound', subtitle: 'Vibration and tones per category', keywords: 'haptics vibration buzz sound beep tone audio feedback silent', to: '/settings?s=feedback' },
  { id: 'display', title: 'Display', subtitle: 'App text size', keywords: 'font size text bigger larger smaller display accessibility readable zoom', to: '/settings?s=display' },
  { id: 'health', title: 'App health & storage', subtitle: 'Space used, rows per table, last backup', keywords: 'storage space indexeddb database size rows health backup snapshot export disk', to: '/settings?s=health' },
  { id: 'ai', title: 'Photo calorie estimate', subtitle: 'Anthropic API key for meal photos', keywords: 'ai api key anthropic photo estimate camera meal', to: '/settings?s=ai' },
  { id: 'privacy', title: 'Privacy', subtitle: 'Face ID / Touch ID app lock', keywords: 'privacy face id touch id lock passcode biometric secure', to: '/settings?s=privacy' },
  { id: 'reminders', title: 'Reminders', subtitle: 'Water, creatine and workout alerts', keywords: 'reminders notifications alerts water creatine workout time interval', to: '/settings?s=reminders' },
  { id: 'data', title: 'Data', subtitle: 'Export, restore and erase', keywords: 'export backup restore merge replace erase delete everything json data', to: '/settings?s=data' },
  { id: 'about', title: 'About', subtitle: 'Version and re-run setup', keywords: 'about version setup onboarding re-run offline', to: '/settings?s=about' },
]

/** Screens that aren't settings sections but people still hunt for by name. */
const SCREEN_TARGETS: { title: string; subtitle: string; keywords: string; to: string }[] = [
  { title: 'Achievements', subtitle: 'Milestones you have actually earned', keywords: 'achievements milestones badges streak records trophies', to: '/achievements' },
  { title: "What's new", subtitle: 'Everything added to the app, in order', keywords: 'whats new changelog features updates release notes', to: '/whats-new' },
  { title: 'Backup', subtitle: 'Export, restore and snapshots', keywords: 'backup export restore snapshot json safety', to: '/backup' },
  { title: 'Progress photos', subtitle: 'Side-by-side, stored on this device', keywords: 'photos progress camera pictures front side back', to: '/photos' },
  { title: 'Weekly review', subtitle: 'How the week actually went', keywords: 'weekly review week summary recap', to: '/review' },
  { title: 'Prayer times & Qibla', subtitle: 'Live prayer times, reminders and Qibla compass (Halal mode)', keywords: 'prayer salah salat namaz adhan azan qibla kiblah fajr dhuhr asr maghrib isha hijri muslim islam', to: '/prayer' },
  { title: 'Saved', subtitle: 'Saved workouts, starred exercises, favourite foods, meals', keywords: 'saved save template favourite favorites starred bookmark', to: '/saved' },
  { title: 'Fasting timer', subtitle: 'Intermittent fasting 13:11 to 20:4', keywords: 'fasting fast intermittent 16:8 18:6 omad timer window', to: '/fasting' },
  { title: 'Sleep & recovery', subtitle: 'Rate last night, Apple Watch sleep, recovery score', keywords: 'sleep bed tired recovery hrv rest night insomnia nap', to: '/sleep' },
  { title: 'Coach programs', subtitle: 'Inspired by Bumstead, Nippard, Arnold, Mentzer, Yates', keywords: 'coach programs cbum chris bumstead nippard jeff arnold schwarzenegger mike mentzer heavy duty dorian yates blood guts hit block', to: '/programs' },
  { title: 'Cardio', subtitle: 'Runs, walks and rope', keywords: 'cardio run walk jump rope treadmill steps', to: '/cardio' },
  { title: 'Water & creatine', subtitle: 'Logs and reminders', keywords: 'water hydration creatine drink litres supplement', to: '/hydration' },
  { title: 'Exercise library', subtitle: 'Every exercise, with form cues', keywords: 'exercise library list arsenal movements', to: '/exercises' },
  { title: 'Plan settings', subtitle: 'Weeks, rebuild and training days', keywords: 'plan program weeks rebuild generate training days', to: '/plan' },
  { title: 'Progress', subtitle: 'Weight, strength and volume', keywords: 'progress charts weight strength volume graphs', to: '/progress' },
]

// ---------- index building ----------

interface IndexSnapshot {
  items: SearchItem[]
  /** row-count fingerprint; a change means rebuild */
  fingerprint: string
}

let cached: IndexSnapshot | null = null
let building: Promise<IndexSnapshot> | null = null

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function staticItems(): SearchItem[] {
  const out: SearchItem[] = []

  for (const ex of EXERCISES) {
    const muscles = ex.primary.map((m) => MUSCLE_LABELS[m]).join(' ')
    const kit = ex.equipment.map((e) => equipmentLabel(e)).join(' ')
    out.push({
      key: `exercise:${ex.id}`,
      group: 'exercise',
      title: ex.name,
      subtitle: [ex.primary.map((m) => MUSCLE_LABELS[m]).join(', '), kit].filter(Boolean).join(' · '),
      to: `/exercise/${ex.id}`,
      haystack: norm(`${ex.name} ${muscles} ${kit} ${ex.kind}`),
      weight: 0,
    })
  }

  for (const t of SETTINGS_TARGETS) {
    out.push({
      key: `setting:${t.id}`,
      group: 'setting',
      title: t.title,
      subtitle: t.subtitle,
      to: t.to,
      haystack: norm(`${t.title} ${t.subtitle} ${t.keywords}`),
      weight: 0,
    })
  }

  for (const s of SCREEN_TARGETS) {
    out.push({
      key: `screen:${s.to}`,
      group: 'setting',
      title: s.title,
      subtitle: s.subtitle,
      to: s.to,
      haystack: norm(`${s.title} ${s.subtitle} ${s.keywords}`),
      weight: 0,
    })
  }

  return out
}

async function buildIndex(): Promise<IndexSnapshot> {
  const [customFoods, recipes, logs, profile] = await Promise.all([
    db.foods.toArray(),
    db.recipes.toArray(),
    db.workoutLogs.toArray(),
    db.profile.get('me'),
  ])

  const fingerprint = [customFoods.length, recipes.length, logs.length].join('/')
  const items = staticItems()
  const halal = halalMode(profile as Profile | undefined)

  // ---- foods: seed list + custom, custom wins on an id clash ----
  const customIds = new Set(customFoods.map((f) => f.id))
  const foods = [
    ...customFoods,
    ...SEED_FOODS.filter((f) => !customIds.has(f.id)),
  ]
  for (const f of foods) {
    if (isHalalHidden(f, halal)) continue
    const brand = f.brand ? `${f.brand} ` : ''
    items.push({
      key: `food:${f.id}`,
      group: 'food',
      title: f.name,
      subtitle: `${brand}${Math.round(f.kcal)} cal · ${Math.round(f.protein)}g protein per 100g`,
      to: `/food?q=${encodeURIComponent(f.name)}`,
      haystack: norm(`${f.name} ${f.brand ?? ''}`),
      weight: (f.useCount ?? 0) * 2 + (f.favourite ? 12 : 0) + (f.custom ? 4 : 0),
    })
  }

  // ---- recipes ----
  for (const r of recipes) {
    items.push({
      key: `recipe:${r.id}`,
      group: 'recipe',
      title: r.name,
      subtitle: `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? '' : 's'} · ${r.servings} serve${r.servings === 1 ? '' : 's'}`,
      to: `/food?q=${encodeURIComponent(r.name)}`,
      haystack: norm(`${r.name} ${r.ingredients.map((i) => i.name).join(' ')}`),
      weight: (r.useCount ?? 0) * 2 + (r.favourite ? 12 : 0),
    })
  }

  // ---- past sessions ----
  const todayMs = Date.now()
  for (const log of logs) {
    const names = log.exercises
      .map((e) => exerciseById.get(e.exerciseId)?.name ?? e.exerciseId)
      .filter(Boolean)
    const done = log.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => s.done).length,
      0,
    )
    const ageDays = Math.max(0, Math.round((todayMs - dayjs(log.date).valueOf()) / 86_400_000))
    items.push({
      key: `session:${log.id}`,
      group: 'session',
      title: log.title,
      subtitle: `${dayjs(log.date).format('ddd D MMM YYYY')} · ${done} set${done === 1 ? '' : 's'}`,
      to: `/session/${log.id}`,
      haystack: norm(`${log.title} ${names.join(' ')} ${log.date} ${dayjs(log.date).format('MMMM YYYY')} ${log.notes ?? ''}`),
      // recent sessions matter more than ancient ones
      weight: Math.max(0, 30 - ageDays / 7),
    })
  }

  return { items, fingerprint }
}

/** Build (or reuse) the index. Safe to call on every keystroke. */
export async function getIndex(): Promise<SearchItem[]> {
  if (cached) return cached.items
  if (!building) {
    building = buildIndex()
      .then((snap) => { cached = snap; return snap })
      .finally(() => { building = null })
  }
  const snap = await building
  return snap.items
}

/** Drop the cache — call after logging a session, adding a food, etc. */
export function invalidateIndex(): void {
  cached = null
}

/** Cheap freshness check: rebuild only when the row counts moved. */
export async function refreshIndexIfStale(): Promise<void> {
  if (!cached) return
  const [foods, recipes, logs] = await Promise.all([
    db.foods.count(), db.recipes.count(), db.workoutLogs.count(),
  ])
  if ([foods, recipes, logs].join('/') !== cached.fingerprint) invalidateIndex()
}

// ---------- matching ----------

const NAME_EXACT = 1000
const NAME_PREFIX = 600
const WORD_PREFIX = 400
const SUBSTRING = 150

function scoreOne(item: SearchItem, term: string): number {
  const hay = item.haystack
  const name = hay.split(' ')

  if (hay === term) return NAME_EXACT
  if (hay.startsWith(term)) return NAME_PREFIX
  if (name.some((w) => w.startsWith(term))) return WORD_PREFIX
  const at = hay.indexOf(term)
  if (at >= 0) return SUBSTRING - Math.min(100, at)
  return 0
}

/**
 * Score an item against a whole query. Every term must match something, so
 * "incline dumbbell" narrows rather than widens.
 */
export function scoreItem(item: SearchItem, terms: string[]): number {
  let total = 0
  for (const t of terms) {
    const s = scoreOne(item, t)
    if (s === 0) return 0
    total += s
  }
  return total / terms.length + item.weight
}

export interface SearchOptions {
  /** max hits shown per group before "show all" */
  perGroup?: number
  /** restrict to one group */
  only?: SearchGroup | null
}

/** Run a query over a prepared index. Pure and synchronous. */
export function runSearch(
  items: SearchItem[],
  query: string,
  opts: SearchOptions = {},
): GroupedResults[] {
  const perGroup = opts.perGroup ?? 6
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const buckets = new Map<SearchGroup, SearchHit[]>()
  for (const item of items) {
    if (opts.only && item.group !== opts.only) continue
    const score = scoreItem(item, terms)
    if (score <= 0) continue
    const list = buckets.get(item.group)
    if (list) list.push({ ...item, score })
    else buckets.set(item.group, [{ ...item, score }])
  }

  const out: GroupedResults[] = []
  for (const group of GROUP_ORDER) {
    const list = buckets.get(group)
    if (!list?.length) continue
    list.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    out.push({
      group,
      label: GROUP_LABELS[group],
      hits: list.slice(0, perGroup),
      more: Math.max(0, list.length - perGroup),
    })
  }
  return out
}

export function totalHits(groups: GroupedResults[]): number {
  return groups.reduce((n, g) => n + g.hits.length + g.more, 0)
}

/** Filter the settings section list for the in-page Settings filter box. */
export function matchSettingsSections(query: string): Set<string> | null {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return null
  const ids = new Set<string>()
  for (const t of SETTINGS_TARGETS) {
    const hay = norm(`${t.title} ${t.subtitle} ${t.keywords}`)
    if (terms.every((term) => hay.includes(term))) ids.add(t.id)
  }
  return ids
}
