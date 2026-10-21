// ============================================================
// Client-side image compression for the capture flows.
// Phones produce 4-12MB HEIC/JPEG files; we never want to send that to an
// API (slow, expensive) or store it in IndexedDB. Longest edge ~1600px,
// JPEG ~0.7 — plenty for "is that chicken or fish" and small enough to keep
// in the food log forever.
// ============================================================

export const MAX_EDGE = 1600
export const JPEG_QUALITY = 0.7

interface Decoded {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  close: () => void
}

async function decode(blob: Blob): Promise<Decoded> {
  // createImageBitmap is the fast path and handles EXIF orientation on iOS 15+.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        close: () => bmp.close(),
      }
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That image could not be read. Try taking it again.'))
      el.src = url
    })
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/** Scale down to `maxEdge` on the longest side and re-encode as JPEG. */
export async function compressImage(
  input: Blob,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  const src = await decode(input)
  try {
    const scale = Math.min(1, maxEdge / Math.max(src.width, src.height))
    const w = Math.max(1, Math.round(src.width * scale))
    const h = Math.max(1, Math.round(src.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser blocked image processing.')
    src.draw(ctx, w, h)
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    )
    if (!out) throw new Error('Could not compress that photo.')
    return out
  } finally {
    src.close()
  }
}

/** Human-readable size for the "sending X" line. */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
