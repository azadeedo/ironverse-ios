// App Store screenshots (6.9-inch iPhone, 1290 x 2796) of the REAL App Store build,
// filled with clearly fictional demo data ("Alex"). Needs `npm run dev:ios` running.
// Run: node tools/screenshots.mjs   → store/screenshots/*.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.IV_URL ?? 'http://localhost:5188'
const OUT = 'store/screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' })
const page = await ctx.newPage()
const settle = (ms = 1800) => page.waitForTimeout(ms)
const shot = async (name) => { await settle(); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('  ' + name) }

await page.goto(BASE)
await page.waitForURL(/welcome/)
await shot('06-welcome')

// fictional demo user + 6 weeks of plausible history, written through the app's own modules
await page.evaluate(async () => {
  const fr = await import('/src/lib/firstRun.ts')
  const { db } = await import('/src/db/index.ts')
  const d = fr.emptyDraft()
  Object.assign(d, { name: 'Alex', age: 31, heightCm: 178, weightKg: 82.4, experience: 'intermediate', goals: ['fat-loss', 'strength'], goalWeightKg: 78, daysPerWeek: 4, sessionMinutes: 60, location: 'gym', style: 'general', reminders: false })
  d.lifts.bench = { mode: 'known', oneRmKg: 100 }
  d.lifts.squat = { mode: 'estimate', weightKg: 110, reps: 5 }
  await fr.applyFirstRun(d)
  await fr.finishFirstRun()
  const day = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10) }
  const iso = (n, h) => `${day(n)}T${String(h).padStart(2, '0')}:00:00.000Z`
  for (let i = 0; i < 42; i += 2) await db.weighIns.put({ id: 'demo-w' + i, date: day(i), weightKg: Math.round((82.4 + i * 0.085 + Math.sin(i) * 0.25) * 10) / 10 })
  await db.measurements.put({ id: 'demo-m1', date: day(35), values: { waist: 92, chest: 104, biceps: 36 } })
  await db.measurements.put({ id: 'demo-m2', date: day(0), values: { waist: 89, chest: 104, biceps: 36.5 } })
  const plan = (await db.plans.toArray()).find((p) => p.active)
  const lifts = [['barbell-bench-press', 80], ['barbell-squat', 95], ['barbell-deadlift', 120], ['pull-up', 0]]
  for (let s = 0; s < 12; s++) {
    const n = 40 - s * 3
    const ex = lifts.map(([id, kg]) => ({ exerciseId: id, sets: [0, 1, 2].map((k) => ({ setIndex: k, targetReps: [5, 8], reps: 8 - k, weightKg: kg ? kg + s * 1.25 : undefined, done: true, rir: 2 })) }))
    await db.workoutLogs.put({ id: 'demo-l' + s, date: day(n), planId: plan?.id, title: s % 2 ? 'Upper' : 'Lower', startedAt: iso(n, 7), finishedAt: iso(n, 8), exercises: ex, totalVolumeKg: 9000 + s * 150 })
  }
  const food = [['breakfast', 'Oats with milk', 380, 18, 55, 9], ['lunch', 'Chicken breast and rice', 620, 52, 70, 10], ['snack', 'Greek yoghurt', 150, 15, 8, 4], ['dinner', 'Salmon with vegetables', 540, 40, 20, 30]]
  for (const [i, f] of food.entries()) await db.foodLog.put({ id: 'demo-f' + i, date: day(0), meal: f[0], name: f[1], grams: 300, kcal: f[2], protein: f[3], carbs: f[4], fat: f[5], createdAt: iso(0, 8 + i * 3) })
})

for (const [route, name] of [['/', '01-today'], ['/workout', '02-workout'], ['/exercises', '03-exercises'], ['/food', '04-food'], ['/progress', '05-progress'], ['/prs', '07-records']]) {
  await page.goto(BASE + route)
  await shot(name)
}
await browser.close()
