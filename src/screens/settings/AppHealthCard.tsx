// APP HEALTH & STORAGE — what the database is actually holding, how much room
// it has, and how long it has been since the data left the device.
//
// The backup warning is the point of this card. Everything lives in IndexedDB
// on one phone; a browser that clears site data takes the lot. It states the
// number of days and stops short of nagging.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, Database, HardDrive, RefreshCw, ShieldCheck,
} from 'lucide-react'
import {
  Badge, Button, Callout, Card, FOCUS_RING, Meter, Spinner,
} from '@/components/ui'
import { db, getSetting, SETTING_KEYS } from '@/db'
import { EXPORT_NAG_DAYS, daysSinceExport } from '@/lib/backup'
import { dayjs } from '@/lib/fmt'

/** Friendly names for the Dexie tables, in the order a human cares about. */
const TABLE_LABELS: Record<string, string> = {
  workoutLogs: 'Workout logs',
  foodLog: 'Food entries',
  weighIns: 'Weigh-ins',
  measurements: 'Measurements',
  cardioLog: 'Cardio sessions',
  waterLog: 'Water entries',
  creatineLog: 'Creatine days',
  foods: 'Custom foods',
  recipes: 'Recipes',
  progressPhotos: 'Progress photos',
  plans: 'Plans',
  programOverrides: 'Program overrides',
  exerciseMeta: 'Exercise notes',
  equipmentProfiles: 'Equipment profiles',
  barcodeCache: 'Cached barcodes',
  dayAdjust: 'Calorie carry-overs',
  snapshots: 'Local snapshots',
  settings: 'Settings rows',
  profile: 'Profile',
  reminders: 'Reminder config',
}

const ORDER = Object.keys(TABLE_LABELS)

interface Health {
  counts: { name: string; label: string; rows: number }[]
  totalRows: number
  usageBytes: number | null
  quotaBytes: number | null
  lastExportAt: string | null
  lastSnapshotDate: string | null
  snapshotCount: number
  daysSince: number | null
  persisted: boolean | null
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function readHealth(): Promise<Health> {
  const counts: Health['counts'] = []
  let totalRows = 0
  for (const table of db.tables) {
    const rows = await table.count()
    totalRows += rows
    counts.push({ name: table.name, label: TABLE_LABELS[table.name] ?? table.name, rows })
  }
  counts.sort((a, b) => {
    const ai = ORDER.indexOf(a.name)
    const bi = ORDER.indexOf(b.name)
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
  })

  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      usageBytes = typeof est.usage === 'number' ? est.usage : null
      quotaBytes = typeof est.quota === 'number' ? est.quota : null
    }
  } catch { /* storage estimate is a nicety */ }

  let persisted: boolean | null = null
  try {
    persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null
  } catch { /* not supported */ }

  const [lastExportAt, lastSnapshotDate, daysSince, snapshotCount] = await Promise.all([
    getSetting<string | null>(SETTING_KEYS.lastExportAt, null),
    getSetting<string | null>(SETTING_KEYS.lastSnapshotDate, null),
    daysSinceExport(),
    db.snapshots.count(),
  ])

  return {
    counts, totalRows, usageBytes, quotaBytes,
    lastExportAt, lastSnapshotDate, daysSince, snapshotCount, persisted,
  }
}

