// Virtual 7-day pill box (4 compartments a day, like his Surgical Basics box):
// what goes in which compartment, what's been taken, how many are left,
// when to reorder, and what missing a supplement actually means.
// Supplements only. Everything is stored on this phone (settings table).
import dayjs from 'dayjs'
import { db, getSetting, setSetting } from '@/db'
import { newId } from '@/lib/id'

export type Slot = 'morn' | 'noon' | 'eve' | 'bed'
export const SLOTS: Slot[] = ['morn', 'noon', 'eve', 'bed']
export const SLOT_LABEL: Record<Slot, string> = { morn: 'Morning', noon: 'Noon', eve: 'Evening', bed: 'Bed' }
/** his box runs Sunday → Saturday */
export const BOX_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export type DayRule = 'daily' | 'training' | 'rest' | 'weekly' | 'asneeded'
export interface DoseItem {
  id: string
  name: string
  /** per compartment, e.g. 1 capsule */
  count: number
  unit: string
  slots: Slot[]
  rule: DayRule
  /** for weekly: which day (0 = Sunday) */
  weekday?: number
  note?: string
  colour: string
  /** capsules / tablets / serves left */
  stock?: number
  stockAt?: string
  /** how long delivery takes, days */
  leadDays?: number
  /** key into MISS_EVIDENCE */
  kind?: string
  paused?: boolean
}
export interface DosetteState { items: DoseItem[]; trainingDays: number[]; taken: Record<string, string[]>; startedAt?: string }

const KEY = 'dosette-v1'
const T = (id: string, name: string, count: number, unit: string, slots: Slot[], rule: DayRule, colour: string, note: string, kind: string, extra: Partial<DoseItem> = {}): DoseItem =>
  ({ id, name, count, unit, slots, rule, colour, note, kind, leadDays: 7, ...extra })

/** his shelf, from the photos (14 Oct 2026). Timings follow the label and the evidence notes below — all editable. */
export const STARTER: DoseItem[] = [
  T('creatine', 'Creatine monohydrate (Musashi)', 5, 'g', ['morn'], 'daily', '#e5e7eb', 'Any time of day — consistency matters, not timing. With water.', 'creatine', { stock: 70, unit: 'g' }),
  T('d3k2', 'Vitamin D3 + K2 (NOW, 1,000 IU)', 1, 'capsule', ['morn'], 'daily', '#f97316', 'With breakfast — D3 and K2 absorb better with fat.', 'vitd'),
  T('d3-50k', 'Vitamin D3 50,000 IU (California Gold)', 1, 'softgel', ['morn'], 'weekly', '#facc15', 'ONCE A WEEK only — this is a high-potency weekly dose. Check with your GP that weekly plus the daily D3/K2 is right for you.', 'vitd', { weekday: 0 }),
  T('bcomplex', 'B-Complex (Life Extension)', 1, 'capsule', ['morn'], 'daily', '#1e3a8a', 'Morning with food — B vitamins can feel energising and turn urine bright yellow (normal).', 'bvit'),
  T('taurine', 'Taurine 1,000 mg (NOW)', 1, 'capsule', ['morn'], 'daily', '#ffffff', 'Morning. Some take it pre-workout instead.', 'taurine'),
  T('uppers', 'Uppers (energy / thermogenic)', 1, 'capsule', ['morn'], 'daily', '#dc2626', 'Morning with food — it is a stimulant-type formula, keep it away from bedtime.', 'stim'),
  T('zinc', 'Zinc + Copper (Solaray)', 1, 'capsule', ['noon'], 'daily', '#fde68a', 'With lunch — zinc on an empty stomach can cause nausea. Kept apart from magnesium.', 'zinc'),
  T('omega3', 'Omega-3 mini (Blackmores)', 2, 'capsule', ['noon'], 'daily', '#b45309', 'With a meal that has some fat.', 'omega3'),
  T('defender', 'L&O Defender (5% Nutrition)', 1, 'capsule', ['noon'], 'daily', '#d1d5db', 'With food — follow the label serve.', 'liver'),
  T('electro', 'Essential Electrolytes (NutriBiotic)', 1, 'capsule', ['eve'], 'training', '#60a5fa', 'Training days, before or during the session — more if you sweat a lot.', 'electro'),
  T('lcarn', 'L-carnitine', 1, 'serve', ['morn'], 'daily', '#a3e635', 'Morning (fasted) and before training on gym days.', 'carnitine'),
  T('lcarn-pre', 'L-carnitine (pre-training)', 1, 'serve', ['eve'], 'training', '#a3e635', 'Before training on gym days.', 'carnitine'),
  T('magnesium', 'Magnesium glycinate 350 mg (Solaray)', 2, 'capsule', ['bed'], 'daily', '#f5f5f4', 'At night — glycinate is gentle on the stomach and may help sleep.', 'magnesium'),
  T('melatonin', 'Melatonin 5 mg (21st Century)', 1, 'tablet', ['bed'], 'asneeded', '#7c3aed', 'Only on nights you need it, 30–60 min before bed. Not every night.', 'melatonin'),
  T('fibre', 'Metamucil fibre gummies', 2, 'gummy', ['noon'], 'asneeded', '#fb923c', 'Only on low-fibre days — the app suggests it when your logged fibre is under 25 g.', 'fibre'),
]

