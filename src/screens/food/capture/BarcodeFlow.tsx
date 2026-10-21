// ============================================================
// Barcode → Open Food Facts → editable draft.
//
//  - The live scanner only appears when BarcodeDetector actually exists.
//    When it doesn't (most iPhones), he types the number instead and the
//    lookup is identical — no dead button, no silent failure.
//  - The cache is checked first, so a product scanned once works forever
//    offline. Recent scans are listed for exactly that reason.
//  - Australian labels are in kJ; barcode.ts already converts. Both the
//    per-100g and the per-serve figures are shown so he picks the one that
//    matches the pack.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Barcode, Camera, Keyboard, RefreshCw, ScanLine, Search,
} from 'lucide-react'
import { Badge, Button, Input, Segmented, Spinner } from '@/components/ui'
import type { EnergyUnit } from '@/db/types'
import {
  BarcodeError, NO_DETECTOR_NOTE, barcodeDetectorSupported, cameraSupported,
  detectBarcodeInImage, isPlausibleBarcode, lookupBarcode, matchConfidence, normaliseBarcode,
  portionOf, recentScans, startLiveScan, type LiveScanHandle, type ScannedProduct,
} from '@/lib/barcode'
import { fmtEnergy } from '@/lib/energy'
import { cautionReason, isHalalHidden, primaryTagLabel } from '@/lib/halal'
import { compressImage } from './compress'
import { DraftEditor } from './DraftEditor'
import type { DraftItem } from './types'

type Stage = 'start' | 'live' | 'looking' | 'product' | 'draft'
type Basis = 'serve' | 'per100'

interface Problem { headline: string; detail?: string }

