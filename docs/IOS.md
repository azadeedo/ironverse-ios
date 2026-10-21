# Ironverse iOS: how this project works

## 1. What this repository is
- It is an independent copy of the Ironverse web app (`iron-verse@7905a90`, v2.24.0), wrapped with **Capacitor 8.5.3** as a native iOS app.
- The original `iron-verse` folder and the live Netlify site (ironverse-app.netlify.app) are **not connected** to this repository:
  - it has its own git repository and no Netlify link (`.netlify/` was not copied);
  - it has no deploy scripts aimed at that site.
  - `netlify.toml` came across with the source but is unused, because nothing here is linked to a Netlify site.
- **Bundle ID:** `com.nouriapps.ironverse`. App name: **Ironverse**. Version **1.0.0** (Xcode `MARKETING_VERSION`). The build number is set by CI.
  - The web app's own version (2.24.0, shown in Settings) is separate from the App Store version.
- The app is iPhone only (`TARGETED_DEVICE_FAMILY = 1`), portrait, iOS 15+.

## 2. Commands (Windows)
| Command | What it does |
|---|---|
| `npm ci` | install |
| `npm test` | 168 unit tests (Vitest) |
| `npm run dev:ios` | App Store edition in a browser at http://localhost:5188 (separate storage from the live site) |
| `npm run build:ios` | web bundle for the app (`vite build --mode ios`: no service worker) |
| `npm run verify:ios` | checks the bundle: no service worker, no API keys, bundle id, permission strings |
| `npm run cap:sync` | build:ios, then copy into `ios/App/App/public` |
| `npm run ios:assets` | re-render the 1024 px icon and splash (`tools/ios_assets.py`, needs Python and Pillow) |
| `npm run check:preserve` | prove nothing from the original was removed (reads `../iron-verse`) |

**Xcode never runs on Windows.** Compiling, signing and uploading happen on Codemagic's macOS machines (`codemagic.yaml`).

## 3. What is different in the App Store build (and why)
The source tree is shared. The build is selected by `VITE_EDITION=ios` (`.env.ios`) through `src/lib/edition.ts`. The web build behaves exactly as before.

1. **Fresh install starts empty.**
   - `seedIfNeeded()` writes a neutral profile with `onboarded: false`, instead of the owner's personal numbers.
   - The owner-only once-routines in `App.tsx` are not started: owner profile, owner foods, the 19 Oct program restart, seed fix, and auto-activate of the 12-week program.
2. **First-time setup** at `/welcome` (`screens/firstRun`, `lib/firstRun.ts`), 8 screens:
   - Welcome
   - About you, with metric or imperial units
   - Goals (multi-select)
   - Strength check: known 1RM, Epley estimate from a set of 1–12 reps, or later
   - Training preferences (days, length, gym or home, equipment, style)
   - Personalise (editable targets; plan from the existing generator or the 12-week program; halal and reminder toggles)
   - Interactive tour
   - Done
   - Progress is saved after every change (`firstRun:draft`), and an interrupted setup resumes.
3. **Interactive tour** (`components/Tour.tsx`)
   - It moves through the real screens and spotlights the real controls.
   - It is read-only.
   - It can be replayed from Settings.
4. **Goal coach**
   - It uses the user's own goal weight and a pace of about 0.5% of body weight per week (at least 8 weeks).
   - Automatic calorie changes are **off** until the user turns them on.
5. **AI meal photos:** a one-time consent prompt appears before the first photo goes to Anthropic, using the user's own key (App Review 5.1.2).
6. **Native glue** (`src/native/`). Each part does nothing in a browser:
   - status bar and splash;
   - Taptic haptics for the app's existing `vibrate()` calls;
   - reminders handed to iOS local notifications when the app goes to the background;
   - files (backup, CSV, share card) saved through the iOS share sheet.
7. **Backups gain integrity data.**
   - New fields: SHA-256 `checksum`, `schema`, `edition`.
   - A damaged or edited file is refused before anything is written.
   - Older web backups without a checksum still import after a row-count check.
8. **Neutral wording** (`ed(web, ios)`): no Flex 24/7, 85 kg, garage, "his rack", wife or Monster defaults in the App Store build. The web text is unchanged.
9. **No service worker.** The App Store delivers updates, and every file, including all exercise media, is bundled.

## 4. Your data: the rules that must never be broken
- The app's IndexedDB belongs to the `capacitor://localhost` origin. **Never change** `appId`, `server.iosScheme` or `server.hostname` after the first TestFlight build, or an update would open an empty database.
- App Store updates keep the app container. An update replaces the app bundle, not the data.
- Dexie schema changes must stay additive. This means new `version(n)` with new tables or optional fields only, the same rule as the web app.

### Moving your existing data from the home-screen web app
The web app (Safari storage) and the iOS app (app container) **cannot see each other's data**. Nothing moves automatically, and nothing is deleted from the web app.
1. In the **web app** go to More → Backup → **Export backup**, and save the `.json` to Files. This feature already exists in the live app, so no web-app patch is needed.
2. In the **iOS app** first screen, tap **"I already use Ironverse — restore a backup"**. Pick the file, review the counts and the integrity result, then choose **Merge**.
3. Because the restored profile is already set up, first-time setup is skipped and your history, plans and settings appear as they were.
4. Keep using the web app if you like. It is untouched. To keep both in step, export again and Merge again; newest rows win and nothing is deleted.

## 5. Cloud builds (Codemagic)
- **`ios-compile-check`**
  - Runs on every push to `main` and needs **no Apple account**.
  - It runs tests, `build:ios`, `verify:ios` and `cap sync`, then compiles for the iOS Simulator without signing.
- **`ios-testflight`**
  - Started manually.
  - It needs the App Store Connect API key integration named **"Ironverse ASC key"** and `APP_STORE_APPLE_ID` filled in.
  - It signs automatically (Codemagic creates the distribution certificate and provisioning profile through the API key), builds the IPA and uploads it to TestFlight.
  - `submit_to_app_store: false`: it never submits for review.
- **Free plan:** 500 macOS M2 minutes a month and 1 concurrent build; a build takes about 10–15 minutes. Pay-as-you-go after that is US$0.095 per minute. Nothing paid is enabled.

## 6. Signing secrets
- Nothing secret is in this repository: no `.p8`, `.p12`, `.mobileprovision` or keys. `.gitignore` blocks them.
- The App Store Connect API key (`.p8`) is uploaded **only** to Codemagic (Team settings → Integrations → Developer Portal). It is downloaded once from App Store Connect, uploaded, then stored offline by you.
