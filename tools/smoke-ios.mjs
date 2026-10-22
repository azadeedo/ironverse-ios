// Route sweep of the App Store build (npm run dev:ios on :5188) on an iPhone viewport.
// Three users: brand-new (trial), trial ended (free tier) and the Pro demo user.
// Reports page errors, console errors, failed requests, horizontal overflow and blank screens.
// Usage: node tools/smoke-ios.mjs   (screens → store/smoke/<user>/<route>.png)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { BASE, newPage, seedDemo } from './store-media/capture.mjs'

const ROUTES = ['/', '/workout', '/food', '/progress', '/more', '/achievements', '/anatomy', '/backup', '/body', '/calories', '/cardio',
  '/devices', '/exercise/barbell-squat', '/exercises', '/fast-food', '/feedback', '/food-photos', '/health-scan', '/history', '/hub',
  '/hydration', '/meal-plan', '/nutrition-week', '/photos', '/pill-box', '/plan', '/pr-quest', '/pro', '/program', '/programs', '/prs',
  '/research', '/review', '/search', '/settings', '/skills', '/strength-journey', '/tools', '/whats-new']

const browser = await chromium.launch()
const problems = []
for (const user of ['trial', 'free', 'pro']) {
  const out = `store/smoke/${user}`
  mkdirSync(out, { recursive: true })
  const { page } = await newPage(browser)
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  page.on('requestfailed', (r) => { if (!/anthropic|openfoodfacts|google|netlify/.test(r.url())) errs.push('request: ' + r.url()) })
  await seedDemo(page)
  await page.evaluate(async (user) => {
    const { setSetting } = await import('/src/db/index.ts')
    const d = new Date()
    if (user !== 'pro') await setSetting('pro:entitlement', { active: false, checkedAt: d.toISOString() })
    d.setDate(d.getDate() - (user === 'free' ? 30 : 0))
    await setSetting('pro:trialStart', d.toISOString())
  }, user)
  for (const r of ROUTES) {
    errs.length = 0
    await page.goto(BASE + r)
    await page.waitForTimeout(1500)
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      text: (document.querySelector('#root')?.innerText ?? '').trim().length,
      url: location.pathname,
    }))
    const name = r === '/' ? 'today' : r.slice(1).replace(/\//g, '_')
    await page.screenshot({ path: `${out}/${name}.png` })
    const issues = [...new Set(errs)]
    if (info.overflow > 2) issues.push(`horizontal overflow ${info.overflow}px`)
    if (info.text < 20) issues.push('blank screen')
    if (info.url !== r && r !== '/') issues.push('redirected to ' + info.url)
    if (issues.length) problems.push({ user, route: r, issues })
    console.log(`${user.padEnd(5)} ${r.padEnd(24)} ${issues.length ? 'ISSUES: ' + issues.join(' | ') : 'ok'}`)
  }
}
await browser.close()
console.log(`\n${problems.length} route(s) with issues`)