export function BarcodeFlow({ halal, unit, confirmLabel, busy, onConfirm }: {
  halal: boolean
  unit: EnergyUnit
  confirmLabel: string
  busy?: boolean
  onConfirm: (items: DraftItem[]) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanRef = useRef<LiveScanHandle | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('start')
  const [manual, setManual] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [product, setProduct] = useState<ScannedProduct | null>(null)
  const [basis, setBasis] = useState<Basis>('per100')
  const [gramsStr, setGramsStr] = useState('100')
  const [recent, setRecent] = useState<ScannedProduct[]>([])
  const [items, setItems] = useState<DraftItem[]>([])
  const [seedKey, setSeedKey] = useState('start')

  const canScanLive = barcodeDetectorSupported() && cameraSupported()

  useEffect(() => {
    void recentScans(8).then(setRecent)
  }, [])

  // the camera must always be released, however this unmounts
  useEffect(() => () => { scanRef.current?.stop(); scanRef.current = null }, [])

  const stopLive = () => {
    scanRef.current?.stop()
    scanRef.current = null
  }

  const showProduct = (p: ScannedProduct) => {
    setProduct(p)
    setBasis(p.servingGrams ? 'serve' : 'per100')
    setGramsStr(String(p.servingGrams ?? 100))
    setStage('product')
    void recentScans(8).then(setRecent)
  }

  const doLookup = async (rawCode: string, forceRefresh = false) => {
    const code = normaliseBarcode(rawCode)
    setProblem(null)
    setStage('looking')
    try {
      showProduct(await lookupBarcode(code, { forceRefresh }))
    } catch (err) {
      const be = err instanceof BarcodeError ? err : null
      setProblem({ headline: be?.message ?? "That lookup didn't work.", detail: be?.detail })
      setStage('start')
      setManual(code)
    }
  }

  const beginLive = async () => {
    setProblem(null)
    setStage('live')
    // wait for the <video> to exist before handing it to the scanner
    await new Promise((r) => setTimeout(r, 0))
    const el = videoRef.current
    if (!el) return
    scanRef.current = await startLiveScan(
      el,
      (code) => { stopLive(); void doLookup(code) },
      (message) => { stopLive(); setProblem({ headline: message }); setStage('start') },
    )
  }

  const scanFromPhoto = async (file: File | undefined) => {
    if (!file) return
    setProblem(null)
    setStage('looking')
    try {
      const small = await compressImage(file, 1600, 0.85)
      const code = await detectBarcodeInImage(small)
      if (!code) {
        setProblem({
          headline: barcodeDetectorSupported()
            ? "No barcode was found in that photo."
            : NO_DETECTOR_NOTE,
          detail: barcodeDetectorSupported()
            ? 'Fill the frame with the barcode, hold steady, and keep it flat.'
            : undefined,
        })
        setStage('start')
        return
      }
      await doLookup(code)
    } catch {
      setProblem({ headline: "That photo couldn't be read.", detail: 'Try again, or type the number.' })
      setStage('start')
    }
  }

  const useProduct = () => {
    if (!product) return
    const grams = Math.max(1, Math.round(parseFloat(gramsStr.replace(',', '.')) || 0))
    const p = portionOf(product.per100, grams)
    setItems([{
      name: product.brand ? `${product.name} (${product.brand})` : product.name,
      grams: p.grams,
      kcal: p.kcal,
      protein: p.protein,
      carbs: p.carbs,
      fat: p.fat,
      fibre: p.fibre,
      sugar: p.sugar,
      sodium: p.sodium,
      satFat: p.satFat,
      barcode: product.barcode,
    }])
    setSeedKey(`scan-${product.barcode}-${Date.now()}`)
    setStage('draft')
  }

  // ---------- draft ----------
  if (stage === 'draft') {
    return (
      <DraftEditor
        seedItems={items}
        seedKey={seedKey}
        halal={halal}
        unit={unit}
        confirmLabel={confirmLabel}
        busy={busy}
        note={product?.cached
          ? 'Straight off the label you scanned before — stored on this phone, so it works offline.'
          : 'Straight off the label in Open Food Facts. Community data, so give it a sanity check.'}
        onConfirm={onConfirm}
        footer={
          <button
            type="button"
            onClick={() => setStage('product')}
            className="pressable mt-2 w-full py-2 text-center text-[13px] font-semibold text-ink3"
          >
            Back to the product
          </button>
        }
      />
    )
  }

  // ---------- product ----------
  if (stage === 'product' && product) {
    const serveG = product.servingGrams
    const perServe = serveG ? portionOf(product.per100, serveG) : null
    const flagged = isHalalHidden({ dietTags: product.dietTags }, halal)
    const caution = cautionReason({ dietTags: product.dietTags })
    const grams = Math.max(0, Math.round(parseFloat(gramsStr.replace(',', '.')) || 0))
    const chosen = portionOf(product.per100, grams)

    const column = (title: string, sub: string, m: { kcal: number; protein: number; carbs: number; fat: number }) => (
      <div className="flex-1 rounded-2xl bg-surface3 p-3">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink3">{title}</div>
        <div className="text-[11px] text-ink3">{sub}</div>
        <div className="mt-1.5 text-[17px] font-bold text-brand">{fmtEnergy(m.kcal, unit === 'both' ? 'kcal' : unit)}</div>
        <div className="mt-0.5 text-[12px] text-ink2">{m.protein}g P · {m.carbs}g C · {m.fat}g F</div>
      </div>
    )

    return (
      <div>
        <div className="flex items-start gap-2">
          <Barcode size={20} className="mt-0.5 shrink-0 text-ink3" />
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold leading-tight text-ink">{product.name}</h3>
            <p className="mt-0.5 text-[12.5px] text-ink3">
              {product.brand ? `${product.brand} · ` : ''}{product.barcode}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.cached && <Badge tone="blue">Saved on this phone</Badge>}
          {(() => { const c = matchConfidence(product); return <span title={c.why}><Badge tone={c.level === 'high' ? 'green' : c.level === 'medium' ? 'amber' : 'red'}>{c.level === 'high' ? '✓ Good match' : c.level === 'medium' ? 'Check numbers' : '⚠ Check the label'}</Badge></span> })()}
          {product.energyFromKj && <Badge tone="gray">Converted from kJ</Badge>}
          {flagged && <Badge tone="red">{primaryTagLabel({ dietTags: product.dietTags }) ?? 'Flagged'} — not halal</Badge>}
          {!flagged && caution && <Badge tone="amber">Check the label</Badge>}
        </div>

        {(() => { const c = matchConfidence(product); return c.level !== 'high' ? (
          <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-ink2">{c.why}</p>
        ) : null })()}

        {flagged && (
          <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] text-ink2">
            The ingredients look like they include something you avoid. You can still log it —
            it's your call, not the app's.
          </p>
        )}
        {!flagged && caution && (
          <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-ink2">{caution}</p>
        )}

        <div className="mt-3 flex gap-2">
          {column('Per 100g', 'as listed', product.per100)}
          {perServe
            ? column('Per serve', product.servingName ?? `${serveG}g`, perServe)
            : (
              <div className="flex-1 rounded-2xl border border-dashed border-line p-3 text-[12px] text-ink3">
                No serving size on this product — use grams.
              </div>
            )}
        </div>

        {perServe && (
          <Segmented
            className="mt-3"
            options={[
              { value: 'serve', label: `1 serve (${serveG}g)` },
              { value: 'per100', label: 'Grams' },
            ]}
            value={basis}
            onChange={(v) => {
              setBasis(v)
              setGramsStr(v === 'serve' && serveG ? String(serveG) : '100')
            }}
          />
        )}

        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1">
            <div className="mb-1.5 text-[13px] font-medium text-ink2">How much did you have?</div>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={gramsStr}
                onChange={(e) => { setGramsStr(e.target.value); setBasis('per100') }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-ink3">g</span>
            </div>
          </label>
        </div>
        {serveG && (
          <div className="mt-2 flex gap-2">
            {[0.5, 1, 1.5, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setGramsStr(String(Math.round(serveG * n))); setBasis('serve') }}
                className="pressable flex-1 rounded-lg bg-surface3 px-2 py-2 text-[13px] font-semibold text-ink2"
              >
                {n} serve{n === 1 ? '' : 's'}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-xl bg-surface3 px-3 py-2.5 text-center">
          <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink3">{chosen.grams}g works out to</div>
          <div className="big-num mt-0.5 text-[22px] font-bold text-brand">{fmtEnergy(chosen.kcal, unit)}</div>
          <div className="text-[12.5px] text-ink2">{chosen.protein}g P · {chosen.carbs}g C · {chosen.fat}g F</div>
        </div>

        <Button full className="mt-4" disabled={grams <= 0} onClick={useProduct}>
          Use this
        </Button>
        <div className="mt-2 flex gap-2">
          <Button full variant="secondary" small onClick={() => { setProduct(null); setStage('start') }}>
            Scan another
          </Button>
          <Button
            full
            variant="secondary"
            small
            onClick={() => { void doLookup(product.barcode, true) }}
          >
            <RefreshCw size={14} /> Refresh data
          </Button>
        </div>
      </div>
    )
  }

  // ---------- live scanning ----------
  if (stage === 'live') {
    return (
      <div>
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-brand/80" />
        </div>
        <p className="mt-3 text-center text-[13px] text-ink2">
          Hold the barcode inside the box. It scans on its own.
        </p>
        <Button full variant="secondary" className="mt-3" onClick={() => { stopLive(); setStage('start') }}>
          Stop scanning
        </Button>
      </div>
    )
  }

  // ---------- start / looking ----------
  return (
    <div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { void scanFromPhoto(e.target.files?.[0]); e.target.value = '' }}
      />

      {stage === 'looking' ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Spinner />
          <p className="text-[13px] text-ink2">Looking that up…</p>
          <p className="text-[11.5px] text-ink3">Checks this phone first, then Open Food Facts.</p>
        </div>
      ) : (
        <>
          {canScanLive ? (
            <Button full onClick={() => { void beginLive() }}>
              <ScanLine size={17} /> Scan with the camera
            </Button>
          ) : (
            <div className="rounded-2xl border border-line bg-surface3 p-3.5">
              <div className="flex items-start gap-2">
                <Keyboard size={17} className="mt-0.5 shrink-0 text-ink3" />
                <p className="text-[12.5px] leading-relaxed text-ink2">{NO_DETECTOR_NOTE}</p>
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className="mb-1.5 text-[13px] font-medium text-ink2">Or type the number under the barcode</div>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                placeholder="e.g. 9300675024235" aria-label="9300675024235"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
              <Button
                disabled={!isPlausibleBarcode(manual)}
                onClick={() => { void doLookup(manual) }}
              >
                <Search size={17} />
              </Button>
            </div>
          </div>

          <Button full variant={canScanLive ? 'secondary' : 'primary'} className="mt-3" onClick={() => photoRef.current?.click()}>
            <Camera size={16} /> Take a photo of the barcode
          </Button>
          <p className="mt-1.5 text-center text-[11.5px] text-ink3">
            The barcode is read on your phone, then the calories and macros fill in automatically.
          </p>

          {problem && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <div className="flex items-start gap-2">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{problem.headline}</p>
                  {problem.detail && <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{problem.detail}</p>}
                </div>
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink3">
                Scanned before — these work offline
              </div>
              <div className="space-y-1.5">
                {recent.map((p) => (
                  <button
                    key={p.barcode}
                    type="button"
                    onClick={() => showProduct(p)}
                    className="pressable flex w-full items-center gap-2 rounded-xl bg-surface3 px-3 py-2.5 text-left"
                  >
                    <Barcode size={16} className="shrink-0 text-ink3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{p.name}</span>
                      <span className="block truncate text-[12px] text-ink3">
                        {p.brand ? `${p.brand} · ` : ''}{fmtEnergy(p.per100.kcal, unit === 'both' ? 'kcal' : unit)} / 100g
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
