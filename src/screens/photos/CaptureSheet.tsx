// Capture or pick a progress photo, compress it on-device, store the Blob.
// The file never leaves the phone — there is no upload path in this flow.
import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Lock, RefreshCw } from 'lucide-react'
import { db, getSetting, setSetting } from '@/db'
import type { PhotoPose, ProgressPhoto } from '@/db/types'
import { Button, Field, Input, Sheet, Spinner, TextArea } from '@/components/ui'
import { compressImage, fmtBytes } from '@/screens/food/capture/compress'
import { newId, nowIso, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import { PHOTO_TAGS, POSES, useBlobUrl } from './helpers'

export default function CaptureSheet({ open, onClose, prefillWeightKg, defaultPose }: {
  open: boolean
  onClose: () => void
  prefillWeightKg: number | null
  defaultPose?: PhotoPose
}) {
  const { toast } = useUI()
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [pose, setPose] = useState<PhotoPose>(defaultPose ?? 'front')
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const url = useBlobUrl(blob)

  useEffect(() => {
    if (!open) return
    setBlob(null)
    setBusy(false)
    setSaving(false)
    setPose(defaultPose ?? 'front')
    setDate(todayStr())
    setWeight(prefillWeightKg !== null ? String(prefillWeightKg) : '')
    setNote('')
    void getSetting<string[]>('photos:lastTags', []).then(setTags)
  }, [open, prefillWeightKg, defaultPose])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const out = await compressImage(file)
      setBlob(out)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That photo could not be read', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!blob) {
      toast('Take or pick a photo first', 'error')
      return
    }
    const w = weight.trim() ? Math.round(parseFloat(weight) * 10) / 10 : undefined
    if (w !== undefined && (!isFinite(w) || w < 30 || w > 300)) {
      toast('Enter a weight between 30 and 300 kg', 'error')
      return
    }
    setSaving(true)
    try {
      const row: ProgressPhoto = {
        id: newId(),
        date,
        pose,
        blob,
        weightKg: w,
        note: note.trim() || undefined,
        createdAt: nowIso(),
        tags: tags.length ? tags : undefined,
      }
      await db.progressPhotos.add(row)
      await setSetting('photos:lastTags', tags)
      toast('Photo saved to this phone')
      onClose()
    } catch {
      toast('Could not save that photo — storage may be full', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a progress photo" tall>
      {/* hidden pickers — capture="environment" makes iOS open the camera */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = '' }}
      />

      <div className="flex items-start gap-2 rounded-xl bg-surface3/60 px-3 py-2.5 text-[12.5px] text-ink2">
        <Lock size={15} className="mt-0.5 shrink-0 text-ink3" />
        <span>Photos are stored on this phone only. Nothing is uploaded anywhere, ever.</span>
      </div>

      {busy ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-10">
          <Spinner />
          <div className="text-[13px] text-ink2">Shrinking the photo…</div>
        </div>
      ) : url ? (
        <div className="mt-3">
          <div className="overflow-hidden rounded-2xl bg-black">
            <img src={url} alt="New progress photo" className="mx-auto max-h-[46svh] w-auto object-contain" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11.5px] text-ink3">{blob ? fmtBytes(blob.size) : ''} · stored on this device</span>
            <Button small variant="ghost" onClick={() => cameraRef.current?.click()}>
              <RefreshCw size={14} /> Retake
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button className="min-h-[112px] flex-col" onClick={() => cameraRef.current?.click()}>
            <Camera size={26} strokeWidth={1.7} />
            <span>Take photo</span>
          </Button>
          <Button variant="secondary" className="min-h-[112px] flex-col" onClick={() => libraryRef.current?.click()}>
            <ImagePlus size={26} strokeWidth={1.7} />
            <span>Choose photo</span>
          </Button>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 text-[13px] font-medium text-ink2">Pose</div>
        <div className="flex flex-wrap gap-1.5">
          {POSES.map((p) => (
            <button key={p.value} type="button" onClick={() => setPose(p.value)} className={`pressable rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${pose === p.value ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}>{p.label}</button>
          ))}
        </div>
        <div className="mb-1.5 mt-3 text-[13px] font-medium text-ink2">Conditions (remembered for next time)</div>
        <div className="flex flex-wrap gap-1.5">
          {PHOTO_TAGS.map((t) => (
            <button key={t} type="button" onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))} className={`pressable rounded-full px-3 py-1 text-[12px] ${tags.includes(t) ? 'bg-brand/20 text-brand ring-1 ring-brand' : 'bg-surface3 text-ink3'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
        </Field>
        <Field label="Weight (kg)" hint={prefillWeightKg !== null ? 'From your latest weigh-in' : 'Optional'}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={30}
            max={300}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="optional"
          />
        </Field>
      </div>

      <Field label="Note" className="mt-3" hint="Lighting, time of day, pump — whatever makes it comparable later.">
        <TextArea value={note} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>

      <Button full className="mt-4" disabled={!blob || saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save photo'}
      </Button>
    </Sheet>
  )
}
