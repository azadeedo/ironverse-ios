// App Store app preview video: REAL app footage (Chrome DevTools screencast of the
// App Store build) + caption overlays, encoded to Apple's preview spec:
// 886 x 1920 portrait, H.264, 30 fps, 15–30 s, stereo AAC track.
// Needs `npm run dev:ios` running and ffmpeg (FFMPEG env var or on PATH).
// Usage: node tools/store-media/video.mjs [main|food|train]
import { chromium } from 'playwright'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { BASE, seedDemo } from './capture.mjs'

const which = process.argv[2] ?? 'main'
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const TMP = `store/video-tmp-${which}`
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
mkdirSync('store/previews', { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'], headless: true })
const ctx = await browser.newContext({ viewport: { width: 443, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
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
const page = await ctx.newPage()
page.setDefaultTimeout(2500)
await seedDemo(page, which === 'train' ? 'program12' : 'general')
await page.goto(BASE + '/')
await page.waitForTimeout(2500)
await page.evaluate(() => document.fonts.ready)

// ---------- helpers ----------
const nav = (path) => page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path)
const wait = (ms) => page.waitForTimeout(ms)
const t0 = Date.now()
async function caption(title, sub = '') {
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s  ${title}`)
  await page.evaluate(([t, s]) => {
    let el = document.getElementById('iv-cap')
    if (!el) {
      el = document.createElement('div'); el.id = 'iv-cap'
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;pointer-events:none;padding:36px 22px 70px;text-align:center;background:linear-gradient(#0a0f19 62%,rgba(10,15,25,0));transition:opacity .25s'
      document.body.appendChild(el)
    }
    el.style.opacity = t ? '1' : '0'
    el.innerHTML = t ? `<div style="font:900 italic 34px/1.05 -apple-system,'Segoe UI',Arial,sans-serif;letter-spacing:-.01em;text-transform:uppercase;color:#f4f6fb">${t}</div>${s ? `<div style="margin-top:10px;font:600 17px/1.3 -apple-system,'Segoe UI',Arial,sans-serif;color:#fbbf24">${s}</div>` : ''}` : ''
  }, [title, sub])
}
async function scroll(px, steps = 12, gap = 40) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await wait(gap) }
}

// ---------- screencast ----------
const client = await ctx.newCDPSession(page)
const frames = []
client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, ts: metadata.timestamp })
  await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
// nudge a 1px element every 50 ms so the screencast keeps emitting frames even when nothing moves
const keepAlive = setInterval(() => {
  page.evaluate(() => { const d = document.getElementById('iv-tick') ?? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'iv-tick' }); d.style.cssText = 'position:fixed;width:1px;height:1px;left:0;bottom:0;opacity:.01;background:' + (d.style.background === 'red' ? 'blue' : 'red') }).catch(() => {}) }, 50)
await client.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 886, maxHeight: 1920, everyNthFrame: 1 })

// ---------- storyboards ----------
async function main() {
  // 1. coolest first: the real 3D body
  await nav('/anatomy'); await wait(900)
  await page.getByRole('button', { name: 'Real 3D model' }).click().catch(() => {})
  await caption('Meet Ironverse', 'The gym, calorie & progress app')
  await wait(1800)
  await page.mouse.move(120, 600); await page.mouse.down()
  for (let i = 0; i < 60; i++) { await page.mouse.move(120 + i * 4, 600); await wait(33) }
  await page.mouse.up(); await wait(900)
  // 2. animated exercise demos
  await nav('/exercise/barbell-squat'); await caption('194 animated exercises', 'Form cues for every lift'); await wait(3200)
  // 3. training: start and tick sets
  await nav('/workout'); await caption('Plans built for your gym', 'Or your home kit'); await wait(1300)
  await page.getByRole('button', { name: /Start this workout/ }).first().click().catch(() => {})
  await wait(900); await caption('Log every set in seconds', 'Smart targets · rest timer')
  await wait(900); await page.getByRole('button', { name: /Next/ }).last().click({ timeout: 800 }).catch(() => {}); await wait(1500)
  // 4. food: world cuisines
  await nav('/food'); await caption('Count calories from 400+ foods', '15 cuisines · barcode scanner'); await wait(900)
  await page.getByRole('button', { name: 'Add food' }).first().click().catch(() => {}); await wait(700)
  for (const c of [/Italian$/, /Thai$/, /Mexican$/]) { await page.getByRole('button', { name: c }).first().click().catch(() => {}); await wait(750) }
  await page.keyboard.press('Escape').catch(() => {})
  // 5. progress
  await nav('/progress'); await caption('Watch your body change', 'Weight trend · measurements'); await wait(1000); await scroll(500, 10, 40); await wait(500)
  // 6. records
  await nav('/prs'); await caption('Smash your records', 'PRs spotted automatically'); await wait(1800)
  // 7. end card on Today
  await nav('/'); await caption('Ironverse', 'Australian made · 7 days of Premium free'); await wait(2200)
}

async function food() {
  await nav('/food'); await caption('Your calorie counter', 'Targets that fit your goal'); await wait(2200)
  await page.getByRole('button', { name: 'Add food' }).first().click().catch(() => {}); await wait(800)
  await caption('400+ foods, 15 cuisines', 'From Aussie classics to Thai')
  for (const c of [/Australian$/, /Italian$/, /Indian$/, /Japanese$/, /Thai$/, /Mexican$/, /Middle Eastern$/]) { await page.getByRole('button', { name: c }).first().click().catch(() => {}); await wait(950) }
  await page.keyboard.press('Escape').catch(() => {})
  await nav('/calories'); await caption('Smart calorie targets', 'Changes only with your OK'); await wait(2500)
  await nav('/nutrition-week'); await caption('See your week', 'Calories & macros over time'); await wait(2500)
  await nav('/hydration'); await caption('Water & supplements', 'Reminders that respect your day'); await wait(2500)
  await nav('/'); await caption('Ironverse', 'Australian made · 7 days of Premium free'); await wait(2200)
}

async function train() {
  await nav('/workout'); await caption('12-week program', '48 written workouts'); await wait(2400)
  await nav('/program/day/1/wed'); await caption('Know why you lift it', 'Coaching for every exercise'); await wait(1400); await scroll(700, 16, 60); await wait(800)
  await nav('/exercises'); await caption('194 exercises', 'Search by muscle or equipment'); await wait(1400); await scroll(900, 16, 50)
  await nav('/exercise/barbell-deadlift'); await caption('Animated form demos'); await wait(2600)
  await nav('/hub'); await caption('Level up as you train', 'Trophies · streaks · challenges'); await wait(2400)
  await nav('/anatomy'); await caption('Learn every muscle'); await wait(2200)
  await nav('/'); await caption('Ironverse', 'Australian made · 7 days of Premium free'); await wait(2200)
}

await ({ main, food, train })[which]()
await client.send('Page.stopScreencast')
clearInterval(keepAlive)
await browser.close()

// ---------- encode ----------
let list = ''
frames.forEach((f, i) => {
  const name = `f${String(i).padStart(5, '0')}.jpg`
  writeFileSync(`${TMP}/${name}`, Buffer.from(f.data, 'base64'))
  const dur = i < frames.length - 1 ? Math.max(0.001, frames[i + 1].ts - f.ts) : 0.5
  list += `file '${name}'\nduration ${dur.toFixed(4)}\n`
})
list += `file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'\n`
writeFileSync(`${TMP}/list.txt`, list)
const total = frames.length ? frames[frames.length - 1].ts - frames[0].ts + 0.5 : 0
console.log(`${frames.length} frames, ${total.toFixed(1)} s of footage`)
const out = `store/previews/ironverse-preview-${which}.mp4`
// the 3D intro needs ~1.6 s to load its model — start the main preview after that
const skip = which === 'main' ? 1.6 : 0.4
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(skip), '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`,
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-vf', 'scale=886:1920:flags=lanczos:in_range=pc:out_range=tv:force_original_aspect_ratio=decrease,pad=886:1920:(ow-iw)/2:(oh-ih)/2:color=0x0c111c,fps=30,format=yuv420p',
  '-t', String(Math.min(29.5, total - skip)), '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-crf', '16', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out])
console.log('wrote ' + out)
