// WHAT'S NEW — a hand-written record of everything that has been added, with
// the path to actually find each thing. Written by reading docs/UPGRADE.md and
// the shipped libraries; nothing here is generated, and nothing is listed that
// isn't in the app.
//
// Rule zero of this project is ADD, NEVER REMOVE — so this list only ever
// grows, and every entry below still works today.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award, Camera, RefreshCw, ChevronRight, ClipboardList, Database, Dumbbell, Gauge,
  HeartPulse, Layers, MoonStar, Repeat, Ruler, Search, Settings2, Sparkles,
  Timer, Type, Undo2, Utensils, Volume2, Wrench,
} from 'lucide-react'
import {
  Badge, Callout, Card, FOCUS_RING, PageHeader, Section, UI_SETTING_KEYS,
} from '@/components/ui'
import { getSetting, setSetting } from '@/db'
import { APP_VERSION } from './settings/lib'
import { ed } from '@/lib/edition'

interface Feature {
  icon: typeof Sparkles
  title: string
  /** what it does, in one or two plain sentences */
  body: string
  /** how to get to it */
  where: string
  to?: string
}

interface Release {
  version: string
  label: string
  date: string
  summary: string
  features: Feature[]
}

const RELEASES: Release[] = [
  {
    version: '2.24.0',
    label: 'Start an activity',
    date: '21 October 2026',
    summary: 'Move today shows calories for each option and a Start button with a live timer. Exercise you do counts against what you still need to burn.',
    features: [
      { icon: HeartPulse, title: 'Over your calories? Burn it back', body: 'When you go over and haven’t burned it yet, a red banner sits at the top of Today: how much you’re over and quick options — brisk walk outside, jog, skipping or your home gym circuit — with the minutes and a Start button. At 10 pm it reminds you (while the app is open). “Not today” hides it.', where: 'Top of Today', to: '/' },
      { icon: HeartPulse, title: 'Start from Move today', body: 'Each option shows its calories (and per 10 min). Tap Start: choose how long and how hard, then a live timer counts minutes and calories. Finish saves it.', where: 'Today → Goal coach', to: '/' },
      { icon: HeartPulse, title: 'Exercise counts', body: 'Exercise you have done today comes off “Move today” and the over-budget card, and Today shows eaten − exercise = net. Your calorie target is not raised to eat it back: watches over-count burn and it would cancel the loss.', where: 'Today and Food', to: '/' },
    ],
  },
  {
    version: '2.23.1',
    label: 'Easier time entry',
    date: '21 October 2026',
    summary: 'Run times and paces can be typed with a dot or just numbers.',
    features: [
      { icon: HeartPulse, title: 'Type times your way', body: 'The time and pace boxes now show the keypad with a dot. 58.30, 5830 or 58:30 all mean 58 min 30 s; 1.02.15 is 1 h 2 min 15 s; 5.51 is a 5:51 pace. It shows what it read under the box.', where: '10 km treadmill run', to: '/cardio?start=tm10' },
    ],
  },
  {
    version: '2.23.0',
    label: '10 km treadmill run',
    date: '21 October 2026',
    summary: 'Log a 10 km treadmill run with everything your watch and the treadmill show — pace per km, calories, heart rate — and beat your best over time.',
    features: [
      { icon: HeartPulse, title: '10 km treadmill run', body: 'Today and Cardio → 10 km treadmill run. Before you start it tells you the speed to set for your target time. Then log the total time, or the pace, or each km, plus heart rate, cadence and the calories your watch says. It shows pace, speed, calories and whether it is a new best, with a chart of your 10 km times.', where: 'Today → Training, or Cardio', to: '/cardio?start=tm10' },
      { icon: HeartPulse, title: 'Run instead of lifting', body: 'Log the run on a program day and it offers to move that day’s workout to Sat, Sun or Mon, or skip it.', where: 'After saving the run', to: '/cardio?start=tm10' },
    ],
  },
  {
    version: '2.22.0',
    label: 'Program restarted',
    date: '21 October 2026',
    summary: 'The 12-week program starts again from week 1 this week (19 October). Missed sessions can be moved to a day off.',
    features: [
      { icon: HeartPulse, title: 'Week 1 starts 20 October', body: 'Week 1 is Tue 20 – Fri 23 Oct and week 12 finishes Fri 8 Jan 2027. Your old plan and every logged workout are kept in History.', where: 'Today → Training', to: '/' },
      { icon: HeartPulse, title: 'Missed a session? Move it', body: 'If you miss a program day, Today shows it with buttons for your days off (Sat, Sun, Mon). Tap one and the workout moves there, keeping its week and exercises — or skip it.', where: 'Today → Training', to: '/' },
    ],
  },
  {
    version: '2.21.1',
    label: 'Update date shown',
    date: '21 October 2026',
    summary: 'The update message when the app opens now shows the date of the latest update as well as the version.',
    features: [
      { icon: HeartPulse, title: 'Version and date on open', body: 'Opening the app shows “Up to date · v2.21.1 · updated 21 Oct 2026” (or “Updated to …” right after an update).', where: 'Every time you open the app', to: '/' },
    ],
  },
  {
    version: '2.21.0',
    label: 'Goal coach + right calories',
    date: '21 October 2026',
    summary: ed('85 kg by 14 January: calories change by themselves every day, weigh-in every morning, walking and at-home ways to burn extra, a 4:00 km plan — and scanned calories fixed.', 'A goal coach for your goal weight, daily weigh-ins, walking and at-home ways to burn extra, a 4:00 km plan — and scanned calories fixed.'),
    features: [
      { icon: HeartPulse, title: 'Goal coach on Today', body: ed('Works out what 85 kg by 14 Jan needs from your 7-day average weight and moves your calories every day — down or up, at most 150 a day, never below 1,500, never faster than 1% of bodyweight a week. Each change shows with Undo. Change the goal or turn it off in Goal settings.', 'Works out what your goal weight needs from your 7-day average weight and can move your calories each day — down or up, at most 150 a day, never below 1,500, never faster than 1% of bodyweight a week. Each change shows with Undo. Set the goal or switch automatic changes on in Goal settings.'), where: 'Today', to: '/' },
      { icon: HeartPulse, title: 'Weigh in every day', body: 'A “Log your weight today” box sits at the top of Today until you do it, and it tells you if you missed yesterday.', where: 'Today', to: '/' },
      { icon: HeartPulse, title: 'Burn it without the gym', body: ed('Walk together with your wife, brisk walk, hills, bike ride, home circuit, skipping, shadow boxing, dancing, yard work — minutes worked out for what you need today (goal + anything you went over + a missed session).', 'Walk together with a partner or friend, brisk walk, hills, bike ride, home circuit, skipping, shadow boxing, dancing, yard work — minutes worked out for what you need today (goal + anything you went over + a missed session).'), where: 'Today and Food', to: '/' },
      { icon: HeartPulse, title: 'Missed the gym?', body: 'Training day and it’s getting late, or you missed yesterday: it tells you exactly what to do instead today.', where: 'Today', to: '/' },
      { icon: HeartPulse, title: '4:00 km plan', body: 'Tracks your best 1 km pace and gives you intervals, tempo, easy run and a time trial every 2 weeks, with your paces worked out.', where: 'Today → Training', to: '/' },
      { icon: HeartPulse, title: 'Scanner calories fixed', body: 'When the food database’s calories are too low for its own protein, carbs and fat (like Yo Pro banana: 71 instead of ~89 for 150 g), the app now recalculates and tells you. Products you scanned before are corrected too.', where: 'Food → Barcode', to: '/food' },
    ],
  },
  {
    version: '2.20.0',
    label: 'Hand-size meal estimate',
    date: '18 October 2026',
    summary: 'Estimate a meal with your hand — free, offline, no key needed.',
    features: [
      { icon: HeartPulse, title: 'Estimate with your hand', body: 'On the photo estimate, open “Estimate with your hand”: count palms of protein, cupped hands of carbs, thumbs of fats and fists of veg. It turns them into calories and macros you can edit before logging — no API key, works offline.', where: 'Food → Scan meal', to: '/food' },
    ],
  },
  {
    version: '2.19.0',
    label: 'Photo key + camera',
    date: '17 October 2026',
    summary: 'Paste your key right where you take the photo, and the scanner stops asking for the camera every time.',
    features: [
      { icon: HeartPulse, title: 'Key box on the photo estimate', body: 'If no Anthropic key is saved, the paste box now appears right under the photo — no trip to Settings. Saving it runs a free “Test key” check that tells you plainly if the key works.', where: 'Food → Scan meal', to: '/food' },
      { icon: HeartPulse, title: 'Camera asked once per visit', body: 'The barcode and health scanners now reuse the camera between scans instead of asking again each time. It switches off after 3 idle minutes or when you leave the app. (iPhone still asks once each time the app is opened fresh — that part is Apple’s rule.)', where: 'Food → Barcode', to: '/food' },
    ],
  },
  {
    version: '2.18.0',
    label: 'Tidier screens',
    date: '16 October 2026',
    summary: 'Today, Food and More are grouped and de-duplicated.',
    features: [
      { icon: HeartPulse, title: 'Today in sections', body: 'Training, Daily habits, Nutrition, Body & progress and Your day each have a heading. When the 12-week program is running, the duplicate workout card folds into “Today’s exercises”.', where: 'Today', to: '/' },
      { icon: HeartPulse, title: 'Food tools grid', body: 'The long list of links is now one grid: Meal planner, Health scanner, Nutrition chart, Fast-food guide, Photo diary, Pill box. The duplicate scan buttons at the top are gone — Scan meal, Barcode and Add food sit in the summary card.', where: 'Food', to: '/food' },
      { icon: HeartPulse, title: 'More, grouped', body: 'All sections are grouped into Training, Body & progress, Food & health and App, with your pinned shortcuts first.', where: 'More', to: '/more' },
    ],
  },
  {
    version: '2.17.0',
    label: 'Share & streaks',
    date: '16 October 2026',
    summary: 'Share a workout card, and keep a weekly training streak alive.',
    features: [
      { icon: HeartPulse, title: 'Share workout card', body: 'After a workout, tap “Share workout card” for an image with duration, volume, sets, PRs and your top set per exercise — send it anywhere from the share sheet. Made on your phone; nothing is uploaded.', where: 'Finish a workout', to: '/workout' },
      { icon: HeartPulse, title: 'Weekly streak', body: 'Today shows how many weeks in a row you have hit your planned workouts, with dots for this week.', where: 'Today', to: '/' },
    ],
  },
  {
    version: '2.16.0',
    label: 'Photo estimate fixed + smarter next block',
    date: '15 October 2026',
    summary: 'Photo calorie estimates work again on the current Claude model; the next 12-week block decides exercise by exercise.',
    features: [
      { icon: HeartPulse, title: 'Photo calorie estimate fixed', body: 'The photo estimate used an old request style (a pre-filled reply) that current Claude models reject, so every photo failed with “Anthropic rejected that photo”. It now uses the official Anthropic SDK and the current model (Claude Opus 5.5), with a guaranteed JSON answer, and shows the real reason if anything ever fails. Uses the API key you saved in Settings — nothing was ever blocked.', where: 'Food → Photo of meal', to: '/food' },
      { icon: HeartPulse, title: 'Next block, exercise by exercise', body: 'When 12 weeks finish, every exercise gets a decision: Harder now (you passed a milestone — e.g. assisted pull-up → pull-up, leg press → hack squat), Keep (main lifts and anything still progressing), Fresh angle (stalled → a same-muscle option that trains the stretched position, like seated leg curl or overhead triceps), New rep range (stalled, no better swap), or Easier on the joints (if you flagged it as hurting). Each says why and what research it rests on; untick anything.', where: 'Program → 12 weeks complete', to: '/program' },
    ],
  },
  {
    version: '2.15.0',
    label: 'Joined-up progress',
    date: '15 October 2026',
    summary: 'Drinks count toward food, muscles show your tape and photos, nutrition insights, next block evolves, compare photos by body region.',
    features: [
      { icon: HeartPulse, title: 'Drinks with calories go into food', body: ed('Saved drinks can have calories and protein. Tap one on the Water screen and it counts toward water AND appears in your food log (undo removes both). Monster Ultra Peachy Keen is already saved.', 'Saved drinks can have calories and protein. Tap one on the Water screen and it counts toward water AND appears in your food log (undo removes both).'), where: 'More → Water', to: '/hydration' },
      { icon: HeartPulse, title: 'Muscle growth in one place', body: 'Tap a muscle in Body anatomy to see training sets, your tape measurement trend for that body part, and links to measurements and photo comparison.', where: 'More → Body anatomy', to: '/anatomy' },
      { icon: HeartPulse, title: 'Nutrition insights', body: 'From your last 4 weeks: weekends vs weekdays, protein target hit rate, meals light on protein, late-night eating, top calorie sources, fibre, and half-logged days.', where: 'Food → Nutrition chart', to: '/nutrition-week' },
      { icon: HeartPulse, title: 'Next block evolves', body: 'When the 12 weeks finish, accessories that stalled (under 2% gain) are swapped for a same-muscle alternative in the next block. Main lifts stay; untick any swap.', where: 'Program → 12 weeks complete', to: '/program' },
      { icon: HeartPulse, title: 'Compare photos by region', body: 'Zoom both photos to Shoulders & arms, Chest, Abs & waist, Legs or Calves — works with wipe, side-by-side and ghost.', where: 'Photos → Compare', to: '/photos' },
    ],
  },
  {
    version: '2.14.0',
    label: 'Pill box',
    date: '14 October 2026',
    summary: 'A virtual 7-day pill box like yours — what goes in which compartment, what’s left, when to reorder, what missing one means.',
    features: [
      { icon: HeartPulse, title: 'Virtual pill box', body: 'SUN–SAT × Morning / Noon / Evening / Bed, pre-filled with the supplements on your shelf. Training-day items (electrolytes, pre-training L-carnitine) only go in on your gym days (Tue–Fri). Tick what you took; creatine also counts in the creatine log.', where: 'More → Pill box', to: '/pill-box' },
      { icon: HeartPulse, title: 'Fill it', body: 'How many of each to take out for the week, and row by row which compartments get what.', where: 'More → Pill box → Fill it', to: '/pill-box' },
      { icon: HeartPulse, title: 'Stock & reorder', body: 'Enter how many are left — it counts down each day, shows when you run out and the date to order by (with your delivery time), and sorts urgent from not urgent.', where: 'More → Pill box → Stock', to: '/pill-box' },
      { icon: HeartPulse, title: 'Missed-dose insights', body: 'Miss one day and it tells you it’s no big deal; miss several in a row and it explains what the research says that does (e.g. creatine stores fade over 4–6 weeks). Plus evidence-based suggestions, like protein powder when you’re short on protein, or fibre gummies on low-fibre days.', where: 'More → Pill box → Insights', to: '/pill-box' },
    ],
  },
  {
    version: '2.13.0',
    label: 'Smarter gym + health scanner',
    date: '14 October 2026',
    summary: 'Health scanner out of 100, rest that adapts to each set, weights that go down as well as up, setup guides, your real plates, fast-food guide.',
    features: [
      { icon: HeartPulse, title: 'Health scanner (score out of 100)', body: 'Separate from the calorie logger. Scan a barcode and get a score with negatives and positives, every additive explained with its risk level and why (EFSA, IARC, published studies), sugar/fat/salt traffic lights, allergens, ultra-processing, and healthier options in the same aisle.', where: 'Food → Health scanner', to: '/health-scan' },
      { icon: HeartPulse, title: 'Rest that fits the set', body: 'Rest now depends on what you just did — reps, how hard it was, how heavy compared with your best today, and whether it was a big leg lift. The reason shows under the exercise.', where: 'Workout', to: '/workout' },
      { icon: HeartPulse, title: 'Weights adapt both ways', body: 'Hit the top of your reps on every set and the weight goes up. Miss the bottom of the range two sessions running and it now comes down one real step, then builds back.', where: 'Workout → next targets', to: '/workout' },
      { icon: HeartPulse, title: 'Setup guide + your seat numbers', body: 'Tap ⚙️ Setup on any exercise: bench angle (incline dumbbell press = 30°), seat height, pads, pulley position — and save your own settings like “seat 4”.', where: 'Workout → exercise', to: '/workout' },
      { icon: HeartPulse, title: 'Your gym’s plates', body: 'Plates are now 5, 10, 15 and 20 kg only (no 2.5s or 25s). Every barbell weight is buildable and each side is shown as coloured plates.', where: 'Workout', to: '/workout' },
      { icon: HeartPulse, title: 'Pound machines in 10s', body: 'In the weight sheet, “This machine’s weights” has one-tap presets like “lb · goes up in 10s”. Suggestions then only use those numbers.', where: 'Workout → tap a weight', to: '/workout' },
      { icon: HeartPulse, title: 'Supersets too far apart', body: 'Tap “Machines too far apart” in a superset and those two are never paired again — straight sets instead.', where: 'Workout → superset', to: '/workout' },
      { icon: HeartPulse, title: 'Drop sets where they help', body: 'On the last set of machine, cable and dumbbell isolation lifts you get a one-tap drop-set suggestion.', where: 'Workout', to: '/workout' },
      { icon: HeartPulse, title: ed('Fast-food guide + Monster', 'Fast-food guide'), body: ed('What to order and what to take out at Maccas, KFC, Subway, GYG, Nando’s and more, with a swaps calculator. Monster Ultra Peachy Keen (12 kcal) is pinned at the top of your favourites.', 'What to order and what to take out at Maccas, KFC, Subway, GYG, Nando’s and more, with a swaps calculator.'), where: 'Food', to: '/fast-food' },
    ],
  },
  {
    version: '2.12.0',
    label: 'Easier food edits',
    date: '13 October 2026',
    summary: 'Portion buttons, nutrient details, copy or move an entry, training days on the nutrition chart, one Backup centre.',
    features: [
      { icon: HeartPulse, title: 'Portion buttons', body: 'Editing a food now has ½×, 1×, 1.5× and 2× buttons, plus the food’s own serves (e.g. 1 slice, 2 slices) — calories and macros update as you tap.', where: 'Food → tap an entry', to: '/food' },
      { icon: HeartPulse, title: 'Nutrient details', body: 'Fibre, sugar, saturated fat and sodium for the amount you ate, whenever the food has them.', where: 'Food → tap an entry', to: '/food' },
      { icon: HeartPulse, title: 'Copy or move an entry', body: 'Pick a date and Copy (e.g. same breakfast tomorrow) or Move (logged on the wrong day). Undo is offered.', where: 'Food → tap an entry', to: '/food' },
      { icon: HeartPulse, title: 'Training days on the nutrition chart', body: 'Blue dots mark days you trained, and a card compares calories and protein on training days against rest days.', where: 'Food → Nutrition chart', to: '/nutrition-week' },
      { icon: HeartPulse, title: 'One Backup centre', body: 'Settings → Data now leads to the Backup centre (encrypted backup, snapshots, restore with a review first). Quick Export stays in Settings.', where: 'Settings → Data', to: '/backup' },
    ],
  },
  {
    version: '2.11.0',
    label: 'Food insights',
    date: '13 October 2026',
    summary: 'Nutrition chart, food photo diary, weigh-in notes on the chart, barcode match check.',
    features: [
      { icon: HeartPulse, title: 'Nutrition chart', body: 'Pick 7, 14 or 30 days: calories against each day’s real target (green under, red over by 5%+), tap a day for its numbers, average protein against your target and where your calories came from. Days with nothing logged are left out of the averages.', where: 'Food → Nutrition chart', to: '/nutrition-week' },
      { icon: HeartPulse, title: 'Food photo diary', body: 'Every meal photo from the last 90 days in a grid by day, with that day’s calories. Tap one for the entry and its macros, or jump to that day.', where: 'Food → Food photo diary', to: '/food-photos' },
      { icon: HeartPulse, title: 'Weigh-in notes on the chart', body: 'Notes like “salty meal” or “poor sleep” now show as blue flags on your weight trend — tap one to read it.', where: 'Progress → Body', to: '/progress' },
      { icon: HeartPulse, title: 'Barcode match check', body: 'Each scanned product shows ✓ Good match, Check numbers or ⚠ Check the label, depending on whether its calories agree with its macros.', where: 'Food → Scan barcode', to: '/food' },
    ],
  },
  {
    version: '2.10.0',
    label: 'Real 3D body',
    date: '13 October 2026',
    summary: 'A real 3D anatomy model — the actual segmented muscles, skeleton and skin from BodyParts3D.',
    features: [
      { icon: HeartPulse, title: 'Real 3D model', body: 'Body anatomy now has a “Real 3D model” switch: the real segmented muscles, full skeleton and skin of the BodyParts3D human model (Database Center for Life Science, CC BY-SA). Drag to rotate, pinch to zoom, two fingers to move. Turn Skin, Muscles and Skeleton on or off, tap any muscle for its anatomy and your training, and use “My training” to colour the 3D muscles by this week’s sets. Downloads once (about 4 MB) and then works offline.', where: 'More → Body anatomy → Real 3D model', to: '/anatomy' },
      { icon: HeartPulse, title: 'Deeper muscles', body: 'Rhomboids, supraspinatus and levator scapulae are now in the model too (under the trapezius) — find them with search.', where: 'More → Body anatomy', to: '/anatomy' },
    ],
  },
  {
    version: '2.9.0',
    label: 'Real anatomy',
    date: '13 October 2026',
    summary: 'The body map is now drawn from real anatomy — 45 named muscles, front and back.',
    features: [
      { icon: HeartPulse, title: 'Real muscle anatomy', body: 'The capsule figure is gone. Each muscle is drawn separately with its fibre direction and shading — pectoralis major (upper and sternal), all three deltoid heads, biceps, brachialis, triceps heads, forearm flexors and extensors, serratus, obliques, rectus abdominis, trapezius, lats, teres major, infraspinatus, erector spinae, glute max and medius, the four quads, sartorius, adductors, hamstrings, gastrocnemius, soleus, tibialis anterior and more. Tap one for its origin, insertion, action and nerve (from Gray’s Anatomy and OpenStax A&P).', where: 'More → Body anatomy', to: '/anatomy' },
      { icon: HeartPulse, title: 'Turn, zoom, find, quiz', body: 'Turn the body around, pinch or double-tap to zoom, search any muscle by name, and “Quiz me” to learn where each one is. “My training this week” colours every real muscle by your hard sets.', where: 'More → Body anatomy', to: '/anatomy' },
    ],
  },
  {
    version: '2.8.0',
    label: '3D body',
    date: '13 October 2026',
    summary: 'A rotatable 3D figure — tap any muscle.',
    features: [
      { icon: HeartPulse, title: '3D body', body: 'Drag to rotate, pinch to zoom, Front / Side / Back buttons. Tap a muscle to see what it does, this week’s hard sets, when you last trained it, the exercises that hit it and your tape measurement for that body part. Colours show this week’s sets (10–20 is the sweet spot). It is a stylised model to find muscles quickly, not a scan of your body.', where: 'More → 3D body, or Progress hub → Muscles', to: '/anatomy' },
    ],
  },
  {
    version: '2.7.0',
    label: 'Update status every time you open',
    date: '13 October 2026',
    summary: 'You always know you are on the latest version.',
    features: [
      { icon: RefreshCw, title: 'Update status on launch', body: 'Every time Ironverse opens, a small pill at the top shows “✓ Up to date · version”, or “Update ready” with an Update now button that stays until you press it. After updating it confirms “Updated to vX”. Your data is never touched by an update.', where: 'Top of the screen when the app opens', to: '/more' },
    ],
  },
  {
    version: '2.6.0',
    label: 'Smarter reminders, food data labels',
    date: '13 October 2026',
    summary: 'Less nagging, clearer numbers.',
    features: [
      { icon: Timer, title: 'Reminders skip what you have done', body: 'Water reminders stop once you hit your water target, the creatine reminder stops once it is ticked, and the workout reminder stops once today’s workout is finished — checked again at the moment each reminder would ring.', where: 'Water & Creatine → reminders', to: '/hydration' },
      { icon: Utensils, title: 'Where the numbers came from', body: 'Every food entry now says if it is from a label (barcode), the food database, your recipe, a saved food, a quick add or a photo estimate (≈), so estimates are never mistaken for exact data.', where: 'Food tab, under each item', to: '/food' },
    ],
  },
  {
    version: '2.5.0',
    label: 'Barcode camera fixed, better progress photos',
    date: '12 October 2026',
    summary: 'Scanning with the camera now actually reads barcodes on iPhone, and progress photos are organised for real comparisons.',
    features: [
      { icon: Camera, title: 'Barcode scanning fixed on iPhone', body: 'The iPhone barcode reader was being given the camera picture in the wrong format, so it almost never found a barcode and you had to type the number. Fixed and tested on a real EAN-13 barcode image — point the camera (or take a photo) and it reads it.', where: 'Food → Barcode', to: '/food' },
      { icon: Camera, title: 'Progress photo categories', body: 'Front, side left/right, back, front/back flexed, arms, abs/waist and legs — plus conditions like morning, fasted or after workout, remembered for next time so every check-in is taken the same way.', where: 'More → Progress photos → Add', to: '/photos' },
      { icon: Repeat, title: 'Check-ins and easy compare', body: 'Check-ins shows each day as a front/side/back set. Compare now has First vs latest, 4 weeks ago and 12 weeks ago shortcuts, and Wipe, Side by side or Ghost overlay views. Pick a weekly photo day and the app reminds you on the photos page.', where: 'Progress photos → Check-ins / Compare', to: '/photos' },
    ],
  },
  {
    version: '2.4.0',
    label: 'New Food dashboard, fast Log meal, athlete profile',
    date: '12 October 2026',
    summary: 'Built from the design references you sent — same data, faster and more visual.',
    features: [
      { icon: Utensils, title: 'Food dashboard', body: 'A big calorie ring with what is left, carbs/fat/protein bars against your targets, protein still to go, and Scan meal / Barcode / Add food buttons right on the card.', where: 'Food tab, top', to: '/food' },
      { icon: Search, title: 'Log meal in a couple of taps', body: 'The yellow + now opens Log meal: search, Breakfast/Lunch/Dinner/Snack chips, Recent (same portion as last time), starred Favourites and every food with a one-tap +. Tap a food to change the grams. “More options” opens the full Add food sheet (recipes, custom food, quick calories, photo).', where: 'Food tab → yellow +', to: '/food' },
      { icon: Award, title: 'Athlete profile', body: 'Your photo (kept on this phone), level and XP, goal progress, program week and real records on the More tab.', where: 'More tab, top', to: '/more' },
      { icon: Layers, title: 'Body map: volume, recovery, frequency', body: 'See what share of your hard sets each muscle group gets, with a plain suggestion when a group looks undertrained.', where: 'Progress hub → Muscles', to: '/hub' },
      { icon: Dumbbell, title: '“Last time” on every set', body: 'During a workout each set shows what you did on the same set last session.', where: 'Inside a workout', to: '/workout' },
      { icon: Settings2, title: 'Customise More + quick actions in Search', body: 'Pin or hide More shortcuts (hidden ones stay one tap away). Search now opens with quick actions: Start workout, Add food, Log weight, Water and more.', where: 'More → Customise; Search', to: '/search' },
    ],
  },
  {
    version: '2.3.0',
    label: 'Meal planner and a weekly glance',
    date: '12 October 2026',
    summary: 'Plan meals for the week and see the last 7 days at a glance on Today.',
    features: [
      { icon: Utensils, title: '7-day meal planner', body: 'Plan breakfast, lunch, dinner and snacks for the next 7 days from your own foods, with calories and protein against your target. Planned food never counts as eaten — tap “Log this meal” (and confirm) once you have had it. Copy a day to the next with one tap.', where: 'Food tab → Meal planner', to: '/meal-plan' },
      { icon: Gauge, title: 'Last 7 days card', body: 'Workouts done vs planned, average calories, days you hit protein and the change in weekly weight average, plus one honest line about what to do next. Tap it for the full weekly review.', where: 'Today tab', to: '/' },
    ],
  },
  {
    version: '2.2.0',
    label: 'Work clashes, burn-back choice, what fits now',
    date: '12 October 2026',
    summary: 'Move a workout when work gets in the way, burn back a big day if you want to, and quick picks that fit what is left.',
    features: [
      { icon: Dumbbell, title: 'Move a workout to another day', body: 'Working on a gym day? On the Workout tab tap “Move this workout” and pick a free day. The workout keeps its week and exercises, the original day becomes a rest day, and you can put it back any time.', where: 'Workout tab, under today’s workout', to: '/workout' },
      { icon: Utensils, title: 'Burn it back — your choice', body: 'When you go well over, “Leave it” is still there, but “Burn it back” always shows every cardio option with the minutes. Long ones can be split over 2–3 days as planned cardio.', where: 'Food tab, when you are over target', to: '/food' },
      { icon: Sparkles, title: 'What fits now', body: 'Foods and recipes you have actually logged before, ranked by protein for the calories you have left — never over. One tap logs the same portion again. Idea taken from Bitebro’s “smarter pick”.', where: 'Food tab', to: '/food' },
    ],
  },
  {
    version: '2.1.0',
    label: 'Progression pathways',
    date: '9 October 2026',
    summary: 'Step-by-step pathways checked against the sets you actually logged.',
    features: [
      { icon: Dumbbell, title: 'Progression pathways', body: 'Pull-up (pulldown → assisted → pull-up → weighted), push-up, dip, squat and hanging-core pathways. Each step has a clear milestone such as 3 × 8 in one session; the app ticks it off from your real sets, shows your best attempt so far and where you are now. Nothing in your plan changes unless you swap the exercise yourself.', where: 'Open any of those exercises', to: '/exercises' },
    ],
  },
  {
    version: '2.0.0',
    label: 'Four-app upgrade — Ironverse 2.0',
    date: '9 October 2026',
    summary: 'Real version numbers and safe updates, honest calorie proposals, records and plateau help, and gym tools. Nothing was removed.',
    features: [
      { icon: Settings2, title: 'Version, build and Check for updates', body: 'More shows the exact version, build id and release date. Check for updates compares with the live app; when a new version is ready you get an Update now / Later banner instead of a silent reload — unsaved work is never thrown away.', where: 'More → bottom of the page', to: '/more' },
      { icon: Utensils, title: 'Calorie centre with proposals and undo', body: 'Your target never changes on its own any more. When weekly averages say it should, you get a proposal with the evidence — Accept, Dismiss, or set it by hand. Every change is in the history with Undo. The old 1850 → 1750 automatic drop was turned into a proposal for you to decide.', where: 'More → Calorie centre', to: '/calories' },
      { icon: Award, title: 'Exercise records, charts and forecasts', body: 'Heaviest lift, best working set, rep records, since-first and since-last comparisons, 4/8/12-week charts, a strength forecast range with a confidence label, and plateau detection that needs several sessions — not one bad day.', where: 'Open any exercise', to: '/exercises' },
      { icon: Gauge, title: 'Progress hub', body: 'Training calendar, trophies linked to the workout that earned them, XP, athlete profile, muscle recovery estimates, cycle summaries and challenges.', where: 'More → Progress hub', to: '/hub' },
      { icon: Repeat, title: 'Workout replay', body: 'Open any past workout read-only with rest times between sets, or copy it into a new session.', where: 'History → a day → Replay', to: '/history' },
      { icon: Dumbbell, title: 'Trial loads and gym mode', body: 'New exercises start at a conservative trial weight from your bodyweight instead of empty. In a workout, Swap now lets you mark a machine busy (clears tomorrow) or not working, and sorts swaps that are free first.', where: 'Workout → swap icon', to: undefined },
      { icon: Wrench, title: 'Plate calculator for any plates', body: 'Custom bar, collars and plates in kg or lb, weight → plates and plates → total. Barbell days show the plate picture.', where: 'More → Tools', to: '/tools' },
      { icon: HeartPulse, title: 'Apple Watch summary (manual)', body: 'Type the numbers from your watch’s workout summary and attach a screenshot — linked to that workout and labelled as watch estimates. Automatic Apple Health sync is not possible in a web app, and the app says so.', where: 'After a workout, or History → Replay', to: '/devices' },
      { icon: Database, title: 'Encrypted backups', body: 'Download a backup locked with your own passphrase (AES-256, made on the phone). Restoring asks for the passphrase.', where: 'More → Backup', to: '/backup' },
      { icon: Utensils, title: 'Protein spread, kinder over-target help, notes', body: 'Protein per meal against a ~0.3 g/kg line, “Leave it” first when you go over (cardio ideas capped at 45 min), weigh-in notes like “salty meal”, and saved water bottles/drinks.', where: 'Food, Progress → Body, Water', to: '/food' },
    ],
  },
  {
    version: '4',
    label: 'App-wide polish',
    date: 'September 2026',
    summary: 'Ten things that make the whole app easier to live in. Nothing was removed to fit them.',
    features: [
      {
        icon: Search,
        title: 'Global search',
        body: 'One box across every exercise, every food, every session you have logged, your recipes and every settings page. Results are grouped, and it all runs offline out of the local database.',
        where: 'More → Search, or the search tile at the top of More',
        to: '/search',
      },
      {
        icon: Award,
        title: 'Achievements',
        body: 'Milestones worked out from your real log — training streaks, total volume moved, bodyweight movement, first time hitting a rep or load target. Each one states exactly what earned it and when.',
        where: 'More → Achievements',
        to: '/achievements',
      },
      {
        icon: Gauge,
        title: 'Weekly insight card',
        body: 'A short, honest read on the last 7 days across training, food and weight: what went well, what slipped, and one concrete suggestion. If there is too little logged to say something true, it says that instead of guessing.',
        where: 'Top of the More screen',
        to: '/more',
      },
      {
        icon: Undo2,
        title: 'Undo',
        body: 'Deleting a food entry, a set or a log now offers an Undo on the toast for a few seconds, and puts the row back exactly as it was.',
        where: 'Appears automatically after anything destructive',
      },
      {
        icon: Settings2,
        title: 'Settings search',
        body: 'A filter box at the top of Settings. Type "halal", "stack", "backup" and it jumps straight to that section and highlights it.',
        where: 'Settings → the box under the title',
        to: '/settings',
      },
      {
        icon: Sparkles,
        title: 'Quick actions on More',
        body: 'A grid for the four things you do most: log today’s weight, start today’s session, add food, take a progress photo.',
        where: 'More, under the profile card',
        to: '/more',
      },
      {
        icon: Volume2,
        title: 'Haptics and sound',
        body: 'Opt in per category — set completed, buttons, rest timer, personal records. Everything is off except a light tap when you tick a set off, and it stays silent on devices with no vibration motor.',
        where: 'Settings → Haptics & sound',
        to: '/settings?s=feedback',
      },
      {
        icon: Type,
        title: 'Text size',
        body: 'Five steps from compact to largest, scaling the whole app rather than one screen.',
        where: 'Settings → Display',
        to: '/settings?s=display',
      },
      {
        icon: Database,
        title: 'App health and storage',
        body: 'How much space the database is using, rows in every table, when the last backup and last snapshot happened, and a plain warning when an export is overdue.',
        where: 'Settings → App health & storage',
        to: '/settings?s=health',
      },
      {
        icon: Layers,
        title: 'This screen',
        body: 'So new features stop hiding. Everything ever added is listed here with the path to find it.',
        where: 'More → What’s new',
        to: '/whats-new',
      },
    ],
  },
  {
    version: '3',
    label: 'The workout makeover',
    date: '14 September 2026',
    summary: 'Switching gyms used to change nothing. Now the app asks what the best way to train each movement is with the kit in that room.',
    features: [
      {
        icon: Wrench,
        title: 'Location-aware exercise selection',
        body: 'Each slot in a session is re-picked for the room you are actually in — upgrading at a full gym, degrading gracefully at home, always with a stated reason for the swap. A compound is never replaced by an isolation.',
        where: 'Workout → switch equipment profile',
        to: '/workout',
      },
      {
        icon: Dumbbell,
        title: 'Exercise quality model',
        body: 'Every exercise carries a movement pattern and a tier: how well it loads the muscle in a lengthened position, whether you can take it near failure safely, how honest the resistance profile is.',
        where: 'Exercise library → any exercise',
        to: '/exercises',
      },
      {
        icon: Repeat,
        title: 'Supersets',
        body: 'Antagonist pairing with a time model, so a superset actually shortens the session. It never pairs two heavy compounds.',
        where: 'Inside a session',
      },
      {
        icon: Timer,
        title: 'Set modes',
        body: 'Drop sets, rest-pause, myo-reps, clusters, AMRAP and timed sets, logged properly rather than crammed into a note.',
        where: 'Inside a session, per exercise',
      },
      {
        icon: Gauge,
        title: 'Progression and readiness',
        body: 'Next-session targets, plateau detection, staleness checks, and an adjustment for how the session actually felt.',
        where: 'Workout and Progress',
        to: '/progress',
      },
      {
        icon: Ruler,
        title: 'Volume landmarks',
        body: 'Planned weekly volume per muscle against sensible landmarks, weak-point detection and a recovery status.',
        where: 'Progress → volume',
        to: '/progress',
      },
    ],
  },
  {
    version: '2',
    label: 'Food, faith and safety nets',
    date: 'September 2026',
    summary: 'Everything here was added without touching a single existing row — the same real data you started with.',
    features: [
      {
        icon: Database,
        title: 'Backup, restore and daily snapshots',
        body: 'Export the whole database as one JSON file (photos included), inspect a backup before writing it, merge or replace, and an automatic local snapshot once a day. A restore always snapshots first, so even a mistaken restore is reversible.',
        where: 'More → Backup',
        to: '/backup',
      },
      {
        icon: Utensils,
        title: 'Halal mode and kilojoules',
        body: 'Pork and alcohol hidden from food search, gelatine and anything unclear flagged with a "check the label" note rather than a confident claim. Energy can display as calories, kilojoules or both — Australian packets are in kJ.',
        where: 'Settings → Food & energy',
        to: '/settings?s=food-energy',
      },
      {
        icon: MoonStar,
        title: 'Ramadan mode and prayer times',
        body: 'Shifted eating and training windows around suhoor and iftar, an optional maintenance-volume block while fasting, and session scheduling that keeps a buffer clear around each prayer.',
        where: 'Settings → Ramadan, Settings → Prayer times',
        to: '/settings?s=ramadan',
      },
      {
        icon: Camera,
        title: 'Progress photos',
        body: 'Front, side and back shots stored on the device and compared side by side. They never leave the phone.',
        where: 'More → Progress photos',
        to: '/photos',
      },
      {
        icon: ClipboardList,
        title: 'Coach programs',
        body: 'CBum and Nippard blocks you can run as 4, 8 or 12 weeks, applied as day or week overrides without overwriting your saved plan.',
        where: 'More → Coach programs',
        to: '/programs',
      },
      {
        icon: Gauge,
        title: 'Adaptive calorie target',
        body: 'Learns your real maintenance from logged intake against actual weight change, instead of trusting a formula. Optional, and clearly labelled as an estimate.',
        where: 'Settings → Calorie target',
        to: '/settings?s=calorie-target',
      },
      {
        icon: Layers,
        title: 'Equipment profiles',
        body: ed('Home and Flex 24/7 kept separately, with their own bars, plates, dumbbells and stack steps. Every suggested load stays buildable from the profile you are on.', 'Home and Gym kept separately, with their own bars, plates, dumbbells and stack steps. Every suggested load stays buildable from the profile you are on.'),
        where: 'Workout → equipment profile',
        to: '/workout',
      },
      {
        icon: Utensils,
        title: 'Recipes, barcodes and photo estimates',
        body: 'Saved meals you log in one tap, barcode lookup with a local cache, and an optional AI estimate from a meal photo. The two online features fail with a clear message rather than a spinner that never ends.',
        where: 'Food',
        to: '/food',
      },
      {
        icon: Gauge,
        title: 'Weekly review',
        body: 'A proper look back at the week rather than a single number.',
        where: 'More → Weekly review',
        to: '/review',
      },
    ],
  },
  {
    version: '1',
    label: 'The foundation',
    date: 'Original build',
    summary: 'The core app, all of it still here.',
    features: [
      {
        icon: Dumbbell,
        title: 'Plan, workout and session logging',
        body: 'A generated plan across weeks, a workout screen for the day, and a session screen built for logging sets with sweaty hands — big targets, a floating rest timer that survives navigation, and plate maths that only suggests loads you can actually build.',
        where: 'Workout',
        to: '/workout',
      },
      {
        icon: Utensils,
        title: 'Food and macro tracking',
        body: 'An Australian, Middle Eastern and halal-friendly seed food list, custom foods, and per-meal logging against calorie and protein targets.',
        where: 'Food',
        to: '/food',
      },
      {
        icon: Ruler,
        title: 'Progress, weigh-ins and PRs',
        body: 'Weight trend, measurements, estimated 1RM per lift and a personal-record history.',
        where: 'Progress',
        to: '/progress',
      },
      {
        icon: HeartPulse,
        title: 'Cardio, water and creatine',
        body: 'Runs, walks and rope sessions with calorie estimates, plus hydration and creatine logging with interval reminders.',
        where: 'More → Cardio, More → Water & Creatine',
        to: '/cardio',
      },
      {
        icon: Database,
        title: 'Offline first',
        body: 'Everything lives in IndexedDB on this device. The app works with the phone in flight mode, and your data never leaves it.',
        where: 'Everywhere',
      },
    ],
  },
]

