// ============================================================
// BACKUP — the safety net. Export, inspect-then-import, and automatic
// daily snapshots. Nothing here writes to the database without first
// showing exactly what will change.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle, Camera, CheckCircle2, Clock, Download, FileJson,
  HardDriveDownload, History, Share2, Upload,
} from 'lucide-react'
import {
  Badge, Button, Card, ConfirmDialog, PageHeader, Section, Sheet, Spinner,
} from '@/components/ui'
import { db } from '@/db'
import type { Snapshot } from '@/db/types'
import {
  backupFilename, daysSinceExport, exportEncryptedBackup, NeedsPassphrase, EXPORT_NAG_DAYS, exportBackup, inspectBackup,
  restoreFromPayload, restoreSnapshot, shareOrDownload, snapshotToFile,
  takeSnapshot, toCsv, type BackupInfo, type RestoreMode,
} from '@/lib/backup'
import { pickFile } from '@/lib/files'
import { fmtDayShort, fmtRelative } from '@/lib/fmt'
import { useUI } from '@/lib/store'

const TABLE_LABELS: Record<string, string> = {
  profile: 'Profile', plans: 'Plans', workoutLogs: 'Workouts', foods: 'My foods',
  foodLog: 'Food entries', weighIns: 'Weigh-ins', measurements: 'Measurements',
  waterLog: 'Water', creatineLog: 'Creatine', cardioLog: 'Cardio',
  reminders: 'Reminders', settings: 'Settings', equipmentProfiles: 'Equipment profiles',
  recipes: 'Recipes', progressPhotos: 'Progress photos', exerciseMeta: 'Exercise notes',
  barcodeCache: 'Scanned products', dayAdjust: 'Calorie adjustments',
  programOverrides: 'Coach sessions',
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function BackupScreen() {
  const { toast } = useUI()
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<BackupInfo | null>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [restoreSnapId, setRestoreSnapId] = useState<string | null>(null)
  const [sinceExport, setSinceExport] = useState<number | null>(null)
  // IV-35 encrypted vault
  const [vault, setVault] = useState<null | { mode: 'export' } | { mode: 'import'; file: File }>(null)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')

  const snapshots = useLiveQuery(
    () => db.snapshots.orderBy('createdAt').reverse().toArray(),
    [],
  )

  const liveCounts = useLiveQuery(async () => {
    const out: Record<string, number> = {}
    for (const t of db.tables) {
      if (t.name === 'snapshots') continue
      out[t.name] = await t.count()
    }
    return out
  }, [])

  useEffect(() => {
    void daysSinceExport().then(setSinceExport)
  }, [busy])

  const totalRows = useMemo(
    () => Object.values(liveCounts ?? {}).reduce((a, b) => a + b, 0),
    [liveCounts],
  )

  // ---------- export ----------
  const doExport = async () => {
    setBusy('Building your backup…')
    try {
      const blob = await exportBackup((t) => setBusy(`Reading ${TABLE_LABELS[t] ?? t}…`))
      await shareOrDownload(blob, backupFilename(), 'Ironverse backup')
      setSinceExport(0)
      toast('Backup saved')
    } catch (e) {
      toast((e as Error).message || 'Backup failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const doCsv = async (which: 'workouts' | 'food' | 'weighIns') => {
    setBusy('Building CSV…')
    try {
      let rows: Record<string, unknown>[] = []
      let name = ''
      if (which === 'workouts') {
        const logs = await db.workoutLogs.orderBy('date').toArray()
        rows = logs.flatMap((l) =>
          l.exercises.flatMap((ex) =>
            ex.sets.map((s) => ({
              date: l.date, workout: l.title, exercise: ex.exerciseId,
              set: s.setIndex + 1, weightKg: s.weightKg ?? '', reps: s.reps ?? '',
              timeSec: s.timeSec ?? '', rir: s.rir ?? '', done: s.done ? 'yes' : 'no',
            })),
          ),
        )
        name = 'ironverse-workouts.csv'
      } else if (which === 'food') {
        const entries = await db.foodLog.orderBy('date').toArray()
        rows = entries.map((e) => ({
          date: e.date, meal: e.meal, food: e.name, grams: e.grams,
          kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat,
        }))
        name = 'ironverse-food.csv'
      } else {
        const w = await db.weighIns.orderBy('date').toArray()
        rows = w.map((x) => ({ date: x.date, weightKg: x.weightKg, note: x.note ?? '' }))
        name = 'ironverse-weigh-ins.csv'
      }
      if (rows.length === 0) {
        toast('Nothing logged there yet', 'info')
        return
      }
      await shareOrDownload(new Blob([toCsv(rows)], { type: 'text/csv' }), name, name)
      toast('CSV saved')
    } catch (e) {
      toast((e as Error).message || 'CSV failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  // ---------- import ----------
  const pickBackup = async () => {
    const [file] = await pickFile('application/json,.json')
    if (!file) return
    setBusy('Reading file…')
    try {
      const info = await inspectBackup(file)
      setPending(info)
      setMode('merge')
    } catch (e) {
      if (e instanceof NeedsPassphrase) { setPass(''); setVault({ mode: 'import', file }); return }
      toast((e as Error).message || 'Could not read that file', 'error')
    } finally {
      setBusy(null)
    }
  }

  const runRestore = async () => {
    if (!pending) return
    setBusy('Snapshotting current data…')
    try {
      const { written } = await restoreFromPayload(pending.payload, mode, (t) =>
        setBusy(`Restoring ${TABLE_LABELS[t] ?? t}…`),
      )
      toast(`Restored ${written} records`)
      setPending(null)
      setTimeout(() => window.location.reload(), 700)
    } catch (e) {
      toast((e as Error).message || 'Restore failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const runVault = async () => {
    if (!vault) return
    if (vault.mode === 'export') {
      if (pass.length < 8) { toast('Use at least 8 characters', 'error'); return }
      if (pass !== pass2) { toast('The two passphrases don’t match', 'error'); return }
      setBusy('Encrypting your backup…')
      try {
        const blob = await exportEncryptedBackup(pass, (t) => setBusy(`Reading ${TABLE_LABELS[t] ?? t}…`))
        await shareOrDownload(blob, backupFilename().replace('.json', '-encrypted.json'), 'Ironverse encrypted backup')
        setSinceExport(0); setVault(null); toast('Encrypted backup saved')
      } catch (e) { toast((e as Error).message || 'Backup failed', 'error') } finally { setBusy(null); setPass(''); setPass2('') }
    } else {
      setBusy('Decrypting…')
      try { const info = await inspectBackup(vault.file, pass); setPending(info); setMode('merge'); setVault(null) }
      catch (e) { toast((e as Error).message || 'Could not open that file', 'error') } finally { setBusy(null); setPass('') }
    }
  }

  // ---------- snapshots ----------
  const doSnapshot = async () => {
    setBusy('Taking snapshot…')
    try {
      await takeSnapshot('manual')
      toast('Snapshot saved')
    } catch (e) {
      toast((e as Error).message || 'Snapshot failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const doRestoreSnapshot = async (id: string) => {
    setBusy('Restoring snapshot…')
    try {
      await restoreSnapshot(id, 'replace')
      toast('Snapshot restored')
      setTimeout(() => window.location.reload(), 700)
    } catch (e) {
      toast((e as Error).message || 'Restore failed', 'error')
    } finally {
      setBusy(null)
      setRestoreSnapId(null)
    }
  }

  const exportSnapshot = async (s: Snapshot) => {
    try {
      const blob = await snapshotToFile(s.id)
      await shareOrDownload(blob, `ironverse-snapshot-${s.date}.json`, 'Ironverse snapshot')
    } catch (e) {
      toast((e as Error).message || 'Export failed', 'error')
    }
  }

  const nagging = sinceExport !== null && sinceExport >= EXPORT_NAG_DAYS

  return (
    <div className="pb-8">
      <PageHeader title="Backup" back subtitle="Your data lives on this phone — keep a copy somewhere else." />

      {busy && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl2 border border-line bg-surface2 p-3">
          <Spinner className="h-5 w-5" />
          <span className="text-[13.5px] text-ink2">{busy}</span>
        </div>
      )}

      {nagging && (
        <div className="mx-4 mb-3 flex items-start gap-3 rounded-xl2 border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="text-[13px] text-ink2">
            Your last export was {sinceExport} days ago. Download a fresh one — it takes a second.
          </div>
        </div>
      )}

      {/* ---------- export ---------- */}
      <Section title="Export">
        <Card className="p-4">
          <div className="flex items-baseline justify-between">
            <div className="big-num text-[26px] text-ink">{totalRows.toLocaleString('en-AU')}</div>
            <div className="text-[12px] text-ink3">
              {sinceExport === null ? 'never exported' : sinceExport === 0 ? 'exported today' : `exported ${sinceExport}d ago`}
            </div>
          </div>
          <div className="mb-3 text-[12px] uppercase tracking-wide text-ink3">records stored</div>
          <Button full onClick={doExport} disabled={!!busy}>
            <Download size={17} /> Download backup
          </Button>
          <Button full variant="secondary" className="mt-2" onClick={() => { setPass(''); setPass2(''); setVault({ mode: 'export' }) }} disabled={!!busy}>
            Download encrypted backup (passphrase)
          </Button>
          <p className="mt-2 text-[12px] leading-relaxed text-ink3">
            One JSON file with everything — workouts, food, weigh-ins, photos. On iPhone the
            share sheet is the reliable way to keep it (Files, or mail it to yourself).
          </p>
        </Card>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ['workouts', 'Workouts'],
            ['food', 'Food'],
            ['weighIns', 'Weigh-ins'],
          ] as const).map(([key, label]) => (
            <Button key={key} variant="secondary" small onClick={() => doCsv(key)} disabled={!!busy}>
              {label} CSV
            </Button>
          ))}
        </div>
      </Section>

      <Sheet open={!!vault} onClose={() => setVault(null)} title={vault?.mode === 'export' ? 'Encrypted backup' : 'Open encrypted backup'}>
        <div className="space-y-2.5 text-[13px]">
          <p className="text-ink2">{vault?.mode === 'export'
            ? 'The file is locked with AES-256 using your passphrase, on this phone. The passphrase is not saved anywhere — if you forget it, the file cannot be opened.'
            : 'Enter the passphrase you used when you made this backup.'}</p>
          <input type="password" autoComplete="new-password" className="w-full rounded-xl border border-line bg-surface3 px-3 py-2.5 text-[15px]" placeholder="Passphrase" aria-label="Passphrase" value={pass} onChange={(e) => setPass(e.target.value)} />
          {vault?.mode === 'export' && <input type="password" autoComplete="new-password" className="w-full rounded-xl border border-line bg-surface3 px-3 py-2.5 text-[15px]" placeholder="Repeat passphrase" aria-label="Repeat passphrase" value={pass2} onChange={(e) => setPass2(e.target.value)} />}
          <Button full onClick={() => void runVault()} disabled={!!busy}>{vault?.mode === 'export' ? 'Encrypt and save' : 'Unlock and inspect'}</Button>
        </div>
      </Sheet>

      {/* ---------- import ---------- */}
      <Section title="Restore from a file">
        <Card className="p-4">
          <Button full variant="outline" onClick={pickBackup} disabled={!!busy}>
            <Upload size={17} /> Choose a backup file
          </Button>
          <p className="mt-2 text-[12px] leading-relaxed text-ink3">
            You'll see what's inside and choose how to apply it before anything is written.
          </p>
        </Card>
      </Section>

      {/* ---------- snapshots ---------- */}
      <Section
        title="Automatic snapshots"
        action={
          <button type="button" className="text-[13px] font-semibold text-brand" onClick={doSnapshot} disabled={!!busy}>
            Snapshot now
          </button>
        }
      >
        <p className="mb-2 text-[12px] text-ink3">
          Taken once a day when you open the app. The last 10 are kept on this device.
        </p>
        {!snapshots ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : snapshots.length === 0 ? (
          <Card className="p-4 text-[13px] text-ink3">
            No snapshots yet — the first one is taken next time you open the app with data logged.
          </Card>
        ) : (
          <div className="space-y-2">
            {snapshots.map((s) => {
              const rows = Object.values(s.counts).reduce((a, b) => a + b, 0)
              return (
                <Card key={s.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface3">
                    {s.reason === 'pre-restore' ? (
                      <History size={18} className="text-amber-400" />
                    ) : s.reason === 'manual' ? (
                      <HardDriveDownload size={18} className="text-brand" />
                    ) : (
                      <Clock size={18} className="text-ink3" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-ink">
                      {fmtDayShort(s.date)}
                      {s.reason === 'pre-restore' && (
                        <Badge tone="amber" className="ml-2">before restore</Badge>
                      )}
                    </div>
                    <div className="text-[12px] text-ink3">
                      {rows.toLocaleString('en-AU')} records · {fmtBytes(s.bytes)} · {fmtRelative(s.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Export snapshot"
                    className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-surface3 text-ink2"
                    onClick={() => exportSnapshot(s)}
                  >
                    <Share2 size={15} />
                  </button>
                  <Button small variant="secondary" onClick={() => setRestoreSnapId(s.id)}>
                    Restore
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      {/* ---------- what's in the database now ---------- */}
      <Section title="On this device">
        <Card className="divide-y divide-line">
          {Object.entries(liveCounts ?? {})
            .filter(([, n]) => n > 0)
            .map(([table, n]) => (
              <div key={table} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[13.5px] text-ink2">{TABLE_LABELS[table] ?? table}</span>
                <span className="text-[13.5px] font-semibold text-ink">{n.toLocaleString('en-AU')}</span>
              </div>
            ))}
        </Card>
      </Section>

      {/* ---------- import review sheet ---------- */}
      <Sheet open={!!pending} onClose={() => setPending(null)} title="Review this backup" tall>
        {pending && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-[13px] text-ink2">
                <FileJson size={16} className="text-brand" />
                Exported {fmtRelative(pending.exportedAt)}
              </div>
              <div className="mt-1 text-[12px] text-ink3">
                {pending.totalRows.toLocaleString('en-AU')} records
                {pending.dateRange && ` · ${fmtDayShort(pending.dateRange.from)} → ${fmtDayShort(pending.dateRange.to)}`}
              </div>
            </Card>

            <Card className="divide-y divide-line">
              {Object.entries(pending.counts)
                .filter(([, n]) => n > 0)
                .map(([table, n]) => {
                  const now = liveCounts?.[table] ?? 0
                  return (
                    <div key={table} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[13.5px] text-ink2">{TABLE_LABELS[table] ?? table}</span>
                      <span className="text-[13px] text-ink">
                        <span className="text-ink3">{now} now</span>
                        <span className="mx-1.5 text-ink3">→</span>
                        <span className="font-semibold">{n} in file</span>
                      </span>
                    </div>
                  )
                })}
            </Card>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink">How should it be applied?</div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMode('merge')}
                  className={`w-full rounded-xl2 border p-3 text-left ${mode === 'merge' ? 'border-brand bg-brand/10' : 'border-line bg-surface2'}`}
                >
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                    {mode === 'merge' && <CheckCircle2 size={16} className="text-brand" />}
                    Merge — keep both
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink3">
                    Adds anything missing. Where the same record exists in both, the newer one wins.
                    Nothing on this device is deleted.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('replace')}
                  className={`w-full rounded-xl2 border p-3 text-left ${mode === 'replace' ? 'border-red-500 bg-red-500/10' : 'border-line bg-surface2'}`}
                >
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                    {mode === 'replace' && <CheckCircle2 size={16} className="text-red-400" />}
                    Replace — file wins
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink3">
                    Wipes each table in the file and writes the file's version. A snapshot of the
                    current data is taken first, so this is still undoable.
                  </div>
                </button>
              </div>
            </div>

            <Button
              full
              variant={mode === 'replace' ? 'danger' : 'primary'}
              onClick={() => (mode === 'replace' ? setConfirmReplace(true) : runRestore())}
              disabled={!!busy}
            >
              {mode === 'replace' ? 'Replace my data' : 'Merge into my data'}
            </Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        onConfirm={runRestore}
        title="Replace everything?"
        message="Current records in the tables present in this file will be overwritten. A snapshot is saved first, so you can roll back."
        confirmLabel="Replace"
      />

      <ConfirmDialog
        open={!!restoreSnapId}
        onClose={() => setRestoreSnapId(null)}
        onConfirm={() => restoreSnapId && doRestoreSnapshot(restoreSnapId)}
        title="Restore this snapshot?"
        message="Your current data is snapshotted first, so you can come straight back to it."
        confirmLabel="Restore"
        danger={false}
      />

      <div className="px-4 pt-2">
        <div className="flex items-start gap-2 text-[12px] leading-relaxed text-ink3">
          <Camera size={14} className="mt-0.5 shrink-0" />
          Progress photos are included in the backup, which makes the file bigger. Everything
          stays on your device — nothing is uploaded anywhere.
        </div>
      </div>
    </div>
  )
}
