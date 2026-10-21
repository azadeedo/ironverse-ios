// ONE authoritative calorie target for the whole app (IV-22 / IV-25A).
//
//   base   = profile.calorieTarget — the number HE set or ACCEPTED. Never moved
//            silently: changes are proposals he confirms, with history + undo.
//   carry  = optional per-day carry-over rows (DayAdjust) he chose after a big day.
//   final  = base + carry, where a carry-over REDUCTION can never push a day below
//            the safety floor (estimated BMR, min 1,200). The floor never raises
//            his own base target — that was the old bug (1,750 shown as 1,911).
//
// Energy expenditure figures are ESTIMATES (Mifflin-St Jeor / weight trend), never
// "measured metabolism".

import dayjs from 'dayjs'
import { db, getProfile, getSetting, saveProfile, setSetting } from '@/db'
import type { DayAdjust, Profile } from '@/db/types'
import { bmr } from './nutrition'
import { DEFAULT_GOAL_DATE, computeGoalPlan, nextTarget, type GoalPlan } from './goalCoach'

export const MIN_DAILY_KCAL = 1200
export const MIN_BASE_KCAL = 1500

export function safetyFloor(p: Profile): number {
  const b = Math.round(bmr(p))
  return Math.max(Number.isFinite(b) ? b : 0, MIN_DAILY_KCAL)
}

export interface TargetBreakdown { base: number; carry: number; final: number; floor: number; floorApplied: boolean; text: string }

export function targetBreakdown(p: Profile, delta = 0): TargetBreakdown {
  const base = Math.round(p.calorieTarget)
  const floor = safetyFloor(p)
  let final = base + Math.round(delta)
  let floorApplied = false
  if (delta < 0) {
    const lowest = Math.min(base, floor)
    if (final < lowest) { final = lowest; floorApplied = true }
  }
  const text = !delta ? `${base.toLocaleString('en-AU')} kcal`
    : `${base.toLocaleString('en-AU')} ${delta > 0 ? '+' : '−'} ${Math.abs(Math.round(final - base)).toLocaleString('en-AU')} carry-over = ${final.toLocaleString('en-AU')} kcal${floorApplied ? ' (limited by the safety floor)' : ''}`
  return { base, carry: final - base, final, floor, floorApplied, text }
}
export function targetFor(p: Profile, adjusts: Map<string, DayAdjust> | undefined, date: string): number {
  return targetBreakdown(p, adjusts?.get(date)?.deltaKcal ?? 0).final
}

// ---------- history + proposals ----------
export interface TargetChange {
  id: string
  at: string
  effective: string
  from: number
  to: number
  source: 'manual' | 'proposal-accepted' | 'undo' | 'migration' | 'goal-auto'
  why: string
}
export interface TargetProposal { at: string; from: number; to: number; why: string; evidence: string[] }

export async function targetHistory(): Promise<TargetChange[]> { return getSetting<TargetChange[]>('cal:history', []) }
export async function pendingProposal(): Promise<TargetProposal | null> { return getSetting<TargetProposal | null>('cal:proposal', null) }

async function record(c: Omit<TargetChange, 'id' | 'at'>): Promise<void> {
  const h = await targetHistory()
  h.push({ ...c, id: Math.random().toString(36).slice(2), at: new Date().toISOString() })
  await setSetting('cal:history', h.slice(-60))
}