export async function loadDosette(): Promise<DosetteState> {
  const s = await getSetting<DosetteState | null>(KEY, null)
  if (s) { if (!s.startedAt) { s.startedAt = dayjs().format('YYYY-MM-DD'); await setSetting(KEY, s) } return s }
  const fresh: DosetteState = { items: STARTER.map((x) => ({ ...x, stockAt: x.stock ? dayjs().format('YYYY-MM-DD') : undefined })), trainingDays: [2, 3, 4, 5], taken: {}, startedAt: dayjs().format('YYYY-MM-DD') }
  await setSetting(KEY, fresh)
  return fresh
}
export const saveDosette = (s: DosetteState) => setSetting(KEY, s)

/** does this item belong in this day's compartments? */
export function onDay(it: DoseItem, weekday: number, training: number[]): boolean {
  if (it.paused) return false
  if (it.rule === 'daily') return true
  if (it.rule === 'training') return training.includes(weekday)
  if (it.rule === 'rest') return !training.includes(weekday)
  if (it.rule === 'weekly') return weekday === (it.weekday ?? 0)
  return false // as needed: never pre-filled
}
export function compartment(items: DoseItem[], weekday: number, slot: Slot, training: number[]): DoseItem[] {
  return items.filter((it) => it.slots.includes(slot) && onDay(it, weekday, training))
}

/** per week: how many of each to put in the box */
export function weeklyFill(items: DoseItem[], training: number[]): { item: DoseItem; total: number }[] {
  return items.map((item) => ({ item, total: BOX_DAYS.reduce((n, d) => n + (onDay(item, d, training) ? item.slots.length * item.count : 0), 0) })).filter((x) => x.total > 0)
}

export const takenKey = (date: string, slot: Slot) => `${date}|${slot}`
export function isTaken(s: DosetteState, date: string, slot: Slot, id: string) { return (s.taken[takenKey(date, slot)] ?? []).includes(id) }

/** days of stock left from the weekly use */
export function stockStatus(it: DoseItem, training: number[], today = dayjs().format('YYYY-MM-DD')) {
  if (it.stock === undefined) return null
  const perWeek = BOX_DAYS.reduce((n, d) => n + (onDay(it, d, training) ? it.slots.length * it.count : 0), 0)
  if (!perWeek) return { daysLeft: Infinity, runOut: null as string | null, orderBy: null as string | null, level: 'fine' as const, left: it.stock }
  // units used since the count was entered
  const since = it.stockAt ? Math.max(0, dayjs(today).diff(dayjs(it.stockAt), 'day')) : 0
  const left = Math.max(0, it.stock - (perWeek / 7) * since)
  const daysLeft = Math.floor(left / (perWeek / 7))
  const runOut = dayjs(today).add(daysLeft, 'day').format('YYYY-MM-DD')
  const orderBy = dayjs(runOut).subtract(it.leadDays ?? 7, 'day').format('YYYY-MM-DD')
  const level = daysLeft <= (it.leadDays ?? 7) ? 'now' as const : daysLeft <= (it.leadDays ?? 7) + 14 ? 'soon' as const : 'fine' as const
  return { daysLeft, runOut, orderBy, level, left: Math.round(left) }
}

