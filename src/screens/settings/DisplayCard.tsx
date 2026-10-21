// DISPLAY — app text size. Scales the whole app rather than one screen, and
// takes effect the moment it's tapped so the preview is the real thing.

import { Type } from 'lucide-react'
import {
  Callout, Card, FOCUS_RING, FONT_SCALES, FONT_SCALE_LABELS, useAppPrefs,
} from '@/components/ui'

export function DisplayCard() {
  const scale = useAppPrefs((s) => s.prefs.fontScale)
  const setFontScale = useAppPrefs((s) => s.setFontScale)

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-1.5">
          <Type size={15} className="text-brand" aria-hidden="true" />
          <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-ink2">App text size</h3>
        </div>

        <div
          className="mt-3 grid grid-cols-5 gap-1.5"
          role="radiogroup"
          aria-label="App text size"
        >
          {FONT_SCALES.map((s) => {
            const active = Math.abs(scale - s) < 0.001
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${FONT_SCALE_LABELS[String(s)]} text size`}
                onClick={() => void setFontScale(s)}
                className={`pressable ${FOCUS_RING} flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 ${
                  active ? 'border-brand bg-brand/10' : 'border-transparent bg-surface3'
                }`}
              >
                <span
                  className="font-bold leading-none text-ink"
                  style={{ fontSize: `${11 * s + 4}px` }}
                  aria-hidden="true"
                >
                  A
                </span>
                <span className="text-[9.5px] font-semibold leading-tight text-ink3">
                  {FONT_SCALE_LABELS[String(s)]}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink2">
          Currently <span className="font-semibold text-ink">{FONT_SCALE_LABELS[String(scale)] ?? `${Math.round(scale * 100)}%`}</span>.
          The change applies to every screen straight away and is remembered on this device.
        </p>
      </Card>

      <Callout className="mt-3" tone="neutral">
        If you have text size or reduce-motion set at the system level, Ironverse
        respects those too — animations are skipped automatically when your phone
        asks for reduced motion.
      </Callout>
    </>
  )
}
