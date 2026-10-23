// /prayer — Prayer times, Qibla & Hijri date (v10.2, Muslim Pro-style).
// Only reachable/advertised when Halal mode is on. Times are calculated on the
// phone from your location and method (no internet), with per-prayer nudges.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Bell, Compass, LocateFixed, MapPin } from 'lucide-react'
import { Button, Card, PageHeader, Section, Select, Toggle } from '@/components/ui'
import { getProfile, db } from '@/db'
import { prayerConfig } from '@/db/defaults'
import { useUI } from '@/lib/store'
import { dayjs } from '@/lib/fmt'
import { CITY_PRESETS, METHODS, PRAYER_ORDER, PRAYER_TITLE, fmtClock, hijriDate, nextPrayer, prayerTimes, qiblaBearing, type MethodId, type PrayerName } from '@/lib/prayerTimes'
import { currentLocation, muslimOn, muslimSettings, saveMuslimSettings, schedulePrayerReminders } from '@/lib/muslim'
import { countdown } from './today/PrayerBanner'

export default function PrayerScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const on = useLiveQuery(() => muslimOn(), [])
  const s = useLiveQuery(() => muslimSettings(), [])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  const [locating, setLocating] = useState(false)

  const week = useMemo(() => (s ? Array.from({ length: 7 }, (_, i) => { const d = new Date(now.getTime() + i * 86_400_000); return { d, t: prayerTimes(d, s) } }) : []), [s, now.toDateString()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (on === false) {
    return (
      <div><PageHeader title="Prayer times" back />
        <Section><Card className="p-4 text-[13.5px] text-ink2">Prayer times, Qibla and prayer reminders appear when <b>Halal mode</b> is on.
          <Button full className="mt-3" onClick={() => navigate('/settings?s=food-energy')}>Open Settings → Halal mode</Button></Card></Section>
      </div>
    )
  }
  if (!s) return null
  const t = prayerTimes(now, s)
  const next = nextPrayer(now, s)

  async function useMyLocation() {
    setLocating(true)
    try {
      const p = await currentLocation()
      await saveMuslimSettings({ ...p, city: 'My location' })
      toast('Location set — prayer times updated')
    } catch (e) { toast((e as Error).message, 'error') } finally { setLocating(false) }
  }
  async function useForScheduling() {
    const me = await getProfile(); if (!me) return
    const hm = (d: Date) => dayjs(d).format('HH:mm')
    await db.profile.put({ ...me, prayer: { ...prayerConfig(me), enabled: true, times: { fajr: hm(t.fajr), dhuhr: hm(t.dhuhr), asr: hm(t.asr), maghrib: hm(t.maghrib), isha: hm(t.isha) } } })
    toast('Workouts will now be planned around today’s prayer times')
  }

  return (
    <div className="pb-14">
      <PageHeader title="Prayer times" back subtitle={`${hijriDate(now)} · ${dayjs(now).format('dddd D MMMM')}`} />

      <Section>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-700/70 via-emerald-900/60 to-surface2 p-5 text-center shadow-card">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-emerald-200">Next prayer</div>
          <div className="mt-1 text-[28px] font-black text-white">{PRAYER_TITLE[next.name]}</div>
          <div className="text-[15px] text-emerald-100">{fmtClock(next.at)} · in {countdown(next.at.getTime() - now.getTime())}</div>
          <div className="mt-1 flex items-center justify-center gap-1 text-[12px] text-emerald-200/90"><MapPin size={12} /> {s.city ?? `${s.lat}, ${s.lng}`}</div>
        </div>
      </Section>

      <Section title="Today">
        <Card className="divide-y divide-line px-4">
          {PRAYER_ORDER.map((p) => {
            const isNext = p === next.name && next.at.toDateString() === now.toDateString()
            return (
              <div key={p} className={`flex items-center justify-between py-3 ${isNext ? 'text-emerald-300' : t[p] < now ? 'text-ink3' : ''}`}>
                <span className="text-[15px] font-semibold">{PRAYER_TITLE[p]}{isNext && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px]">next</span>}</span>
                <span className="big-num text-[16px]">{fmtClock(t[p])}</span>
              </div>
            )
          })}
        </Card>
      </Section>

      <Section title="Qibla">
        <QiblaCompass bearing={qiblaBearing(s.lat, s.lng)} />
      </Section>

      <Section title="Reminders">
        <Card className="space-y-3 p-4 text-[13px]">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-emerald-400" />
            <div className="flex-1"><div className="font-semibold">Remind me at each prayer</div><div className="text-[12px] text-ink3">A notification on this iPhone — no sound file, no internet.</div></div>
            <Toggle checked={s.notify} label="Prayer reminders" onChange={(v) => void saveMuslimSettings({ notify: v }).then(() => toast(v ? 'Prayer reminders on for the next 7 days' : 'Prayer reminders off'))} />
          </div>
          {s.notify && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => {
                  const sel = (s.notifyFor ?? ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']).includes(p)
                  return <button key={p} type="button" aria-pressed={sel} onClick={() => { const cur = s.notifyFor ?? ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']; void saveMuslimSettings({ notifyFor: sel ? cur.filter((x) => x !== p) : [...cur, p] }) }}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${sel ? 'bg-emerald-500 text-black' : 'bg-surface3 text-ink2'}`}>{PRAYER_TITLE[p]}</button>
                })}
              </div>
              <div className="flex items-center gap-2"><span className="flex-1 text-ink2">Remind me</span>
                {[0, 5, 10, 15].map((m) => <button key={m} type="button" onClick={() => void saveMuslimSettings({ notifyBefore: m })} className={`rounded-lg px-2.5 py-1 font-bold ${(s.notifyBefore ?? 0) === m ? 'bg-emerald-500 text-black' : 'bg-surface3 text-ink2'}`}>{m ? `${m} min before` : 'on time'}</button>)}
              </div>
            </>
          )}
        </Card>
      </Section>

      <Section title="Location & method">
        <Card className="space-y-3 p-4 text-[13px]">
          <Button full variant="secondary" disabled={locating} onClick={() => void useMyLocation()}><LocateFixed size={16} /> {locating ? 'Finding you…' : 'Use my location'}</Button>
          <label className="block text-[12px] text-ink3">Or pick a city
            <Select value={CITY_PRESETS.find((c) => c.city === s.city)?.city ?? ''} onChange={(e) => { const c = CITY_PRESETS.find((x) => x.city === e.target.value); if (c) void saveMuslimSettings({ ...c }) }}>
              <option value="">{s.city === 'My location' ? 'My location' : 'Choose…'}</option>
              {CITY_PRESETS.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
            </Select>
          </label>
          <label className="block text-[12px] text-ink3">Calculation method
            <Select value={s.method} onChange={(e) => void saveMuslimSettings({ method: e.target.value as MethodId })}>
              {(Object.keys(METHODS) as MethodId[]).map((m) => <option key={m} value={m}>{METHODS[m].name}</option>)}
            </Select>
          </label>
          <div>
            <div className="mb-1 text-[12px] text-ink3">Asr</div>
            <div className="grid grid-cols-2 gap-2">
              {([[1, 'Standard (Shafi‘i, Maliki, Hanbali)'], [2, 'Hanafi']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => void saveMuslimSettings({ asr: v })} className={`rounded-xl px-2 py-2 text-[12.5px] font-semibold ${s.asr === v ? 'bg-emerald-500 text-black' : 'bg-surface3 text-ink2'}`}>{l}</button>
              ))}
            </div>
          </div>
          <details>
            <summary className="cursor-pointer text-[12.5px] font-semibold text-ink2">Adjust a time by a few minutes</summary>
            <div className="mt-2 space-y-1.5">
              {PRAYER_ORDER.map((p) => (
                <div key={p} className="flex items-center gap-2"><span className="w-20">{PRAYER_TITLE[p]}</span>
                  <button type="button" className="rounded-lg bg-surface3 px-2.5 py-1" onClick={() => void saveMuslimSettings({ offsets: { ...(s.offsets ?? {}), [p]: (s.offsets?.[p] ?? 0) - 1 } })}>−1</button>
                  <span className="w-10 text-center">{(s.offsets?.[p] ?? 0) > 0 ? '+' : ''}{s.offsets?.[p] ?? 0}</span>
                  <button type="button" className="rounded-lg bg-surface3 px-2.5 py-1" onClick={() => void saveMuslimSettings({ offsets: { ...(s.offsets ?? {}), [p]: (s.offsets?.[p] ?? 0) + 1 } })}>+1</button>
                </div>
              ))}
            </div>
          </details>
          <Button full variant="secondary" onClick={() => void useForScheduling()}>Plan workouts around today’s prayers</Button>
          <p className="text-[11.5px] text-ink3">Calculated on your phone from the location and method above (the same astronomy prayer apps use). Check against your local mosque timetable and nudge any time if it differs.</p>
        </Card>
      </Section>

      <Section title="Next 7 days">
        <Card className="overflow-x-auto p-3">
          <table className="w-full text-center text-[11.5px]">
            <thead><tr className="text-ink3"><th className="text-left">Day</th>{(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => <th key={p}>{PRAYER_TITLE[p]}</th>)}</tr></thead>
            <tbody>{week.map(({ d, t: w }) => (
              <tr key={d.toDateString()} className="border-t border-line"><td className="py-1.5 text-left font-semibold">{dayjs(d).format('ddd D')}</td>{(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerName[]).map((p) => <td key={p}>{fmtClock(w[p]).replace(/\s?(am|pm)$/i, '')}</td>)}</tr>
            ))}</tbody>
          </table>
        </Card>
        <div className="mt-2 px-1"><Button small variant="secondary" onClick={() => void schedulePrayerReminders().then((n) => toast(n ? `${n} reminders scheduled` : 'Reminders are off'))}>Refresh reminders</Button></div>
      </Section>
    </div>
  )
}

/** live compass: iPhone gives a compass heading after permission; the arrow points to the Kaaba */
function QiblaCompass({ bearing }: { bearing: number }) {
  const [heading, setHeading] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  async function start() {
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }
    const D = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as DOE | undefined
    if (!D) { setMsg('This device has no compass.'); return }
    try { if (D.requestPermission && (await D.requestPermission()) !== 'granted') { setMsg('Motion & orientation access was not allowed.'); return } } catch { /* older iOS */ }
    window.addEventListener('deviceorientation', (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const h = e.webkitCompassHeading ?? (e.alpha !== null ? 360 - e.alpha : null)
      if (h !== null && h !== undefined) setHeading(h)
    })
    setMsg(null)
  }
  const rot = heading === null ? bearing : bearing - heading
  const aligned = heading !== null && Math.abs(((rot % 360) + 540) % 360 - 180) < 5
  return (
    <Card className="flex flex-col items-center p-4 text-[13px]">
      <div className={`relative h-48 w-48 rounded-full border-4 ${aligned ? 'border-emerald-400' : 'border-line'} bg-surface3/50`}>
        {heading !== null && <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[11px] font-bold text-ink3">N</div>}
        <div className="absolute inset-0 flex items-center justify-center transition-transform duration-200" style={{ transform: `rotate(${rot}deg)` }}>
          <div className="flex h-full flex-col items-center pt-3"><span className="text-[26px]">🕋</span><div className="mt-1 h-16 w-1.5 rounded-full bg-emerald-400" /></div>
        </div>
      </div>
      <div className="mt-3 font-semibold">{bearing}° from north{aligned ? ' — you’re facing the Qibla ✓' : ''}</div>
      {heading === null
        ? <Button small className="mt-2" onClick={() => void start()}><Compass size={14} /> Start compass</Button>
        : <div className="mt-1 text-[12px] text-ink3">Hold your phone flat, away from metal and magnets.</div>}
      {msg && <div className="mt-1 text-[12px] text-amber-300">{msg}</div>}
    </Card>
  )
}
