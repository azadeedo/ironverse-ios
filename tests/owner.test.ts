import { describe, expect, it } from 'vitest'
import { db } from '@/db'
import { applyOwnerProfileOnce, autoAdjustCalories, creatineDoseFor } from '@/lib/owner'
import { slotForDay } from '@/lib/schedule'
import type { Profile } from '@/db/types'

describe('owner profile, calories and creatine', () => {
  it('enters his facts once and never asks for setup again', async () => {
    await db.open(); await db.settings.clear(); await db.weighIns.clear()
    await db.profile.put({ id: 'me', name: 'N', sex: 'male', birthYear: 2001, heightCm: 180, weightKg: 98, goal: 'lose-fat', activityLevel: 'light', calorieTarget: 2956, proteinTarget: 192, onboarded: false, creatineGrams: 5, daysPerWeek: 5, workSchedule: [], preferredSlot: 'auto' } as unknown as Profile)
    expect(await applyOwnerProfileOnce()).toBe(true)
    const me = (await db.profile.get('me'))!
    expect(me.onboarded).toBe(true)
    expect([me.heightCm, me.birthYear, me.daysPerWeek, me.calorieTarget, me.gymTime]).toEqual([169, 2000, 4, 1850, '22:30'])
    expect(me.workSchedule.find((d) => d.day === 4)!.working).toBe(false)
    expect(me.workSchedule.find((d) => d.day === 1)).toMatchObject({ start: '09:00', end: '23:00' })
    expect(slotForDay(me.workSchedule[2], me.preferredSlot, 60, me.gymTime).slot).toBe('22:30')
    expect(await applyOwnerProfileOnce()).toBe(false)
  })
  it('creatine: loading dose until Saturday 10 Oct, then 5 g', async () => {
    const me = (await db.profile.get('me'))!
    expect(creatineDoseFor(me, '2026-10-09')).toMatchObject({ grams: 20, loading: true })
    expect(creatineDoseFor(me, '2026-10-10').loading).toBe(true)
    expect(creatineDoseFor(me, '2026-10-11')).toMatchObject({ grams: 5, loading: false })
  })
  it('lowers calories 100 when weight has not dropped for two weeks — and only then', async () => {
    const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
    // losing steadily → no change
    await db.weighIns.bulkPut([1, 2, 3].flatMap((wk) => [0, 2, 4].map((d) => ({ id: `a${wk}${d}`, date: day(wk * 7 - 6 + d), weightKg: 99 - wk * 0.6 }))))
    expect(await autoAdjustCalories('2026-10-21')).toBeNull()
    await db.weighIns.clear()
    // flat for three weeks → down 100
    await db.weighIns.bulkPut([1, 2, 3].flatMap((wk) => [0, 2, 4].map((d) => ({ id: `b${wk}${d}`, date: day(wk * 7 - 6 + d), weightKg: 97.9 }))))
    const c = await autoAdjustCalories('2026-10-21')
    expect(c).toMatchObject({ from: 1850, to: 1750 })
    // not again within 14 days
    expect(await autoAdjustCalories('2026-10-25')).toBeNull()
  })
})
