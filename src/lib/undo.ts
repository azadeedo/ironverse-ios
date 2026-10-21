// ============================================================
// APP-WIDE UNDO
//
// One slot. The last destructive thing you did, and a function that puts it
// back. Deliberately tiny: a queue of undos is a lie, because the second undo
// almost never restores what the user thinks it will.
//
// Nothing here changes the existing toast API. `useUI().toast(...)` keeps
// working exactly as it did for every current caller; the undo pill is an
// extra affordance rendered by ToastHost when — and only when — something is
// actually undoable.
// ============================================================

import type { Table } from 'dexie'
import { create } from 'zustand'
import { useUI } from './store'

/** How long an undo stays offered. Long enough to read the toast and react. */
export const UNDO_WINDOW_MS = 9_000

export interface UndoAction {
  id: number
  /** what happened, past tense — "Deleted 2 eggs" */
  label: string
  /** button text; almost always just "Undo" */
  actionLabel: string
  /** epoch ms when it was captured */
  at: number
  /** puts the world back. Must be idempotent-safe to call once. */
  restore: () => Promise<void> | void
}

interface UndoState {
  pending: UndoAction | null
  /** register a destructive action; replaces any older pending undo */
  push: (label: string, restore: UndoAction['restore'], actionLabel?: string) => number
  /** run the pending restore; resolves false when there was nothing to undo */
  run: () => Promise<boolean>
  /** drop the offer without restoring (expiry, or the user moved on) */
  clear: (id?: number) => void
}

let undoId = 0
let expiryTimer: ReturnType<typeof setTimeout> | null = null

export const useUndo = create<UndoState>((set, get) => ({
  pending: null,

  push(label, restore, actionLabel = 'Undo') {
    const id = ++undoId
    if (expiryTimer) clearTimeout(expiryTimer)
    set({ pending: { id, label, actionLabel, at: Date.now(), restore } })
    expiryTimer = setTimeout(() => {
      if (get().pending?.id === id) set({ pending: null })
    }, UNDO_WINDOW_MS)
    return id
  },

  async run() {
    const action = get().pending
    if (!action) return false
    // clear first so a double-tap can't restore twice
    set({ pending: null })
    if (expiryTimer) clearTimeout(expiryTimer)
    try {
      await action.restore()
      useUI.getState().toast('Restored')
      return true
    } catch {
      useUI.getState().toast('Could not undo that', 'error')
      return false
    }
  },

  clear(id) {
    const current = get().pending
    if (!current) return
    if (id !== undefined && current.id !== id) return
    if (expiryTimer) clearTimeout(expiryTimer)
    set({ pending: null })
  },
}))

// ---------- imperative helpers (usable outside React) ----------

/** Register an undo without showing a toast. */
export function pushUndo(label: string, restore: UndoAction['restore']): number {
  return useUndo.getState().push(label, restore)
}

/**
 * The common case: tell the user what happened AND offer to take it back.
 * Uses the existing toast API untouched.
 */
export function toastWithUndo(
  message: string,
  restore: UndoAction['restore'],
  kind: 'success' | 'error' | 'info' = 'info',
): void {
  useUI.getState().toast(message, kind)
  useUndo.getState().push(message, restore)
}

// ---------- Dexie conveniences ----------

/**
 * Delete a row and offer to put it back, byte for byte.
 * Works for any table — food entries, weigh-ins, cardio logs, photos.
 */
export async function deleteWithUndo<T, K>(
  table: Table<T, K>,
  key: K,
  message: string,
): Promise<boolean> {
  const row = await table.get(key)
  if (row === undefined) return false
  await table.delete(key)
  toastWithUndo(message, async () => { await table.put(row) })
  return true
}

/**
 * Delete several rows from one table as a single undoable step.
 * (Clearing a meal, wiping a day's water log, and so on.)
 */
export async function deleteManyWithUndo<T, K>(
  table: Table<T, K>,
  keys: K[],
  message: string,
): Promise<number> {
  if (keys.length === 0) return 0
  const fetched = await Promise.all(keys.map((k) => table.get(k)))
  const rows: T[] = []
  for (const row of fetched) if (row !== undefined) rows.push(row as T)
  if (rows.length === 0) return 0
  await table.bulkDelete(keys)
  toastWithUndo(message, async () => { await table.bulkPut(rows) })
  return rows.length
}

/**
 * For edits nested INSIDE a row — deleting a set out of a workout log, pulling
 * an exercise from a session. Snapshots the whole row first, applies your
 * mutation, then offers to restore the snapshot.
 */
export async function mutateWithUndo<T, K>(
  table: Table<T, K>,
  key: K,
  message: string,
  mutate: (row: T) => Promise<void> | void,
): Promise<boolean> {
  const before = await table.get(key)
  if (before === undefined) return false
  const snapshot = structuredClone(before)
  await mutate(before)
  toastWithUndo(message, async () => { await table.put(snapshot) })
  return true
}
