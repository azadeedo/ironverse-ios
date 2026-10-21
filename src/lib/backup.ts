// ============================================================
// Backup, restore and automatic snapshots.
//
// This is the safety net for real data, so it is deliberately conservative:
//  - export walks every Dexie table, Blobs included (progress photos, meal
//    photos) serialised as base64 so JSON round-trips losslessly
//  - restore ALWAYS snapshots the current state first, then writes
//  - merge never destroys: existing ids win unless the incoming row is newer
//  - the v1 signatures (exportBackup/restoreBackup) still work unchanged
// ============================================================

import { db, setSetting, SETTING_KEYS } from '@/db'
import type { Snapshot } from '@/db/types'
import { newId, nowIso, todayStr } from './id'
import { isAppStoreEdition, isNativeApp } from './edition'

const FORMAT = 'ironverse-backup'
const FORMAT_VERSION = 2
const BLOB_KEY = '$blob'
const MAX_SNAPSHOTS = 10

// ---------- blob-safe serialisation ----------
function bytesToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function serialise(v: unknown): Promise<unknown> {
  if (v instanceof Blob) {
    return { [BLOB_KEY]: bytesToB64(await v.arrayBuffer()), type: v.type }
  }
  if (Array.isArray(v)) return Promise.all(v.map(serialise))
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = await serialise(val)
    }
    return out
  }
  return v
}

function deserialise(v: unknown): unknown {
  if (v && typeof v === 'object' && BLOB_KEY in (v as Record<string, unknown>)) {
    const rec = v as { [BLOB_KEY]: string; type?: string }
    return new Blob([b64ToBytes(rec[BLOB_KEY]) as BlobPart], { type: rec.type ?? '' })
  }
  if (Array.isArray(v)) return v.map(deserialise)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = deserialise(val)
    }
    return out
  }
  return v
}

// ---------- payload ----------
export interface BackupPayload {
  format: string
  version: number
  exportedAt: string
  appVersion?: string
  counts: Record<string, number>
  tables: Record<string, unknown[]>
  // ---- added for the iOS app (all optional, so every older backup still imports) ----
  /** Dexie schema version of the database that wrote it */
  schema?: number
  /** 'web' or 'ios' — where the backup was made */
  edition?: string
  /** SHA-256 (hex) of JSON.stringify(tables) — detects a truncated or edited file */
  checksum?: string
}

/** SHA-256 of the tables block, exactly as it is written into the file. */
export async function tablesChecksum(tables: Record<string, unknown[]>): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tables)))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null // no WebCrypto — the backup is still written, just without a checksum
  }
}

/** Everything in the database, Blobs included. */
export async function buildBackupPayload(
  onProgress?: (table: string) => void,
): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  for (const table of db.tables) {
    // snapshots are not themselves backed up — that would nest exponentially
    if (table.name === 'snapshots') continue
    onProgress?.(table.name)
    const rows = await table.toArray()
    tables[table.name] = (await serialise(rows)) as unknown[]
    counts[table.name] = rows.length
  }
  const checksum = await tablesChecksum(tables)
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: nowIso(),
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
    schema: db.verno,
    edition: isAppStoreEdition() ? 'ios' : 'web',
    counts,
    tables,
    ...(checksum ? { checksum } : {}),
  }
}

