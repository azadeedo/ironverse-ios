// Muslim features (v10.2) — only shown when Halal mode is on (Settings → Food).
// Prayer-time settings live in one settings key (no schema change); prayer
// reminders are local iPhone notifications scheduled a week ahead.
import { getProfile, getSetting, setSetting } from '@/db'
import { halalMode } from '@/db/defaults'
import { PRAYER_TITLE, fmtClock, prayerTimes, type PrayerName, type PrayerSettings } from './prayerTimes'

export const MUSLIM_KEY = 'muslim:prayer'

export interface MuslimSettings extends PrayerSettings {
  /** remind me at each prayer (local notifications) */
  notify: boolean
  /** which prayers to remind (default: the five) */
  notifyFor?: PrayerName[]
  /** minutes before the prayer to remind (0 = at the time) */
  notifyBefore?: number
}

export const DEFAULT_MUSLIM: MuslimSettings = { lat: -37.8136, lng: 144.9631, city: 'Melbourne', method: 'MWL', asr: 1, notify: false }

export async function muslimSettings(): Promise<MuslimSettings> {
  return { ...DEFAULT_MUSLIM, ...(await getSetting<Partial<MuslimSettings>>(MUSLIM_KEY, {})) }
}

export async function saveMuslimSettings(patch: Partial<MuslimSettings>): Promise<MuslimSettings> {
  const next = { ...(await muslimSettings()), ...patch }
  await setSetting(MUSLIM_KEY, next)
  void schedulePrayerReminders(next)
  return next
}

export async function muslimOn(): Promise<boolean> {
  return halalMode(await getProfile())
}

/** device location via the browser API (WKWebView asks the iOS location permission) */
export function currentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is not available on this device')); return }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e4) / 1e4, lng: Math.round(p.coords.longitude * 1e4) / 1e4 }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied' : 'Could not get your location')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 3_600_000 },
    )
  })
}

const FIVE: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

/** (re)schedule the next 7 days of prayer reminders, or clear them */
export async function schedulePrayerReminders(s?: MuslimSettings): Promise<number> {
  const cfg = s ?? (await muslimSettings())
  const { cancelAt, scheduleAt } = await import('@/native/notifications')
  const on = cfg.notify && (await muslimOn())
  let n = 0
  for (let d = 0; d < 7; d++) {
    const day = new Date(Date.now() + d * 86_400_000)
    const t = prayerTimes(day, cfg)
    for (const p of FIVE) {
      const key = `prayer-${day.toISOString().slice(0, 10)}-${p}`
      const want = on && (cfg.notifyFor ?? FIVE).includes(p)
      if (!want) { await cancelAt(key); continue }
      const at = new Date(t[p].getTime() - (cfg.notifyBefore ?? 0) * 60_000)
      if (at.getTime() <= Date.now()) continue
      const ok = await scheduleAt(key, at, `${PRAYER_TITLE[p]} ${cfg.notifyBefore ? `in ${cfg.notifyBefore} min` : 'time'} 🕌`, `${PRAYER_TITLE[p]} at ${fmtClock(t[p])}${cfg.city ? ` · ${cfg.city}` : ''}`)
      if (ok) n++
    }
  }
  return n
}
