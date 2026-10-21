// Raw app captures for the App Store screenshots and preview videos.
// Real App Store build (npm run dev:ios on :5188), iPhone 6.9" viewport
// (430 x 932 @3x = 1290 x 2796), filled with clearly fictional demo data.
// Usage: node tools/store-media/capture.mjs [scene ...]   → store/raw/<scene>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

export const BASE = process.env.IV_URL ?? 'http://localhost:5188'
const OUT = 'store/raw'
mkdirSync(OUT, { recursive: true })

/** Fictional "Alex": 10 weeks of training, weigh-ins, measurements and a full food day. */
export async function seedDemo(page, style = 'general') {
  await page.goto(BASE)
  await page.waitForURL(/welcome/)
  await page.evaluate(async (style) => {
    const fr = await import('/src/lib/firstRun.ts')
    const { db, setSetting } = await import('/src/db/index.ts')
    const d = fr.emptyDraft()
    Object.assign(d, { name: 'Alex', age: 31, heightCm: 178, weightKg: 82.4, experience: 'intermediate', goals: ['fat-loss', 'strength'], goalWeightKg: 78, daysPerWeek: 4, sessionMinutes: 60, location: 'gym', style, reminders: false })
    d.lifts.bench = { mode: 'known', oneRmKg: 100 }
    d.lifts.squat = { mode: 'estimate', weightKg: 110, reps: 5 }
    await fr.applyFirstRun(d)
    await fr.finishFirstRun()
    await setSetting('tour:done', true)
    // demo device is a Pro subscriber so no upgrade cards cover the features being shown
    await setSetting('pro:entitlement', { active: true, expires: '2099-01-01T00:00:00Z', checkedAt: new Date().toISOString() })
    const day = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10) }
    const iso = (n, h) => { const x = new Date(); x.setDate(x.getDate() - n); x.setHours(h, 0, 0, 0); return x.toISOString() }
    for (let i = 0; i <= 70; i += 2) await db.weighIns.put({ id: 'demo-w' + i, date: day(i), weightKg: Math.round((82.4 + i * 0.07 + Math.sin(i / 2) * 0.3) * 10) / 10 })
    await db.measurements.put({ id: 'demo-m1', date: day(70), values: { waist: 94, chest: 104, biceps: 35.5, thigh: 60 } })
    await db.measurements.put({ id: 'demo-m2', date: day(35), values: { waist: 91.5, chest: 104.5, biceps: 36, thigh: 60.5 } })
    await db.measurements.put({ id: 'demo-m3', date: day(0), values: { waist: 89, chest: 105, biceps: 36.5, thigh: 61 } })
    const plan = (await db.plans.toArray()).find((p) => p.active)
    const A = [['barbell-bench-press', 72.5], ['barbell-squat', 90], ['barbell-row', 60], ['overhead-press', 42.5]]
    const B = [['barbell-deadlift', 120], ['pull-up', 0], ['dumbbell-bench-press', 26], ['leg-press', 140]]
    for (let s = 0; s < 28; s++) {
      const n = 68 - s * 2.4 | 0
      const lifts = s % 2 ? B : A
      const ex = lifts.map(([id, kg]) => ({ exerciseId: id, sets: [0, 1, 2].map((k) => ({ setIndex: k, targetReps: [5, 8], reps: 8 - k, weightKg: kg ? Math.round((kg + s * 0.9) / 2.5) * 2.5 : undefined, done: true, rir: 2 })) }))
      await db.workoutLogs.put({ id: 'demo-l' + s, date: day(n), planId: plan?.id, title: s % 2 ? 'Lower' : 'Upper', startedAt: iso(n, 7), finishedAt: iso(n, 8), exercises: ex, totalVolumeKg: 8800 + s * 140 })
    }
    const food = [
      ['breakfast', 'Oats with milk & banana', 420, 18, 66, 9],
      ['lunch', 'Chicken burrito bowl', 630, 45, 68, 20],
      ['snack', 'Greek yoghurt & berries', 180, 17, 20, 3],
      ['dinner', 'Thai basil chicken with rice', 610, 42, 62, 18],
    ]
    for (const [i, f] of food.entries()) await db.foodLog.put({ id: 'demo-f' + i, date: day(0), meal: f[0], name: f[1], grams: 300, kcal: f[2], protein: f[3], carbs: f[4], fat: f[5], createdAt: iso(0, 7 + i * 4) })
    for (let k = 1; k <= 13; k++) for (const [i, kcal] of [520, 640, 210, 600].entries()) await db.foodLog.put({ id: `demo-f${k}-${i}`, date: day(k), meal: ['breakfast', 'lunch', 'snack', 'dinner'][i], name: 'Logged meal', grams: 300, kcal: kcal + ((k * 37 + i * 13) % 120) - 60, protein: 35, carbs: 50, fat: 15, createdAt: iso(k, 8 + i * 4) })
    for (let k = 0; k < 7; k++) await db.waterLog.put({ id: 'demo-water' + k, date: day(0), ml: 350, at: iso(0, 8 + k * 2) })
  }, style)
}

export async function newPage(browser, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark', ...extra })
  // iPhones draw flag emoji (Apple Color Emoji); Windows Chromium has no flag glyphs, so load Noto's for captures only
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const l = document.createElement('link'); l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block'
      document.head.appendChild(l)
      const st = document.createElement('style')
      st.textContent = 'html,body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Noto Color Emoji" !important}'
      document.head.appendChild(st)
    })
  })
  return { ctx, page: await ctx.newPage() }
}

export const go = async (page, path, wait = 1800) => { await page.goto(BASE + path); await page.waitForTimeout(wait) }

async function main() {
  const browser = await chromium.launch()
  const { page } = await newPage(browser)
  await seedDemo(page)
  const shot = async (name) => { await page.waitForTimeout(600); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('  ' + name) }

  await go(page, '/'); await shot('today')
  await go(page, '/workout'); await shot('workout')
  await page.getByText(/^(Start this workout|Start)/).first().click().catch(() => {})
  await page.waitForTimeout(2000)
  // tick the first two sets so the session looks in use
  for (let i = 0; i < 2; i++) await page.locator('button[aria-label*="Complete set"], button[aria-label*="Done"], button[aria-label*="tick" i]').nth(0).click().catch(() => {})
  await shot('session')
  await go(page, '/exercise/barbell-squat', 2500); await shot('exercise')
  await go(page, '/food'); await shot('food')
  await page.getByRole('button', { name: 'Add food' }).first().click().catch((e) => console.log('add food click', e.message))
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /Thai$/ }).first().click().catch(() => {})
  await shot('food-cuisines')
  await go(page, '/progress', 2200); await shot('progress')
  await go(page, '/prs'); await shot('records')
  await go(page, '/anatomy', 2200); await shot('anatomy')
  await go(page, '/calories'); await shot('calories')
  await go(page, '/hub', 2200); await shot('hub')
  // second demo user who chose the 12-week program
  const p2 = await newPage(browser)
  await seedDemo(p2.page, 'program12')
  await go(p2.page, '/program', 2500); await p2.page.screenshot({ path: `${OUT}/program.png` }); console.log('  program')
  await go(p2.page, '/workout', 2500); await p2.page.screenshot({ path: `${OUT}/program-day.png` }); console.log('  program-day')
  await go(p2.page, '/program/day/1/wed', 2800); await p2.page.screenshot({ path: `${OUT}/program-detail.png` }); console.log('  program-detail')
  await browser.close()
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('capture.mjs')) await main()