/** v1-compatible: returns a downloadable Blob of the whole database. */
export async function exportBackup(onProgress?: (table: string) => void): Promise<Blob> {
  const payload = await buildBackupPayload(onProgress)
  await setSetting(SETTING_KEYS.lastExportAt, payload.exportedAt)
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

/** IV-35: the same full backup, encrypted with a passphrase (AES-GCM). */
export async function exportEncryptedBackup(passphrase: string, onProgress?: (table: string) => void): Promise<Blob> {
  const payload = await buildBackupPayload(onProgress)
  const { encryptText } = await import('./vault')
  const env = await encryptText(JSON.stringify(payload), passphrase)
  await setSetting(SETTING_KEYS.lastExportAt, payload.exportedAt)
  return new Blob([JSON.stringify(env)], { type: 'application/json' })
}

export function backupFilename(): string {
  return `ironverse-backup-${todayStr()}.json`
}

// ---------- inspection (show me what's in it before writing) ----------
export interface BackupInfo {
  exportedAt: string
  version: number
  counts: Record<string, number>
  totalRows: number
  /** earliest / latest dated record found, for a human sanity check */
  dateRange?: { from: string; to: string }
  payload: BackupPayload
  /** 'verified' = checksum matched; 'unchecked' = an older backup made before checksums existed */
  integrity?: 'verified' | 'unchecked'
}

export class DamagedBackup extends Error {
  constructor(detail: string) { super(`This backup file is damaged or was changed after it was saved (${detail}). Nothing was imported.`) }
}

export class NeedsPassphrase extends Error { constructor() { super('This backup is encrypted — enter its passphrase') } }

export async function inspectBackup(file: Blob, passphrase?: string): Promise<BackupInfo> {
  let text = await file.text()
  let data: BackupPayload
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const { isVault, decryptText } = await import('./vault')
  if (isVault(data)) {
    if (!passphrase) throw new NeedsPassphrase()
    text = await decryptText(data, passphrase)
    data = JSON.parse(text)
  }
  if (data?.format !== FORMAT) throw new Error('That is not an Ironverse backup file.')
  if (!data.tables || typeof data.tables !== 'object') throw new DamagedBackup('no data tables')

  // integrity: every table must hold the number of rows the header says,
  // and (backups from this version on) the SHA-256 must match
  for (const [name, n] of Object.entries(data.counts ?? {})) {
    const rows = (data.tables as Record<string, unknown[]>)[name]
    if (n > 0 && (!Array.isArray(rows) || rows.length !== n)) throw new DamagedBackup(`${name}: expected ${n} rows, found ${Array.isArray(rows) ? rows.length : 0}`)
  }
  let integrity: BackupInfo['integrity'] = 'unchecked'
  if (data.checksum) {
    const actual = await tablesChecksum(data.tables)
    if (actual && actual !== data.checksum) throw new DamagedBackup('checksum mismatch')
    if (actual) integrity = 'verified'
  }

  const counts = data.counts ?? {}
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0)

  // scan for a date range across dated tables
  let from: string | undefined
  let to: string | undefined
  for (const rows of Object.values(data.tables ?? {})) {
    for (const row of rows as Record<string, unknown>[]) {
      const d = typeof row?.date === 'string' ? row.date : undefined
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
      if (!from || d < from) from = d
      if (!to || d > to) to = d
    }
  }

  return {
    exportedAt: data.exportedAt,
    version: data.version ?? 1,
    counts,
    totalRows,
    dateRange: from && to ? { from, to } : undefined,
    payload: data,
    integrity,
  }
}

// ---------- restore ----------
export type RestoreMode = 'merge' | 'replace'

/** Newest-wins timestamp for merge comparisons. */
function stamp(row: Record<string, unknown>): string {
  return String(row?.updatedAt ?? row?.createdAt ?? row?.date ?? '')
}

/**
 * Restore a backup. ALWAYS takes a pre-restore snapshot first, so a mistaken
 * restore is itself undoable.
 */
export async function restoreFromPayload(
  payload: BackupPayload,
  mode: RestoreMode,
  onProgress?: (table: string) => void,
): Promise<{ written: number }> {
  await takeSnapshot('pre-restore')

  const tables = payload.tables ?? {}
  let written = 0

  for (const table of db.tables) {
    if (table.name === 'snapshots') continue
    const raw = tables[table.name]
    if (!raw?.length) continue
    onProgress?.(table.name)
    const rows = raw.map(deserialise) as Record<string, unknown>[]

    if (mode === 'replace') {
      await table.clear()
      await table.bulkPut(rows as never[])
      written += rows.length
      continue
    }

    // merge: keep both; on id collision the newer row wins
    const existing = await table.toArray()
    const pk = table.schema.primKey.keyPath as string
    const byKey = new Map<unknown, Record<string, unknown>>()
    for (const row of existing as Record<string, unknown>[]) byKey.set(row[pk], row)

    const toWrite: Record<string, unknown>[] = []
    for (const row of rows) {
      const key = row[pk]
      const prev = byKey.get(key)
      if (!prev || stamp(row) >= stamp(prev)) toWrite.push(row)
    }
    if (toWrite.length) {
      await table.bulkPut(toWrite as never[])
      written += toWrite.length
    }
  }
  return { written }
}

/** v1-compatible wrapper. */
export async function restoreBackup(file: Blob, mode: RestoreMode): Promise<void> {
  const info = await inspectBackup(file)
  await restoreFromPayload(info.payload, mode)
}

// ---------- snapshots ----------
async function compressString(text: string): Promise<{ payload: string; compressed: boolean }> {
  // CompressionStream is available on modern iOS Safari; fall back to plain text
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (!CS) return { payload: text, compressed: false }
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CS('gzip'))
    const buf = await new Response(stream).arrayBuffer()
    return { payload: bytesToB64(buf), compressed: true }
  } catch {
    return { payload: text, compressed: false }
  }
}

