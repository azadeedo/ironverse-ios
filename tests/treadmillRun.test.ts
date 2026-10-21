import { describe, expect, it } from 'vitest'
import { bestTenK, fmtTime, nextTargets, paceSec, parseTime, runKcal, speedForPace, speedKmh, splitInfo, tenKTime } from '@/lib/treadmillRun'
import { bestKmPace } from '@/lib/goalCoach'
import type { CardioLog } from '@/db/types'

describe('10 km treadmill run', () => {
  it('reads times and works out pace and speed', () => {
    expect(parseTime('58:30')).toBe(3510); expect(parseTime('1:02:15')).toBe(3735); expect(parseTime('60')).toBe(3600); expect(parseTime('x')).toBeNull()
    expect(fmtTime(paceSec(3510, 10))).toBe('5:51')
    expect(speedKmh(3600, 10)).toBe(10)
    expect(speedForPace(360).toFixed(1)).toBe('10.0')
    expect(fmtTime(3735)).toBe('1:02:15')
  })
  it('calories from the ACSM running equation (98 kg, 10 km in 60 min, 1% incline ≈ 1,000 kcal)', () => {
    const k = runKcal(10, 3600, 98, 1)
    expect(k).toBeGreaterThan(950); expect(k).toBeLessThan(1100)
    expect(runKcal(10, 3600, 98, 3)).toBeGreaterThan(k)
  })
  it('best 10 km, splits and next targets', () => {
    const r = (id: string, date: string, sec: number, km = 10) => ({ id, date, kind: 'run', seconds: sec, distanceKm: km, createdAt: date } as CardioLog)
    const logs = [r('a', '2026-10-21', 3720), r('b', '2026-10-28', 3600), r('c', '2026-11-04', 1500, 5)]
    expect(bestTenK(logs)!.id).toBe('b')
    expect(tenKTime(r('d', 'x', 3960, 11))).toBe(3600)
    const s = splitInfo([370, 365, 360, 362, 358, 355, 352, 350, 348, 340])!
    expect(s.negative).toBe(true); expect(s.fastestKm).toBe(10)
    expect(nextTargets(3600).map((t) => t.sec)).toEqual([3540, 3480, 3300])
  })
  it('a fast km split counts toward the 4:00 km goal', () => {
    const run = { id: 'x', date: '2026-10-21', kind: 'run', seconds: 3500, distanceKm: 10, splitsSec: [330, 320, 300, 360], createdAt: '' } as unknown as CardioLog
    expect(bestKmPace([run])).toBe(300)
  })
})

describe('times typed on the phone keypad', () => {
  it('dots, commas, spaces and digits-only all work', () => {
    expect(parseTime('58.30')).toBe(3510); expect(parseTime('58,30')).toBe(3510); expect(parseTime('58 30')).toBe(3510)
    expect(parseTime('1.02.15')).toBe(3735); expect(parseTime('11.14')).toBe(674)
    expect(parseTime('5830')).toBe(3510); expect(parseTime('530')).toBe(330); expect(parseTime('10215')).toBe(3735)
    expect(parseTime('60')).toBe(3600); expect(parseTime('5.75')).toBeNull(); expect(parseTime('')).toBeNull()
  })
})
