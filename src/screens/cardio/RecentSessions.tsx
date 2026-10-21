// Per-mode cardio history: recent sessions with stats + delete (confirmed).

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Trash2 } from 'lucide-react'
import { ConfirmDialog, EmptyState, ListGroup, ListRow, Section } from '@/components/ui'
import { db } from '@/db'
import { dayjs, fmtDayShort, fmtPace } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import { deleteWithUndo } from '@/lib/undo'
import type { CardioLog } from '@/db/types'
import { fmtHMS, KIND_LABEL, type CardioKind } from './shared'

function describe(log: CardioLog): string {
  if (log.kind === 'jump-rope') {
    const r = log.rounds ?? 0
    return `${r} round${r === 1 ? '' : 's'} · ${fmtHMS(log.seconds)} work`
  }
  const parts = [fmtHMS(log.seconds)]
  if (log.distanceKm) parts.push(`${log.distanceKm.toFixed(2)} km`)
  if (log.avgPaceSecPerKm) parts.push(fmtPace(log.avgPaceSecPerKm))
  return parts.join(' · ')
}

export function RecentSessions({ kind }: { kind: CardioKind }) {
  const toast = useUI((s) => s.toast)
  const [pending, setPending] = useState<CardioLog | null>(null)

  const logs = useLiveQuery(async () => {
    const rows = await db.cardioLog.where('kind').equals(kind).toArray()
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 25)
  }, [kind])

  if (!logs) return null

  return (
    <Section title="Recent sessions" className="pb-6">
      {logs.length === 0 ? (
        <ListGroup>
          <EmptyState
            icon={<Flame size={30} />}
            title={`No ${KIND_LABEL[kind].toLowerCase()} sessions yet`}
            subtitle="Your finished sessions land here with time, distance and calories."
          />
        </ListGroup>
      ) : (
        <ListGroup>
          {logs.map((log) => (
            <ListRow
              key={log.id}
              title={
                <span>
                  {fmtDayShort(log.date)}
                  <span className="ml-1.5 text-[12px] font-normal text-ink3">{dayjs(log.createdAt).format('h:mm a')}</span>
                </span>
              }
              subtitle={describe(log) + (log.note ? ` · ${log.note}` : '')}
              right={
                <div className="flex items-center gap-2">
                  {typeof log.calories === 'number' && (
                    <span className="big-num text-[14px] text-brand">{log.calories} kcal</span>
                  )}
                  <button
                    type="button"
                    aria-label="Delete session"
                    className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-surface3 text-ink3"
                    onClick={() => setPending(log)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              }
            />
          ))}
        </ListGroup>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return
          void deleteWithUndo(db.cardioLog, pending.id, 'Session deleted')
        }}
        title="Delete session?"
        message={pending ? `${KIND_LABEL[pending.kind]} on ${fmtDayShort(pending.date)} — ${describe(pending)}. You'll get a moment to undo it.` : undefined}
      />
    </Section>
  )
}
