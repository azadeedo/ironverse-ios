// Today → Sleep & recovery (v10). Before you've rated last night: five faces,
// one tap saves it. After: hours, rating and today's recovery score with advice.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui'
import { db, getSetting } from '@/db'
import { dayjs } from '@/lib/fmt'
import { todayStr } from '@/lib/id'
import { saveCheckin } from '@/lib/programStore'
import { SLEEP_FACES, SLEEP_WORDS, recoveryScore } from '@/lib/sleep'

export function SleepRecoveryCard() {
  const navigate = useNavigate()
  const today = todayStr()
  const rows = useLiveQuery(() => db.checkins.where('date').aboveOrEqual(dayjs().subtract(21, 'day').format('YYYY-MM-DD')).toArray(), [])
  const target = useLiveQuery(() => getSetting<number>('sleep:targetHours', 8), []) ?? 8
  if (!rows) return null
  const t = rows.find((r) => r.date === today)
  const rec = recoveryScore(t, rows, target)
  const colour = rec.zone === 'green' ? 'text-emerald-400' : rec.zone === 'amber' ? 'text-amber-400' : rec.zone === 'red' ? 'text-red-400' : 'text-ink3'

  if (!t?.sleep) {
    return (
      <Card className="p-4">
        <button type="button" onClick={() => navigate('/sleep')} className="flex w-full items-center gap-2 text-left">
          <span className="flex-1 text-[15px] font-semibold">🌙 How did you sleep?{t?.sleepHours ? <span className="ml-1 text-[12.5px] font-normal text-ink3">{t.sleepHours} h from Apple Health</span> : null}</span>
          <ChevronRight size={18} className="text-ink3" />
        </button>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {SLEEP_FACES.map((f, i) => (
            <button key={f} type="button" aria-label={`Slept ${SLEEP_WORDS[i]}`} onClick={() => void saveCheckin({ date: today, sleep: i + 1 })}
              className="pressable flex flex-col items-center rounded-xl bg-surface3 py-1.5"><span className="text-[24px]">{f}</span><span className="text-[10px] text-ink3">{SLEEP_WORDS[i]}</span></button>
          ))}
        </div>
      </Card>
    )
  }
  return (
    <button type="button" onClick={() => navigate('/sleep')} className="pressable block w-full text-left">
      <Card className="flex items-center gap-3 p-4">
        <div className="text-center"><div className={`big-num text-[30px] leading-none ${colour}`}>{rec.score ?? '—'}</div><div className="text-[10px] uppercase tracking-wide text-ink3">recovery</div></div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{SLEEP_FACES[t.sleep - 1]} {SLEEP_WORDS[t.sleep - 1]} sleep{t.sleepHours ? ` · ${t.sleepHours} h` : ''}</div>
          <div className="text-[12px] leading-snug text-ink2">{rec.advice}</div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink3" />
      </Card>
    </button>
  )
}
