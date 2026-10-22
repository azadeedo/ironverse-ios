// Quick log (v10, owner request 23 Oct 2026): the everyday actions in one sheet,
// two taps from anywhere — water, creatine, weight and sleep right here; food,
// workout, cardio, photos, fasting and measurements one tap away.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { Button, Input, Sheet } from '@/components/ui'
import { db, getProfile } from '@/db'
import { newId, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { saveCheckin } from '@/lib/programStore'
import { SLEEP_FACES, SLEEP_WORDS } from '@/lib/sleep'
import { upsertTodayWeighIn } from '@/screens/settings/lib'

export function QuickLogButton({ className = '' }: { className?: string }) {
  // ?quick=1 (home-screen quick action) opens it straight away
  const [open, setOpen] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('quick') === '1')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Quick log"
        className={`pressable flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-black shadow-lg shadow-brand/30 ${className}`}>
        <Plus size={16} strokeWidth={2.6} /> Log
      </button>
      {open && <QuickLogSheet onClose={() => setOpen(false)} />}
    </>
  )
}

export function QuickLogSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { toast } = useUI()
  const today = todayStr()
  const waterMl = useLiveQuery(async () => (await db.waterLog.where('date').equals(today).toArray()).reduce((s, w) => s + w.ml, 0), [today]) ?? 0
  const creatine = useLiveQuery(() => db.creatineLog.where('date').equals(today).first(), [today])
  const checkin = useLiveQuery(() => db.checkins.get(today), [today])
  const latest = useLiveQuery(() => db.weighIns.orderBy('date').last(), [])
  const [kg, setKg] = useState('')

  const go = (to: string) => { onClose(); navigate(to) }
  async function water(ml: number) {
    await db.waterLog.put({ id: newId(), date: today, ml, at: new Date().toISOString() })
    toast(`+${ml} ml water`)
  }
  async function creatineTaken() {
    await db.creatineLog.put({ id: creatine?.id ?? newId(), date: today, taken: true, at: new Date().toISOString() })
    toast('Creatine logged')
  }
  async function weight() {
    const v = parseFloat(kg.replace(',', '.'))
    if (!(v >= 30 && v <= 300)) return
    const k = Math.round(v * 10) / 10
    await upsertTodayWeighIn(k)
    const p = await getProfile()
    if (p) await db.profile.put({ ...p, weightKg: k })
    setKg('')
    toast(`Weighed in at ${k} kg`)
  }

  const tile = 'pressable flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl bg-surface3 px-1 text-center text-[12px] font-semibold'
  return (
    <Sheet open onClose={onClose} title="Quick log">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-[12px] font-semibold uppercase tracking-wide text-ink3"><span>💧 Water</span><span>{(waterMl / 1000).toFixed(1)} L today</span></div>
          <div className="grid grid-cols-3 gap-2">
            {[250, 500, 750].map((ml) => <button key={ml} type="button" onClick={() => void water(ml)} className={`${tile} text-sky-300`}>+{ml} ml</button>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!!creatine?.taken} onClick={() => void creatineTaken()} className={`${tile} ${creatine?.taken ? 'text-emerald-400' : ''}`}>💊 {creatine?.taken ? 'Creatine ✓' : 'Took creatine'}</button>
          <div className="flex items-center gap-1.5 rounded-2xl bg-surface3 px-2">
            <span className="text-[16px]">⚖️</span>
            <Input inputMode="decimal" aria-label="Weight in kg" placeholder={latest ? `${latest.weightKg}` : 'kg'} value={kg} onChange={(e) => setKg(e.target.value)} />
            <Button small onClick={() => void weight()} disabled={!kg}>Save</Button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">🌙 Last night’s sleep {checkin?.sleep ? `· ${SLEEP_WORDS[checkin.sleep - 1]}` : ''}</div>
          <div className="grid grid-cols-5 gap-1.5">
            {SLEEP_FACES.map((f, i) => (
              <button key={f} type="button" aria-label={`Slept ${SLEEP_WORDS[i]}`} onClick={() => void saveCheckin({ date: today, sleep: i + 1 }).then(() => toast(`Sleep: ${SLEEP_WORDS[i].toLowerCase()}`))}
                className={`pressable rounded-xl py-1.5 text-[22px] ${checkin?.sleep === i + 1 ? 'bg-brand/25 ring-2 ring-brand' : 'bg-surface3'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([['🍽️', 'Food', '/food'], ['🏋️', 'Workout', '/workout'], ['🏃', 'Cardio', '/cardio'], ['📸', 'Progress photo', '/photos'], ['⏱️', 'Fasting', '/fasting'], ['📏', 'Measurements', '/progress?tab=body']] as const).map(([i, l, to]) => (
            <button key={to} type="button" onClick={() => go(to)} className={tile}><span className="text-[20px]">{i}</span>{l}</button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