/** what missing it means, from the research */
export const MISS_EVIDENCE: Record<string, { one: string; streak: string; days: number }> = {
  creatine: { one: 'Missing a day is not a big deal — muscle creatine stays high for weeks.', streak: 'After stopping, muscle creatine drifts back to baseline over about 4–6 weeks (Hultman et al. 1996), taking some of the strength and training-volume benefit with it. Get back to 5 g a day — no need to reload.', days: 4 },
  vitd: { one: 'Vitamin D builds up slowly; one missed day changes nothing.', streak: 'Blood vitamin D falls over weeks of missed doses. Low levels are linked with weaker bones, immunity and mood — and in winter you make little from sun.', days: 10 },
  bvit: { one: 'Water-soluble — you just pee out the excess; one day doesn’t matter.', streak: 'Most people get enough B vitamins from food; missing for a while matters mainly if your diet is low in meat, eggs or dairy.', days: 7 },
  taurine: { one: 'No effect from a single missed day.', streak: 'Your body makes taurine and you eat it in meat and fish — little risk from missing it.', days: 14 },
  stim: { one: 'No effect — and fine to skip on rest days.', streak: 'Stimulant-type formulas lose effect with daily use anyway; breaks help them work again.', days: 99 },
  zinc: { one: 'No effect from one day.', streak: 'Zinc matters for immunity and testosterone; long gaps only matter if your diet is low in meat and seafood.', days: 14 },
  omega3: { one: 'Omega-3 levels build over weeks; one missed day is nothing.', streak: 'The benefits (heart, joints, inflammation) depend on levels built over 8–12 weeks of steady intake — long gaps undo that slowly.', days: 10 },
  liver: { one: 'No effect from one day.', streak: 'Follow the label; the best liver support is limiting alcohol and getting regular blood tests.', days: 14 },
  electro: { one: 'Only matters on training days and hot days.', streak: 'Missing electrolytes when you sweat a lot can mean cramps, headaches and worse sessions.', days: 3 },
  carnitine: { one: 'No effect from one day.', streak: 'L-carnitine needs months of daily use (with carbs) to raise muscle levels (Wall et al. 2011) — frequent gaps slow that down.', days: 5 },
  magnesium: { one: 'You might sleep a little worse or cramp; otherwise fine.', streak: 'Many lifters run low on magnesium (lost in sweat). Gaps can bring back cramps, poor sleep and twitchy muscles.', days: 4 },
  melatonin: { one: 'As-needed — skipping is fine.', streak: 'No dependence or rebound for most people.', days: 99 },
  fibre: { one: 'Only needed on low-fibre days.', streak: 'Aim for 25–30 g fibre a day from food first.', days: 99 },
}

/** consecutive scheduled days (ending yesterday or today) on which this item was not ticked */
export function missStreak(s: DosetteState, it: DoseItem, today = dayjs().format('YYYY-MM-DD')): number {
  let n = 0
  for (let i = 1; i <= 60; i++) {
    const d = dayjs(today).subtract(i, 'day')
    const ds = d.format('YYYY-MM-DD')
    if (s.startedAt && ds < s.startedAt) break
    if (!onDay(it, d.day(), s.trainingDays)) continue
    const all = it.slots.every((sl) => isTaken(s, ds, sl, it.id))
    if (all) break
    n++
  }
  return n
}

/** tick creatine in the app-wide creatine log too */
export async function mirrorCreatine(date: string, taken: boolean) {
  const row = (await db.creatineLog.where('date').equals(date).toArray())[0]
  if (row) await db.creatineLog.put({ ...row, taken })
  else if (taken) await db.creatineLog.add({ id: newId(), date, taken: true, at: new Date().toISOString() })
}

/** evidence-based additions he does NOT already take */
export function recommendations(items: DoseItem[], ctx: { proteinGap?: number; fibreToday?: number }): { title: string; why: string }[] {
  const have = (k: string) => items.some((i) => i.kind === k && !i.paused)
  const out: { title: string; why: string }[] = []
  if (ctx.proteinGap !== undefined && ctx.proteinGap > 25) out.push({ title: 'Whey or plant protein powder', why: `You’re averaging about ${Math.round(ctx.proteinGap)} g a day under your protein target. One scoop (~25 g) closes most of that — protein supplements add muscle when total protein is short (Morton et al. 2018 meta-analysis).` })
  if (!have('creatine')) out.push({ title: 'Creatine monohydrate 3–5 g', why: 'The best-supported muscle and strength supplement (ISSN position stand).' })
  if (!have('omega3')) out.push({ title: 'Omega-3 fish oil', why: 'Useful if you eat oily fish less than twice a week.' })
  if (!have('vitd')) out.push({ title: 'Vitamin D3', why: 'Common deficiency in Australia in winter and for indoor workers.' })
  if (!have('magnesium')) out.push({ title: 'Magnesium glycinate', why: 'Lifters lose magnesium in sweat; may help sleep and cramps.' })
  if (ctx.fibreToday !== undefined && ctx.fibreToday < 25 && have('fibre')) out.push({ title: 'Fibre gummies today', why: `You’ve logged ${Math.round(ctx.fibreToday)} g fibre today (aim 25–30 g). Two Metamucil gummies add about 5 g — or add oats, beans, fruit or veg.` })
  out.push({ title: 'Blood test every 3–6 months', why: 'Check vitamin D, iron, liver, kidney and lipids so the supplements are guided by numbers, not guesses.' })
  return out
}

/** '5 g', '2 capsules', '1 softgel' */
export function qty(n: number, unit: string): string {
  const short = unit.length <= 2 || unit.includes('(') || unit.endsWith('s')
  return `${n} ${short || n === 1 ? unit : unit + 's'}`
}
