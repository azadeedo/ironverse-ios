# Changelog: Ironverse iOS

The App Store version (Xcode `MARKETING_VERSION`) is separate from the web base version (`package.json`). TestFlight build numbers are set by Codemagic.

## 1.0.0 (unreleased)
Web base 2.24.0 (`iron-verse@7905a90`).

**Builds**
- **Build 5** (23 Oct 2026, owner's device feedback):
  - Food: cuisine chips in Add food now list their dishes (they showed nothing); Middle Eastern is a cuisine, not a food type.
  - Today: daily habits (water, creatine, steps) first, then nutrition, then Move today, then training.
  - Gym vs home: the 12-week program swaps exercises your home kit can't do, shown on the day screen.
  - Halal: no longer asked during setup; one switch in Settings → Food turns everything on, including a new halal check in the Health scanner.
  - Apple Health: connect on Connected devices. Steps, Apple Watch cardio, smart-scale weigh-ins, active calories and resting heart rate sync automatically; weigh-ins can be saved back. (HealthKit capability + new signing profile.)
  - Coach programs show "Inspired by" Chris Bumstead, Jeff Nippard and Arnold Schwarzenegger, plus new Heavy Duty (Mike Mentzer) and Blood & Guts (Dorian Yates) styles, all with not-affiliated wording.
  - Programs: pick 1–16 weeks when generating from your equipment; new Build my own program screen; shortcuts on the Workout tab.
  - Real exercise photos for 118 more exercises (public domain).
  - Weekly review: More from your week. Progress photos: transformation card.
  - Food and More tabs reordered so the best features come first. Nothing removed.
- **Build 4** (22 Oct 2026): 159 more world dishes, so every cuisine chip lists at least 20 (Filipino was 3, Korean and African 6), including laksa, udon, tempura, kofte, doner, paratha and sinigang. The paywall's fallback price is A$9.99/month and yearly shows "Save 33%". New tests cover the food data; tools/smoke-ios.mjs sweeps 39 screens × 3 user types.
- **Build 3** (commit 2e5add3, 21 Oct 2026):
  - 100 world dishes across 15 cuisines, with cuisine chips and flags in Log meal and Add food.
  - The run pace goal is now set by each user (the owner's 4:00 is web-only).
  - Pro entitlement handling no longer overwrites the stored status outside iOS.
- **Build 2** (commit a8daa30):
  - Ironverse Pro: a 7-day Premium preview, then a Free tier, plus StoreKit monthly and yearly subscriptions.
  - In-app Suggest & report.
  - No ads.
- **Build 1** (commit 9c91c01): the first signed TestFlight build.

**Also in 1.0.0**
- Capacitor 8 iOS shell.
- 8-screen first-time setup and an interactive tour.
- Backup integrity checks (SHA-256).
- Native share sheet, local notifications and haptics.
- Neutral wording in the App Store build.
- Consent prompt before AI meal photos are sent.
- Health disclaimer.

**Store media**
- 10 screenshots and 3 preview videos, built from real app footage (`tools/store-media`).