export default function WhatsNewScreen() {
  const navigate = useNavigate()
  const [seen, setSeen] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const prev = await getSetting<string | null>(UI_SETTING_KEYS.whatsNewSeen, null)
      if (alive) setSeen(prev)
      await setSetting(UI_SETTING_KEYS.whatsNewSeen, RELEASES[0].version)
    })()
    return () => { alive = false }
  }, [])

  const total = RELEASES.reduce((n, r) => n + r.features.length, 0)

  return (
    <div className="mx-auto max-w-lg pb-10">
      <PageHeader
        title="What’s new"
        back="/more"
        subtitle={`${total} features, newest first — with where to find each one.`}
      />

      <Section>
        <Callout tone="neutral" icon={<Layers size={15} />}>
          Nothing in Ironverse has ever been removed. Everything listed here still works,
          all the way back to the first build. Running v{APP_VERSION}.
        </Callout>
      </Section>

      {RELEASES.map((rel) => {
        const isNew = seen !== null && seen !== rel.version && rel === RELEASES[0]
        return (
          <Section
            key={rel.version}
            title={`v${rel.version} — ${rel.label}`}
            action={isNew ? <Badge tone="brand">New</Badge> : <Badge tone="gray">{rel.date}</Badge>}
          >
            <p className="mb-3 px-1 text-[12.5px] leading-relaxed text-ink2">{rel.summary}</p>
            <ul className="space-y-2.5">
              {rel.features.map((f) => {
                const Icon = f.icon
                const clickable = Boolean(f.to)
                const inner = (
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"
                      aria-hidden="true"
                    >
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14.5px] font-bold leading-tight text-ink">{f.title}</h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{f.body}</p>
                      <p className="mt-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink3">
                        {f.where}
                      </p>
                    </div>
                    {clickable && <ChevronRight size={18} className="mt-0.5 shrink-0 text-ink3" aria-hidden="true" />}
                  </div>
                )
                return (
                  <li key={f.title}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => navigate(f.to as string)}
                        aria-label={`${f.title} — open ${f.where}`}
                        className={`pressable ${FOCUS_RING} w-full rounded-2xl bg-surface2 p-3.5 text-left shadow-card`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <Card className="p-3.5">{inner}</Card>
                    )}
                  </li>
                )
              })}
            </ul>
          </Section>
        )
      })}
    </div>
  )
}
