# Ironverse as a native iPhone app: what's added, and what's next

Updated 23 October 2026. Ironverse is now a real App Store app (Capacitor 8), so it can use iPhone features a web app couldn't. Nothing was removed to make room for these.

## Added in build 6

| Feature | What it does | Inspired by |
|---|---|---|
| **Sleep & recovery** (`/sleep`) | 5-face morning rating, bed and wake times, factors (caffeine, alcohol, phone in bed…), Apple Watch sleep with deep, REM and core stages, a 14-night chart, sleep debt, a consistency score, "what affects YOUR sleep" from your own log, bedtime and morning reminders, and cited research | Sleep Cycle, AutoSleep, Whoop |
| **Recovery score** (Today and Sleep) | 0–100 from sleep time, sleep quality, resting heart rate and HRV against your own 2-week baseline, plus soreness. It gives green, amber or red advice for today's session | Whoop, Athlytic, Bevel |
| **Apple Health, more data** | Reads sleep, HRV and resting heart rate as well. Optional write-back of water and food calories (weigh-ins were already supported) | MyFitnessPal, MacroFactor |
| **Fasting timer** (`/fasting`) | 13:11 to 20:4 plans, a progress ring, fasting stages, an iPhone alert at your goal, history, streak and hit rate | Zero, Fastic |
| **Rest timer in the background** | Leave the app mid-rest and iOS still taps you when the rest is over | Strong, Hevy |
| **Home-screen quick actions** | Long-press the app icon for Start workout, Log food, Sleep check-in and Health scanner | Most top apps |
| **Face ID / Touch ID lock** | Optional, under Settings → Privacy | Banking and journalling apps |
| **App Store rating prompt** | Apple's own sheet, after the 3rd, 10th and 30th finished workout | Standard practice; ratings drive App Store ranking |

## Already in Ironverse before build 6

These cover what Hevy, Strong and Fitbod offer, and more:
- Workout logging with PRs, a plate calculator, supersets, RIR, rest timer, history and replays.
- Programs generated from your own equipment, plus the 12-week program, coach styles and your own custom programs.
- Food: barcode scanning, the Health scanner, meal-photo estimates, 560+ foods across 15 cuisines, recipes, a meal planner and the calorie centre.
- Body: weigh-ins, measurements, progress photos with compare and a transformation view, 3D anatomy, achievements and the progress hub.
- Water, creatine, steps and weekly reviews, with all data on the device and encrypted backups.

## Next: needs native Swift work (Xcode targets, built on Codemagic)

These are Apple features that need a separate native extension, which the web code can't provide. Each is a self-contained project.

| Feature | Why it matters | Work involved |
|---|---|---|
| **Apple Watch app** | Log sets and see the rest timer and heart rate from your wrist (Hevy and Strong have this) | A watchOS target in SwiftUI with WatchConnectivity to the phone. Large job |
| **Home-screen and Lock-screen widgets** | Calories left, water, today's workout, recovery score at a glance | A WidgetKit extension plus an App Group to share a small JSON snapshot. Medium job |
| **Live Activity / Dynamic Island** | Rest-timer countdown and current set on the Lock Screen while you train | An ActivityKit extension plus a small Capacitor bridge. Medium job |
| **Siri and Shortcuts** ("Hey Siri, log 500 ml of water") | Hands-free logging | App Intents in Swift. Small to medium job |
| **Write workouts to Apple Health** (Fitness rings) | Strength sessions count toward Move and Exercise rings | A small custom native method (the current plugin can't save workouts). Small job |

## Notes for App Review
- The HealthKit data is used only on the device and is described in the privacy policy (ironverse-legal.netlify.app/privacy-policy, Apple Health section), so the App Privacy answer stays "Data Not Collected".
- Face ID is optional and off by default, with its own usage string in Info.plist.
