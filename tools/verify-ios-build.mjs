// Checks a `npm run build:ios` output before it goes into the iOS app.
// Fails (exit 1) on anything that would break the native build or leak a secret.
// Run: node tools/verify-ios-build.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const problems = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { problems.push(m); console.log('  FAIL ' + m) }

function walk(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p] })
}

if (!existsSync(join(dist, 'index.html'))) bad('dist/index.html missing — run npm run build:ios first')
else {
  const files = walk(dist)
  ok(`${files.length} files in dist`)
  if (files.some((f) => /[\\/]sw\.js$/.test(f))) bad('service worker present — the iOS build must be built with --mode ios')
  else ok('no service worker (App Store delivers updates)')
  const js = files.filter((f) => f.endsWith('.js'))
  const text = js.map((f) => readFileSync(f, 'utf8')).join('\n')
  if (/sk-ant-[A-Za-z0-9_-]{20,}/.test(text)) bad('an Anthropic API key is embedded in the bundle')
  else ok('no API keys in the bundle')
  if (!/VITE_EDITION|ios/.test(text) || !text.includes('"ios"')) bad('bundle does not look like the iOS edition')
  else ok('iOS edition flag compiled in')
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  if (/registerSW|serviceWorker\.register/.test(html)) bad('index.html registers a service worker')
  else ok('index.html has no service-worker registration')
  if (!existsSync(join(dist, 'version.json'))) bad('version.json missing')
  else ok('version.json: ' + JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8')).version)
  const exercises = files.filter((f) => /media[\\/]exercises/.test(f)).length
  ok(`${exercises} bundled exercise media files (offline)`)
}

const cap = readFileSync('capacitor.config.ts', 'utf8')
if (/server:\s*{[^}]*\burl\s*:/.test(cap)) bad('capacitor.config.ts loads a remote URL — the app must be bundled')
else ok('capacitor.config.ts loads the bundled app (no remote url)')
if (!cap.includes("appId: 'com.nouriapps.ironverse'")) bad('bundle id changed — this would orphan existing users’ data')
else ok('bundle id com.nouriapps.ironverse')

const plist = readFileSync('ios/App/App/Info.plist', 'utf8')
for (const k of ['NSCameraUsageDescription', 'NSLocationWhenInUseUsageDescription', 'NSPhotoLibraryAddUsageDescription', 'ITSAppUsesNonExemptEncryption', 'NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription', 'NSFaceIDUsageDescription']) {
  if (!plist.includes(k)) bad('Info.plist missing ' + k)
}
ok('Info.plist permission strings present')

if (problems.length) { console.error(`\n${problems.length} problem(s).`); process.exit(1) }
console.log('\niOS build verified.')
