# Changelog: Ironverse iOS

The App Store version (Xcode `MARKETING_VERSION`) is separate from the web base version (`package.json`). TestFlight build numbers are set by Codemagic.

## 1.0.0 (unreleased)
Web base 2.24.0 (`iron-verse@7905a90`).

**Builds**
- **Build 10** (23 Oct 2026, owner request):
  - Muslim features, only when Halal mode is on in Settings → Food: a live prayer banner on Today (next prayer with countdown, all five times, Hijri date) and a Prayer screen with a Qibla compass, prayer reminders, 8 calculation methods, Shafi/Hanafi Asr, per-prayer offsets, GPS or city, and "plan workouts around today's prayers". Times checked against Aladhan.
  - Diet options in Settings → Food → Diet: balanced, high protein, low carb, keto, Mediterranean, vegetarian, vegan, pescatarian, dairy free and gluten free. Each sets the carb and fat guides, filters food search where it applies, and comes with tips.
  - Six more coach styles, each with a weekly routine and not-affiliated wording: Mass Monster Split (Ronnie Coleman), Volume Landmarks Mesocycle (Dr Mike Israetel), Wave Strength 4-Day (Jim Wendler), Novice Linear Strength (Mark Rippetoe), Glute-Focused Strength (Bret Contreras) and Aesthetic Symmetry Split (Frank Zane). The Programs screen now shows all 10 extra styles under "More coach styles"; the earlier four had not been showing there.
- **Build 9** (23 Oct 2026): exercise pictures uncropped (square thumbnails of real photos), our demos first, photos second, stick-figure diagram one tap away; Saved hub + Save as template; 26-step tour; weigh-in fix; lighter exercise lists (no autoplay video wall).
- **Build 8** (23 Oct 2026): Apple Health "Connect" can no longer sit on "Connecting…": every Health request has a time limit, the button turns Connected as soon as permission is granted (the first sync runs in the background), a step-by-step status, Check again, help when no permission sheet appears, and a connection log on Connected devices.
- **Build 7** (23 Oct 2026): Apple Watch companion app (today, set logging with rest timer and wrist taps, quick water and creatine) talking to the iPhone app; WHOOP, Oura, Garmin, Polar, Withings, scales, Strava and HR straps through Apple Health with setup guides; Quick log sheet; foldable Today sections.
- **Build 6** (23 Oct 2026): native features. Sleep & recovery screen (morning rating, Apple Watch sleep stages, chart, debt, consistency, personal factor effects, reminders, cited research); daily recovery score on Today; Apple Health also reads sleep, HRV and resting heart rate and can save water and food calories; fasting timer with goal alert; rest timer alerts in the background; home-screen quick actions; optional Face ID lock; App Store rating prompt after the 3rd/10th/30th workout. See docs/NATIVE_FEATURES.md.
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
