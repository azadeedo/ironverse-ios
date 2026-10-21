// Cardio hub: Run / Walk / Jump rope mode cards + week summary, honouring
// /cardio?start=run|walk|jump-rope deep links. Trackers live in screens/cardio/.

import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Footprints, PersonStanding, Timer } from 'lucide-react'
import { Card, ConfirmDialog, PageHeader, Section, StatCard } from '@/components/ui'
import { db } from '@/db'
import { todayStr } from '@/lib/id'
import { fmtDayShort, fmtDuration, fmtInt } from '@/lib/fmt'
import type { CardioLog } from '@/db/types'
import { fmtHMS, isCardioKind, KIND_LABEL, type CardioKind } from './cardio/shared'
import { RunWalkTracker } from './cardio/RunWalkTracker'
import { JumpRopeTimer } from './cardio/JumpRopeTimer'
import { RecentSessions } from './cardio/RecentSessions'
import { TreadmillRun } from './cardio/TreadmillRun'

const MODES: { kind: CardioKind; icon: typeof Footprints; tint: string; blurb: string }[] = [
  { kind: 'run', icon: Footprints, tint: 'bg-brand/12 text-brand', blurb: 'Free run — GPS distance & pace, or just the clock.' },
  { kind: 'walk', icon: PersonStanding, tint: 'bg-emerald-500/12 text-emerald-400', blurb: 'Brisk walk. Low impact, easy calories on any day.' },
  { kind: 'jump-rope', icon: Timer, tint: 'bg-sky-500/12 text-sky-400', blurb: 'Work / rest rounds with buzz alerts at every switch.' },
]

function lastLine(log: CardioLog | undefined): string {
  if (!log) return 'No sessions yet'
  if (log.kind === 'jump-rope') return `Last: ${fmtDayShort(log.date)} · ${log.rounds ?? 0} rounds · ${fmtHMS(log.seconds)}`
  const dist = log.distanceKm ? ` · ${log.distanceKm.toFixed(2)} km` : ''
  return `Last: ${fmtDayShort(log.date)} · ${fmtHMS(log.seconds)}${dist}`
}

export default function CardioScreen() {
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<CardioKind | 'tm10' | null>(() => {
    const s = params.get('start')
    return s === 'tm10' ? 'tm10' : isCardioKind(s) ? s : null
  })
  const [active, setActive] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const onActiveChange = useCallback((a: boolean) => setActive(a), [])

  const week = useLiveQuery(async () => {
    const start = todayStr(new Date(Date.now() - 6 * 86400000))
    return db.cardioLog.where('date').aboveOrEqual(start).toArray()
  }, [])

  const lastByKind = useLiveQuery(async () => {
    const all = await db.cardioLog.toArray()
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const map = new Map<CardioKind, CardioLog>()
    for (const l of all) if (isCardioKind(l.kind) && !map.has(l.kind)) map.set(l.kind, l)
    return map
  }, [])

  function openMode(kind: CardioKind | 'tm10') {
    setMode(kind)
    setActive(false)
    setParams({ start: kind }, { replace: true })
  }

  function leaveToMenu() {
    setMode(null)
    setActive(false)
    setParams({}, { replace: true })
  }

  if (mode) {
    return (
      <div>
        <div className="sticky top-0 z-30 bg-surface/85 pt-safe backdrop-blur-xl">
          <div className="flex min-h-[52px] items-center gap-2 px-4 py-2">
            <button
              type="button"
              className="pressable -ml-2 flex h-9 items-center gap-0.5 pr-2 text-brand"
              onClick={() => (active ? setConfirmLeave(true) : leaveToMenu())}
            >
              <ChevronLeft size={26} strokeWidth={2.4} />
              <span className="text-[15px] font-medium">Cardio</span>
            </button>
            <h1 className="flex-1 truncate text-[17px] font-semibold">{mode === 'tm10' ? '10 km treadmill run' : KIND_LABEL[mode]}</h1>
          </div>
        </div>

        {mode === 'tm10' ? <TreadmillRun /> : mode === 'jump-rope'
          ? <JumpRopeTimer onActiveChange={onActiveChange} />
          : <RunWalkTracker kind={mode} onActiveChange={onActiveChange} />}

        {!active && mode !== 'tm10' && <div className="mt-2"><RecentSessions kind={mode} /></div>}

        <ConfirmDialog
          open={confirmLeave}
          onClose={() => setConfirmLeave(false)}
          onConfirm={leaveToMenu}
          title="Leave this session?"
          message="The session is still in progress — leaving now discards it."
          confirmLabel="Discard"
        />
      </div>
    )
  }

  const sessions = week?.length ?? 0
  const totalSec = week?.reduce((a, l) => a + l.seconds, 0) ?? 0
  const kcal = week?.reduce((a, l) => a + (l.calories ?? 0), 0) ?? 0

  return (
    <div>
      <PageHeader title="Cardio" subtitle="Engine work — every session chips at the deficit." />

      <Section>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard label="Sessions" value={String(sessions)} sub="last 7 days" />
          <StatCard label="Time" value={totalSec > 0 ? fmtDuration(totalSec) : '0 min'} sub="last 7 days" />
          <StatCard label="Burned" value={fmtInt(kcal)} sub="kcal" tone="brand" />
        </div>
      </Section>

      <Section title="Pick a mode" className="pb-6">
        <div className="space-y-2.5">
          <Card className="p-4" onClick={() => openMode('tm10')}>
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400"><Timer size={24} /></div>
              <div className="min-w-0 flex-1">
                <div className="shout text-[16px] text-ink">10 km treadmill run</div>
                <div className="mt-0.5 text-[12.5px] text-ink2">Speed to set, then log time, pace, each km, heart rate and calories. Tracks your best.</div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-ink3" />
            </div>
          </Card>
          {MODES.map(({ kind, icon: Icon, tint, blurb }) => (
            <Card key={kind} className="p-4" onClick={() => openMode(kind)}>
              <div className="flex items-center gap-3.5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tint}`}>
                  <Icon size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="shout text-[16px] text-ink">{KIND_LABEL[kind]}</div>
                  <div className="mt-0.5 text-[12.5px] text-ink2">{blurb}</div>
                  <div className="mt-1 text-[11.5px] text-ink3">{lastLine(lastByKind?.get(kind))}</div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-ink3" />
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}
