// HAPTICS & SOUND — opt in per category. Everything starts off except a light
// tap when a set is ticked off, which is the one piece of feedback you want
// when your eyes are on the bar and not the phone.
//
// Degrades silently: a device with no vibration motor just shows a plain note
// and the haptic toggles stay hidden rather than lying about what they do.

import { Smartphone, Volume2 } from 'lucide-react'
import {
  Callout, Card, FEEDBACK_CATEGORY_LABELS, Toggle, canVibrate, useAppPrefs,
  type FeedbackCategory,
} from '@/components/ui'

const ORDER: FeedbackCategory[] = ['set', 'button', 'timer', 'pr']

export function FeedbackCard() {
  const prefs = useAppPrefs((s) => s.prefs)
  const setHaptic = useAppPrefs((s) => s.setHaptic)
  const setSound = useAppPrefs((s) => s.setSound)
  const vibration = canVibrate()

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-1.5">
          <Smartphone size={15} className="text-brand" aria-hidden="true" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Vibration</h3>
        </div>

        {!vibration ? (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink2">
            This device does not expose a vibration motor to the browser, so haptics
            are unavailable here. Nothing is broken — the app simply stays quiet.
            Sound below still works.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {ORDER.map((c) => {
              const meta = FEEDBACK_CATEGORY_LABELS[c]
              return (
                <li key={c} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink">{meta.label}</div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink3">{meta.hint}</p>
                  </div>
                  <Toggle
                    checked={prefs.haptics[c]}
                    label={`Vibrate on ${meta.label.toLowerCase()}`}
                    onChange={(on) => void setHaptic(c, on)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-center gap-1.5">
          <Volume2 size={15} className="text-brand" aria-hidden="true" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">Sound</h3>
        </div>
        <ul className="mt-3 space-y-3">
          {ORDER.map((c) => {
            const meta = FEEDBACK_CATEGORY_LABELS[c]
            return (
              <li key={c} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-ink">{meta.label}</div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink3">{meta.hint}</p>
                </div>
                <Toggle
                  checked={prefs.sound[c]}
                  label={`Play a tone on ${meta.label.toLowerCase()}`}
                  onChange={(on) => void setSound(c, on)}
                />
              </li>
            )
          })}
        </ul>
      </Card>

      <Callout className="mt-3" tone="neutral">
        Turning one on plays it once, so you can hear or feel it before committing.
        Your phone’s silent switch and system volume still win over anything here.
      </Callout>
    </>
  )
}
