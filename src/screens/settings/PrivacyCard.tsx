// Settings → Privacy (v10, App Store build): Face ID / Touch ID app lock.
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Toggle } from '@/components/ui'
import { getSetting, setSetting } from '@/db'
import { useUI } from '@/lib/store'
import { EXTRA_KEYS, biometricAvailable, verifyOwner } from '@/native/extras'

export function PrivacyCard() {
  const { toast } = useUI()
  const on = useLiveQuery(() => getSetting<boolean>(EXTRA_KEYS.faceId, false), [])
  const bio = useLiveQuery(() => biometricAvailable(), [])
  const kind = bio?.kind ?? 'Face ID'
  async function flip(next: boolean) {
    // confirm it is really you before turning the lock on or off
    if (!(await verifyOwner(next ? `Turn on ${kind} lock` : `Turn off ${kind} lock`))) { toast(`${kind} didn’t confirm — nothing changed`, 'error'); return }
    await setSetting(EXTRA_KEYS.faceId, next)
    toast(next ? `${kind} lock on` : `${kind} lock off`)
  }
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-ink">Lock with {kind}</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">
            Ask for {kind} when Ironverse opens, and after it has been in the background for more than a minute — keeps your weight, food and progress photos private.
            {bio && !bio.ok && ' Not set up on this iPhone yet (Settings → Face ID & Passcode).'}
          </p>
        </div>
        <Toggle checked={!!on} label={`Lock with ${kind}`} onChange={(v) => void flip(v)} />
      </div>
    </Card>
  )
}
