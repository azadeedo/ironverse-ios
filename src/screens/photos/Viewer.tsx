// Full-size viewer for one photo, with its date, weight and note.
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import type { ProgressPhoto } from '@/db/types'
import { Button, IconButton } from '@/components/ui'
import { dayjs } from '@/lib/fmt'
import { poseLabel, useBlobUrl } from './helpers'

export default function Viewer({ photo, onClose, onDelete }: {
  photo: ProgressPhoto | null
  onClose: () => void
  onDelete: (p: ProgressPhoto) => void
}) {
  const url = useBlobUrl(photo?.blob ?? null)
  if (!photo) return null

  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-3" style={{ paddingTop: 'calc(var(--sat) + 10px)' }}>
        <IconButton label="Close" onClick={onClose} className="bg-white/12 text-white">
          <X size={19} />
        </IconButton>
        <div className="text-center text-white">
          <div className="text-[15px] font-semibold">{dayjs(photo.date).format('ddd D MMM YYYY')}</div>
          <div className="text-[12px] text-white/65">
            {poseLabel(photo.pose)}{photo.weightKg ? ` · ${photo.weightKg.toFixed(1)} kg` : ''}
          </div>
        </div>
        <IconButton label="Delete photo" onClick={() => onDelete(photo)} className="bg-white/12 text-red-400">
          <Trash2 size={18} />
        </IconButton>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-3">
        {url ? (
          <img src={url} alt={`${poseLabel(photo.pose)} on ${photo.date}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-[13px] text-white/60">Loading…</div>
        )}
      </div>

      {photo.note && (
        <p className="px-5 pb-2 text-center text-[13px] text-white/75">{photo.note}</p>
      )}
      <div className="px-4" style={{ paddingBottom: 'calc(var(--sab) + 16px)' }}>
        <Button variant="secondary" full onClick={onClose}>Done</Button>
      </div>
    </div>,
    document.body,
  )
}
