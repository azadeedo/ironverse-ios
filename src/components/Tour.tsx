// Interactive tutorial: walks through the REAL screens and spotlights the
// actual controls (it navigates, finds the element, and dims everything else).
// Read-only — it never taps anything or creates data. Started from first-time
// setup and replayable from Settings → "Replay the app tour".

import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { setSetting } from '@/db'
import { FIRST_RUN_KEYS } from '@/lib/firstRun'

interface TourStep {
  route: string
  title: string
  body: string
  /** tried in order; a {text} target matches a button/link whose text starts with it */
  targets: ({ css: string } | { text: RegExp })[]
}

export const TOUR_STEPS: TourStep[] = [
  { route: '/', title: 'Your dashboard', body: 'Today shows your workout, calories, water and reminders at a glance. Tap the tabs at the bottom to move around.', targets: [{ css: '[data-tour="tab-today"]' }] },
  { route: '/workout', title: 'Start a workout', body: 'Today’s session lives on the Workout tab. Tap Start and Ironverse walks you through each exercise with target weights and rest timers.', targets: [{ text: /^(Start|Resume)/ }, { css: '[data-tour="tab-workout"]' }] },
  { route: '/exercises', title: 'Choose exercises', body: 'Browse the full exercise library with demos, muscles worked and setup tips. Search by name, muscle or equipment, and swap any exercise in your plan.', targets: [{ css: 'input[type="search"], input[placeholder*="Search"]' }] },
  { route: '/workout', title: 'Log your sets', body: 'During a workout, enter the weight and reps for each set and tick it off. Everything saves instantly — even mid-session if you close the app.', targets: [{ text: /^(Start|Resume)/ }, { css: '[data-tour="tab-workout"]' }] },
  { route: '/food', title: 'Track calories', body: 'Tap + to log food — search the food list, scan a barcode or save your own meals. Calories and protein update against your daily target.', targets: [{ css: 'button[aria-label="Add food"]' }, { css: '[data-tour="tab-food"]' }] },
  { route: '/progress', title: 'See your progress', body: 'Weight trend, body measurements, strength and consistency charts — all built from what you log.', targets: [{ css: '[data-tour="tab-progress"]' }] },
  { route: '/prs', title: 'Personal records', body: 'New bests are detected automatically when you log a set — heaviest weight, most reps and estimated 1RM.', targets: [{ css: 'h1' }] },
  { route: '/settings', title: 'Settings', body: 'Change your profile, targets, equipment, reminders and units here. You can replay this tour from Settings any time.', targets: [{ css: '[data-tour="replay-tour"]' }, { css: 'h1' }] },
]

interface TourState { active: boolean; step: number; returnTo: string | null; start: (returnTo?: string) => void; go: (n: number) => void; stop: () => void }
export const useTour = create<TourState>((set) => ({
  active: false, step: 0, returnTo: null,
  start: (returnTo) => set({ active: true, step: 0, returnTo: returnTo ?? null }),
  go: (n) => set({ step: n }),
  stop: () => set({ active: false }),
}))

function findTarget(step: TourStep): HTMLElement | null {
  for (const t of step.targets) {
    if ('css' in t) {
      const el = [...document.querySelectorAll<HTMLElement>(t.css)].find((e) => e.offsetParent !== null || e.getClientRects().length > 0)
      if (el) return el
    } else {
      const el = [...document.querySelectorAll<HTMLElement>('button, a')].find((e) => t.text.test((e.textContent ?? '').trim()))
      if (el) return el
    }
  }
  return null
}

export function TourOverlay() {
  const { active, step, returnTo, go, stop } = useTour()
  const navigate = useNavigate()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cur = TOUR_STEPS[step]

  useEffect(() => {
    if (!active || !cur) return
    navigate(cur.route)
    setRect(null)
    let tries = 0
    let el: HTMLElement | null = null
    const t = window.setInterval(() => {
      el = findTarget(cur)
      if (el || ++tries > 25) {
        window.clearInterval(t)
        if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); window.setTimeout(() => setRect(el!.getBoundingClientRect()), 350) }
      }
    }, 80)
    const onResize = () => { if (el) setRect(el.getBoundingClientRect()) }
    window.addEventListener('resize', onResize)
    return () => { window.clearInterval(t); window.removeEventListener('resize', onResize) }
  }, [active, step]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => { if (!active) setRect(null) }, [active])

  if (!active || !cur) return null
  const last = step === TOUR_STEPS.length - 1
  const end = () => { stop(); void setSetting(FIRST_RUN_KEYS.tourDone, true); navigate(returnTo ?? '/') }
  const pad = 8
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null
  const below = !hole || hole.top + hole.height < window.innerHeight * 0.55

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`Tour step ${step + 1} of ${TOUR_STEPS.length}: ${cur.title}`}>
      {hole
        ? <div className="pointer-events-none absolute rounded-2xl ring-2 ring-brand transition-all duration-300" style={{ ...hole, boxShadow: '0 0 0 9999px rgba(5,8,14,0.78)' }} />
        : <div className="absolute inset-0 bg-[rgba(5,8,14,0.78)]" />}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      <div className="scale-in absolute inset-x-3 rounded-2xl border border-brand/40 bg-surface2 p-4 shadow-2xl"
        style={below ? { top: hole ? Math.min(hole.top + hole.height + 12, window.innerHeight - 230) : '30%' } : { bottom: Math.max(12, window.innerHeight - (hole!.top - 12)) }}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">Step {step + 1} of {TOUR_STEPS.length}</div>
        <div className="mt-1 text-[17px] font-bold text-ink">{cur.title}</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">{cur.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={end} className="pressable min-h-[44px] px-2 text-[13px] font-medium text-ink3">Skip</button>
          <div className="flex-1" />
          {step > 0 && <button type="button" onClick={() => go(step - 1)} className="pressable min-h-[44px] rounded-xl bg-surface3 px-4 text-[14px] font-semibold text-ink">Back</button>}
          <button type="button" onClick={() => (last ? end() : go(step + 1))} className="pressable min-h-[44px] rounded-xl bg-brand px-4 text-[14px] font-bold text-black">{last ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
