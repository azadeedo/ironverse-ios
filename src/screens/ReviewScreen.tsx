// ============================================================
// WEEKLY REVIEW (/review)
// One screen that answers "how did the week actually go" — sessions vs
// planned, hard sets against the 10-20 range, calories and protein against
// target, the weekly budget position, weight trend and cardio — and then says
// it out loud in one honest sentence.
// ============================================================
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, LineChart as LineChartIcon } from 'lucide-react'
import { db, getActivePlan, getProfile } from '@/db'
import { energyUnit, fmtEnergyShort } from '@/db/defaults'
import { Button, Card, PageHeader, Spinner } from '@/components/ui'
import { weekStartStr, weeklyHardSets } from '@/lib/training'
import { dayjs } from '@/lib/fmt'
import WeekPicker from './review/WeekPicker'
import VerdictCard from './review/VerdictCard'
import TrainingCard from './review/TrainingCard'
import NutritionCard from './review/NutritionCard'
import BodyCard from './review/BodyCard'
import {
  bodyStats, buildVerdict, cardioStats, isValidWeekStart, nutritionStats, prevWeek,
  trainingStats, weekRange,
} from './review/helpers'

export default function ReviewScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const raw = params.get('w')
  const weekStart = isValidWeekStart(raw) ? raw : weekStartStr(new Date())
  const range = useMemo(() => weekRange(weekStart), [weekStart])
  const prevRange = useMemo(() => weekRange(prevWeek(weekStart)), [weekStart])

  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [])
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null, [])
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const weighIns = useLiveQuery(() => db.weighIns.orderBy('date').toArray(), [])
  const entries = useLiveQuery(
    () => db.foodLog.where('date').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
  )
  const adjustRows = useLiveQuery(
    () => db.dayAdjust.where('date').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
  )
  const cardioRows = useLiveQuery(
    () => db.cardioLog.where('date').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
  )

  const ready = profile !== undefined && plan !== undefined && logs && weighIns && entries && adjustRows && cardioRows

  const model = useMemo(() => {
    if (!ready || !profile) return null
    const planned = plan?.trainingWeekdays?.length || profile.daysPerWeek || 0
    const hard = weeklyHardSets(logs, range.start)
    const training = trainingStats(logs, range, hard, planned)
    const prevHard = weeklyHardSets(logs, prevRange.start)
    const prevTraining = trainingStats(logs, prevRange, prevHard, planned)
    const adjusts = new Map(adjustRows.map((a) => [a.date, a]))
    const nutrition = nutritionStats(entries, range, profile, adjusts)
    const body = bodyStats(weighIns, range)
    const cardio = cardioStats(cardioRows, range)
    const unit = energyUnit(profile)
    const verdict = buildVerdict({
      training, nutrition, body, cardio,
      goal: profile.goal,
      prevSessions: prevTraining.sessionsDone,
      prevTonnageKg: prevTraining.tonnageKg,
      inProgress: range.start === weekStartStr(new Date()),
      fmtCal: (k) => fmtEnergyShort(k, unit),
    })
    return { training, nutrition, body, cardio, verdict, unit }
  }, [ready, profile, plan, logs, weighIns, entries, adjustRows, cardioRows, range, prevRange])

  return (
    <div className="pb-12">
      <PageHeader
        title="Weekly review"
        back
        subtitle={`${range.relative} · ${range.label}`}
      />
      <WeekPicker weekStart={weekStart} onChange={(w) => setParams({ w }, { replace: true })} />

      {!ready || !model ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !profile ? (
        <Card className="mx-4 mt-4 p-4 text-[14px] text-ink2">
          Finish setting up your profile and the weekly review has something to measure against.
        </Card>
      ) : (
        <>
          <div className="px-4 pt-3">
            <VerdictCard verdict={model.verdict} weekLabel={range.relative} />
          </div>

          <TrainingCard t={model.training} />
          <NutritionCard n={model.nutrition} unit={model.unit} />
          <BodyCard body={model.body} cardio={model.cardio} goal={profile.goal} />

          <div className="mt-5 flex gap-2 px-4">
            <Button variant="secondary" full onClick={() => navigate('/photos')}>
              <Camera size={16} /> Progress photos
            </Button>
            <Button variant="secondary" full onClick={() => navigate('/progress')}>
              <LineChartIcon size={16} /> Full progress
            </Button>
          </div>

          <p className="mt-4 px-5 text-center text-[11.5px] text-ink3">
            Built entirely from what you logged between {dayjs(range.start).format('ddd D MMM')} and{' '}
            {dayjs(range.end).subtract(1, 'day').format('ddd D MMM')}. Nothing here is estimated on your behalf.
          </p>
        </>
      )}
    </div>
  )
}
