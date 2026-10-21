# Apple Health / Apple Watch — architecture (not built yet)

**Status: design only.** A web app (PWA) cannot read or write Apple HealthKit, and cannot run on
Apple Watch. Nothing in Ironverse pretends otherwise: steps are typed in, and the Today screen says so.

Building this needs things this Windows machine does not have:
- a Mac with Xcode (iOS/watchOS apps can only be compiled there)
- an Apple Developer account ($149 AUD/yr) for signing and TestFlight
- a physical iPhone and Apple Watch for testing (HealthKit does not run in the simulator fully)

## Proposed shape

```
Ironverse PWA (existing, unchanged)          iOS companion app (new, SwiftUI)
  IndexedDB = source of truth   ◀── sync ──▶   HealthKit bridge
                                                  │
                                           watchOS app (WorkoutKit)
```

**Sync channel.** The PWA and a native app don't share storage. Options, simplest first:
1. *Share sheet / Shortcuts:* the iOS app exports a small JSON payload (steps, resting HR, workouts)
   to the clipboard or a file; the PWA's Backup screen gains "Import from Apple Health app".
   No server, private, works offline. Recommended first step.
2. *Wrap the PWA* in the native app (WKWebView) and pass messages through a JS bridge, so both share
   one container. More work, but gives true two-way sync and native notifications.

## HealthKit permissions (request only these, each explained in-app)

| Read | Why |
|---|---|
| Step count | daily step target (8,000 → 10,000) |
| Heart rate, resting heart rate | Zone 2 cardio and recovery context (supplementary only, never diagnostic) |
| Active energy | cardio and adaptive calorie context |
| Workouts, walking/running distance | count cardio sessions toward the weekly target |

| Write (only with explicit permission) | Why |
|---|---|
| Strength training workouts (start, end, duration, kcal estimate) | so Ironverse sessions appear in Apple Fitness rings |

## Watch workout mode (watchOS)

Shows: current exercise, set number, reps target, rest countdown, heart rate, next exercise.
Actions: **Complete set**, **Skip**, **Rest +30 s**. Haptic tap when rest ends.
Session data flows back to the iPhone app, then into the PWA via the sync channel above.

## Data contract (PWA side — ready now)

The PWA already stores what the watch would need: `WorkoutLog.exercises[].sets[]` with
`targetReps`, `plannedKg`, `weightKg`, `rir`, `done`, plus rest seconds on each plan exercise.
An import would write `DailyCheckin.steps` and add `CardioLog` rows with `avgHr`.

**Nothing here is marked complete until it has been built and tested on real Apple hardware.**
