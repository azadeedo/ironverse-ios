// Today → live prayer banner (v10.2). Shown ONLY when Halal mode is on.
// Next prayer with a live countdown, all five times for today, Hijri date.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { muslimSettings, muslimOn } from '@/lib/muslim'
import { PRAYER_TITLE, fmtClock, hijriDate, nextPrayer, prayerTimes, type PrayerName } from '@/lib/prayerTimes'

export function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

export function PrayerBanner() {
  const navigate = useNavigate()
  const on = useLiveQuery(() => muslimOn(), [])
  const s = useLiveQuery(() => muslimSettings(), [])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 20_000); return () => clearInterval(id) }, [])
  if (!on || !s) return null
  const t = prayerTimes(now, s)
  const next = nextPrayer(now, s)
  const five: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
  return (
    <button type="button" onClick={() => navigate('/prayer')} className="pressable block w-full text-left">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700/70 via-emerald-900/60 to-surface2 p-4 shadow-card">
        <div className="flex items-start gap-2">
          <span className="text-[22px]" aria-hidden>🕌</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">{hijriDate(now)}{s.city ? ` · ${s.city}` : ''}</div>
            <div className="mt-0.5 text-[17px] font-bold text-white">{PRAYER_TITLE[next.name]} at {fmtClock(next.at)}</div>
            <div className="text-[13px] text-emerald-100/90">in {countdown(next.at.getTime() - now.getTime())}</div>
          </div>
          <ChevronRight size={18} className="mt-1 text-emerald-200/80" />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 text-center">
          {five.map((p) => {
            const isNext = p === next.name && next.at.toDateString() === now.toDateString()
            const past = t[p] < now && !isNext
            return (
              <div key={p} className={`rounded-lg py-1.5 ${isNext ? 'bg-white/20 ring-1 ring-emerald-200/60' : 'bg-black/15'}`}>
                <div className={`text-[10.5px] font-semibold ${past ? 'text-emerald-100/50' : 'text-emerald-100'}`}>{PRAYER_TITLE[p]}</div>
                <div className={`text-[12px] font-bold ${past ? 'text-white/50' : 'text-white'}`}>{fmtClock(t[p]).replace(/\s?(am|pm)$/i, '')}</div>
              </div>
            )
          })}
        </div>
      </div>
    </button>
  )
}
