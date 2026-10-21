// ============================================================
// Camera → compress → AI estimate → editable draft.
//
// The camera input is a plain <input type="file" accept="image/*"
// capture="environment"> because that is the one thing iOS Safari honours
// reliably: it opens the rear camera straight away, no permissions dance.
// The photo is shrunk on-device before it ever leaves the phone.
// Nothing is logged until he taps Confirm.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, ImageIcon, Key, Pencil, RefreshCw } from 'lucide-react'
import { Button, Spinner, TextArea } from '@/components/ui'
import type { EnergyUnit } from '@/db/types'
import {
  COST_NOTE, NO_KEY_DETAIL, NO_KEY_HEADLINE, VisionError, estimateMealFromPhoto, hasAiKey,
} from '@/lib/vision'
import { compressImage, fmtBytes } from './compress'
import { DraftEditor } from './DraftEditor'
import { AiKeyCard } from '@/screens/settings/AiKeyCard'
import { HAND_PORTIONS, handEstimate, type HandCounts } from '@/lib/handPortions'
import type { DraftItem } from './types'

type Stage = 'pick' | 'ready' | 'working' | 'draft'

interface Problem {
  headline: string
  detail?: string
  /** true when retrying the same photo can't help */
  needsKey?: boolean
}

export function PhotoFlow({ halal, unit, confirmLabel, busy, onConfirm }: {
  halal: boolean
  unit: EnergyUnit
  confirmLabel: string
  busy?: boolean
  onConfirm: (items: DraftItem[], photo?: Blob) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('pick')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [hint, setHint] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [seedKey, setSeedKey] = useState('start')
  const [keyReady, setKeyReady] = useState<boolean | null>(null)
  const [hands, setHands] = useState<HandCounts>({ palms: 0, cupped: 0, thumbs: 0, fists: 0 })
  const [showHands, setShowHands] = useState(false)

  useEffect(() => {
    let live = true
    void hasAiKey().then((v) => { if (live) setKeyReady(v) })
    return () => { live = false }
  }, [])

  // the object URL belongs to this component; always release it
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  const takePhoto = async (file: File | undefined) => {
    if (!file) return
    setProblem(null)
    try {
      const small = await compressImage(file)
      if (photoUrl) URL.revokeObjectURL(photoUrl)
      setPhoto(small)
      setPhotoUrl(URL.createObjectURL(small))
      setStage('ready')
    } catch (err) {
      setProblem({
        headline: err instanceof Error ? err.message : 'That photo could not be read.',
        detail: 'Take it again, or add the meal by hand.',
      })
    }
  }

  const runEstimate = async () => {
    if (!photo) return
    setStage('working')
    setProblem(null)
    try {
      const result = await estimateMealFromPhoto(photo, { hint })
      setItems(result.map((r) => ({ ...r })))
      setSeedKey(`photo-${Date.now()}`)
      setStage('draft')
    } catch (err) {
      const ve = err instanceof VisionError ? err : null
      setProblem({
        headline: ve?.message ?? 'The estimate failed.',
        detail: ve?.detail,
        needsKey: ve?.kind === 'no-key',
      })
      setStage('ready')
    }
  }

  const useHands = () => {
    const rows = handEstimate(hands)
    if (!rows.length) return
    setItems(rows)
    setSeedKey(`hands-${Date.now()}`)
    setStage('draft')
  }

  const startByHand = () => {
    setItems([{ name: '', grams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0 }])
    setSeedKey(`hand-${Date.now()}`)
    setStage('draft')
  }

  // ---------- draft ----------
  if (stage === 'draft') {
    return (
      <div>
        {photoUrl && (
          <img
            src={photoUrl}
            alt="The meal you photographed"
            className="mb-3 h-40 w-full rounded-2xl object-cover"
          />
        )}
        <DraftEditor
          seedItems={items}
          seedKey={seedKey}
          halal={halal}
          unit={unit}
          confirmLabel={confirmLabel}
          busy={busy}
          note={photo
            ? 'Portions from a photo are the hardest part to get right — drag the grams until it looks like what you actually ate.'
            : 'Typed in by hand. Enter the numbers you know and leave the rest.'}
          onConfirm={(list) => onConfirm(list, photo ?? undefined)}
          footer={
            <button
              type="button"
              onClick={() => { setStage(photo ? 'ready' : 'pick') }}
              className="pressable mt-2 w-full py-2 text-center text-[13px] font-semibold text-ink3"
            >
              Start over
            </button>
          }
        />
      </div>
    )
  }

  // ---------- capture / estimate ----------
  return (
    <div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { void takePhoto(e.target.files?.[0]); e.target.value = '' }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void takePhoto(e.target.files?.[0]); e.target.value = '' }}
      />

      {photoUrl ? (
        <img src={photoUrl} alt="The meal you photographed" className="h-52 w-full rounded-2xl object-cover" />
      ) : (
        <div className="flex h-52 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface3 text-ink3">
          <Camera size={30} />
          <p className="px-6 text-center text-[13px]">
            Get the whole plate in frame, straight on, in decent light.
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button full onClick={() => cameraRef.current?.click()} disabled={stage === 'working'}>
          <Camera size={17} /> {photo ? 'Retake' : 'Take photo'}
        </Button>
        <Button full variant="secondary" onClick={() => libraryRef.current?.click()} disabled={stage === 'working'}>
          <ImageIcon size={17} /> Library
        </Button>
      </div>

      {photo && (
        <p className="mt-2 text-center text-[11.5px] text-ink3">
          Shrunk to {fmtBytes(photo.size)} before it leaves your phone.
        </p>
      )}

      {stage === 'ready' && photo && (
        <div className="mt-4">
          <TextArea
            rows={2}
            placeholder="Anything it can't see? e.g. cooked in two tbsp olive oil, the rice bowl is a large"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </div>
      )}

      {problem && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="flex items-start gap-2">
            {problem.needsKey ? <Key size={17} className="mt-0.5 shrink-0 text-amber-500" />
              : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-500" />}
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{problem.headline}</p>
              {problem.detail && <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{problem.detail}</p>}
            </div>
          </div>
        </div>
      )}

      {keyReady === false && !problem && (
        <div className="mt-4 rounded-2xl border border-line bg-surface3 p-3.5">
          <div className="flex items-start gap-2">
            <Key size={17} className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{NO_KEY_HEADLINE}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{NO_KEY_DETAIL}</p>
            </div>
          </div>
        </div>
      )}

      {(keyReady === false || problem?.needsKey) && (
        <div className="mt-3">
          <AiKeyCard onChange={(has) => { setKeyReady(has); if (has) setProblem(null) }} />
        </div>
      )}

      {stage === 'working' ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-4">
          <Spinner />
          <p className="text-[13px] text-ink2">Reading the plate…</p>
          <p className="text-[11.5px] text-ink3">Nothing is logged until you confirm it.</p>
        </div>
      ) : (
        <Button
          full
          className="mt-4"
          disabled={!photo || keyReady === false}
          onClick={() => { void runEstimate() }}
        >
          {problem && !problem.needsKey ? <RefreshCw size={17} /> : null}
          {problem && !problem.needsKey ? 'Try the estimate again' : 'Estimate this meal'}
        </Button>
      )}

      <p className="mt-2 text-center text-[11.5px] text-ink3">{COST_NOTE}</p>

      <div className="mt-3 rounded-2xl border border-line bg-surface3/60 p-3">
        <button type="button" onClick={() => setShowHands((v) => !v)} className="pressable flex w-full items-center justify-between text-left">
          <span className="text-[14px] font-semibold text-ink">✋ Estimate with your hand — free, no key</span>
          <span className="text-[12px] text-ink3">{showHands ? 'Hide' : 'Open'}</span>
        </button>
        {showHands && (
          <div className="mt-2">
            <p className="text-[12px] leading-relaxed text-ink2">Look at the plate and count portions the size of your hand. A rough guide, not a weigh-in — you can edit every number before logging.</p>
            {([['palms', 'palm'], ['cupped', 'cupped'], ['thumbs', 'thumb'], ['fists', 'fist']] as const).map(([k, p]) => (
              <div key={k} className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink">{HAND_PORTIONS[p].label}</p>
                  <p className="text-[11.5px] text-ink3">{HAND_PORTIONS[p].hint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" aria-label={`Fewer ${k}`} className="pressable h-9 w-9 rounded-xl bg-surface3 text-[18px] text-ink" onClick={() => setHands((h) => ({ ...h, [k]: Math.max(0, h[k] - 0.5) }))}>−</button>
                  <span className="big-num w-8 text-center text-[16px] text-ink">{hands[k]}</span>
                  <button type="button" aria-label={`More ${k}`} className="pressable h-9 w-9 rounded-xl bg-surface3 text-[18px] text-ink" onClick={() => setHands((h) => ({ ...h, [k]: h[k] + 0.5 }))}>+</button>
                </div>
              </div>
            ))}
            <p className="mt-2 text-[12px] text-ink2">About {handEstimate(hands).reduce((n, r) => n + r.kcal, 0)} kcal · {Math.round(handEstimate(hands).reduce((n, r) => n + r.protein, 0))} g protein</p>
            <Button full small className="mt-2" disabled={!handEstimate(hands).length} onClick={useHands}>Use this estimate</Button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={startByHand}
        className="pressable mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-[13.5px] font-semibold text-brand"
      >
        <Pencil size={15} /> Add this meal by hand instead
      </button>
    </div>
  )
}
