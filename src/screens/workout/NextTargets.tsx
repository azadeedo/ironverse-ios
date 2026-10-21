// Workout -> "Next session targets".
//
// The concrete prescription for the session he is about to run, one line per
// lift, straight out of lib/progression's nextSessionTargetFrom(). Every figure
// comes from his own logged sets and every load is buildable on the hardware at
// the location he is training at today.
//
// Nothing here invents a number. When a lift has no history the card says so in
// plain words instead of pretending.

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Minus, Repeat, Target, TrendingUp } from 'lucide-react'
import { db } from '@/db'
import type { EquipmentProfile, Profile } from '@/db/types'
import type { LoadSource } from '@/lib/plates'
import { Badge, Card, Spinner } from '@/components/ui'
import {
  CONFIDENCE_NOTE, nextSessionTargets,
  type Confidence, type NextSessionTarget, type TargetAction,
} from '@/lib/progression'

const DOT = '·'

const CONFIDENCE_TONE: Record<Confidence, 'gray' | 'amber' | 'green'> = {
  none: 'gray', thin: 'amber', ok: 'green',
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  none: 'No history', thin: 'One session', ok: 'From your logs',
}

const ACTION_LABEL: Record<TargetAction, string> = {
  'add-weight': 'Take the jump',
  reduce: 'Come down a step',
  'add-reps': 'Chase reps',
  hold: 'Repeat it',
  'first-time': 'Starting point',
  'no-data': 'Nothing logged',
}

const ACTION_TONE: Record<TargetAction, 'gray' | 'amber' | 'green'> = {
  'add-weight': 'green', reduce: 'amber', 'add-reps': 'amber', hold: 'gray',
  'first-time': 'gray', 'no-data': 'gray',
}

function ActionIcon({ action }: { action: TargetAction }) {
  if (action === 'add-weight') return <TrendingUp size={16} className="shrink-0 text-emerald-500" />
  if (action === 'add-reps') return <Repeat size={16} className="shrink-0 text-brand" />
  if (action === 'hold') return <Minus size={16} className="shrink-0 text-ink3" />
  return <Target size={16} className="shrink-0 text-ink3" />
}

function TargetRow({ t }: { t: NextSessionTarget }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><ActionIcon action={t.action} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">{t.name}</span>
            <Badge tone={ACTION_TONE[t.action]}>{ACTION_LABEL[t.action]}</Badge>
          </div>

          <div className="big-num mt-1 text-[19px] leading-tight text-brand">
            {t.prescription}
            {t.sets ? (
              <span className="text-[13px] font-medium text-ink2"> {DOT} {t.sets} sets</span>
            ) : null}
          </div>

          <div className="mt-0.5 text-[12.5px] text-ink2">{t.lastLine}</div>

          {t.buildLabel && (
            <div className="mt-1 text-[12px] font-semibold text-ink3">{t.buildLabel}</div>
          )}

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{t.reason}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={CONFIDENCE_TONE[t.confidence]}>{CONFIDENCE_LABEL[t.confidence]}</Badge>
            <span className="text-[11.5px] text-ink3">
              {t.basedOn > 0
                ? `${t.basedOn} past session${t.basedOn === 1 ? '' : 's'} ${DOT} ${CONFIDENCE_NOTE[t.confidence]}`
                : CONFIDENCE_NOTE[t.confidence]}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const PREVIEW = 3

/**
 * `location` is the equipment profile he is training at right now; `profile` is
 * used only for bodyweight-derived starting loads. Either may be missing - the
 * card degrades to an honest empty state rather than guessing.
 */
export function NextTargetsCard({ exerciseIds, profile, location }: {
  exerciseIds: string[]
  profile: Profile | null | undefined
  location: EquipmentProfile | null
}) {
  const [expanded, setExpanded] = useState(false)
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])

  const ids = useMemo(() => [...new Set(exerciseIds.filter(Boolean))], [exerciseIds])
  const source: LoadSource | null = location ?? profile ?? null

  const targets = useMemo(() => {
    if (!logs || !source || ids.length === 0) return []
    try {
      return nextSessionTargets(logs, ids, profile ?? null, source)
    } catch {
      return []
    }
  }, [logs, ids, profile, source])

  const withHistory = targets.filter((t) => t.basedOn > 0).length

  if (logs === undefined) {
    return (
      <Card className="p-4">
        <div className="flex justify-center py-6"><Spinner /></div>
      </Card>
    )
  }

  if (ids.length === 0 || !source) {
    return (
      <Card className="p-4">
        <p className="text-[13px] leading-relaxed text-ink2">
          {ids.length === 0
            ? 'No exercises in this session yet. Pick a day that has exercises and the prescription for each lift shows up here.'
            : 'Set up the kit at this location first - a target is only useful if it is a load you can actually build.'}
        </p>
      </Card>
    )
  }

  if (targets.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-[13px] leading-relaxed text-ink2">
          Nothing to prescribe for this session yet. Log a session and each lift gets a concrete
          target here next time.
        </p>
      </Card>
    )
  }

  const shown = expanded ? targets : targets.slice(0, PREVIEW)

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pb-1 pt-4">
        <p className="text-[12.5px] leading-relaxed text-ink2">
          {withHistory === 0
            ? 'Nothing logged on these lifts yet, so these are starting points, not targets. After one session they come from your own sets.'
            : `${withHistory} of ${targets.length} built from your own logged sets. Loads are snapped to what you can build${location ? ` at ${location.name}` : ''}.`}
        </p>
      </div>

      <div className="mt-1 divide-y divide-line">
        {shown.map((t) => <TargetRow key={t.exerciseId} t={t} />)}
      </div>

      {targets.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="pressable flex min-h-[46px] w-full items-center justify-center gap-1.5 border-t border-line text-[13px] font-bold text-brand"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expanded ? 'Show fewer' : `Show all ${targets.length}`}
        </button>
      )}
    </Card>
  )
}

export default NextTargetsCard
