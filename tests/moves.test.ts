import { describe, expect, it } from 'vitest'
import { buildProgramPlan, programDayOn } from '@/lib/program12'

const base = buildProgramPlan({ start: '2026-10-13', setup: {} })

describe('v9 move a workout to another day (work clash)', () => {
  it('normal days are unchanged', () => {
    expect(programDayOn(base, '2026-10-13')).toMatchObject({ dk: 'tue', week: 1 })
    expect(programDayOn(base, '2026-10-18')).toBeNull()
  })
  it('Tuesday moved to Saturday: Saturday shows Tuesday\'s workout of the same week, Tuesday becomes rest', () => {
    const plan = { ...base, moves: { '2026-10-20': '2026-10-24' } }
    expect(programDayOn(plan, '2026-10-20')).toBeNull()
    expect(programDayOn(plan, '2026-10-24')).toEqual({ dk: 'tue', week: 2, movedFrom: '2026-10-20' })
    expect(programDayOn(plan, '2026-10-21')).toMatchObject({ dk: 'wed', week: 2 })
  })
  it('a workout moved into the next calendar week keeps its original program week', () => {
    const plan = { ...base, moves: { '2026-10-16': '2026-10-19' } }
    expect(programDayOn(plan, '2026-10-19')).toMatchObject({ dk: 'fri', week: 1 })
  })
})

import { rankPicks } from '@/screens/food/FitsNow'
import type { FoodLogEntry } from '@/db/types'
const E = (name: string, kcal: number, protein: number, d = '2026-10-01'): FoodLogEntry => ({ id: name + d, date: d, meal: 'lunch', name, grams: 200, kcal, protein, carbs: 10, fat: 5, createdAt: d + 'T10:00:00Z' })
describe('v9 what fits now', () => {
  it('never suggests more than the calories left; prefers protein per calorie', () => {
    const h = [E('Chicken rice', 550, 45), E('Greek yoghurt', 150, 15), E('Pizza', 900, 30), E('Chips', 300, 3)]
    const p = rankPicks(h, 600, 80)
    expect(p.map((x) => x.name)).not.toContain('Pizza')
    expect(p[0].name).toBe('Greek yoghurt')
    expect(p.findIndex((x) => x.name === 'Chips')).toBeGreaterThan(p.findIndex((x) => x.name === 'Chicken rice'))
  })
})

import { weekGlance } from '@/screens/today/WeekGlance'
describe('IV-36 compact weekly review', () => {
  it('counts workouts, logged days, protein days and weekly weight change; asks for more logging when thin', () => {
    const prof = { proteinTarget: 180, daysPerWeek: 4 } as never
    const logs = [{ date: '2026-10-10', finishedAt: 'x' }, { date: '2026-10-08', finishedAt: 'x' }] as never
    const food = [E('A', 1800, 175, '2026-10-10'), E('B', 1700, 100, '2026-10-09')]
    const w = [{ id: '1', date: '2026-10-01', weightKg: 98 }, { id: '2', date: '2026-10-10', weightKg: 97.4 }]
    const g = weekGlance('2026-10-12', logs, food, w, prof)
    expect(g.sessions).toBe(2); expect(g.loggedDays).toBe(2); expect(g.proteinDays).toBe(1); expect(g.change).toBe(-0.6)
    expect(g.line).toMatch(/Food logged on 2 of 7/)
  })
})

import { volumeShare } from '@/lib/progressHub'
describe('Forgd-style share of volume', () => {
  it('reports the dominant group and flags an undertrained major group', () => {
    const now = { chest: { sets: 25, perWeek: 6.3, freq: 2 }, back: { sets: 12, perWeek: 3, freq: 1 }, shoulders: { sets: 9, perWeek: 2.3, freq: 1 }, arms: { sets: 0, perWeek: 0, freq: 0 }, legs: { sets: 41, perWeek: 10.3, freq: 2 }, core: { sets: 0, perWeek: 0, freq: 0 } }
    const v = volumeShare(now)
    expect(v.rows[0].label).toBe('Legs'); expect(v.rows[0].pct).toBe(47)
    expect(v.insight).toMatch(/Legs is carrying most/); expect(v.insight).toMatch(/Arms looks undertrained/)
  })
})
