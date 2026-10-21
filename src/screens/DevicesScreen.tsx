// IV-34 — Connected devices centre. Honest status only: Ironverse is a web app
// on iPhone, so it cannot read Apple Health / Apple Watch directly. Every row
// says what works today and how.
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Badge, Button, Card, PageHeader, Section } from '@/components/ui'
import { db } from '@/db'

type Row = { name: string; status: 'works' | 'manual' | 'not-possible'; what: string; how?: string; to?: string; cta?: string }

export default function DevicesScreen() {
  const navigate = useNavigate()
  const watchCount = useLiveQuery(async () => (await db.workoutLogs.toArray()).filter((l) => l.watch).length, []) ?? 0
  const camera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const rows: Row[] = [
    { name: 'Apple Watch workout summary', status: 'manual', what: `Type the numbers from your watch’s summary (type, time, calories, heart rate) and attach a screenshot. Linked to that workout. ${watchCount} workout${watchCount === 1 ? '' : 's'} have a watch summary.`, how: 'Finish a workout → “Add watch summary”, or open any past workout from History → Replay.', to: '/history', cta: 'Open History' },
    { name: 'Apple Health / automatic Watch sync', status: 'not-possible', what: 'Apple only lets native App Store apps read Health data. A home-screen web app cannot — so Ironverse does not pretend to sync.', how: 'Would need a native iOS app (paid Apple developer account). Listed in the report as a future option.' },
    { name: 'Camera — barcode scanner', status: camera ? 'works' : 'manual', what: camera ? 'Your phone camera is available for barcode scanning in Food.' : 'This browser did not expose the camera — type the barcode number instead.', to: '/food', cta: 'Open Food' },
    { name: 'Bluetooth heart-rate straps', status: 'not-possible', what: 'Safari on iPhone does not support Web Bluetooth, so straps cannot connect to a web app.' },
    { name: 'Smart scales', status: 'manual', what: 'Enter weigh-ins by hand (Today → weigh-in). The app averages them weekly so one reading never drives decisions.', to: '/', cta: 'Open Today' },
    { name: 'Backups', status: 'works', what: 'Full backup file (plain or passphrase-encrypted) plus automatic snapshots on this phone.', to: '/backup', cta: 'Open Backup' },
  ]
  const tone = { works: 'green', manual: 'brand', 'not-possible': 'gray' } as const
  const label = { works: 'Works now', manual: 'Manual entry', 'not-possible': 'Not possible in a web app' }
  return (
    <div className="pb-8">
      <PageHeader title="Connected devices" back subtitle="What connects, what you enter by hand, and what an iPhone web app can’t do." />
      <Section>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <Card key={r.name} className="p-3.5 text-[13px]">
              <div className="flex items-start gap-2"><b className="flex-1 text-[14px]">{r.name}</b><Badge tone={tone[r.status]}>{label[r.status]}</Badge></div>
              <div className="mt-1 text-ink2">{r.what}</div>
              {r.how && <div className="mt-1 text-[12px] text-ink3">{r.how}</div>}
              {r.to && <Button small variant="secondary" className="mt-2" onClick={() => navigate(r.to!)}>{r.cta}</Button>}
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}
