# Ironverse — master roadmap (Australia first, target A$10,000 gross MRR)

Brand promise: **Train with purpose. Track every rep. See your progress.**

The status labels used below are DONE, IN PROGRESS, BLOCKED, NOT STARTED and FAILED TESTING. "Verified" means checked in the repo, App Store Connect, Codemagic or the live site on the date shown. Nothing in this file is a forecast of results.

## 0. The current state (audited 21 Oct 2026)
| Area | Fact | Verified |
|---|---|---|
| Original web app | `iron-verse` repo at `7905a90`, live **2.24.0** on ironverse-app.netlify.app. Untouched by the iOS work (all 740 files are hash-identical). | yes |
| iOS repo | `github.com/azadeedo/ironverse-ios` (private), branch `main`. The web base is 2.24.0 and the App Store version is **1.0.0**; Codemagic sets the build number. | yes |
| Bundle ID / team | `com.nouriapps.ironverse` / `4GQLMSC3VS` (Individual: Nouri Khalil) | yes |
| App Store Connect app | Apple ID 6825232233. Name "Ironverse: Gym Workout Planner", subtitle "Calorie Counter & Food Scanner". Version 1.0 is in *Prepare for Submission*. | yes |
| Signing | Apple Distribution certificate and "Ironverse App Store" profile, both expiring 21 Oct 2027. API key "Ironverse ASC key" (App Manager role) is held in Codemagic only. | yes |
| Builds | TestFlight build 1 (installed on the owner's iPhone) and build 2 are *Ready to Submit*. **Build 3** (commit 2e5add3) is *Ready to Submit*, compiled with Xcode 26.6. Codemagic reports "post-processing failed", but that is only its optional TestFlight-submission step; all three builds reached TestFlight. | yes |
| Subscriptions | Group "Ironverse Pro" (22499474): Yearly `com.nouriapps.ironverse.pro.yearly` at **A$79.99**, Monthly `com.nouriapps.ironverse.pro.monthly` at **A$12.99** (pending change to A$9.99). Both are *Prepare for Submission* and have no review screenshot yet. | yes |
| Paid Apps Agreement | **Not signed.** It is still "New" in Business, so no subscription can be sold or sandbox-tested until it is signed. | yes |
| Accounts | **None.** The app has no sign-up or login, so Apple's account-deletion rule (5.1.1(v)) does not apply. Settings → *Erase all data* already exists. | yes |
| Data | Local only (IndexedDB) on the device. Backups have a checksum and an integrity check. There is no server database. | yes |
| Analytics | **None in the app.** No SDKs, no ads, no tracking. | yes |
| Feedback | Suggest & report posts to the Netlify Forms form "feedback" on ironverse-legal and emails the owner. An end-to-end test on 21 Oct 2026 passed. | yes |

## 1. Phase 0 — finish the App Store launch (CRITICAL)
| # | Task | Status | Owner action? |
|---|---|---|---|
| 0.1 | Audit the source, versions, signing and App Store Connect | DONE | — |
| 0.2 | Confirm build 3 finished processing in TestFlight | DONE: build 3 *Ready to Submit*, group Nouri (verified 21 Oct 2026) | — |
| 0.3 | Change monthly Pro from A$12.99 to **A$9.99** (Australian base price; Apple recalculates other storefronts) | NOT STARTED | **Approval needed** (see DECISIONS_AND_APPROVALS.md, D-007) |
| 0.4 | Keep yearly at A$79.99 | DONE | — |
| 0.5 | Update the app's fallback price label and "Save %" maths to match (A$9.99 gives "Save 33%") | NOT STARTED | Follows 0.3 |
| 0.6 | Sign the Paid Apps Agreement, banking, tax (individual tax form) and the EU DSA trader status | BLOCKED | **Owner** |
| 0.7 | Join the App Store Small Business Program (15% commission) | BLOCKED | **Owner** |
| 0.8 | Add a review screenshot of the paywall to each subscription | NOT STARTED | — |
| 0.9 | Version 1.0.0 listing: description, keywords, promo text, URLs, copyright, version 1.0.0, 10 screenshots (1206 × 2622), 3 previews | DONE: saved 21 Oct 2026; Apple is still processing the previews | Approved 21 Oct |
| 0.10 | Version 1.0: copyright, What's New, reviewer notes, contact, attach build 3 and both subscriptions | NOT STARTED | Contact phone from owner |
| 0.11 | App Privacy answers (see store/APP_STORE_LISTING.md) | NOT STARTED | Publishing them is a public statement, so it needs a final OK |
| 0.12 | Subscription tests in sandbox and TestFlight (SUBSCRIPTION_TEST_PLAN.md) | BLOCKED | Needs 0.6 |
| 0.13 | Device test pass on the owner's iPhone (RELEASE_CHECKLIST.md) | IN PROGRESS | Owner testing |
| 0.14 | "Coach programs — CBum & Nippard" uses real people's names (App Review 5.1/5.2 risk) | NOT STARTED | **Decision needed** (D-008) |
| 0.15 | Submit for review | NOT STARTED | **Explicit approval** |
| 0.16 | Release on approval (manual release) | NOT STARTED | **Explicit approval** |

## 2. Product roadmap (Priority A, B, C)
Effort: S is under 1 day, M is 1–3 days, L is 1–2 weeks. Impact figures are hypotheses to test, not promises.

| # | Feature | Current status | Problem solved | Tier | Effort | Hypothesis | Data / privacy | Approval? |
|---|---|---|---|---|---|---|---|---|
| A1 | Workout logging, sets/reps/weights, history, PRs | DONE (shipped) | Core use | Free | — | — | Local only | — |
| A2 | Beginner onboarding and tour | DONE | First-run drop-off | Free | — | — | Local | — |
| A3 | 12-week program | DONE | Structure | Pro | — | Main Pro driver | Local | — |
| A4 | Free/Pro entitlement (7-day preview, StoreKit) | DONE in code, NOT TESTED in sandbox | Monetisation | — | — | — | Apple only | Needs 0.6 |
| A5 | **"Finish your first workout" flow**: a guided first session straight after setup | NOT STARTED | Install → first workout drop | Free | M | +first-workout rate | Local | Yes (UX change) |
| A6 | **App Store review prompt** after a PR or week 1 (SKStoreReviewController) | NOT STARTED | Ratings drive ranking | Free | S | More ratings | None | Yes |
| B1 | Shareable workout card | DONE (share card exists) | Organic reach | Free | — | — | User-initiated share | — |
| B2 | Shareable PR milestone card | NOT STARTED | Organic reach | Free | S | More shares | User-initiated | Yes |
| B3 | Referral links | NOT STARTED | Acquisition | — | M | Lower CAC | Needs a link service; App Store offer codes are the simplest | Yes |
| B4 | Weekly consistency streak (Today) | PARTIAL (streak cards exist) | Retention | Free | S | +D30 retention | Local | — |
| B5 | Plan previews before the paywall | NOT STARTED | Conversion | Free | S | +trial-to-paid | Local | Yes |
| B6 | Contextual Pro prompts (only at a locked feature) | DONE (ProGate) | Respectful conversion | — | — | — | — | — |
| B7 | Apple Health sync (steps, weight, workouts) | NOT STARTED (docs/HEALTHKIT.md) | Big ask in fitness apps | Free | L | Retention and ranking | HealthKit entitlement and privacy label | Yes |
| C1 | Community challenges | NOT STARTED | Engagement | — | L | — | Needs a server and accounts | Yes |
| C2 | PT collaboration tools | NOT STARTED | B2B channel | Pro | L | — | Server and accounts | Yes |
| C3 | AI coaching | PARTIAL (own-key meal photos) | Differentiation | Pro | L | — | Costs and privacy | Yes |
| C4 | Android (Capacitor) | NOT STARTED | Market size | — | M–L | — | Play billing | Yes |

## 3. Measurement (defined before any analytics, see BUSINESS_METRICS.md)
Ironverse has no in-app analytics, by design. The first data sources need no SDK:
- **App Store Connect Analytics:** impressions, product-page views, downloads, sessions and retention, from users who opt in to sharing with developers.
- **App Store Connect Sales and Trends / Subscriptions:** trials, paid subscriptions, renewals, cancellations, refunds and proceeds.
- **Netlify Forms:** Suggest & report counts.

Funnel events inside the app, such as first-workout completion, would need a privacy-preserving, consented counter. That is decision D-009 and is not started.

## 4. 90-day plan (by stage; the calendar slides if App Review delays launch)
| Weeks | Work |
|---|---|
| 1–3 | Phase 0 above, then submit after approval |
| 4–6 | Australian launch (manual release); first users; 4–5 short videos a week (MARKETING_PLAN.md); contact 5 Melbourne PTs; fix early bugs |
| 7–9 | Review the trial-to-paid rate; A5 first-workout flow; A6 review prompt; A$40 Apple Ads test; refresh screenshots based on product-page conversion |
| 10–13 | Double down on the best channel; B2 and B3 referral experiments; calculate real MRR, CAC and churn from App Store Connect; plan the next 90 days |

## 5. Long-term stages (aspirational, not deadlines)
- **Months 4–6:** retention and a repeatable organic channel.
- **Months 7–12:** A$1,000 MRR stretch target.
- **Months 13–24:** A$3,000–A$5,000 MRR.
- **Months 25–36+:** about 1,200–1,300 paying subscribers, roughly A$10,000 gross MRR at a 50/50 monthly/yearly mix (see BUSINESS_METRICS.md for the maths).

## 6. Compliance watch-list (professional advice flagged where needed)
- **Apple:**
  - 3.1.1 and 3.1.2: StoreKit only, with the disclosures already shown in the paywall.
  - 2.3: honest metadata. No "number one" or "cheapest" claims.
  - 5.1.1 and 5.1.2: data and AI consent. Already done.
  - 5.2: third-party names (D-008).
  - 1.4.1: health. The "not medical advice" note is already in the app.
- **Australian Consumer Law:** no misleading price or comparison claims; clear renewal terms. The 7-day preview is labelled "no card, no automatic charge", which is true.
- **Privacy Act / APPs:** no health data leaves the device. Feedback data is described in the privacy policy. Get a privacy professional's review before adding any analytics or accounts.
- **Tax:** Apple remits Australian GST on App Store sales. Income tax, an ABN and registration questions go to an accountant.
- **Creator deals:** paid posts must be disclosed (#ad, AANA Code).
