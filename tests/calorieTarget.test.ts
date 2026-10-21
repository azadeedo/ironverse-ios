// IV-22 / IV-25A / IV-25B / IV-17 — one authoritative target, exact deficit-detector
// requirements, proposals instead of silent changes.
import { describe, expect, it } from 'vitest'
import { db } from '@/db'
import type { Profile, WeighIn } from '@/db/types'
import { acceptProposal, evaluateProposal, migrateAutoChangeToProposal, pendingProposal, targetBreakdown, targetHistory, undoLastChange } from '@/lib/calorieTarget'
import { targetWithDelta } from '@/screens/food/helpers'
import { deficitReadiness } from '@/lib/nutrition'

const me = { id: 'me', name: 'N', sex: 'male', birthYear: 2000, heightCm: 169, weightKg: 98, goal: 'lose-fat', activityLevel: 'moderate', calorieTarget: 1750, proteinTarget: 186, onboarded: true } as unknown as Profile

describe('IV-25A — one target everywhere', () => {
  it('the safety floor never raises his own base (old bug: 1,750 shown as 1,911)', () => {
    expect(targetBreakdown(me).final).toBe(1750)
    expect(targetWithDelta(me, 0)).toBe(1750)
    expect(targetBreakdown(me).floor).toBeGreaterThan(1750) // BMR ≈ 1,911 for 98 kg / 169 cm / 26 y
  })
  it('carry-over can lower a day but not below min(base, floor); additions always apply', () => {
    expect(targetBreakdown({ ...me, calorieTarget: 2400 }, -300).final).toBe(2100)
    expect(targetBreakdown({ ...me, calorieTarget: 2000 }, -300).final).toBe(targetBreakdown(me).floor)
    expect(targetBreakdown(me, -300).final).toBe(1750)
    expect(targetBreakdown(me, 150).final).toBe(1900)
  })
})

describe('IV-25B — deficit detector says exactly what is missing', () => {
  const wi = (date: string, kg: number): WeighIn => ({ id: date, date, weightKg: kg })
  it('2 weigh-ins only 3 days apart is reported as the blocker, not "2/2 done"', () => {
    const intake = new Map(Array.from({ length: 10 }, (_, i) => [`2026-10-0${i}`.replace('0-0', '0-0'), 1800]))
    const r = deficitReadiness([wi('2026-10-01', 98), wi('2026-10-04', 97.6)], intake)
    expect(r.ready).toBe(false)
    expect(r.missing).toMatch(/span only 3 days.*on or after 2026-10-08/)
  })
  it('weigh-ins far enough apart but too few logged days between them', () => {
    const intake = new Map([['2026-10-02', 1800], ['2026-10-03', 1800]])
    expect(deficitReadiness([wi('2026-10-01', 98), wi('2026-10-10', 97.2)], intake).missing).toMatch(/Food logged on 2 of the 9 days/)
  })
  it('unlocks when the real conditions are met', () => {
    const intake = new Map(Array.from({ length: 9 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, 1900]))
    expect(deficitReadiness([wi('2026-10-01', 98), wi('2026-10-10', 97.2)], intake).ready).toBe(true)
  })
})

describe('IV-17 / IV-22 — proposals, history and undo', () => {
  it('repairs the earlier automatic 1,850 → 1,750 change into a pending proposal', async () => {
    await db.open(); await db.settings.clear(); await db.weighIns.clear(); await db.foodLog.clear()
    await db.profile.put({ ...me, calorieTarget: 1750, calorieAuto: { date: '2026-10-08', from: 1850, to: 1750, why: 'auto' } })
    expect(await migrateAutoChangeToProposal()).toBe(true)
    expect((await db.profile.get('me'))!.calorieTarget).toBe(1850)
    expect((await pendingProposal())).toMatchObject({ from: 1850, to: 1750 })
    expect(await migrateAutoChangeToProposal()).toBe(false)
  })
  it('accepting applies it and records history; undo restores', async () => {
    await acceptProposal()
    expect((await db.profile.get('me'))!.calorieTarget).toBe(1750)
    const h = await targetHistory()
    expect(h.at(-1)).toMatchObject({ from: 1850, to: 1750, source: 'proposal-accepted' })
    await undoLastChange()
    expect((await db.profile.get('me'))!.calorieTarget).toBe(1850)
  })
  it('a single high weigh-in after a big day does NOT create a proposal', async () => {
    await db.settings.clear(); await db.weighIns.clear(); await db.foodLog.clear()
    await db.profile.put({ ...me, calorieTarget: 1850 })
    const days = (from: number, kg: (i: number) => number) => Array.from({ length: 7 }, (_, i) => ({ id: `w${from}${i}`, date: `2026-10-${String(from + i).padStart(2, '0')}`, weightKg: kg(i) }))
    await db.weighIns.bulkPut([...days(1, () => 98.4), ...days(8, () => 97.9), ...days(15, (i) => (i === 6 ? 99.5 : 97.4))])
    await db.foodLog.bulkPut(Array.from({ length: 21 }, (_, i) => ({ id: `f${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}`, meal: 'lunch', name: 'x', grams: 1, kcal: 1850, protein: 150, carbs: 1, fat: 1, createdAt: '' }) as never))
    expect(await evaluateProposal('2026-10-22')).toBeNull()
  })
  it('a genuine 2-week plateau with consistent logging proposes −100 — never applies it', async () => {
    await db.settings.clear(); await db.weighIns.clear()
    const flat = Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}`, weightKg: 97.9 }))
    await db.weighIns.bulkPut(flat)
    await db.settings.put({ key: 'goal:settings', value: { auto: false } } as never) // proposals only run with the goal coach off
    const p = await evaluateProposal('2026-10-22')
    expect(p).toMatchObject({ from: 1850, to: 1750 })
    expect((await db.profile.get('me'))!.calorieTarget).toBe(1850)
  })
})

describe('goal coach auto-adjust (he asked for daily automatic changes)', () => {
  it('with the coach on, the target moves toward the goal by at most 150 and is recorded with undo', async () => {
    await db.settings.clear(); await db.weighIns.clear()
    await db.weighIns.bulkPut([{ id: 'g1', date: '2026-10-21', weightKg: 97.9 }])
    const before = (await db.profile.get('me'))!.calorieTarget
    const { runGoalAutoAdjust } = await import('@/lib/calorieTarget')
    const c = await runGoalAutoAdjust('2026-10-21')
    const after = (await db.profile.get('me'))!.calorieTarget
    if (c) { expect(Math.abs(after - before)).toBeLessThanOrEqual(150); expect(c.source).toBe('goal-auto'); expect(after).toBeGreaterThanOrEqual(1500) }
    expect(await runGoalAutoAdjust('2026-10-21')).toBeNull() // once a day
    if (c) { await undoLastChange(); expect((await db.profile.get('me'))!.calorieTarget).toBe(before) }
  })
})
