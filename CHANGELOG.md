# Changelog: Ironverse iOS

The App Store version (Xcode `MARKETING_VERSION`) is separate from the web base version (`package.json`). TestFlight build numbers are set by Codemagic.

## 1.0.0 (unreleased)
Web base 2.24.0 (`iron-verse@7905a90`).

**Builds**
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
