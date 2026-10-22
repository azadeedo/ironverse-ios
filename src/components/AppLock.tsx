// Face ID / Touch ID app lock (v10). Covers the app on launch, and again when it
// comes back after more than a minute in the background — only if switched on in
// Settings → Privacy. Nothing is stored except the on/off switch.
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui'
import { lockEnabled, verifyOwner } from '@/native/extras'

export default function AppLock() {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    let hiddenAt = 0
    const unlock = async () => { if (await verifyOwner()) setLocked(false) }
    void lockEnabled().then((on) => { if (on) { setLocked(true); void unlock() } })
    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      if (hiddenAt && Date.now() - hiddenAt > 60_000) void lockEnabled().then((on) => { if (on) { setLocked(true); void unlock() } })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!locked) return null
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-surface px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand"><Lock size={30} /></div>
      <div className="shout text-[24px]">Ironverse is locked</div>
      <Button onClick={() => void verifyOwner().then((ok) => ok && setLocked(false))}>Unlock</Button>
    </div>
  )
}
