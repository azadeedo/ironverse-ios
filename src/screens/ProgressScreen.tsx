// Progress hub — Body · Strength · Activity (tab kept in the URL for deep links).
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarCheck, Camera, Trophy } from 'lucide-react'
import { Button, PageHeader, Segmented } from '@/components/ui'
import BodyTab from './progress/BodyTab'
import StrengthTab from './progress/StrengthTab'
import ActivityTab from './progress/ActivityTab'
import InsightsTab from './progress/InsightsTab'

type Tab = 'body' | 'strength' | 'activity' | 'insights'

const TABS: { value: Tab; label: string }[] = [
  { value: 'body', label: 'Body' },
  { value: 'strength', label: 'Strength' },
  { value: 'activity', label: 'Activity' },
  { value: 'insights', label: 'Insights' },
]

export default function ProgressScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = raw === 'strength' || raw === 'activity' || raw === 'insights' ? raw : 'body'

  return (
    <div className="pb-10">
      <PageHeader title="Progress" subtitle="Body, strength and consistency in one place" />
      <div className="px-4 pt-1">
        <Segmented options={TABS} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      </div>

      {/* deep links into the two screens that live off this one */}
      <div className="mt-3 flex gap-2 px-4">
        <Button variant="secondary" full className="min-h-[46px]" onClick={() => navigate('/review')}>
          <CalendarCheck size={16} /> Weekly review
        </Button>
        <Button variant="secondary" full className="min-h-[46px]" onClick={() => navigate('/photos')}>
          <Camera size={16} /> Photos
        </Button>
      </div>

      <div className="mt-2 px-4">
        <Button full className="min-h-[46px]" onClick={() => navigate('/hub')}>
          <Trophy size={16} /> Progress hub — calendar, trophies, athlete, muscles, cycles, challenges
        </Button>
      </div>

      {tab === 'body' && <BodyTab />}
      {tab === 'strength' && <StrengthTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'insights' && <InsightsTab />}
    </div>
  )
}