/** He sets the target himself (with confirmation in the UI). */
export async function setBaseTarget(to: number, why = 'Set by you'): Promise<void> {
  const me = await getProfile(); if (!me) return
  const v = Math.round(to)
  if (!(v >= MIN_BASE_KCAL && v <= 6000)) throw new Error(`Choose between ${MIN_BASE_KCAL} and 6,000 kcal`)
  if (v === me.calorieTarget) return
  await saveProfile({ ...me, calorieTarget: v })
  await record({ effective: dayjs().format('YYYY-MM-DD'), from: me.calorieTarget, to: v, source: 'manual', why })
}
export async function acceptProposal(): Promise<void> {
  const p = await pendingProposal(); const me = await getProfile(); if (!p || !me) return
  await saveProfile({ ...me, calorieTarget: p.to })
  await record({ effective: dayjs().format('YYYY-MM-DD'), from: me.calorieTarget, to: p.to, source: 'proposal-accepted', why: p.why })
  await setSetting('cal:proposal', null)
  await setSetting('cal:lastProposalAt', dayjs().format('YYYY-MM-DD'))
}
export async function dismissProposal(): Promise<void> {
  await setSetting('cal:proposal', null)
  await setSetting('cal:lastProposalAt', dayjs().format('YYYY-MM-DD'))
}
/** undo the most recent change (restores the previous target, recorded as its own entry) */
export async function undoLastChange(): Promise<TargetChange | null> {
  const h = await targetHistory(); const me = await getProfile()
  const last = [...h].reverse().find((c) => c.source !== 'undo')
  if (!last || !me) return null
  await saveProfile({ ...me, calorieTarget: last.from })
  await record({ effective: dayjs().format('YYYY-MM-DD'), from: me.calorieTarget, to: last.from, source: 'undo', why: `Undid: ${last.why}` })
  return last
}

/**
 * IV-17 adaptive target — a PROPOSAL only. Uses 3 weekly weight averages (no
 * single-day reactions), food-log completeness and the rate of change:
 *   • not dropping ≥0.2 kg/week for 2 weeks AND food logged ≥5 days in each → propose −100
 *   • dropping faster than 1% of bodyweight per week for 2 weeks → propose +100 (protect muscle)
 * Never below max(1,500, 90% of estimated resting burn). At most one proposal per 14 days.
 */
