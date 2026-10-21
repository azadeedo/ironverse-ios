# Ironverse 1.0.0: App Store Connect listing

Every claim below was checked against the app's code. The final review was on 21 Oct 2026.

**Owner details:**
- Seller (Individual): Nouri Khalil
- Support email: azade@live.com.au
- Legal pages are on the separate Netlify site `ironverse-legal`. It is not the app's site.

## App information
| Field | Value |
|---|---|
| **Name** (30 max) | `Ironverse: Gym Workout Planner` (30) |
| **Subtitle** (30 max) | `Calorie Counter & Food Scanner` (30) |
| Bundle ID / SKU | `com.nouriapps.ironverse` / `ironverse-ios-001` |
| Primary category | Health & Fitness |
| Secondary category | Food & Drink |
| Price | Free download with in-app subscriptions (Ironverse Pro) |
| Copyright | `2026 Nouri Khalil` |
| Support URL | https://ironverse-legal.netlify.app/support.html |
| Marketing URL | https://ironverse-legal.netlify.app |
| Privacy Policy URL | https://ironverse-legal.netlify.app/privacy-policy.html |

**Why this name:**
- The Australian top-25 Health & Fitness apps (checked 21 Oct 2026) follow a "Brand: what it does" pattern. Examples: *Hevy – Workout Tracker Gym Log*, *Lyfta: Gym & Workout Planner*, *MyFitnessPal: Calorie Counter*, *Cal AI – Calorie Tracker*.
- Apple's search reads the name and subtitle most strongly. These two lines cover both of Ironverse's halves:
  - gym, workout, planner;
  - calorie, counter, food, scanner.

**Alternatives** if the name is taken or you prefer a different one:
- `Ironverse: Gym & Calorie Coach` (30)
- `Ironverse: Workout & Calories` (29)

## Promotional text (170 max, can be changed without a new build)
Train, eat and track in one app. 194 animated exercises, 400+ foods from 15 cuisines, and a 12-week program. Australian made. Try every Premium feature free for 7 days.
(168)

## Description
Ironverse is the all-in-one gym and nutrition app: plan your training, log every set, count calories and watch your body change, all in one place. Australian made, and used every day by its developer in his own training.

TRAIN
• Plans built around YOUR equipment: a full gym or a home setup. Switch Gym/Home and the exercises adapt.
• The Ironverse 12-week program: 48 individually written workouts with squat, bench and deadlift progression.
• 194 exercises with animated demos, muscles worked, form cues and setup tips.
• Log weight, reps and effort in seconds, with rest timer, warm-ups, supersets, drop sets, rest-pause, myo-reps and AMRAP.
• Weights you can actually load: the plate calculator only suggests weights your plates can build.
• Personal records and estimated one-rep max, spotted automatically.

EAT
• Count calories and protein from 400+ foods across 15 cuisines: Australian, Middle Eastern, Turkish, Greek, Italian, Mexican, Indian, Chinese, Japanese, Korean, Thai, Vietnamese, Filipino, African and American.
• Barcode scanner with a food health score (Pro), using the Open Food Facts database.
• Meal photo calorie estimates using your own Anthropic (Claude) key (Pro, optional).
• Smart calorie targets that only change with your OK, plus macro, water and supplement tracking.
• Halal food filter, plus Ramadan and prayer-time awareness, all optional.

PROGRESS
• Weight trend, body measurements, strength charts and weekly reviews.
• Progress photos with side-by-side compare.
• Interactive anatomy map and a 3D body explorer.
• Trophies, streaks, levels and challenges.

PRIVATE BY DESIGN
• No account needed. Your data stays on your iPhone and works offline.
• No ads, no analytics, no tracking.
• Full backup and restore to a file you control.
• Suggest a feature or report a bug right inside the app. It goes straight to the developer.

IRONVERSE PRO
Every new user gets the full Premium experience free for 7 days, with no card required. After that the core app stays free: workout logging, the exercise library, food logging, water, weigh-ins and your full history. Pro unlocks:
• the 12-week program
• advanced progress and reviews
• the barcode scanner
• meal photo estimates
• the goal coach
• photo compare
• the 3D body
• meal plans

Ironverse Pro: A$12.99 per month or A$79.99 per year (prices vary by country).
• Payment is charged to your Apple Account at confirmation of purchase.
• The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period.
• Your account is charged for renewal within 24 hours before the end of the current period.
• Manage or cancel in your Apple Account settings.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://ironverse-legal.netlify.app/privacy-policy.html

Ironverse gives general fitness and nutrition guidance, not medical advice. Check with a doctor before starting a new training or diet plan.

## Keywords (100 max; never repeat words already in the name or subtitle)
`tracker,log,lifting,strength,macro,protein,diet,weight,loss,progress,photo,barcode,1rm,fitness,meal`
(99)

## What's New (1.0.0)
First release of Ironverse for iPhone. Already using the Ironverse web app? Export a backup there, then tap "restore a backup" on the first screen. Every workout, meal and plan comes across.

## Screenshots: `store/screenshots-final/` (10 images, 1290 × 2796, iPhone 6.9")
These are real captures of the App Store build, using a clearly fictional demo user ("Alex"), in a branded frame. Upload them in this order:

