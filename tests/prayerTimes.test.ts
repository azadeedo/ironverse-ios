import { describe, expect, it } from 'vitest'
import { hijriDate, nextPrayer, prayerTimes, qiblaBearing, type PrayerSettings } from '@/lib/prayerTimes'

// UTC minutes of the day, so the test doesn't depend on the machine's time zone
const utcMin = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes()
const near = (got: number, want: number, tol = 4) => expect(Math.abs(got - want), `${got} vs ${want}`).toBeLessThanOrEqual(tol)

describe('prayer times', () => {
  it('Makkah, 1 Jan 2026, Umm al-Qura — matches published times within a few minutes', () => {
    // reference: api.aladhan.com method 4 (Umm al-Qura), 01-01-2026: Fajr 05:37 · Sunrise 06:59 · Dhuhr 12:24 · Asr 15:29 · Maghrib 17:50 · Isha 19:20
    const s: PrayerSettings = { lat: 21.4225, lng: 39.8262, method: 'Makkah', asr: 1 }
    const t = prayerTimes(new Date(2026, 0, 1), s)
    const local = (d: Date) => (utcMin(d) + 180) % 1440
    near(local(t.sunrise), 6 * 60 + 58)
    near(local(t.dhuhr), 12 * 60 + 24)
    near(local(t.asr), 15 * 60 + 28)
    near(local(t.maghrib), 17 * 60 + 50)
    near(local(t.isha), 19 * 60 + 20)
    near(local(t.fajr), 5 * 60 + 37, 6)
  })

  it('Melbourne (MWL) and Sydney (MWL, Hanafi) on 23 Oct 2026 match Aladhan within 3 minutes', () => {
    // reference: api.aladhan.com method 3 (MWL). Both cities on AEDT (UTC+11) that day.
    const check = (s: PrayerSettings, want: Record<string, string>) => {
      const t = prayerTimes(new Date(2026, 9, 23), s)
      const local = (d: Date) => (utcMin(d) + 660) % 1440
      const hm = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3))
      near(local(t.fajr), hm(want.Fajr), 3); near(local(t.sunrise), hm(want.Sunrise), 3); near(local(t.dhuhr), hm(want.Dhuhr), 3)
      near(local(t.asr), hm(want.Asr), 3); near(local(t.maghrib), hm(want.Maghrib), 3); near(local(t.isha), hm(want.Isha), 3)
    }
    check({ lat: -37.8136, lng: 144.9631, method: 'MWL', asr: 1 }, { Fajr: '04:50', Sunrise: '06:25', Dhuhr: '13:05', Asr: '16:47', Maghrib: '19:45', Isha: '21:14' })
    check({ lat: -33.8688, lng: 151.2093, method: 'MWL', asr: 2 }, { Fajr: '04:36', Sunrise: '06:05', Dhuhr: '12:40', Asr: '17:21', Maghrib: '19:15', Isha: '20:38' })
  })

  it('Hanafi Asr is later than Shafi', () => {
    const base = { lat: -33.87, lng: 151.21, method: 'MWL' as const }
    const a = prayerTimes(new Date(2026, 9, 23), { ...base, asr: 1 }).asr
    const b = prayerTimes(new Date(2026, 9, 23), { ...base, asr: 2 }).asr
    expect(b.getTime()).toBeGreaterThan(a.getTime())
  })

  it('offsets nudge a single prayer', () => {
    const s: PrayerSettings = { lat: -33.87, lng: 151.21, method: 'MWL', asr: 1 }
    const a = prayerTimes(new Date(2026, 9, 23), s).isha
    const b = prayerTimes(new Date(2026, 9, 23), { ...s, offsets: { isha: 5 } }).isha
    expect((b.getTime() - a.getTime()) / 60000).toBe(5)
  })

  it('next prayer rolls to tomorrow’s Fajr after Isha', () => {
    const s: PrayerSettings = { lat: -37.81, lng: 144.96, method: 'MWL', asr: 1 }
    const t = prayerTimes(new Date(2026, 9, 23), s)
    const after = new Date(t.isha.getTime() + 60_000)
    expect(nextPrayer(after, s).name).toBe('fajr')
    expect(nextPrayer(new Date(t.fajr.getTime() - 60_000), s).name).toBe('fajr')
    expect(nextPrayer(new Date(t.dhuhr.getTime() + 60_000), s).name).toBe('asr')
  })

  it('Qibla from Melbourne is west-northwest (~277°), from London south-east (~119°)', () => {
    expect(Math.abs(qiblaBearing(-37.8136, 144.9631) - 277)).toBeLessThanOrEqual(3)
    expect(Math.abs(qiblaBearing(51.5074, -0.1278) - 119)).toBeLessThanOrEqual(3)
  })

  it('Hijri date formats', () => {
    expect(hijriDate(new Date(2026, 9, 23))).toMatch(/AH$/)
  })
})