export async function evaluateProposal(today = dayjs().format('YYYY-MM-DD')): Promise<TargetProposal | null> {
  const me = await getProfile()
  if (!me || me.adaptiveCalories === false) return null
  if ((await goalSettings()).auto) return null // the goal coach moves the target daily instead
  if (await pendingProposal()) return null
  const last = await getSetting<string | null>('cal:lastProposalAt', null)
  if (last && dayjs(today).diff(dayjs(last), 'day') < 14) return null
  const w = await db.weighIns.toArray()
  const food = await db.foodLog.toArray()
  const avg = (from: number, to: number) => {
    const xs = w.filter((x) => { const d = dayjs(today).diff(dayjs(x.date), 'day'); return d >= from && d < to }).map((x) => x.weightKg)
    return xs.length >= 2 ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  const loggedDays = (from: number, to: number) => new Set(food.filter((f) => { const d = dayjs(today).diff(dayjs(f.date), 'day'); return d >= from && d < to }).map((f) => f.date)).size
  const a0 = avg(0, 7), a1 = avg(7, 14), a2 = avg(14, 21)
  if (a0 === null || a1 === null || a2 === null) return null
  const drop1 = a1 - a0, drop2 = a2 - a1
  const l0 = loggedDays(0, 7), l1 = loggedDays(7, 14)
  const evidence = [
    `Weekly average weight: ${a2.toFixed(1)} → ${a1.toFixed(1)} → ${a0.toFixed(1)} kg`,
    `Food logged on ${l1}/7 then ${l0}/7 days`,
  ]
  // proposals never go below max(1,500, 90% of estimated resting burn)
  const floor = Math.max(MIN_BASE_KCAL, Math.round(safetyFloor(me) * 0.9))
  let prop: TargetProposal | null = null
  if (drop1 < 0.2 && drop2 < 0.2 && l0 >= 5 && l1 >= 5 && me.calorieTarget - 100 >= floor) {
    prop = { at: today, from: me.calorieTarget, to: me.calorieTarget - 100, evidence,
      why: 'Your weekly average has not dropped for two weeks while you logged consistently. A small 100 kcal reduction is suggested — water and sodium can mask fat loss, so a plateau this short is not proof.' }
  } else if (drop1 > a0 * 0.01 && drop2 > a1 * 0.01) {
    prop = { at: today, from: me.calorieTarget, to: me.calorieTarget + 100, evidence,
      why: 'You are losing more than 1% of bodyweight a week for two weeks. Adding 100 kcal helps protect muscle and training performance.' }
  }
  if (prop) await setSetting('cal:proposal', prop)
  return prop
}

/**
 * One-time repair: v8 changed the target AUTOMATICALLY (1,850 → 1,750) without
 * asking. Put back the number he set and turn that change into a proposal he
 * can accept or dismiss.
 */
export async function migrateAutoChangeToProposal(): Promise<boolean> {
  if (await getSetting<boolean>('cal:migratedV9', false)) return false
  const me = await getProfile()
  let changed = false
  if (me?.calorieAuto && me.calorieAuto.to < me.calorieAuto.from && me.calorieTarget === me.calorieAuto.to) {
    await saveProfile({ ...me, calorieTarget: me.calorieAuto.from })
    await record({ effective: dayjs().format('YYYY-MM-DD'), from: me.calorieAuto.to, to: me.calorieAuto.from, source: 'migration', why: 'Restored the target you set — the earlier automatic change was made without asking.' })
    await setSetting('cal:proposal', { at: me.calorieAuto.date, from: me.calorieAuto.from, to: me.calorieAuto.to, why: me.calorieAuto.why + ' (Previously applied automatically — now waiting for your decision.)', evidence: [] } satisfies TargetProposal)
    changed = true
  }
  await setSetting('cal:migratedV9', true)
  return changed
}

// ---------- goal coach (he asked for daily automatic changes toward 85 kg by 14 Jan) ----------
export interface GoalSettings { auto: boolean; date: string; kg: number }
export async function goalSettings(): Promise<GoalSettings> {
  const me = await getProfile()
  const g = await getSetting<Partial<GoalSettings>>('goal:settings', {})
  return { auto: g.auto ?? true, date: g.date ?? DEFAULT_GOAL_DATE, kg: g.kg ?? me?.goalWeightKg ?? 85 }
}
export async function saveGoalSettings(g: Partial<GoalSettings>): Promise<void> {
  const cur = await goalSettings()
  const next = { ...cur, ...g }
  await setSetting('goal:settings', next)
  const me = await getProfile()
  if (me && g.kg && g.kg !== me.goalWeightKg) await saveProfile({ ...me, goalWeightKg: g.kg })
}
export async function currentGoalPlan(today = dayjs().format('YYYY-MM-DD')): Promise<GoalPlan | null> {
  const me = await getProfile(); if (!me) return null
  const g = await goalSettings()
  const w = await db.weighIns.toArray()
  const intake = new Map<string, number>()
  for (const f of await db.foodLog.toArray()) intake.set(f.date, (intake.get(f.date) ?? 0) + f.kcal)
  return computeGoalPlan(me, w, intake, today, g.kg, g.date)
}
/** Once a day: move the base target toward what the goal needs (max 150 kcal a day), recorded with Undo. */
export async function runGoalAutoAdjust(today = dayjs().format('YYYY-MM-DD')): Promise<TargetChange | null> {
  const g = await goalSettings(); if (!g.auto) return null
  if ((await getSetting<string | null>('goal:lastRun', null)) === today) return null
  const me = await getProfile(); const plan = await currentGoalPlan(today)
  await setSetting('goal:lastRun', today)
  if (!me || !plan) return null
  const to = nextTarget(me.calorieTarget, plan)
  if (to === me.calorieTarget) return null
  const why = to < me.calorieTarget
    ? `Goal coach: ${plan.kgToGo} kg to go by ${dayjs(plan.date).format('D MMM')} at your ${plan.current} kg average — lowered.`
    : `Goal coach: you are losing faster than needed (or than is safe) — raised a little to protect muscle.`
  await saveProfile({ ...me, calorieTarget: to })
  await record({ effective: today, from: me.calorieTarget, to, source: 'goal-auto', why })
  const h = await targetHistory()
  return h[h.length - 1] ?? null
}