async function decompressString(payload: string, compressed: boolean): Promise<string> {
  if (!compressed) return payload
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream
  if (!DS) throw new Error('This browser cannot read compressed snapshots.')
  const bytes = b64ToBytes(payload)
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DS('gzip'))
  return new Response(stream).text()
}

/** Write a snapshot into the snapshots table, trimming to the last 10. */
export async function takeSnapshot(reason: Snapshot['reason']): Promise<Snapshot> {
  const payload = await buildBackupPayload()
  const json = JSON.stringify(payload)
  const { payload: stored, compressed } = await compressString(json)

  const snap: Snapshot = {
    id: newId(),
    createdAt: nowIso(),
    date: todayStr(),
    reason,
    counts: payload.counts,
    bytes: stored.length,
    compressed,
    payload: stored,
  }
  await db.snapshots.put(snap)

  const all = await db.snapshots.orderBy('createdAt').reverse().toArray()
  const extra = all.slice(MAX_SNAPSHOTS)
  if (extra.length) await db.snapshots.bulkDelete(extra.map((s) => s.id))

  await setSetting(SETTING_KEYS.lastSnapshotDate, snap.date)
  return snap
}

/** in-flight guard: React StrictMode invokes effects twice in dev */
let autoSnapshotRunning: Promise<void> | null = null

/** Once per calendar day, on app open. Never blocks startup. */
export async function autoSnapshotIfDue(): Promise<void> {
  if (autoSnapshotRunning) return autoSnapshotRunning
  autoSnapshotRunning = runAutoSnapshot().finally(() => { autoSnapshotRunning = null })
  return autoSnapshotRunning
}

async function runAutoSnapshot(): Promise<void> {
  try {
    // claim the day atomically so two callers can never both snapshot
    const claimed = await db.transaction('rw', db.settings, async () => {
      const last = await db.settings.get(SETTING_KEYS.lastSnapshotDate)
      if (last?.value === todayStr()) return false
      await db.settings.put({ key: SETTING_KEYS.lastSnapshotDate, value: todayStr() })
      return true
    })
    if (!claimed) return
    // skip on a brand-new empty database — nothing worth snapshotting yet
    const [logs, weighs, food] = await Promise.all([
      db.workoutLogs.count(), db.weighIns.count(), db.foodLog.count(),
    ])
    if (logs + weighs + food === 0) return
    await takeSnapshot('auto')
  } catch {
    // a failed snapshot must never stop the app opening
  }
}

export async function restoreSnapshot(id: string, mode: RestoreMode = 'replace'): Promise<void> {
  const snap = await db.snapshots.get(id)
  if (!snap) throw new Error('That snapshot no longer exists.')
  const json = await decompressString(snap.payload, snap.compressed)
  const payload = JSON.parse(json) as BackupPayload
  await restoreFromPayload(payload, mode)
}

export async function snapshotToFile(id: string): Promise<Blob> {
  const snap = await db.snapshots.get(id)
  if (!snap) throw new Error('That snapshot no longer exists.')
  const json = await decompressString(snap.payload, snap.compressed)
  return new Blob([json], { type: 'application/json' })
}

// ---------- export nag ----------
export const EXPORT_NAG_DAYS = 30

export async function daysSinceExport(): Promise<number | null> {
  const row = await db.settings.get(SETTING_KEYS.lastExportAt)
  if (!row?.value) return null
  const then = new Date(String(row.value)).getTime()
  if (!isFinite(then)) return null
  return Math.floor((Date.now() - then) / 86_400_000)
}

// ---------- file out ----------
export function downloadBlob(blob: Blob, filename: string): void {
  // iOS app: <a download> does nothing inside the native shell — use the share sheet
  if (isNativeApp()) { void import('@/native/files').then((m) => m.nativeShareBlob(blob, filename)).catch(() => {}); return }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/**
 * iOS Safari handles the share sheet far better than <a download> for large
 * files, so try that first and fall back to a download.
 */
export async function shareOrDownload(blob: Blob, filename: string, title?: string): Promise<void> {
  if (isNativeApp()) {
    const { nativeShareBlob } = await import('@/native/files')
    if (await nativeShareBlob(blob, filename, title)) return
  }
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title ?? filename })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  downloadBlob(blob, filename)
}

// ---------- CSV export ----------
function csvEscape(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return ''
  const cols = headers ?? [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const lines = [cols.join(',')]
  for (const row of rows) lines.push(cols.map((c) => csvEscape(row[c])).join(','))
  return '﻿' + lines.join('\r\n')
}
