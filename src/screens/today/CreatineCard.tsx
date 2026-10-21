// Daily creatine tick with time hint from the reminders config.

import { Check, Pill } from 'lucide-react'
import { Card } from '@/components/ui'
import { db } from '@/db'
import { newId, nowIso } from '@/lib/id'
import { dayjs } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import type { CreatineLog } from '@/db/types'
import { fmt12 } from './lib'

export function CreatineCard({ today, log, grams, hintTime, loading }: {
  /** loading phase: higher dose split over the day */
  loading?: boolean
  today: string
  log: CreatineLog | undefined
  grams: number
  /** reminders.creatineTime when enabled */
  hintTime?: string
}) {
  const toast = useUI((s) => s.toast)
  const taken = !!log?.taken

  async function toggle() {
    if (log) {
      const next = !log.taken
      await db.creatineLog.put({ ...log, taken: next, at: next ? nowIso() : undefined })
      toast(next ? `Creatine ${grams}g logged` : 'Creatine unticked', next ? 'success' : 'info')
    } else {
      await db.creatineLog.add({ id: newId(), date: today, taken: true, at: nowIso() })
      toast(`Creatine ${grams}g logged`, 'success')
    }
  }

  return (
    <Card className="flex h-full flex-col p-3.5">
      <div className="flex items-center gap-1.5">
        <Pill size={15} className="text-emerald-400" />
        <span className="flex-1 text-[11.5px] font-bold uppercase tracking-wide text-ink2">Creatine</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-2">
        <button
          type="button"
          aria-pressed={taken}
          aria-label={taken ? 'Mark creatine as not taken' : 'Mark creatine as taken'}
          onClick={() => void toggle()}
          className={`pressable flex h-[68px] w-[68px] items-center justify-center rounded-full transition-colors ${
            taken
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'border-2 border-dashed border-line bg-surface3 text-ink3'
          }`}
        >
          <Check size={32} strokeWidth={3} />
        </button>
        <div className="text-center">
          <div className="text-[14px] font-bold text-ink">{loading ? `${grams} g today` : `${grams} g daily`}</div>
          {loading && <div className="text-[11px] font-semibold text-amber-300">Loading · {Math.max(1, Math.round(grams / 5))} × 5 g with meals</div>}
          <div className="mt-0.5 text-[11.5px] text-ink3">
            {taken
              ? log?.at ? `Taken ${dayjs(log.at).format('h:mm a')}` : 'Taken today'
              : hintTime ? `Usually ${fmt12(hintTime)}` : 'Not yet today'}
          </div>
        </div>
      </div>
    </Card>
  )
}
