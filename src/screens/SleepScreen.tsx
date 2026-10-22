// /sleep — Sleep & recovery (v10, owner request 23 Oct 2026).
// Morning check-in (how did you sleep, hours, what might have affected it),
// Apple Watch sleep via Apple Health, 14-night chart, debt and consistency,
// what YOUR log says affects your sleep, today's recovery score, bedtime and
// morning reminders, and plain-English research with sources.

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Moon } from 'lucide-react'
import { Button, Card, Input, PageHeader, Section, Toggle } from '@/components/ui'
import { db, getSetting, setSetting } from '@/db'
import { dayjs } from '@/lib/fmt'
import { todayStr } from '@/lib/id'
import { saveCheckin } from '@/lib/programStore'
import { useUI } from '@/lib/store'
import { isNativeApp } from '@/lib/edition'
import { SLEEP_FACES, SLEEP_FACTORS, SLEEP_RESEARCH, SLEEP_WORDS, factorEffects, hoursBetween, recoveryScore, summarise } from '@/lib/sleep'
import { HEALTH_KEYS, syncAppleHealth } from '@/native/health'
import { cancelDaily, scheduleDaily } from '@/native/notifications'

export const SLEEP_KEYS = { target: 'sleep:targetHours', bedtime: 'sleep:bedtimeReminder', morning: 'sleep:morningReminder' } as const

