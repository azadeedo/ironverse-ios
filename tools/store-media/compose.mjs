// App Store screenshots: headline + the REAL app capture (store/raw) in a phone frame.
// 1290 x 2796 (iPhone 6.9"). Run after capture.mjs:  node tools/store-media/compose.mjs
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const OUT = 'store/screenshots-final'
mkdirSync(OUT, { recursive: true })

// order = App Store order (the first three decide most installs)
export const SLIDES = [
  { raw: 'today', head: ['Your gym.', 'Your food.', 'One app.'], hi: 2, sub: 'Workouts, calories and progress — all in Ironverse', badge: 'Australian made' },
  { raw: 'food-cuisines', head: ['Count calories', 'from 400+ foods'], hi: 1, sub: '15 cuisines · barcode scanner · meal photos' },
  { raw: 'session', head: ['Log every set', 'in seconds'], hi: 1, sub: 'Rest timer, smart targets, supersets and drop sets' },
  { raw: 'program-day', head: ['Know exactly', 'what to lift'], hi: 1, sub: 'Plans built for your gym or your home kit' },
  { raw: 'progress', head: ['Watch your', 'body change'], hi: 1, sub: 'Weight trend, measurements and progress photos' },
  { raw: 'exercise', head: ['194 exercises,', 'animated'], hi: 1, sub: 'Form cues and muscles worked for every lift' },
  { raw: 'records', head: ['Smash your', 'personal records'], hi: 1, sub: 'PRs and estimated 1RM spotted automatically' },
  { raw: 'program-detail', head: ['12-week program', 'written for you'], hi: 0, sub: '48 workouts that adapt to what you lift' },
  { raw: 'anatomy', head: ['Learn every', 'muscle'], hi: 1, sub: 'Interactive anatomy map and 3D body' },
  { raw: 'hub', head: ['Level up', 'as you train'], hi: 0, sub: 'Trophies, streaks, levels and challenges' },
]

function html(s, img) {
  // shrink long headlines so each line fits on one line (heavy italic ≈ 0.66 em per character)
  const longest = Math.max(...s.head.map((t) => t.length))
  const size = Math.min(132, Math.floor(1150 / (longest * 0.66)))
  const lines = s.head.map((t, i) => `<div class="${i === s.hi ? 'hi' : ''}">${t}</div>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:1290px;height:2796px;overflow:hidden;background:#0a0f19;font-family:-apple-system,"SF Pro Display","Segoe UI",Roboto,Arial,sans-serif;color:#f4f6fb;position:relative}
  .glow{position:absolute;inset:-300px -200px auto -200px;height:1500px;background:radial-gradient(closest-side,rgba(251,191,36,.38),rgba(251,191,36,0) 70%);filter:blur(10px)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.035) 2px,transparent 2px);background-size:86px 86px;mask-image:linear-gradient(#000,transparent 55%)}
  .top{position:absolute;top:150px;left:0;right:0;text-align:center;padding:0 70px}
  .brand{display:inline-flex;align-items:center;gap:18px;font-size:40px;font-weight:800;letter-spacing:.32em;color:#fbbf24}
  .bar{width:64px;height:14px;background:#b8c2d0;border-radius:7px;position:relative}
  .bar:before,.bar:after{content:"";position:absolute;top:-22px;width:16px;height:58px;background:#fbbf24;border-radius:8px}
  .bar:before{left:-10px}.bar:after{right:-10px}
  h1{margin-top:46px;font-size:${size}px;line-height:1.02;font-weight:900;font-style:italic;letter-spacing:-.02em;text-transform:uppercase}
  h1 .hi{color:#fbbf24}
  p{margin-top:40px;font-size:50px;line-height:1.3;color:#c3cad7;font-weight:500}
  .badge{display:inline-block;margin-top:40px;padding:16px 34px;border-radius:999px;border:3px solid rgba(251,191,36,.6);color:#fbbf24;font-size:38px;font-weight:700}
  .phone{position:absolute;left:50%;transform:translateX(-50%);top:${Math.round(380 + s.head.length * size * 1.02 + (s.badge ? 120 : 0) + 120)}px;width:1010px;height:2187px;border-radius:120px;background:#1b2231;padding:22px;box-shadow:0 60px 140px rgba(0,0,0,.6),0 0 0 3px #2c3446 inset}
  .screen{width:100%;height:100%;border-radius:100px;overflow:hidden;position:relative;background:#0c111c}
  .screen img{width:100%;display:block}
  .island{position:absolute;top:30px;left:50%;transform:translateX(-50%);width:250px;height:72px;border-radius:40px;background:#000}
  </style></head><body><div class="glow"></div><div class="grid"></div>
  <div class="top"><div class="brand"><span class="bar"></span>&nbsp;IRONVERSE</div><h1>${lines}</h1><p>${s.sub}</p>${s.badge ? `<span class="badge">${s.badge.toUpperCase()}</span>` : ''}</div>
  <div class="phone"><div class="screen"><img src="data:image/png;base64,${img}"><div class="island"></div></div></div>
  </body></html>`
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 })
for (const [i, s] of SLIDES.entries()) {
  const img = readFileSync(`store/raw/${s.raw}.png`).toString('base64')
  await page.setContent(html(s, img), { waitUntil: 'load' })
  await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block' }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  const name = `${String(i + 1).padStart(2, '0')}-${s.raw}.png`
  await page.screenshot({ path: `${OUT}/${name}` })
  console.log('  ' + name)
}
await browser.close()
