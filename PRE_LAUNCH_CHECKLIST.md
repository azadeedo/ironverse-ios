# Ironverse: pre-launch checklist

23 October 2026. Work through this on your iPhone (and Apple Watch) using the newest TestFlight build. Tick each box. Anything that fails: send a screenshot from More → Suggest & report, or tell me directly.

## What I already checked on the computer
- **199 automated tests** pass: food data, sleep, fasting, recovery score, halal check, programs, Watch sync, saved workouts, backups and pricing.
- **All 43 screens** open with no errors and nothing too wide, for three user types (new, free week ended, Pro), at both normal and iPhone SE size.
- **11 real user flows** work from start to finish: Quick log, start / log / finish a workout, save as template, start a saved workout, add food by cuisine, sleep check-in, fasting, generate a 6-week program, build my own program, weekly review, and backup.
- **The 26-step tour** runs to the end and points at the right thing on every step.
- **Bugs found and fixed:**
  - Weight not updating when a day already had a weigh-in.
  - Dozens of videos autoplaying in the exercise library (a stutter and battery risk).
  - Cropped machine photos.
  - Apple Health "Connecting…" never ending (build 8).

## Part 1: test on your iPhone (about 30 minutes)

### First launch (delete the app first and reinstall from TestFlight)
- [ ] First-time setup: no halal question; every step can be skipped; it finishes properly.
- [ ] The tour shows 26 steps and you can skip it or finish it.
- [ ] Your 7-day free Pro week shows on the Ironverse Pro screen.

### Today
- [ ] **+ Log**: add water, weight and sleep. They all appear straight away.
- [ ] Sleep faces: tap one and the recovery score appears.
- [ ] Gym / Home switch changes the workout.
- [ ] Fold and unfold "This week", "Body & progress" and "Your day".

### Workout
- [ ] Start today's workout, log 3 sets, finish, then tap **Save as template**.
- [ ] Leave the app during a rest: the "Rest over 💪" notification arrives.
- [ ] Exercise pictures are not cropped; the "Show movement diagram" button shows the stick figure.
- [ ] New program (1–16 weeks) and Build my own both work.
- [ ] More → Saved: start the saved workout again.

### Food
- [ ] Add food: tap each cuisine chip (Australian, Middle Eastern, Turkish, Thai…). Each lists dishes.
- [ ] Barcode scan logs a product. The Health scanner gives a score.
- [ ] Settings → Halal mode on: the Health scanner shows the halal check.
- [ ] Fasting: start a fast, and the alert arrives at the goal (test with a short wait or overnight).

### Apple Health and Apple Watch (needs build 8 or later)
- [ ] More → Connected devices → Connect Apple Health: the iOS sheet appears, and it says **Connected**.
- [ ] Steps, sleep and Watch workouts appear after a sync. If not, tap **Show connection log** and send me a screenshot.
- [ ] Watch app on iPhone → Available Apps → install Ironverse.
- [ ] On the Watch: Today shows your numbers; +250 ml shows up on the phone; Done set during a workout ticks the set on the phone.
- [ ] If you have them: connect WHOOP, Oura or a scale using the guide on Connected devices.

### Everything else
- [ ] Progress photos: take one; the transformation card appears after a second photo on another day.
- [ ] Weekly review shows "More from your week".
- [ ] Settings → Privacy → Face ID lock: on, close the app for over a minute, reopen and it asks for Face ID.
- [ ] Long-press the app icon: the 4 quick actions open the right screens.
- [ ] Backup → Export, then Restore on a fresh install: your data comes back.
- [ ] Airplane mode: the app still works (except barcode lookups).
- [ ] Ironverse Pro screen: prices show A$9.99 / A$79.99, and Restore Purchases and the Terms / Privacy links work.

## Part 2: App Store (needs you, about 20 minutes)
1. **Sign in** to App Store Connect in the Chrome window I use, so I can finish the listing.
2. **Your mobile number** (+61 format), which Apple requires for the App Review contact.
3. **Paid Apps Agreement + bank + tax**: confirm it shows **Active** under Business. Subscriptions can't go live without it. Also join the **Small Business Program** (15% instead of 30%).
4. **Decide on coach names** (Chris Bumstead, Jeff Nippard, Arnold, Mike Mentzer, Dorian Yates). Apple can reject apps that use real people's names without permission (guideline 5.2.1). The app says "inspired by… not affiliated or endorsed", which lowers the risk but doesn't remove it. Options: keep the names (some review risk), or switch to style names only for the App Store version.
5. **Approve submission**. I'll then:
   - Answer App Privacy as "Data Not Collected" (Health data never leaves the phone; the feedback form is described).
   - Pick the newest build and attach both subscriptions.
   - Update the description and screenshots for Apple Watch, Apple Health, sleep and fasting.
   - Submit for review, with manual release, so the app only goes live when you say.

## Part 3: features worth adding next (after launch)
| Idea | Why | Size |
|---|---|---|
| Home-screen and Lock-screen widgets (calories left, water, recovery) | Most-asked iPhone feature in fitness apps | Medium |
| Live Activity / Dynamic Island rest timer | Rest timer on the Lock Screen mid-set | Medium |
| Save workouts to Apple Health (Fitness rings) | Strength sessions count toward your rings | Small |
| Siri: "log 500 ml of water" | Hands-free logging | Small–medium |
| Heart rate during workouts on the Watch | Live zones and calories from the wrist | Medium |
| Shareable PR cards and referral codes | Free marketing from users | Small |
| Android version | A second store, same code | Medium–large |