| # | File | Headline |
|---|---|---|
| 1 | `01-today` | YOUR GYM. YOUR FOOD. ONE APP. (with the Australian Made badge) |
| 2 | `02-food-cuisines` | COUNT CALORIES FROM 400+ FOODS |
| 3 | `03-session` | LOG EVERY SET IN SECONDS |
| 4 | `04-program-day` | KNOW EXACTLY WHAT TO LIFT |
| 5 | `05-progress` | WATCH YOUR BODY CHANGE |
| 6 | `06-exercise` | 194 EXERCISES, ANIMATED |
| 7 | `07-records` | SMASH YOUR PERSONAL RECORDS |
| 8 | `08-program-detail` | 12-WEEK PROGRAM WRITTEN FOR YOU |
| 9 | `09-anatomy` | LEARN EVERY MUSCLE |
| 10 | `10-hub` | LEVEL UP AS YOU TRAIN |

To rebuild them: run `npm run dev:ios`, then `node tools/store-media/capture.mjs`, then `node tools/store-media/compose.mjs`.

## App previews: `store/previews/` (886 × 1920, H.264, 30 fps, stereo AAC; real app footage only, per Apple 2.3.4)
1. `ironverse-preview-main.mp4` (23.9 s), with the coolest moments first:
   - the 3D body spinning
   - an animated squat demo
   - plan, then set logging
   - 400+ foods with cuisine flags
   - weight trend, then personal records
   - end card
2. `ironverse-preview-food.mp4` (20.0 s):
   - calorie dashboard
   - cuisines from Australian to Middle Eastern
   - smart targets
   - weekly chart
   - water and supplements
3. `ironverse-preview-train.mp4` (18.1 s):
   - 12-week program
   - a written workout with coaching
   - exercise library
   - deadlift demo
   - levels and trophies
   - anatomy

To rebuild them: run `node tools/store-media/video.mjs main|food|train` (needs ffmpeg).

## Age rating answers
- Violence, sexual content, profanity, horror, gambling, alcohol, tobacco and drugs: **None**.
- Medical or treatment information: **Infrequent**. The app includes calorie, protein and creatine guidance and a "not medical advice" note.
- Health or wellness topics: **Yes**.
- User-generated content shared with other users, messaging or chat: **No**. Feedback goes privately to the developer.
- Unrestricted web access: **No**. In-app purchases: **Yes** (subscriptions). Ads: **No**.

## App privacy ("nutrition label"), from a code audit on 21 Oct 2026
The app has no analytics, ads, crash reporting or tracking SDKs, no server and no accounts.

| Data type | When it leaves the device | Declare as |
|---|---|---|
| Photos | Only with the user's own Anthropic key and consent, for a meal estimate | Photos or Videos · App Functionality · Not linked · No tracking |
| Email address | Only if typed into Suggest & report | Contact Info → Email · Customer Support · Linked to user · No tracking |
| Feedback message and optional screenshot | Only when the user taps Send | User Content → Customer Support · Customer Support · Linked if an email is given · No tracking |
| Device and app version | Sent with feedback | Diagnostics → Other Diagnostic Data · Customer Support · Not linked · No tracking |
| Purchases | Handled entirely by Apple (StoreKit); Ironverse never sees card details | Purchases → Purchase History · App Functionality · Not linked (on-device entitlement check only) |

Everything else stays on the iPhone and is not "collected": workouts, food, body data, location for runs, and backups.

**Encryption:** `ITSAppUsesNonExemptEncryption = NO`. The app uses only Apple's built-in HTTPS and WebCrypto.

## App Review notes
> Ironverse needs no login. On first launch, tap Get started (every question can be skipped), then "Show me around" for a guided tour.
>
> SUBSCRIPTIONS: New installs get every Premium feature free for 7 days. This is an app-side trial with no StoreKit offer. After that the core app stays free, and Pro (monthly com.nouriapps.ironverse.pro.monthly / yearly com.nouriapps.ironverse.pro.yearly) unlocks the 12-week program, advanced progress, barcode scanner, meal-photo estimates, goal coach, photo compare, 3D body and meal plans. The paywall is at More → Ironverse Pro, with Restore Purchases and Terms/Privacy links.
>
> TO TRY: Workout tab → Start this workout → log a set. Food tab → + → pick a cuisine chip (e.g. Thai) → tap + on a dish. Progress tab shows charts after a few entries. More → Suggest & report sends feedback to the developer.
>
> Data is stored on the device. The optional meal-photo feature uses the user's OWN Anthropic API key and asks for consent before sending. Barcode lookups use the public Open Food Facts database. Location is used only while tracking an outdoor run.

## Ideas to grow Ironverse into a top fitness app
These are not built yet; they're ordered by likely impact per effort.
1. **Apple Health sync** (steps, workouts, weight). It's a top-requested feature in fitness reviews. A plan already exists in `docs/HEALTHKIT.md`.
2. **Ask for a rating after a new PR or a finished week**, using Apple's review prompt. Ratings are the biggest App Store ranking factor.
3. **Home-screen widgets and Live Activities** for rest timer, calories left and today's workout. Hevy features these heavily.
4. **Apple Watch** set logging.
5. **Custom Product Pages** in App Store Connect: separate store pages for "calorie counter" and "gym planner" ads, each with its own screenshots.
6. **Localise the listing** (en-GB, en-US, en-CA, en-NZ) with the same text. This adds more searchable keyword slots at no cost.
7. **Launch content:** short TikTok and Reels clips cut from the preview videos; posts in r/fitnessAU, r/GYM and Australian gym Facebook groups; and an offer code for local PTs.
8. **In-app events** on the App Store (for example "New Year 12-week challenge").
