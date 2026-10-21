// Free week → free tier → Pro, and which screens are Pro.
import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'

;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'ios'

describe('Ironverse Pro tiers', () => {
  it('first 7 days are the Premium trial, then free, Pro when subscribed', async () => {
    const { computeTier, trialDaysLeft } = await import('@/lib/pro')
    const start = '2026-10-21T08:00:00.000Z'
    expect(computeTier(dayjs('2026-10-21T09:00:00Z'), start, null)).toBe('trial')
    expect(trialDaysLeft(dayjs('2026-10-21T09:00:00Z'), start)).toBe(7)
    expect(computeTier(dayjs('2026-10-27T20:00:00Z'), start, null)).toBe('trial')
    expect(computeTier(dayjs('2026-10-28T09:00:00Z'), start, null)).toBe('free')
    expect(trialDaysLeft(dayjs('2026-10-30T09:00:00Z'), start)).toBe(0)
    expect(computeTier(dayjs('2026-11-30T09:00:00Z'), start, { active: true, expires: '2026-12-21T00:00:00Z', checkedAt: 'x' })).toBe('pro')
    expect(computeTier(dayjs('2027-01-30T09:00:00Z'), start, { active: true, expires: '2026-12-21T00:00:00Z', checkedAt: 'x' })).toBe('free')
  })

  it('yearly saving is never overstated', async () => {
    const { yearlySavingPct } = await import('@/lib/pro')
    expect(yearlySavingPct(12.99, 79.99)).toBe(48)
    expect(yearlySavingPct(0, 79.99)).toBe(0)
  })

  it('only Pro screens are gated; core logging, food, backup and feedback stay free', async () => {
    const { proFeatureForPath } = await import('@/lib/pro')
    for (const p of ['/', '/workout', '/session/abc', '/exercises', '/food', '/progress', '/backup', '/settings', '/feedback', '/calories', '/hydration', '/plan', '/anatomy', '/programs'])
      expect(proFeatureForPath(p)).toBeNull()
    expect(proFeatureForPath('/program')).toBe('program12')
    expect(proFeatureForPath('/program/day/1/tue')).toBe('program12')
    expect(proFeatureForPath('/hub')).toBe('analytics')
    expect(proFeatureForPath('/anatomy/3d')).toBe('anatomy3d')
    expect(proFeatureForPath('/health-scan')).toBe('barcode')
  })

  it('the trial clock starts on first launch and the store answer is remembered', async () => {
    const { db, getSetting } = await import('@/db')
    await db.open()
    const pro = await import('@/lib/pro')
    await pro.usePro.getState().refresh()
    expect(pro.usePro.getState().tier).toBe('trial')
    expect(await getSetting('pro:trialStart', null)).not.toBeNull()
  })

  it('web build is never gated', async () => {
    ;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'web'
    const pro = await import('@/lib/pro')
    await pro.usePro.getState().refresh()
    expect(pro.usePro.getState().tier).toBe('pro')
    ;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'ios'
  })
})
