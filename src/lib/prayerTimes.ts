// ============================================================
// PRAYER TIMES, QIBLA & HIJRI DATE (v10.2, owner request 23 Oct 2026).
// Pure, offline astronomy — the standard method used by PrayTimes.org and most
// prayer apps: sun declination + equation of time, then each prayer is the
// moment the sun reaches a set angle. Calculation methods differ only in the
// Fajr/Isha angles; Asr differs by school (Shafi'i ×1 / Hanafi ×2 shadow).
// Times are estimates for the chosen location — the app says so and lets the
// user nudge each one, like other prayer apps.
// ============================================================

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
export const PRAYER_ORDER: PrayerName[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
export const PRAYER_TITLE: Record<PrayerName, string> = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }

export type MethodId = 'MWL' | 'ISNA' | 'Egypt' | 'Makkah' | 'Karachi' | 'Gulf' | 'Singapore' | 'Turkey'
export const METHODS: Record<MethodId, { name: string; fajr: number; isha: number | { minutes: number } }> = {
  MWL: { name: 'Muslim World League', fajr: 18, isha: 17 },
  ISNA: { name: 'ISNA (North America)', fajr: 15, isha: 15 },
  Egypt: { name: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
  Makkah: { name: 'Umm al-Qura, Makkah', fajr: 18.5, isha: { minutes: 90 } },
  Karachi: { name: 'University of Islamic Sciences, Karachi', fajr: 18, isha: 18 },
  Gulf: { name: 'Gulf region', fajr: 19.5, isha: { minutes: 90 } },
  Singapore: { name: 'Singapore / Malaysia', fajr: 20, isha: 18 },
  Turkey: { name: 'Diyanet (Turkey)', fajr: 18, isha: 17 },
}

export interface PrayerSettings {
  lat: number
  lng: number
  city?: string
  method: MethodId
  /** 1 = Shafi'i, Maliki, Hanbali · 2 = Hanafi */
  asr: 1 | 2
  /** per-prayer minute nudges, like other prayer apps */
  offsets?: Partial<Record<PrayerName, number>>
}

export const CITY_PRESETS: { city: string; lat: number; lng: number }[] = [
  { city: 'Melbourne', lat: -37.8136, lng: 144.9631 }, { city: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { city: 'Brisbane', lat: -27.4698, lng: 153.0251 }, { city: 'Perth', lat: -31.9505, lng: 115.8605 },
  { city: 'Adelaide', lat: -34.9285, lng: 138.6007 }, { city: 'Canberra', lat: -35.2809, lng: 149.13 },
  { city: 'Hobart', lat: -42.8821, lng: 147.3272 }, { city: 'Darwin', lat: -12.4634, lng: 130.8456 },
  { city: 'Auckland', lat: -36.8485, lng: 174.7633 }, { city: 'London', lat: 51.5074, lng: -0.1278 },
  { city: 'Dubai', lat: 25.2048, lng: 55.2708 }, { city: 'Makkah', lat: 21.4225, lng: 39.8262 },
  { city: 'Beirut', lat: 33.8938, lng: 35.5018 }, { city: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { city: 'Cairo', lat: 30.0444, lng: 31.2357 }, { city: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { city: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 }, { city: 'Karachi', lat: 24.8607, lng: 67.0011 },
  { city: 'New York', lat: 40.7128, lng: -74.006 }, { city: 'Toronto', lat: 43.6532, lng: -79.3832 },
]

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const fix = (a: number, b: number) => { const x = a - b * Math.floor(a / b); return x < 0 ? x + b : x }

function julian(y: number, m: number, d: number): number {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

function sun(jd: number) {
  const D = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360)
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360)
  const e = 23.439 - 0.00000036 * D
  const RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15
  const eqt = q / 15 - fix(RA, 24)
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))))
  return { decl, eqt }
}

/**
 * Prayer times for a calendar date at a location, as Date objects in the
 * device's time zone. `date` only supplies the year/month/day.
 */
export function prayerTimes(date: Date, s: PrayerSettings): Record<PrayerName, Date> {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  const jd = julian(y, m, d) - s.lng / (15 * 24)
  const lat = s.lat
  // hours (UT-ish, before timezone) for a sun angle below the horizon
  const at = (t: number) => sun(jd + t / 24)
  const noon = (t: number) => fix(12 - at(t).eqt, 24)
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const { decl } = at(t)
    const c = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)))
    const T = deg(Math.acos(Math.max(-1, Math.min(1, c)))) / 15
    return noon(t) + (ccw ? -T : T)
  }
  const asrTime = (factor: number, t: number) => {
    const { decl } = at(t)
    const angle = -deg(Math.atan(1 / (factor + Math.tan(rad(Math.abs(lat - decl))))))
    return angleTime(angle, t, false)
  }
  const meth = METHODS[s.method] ?? METHODS.MWL
  // two passes, as PrayTimes does, for accuracy
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 }
  for (let i = 0; i < 2; i++) {
    t = {
      fajr: angleTime(meth.fajr, t.fajr / 24, true),
      sunrise: angleTime(0.833, t.sunrise / 24, true),
      dhuhr: noon(t.dhuhr / 24),
      asr: asrTime(s.asr, t.asr / 24),
      maghrib: angleTime(0.833, t.maghrib / 24, false),
      isha: typeof meth.isha === 'number' ? angleTime(meth.isha, t.isha / 24, false) : 0,
    }
  }
  if (typeof meth.isha !== 'number') t.isha = t.maghrib + meth.isha.minutes / 60
  t.dhuhr += 1 / 60 // a minute after the zenith, as is customary
  // hours (local mean time at lng) → real Date in this device's zone
  const base = Date.UTC(y, m - 1, d)
  const toDate = (h: number, key: PrayerName) => new Date(base + ((h - s.lng / 15) * 60 + (s.offsets?.[key] ?? 0)) * 60_000)
  const out = {} as Record<PrayerName, Date>
  for (const k of PRAYER_ORDER) out[k] = toDate(t[k], k)
  return out
}

export function nextPrayer(now: Date, s: PrayerSettings): { name: PrayerName; at: Date; prev: { name: PrayerName; at: Date } | null } {
  const today = prayerTimes(now, s)
  const order = PRAYER_ORDER.filter((p) => p !== 'sunrise')
  for (let i = 0; i < order.length; i++) {
    if (today[order[i]] > now) {
      const prevName = i > 0 ? order[i - 1] : null
      return { name: order[i], at: today[order[i]], prev: prevName ? { name: prevName, at: today[prevName] } : null }
    }
  }
  const tomorrow = new Date(now.getTime() + 86_400_000)
  return { name: 'fajr', at: prayerTimes(tomorrow, s).fajr, prev: { name: 'isha', at: today.isha } }
}

/** compass bearing from the user to the Kaaba, degrees clockwise from true north */
export function qiblaBearing(lat: number, lng: number): number {
  const k = { lat: 21.4225, lng: 39.8262 }
  const dl = rad(k.lng - lng)
  const b = Math.atan2(Math.sin(dl), Math.cos(rad(lat)) * Math.tan(rad(k.lat)) - Math.sin(rad(lat)) * Math.cos(dl))
  return Math.round(fix(deg(b), 360))
}

/** Hijri date via the platform's Umm al-Qura calendar (Safari and Chrome both ship it) */
export function hijriDate(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/\s*AH$/, '') + ' AH'
  } catch { return '' }
}

export function fmtClock(d: Date): string {
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}
