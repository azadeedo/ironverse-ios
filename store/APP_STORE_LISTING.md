# Ironverse 1.0.0: App Store Connect listing (draft)

Every claim below was checked against the code in this repository on 21 Oct 2026. All owner details were filled in on 21 Oct 2026. The legal pages are live on the separate Netlify site `ironverse-legal` (it is not the app's site).

## App information
| Field | Value |
|---|---|
| Name (max 30) | **Ironverse**. If the name is taken: `Ironverse: Gym & Food Log` |
| Subtitle (max 30) | **Workouts, food and progress** (27) |
| Bundle ID | `com.nouriapps.ironverse` |
| SKU | `ironverse-ios-001` |
| Primary category | Health & Fitness |
| Secondary category | Food & Drink (optional) |
| Price | Free. There are no in-app purchases, no ads and no subscriptions. |
| Version | 1.0.0 |
| Copyright | `2026 Nouri Khalil` |
| Support URL | https://ironverse-legal.netlify.app/support.html |
| Privacy Policy URL | https://ironverse-legal.netlify.app/privacy-policy.html |
| Support email | azade@live.com.au |
| Seller (Individual) | Nouri Khalil |
| Marketing URL (optional) | https://ironverse-legal.netlify.app |

## Promotional text (max 170, can be changed without a new build)
Plan training for the equipment you actually have, log every set, track food and water, and see your progress. No account needed. Your data stays on your iPhone.

## Description (max 4000)
Ironverse is a training and nutrition log built around the equipment you actually have, whether that's a full gym or a home setup.

PLAN
• A training plan built for your gym or your home equipment, from 1 to 7 days a week, that rotates accessory exercises between training blocks.
• The Ironverse 12-week program: 48 individually written workouts with a squat, bench and deadlift focus.
• Swap Gym and Home in one tap. Exercises are replaced with the best option that location has.

TRAIN
• A library of 194 exercises with animated demonstrations, muscle maps and setup tips.
• Log weight, reps and effort for every set, with rest timers, warm-up sets, supersets, and drop, rest-pause, myo and AMRAP sets.
• Target weights you can actually load. The plate calculator only suggests weights you can build with your plates.
• Automatic personal records, estimated one-rep maxes, history and workout replays.
• Cardio: outdoor run and walk tracking with GPS, treadmill runs with pace and splits, and a jump-rope timer.

EAT
• Log food from 302 built-in foods, your own foods and recipes, or by scanning a barcode (product data from Open Food Facts).
• Daily calorie, protein and water targets, with a weekly calorie view and trend-based suggestions you approve.
• Optional meal-photo estimates using your own Anthropic (Claude) API key.
• Halal food filter and Ramadan and prayer-time awareness, all optional.

PROGRESS
• Weight trend, body measurements, strength charts, weekly reviews and progress photos with side-by-side compare.
• An interactive anatomy muscle map with origins, insertions and a quiz.

PRIVATE BY DESIGN
• No account or sign-up.
• Everything is stored on your iPhone and works offline.
• No ads, no analytics and no tracking.
• Full backup and restore to a file you control, with optional encryption and an integrity check.

Ironverse gives general fitness and nutrition guidance, not medical advice. Check with a doctor before starting a new training or diet plan.

## Keywords (max 100 characters, comma-separated, no spaces)
`workout,gym,strength,training,log,calorie,protein,macro,tracker,1rm,plan,lifting,weight,home,barcode`
(100 characters — the limit. The app name and category are not repeated because Apple already indexes them.)

## What's New (1.0.0)
First release of Ironverse for iPhone. If you used the Ironverse web app, export a backup there and choose "restore a backup" on the first screen. All your workouts, food logs and plans come across.

## Age rating questionnaire (Apple's 2025 questionnaire), suggested answers
- Violence, sexual content, profanity, horror, gambling, contests, alcohol, tobacco or drug use: **None**.
  - The halal filter hides alcohol foods. Alcohol is never promoted.
- Medical or treatment information: **Infrequent**.
  - The app gives calorie, protein and creatine-dose guidance, and has a "not medical advice" disclaimer.
- Health or wellness topics: **Yes**. This is a fitness and nutrition app.
- User-generated content shared with others, messaging or chat: **No**.
- Unrestricted web access: **No**. The app has no browser. Its only network calls are Open Food Facts and, optionally, Anthropic.
- In-app purchases or ads: **No**.
- Expected result: a low age band (4+ or 9+). Apple computes the rating from your answers.

## App privacy ("nutrition label")
Based on a code audit:
- No analytics, ads, crash-reporting or tracking SDKs.
- The app has no server and no accounts.

| Data | Leaves the device? | Recommendation |
|---|---|---|
| Workouts, food logs, body data, photos, settings | No. Stored on the device (IndexedDB) and in backup files the user exports themselves. | Not "collected" |
| Barcode number | Yes, to Open Food Facts, only when the user scans an unknown product | A product code is not personal data. No declaration needed. |
| Meal photo | Yes, to Anthropic, **only** if the user adds their own API key, accepts the consent prompt and takes a meal photo | **Declare "Photos or Videos"**, Purpose: App Functionality, Linked to user: No, Tracking: No. This is the conservative choice, because Anthropic may keep API inputs for a limited time under its own policy. |
| Location (GPS run tracker) | No. It stays on the device. | Not collected |

- **Tracking (ATT):** No.
- **Encryption export compliance:** `ITSAppUsesNonExemptEncryption = NO` is set in Info.plist. The app uses only Apple's built-in encryption: HTTPS, and WebCrypto AES-GCM for the user's own backup file.

## App Review notes (paste into "Notes")
> Ironverse needs no login. On first launch, tap Get started and answer the setup questions. Every question can be skipped. Then tap "Show me around" for a tour of the app.
>
> To try the main features: Workout tab → Start this workout → enter weight and reps → tick a set. Food tab → + → search "rice" → add. Progress tab shows charts once a few entries exist.
>
> All data is stored on the device. There are no accounts, servers, ads or analytics.
>
> Optional feature: meal-photo calorie estimates use the user's OWN Anthropic API key, entered in Settings. It is not needed to use the app; food can always be logged manually or by barcode. Before the first photo is sent, the app asks for explicit consent.
>
> Barcode lookups use the public Open Food Facts database. Location is used only while the user tracks an outdoor run or walk.

## Screenshots
- Required: iPhone **6.9-inch** set, 1290 × 2796 (Apple scales them for smaller iPhones). Up to 10 images.
- The real captures from this build are in `store/screenshots/`. They come from the App Store build rendered at the iPhone 6.9-inch size with clearly fictional demo data, and contain no personal data.
- Recommended order: 1 Today dashboard · 2 Workout · 3 Exercise library · 4 Food · 5 Progress · 6 Welcome.
- Before submitting, replace them with screenshots from your own iPhone running the TestFlight build if you prefer a real status bar.

## Hosting plan for the privacy policy and support pages
Apple needs two public URLs. Three options, none of which touch the live Netlify app:
1. **Recommended:** a new, separate Netlify site, for example `ironverse-legal.netlify.app`, containing only `store/privacy-policy.html` and `store/support.html`. It's free and can be deployed with the Netlify CLI you already use, but **only with your OK**.
2. GitHub Pages on the new private repository. This needs a public repository or a paid GitHub plan.
3. Your own domain, if you have one.
