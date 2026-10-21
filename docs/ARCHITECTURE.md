# Ironverse — architecture & conventions (READ FIRST)

Personal offline-first training PWA for ONE user (the owner). His garage setup is fixed:
LSG GRK-110 rack (smith machine, dual-stack cable crossover w/ selectable stack steps,
lat pulldown w/ seat rollers, low row + foot plates, multi-grip pull-up bar, dip handles,
suspension straps), barbell (20kg) + short curl bar (10kg), plate PAIRS 2×5/2×10/2×15/2×20kg,
adjustable FID bench (flat/incline/decline + leg rollers), jump rope. NO dumbbells, NO
leg press/hack machines — never reference equipment he doesn't own.

Owner data seeded in Dexie: 98.3kg, male, goal lose-fat, 4 days/week, ~60min sessions,
Mon–Fri 8:00–17:00 work default, targets 2,956 kcal / 192g protein / 3.5L water / 5g creatine,
measurements (biceps 39, abs 121, waist 104, chest 114, shoulders 143, thigh 64.5, calf 42cm).

## Stack & conventions
React 18 + TS strict + Vite 6 + Tailwind 3 + Dexie + zustand + dayjs + lucide-react. DARK-FIRST
theme (navy #0c111c surfaces, amber `brand` #fbbf24 accent, `.shout` class for italic-caps
headings, `.big-num` for stat numerals). Same UI kit as previous apps: `@/components/ui`
(PageHeader, Card, StatCard, Button, IconButton, Sheet, Modal, ConfirmDialog, Input, TextArea,
Select, Field, Segmented, Chips, ListRow, ListGroup, EmptyState, Fab, SearchBar, Badge, Toggle,
ProgressBar, Spinner; toasts via `useUI().toast`). Charts: `@/components/charts` (LineChart
w/ optional dashed trend series, BarChart, ProgressRing). Dates 'YYYY-MM-DD' (`todayStr()`),
ids `newId()`, weights kg, volumes ml, energy kcal.

## Golden rules
1. Only touch files in YOUR assigned scope. Shared files (src/db/*, src/lib/*, src/anim/*,
   src/components/*, src/App.tsx, src/data/exercises/{index,_reference}.ts, configs) are
   OFF LIMITS unless a file is explicitly assigned to you.
2. Verify with `npx tsc --noEmit`; fix every error in YOUR files; ignore other modules'
   errors; never run npm install/dev/build.
3. Everything works offline; no network calls; no invented equipment; no medical claims.
4. Every list/detail handles empty states. Deletes need ConfirmDialog. Autosave freely.

## Domain libs (read them fully before using)
- `@/db/types` — ALL types incl. Pose/ExerciseAnimDef/Exercise/Plan/logs. Read completely.
- `@/db` — Dexie `db` + getSetting/setSetting + getProfile/saveProfile/getActivePlan.
- `@/lib/nutrition` — bmr/tdeeFormula/recommendedTargets, adaptiveTdee (the deficit detector:
  learns true TDEE from intake + weight trend), projectedKgPerWeek, weightTrend (EMA),
  metCalories, MACRO_KCAL.
- `@/lib/plates` — nearestLoad(mode, desiredKg, profile) → achievable LoadPlan with per-side
  plate breakdown label; nextLoadUp for progression; barLoads/perSideOptions. EVERY prescribed
  or logged weight suggestion must come from these.
- `@/lib/schedule` — weekSlots/slotForDay (best workout window around work hours),
  pickTrainingDays, todayTimeline (water/creatine/workout/work items), DAY_NAMES, minutesOf.
- `@/lib/notify` — ensurePermission, showNotification, scheduleAt(key,'HH:mm',…) same-day
  timers (fire while app open), setBadge. Be honest in UI copy: reminders fire while the
  app is open; the Today timeline always shows the schedule.
- `@/lib/store` — useUI: toasts + global rest timer (startRest(sec) shows the floating
  RestTimerBar everywhere, plays notification/vibration at 0).
- `@/lib/fmt` — dayjs, fmtKg/fmtDuration/fmtClock/fmtPace/fmtInt/fmtDate/fmtDayShort.
- `@/lib/backup` — exportBackup/restoreBackup/downloadBlob/shareOrDownload.
- `@/lib/plangen` — generatePlan(profile) (plan agent owns this file).

## Exercise registry & animations
`@/data/exercises` exports EXERCISES, byId, exercisesFor(muscle), alternativesFor(id).
Exercises are static TS data (NOT in Dexie). Animation = keyframe poses rendered by
`<ExerciseAnim def={ex.anim} size={220} />` from `@/anim/rig` — read `_reference.ts` for the
angle conventions (5 worked examples) and `@/db/types` Pose docs. Muscle highlighting:
`<MuscleMap primary={ex.primary} secondary={ex.secondary} />` from `@/anim/MuscleMap`.
Rig props available: barbell, curl-bar, smith, cable-down, cable-up, bench-flat,
bench-incline, pullup-bar, dip-bars, rope, plate, none. lying:true rotates the figure for
bench work. Author poses so movement reads clearly at 200px.

## Routes (wired in App.tsx; replace the stub screens assigned to you)
/ Today · /onboarding · /workout (plan browser: week/day tabs) · /plan (plan settings/regen)
· /session/:logId (live player, tab bar hidden) · /exercises · /exercise/:id · /food ·
/progress · /cardio · /hydration · /more · /settings.
Deep-link contracts: /exercises?muscle=chest ; /exercise/:id ; /food?add=1&meal=lunch ;
/session/:logId (logId = WorkoutLog id created by whoever starts a session);
/workout?week=2&day=1 ; /cardio?start=jump-rope ; navigating with ?new=1 opens create flows.
The global RestTimerBar is already mounted — call useUI().startRest(sec) and it just works.
