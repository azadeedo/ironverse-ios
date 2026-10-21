// Paywall screenshots for App Store Connect's subscription "Review Information"
// (one per product, that plan selected). Demo user's free week has ended, so the
// paywall shows both plans, Restore Purchases and the Terms/Privacy links.
// Usage (dev:ios running on :5188): node tools/store-media/paywall.mjs → store/review/
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { go, newPage, seedDemo } from './capture.mjs'

const OUT = 'store/review'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const { page } = await newPage(browser)
await seedDemo(page)
await page.evaluate(async () => {
  const { setSetting } = await import('/src/db/index.ts')
  await setSetting('pro:entitlement', { active: false, checkedAt: new Date().toISOString() })
  const d = new Date(); d.setDate(d.getDate() - 30)
  await setSetting('pro:trialStart', d.toISOString())
})
await go(page, '/pro', 2200)
for (const [plan, label] of [['monthly', 'Monthly'], ['yearly', 'Yearly']]) {
  await page.getByRole('button', { name: new RegExp('^' + label) }).first().click()
  await page.waitForTimeout(500)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${OUT}/paywall-${plan}.png`, fullPage: true })
  console.log('  paywall-' + plan)
}
await browser.close()
