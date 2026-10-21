// Progress → Insights: the coaching read on his own logs.
//
// Weak points, recovery map, strength standards, and the plateau / staleness
// notices for the lifts he is actually running right now. Every card is
// self-contained, reads his real data and has its own honest empty state, so
// this tab is safe on a completely fresh install.

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProfile } from '@/db'
import { Section } from '@/components/ui'
import { dayjs } from '@/lib/fmt'
import { isWorkingSet } from '@/lib/training'
import { HOME_PROFILE_ID, ensureEquipmentProfiles } from '@/lib/equipment'
import { TrainingNotices } from '../workout/TrainingNotices'
import WeakPointsCard from './WeakPointsCard'
import RecoveryMap from './RecoveryMap'
import StrengthStandardsCard from './StrengthStandardsCard'

/** How many recent lifts get checked for plateaus / staleness. */
const WATCH_LIMIT = 8
const WATCH_WEEKS = 8

export default function InsightsTab() {
  const logs = useLiveQuery(() => db.workoutLogs.orderBy('date').toArray(), [])
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [])
  const eqProfiles = useLiveQuery(() => ensureEquipmentProfiles(), [])

  const currentEq = useMemo(() => {
    if (!eqProfiles || eqProfiles.length === 0) return null
    const id = profile?.equipmentProfileId ?? HOME_PROFILE_ID
    return eqProfiles.find((p) => p.id === id) ?? eqProfiles[0] ?? null
  }, [eqProfiles, profile])

  /** The lifts he has actually been running lately, most sessions first. */
  const watchIds = useMemo(() => {
    if (!logs) return []
    const from = dayjs().subtract(WATCH_WEEKS * 7, 'day').format('YYYY-MM-DD')
    const counts = new Map<string, number>()
    for (const log of logs) {
      if (log.date < from) continue
      for (const entry of log.exercises) {
        if (!entry.sets.some(isWorkingSet)) continue
        counts.set(entry.exerciseId, (counts.get(entry.exerciseId) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, WATCH_LIMIT)
      .map(([id]) => id)
  }, [logs])

  return (
    <>
      <WeakPointsCard />

      <Section title="Plateau and staleness">
        <TrainingNotices exerciseIds={watchIds} location={currentEq} />
        <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-ink3">
          Checked across the lifts you have run in the last {WATCH_WEEKS} weeks.
        </p>
      </Section>

      <RecoveryMap />
      <StrengthStandardsCard />
    </>
  )
}