export function AppHealthCard() {
  const navigate = useNavigate()
  const [health, setHealth] = useState<Health | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function refresh() {
    setRefreshing(true)
    try { setHealth(await readHealth()) } finally { setRefreshing(false) }
  }

  useEffect(() => {
    let alive = true
    void readHealth().then((h) => { if (alive) setHealth(h) })
    return () => { alive = false }
  }, [])

  if (!health) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-6"><Spinner /></div>
      </Card>
    )
  }

  const overdue = health.daysSince === null || health.daysSince >= EXPORT_NAG_DAYS
  const nonEmpty = health.counts.filter((c) => c.rows > 0)

  return (
    <>
      {/* ---------- backup status ---------- */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              overdue ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/12 text-emerald-400'
            }`}
            aria-hidden="true"
          >
            {overdue ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14.5px] font-bold text-ink">
              {health.lastExportAt === null
                ? 'No backup has ever been exported'
                : overdue
                  ? `Last export was ${health.daysSince} days ago`
                  : `Last export was ${health.daysSince === 0 ? 'today' : `${health.daysSince} day${health.daysSince === 1 ? '' : 's'} ago`}`}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
              {overdue
                ? 'Everything here lives on this phone. If the browser clears its site data, or the phone goes, it goes with it. An export takes a second and is the only copy that survives that.'
                : `Your data has a copy off this device. ${health.lastExportAt ? `Exported ${dayjs(health.lastExportAt).format('D MMM YYYY, h:mm a')}.` : ''}`}
            </p>
            <Button
              small
              variant={overdue ? 'primary' : 'secondary'}
              className="mt-2.5"
              onClick={() => navigate('/backup')}
            >
              Open backup
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------- snapshots ---------- */}
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" aria-hidden="true" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Local snapshots</h3>
          <span className="flex-1" />
          <Badge tone={health.snapshotCount > 0 ? 'green' : 'gray'}>
            {health.snapshotCount} kept
          </Badge>
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink2">
          {health.lastSnapshotDate
            ? `Last snapshot taken ${dayjs(health.lastSnapshotDate).format('D MMM YYYY')}. Ironverse keeps the most recent 10 automatically, one per day.`
            : 'No snapshot has been taken yet. One is written automatically the next time you open the app with data in it.'}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink3">
          Snapshots live in the same database, so they protect against a mistake —
          not against losing the device. That is what an export is for.
        </p>
      </Card>

      {/* ---------- storage ---------- */}
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-sky-400" aria-hidden="true" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Storage</h3>
        </div>

        {health.usageBytes === null ? (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink2">
            This browser does not report storage usage, so there is no honest figure
            to show here. Row counts below still tell you how much is in the database.
          </p>
        ) : (
          <>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="big-num text-[22px] text-ink">{fmtBytes(health.usageBytes)}</span>
              {health.quotaBytes !== null && (
                <span className="text-[12.5px] text-ink2">of about {fmtBytes(health.quotaBytes)} available</span>
              )}
            </div>
            {health.quotaBytes !== null && health.quotaBytes > 0 && (
              <div className="mt-2">
                <Meter
                  value={health.usageBytes}
                  target={health.quotaBytes}
                  label="Storage used"
                  valueLabel={`${fmtBytes(health.usageBytes)} of ${fmtBytes(health.quotaBytes)}`}
                  tone={health.usageBytes / health.quotaBytes > 0.85 ? 'amber' : 'brand'}
                />
              </div>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-ink3">
              Progress photos and meal photos are almost all of this. The quota is the
              browser’s estimate, not a hard limit.
            </p>
          </>
        )}

        {health.persisted !== null && (
          <div className="mt-3 border-t border-line pt-3">
            <Badge tone={health.persisted ? 'green' : 'amber'}>
              {health.persisted ? 'Storage marked persistent' : 'Storage not marked persistent'}
            </Badge>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink3">
              {health.persisted
                ? 'The browser has agreed not to evict this data automatically when space runs low.'
                : 'The browser may clear this data if the device runs low on space. Adding Ironverse to your home screen makes that far less likely — and an export removes the risk entirely.'}
            </p>
          </div>
        )}
      </Card>

      {/* ---------- rows per table ---------- */}
      <Card className="mt-3 p-4">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-violet-400" aria-hidden="true" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">What’s in the database</h3>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh storage figures"
            className={`pressable ${FOCUS_RING} flex h-9 w-9 items-center justify-center rounded-full bg-surface3 text-ink2`}
          >
            <RefreshCw size={15} className={refreshing ? 'motion-safe:animate-spin' : ''} />
          </button>
        </div>

        <ul className="mt-2.5 divide-y divide-line">
          {nonEmpty.map((c) => (
            <li key={c.name} className="flex items-center justify-between py-2">
              <span className="text-[13.5px] text-ink2">{c.label}</span>
              <span className="big-num text-[14px] text-ink">{c.rows.toLocaleString('en-AU')}</span>
            </li>
          ))}
        </ul>

        <p className="mt-2.5 border-t border-line pt-2.5 text-[12.5px] text-ink2">
          <span className="big-num text-ink">{health.totalRows.toLocaleString('en-AU')}</span> rows
          across {nonEmpty.length} table{nonEmpty.length === 1 ? '' : 's'} with data in them.
        </p>
      </Card>

      {overdue && (
        <Callout className="mt-3" tone="warn" icon={<AlertTriangle size={15} />}>
          {health.lastExportAt === null
            ? 'There is no export of this data anywhere. Worth doing once, today.'
            : `It has been ${health.daysSince} days since the last export — longer than the ${EXPORT_NAG_DAYS}-day mark.`}
        </Callout>
      )}
    </>
  )
}
