// Progress → recovery map: muscle group → days since trained → state.
//
// recoveryStatus() reads the last hard set that touched each muscle. The bands
// (0-1 still cooking, 2 recovering, 3-6 ready, 7+ been a while) are a practical
// read on his own log, not physiology, and the card says so.

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { HeartPulse } from 'lucide-react'
import { db } from '@/db'
import { Badge, Card, Section, Spinner } from '@/components/ui'
import { dayjs } from '@/lib/fmt'
import { RECOVERY_LABELS, RECOVERY_TONE, recoveryStatus, type MuscleRecovery } from '@/lib/volume'

function Row({ r }: { r: MuscleRecovery }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold text-ink">{r.label}</div>
        <div className="mt-0.5 truncate text-[12px] text-ink2">{r.note}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink3">
          {r.setsThatDay} hard set{r.setsThatDay === 1 ? '' : 's'} on {dayjs(r.lastDate).format('D MMM')}
          {r.lastTitle ? ` · ${r.lastTitle}` : ''}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="big-num text-[18px] leading-tight text-ink">
          {r.daysSince}
          <span className="ml-0.5 text-[11px] font-medium text-ink3">
            {r.daysSince === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="mt-1">
          <Badge tone={RECOVERY_TONE[r.state]}>{RECOVERY_LABELS[r.state]}</Badge>
        </div>
      </div>
    </div>
  )
}

export function RecoveryMap() {
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])

  const rows = useMemo(() => {
    if (!logs) return null
    try {
      return recoveryStatus(logs)
    } catch {
      return []
    }
  }, [logs])

  return (
    <Section title="Recovery map">
      {logs === undefined || rows === null ? (
        <Card className="p-4">
          <div className="flex justify-center py-6"><Spinner /></div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-4">
          <div className="flex items-start gap-2.5">
            <HeartPulse size={16} className="mt-0.5 shrink-0 text-ink3" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Nothing to map yet</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink2">
                No completed working sets in the last four weeks. Finish one session and every
                muscle it touched appears here with the days since you trained it.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {rows.map((r) => <Row key={r.muscle} r={r} />)}
          </div>
          <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink3">
            Days since the last hard set that hit each muscle, over the last four weeks. Soreness
            and recovery timelines vary a lot between people and between lifts — treat this as a
            practical read on your log, not a rule about when you are allowed to train.
          </p>
        </Card>
      )}
    </Section>
  )
}

export default RecoveryMap
