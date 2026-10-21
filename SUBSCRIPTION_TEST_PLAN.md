# Subscription test plan: Ironverse Pro

- **Products:** `com.nouriapps.ironverse.pro.monthly` and `com.nouriapps.ironverse.pro.yearly`, in group "Ironverse Pro" (22499474).
- **Code:** `src/lib/pro.ts` (tiers, StoreKit through `@capgo/native-purchases`), `src/screens/ProScreen.tsx` (paywall), `src/components/ProGate.tsx` (locks), and `tests/pro.test.ts` (unit tests).

**How the 7-day Premium works (D-004):**
- It is an app-side preview. The clock starts at first launch (setting `pro:trialStart`).
- It does **not** use a StoreKit introductory offer, needs no card, and ends by itself.
- Reinstalling resets the clock, which is acceptable for v1.

**Prerequisites:**
- Paid Apps Agreement active (it isn't yet).
- A Sandbox tester account (App Store Connect → Users and Access → Sandbox) or TestFlight. TestFlight purchases are free and renew faster.
- A build of version 1.0 or later with the subscriptions attached.

| # | Case | Steps | Expected | Status |
|---|---|---|---|---|
| S1 | Fresh install is in the preview | Install, then open Today | "Free Premium week — 7 days left". Every Pro screen opens. | Unit tested; device NOT TESTED |
| S2 | Preview ends to Free | Set the device date to 8 days later and relaunch | The banner says "Free version". Pro screens show the upgrade card. All logs, history and backups are still there. | Unit tested; device NOT TESTED |
| S3 | Free keeps core | In Free, log a workout, food, water and a weigh-in, then export a backup | All of them work | NOT TESTED |
| S4 | Paywall disclosures | More → Ironverse Pro | Both plans with prices, "Save %" on yearly, auto-renew text, Terms and Privacy links, Restore | NOT TESTED (needs products live) |
| S5 | Buy monthly | Subscribe monthly as a sandbox tester | Apple sheet appears, then a "Welcome to Ironverse Pro" toast, and the tier is Pro | BLOCKED (agreement) |
| S6 | Buy yearly | Same steps, yearly plan | Pro | BLOCKED |
| S7 | Restore | Delete the app, reinstall, then Restore purchases | Pro returns, with no charge | BLOCKED |
| S8 | Cancel | Settings → Apple Account → Subscriptions → Cancel, then wait for expiry (sandbox renews every few minutes) | It stays Pro until expiry, then Free. Data is kept. | BLOCKED |
| S9 | Renewal | Leave a sandbox subscription running | Still Pro after each renewal | BLOCKED |
| S10 | Billing retry / grace | Sandbox "billing issue" scenario | `inBillingRetryPeriod` / `inGracePeriod` stay Pro | BLOCKED |
| S11 | Offline while subscribed | Airplane mode, relaunch | Last known entitlement kept (Pro) | Code path exists; NOT TESTED |
| S12 | Upgrade monthly → yearly | Subscribed monthly, buy yearly | Apple handles the proration; one active product | BLOCKED |
| S13 | Refund / revoke | Sandbox refund | `revoked` leads to Free on the next sync | BLOCKED |
| S14 | Web build unaffected | Open the web build | Never gated, no paywall | Unit tested (`tests/pro.test.ts`) |

Record results with the date, device, iOS version and build number. Never mark a case passed without running it.
