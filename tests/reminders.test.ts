import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { db } from '@/db'
import { doneToday } from '@/screens/today/lib'
import type { Profile } from '@/db/types'

describe('IV-36 reminders skip what is already done', () => {
  it('water target reached, creatine taken and workout finished are all detected', async () => {
    const t = dayjs().format('YYYY-MM-DD')
    const p = { waterTargetMl: 1000 } as Profile
    expect(await doneToday(p)).toEqual({ water: false, creatine: false, workout: false })
    await db.waterLog.bulkAdd([{ id: 'w1', date: t, ml: 600, at: t }, { id: 'w2', date: t, ml: 500, at: t }])
    await db.creatineLog.add({ id: 'c1', date: t, taken: true })
    await db.workoutLogs.add({ id: 'l1', date: t, title: 'x', startedAt: t, finishedAt: t, exercises: [] })
    expect(await doneToday(p)).toEqual({ water: true, creatine: true, workout: true })
  })
})

import { GROUPS3D, groupSets, setsColour } from '@/screens/Anatomy3DScreen'
describe('IV-10 3D body colours', () => {
  it('uses the highest set count of a group and the 10–20 sweet spot', () => {
    const m = new Map([['front-delts', 4], ['side-delts', 12]] as [never, number][])
    const sh = GROUPS3D.find((g) => g.key === 'shoulders')!
    expect(groupSets(m as never, sh)).toBe(12)
    expect(setsColour(0)).toBe(0x3b4a5e); expect(setsColour(12)).toBe(0x22c55e); expect(setsColour(25)).toBe(0xef4444)
  })
})
