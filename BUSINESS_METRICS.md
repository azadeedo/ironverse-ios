# Business metrics: definitions and the A$10k MRR maths

**Rule:** show real data only. If a source isn't connected, the value is "Not connected" — never an estimate presented as fact.

## Prices (Australia)
| Plan | Customer price | Ex-GST (÷1.1) | Owner proceeds (15% SBP) | Owner proceeds (30%) | Normalised monthly (gross) |
|---|---|---|---|---|---|
| Monthly (live in App Store Connect since 22 Oct 2026) | A$9.99 | A$9.08 | A$7.72 | A$6.36 | A$9.99 |
| Yearly | A$79.99 | A$72.72 | A$61.81 / yr | A$50.90 / yr | A$6.67 |

**Gross MRR** = (monthly subscribers × A$9.99) + (yearly subscribers × A$79.99 ÷ 12). It counts paid, active subscriptions only. The free preview, refunds and lapsed subscriptions are excluded.

**Path to A$10,000 gross MRR:**
- At a 50/50 mix, the average is (9.99 + 6.67) ÷ 2 = A$8.33 per subscriber, which needs about **1,201** paying subscribers.
- At 70% monthly / 30% yearly, the average is A$8.99, which needs about **1,113** subscribers.
- Owner proceeds at A$10,000 gross: about A$7,730 a month at 15% commission, or about A$6,360 at 30%. Income tax comes after that, so ask an accountant.
- **Cash** is not MRR: a yearly subscriber pays A$79.99 once, up front.

## Funnel definitions (agree before measuring anything)
| Metric | Definition | Source today |
|---|---|---|
| Downloads | First-time downloads | App Store Connect → Analytics (available after launch) |
| Product page conversion | Downloads ÷ unique product-page views | App Store Connect Analytics |
| Activation | Completed first-time setup | Not connected (needs D-009) |
| First workout | First finished workout log | Not connected (D-009) |
| D7 / D30 retention | Active on day 7 / day 30 | App Store Connect Analytics (opted-in users only) |
| Preview → paid | Paid subscriptions started within 14 days of install ÷ installs | Partly derivable from App Store Connect Subscriptions; exact figure needs D-009 |
| Direct paid | Paid without using the preview | Not separable without D-009 |
| Monthly / yearly mix | Active subscriptions by product | App Store Connect → Subscriptions |
| Churn | Cancelled or expired ÷ active at the start of the month | App Store Connect → Subscriptions (Retention) |
| Refunds, billing failures | Apple refund and billing-retry events | App Store Connect Sales and Trends; App Store Server Notifications if set up |
| CAC | Marketing spend ÷ new paying subscribers in the period | Spend log (MARKETING_PLAN.md) plus App Store Connect |
| Feedback | Suggest & report submissions | Netlify Forms (connected) |

## Cohort model
The full spreadsheet with conservative, base and optimistic scenarios at 3/6/12/18/24/36 months is a separate deliverable (Stage F2 in the roadmap). It will use editable assumptions only, never results.
