import { describe, expect, it } from 'vitest'
import { fastStats, hoursFasted, stageFor } from '@/lib/fasting'

describe('fasting', () => {
  it('hours, stage and stats', () => {
    const f = { start: '2026-10-22T20:00:00Z', end: '2026-10-23T12:30:00Z', goalHours: 16 }
    expect(hoursFasted(f)).toBe(16.5)
    expect(stageFor(16.5).title).toBe('Deeper fat use')
    const s = fastStats([f, { start: '2026-10-21T20:00:00Z', end: '2026-10-22T06:00:00Z', goalHours: 16 }])
    expect(s).toMatchObject({ total: 2, hitRate: 50, streak: 1, longest: 16.5 })
  })
})
