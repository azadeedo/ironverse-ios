# Release checklist: Ironverse iOS 1.0.0

Fill this in for every release candidate. Labels: PASS, FAIL, BLOCKED, NOT TESTED.

## Build
| Check | Status | Evidence |
|---|---|---|
| Unit tests (`npm test`) | PASS | 175/175 on 21 Oct 2026 (commit 2e5add3) |
| iOS bundle check (`npm run verify:ios`) | PASS | no service worker, no keys, bundle id, permission strings |
| Codemagic signed build | PASS (builds 1–3) | Codemagic builds #1–#3 (Xcode 26.6) |
| TestFlight processing | PASS (builds 1–3) | App Store Connect → TestFlight shows "Ready to Submit" |
| Original web app untouched | PASS | hash compare on 21 Oct 2026 |

## Device (owner's iPhone, TestFlight)
| Check | Status |
|---|---|
| Install from TestFlight | PASS (build 1, 21 Oct 2026) |
| First-time setup, tour, finish | NOT TESTED on device (passed in the browser) |
| Restore a web backup (Merge) | NOT TESTED |
| Log a workout, close the app, reopen, data kept | NOT TESTED |
| Food: search, cuisine chips, log | NOT TESTED |
| Barcode scanner (camera permission) | NOT TESTED |
| Progress photos and photo picker | NOT TESTED |
| GPS run (location permission) | NOT TESTED |
| Reminders as local notifications in the background | NOT TESTED |
| Backup export via the share sheet | NOT TESTED |
| 3D anatomy (WebGL) | NOT TESTED |
| Suggest & report from the device | NOT TESTED (endpoint PASS from the desktop) |
| Safe areas, keyboard, small iPhone (SE) | NOT TESTED |
| Offline: airplane mode, the app still works | NOT TESTED |
| Subscriptions | see SUBSCRIPTION_TEST_PLAN.md |

## App Store Connect
| Check | Status |
|---|---|
| Name, subtitle, categories, content rights | DONE |
| Age rating (9+) and medical-device declaration (no) | DONE |
| Screenshots (10, 1206 × 2622) and previews (3) | Screenshots DONE, in order; previews processing at Apple |
| Description, keywords, promo text, URLs, copyright, version 1.0.0 | DONE (saved) |
| Copyright, What's New, review notes, contact | Copyright DONE. What's New: not shown for a first version. Review notes + contact: BLOCKED on the owner's phone number (Apple requires +country format) |
| App Privacy | NOT STARTED: not settable via the API; needs the owner signed in to App Store Connect |
| Build attached, subscriptions attached | Build 3 attached 22 Oct 2026 (API, verified). Subscriptions are Ready to Submit; they are added on the version page at submission time |
| Subscriptions' review screenshots | DONE 22 Oct 2026: store/review/paywall-*.png uploaded, both COMPLETE; both subscriptions READY_TO_SUBMIT |
| Paid Apps Agreement, tax and bank | BLOCKED (owner) |
| Owner approval to submit | NOT GIVEN |