export default function SleepScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const today = todayStr()
  const rows = useLiveQuery(() => db.checkins.where('date').aboveOrEqual(dayjs().subtract(60, 'day').format('YYYY-MM-DD')).toArray(), [])
  const target = useLiveQuery(() => getSetting<number>(SLEEP_KEYS.target, 8), []) ?? 8
  const bedRem = useLiveQuery(() => getSetting<string | null>(SLEEP_KEYS.bedtime, null), [])
  const mornRem = useLiveQuery(() => getSetting<string | null>(SLEEP_KEYS.morning, null), [])
  const healthOn = useLiveQuery(() => getSetting<boolean>(HEALTH_KEYS.connected, false), [])
  const todayRow = rows?.find((r) => r.date === today)

  const [rating, setRating] = useState<number | null>(null)
  const [bed, setBed] = useState('22:30')
  const [wake, setWake] = useState('06:30')
  const [hours, setHours] = useState('')
  const [factors, setFactors] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!todayRow) return
    setRating(todayRow.sleep ?? null)
    if (todayRow.bedTime) setBed(todayRow.bedTime)
    if (todayRow.wakeTime) setWake(todayRow.wakeTime)
    if (todayRow.sleepHours) setHours(String(todayRow.sleepHours))
    setFactors(todayRow.sleepFactors ?? [])
    setNote(todayRow.sleepNote ?? '')
  }, [todayRow?.date, todayRow?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => dayjs().subtract(13 - i, 'day').format('YYYY-MM-DD')).map((d) => ({ d, r: rows?.find((x) => x.date === d) })), [rows])
  const sum14 = useMemo(() => summarise(last14.map((x) => x.r).filter((r): r is NonNullable<typeof r> => !!r), target), [last14, target])
  const effects = useMemo(() => factorEffects(rows ?? []), [rows])
  const recovery = useMemo(() => recoveryScore(todayRow, rows ?? [], target), [todayRow, rows, target])
  const logged = !!todayRow && (todayRow.sleep !== undefined || todayRow.sleepHours !== undefined)
  const showForm = !logged || editing

  async function save() {
    const typed = parseFloat(hours)
    const h = typed > 0 && typed < 16 ? typed : hoursBetween(bed, wake)
    await saveCheckin({ date: today, sleep: rating ?? undefined, bedTime: bed, wakeTime: wake, sleepHours: h ?? undefined, sleepFactors: factors, sleepNote: note.trim() || undefined, sleepSource: todayRow?.sleepSource === 'health' && !(typed > 0) ? 'health' : 'manual' })
    setEditing(false)
    toast(rating ? `Sleep saved — ${SLEEP_WORDS[rating - 1].toLowerCase()} night` : 'Sleep saved')
  }

  async function setReminder(kind: 'bedtime' | 'morning', time: string | null) {
    const key = kind === 'bedtime' ? SLEEP_KEYS.bedtime : SLEEP_KEYS.morning
    await setSetting(key, time)
    if (!time) { await cancelDaily(kind); toast('Reminder off'); return }
    const [hh, mm] = time.split(':').map(Number)
    const ok = await scheduleDaily(kind, hh, mm,
      kind === 'bedtime' ? 'Wind down 🌙' : 'Good morning ☀️',
      kind === 'bedtime' ? `Lights out in 30 minutes for ${target} hours of sleep. Phone down, room cool and dark.` : 'How did you sleep? Rate it in 5 seconds — it sets today’s recovery score.')
    toast(ok ? `Reminder set for ${time}` : isNativeApp() ? 'Allow notifications in Settings to get reminders' : 'Saved — reminders fire in the iPhone app')
  }

  const maxH = Math.max(target + 1, ...last14.map((x) => x.r?.sleepHours ?? 0))
  const zoneColour = recovery.zone === 'green' ? 'text-emerald-400' : recovery.zone === 'amber' ? 'text-amber-400' : recovery.zone === 'red' ? 'text-red-400' : 'text-ink3'

  return (
    <div className="pb-14">
      <PageHeader title="Sleep & recovery" back subtitle="Sleep is when the training turns into muscle." />

      <Section title="Today’s recovery">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className={`big-num text-[44px] leading-none ${zoneColour}`}>{recovery.score ?? '—'}</div>
            <div className="text-[13px] text-ink2">{recovery.advice}</div>
          </div>
          {recovery.parts.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-line pt-2 text-[12.5px]">
              {recovery.parts.map((p) => <div key={p.label} className="flex justify-between"><span className="text-ink3">{p.label}</span><span>{p.value}</span></div>)}
            </div>
          )}
          {!healthOn && isNativeApp() && <button type="button" onClick={() => navigate('/devices')} className="mt-2 text-[12px] font-semibold text-brand">❤️ Connect Apple Health for Watch sleep, resting heart rate and HRV →</button>}
        </Card>
      </Section>

      <Section title={logged && !editing ? 'Last night' : 'How did you sleep?'}>
        {showForm ? (
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-5 gap-1.5">
              {SLEEP_FACES.map((f, i) => (
                <button key={f} type="button" aria-pressed={rating === i + 1} onClick={() => setRating(i + 1)}
                  className={`pressable flex flex-col items-center rounded-xl py-2 ${rating === i + 1 ? 'bg-brand/20 ring-2 ring-brand' : 'bg-surface3'}`}>
                  <span className="text-[26px]">{f}</span><span className="text-[10.5px] text-ink2">{SLEEP_WORDS[i]}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11.5px] text-ink3">
              <label>In bed<Input type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></label>
              <label>Woke up<Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></label>
              <label>Hours asleep<Input inputMode="decimal" placeholder={String(hoursBetween(bed, wake) ?? '')} value={hours} onChange={(e) => setHours(e.target.value)} /></label>
            </div>
            {todayRow?.sleepSource === 'health' && <div className="text-[11.5px] text-ink3">❤️ Hours came from Apple Health — type a number to override.</div>}
            <div>
              <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink3">Anything that might have affected it?</div>
              <div className="flex flex-wrap gap-1.5">
                {SLEEP_FACTORS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={factors.includes(f.id)} onClick={() => setFactors((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))}
                    className={`pressable rounded-full px-3 py-1.5 text-[12px] font-semibold ${factors.includes(f.id) ? 'bg-brand text-black' : 'bg-surface3 text-ink2'}`}>{f.emoji} {f.label}</button>
                ))}
              </div>
            </div>
            <Input placeholder="Note (optional) — dreams, woke at 3 am…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button full disabled={!rating && !hours && !hoursBetween(bed, wake)} onClick={() => void save()}><Moon size={16} /> Save last night</Button>
          </Card>
        ) : (
          <Card className="p-4 text-[13px]">
            <div className="flex items-center gap-3">
              <span className="text-[36px]">{todayRow?.sleep ? SLEEP_FACES[todayRow.sleep - 1] : '🛌'}</span>
              <div className="flex-1">
                <b className="text-[16px]">{todayRow?.sleepHours ? `${todayRow.sleepHours} h · ` : ''}{todayRow?.sleep ? SLEEP_WORDS[todayRow.sleep - 1] : 'not rated'}</b>
                <div className="text-ink3">{todayRow?.bedTime && todayRow.wakeTime ? `${todayRow.bedTime} → ${todayRow.wakeTime}` : ''}{todayRow?.sleepSource === 'health' ? ' · Apple Health' : ''}</div>
              </div>
              <Button small variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            </div>
            {todayRow?.sleepStages && (todayRow.sleepStages.deep || todayRow.sleepStages.rem) ? (
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                {([['Deep', todayRow.sleepStages.deep], ['REM', todayRow.sleepStages.rem], ['Core', todayRow.sleepStages.core], ['Awake', todayRow.sleepStages.awake]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-surface3 py-1.5"><b className="block text-[14px]">{v ? `${Math.floor(v / 60)}h ${v % 60}m` : '—'}</b>{l}</div>
                ))}
              </div>
            ) : null}
            {!!todayRow?.sleepFactors?.length && <div className="mt-2 text-ink3">{todayRow.sleepFactors.map((id) => SLEEP_FACTORS.find((f) => f.id === id)?.label).filter(Boolean).join(' · ')}</div>}
            {!rating && <div className="mt-2 text-[12px] text-brand">Tap Edit to rate how it felt — it sharpens your recovery score.</div>}
          </Card>
        )}
      </Section>

      <Section title="Last 14 nights">
        <Card className="p-4">
          <div className="flex h-[120px] items-end gap-1">
            {last14.map(({ d, r }) => {
              const h = r?.sleepHours ?? 0
              const col = !h ? 'bg-surface3' : h >= target ? 'bg-emerald-500' : h >= target - 1.5 ? 'bg-amber-500' : 'bg-red-500'
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px]">{r?.sleep ? SLEEP_FACES[r.sleep - 1] : ''}</span>
                  <div className={`w-full rounded-t ${col}`} style={{ height: `${Math.max(4, (h / maxH) * 84)}px` }} title={`${d}: ${h || '—'} h`} />
                  <span className="text-[9.5px] text-ink3">{dayjs(d).format('dd')[0]}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface3 py-2"><b className="big-num block text-[17px]">{sum14.avgHours ?? '—'}</b><span className="text-[11px] text-ink3">avg hours</span></div>
            <div className="rounded-xl bg-surface3 py-2"><b className="big-num block text-[17px]">{sum14.debtHours ? `${sum14.debtHours} h` : '0'}</b><span className="text-[11px] text-ink3">sleep debt</span></div>
            <div className="rounded-xl bg-surface3 py-2"><b className="big-num block text-[17px]">{sum14.consistency ?? '—'}</b><span className="text-[11px] text-ink3">consistency</span></div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12.5px]">
            <span className="flex-1 text-ink2">Your nightly target</span>
            {[7, 7.5, 8, 8.5, 9].map((t) => <button key={t} type="button" onClick={() => void setSetting(SLEEP_KEYS.target, t)} className={`rounded-lg px-2 py-1 font-bold ${target === t ? 'bg-brand text-black' : 'bg-surface3 text-ink2'}`}>{t}h</button>)}
          </div>
        </Card>
      </Section>

      <Section title="What affects YOUR sleep">
        <Card className="p-4 text-[13px]">
          {effects.length === 0
            ? <p className="text-ink3">Tag what happened on a few nights (caffeine, alcohol, phone in bed…). Once a factor has 3 nights with and 3 without, this shows how much it changes your rating.</p>
            : effects.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-1">
                <span>{e.emoji} {e.label} <span className="text-ink3">({e.nightsWith} nights)</span></span>
                <b className={e.delta < 0 ? 'text-red-400' : 'text-emerald-400'}>{e.delta > 0 ? '+' : ''}{e.delta} rating</b>
              </div>
            ))}
        </Card>
      </Section>

      <Section title="Reminders">
        <Card className="space-y-3 p-4 text-[13px]">
          {([['bedtime', 'Wind-down reminder', '30 minutes before lights out', bedRem, '22:00'], ['morning', 'Morning check-in', 'Rate last night in 5 seconds', mornRem, '07:00']] as const).map(([kind, label, sub, cur, def]) => (
            <div key={kind} className="flex items-center gap-3">
              <div className="flex-1"><div className="font-semibold">{label}</div><div className="text-[12px] text-ink3">{sub}</div></div>
              {cur && <Input type="time" className="w-[110px]" value={cur} onChange={(e) => void setReminder(kind, e.target.value)} />}
              <Toggle checked={!!cur} label={label} onChange={(on) => void setReminder(kind, on ? def : null)} />
            </div>
          ))}
        </Card>
      </Section>

      {healthOn && (
        <div className="px-4 pt-2"><Button full variant="secondary" onClick={() => void syncAppleHealth(14).then(() => toast('Synced sleep from Apple Health'))}>❤️ Sync sleep from Apple Health</Button></div>
      )}

      <Section title="The science, in plain English">
        <div className="space-y-2">
          {SLEEP_RESEARCH.map((r) => (
            <Card key={r.title} className="p-3.5 text-[13px]">
              <b className="text-[14px]">{r.title}</b>
              <p className="mt-1 text-ink2">{r.body}</p>
              <p className="mt-1 text-[11px] text-ink3">{r.source}</p>
            </Card>
          ))}
          <p className="px-1 text-[11px] text-ink3">General information, not medical advice. If you snore loudly, stop breathing at night or are exhausted despite enough sleep, see your GP.</p>
        </div>
      </Section>
    </div>
  )
}
