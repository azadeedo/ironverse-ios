# Ironverse feature inventory and preservation checklist

Source: the original `iron-verse` project at commit `7905a90` (web version 2.24.0, live at ironverse-app.netlify.app on 21 Oct 2026). It was copied unchanged into this repository as commit `2b23cc1`.

**How preservation is checked**

- `npm run check:preserve` compares this copy with the original folder, which it only reads. It confirms that all 434 original files are present and lists every line that changed.
- On 21 Oct 2026 the result was **0 files missing**. 15 original files changed. 11 of their lines were rewritten, and no line was simply deleted. Each rewritten line now sits inside an "App Store build?" check, and the web branch of that check runs the original line unchanged.
- `npm test`: the 156 original tests all still pass. There are also 12 new tests, for 168 in total.

Legend: ✅ present and unchanged · ➕ present, with an additive iOS change (listed in docs/IOS.md §3) · 🔍 needs checking on a real iPhone during TestFlight.

## 1. Navigation and shell
| # | Feature | Status |
|---|---|---|
| 1.1 | 5-tab bar: Today, Workout, Food, Progress, More | ✅ (gained `data-tour` attributes only) |
| 1.2 | 49 original routes (listed below) | ✅ |
| 1.3 | Rest-timer bar, toasts, page transitions | ✅ |
| 1.4 | Update prompt and launch status banner | ➕ App Store build shows "Updated to vX" only. Updates come from the App Store. |
| 1.5 | Font scale, haptics and sound preferences | ➕ haptics are routed to the iPhone Taptic Engine |

Original routes: `/`, `onboarding`, `workout`, `plan`, `session/:logId`, `exercises`, `exercise/:id`, `food`, `progress`, `cardio`, `hydration`, `more`, `settings`, `backup`, `programs`, `review`, `photos`, `prs`, `history`, `tools`, `search`, `achievements`, `whats-new`, `program`, `program/day/:week/:day`, `program/review/:week`, `program/complete`, `calories`, `hub`, `replay/:logId`, `devices`, `meal-plan`, `food-photos`, `health-scan`, `fast-food`, `pill-box`, `nutrition-week`, `anatomy`, `anatomy/3d`, `pr-quest`, `body`, `skills`, `research`, `strength-journey`, `*`. **New:** `welcome` (first-time setup).

## 2. Training
| # | Feature | Status |
|---|---|---|
| 2.1 | Exercise library: 194 exercises with animated SVG stick-figure demos (`anim/rig.tsx`), muscle map, images and videos | ✅ (all 127 media files bundled for offline use) |
| 2.2 | Custom exercises (`customExercises` table) | ✅ |
| 2.3 | Location-built plan generator: Home vs Gym, 5-week rotating plans (`lib/plangen.ts`) | ✅ (also used by the new setup) |
| 2.4 | 12-week program: 48 written workouts (`data/program48.ts`), restart, missed-session moves, week reviews, program-complete screen | ✅ |
| 2.5 | Equipment profiles and substitution engine (`lib/equipment.ts`, `lib/quality.ts`) | ✅ (setup can set the Home kit and rename "Flex 24/7" to "Gym", App Store build only) |
| 2.6 | Plate-aware loads, plate calculator, warm-ups, rest bands (`lib/plates.ts`, `lib/onerm.ts`) | ✅ |
| 2.7 | Session screen: set logging, supersets, set modes (drop, rest-pause, myo, cluster, AMRAP), tempo, autoregulation, regressions, short-on-time | ✅ |
| 2.8 | Progression, volume, deload signals (`lib/progression`, `volume`, `training`, `nextBlock`, `restSmart`) | ✅ |
| 2.9 | PRs, history, workout replay, achievements, PR quest, skills, strength journey, research | ✅ |
| 2.10 | Tools: 1RM, relative strength, rest, warm-up | ✅ |
| 2.11 | Cardio: run/walk GPS tracker, treadmill 10 km run, jump-rope timer, activity sessions | ✅ 🔍 GPS uses the new location permission string |
| 2.12 | Anatomy: SVG muscle map with quiz, plus the 3D body (`iv-body.bin`, three.js) | ✅ 🔍 WebGL on device |

## 3. Nutrition
| # | Feature | Status |
|---|---|---|
| 3.1 | Food log with 302 seeded Australian foods, custom foods, recipes, favourites | ✅ |
| 3.2 | Barcode scanner (camera) with Open Food Facts lookup and cache | ✅ 🔍 camera permission on device |
| 3.3 | AI meal-photo estimate using the user's own Anthropic key | ➕ App Store build asks for consent once before the first photo is sent (App Review 5.1.2) |
| 3.4 | Calorie centre, adaptive TDEE, calorie-target proposals with Undo | ✅ |
| 3.5 | Goal coach and run-goal card | ➕ App Store build uses the user's own goal weight and a safe default date, and does not change calories automatically until the user turns it on. The web build is unchanged (85 kg, 14 Jan 2027). |
| 3.6 | Meal plan, food-photo diary, health scan, fast-food guide, nutrition range | ✅ |
| 3.7 | Halal mode, Ramadan and prayer awareness | ✅ (setup offers a halal toggle, default off for new App Store users) |
| 3.8 | Hydration and creatine logging, pill box (dosette) | ✅ |

## 4. Body and progress
| # | Feature | Status |
|---|---|---|
| 4.1 | Weigh-ins, measurements, trend charts, waist-to-weight, recovery map, weak points, strength standards | ✅ |
| 4.2 | Progress photos: capture, compare, viewer | ✅ 🔍 camera and photo picker on device |
| 4.3 | Weekly review, progress hub, insights | ✅ |
| 4.4 | Share card (PNG of a workout) | ➕ goes to the iOS share sheet in the app |

## 5. Data and safety
| # | Feature | Status |
|---|---|---|
| 5.1 | Dexie database `iron-verse`: 22 tables across schema v1, v2 and v3. Never dropped, never bumped by the iOS work. | ✅ |
| 5.2 | Full JSON backup including photo blobs, encrypted backup (AES-GCM), CSV export | ➕ adds a SHA-256 checksum, schema and edition fields, and the iOS share-sheet save |
| 5.3 | Restore: inspect first, then merge (newest wins) or replace with confirmation, with a pre-restore snapshot | ➕ adds an integrity check that blocks damaged files. Older backups without a checksum are still accepted. |
| 5.4 | Daily automatic snapshots (last 10), snapshot restore and export | ✅ |
| 5.5 | Pre-upgrade backup before a schema change (`lib/migrate.ts`) | ✅ |
| 5.6 | Seed hardening (never seeds over existing data) | ✅. The App Store build seeds a neutral profile instead of the owner's. |
| 5.7 | Reminders (water, creatine, workout, 10 pm over-budget) | ➕ in the iPhone app they are handed to iOS as local notifications when the app goes to the background |
| 5.8 | Settings: profile, targets, work schedule, display, AI key, food preferences, prayer, Ramadan, app health, feedback | ✅ (gains "Replay the app tour" and, in the App Store build, "First-time setup") |
| 5.9 | Owner-only startup routines: owner profile, owner foods, program restart, seed fix, program auto-activate | ✅ in the web build. In the App Store build they are not started on a fresh install. A restored backup carries their results across. |
