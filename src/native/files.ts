// Saving files out of the iOS app. Inside the native shell `<a download>` does
// nothing, so a backup / CSV / share card is written to the app's cache folder
// and handed to the iOS share sheet ("Save to Files", AirDrop, Mail …).
// The file never leaves the phone unless the user picks a destination.

import { isNativeApp } from '@/lib/edition'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error)
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.readAsDataURL(blob)
  })
}

/** true when the share sheet was shown (or the user cancelled it) */
export async function nativeShareBlob(blob: Blob, filename: string, title?: string): Promise<boolean> {
  if (!isNativeApp()) return false
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const safe = filename.replace(/[^\w.\- ]+/g, '_')
  const written = await Filesystem.writeFile({ path: safe, data: await blobToBase64(blob), directory: Directory.Cache })
  try {
    await Share.share({ title: title ?? safe, files: [written.uri], dialogTitle: title ?? 'Save Ironverse file' })
  } catch (e) {
    // dismissing the sheet rejects with "Share canceled" — that is not an error
    if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e
  }
  return true
}
