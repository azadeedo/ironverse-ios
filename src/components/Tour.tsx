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

// v10.1 (owner, 23 Oct 2026): the full tour — every major feature, each on its real screen.
export const TOUR_STEPS: TourStep[] = [
  { route: '/', title: 'Your dashboard', body: 'Today is your home: sleep, water, creatine, steps, calories, today’s workout and reminders — most important first. The tabs at the bottom take you everywhere else.', targets: [{ css: '[data-tour="tab-today"]' }] },
  { route: '/', title: 'Quick log', body: 'Tap + Log from anywhere to add water, creatine, your weight or last night’s sleep in one tap — with shortcuts to food, workouts, cardio, photos and fasting.', targets: [{ css: 'button[aria-label="Quick log"]' }] },
  { route: '/', title: 'Sleep & recovery', body: 'Each morning, tap a face to rate your sleep. Ironverse turns it (plus Apple Watch sleep and heart data if connected) into a recovery score that tells you whether to push or go easier today.', targets: [{ text: /How did you sleep/ }, { css: '[data-tour="tab-today"]' }] },
  { route: '/', title: 'Gym or home', body: 'Training somewhere else today? Switch location here and your session adapts — exercises your kit can’t do are swapped automatically.', targets: [{ text: /^(Gym|Home)$/ }, { css: '[data-tour="tab-today"]' }] },
  { route: '/workout', title: 'Start a workout', body: 'Today’s session lives on the Workout tab. Tap Start and Ironverse walks you through each exercise with target weights and rest timers.', targets: [{ text: /^(Start|Resume)/ }, { css: '[data-tour="tab-workout"]' }] },
  { route: '/workout', title: 'Log your sets', body: 'During a workout, enter the weight and reps for each set and tick it off. The rest timer starts itself — and your iPhone (or Apple Watch) taps you when it’s time to go again, even if you leave the app.', targets: [{ text: /^(Start|Resume)/ }, { css: '[data-tour="tab-workout"]' }] },
  { route: '/workout', title: 'Make a program', body: 'New program builds one from your equipment for 1 to 16 weeks. Build my own lets you pick every exercise, set and rep yourself.', targets: [{ text: /New program/ }, { text: /Build my own/ }] },
  { route: '/programs', title: 'Coach programs', body: 'Training styles inspired by Chris Bumstead, Jeff Nippard, Arnold, Mike Mentzer and Dorian Yates — read how each trains and run it as your plan.', targets: [{ css: 'h1' }] },
  { route: '/exercises', title: 'Exercise library', body: '194 exercises with demos and real photos, muscles worked and setup tips. Tap ☆ to star favourites. Search by name, muscle or equipment.', targets: [{ css: 'input[type="search"], input[placeholder*="Search"]' }, { css: 'h1' }] },
  { route: '/prs', title: 'Personal records', body: 'New bests are spotted automatically when you log a set — heaviest weight, most reps and estimated 1-rep max.', targets: [{ css: 'h1' }] },
  { route: '/food', title: 'Track calories', body: 'Tap + to log food. Search 560+ foods, browse by cuisine (Australian, Middle Eastern, Thai and more), or save your own meals. Calories and protein update against your target.', targets: [{ css: 'button[aria-label="Add food"]' }, { css: '[data-tour="tab-food"]' }] },
  { route: '/food', title: 'Scan barcodes & meals', body: 'Scan a barcode to log packaged food instantly, or snap a photo of your meal for an estimate.', targets: [{ text: /Barcode/ }, { text: /Scan meal/ }, { css: '[data-tour="tab-food"]' }] },
  { route: '/health-scan', title: 'Health scanner', body: 'Scan any product for a score out of 100 with plain-English reasons, the additives inside and better options. With Halal mode on (Settings), it also gives a halal check.', targets: [{ css: 'h1' }] },
  { route: '/fasting', title: 'Fasting timer', body: 'Optional intermittent fasting — pick 13:11 up to 20:4, see what stage you’re in and get an alert when you reach your goal.', targets: [{ css: 'h1' }] },
  { route: '/hydration', title: 'Water & creatine', body: 'Set your water target and reminders. Water you log can also count in Apple Health.', targets: [{ css: 'h1' }] },
  { route: '/progress', title: 'See your progress', body: 'Weight trend, body measurements, strength and consistency charts — all built from what you log.', targets: [{ css: '[data-tour="tab-progress"]' }] },
  { route: '/photos', title: 'Progress photos', body: 'Take front, side and back photos on the same day each week. Your transformation card shows day one next to today — photos never leave your phone.', targets: [{ css: 'h1' }] },
  { route: '/review', title: 'Weekly review', body: 'Every week in one screen: sessions, hard sets, calories, protein, weight trend, records broken, steps, water and sleep — with an honest verdict.', targets: [{ css: 'h1' }] },
  { route: '/sleep', title: 'Sleep in depth', body: 'Your last 14 nights, sleep debt, how steady your schedule is, what affects YOUR sleep (caffeine, alcohol, phone in bed…) and the science explained simply.', targets: [{ css: 'h1' }] },
  { route: '/hub', title: 'Progress hub', body: 'Trophies, your athlete level, muscles trained and challenges — the fun side of showing up.', targets: [{ css: 'h1' }] },
  { route: '/devices', title: 'Apple Watch & devices', body: 'Connect Apple Health so steps, sleep, workouts and weigh-ins fill in by themselves — including from WHOOP, Oura, Garmin and smart scales. The Ironverse Apple Watch app lets you log sets from your wrist.', targets: [{ text: /Connect Apple Health|Sync now/ }, { css: 'h1' }] },
  { route: '/saved', title: 'Saved', body: 'Your saved workouts (start them again in one tap), starred exercises, favourite foods, meals and programs — all in one place. Finish a workout and tap “Save as template” to add one.', targets: [{ css: 'h1' }] },
  { route: '/more', title: 'Everything else', body: 'More has every tool, grouped and searchable. Tap Customise to pin your favourites to the top or hide what you don’t use.', targets: [{ css: '[data-tour="tab-more"]' }] },
  { route: '/search', title: 'Search anything', body: 'One search box for exercises, foods, past sessions and settings.', targets: [{ css: 'input' }, { css: 'h1' }] },
  { route: '/feedback', title: 'Tell us what to build', body: 'Ideas, bugs or fixes — send them straight to the developer from here.', targets: [{ css: 'h1' }] },
  { route: '/settings', title: 'Settings', body: 'Profile, targets, equipment, reminders, units, Halal mode and Face ID lock live here. You can replay this tour any time from Settings.', targets: [{ css: '[data-tour="replay-tour"]' }, { css: 'h1' }] },
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
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">Step {step + 1} of {TOUR_STEPS.length}</div>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface3"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }} /></div>
        </div>
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
