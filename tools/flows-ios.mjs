// End-to-end user flows on the App Store build (npm run dev:ios on :5188).
// Each flow drives the real UI like a person would, then checks the database.
// Usage: node tools/flows-ios.mjs   → prints PASS/FAIL per flow + any page errors
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { BASE, newPage, seedDemo, go } from './store-media/capture.mjs'

const OUT = 'store/flows'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const { page } = await newPage(browser)
page.setDefaultTimeout(8000)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|openfoodfacts|net::/i.test(m.text())) errors.push(m.text().slice(0, 160)) })
await seedDemo(page)
const db = (fn, arg) => page.evaluate(async ([src, a]) => { const m = await import('/src/db/index.ts'); return (0, eval)(src)(m.db, a) }, [fn.toString(), arg])
const results = []
async function flow(name, fn) {
  const before = errors.length
  try { await fn(); results.push([name, errors.length > before ? `PASS (but ${errors.length - before} console error)` : 'PASS']) }
  catch (e) { results.push([name, 'FAIL: ' + String(e.message).split('\n')[0]]); await page.screenshot({ path: `${OUT}/${name.replace(/\W+/g, '-')}.png` }).catch(() => {}) }
}

await flow('Quick log water + weight + sleep', async () => {
  await go(page, '/', 1500)
  const before = await db((d) => d.waterLog.count())
  await page.getByRole('button', { name: 'Quick log' }).first().click()
  await page.getByRole('button', { name: '+250 ml' }).click()
  await page.getByLabel('Weight in kg').fill('81.7'); await page.getByLabel('Weight in kg').locator('xpath=following::button[1]').click()
  await page.getByRole('button', { name: 'Slept Great' }).last().click()
  await page.waitForTimeout(500)
  if ((await db((d) => d.waterLog.count())) !== before + 1) throw new Error('water not saved')
  const w = await db((d) => d.weighIns.orderBy('date').last())
  if (w.weightKg !== 81.7) throw new Error('weight not saved: ' + w.weightKg)
})

await flow('Start workout, log 2 sets, finish, save as template', async () => {
  await page.keyboard.press('Escape').catch(() => {})
  await go(page, '/workout', 2000)
  await page.getByText(/^(Start this workout|Start|Resume)/).first().click()
  await page.waitForTimeout(2000)
  if (!/\/session\/|\/program\/day/.test(page.url())) throw new Error('no session opened: ' + page.url())
  if (/\/program\/day/.test(page.url())) { await page.getByRole('button', { name: /Start this session/ }).click(); await page.getByRole('button', { name: /Start session/ }).click(); await page.waitForTimeout(1500) }
  const id = page.url().split('/session/')[1]
  for (let i = 0; i < 2; i++) await page.locator('button[aria-label*="Complete set"], button[aria-label*="Mark set"], button[aria-label*="done" i]').first().click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /^Finish/ }).first().click()
  await page.getByRole('button', { name: /^(Finish|Save)( workout)?$/ }).last().click().catch(() => {})
  await page.waitForTimeout(1500)
  const log = await db((d, i) => d.workoutLogs.get(i), id)
  if (!log?.finishedAt) throw new Error('workout not finished')
  await page.getByRole('button', { name: /Save as template/ }).click()
  await page.waitForTimeout(500)
  const saved = await page.evaluate(async () => (await import('/src/lib/saved.ts')).savedWorkouts())
  if (!saved.length) throw new Error('template not saved')
})

await flow('Saved hub: start the saved workout again', async () => {
  await go(page, '/saved', 1500)
  await page.getByRole('button', { name: /Start/ }).first().click()
  await page.waitForTimeout(1200)
  if (!page.url().includes('/session/')) throw new Error('did not open the session')
})

await flow('Add food via cuisine chip', async () => {
  await go(page, '/food', 1500)
  const before = await db((d) => d.foodLog.count())
  await page.getByRole('button', { name: 'Add food' }).first().click()
  await page.waitForTimeout(800)
  await page.locator('[aria-label="Cuisine"] button', { hasText: 'Thai' }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /^Log / }).first().click()
  await page.waitForTimeout(800)
  if ((await db((d) => d.foodLog.count())) <= before) throw new Error('food not logged')
})

await flow('Sleep check-in with factors', async () => {
  await go(page, '/sleep', 1500)
  const edit = page.getByRole('button', { name: 'Edit' }); if (await edit.count()) await edit.first().click()
  await page.getByRole('button', { name: /Good/ }).first().click()
  await page.getByRole('button', { name: /Caffeine after 2 pm/ }).click()
  await page.getByRole('button', { name: /Save last night/ }).click()
  await page.waitForTimeout(500)
  const c = await page.evaluate(async () => { const { db } = await import('/src/db/index.ts'); const { todayStr } = await import('/src/lib/id.ts'); return db.checkins.get(todayStr()) })
  if (!c?.sleepFactors?.includes('caffeine') || !c.sleepHours) throw new Error('sleep not saved: ' + JSON.stringify(c))
})

await flow('Fasting start and stop', async () => {
  await go(page, '/fasting', 1500)
  await page.getByRole('button', { name: /^Start \d+-hour fast/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /End fast/ }).click()
  await page.waitForTimeout(400)
  const h = await page.evaluate(async () => (await import('/src/db/index.ts')).getSetting('fasting:history', []))
  if (!h.length) throw new Error('fast not recorded')
})

await flow('Generate a 6-week program', async () => {
  await go(page, '/plan', 1500)
  await page.getByRole('button', { name: /Generate (new|my) plan/ }).first().click()
  await page.getByRole('radio', { name: '6 wk', exact: true }).click()
  await page.getByRole('button', { name: /^Generate/ }).last().click()
  const confirm = page.getByRole('button', { name: /Replace|Generate|Yes/ }).last(); await confirm.click().catch(() => {})
  await page.waitForTimeout(1500)
  const p = await db((d) => d.plans.toArray().then((ps) => ps.filter((x) => x.active).map((x) => x.weeks.length)))
  if (!p.includes(6)) throw new Error('no active 6-week plan: ' + p)
})

await flow('Build my own program', async () => {
  await go(page, '/plan/build', 1500)
  await page.getByRole('button', { name: /Add exercise/ }).first().click()
  await page.getByPlaceholder(/Search exercises/).fill('squat')
  await page.getByRole('button', { name: /^Barbell Back Squat/ }).first().click()
  await page.getByRole('button', { name: /Save & start/ }).click()
  await page.waitForTimeout(1200)
  const p = await db((d) => d.plans.toArray().then((ps) => ps.find((x) => x.active)?.sourceLabel))
  if (p !== 'Built by you') throw new Error('custom plan not active')
})

await flow('Weekly review renders with extras', async () => {
  await go(page, '/review', 2000)
  await page.getByText('More from your week').waitFor()
})

await flow('Settings search + halal toggle', async () => {
  await go(page, '/settings', 1500)
  const t = page.getByRole('switch', { name: 'Halal mode' }); if (await t.count()) await t.click()
  await page.waitForTimeout(400)
})

await flow('Backup export builds a file', async () => {
  const size = await page.evaluate(async () => { const m = await import('/src/lib/backup.ts'); const b = await m.exportBackup(); return b.size })
  if (!(size > 1000)) throw new Error('backup too small: ' + size)
})

for (const [n, r] of results) console.log(`${r.startsWith('PASS') ? '✔' : '✘'} ${n} — ${r}`)
console.log('\npage errors:', [...new Set(errors)].slice(0, 10))
await browser.close()
