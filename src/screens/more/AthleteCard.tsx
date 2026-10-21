// More tab — athlete profile (from your reference): photo kept on this phone,
// level + XP, goal progress, program week and real records. Every number comes
// from your logs; tap through to the hub for the detail.
import { useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, Trophy } from 'lucide-react'
import { db, getSetting, setSetting } from '@/db'
import { Card } from '@/components/ui'
import type { Plan, Profile } from '@/db/types'
import { trophies, xp } from '@/lib/progressHub'
import { programWeekFor } from '@/lib/program12'
import { todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'

const PHOTO_KEY = 'profile:photo'

export function AthleteCard({ profile, plan }: { profile: Profile; plan: Plan | null | undefined }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const photo = useLiveQuery(() => getSetting<string>(PHOTO_KEY, ''), [])
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const weighIns = useLiveQuery(() => db.weighIns.toArray(), [])
  const stats = useMemo(() => {
    if (!logs || !weighIns) return null
    const tro = trophies(logs, weighIns, profile.startWeightKg, plan)
    const lv = xp(logs, weighIns, tro.length)
    const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date))
    const start = profile.startWeightKg ?? sorted[0]?.weightKg ?? profile.weightKg
    const now = sorted[sorted.length - 1]?.weightKg ?? profile.weightKg
    const goal = profile.goalWeightKg ?? 85
    const pct = start !== goal ? Math.max(0, Math.min(100, ((start - now) / (start - goal)) * 100)) : 0
    return { tro: tro.length, lv, start, now, goal, pct, sessions: logs.filter((l) => l.finishedAt && !l.skipped).length }
  }, [logs, weighIns, profile, plan])
  const week = plan?.program === 'p12' ? programWeekFor(plan, todayStr()) : null

  function pickPhoto(f: File | undefined) {
    if (!f) return
    const img = new Image(), url = URL.createObjectURL(f)
    img.onload = () => {
      const s = 240, c = document.createElement('canvas'); c.width = s; c.height = s
      const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k
      c.getContext('2d')!.drawImage(img, (s - w) / 2, (s - h) / 2, w, h)
      void setSetting(PHOTO_KEY, c.toDataURL('image/jpeg', 0.85)).then(() => toast('Profile photo saved on this phone'))
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  if (!stats) return null
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-brand/25 via-surface2 to-surface2 p-4">
        <div className="flex items-center gap-3.5">
          <button type="button" aria-label="Change profile photo" onClick={() => fileRef.current?.click()} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-amber-600 shadow-md shadow-brand/25">
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="shout flex h-full w-full items-center justify-center text-[26px] text-white">{(profile.name.trim()[0] ?? 'I').toUpperCase()}</span>}
            <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/60 p-0.5"><Camera size={11} className="text-white" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-brand">Level {stats.lv.level} athlete</div>
            <div className="truncate text-[19px] font-bold">{profile.name}</div>
            <div className="mt-1 h-1.5 rounded-full bg-surface3"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.round((stats.lv.into / stats.lv.need) * 100)}%` }} /></div>
            <div className="mt-0.5 text-[11px] text-ink3">{stats.lv.into} / {stats.lv.need} XP to level {stats.lv.level + 1}</div>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => navigate('/hub')} className="grid w-full grid-cols-4 gap-1.5 p-3 text-center">
        {[['Goal', `${stats.now}→${stats.goal}`], ['Progress', `${Math.round(stats.pct)}%`], ['Program', week?.started ? `Wk ${week.week}/12` : '—'], ['Records', String(stats.tro)]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-surface3/70 p-2"><div className="text-[10.5px] text-ink3">{l}</div><b className="text-[13px]">{v}</b></div>
        ))}
      </button>
      <button type="button" onClick={() => navigate('/hub')} className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-ink2">
        <Trophy size={14} className="text-amber-400" /> {stats.sessions} workouts logged · trophies, XP and muscles in the Progress hub <ChevronRight size={14} className="ml-auto" />
      </button>
    </Card>
  )
}
