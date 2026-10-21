// ============================================================
// CAPTURE CONTRACT types.
// These shapes are the public surface the Food screen mounts. They are
// re-exported unchanged from ./index — never rename or reshape them.
// ============================================================

import type { MealKey } from '@/db/types'

/** One identified item from a photo estimate or a scanned product. */
export interface DraftItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
  /** 0..1 — how sure the estimate is; undefined for scanned products */
  confidence?: number
  barcode?: string
}

export interface CaptureResult {
  items: DraftItem[]
  source: 'photo' | 'barcode'
  /** the photo the estimate came from, so it can be attached to the log */
  photo?: Blob
}

export interface CaptureSheetProps {
  open: boolean
  onClose: () => void
  /** which meal the confirmed items should be logged into */
  meal: MealKey
  /** called only after the user confirms — never log automatically */
  onConfirm: (result: CaptureResult) => void | Promise<void>
  /** 'photo' opens the camera flow, 'barcode' the scanner */
  mode?: 'photo' | 'barcode'
}
