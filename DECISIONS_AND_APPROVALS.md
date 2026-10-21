# Decisions and approvals log

Each entry records who decided, when, and what was done. Pending items wait for the owner.

| ID | Date | Decision | By | Status |
|---|---|---|---|---|
| D-001 | 21 Oct 2026 | Build the iOS app from an independent copy (`Ironverse-iOS`). The original `iron-verse` and the live PWA are never modified. | Owner brief | Done |
| D-002 | 21 Oct 2026 | Enrol as an **Individual**. The seller name is "Nouri Khalil". | Owner | Done |
| D-003 | 21 Oct 2026 | **No advertising, ever.** The AdMob work was removed the same day. | Owner | Done |
| D-004 | 21 Oct 2026 | Free tier plus Pro. The first 7 days are full Premium as an **app-side, non-renewing preview**: no StoreKit offer, no card, and it ends by itself with no charge. | Owner | Done |
| D-005 | 21 Oct 2026 | The App Store build uses neutral wording; the owner's personal goals and wording appear only in the web build. | Owner | Done |
| D-006 | 21 Oct 2026 | Name "Ironverse: Gym Workout Planner", subtitle "Calorie Counter & Food Scanner". Listing, screenshots and previews were approved for upload. | Owner | Done |
| D-007 | 21 Oct 2026 | **Monthly Pro price: A$12.99 → A$9.99** (Australian base storefront). Yearly stays A$79.99. | Owner request | **Approved 22 Oct 2026; DONE.** Verified in App Store Connect: Australia A$9.99 (US$5.99, Canada C$7.99) |
| D-008 | — | "Coach programs — CBum & Nippard": real people's names in the App Store build (App Review risk). Options: rename to "Pro-style programs" in the iOS build only, or keep. | — | **Awaiting decision** |
| D-009 | — | Any in-app usage measurement (first workout, retention). Options: none (App Store Connect only) or an anonymous, opt-in counter. Needs a privacy review. | — | Not started |
| D-010 | — | Submit 1.0 for App Review | — | **Needs explicit approval** |
| D-011 | — | Release 1.0 (manual release after approval) | — | **Needs explicit approval** |

## D-007 detail: the exact change requested
- **Where:** App Store Connect → Ironverse → Subscriptions → Ironverse Pro → **Ironverse Pro Monthly** (6825262011) → Subscription Prices → *Add pricing / change price*.
- **Change:** base country Australia, from **A$12.99** to **A$9.99**. Apple then recalculates the other 174 storefronts from the A$9.99 base. Result (22 Oct 2026, from Apple's confirm screen): the US moved from US$7.99 to **US$5.99**, Canada from C$9.99 to C$7.99, Austria/Belgium to €6.99.
- **Effect on existing subscribers:** none. The product has never been sold (version 1.0 is unreleased, and the Paid Apps Agreement isn't signed yet). It also isn't a price *increase*, so no consent flow is involved.
- **Owner proceeds estimate:** A$9.99 includes about A$0.91 GST. With the Small Business Program (15%) the owner receives about **A$7.72 a month** per subscriber; at 30% it's about A$6.36.
- **App update:** the fallback label in `src/lib/pro.ts` changes to A$9.99, and the paywall's "Save %" becomes 33% (79.99 ÷ (9.99 × 12)). The live App Store price always overrides the fallback anyway.
