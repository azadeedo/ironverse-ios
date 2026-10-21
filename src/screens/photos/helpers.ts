// Shared bits for the progress photo module.
import { useEffect, useRef, useState } from 'react'
import type { PhotoPose, ProgressPhoto } from '@/db/types'

export const POSES: { value: PhotoPose; label: string; group: 'Relaxed' | 'Flexed' | 'Close-up' }[] = [
  { value: 'front', label: 'Front', group: 'Relaxed' },
  { value: 'side', label: 'Side (left)', group: 'Relaxed' },
  { value: 'side-right', label: 'Side (right)', group: 'Relaxed' },
  { value: 'back', label: 'Back', group: 'Relaxed' },
  { value: 'front-flex', label: 'Front flexed', group: 'Flexed' },
  { value: 'back-flex', label: 'Back flexed', group: 'Flexed' },
  { value: 'arms', label: 'Arms', group: 'Close-up' },
  { value: 'abs', label: 'Abs / waist', group: 'Close-up' },
  { value: 'legs', label: 'Legs', group: 'Close-up' },
  { value: 'other', label: 'Other', group: 'Close-up' },
]
/** the poses that make up a standard check-in */
export const CHECKIN_POSES: PhotoPose[] = ['front', 'side', 'back']
export const PHOTO_TAGS = ['Morning', 'Fasted', 'After workout', 'Pump', 'Same spot & light', 'Evening']
export function photoAt(list: ProgressPhoto[], pose: PhotoPose, daysAgo: number, today: string): ProgressPhoto | null {
  const target = new Date(today).getTime() - daysAgo * 864e5
  const same = list.filter((p) => p.pose === pose)
  if (!same.length) return null
  return same.reduce((best, p) => (Math.abs(new Date(p.date).getTime() - target) < Math.abs(new Date(best.date).getTime() - target) ? p : best))
}

export const poseLabel = (p: PhotoPose): string =>
  POSES.find((x) => x.value === p)?.label ?? 'Other'

/** Longest edge / JPEG quality used for stored photos. */
export const PHOTO_MAX_EDGE = 1600
export const PHOTO_QUALITY = 0.7

/**
 * Object URLs for a list of photos, revoked when the list changes or the
 * component unmounts. Keyed off the ids so a live-query re-render that returns
 * the same photos doesn't churn the URLs.
 */
export function usePhotoUrls(photos: ProgressPhoto[] | undefined): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = (photos ?? []).map((p) => p.id).join(',')
  const latest = useRef(photos)
  latest.current = photos

  useEffect(() => {
    const list = latest.current ?? []
    const map: Record<string, string> = {}
    for (const p of list) {
      try {
        map[p.id] = URL.createObjectURL(p.blob)
      } catch {
        /* a corrupt blob shouldn't take the gallery down */
      }
    }
    setUrls(map)
    return () => {
      for (const u of Object.values(map)) URL.revokeObjectURL(u)
      setUrls({})
    }
  }, [key])

  return urls
}

/** One object URL for a single blob, revoked on change/unmount. */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => {
      URL.revokeObjectURL(u)
      setUrl(null)
    }
  }, [blob])
  return url
}

export interface PhotoGroup {
  date: string
  photos: ProgressPhoto[]
}

/** Newest date first; poses inside a day keep front → side → back → other order. */
export function groupByDate(photos: ProgressPhoto[]): PhotoGroup[] {
  const order = new Map(POSES.map((p, i) => [p.value, i]))
  const map = new Map<string, ProgressPhoto[]>()
  for (const p of photos) {
    const list = map.get(p.date) ?? []
    list.push(p)
    map.set(p.date, list)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({
      date,
      photos: list.sort((a, b) => (order.get(a.pose) ?? 9) - (order.get(b.pose) ?? 9)),
    }))
}

/** Earliest and latest photo of whichever pose has the widest spread. */
export function defaultComparePair(photos: ProgressPhoto[]): { a: ProgressPhoto; b: ProgressPhoto } | null {
  let best: { a: ProgressPhoto; b: ProgressPhoto; span: number } | null = null
  for (const pose of POSES) {
    const list = photos
      .filter((p) => p.pose === pose.value)
      .sort((x, y) => x.date.localeCompare(y.date))
    if (list.length < 2) continue
    const a = list[0]
    const b = list[list.length - 1]
    const span = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (!best || span > best.span) best = { a, b, span }
  }
  if (best) return { a: best.a, b: best.b }
  const all = [...photos].sort((x, y) => x.date.localeCompare(y.date))
  return all.length >= 2 ? { a: all[0], b: all[all.length - 1] } : null
}

export function photoCaption(p: ProgressPhoto): string {
  return p.weightKg ? `${p.weightKg.toFixed(1)} kg` : ''
}
