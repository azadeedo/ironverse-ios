// Workout → plateau and staleness notices for the lifts in this session.
//
// plateauCheckFrom() only flags a lift when estimated 1RM AND volume have both
// failed to move for 3+ sessions, and stalenessFrom() only when a lift has been
// in the rotation for 6+ weeks. Everything below simply renders what they
// return, including the concrete options they hand back.
//
// Nothing is alarmist and nothing is hidden: when no lift has enough history to
// judge, the card says exactly that.

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckCircle2, Lightbulb, Repeat2, RotateCcw, TrendingDown, TrendingUp,
} from 'lucide-react'
import { db } from '@/db'
import type { EquipmentProfile } from '@/db/types'
import { Badge, Card, Spinner } from '@/components/ui'
import {
  plateauCheckFrom, stalenessFrom,
  type PlateauOption, type PlateauReport, type StalenessReport,
} from '@/lib/progression'

function OptionIcon({ kind }: { kind: PlateauOption['kind'] }) {
  if (kind === 'reps') return <TrendingUp size={14} className="mt-0.5 shrink-0 text-emerald-500" />
  if (kind === 'variation') return <Repeat2 size={14} className="mt-0.5 shrink-0 text-brand" />
  return <RotateCcw size={14} className="mt-0.5 shrink-0 text-ink3" />
}

function PlateauNotice({ r }: { r: PlateauReport }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <TrendingDown size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">{r.name}</span>
            <Badge tone="amber">{r.headline}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{r.detail}</p>

          {r.options.length > 0 && (
            <div className="mt-2.5 space-y-2">
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink3">
                Options — pick one, not all three
              </div>
              {r.options.map((o, i) => (
                <div key={`${o.kind}-${i}`} className="rounded-xl bg-surface3 p-2.5">
                  <div className="flex items-start gap-2">
                    <OptionIcon kind={o.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink">{o.label}</div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink2">{o.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 text-[11.5px] text-ink3">
            Read from {r.sessionsSeen} logged session{r.sessionsSeen === 1 ? '' : 's'} on this lift.
          </div>
        </div>
      </div>
    </div>
  )
}

function StaleNotice({ r }: { r: StalenessReport }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <Repeat2 size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">{r.name}</span>
            <Badge tone="brand">{r.headline}</Badge>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{r.detail}</p>
          {r.suggestion && (
            <div className="mt-2 rounded-xl bg-surface3 p-2.5">
              <div className="flex items-start gap-2">
                <Lightbulb size={14} className="mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">
                    Try {r.suggestion.name} instead
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink2">{r.suggestion.why}</p>
                </div>
              </div>
            </div>
          )}
          <div className="mt-2 text-[11.5px] text-ink3">
            {r.sessions} session{r.sessions === 1 ? '' : 's'} in this run
            {r.confidence === 'thin' ? ' — a short run, so treat it lightly.' : '.'}
          </div>
        </div>
      </div>
    </div>
  )
}

const MAX_NOTICES = 4

export function TrainingNotices({ exerciseIds, location }: {
  exerciseIds: string[]
  location: EquipmentProfile | null
}) {
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])
  const ids = useMemo(() => [...new Set(exerciseIds.filter(Boolean))], [exerciseIds])

  const { plateaus, stales, judged } = useMemo(() => {
    if (!logs || ids.length === 0) {
      return { plateaus: [] as PlateauReport[], stales: [] as StalenessReport[], judged: 0 }
    }
    const p: PlateauReport[] = []
    const s: StalenessReport[] = []
    let enough = 0
    for (const id of ids) {
      try {
        const plateau = plateauCheckFrom(logs, id, location)
        if (plateau.sessionsSeen >= 4) enough += 1
        if (plateau.stalled) p.push(plateau)
        const stale = stalenessFrom(logs, id, location)
        if (stale.stale) s.push(stale)
      } catch {
        /* a single bad lift must never take the card down */
      }
    }
    p.sort((a, b) => b.flatSessions - a.flatSessions)
    s.sort((a, b) => b.weeks - a.weeks)
    return { plateaus: p, stales: s, judged: enough }
  }, [logs, ids, location])

  if (logs === undefined) {
    return (
      <Card className="p-4">
        <div className="flex justify-center py-4"><Spinner /></div>
      </Card>
    )
  }

  if (ids.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-[13px] leading-relaxed text-ink2">
          No lifts to check yet. Once a session has exercises in it — and a few of them are
          logged — plateau and staleness checks appear here.
        </p>
      </Card>
    )
  }

  const notices = [
    ...plateaus.slice(0, MAX_NOTICES).map((r) => ({ key: `p-${r.exerciseId}`, node: <PlateauNotice r={r} /> })),
    ...stales
      .filter((r) => !plateaus.some((p) => p.exerciseId === r.exerciseId))
      .map((r) => ({ key: `s-${r.exerciseId}`, node: <StaleNotice r={r} /> })),
  ].slice(0, MAX_NOTICES)

  if (notices.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">Nothing flagged</div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
              {judged === 0
                ? `None of the ${ids.length} lift${ids.length === 1 ? '' : 's'} in this session has four logged sessions yet — that is about the minimum before a flat patch means anything. Keep logging and this starts watching for you.`
                : `${judged} of ${ids.length} lift${ids.length === 1 ? '' : 's'} here have enough history to judge, and none of them has stalled or been in the rotation long enough to be worth rotating out.`}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-line">
        {notices.map((n) => <div key={n.key}>{n.node}</div>)}
      </div>
      <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink3">
        A plateau is information, not a verdict — it only fires when estimated 1RM and volume have
        both been flat for three sessions or more. Nothing here changes your plan on its own.
      </p>
    </Card>
  )
}

export default TrainingNotices
