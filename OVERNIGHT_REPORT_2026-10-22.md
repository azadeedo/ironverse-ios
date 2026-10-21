# Ironverse: overnight report (22 Oct 2026)

## Summary
The app is **not submitted yet.** Four things only you can do are blocking it (list below; about 20 minutes in total). Everything I could do from here is done and checked.

## Done tonight (each one checked)
| # | What | Status | How I checked |
|---|---|---|---|
| 1 | Monthly Pro price A$12.99 → **A$9.99**. Apple recalculated the other 174 countries (US$5.99). Yearly is still A$79.99. | DONE | The App Store Connect pricing table shows Australia A$9.99 |
| 2 | The app's backup price label is A$9.99, and the yearly plan shows "Save 33%" | DONE (ships in build 4) | 175/175 tests pass |
| 3 | Paywall screenshots for Apple's subscription review (one per plan) | DONE | `store/review/paywall-monthly.png`, `paywall-yearly.png` |
| 4 | Screenshots uploaded to both subscriptions | DONE | Apple API: both screenshots COMPLETE |
| 5 | Both subscriptions moved from *Missing Metadata* to **Ready to Submit** | DONE | Apple API: state READY_TO_SUBMIT |
| 6 | **Build 3 attached** to version 1.0.0 | DONE | Apple API: the version now uses build 3 |
| 7 | New Codemagic job `asc-listing` that makes these listing changes through Apple's API, so the work no longer depends on the App Store Connect website staying signed in | DONE | Run #4: "all steps OK" |
| 8 | Docs updated: decisions log (D-007 done), roadmap, release checklist, metrics, changelog, listing | DONE | Pushed to GitHub (`main`) |

## Not done, and why
| # | What | Status | Why / what's needed |
|---|---|---|---|
| A | App Review notes and contact | **BLOCKED (you)** | Apple won't save them without a **phone number** in +61 format. The notes are already written. |
| B | App Privacy answers ("Data Not Collected" plus the feedback-form details) | **BLOCKED (you)** | Apple's API can't set these, and App Store Connect signed you out in Chrome. I can't enter your Apple password. |
| C | Paid Apps Agreement, bank and tax | **BLOCKED (you)** | App Store Connect → Business. Without it the subscriptions can't be sold or tested, and Apple won't review them. |
| D | Submit for review | **NOT DONE** | A, B and C have to be finished first. If I submitted without them, Apple would refuse the submission or reject the app (a paywall with no working products). |
| E | "What's New" | NOT NEEDED | Apple only shows this from version 1.0.1. |

## Your 20-minute list (in this order)
1. Sign in at appstoreconnect.apple.com in Chrome.
2. **Business** → Paid Apps Agreement → add bank and tax details → accept. Also join the Small Business Program, so Apple takes 15% instead of 30%.
3. Send me your mobile number, or type it yourself under the app's version page → App Review Information.
4. Tell me "signed in". I'll then do App Privacy, add both subscriptions to version 1.0.0, run a final check and submit. Release stays **manual**: once Apple approves, the app goes live only when you say so.

## Your launch plan this week
- **Tomorrow (23 Oct):** Nouri Money
- **24 Oct:** the delivery app
- **25 Oct:** Nouri Invoice

Each one will need the same Apple steps. Your Apple account, agreement and certificates carry over, so steps 1–2 above are only done once.
