// Connected devices → "Your devices" (v10, 23 Oct 2026). Every wearable and
// scale that saves to Apple Health works with Ironverse once Health is
// connected — these are the exact switches to flip in each maker's app.
// Honest about the ones that can't (Fitbit, Galaxy Watch).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown } from 'lucide-react'
import { Badge, Button, Card, Section } from '@/components/ui'
import { watchStatus } from '@/native/watch'

interface Guide { name: string; emoji: string; gets: string; steps: string[]; works: 'yes' | 'workaround' | 'no' }

export const DEVICE_GUIDES: Guide[] = [
  { name: 'WHOOP', emoji: '⌚', works: 'yes', gets: 'Sleep, HRV, resting heart rate and workouts → Sleep & recovery score, Cardio',
    steps: ['Open the WHOOP app → More (or your profile) → App Settings → Integrations.', 'Tap Apple Health and turn it on. Allow sleep, heart rate variability, resting heart rate and workouts.', 'Come back here and tap Sync now.'] },
  { name: 'Oura Ring', emoji: '💍', works: 'yes', gets: 'Sleep, HRV, resting heart rate, steps and workouts',
    steps: ['Oura app → tap your profile (top right) → Settings → Apple Health.', 'Tap Connect and allow everything Oura asks to write.', 'Sync here.'] },
  { name: 'Garmin', emoji: '🧭', works: 'yes', gets: 'Steps, workouts (runs, rides, strength), sleep, resting heart rate and weight (Index scale)',
    steps: ['Garmin Connect app → More (☰) → Settings → Connected Apps → Apple Health.', 'Turn on every category you want shared.', 'Sync here.'] },
  { name: 'Polar', emoji: '❤️', works: 'yes', gets: 'Workouts with heart rate, sleep, steps',
    steps: ['Polar Flow app → More → Settings → General settings → Apple Health.', 'Turn it on and allow the categories.', 'Sync here. (Polar H10 / Verity Sense straps also work via an Apple Watch workout.)'] },
  { name: 'Withings (scales, watches, sleep mat)', emoji: '⚖️', works: 'yes', gets: 'Weight → weigh-ins, steps, sleep',
    steps: ['Withings app → Profile → Apple Health (Health app integration).', 'Turn on Weight (and Sleep / Steps if you have them).', 'Sync here — scale readings become weigh-ins automatically.'] },
  { name: 'Renpho / Eufy / Fitdays scales', emoji: '⚖️', works: 'yes', gets: 'Weight (and body fat in the Health app) → weigh-ins',
    steps: ['Open your scale’s app → Me / Settings → Apple Health (or “Third-party apps”).', 'Turn on Weight.', 'Sync here.'] },
  { name: 'Strava', emoji: '🚴', works: 'yes', gets: 'Runs, rides and walks recorded in Strava',
    steps: ['Strava app → You → Settings (⚙) → Applications, Services and Devices → Health.', 'Connect and allow workouts.', 'Sync here.'] },
  { name: 'COROS / Suunto / Amazfit (Zepp)', emoji: '🏃', works: 'yes', gets: 'Workouts, steps, sleep (varies by brand)',
    steps: ['In the brand’s app look for Settings → Third-party apps (or Connected apps) → Apple Health.', 'Turn it on.', 'Sync here.'] },
  { name: 'Bluetooth heart-rate straps', emoji: '🫀', works: 'yes', gets: 'Heart rate during workouts',
    steps: ['Pair the strap to your Apple Watch (Settings → Bluetooth on the Watch), or record with the strap’s own app.', 'Heart rate saves to Apple Health with the workout.', 'Ironverse reads it from Health.'] },
  { name: 'Fitbit', emoji: '📟', works: 'workaround', gets: 'Steps, sleep, weight — only through a bridge app',
    steps: ['Fitbit does not write to Apple Health itself.', 'A paid bridge app from the App Store (search “Fitbit to Apple Health”) can copy the data across.', 'Once it’s in Apple Health, Ironverse picks it up.'] },
  { name: 'Samsung Galaxy Watch', emoji: '🚫', works: 'no', gets: 'Not available on iPhone',
    steps: ['Samsung Galaxy Watches only pair with Android phones, so they can’t share with any iPhone app.'] },
]

export function DeviceGuides() {
  const [open, setOpen] = useState<string | null>(null)
  const watch = useLiveQuery(() => watchStatus(), [])
  return (
    <>
      <Section title="Apple Watch app">
        <Card className="p-4 text-[13px]">
          <div className="flex items-start gap-2">
            <span className="text-[22px]">⌚</span>
            <div className="flex-1">
              <b className="text-[15px]">Ironverse on your wrist</b>
              <div className="text-ink2">Calories, protein, water and recovery at a glance; log sets with a tap and get a wrist tap when rest is over; add water and creatine.</div>
            </div>
            <Badge tone={watch?.installed ? 'green' : 'brand'}>{watch?.installed ? (watch.reachable ? 'Connected' : 'Installed') : watch?.paired ? 'Not installed' : 'No Watch'}</Badge>
          </div>
          {watch && !watch.installed && (
            <div className="mt-2 rounded-xl bg-surface3 px-3 py-2 text-[12.5px] text-ink2">
              {watch.paired ? 'Open the Watch app on your iPhone → scroll to Available Apps → tap Install next to Ironverse.' : 'Pair an Apple Watch with this iPhone, then install Ironverse from the Watch app.'}
            </div>
          )}
        </Card>
      </Section>
      <Section title="Your devices">
        <p className="mb-2 px-1 text-[12px] text-ink3">Almost every wearable, ring and smart scale saves to Apple Health — connect Apple Health above once, then flip the switch in your device’s app.</p>
        <div className="space-y-2">
          {DEVICE_GUIDES.map((g) => (
            <Card key={g.name} className="p-0">
              <button type="button" onClick={() => setOpen(open === g.name ? null : g.name)} className="pressable flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
                <span className="text-[20px]">{g.emoji}</span>
                <span className="min-w-0 flex-1"><b className="block text-[14px]">{g.name}</b><span className="block truncate text-[12px] text-ink3">{g.gets}</span></span>
                <Badge tone={g.works === 'yes' ? 'green' : g.works === 'workaround' ? 'brand' : 'gray'}>{g.works === 'yes' ? 'Works' : g.works === 'workaround' ? 'Via bridge' : 'Not on iPhone'}</Badge>
                <ChevronDown size={16} className={`text-ink3 transition-transform ${open === g.name ? 'rotate-180' : ''}`} />
              </button>
              {open === g.name && (
                <ol className="list-decimal space-y-1 px-8 pb-3 text-[12.5px] text-ink2">
                  {g.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              )}
            </Card>
          ))}
        </div>
        <Button full variant="secondary" className="mt-3" onClick={() => { window.location.href = 'x-apple-health://' }}>Open the Health app</Button>
      </Section>
    </>
  )
}
