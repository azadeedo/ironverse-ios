// ============================================================
// PRE-UPGRADE BACKUP
//
// Dexie upgrades the 'iron-verse' database the moment it first opens at a new
// version. Before that can happen, this copies EVERY object store, untouched,
// into a separate database ('iron-verse-preupgrade'). If anything about an
// upgrade ever went wrong, the original rows still exist byte-for-byte and can
// be restored from Backup → "Pre-upgrade copies".
//
// It uses raw IndexedDB on purpose: opening without a version number never
// triggers an upgrade, so reading the old data is completely side-effect free.
// ============================================================

const MAIN = 'iron-verse'
const VAULT = 'iron-verse-preupgrade'
/** Dexie stores version × 10 in IndexedDB. v3 schema = 30. */
export const TARGET_IDB_VERSION = 30

export interface PreUpgradeDump {
  id: string
  at: string
  fromVersion: number
  toVersion: number
  counts: Record<string, number>
  data: Record<string, unknown[]>
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}

function openRaw(name: string, version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version)
    r.onupgradeneeded = () => upgrade?.(r.result)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
    r.onblocked = () => rej(new Error('blocked'))
  })
}

async function readAll(db: IDBDatabase): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  const names = Array.from(db.objectStoreNames)
  if (!names.length) return out
  const tx = db.transaction(names, 'readonly')
  for (const n of names) out[n] = await req(tx.objectStore(n).getAll())
  return out
}

/**
 * Run before the app touches Dexie. Returns the dump written, or null when no
 * backup was needed (fresh install, or already on the current version).
 */
export async function backupBeforeUpgrade(): Promise<PreUpgradeDump | null> {
  if (typeof indexedDB === 'undefined') return null
  let main: IDBDatabase
  try {
    main = await openRaw(MAIN)
  } catch {
    return null
  }
  const fromVersion = main.version
  const empty = main.objectStoreNames.length === 0
  if (empty || fromVersion >= TARGET_IDB_VERSION) {
    main.close()
    // opening a brand-new name creates an empty v1 database; leave it for Dexie
    return null
  }
  const data = await readAll(main)
  main.close()
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]))
  const dump: PreUpgradeDump = {
    id: `pre-${fromVersion}-to-${TARGET_IDB_VERSION}-${Date.now()}`,
    at: new Date().toISOString(),
    fromVersion,
    toVersion: TARGET_IDB_VERSION,
    counts,
    data,
  }
  const vault = await openRaw(VAULT, 1, (db) => {
    if (!db.objectStoreNames.contains('dumps')) db.createObjectStore('dumps', { keyPath: 'id' })
  })
  const tx = vault.transaction('dumps', 'readwrite')
  await req(tx.objectStore('dumps').put(dump))
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  vault.close()
  try {
    localStorage.setItem('ironverse:lastPreUpgrade', JSON.stringify({ id: dump.id, at: dump.at, counts }))
  } catch { /* storage full or blocked — the vault copy still exists */ }
  return dump
}

export async function listPreUpgradeDumps(): Promise<Omit<PreUpgradeDump, 'data'>[]> {
  if (typeof indexedDB === 'undefined') return []
  try {
    const vault = await openRaw(VAULT, 1, (db) => {
      if (!db.objectStoreNames.contains('dumps')) db.createObjectStore('dumps', { keyPath: 'id' })
    })
    const all = (await req(vault.transaction('dumps', 'readonly').objectStore('dumps').getAll())) as PreUpgradeDump[]
    vault.close()
    return all.map(({ data: _d, ...rest }) => rest).sort((a, b) => b.at.localeCompare(a.at))
  } catch {
    return []
  }
}

export async function getPreUpgradeDump(id: string): Promise<PreUpgradeDump | undefined> {
  const vault = await openRaw(VAULT, 1, (db) => {
    if (!db.objectStoreNames.contains('dumps')) db.createObjectStore('dumps', { keyPath: 'id' })
  })
  const d = (await req(vault.transaction('dumps', 'readonly').objectStore('dumps').get(id))) as PreUpgradeDump | undefined
  vault.close()
  return d
}
