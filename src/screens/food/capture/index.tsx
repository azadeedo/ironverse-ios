// ============================================================
// CAPTURE CONTRACT — photo estimate + barcode scan.
// This file defines the public surface the Food screen mounts: CaptureSheet,
// CaptureSheetProps, CaptureResult and DraftItem. The names and prop shapes
// must not change.
//
// Nothing in here writes to the food log. The sheet produces a CaptureResult
// and hands it to onConfirm — the Food screen owns the write.
// ============================================================

import { useEffect, useState } from 'react'
import { Segmented, Sheet } from '@/components/ui'
import { energyUnit, halalMode } from '@/db/defaults'
import { BarcodeFlow } from './BarcodeFlow'
import { PhotoFlow } from './PhotoFlow'
import { ProGate } from '@/components/ProGate'
import { MEALS } from '../helpers'
import { useProfile } from '../useFoodData'
import type { CaptureResult, CaptureSheetProps, DraftItem } from './types'

export type { CaptureResult, CaptureSheetProps, DraftItem } from './types'

const mealLabel = (k: string) => MEALS.find((m) => m.key === k)?.label ?? 'meal'

export function CaptureSheet({ open, onClose, meal, onConfirm, mode = 'photo' }: CaptureSheetProps) {
  const profile = useProfile()
  const [tab, setTab] = useState<'photo' | 'barcode'>(mode)
  const [busy, setBusy] = useState(false)

  // a fresh open always starts in the mode the caller asked for
  useEffect(() => {
    if (open) {
      setTab(mode)
      setBusy(false)
    }
  }, [open, mode])

  const halal = halalMode(profile)
  const unit = energyUnit(profile)
  const confirmLabel = `Add to ${mealLabel(meal)}`

  const confirm = async (items: DraftItem[], source: 'photo' | 'barcode', photo?: Blob) => {
    const clean = items.filter((i) => i.name.trim().length > 0 && i.grams > 0)
    if (clean.length === 0) return
    const result: CaptureResult = { items: clean, source }
    if (photo) result.photo = photo
    setBusy(true)
    try {
      await onConfirm(result)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={tab === 'photo' ? 'Estimate from a photo' : 'Scan a barcode'} tall>
      <Segmented
        options={[
          { value: 'photo', label: 'Photo estimate' },
          { value: 'barcode', label: 'Barcode' },
        ]}
        value={tab}
        onChange={(v) => setTab(v)}
      />

      <div className="mt-4">
        {tab === 'photo' ? (
          <ProGate feature="aiPhoto"><PhotoFlow
            halal={halal}
            unit={unit}
            confirmLabel={confirmLabel}
            busy={busy}
            onConfirm={(items, photo) => { void confirm(items, 'photo', photo) }}
          /></ProGate>
        ) : (
          <ProGate feature="barcode"><BarcodeFlow
            halal={halal}
            unit={unit}
            confirmLabel={confirmLabel}
            busy={busy}
            onConfirm={(items) => { void confirm(items, 'barcode') }}
          /></ProGate>
        )}
      </div>
    </Sheet>
  )
}

export default CaptureSheet
