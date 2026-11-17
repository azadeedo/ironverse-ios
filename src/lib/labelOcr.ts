// ============================================================
// Read an Australian / NZ nutrition information panel from a photo, ON THE PHONE
// (Tesseract, files bundled in /ocr — nothing is uploaded). 15 Nov 2026: the database
// had a Monster can's per-can numbers in its per-100 mL boxes, which no maths can spot,
// so the label itself is the source of truth.
//
// AU/NZ panels (FSANZ Standard 1.2.8) have two number columns: per serving, then
// per 100 g / 100 mL. The LAST number on a nutrient line is the per-100 value.
// ============================================================

import { Capacitor, registerPlugin } from '@capacitor/core'

export interface LabelReading {
  per100: { kcal?: number; protein?: number; fat?: number; satFat?: number; carbs?: number; sugar?: number; fibre?: number; sodium?: number }
  servingGrams?: number
  /** nutrients found, out of the six that matter most */
  found: number
  text: string
}

const num = (s: string) => parseFloat(s.replace(',', '.'))

type Key = keyof LabelReading['per100']
/** FSANZ panel order — used when a row's name is unreadable (thumb over the label, glare) */
const ORDER: Key[] = ['protein', 'fat', 'satFat', 'carbs', 'sugar', 'fibre', 'sodium']

/**
 * Numbers on a nutrient row. OCR reads a small "g" as "9" (and sometimes "4"): "0.79" is 0.7 g, "09" is 0 g,
 * "6.84" is 6.8 g. The plain reading `v` keeps the old rule (a trailing 9 with no unit is a "g");
 * `raw` keeps what was read so per100From can weigh every possible reading against the other column.
 */
type Val = { v: number; unit: string; raw: string; hadUnit: boolean }
function valuesIn(line: string): Val[] {
  const out: Val[] = []
  for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(kj|kcal|cal|ca|mg|µg|ug|g|ml|%)?(?![a-z])/gi)) {
    const raw0 = m[1].replace(',', '.')
    let raw = raw0, unit = (m[2] ?? '').toLowerCase()
    const hadUnit = !!unit
    if (!unit && raw.length >= 2 && raw.endsWith('9')) { raw = raw.slice(0, -1).replace(/[.]$/, ''); unit = 'g' }
    if (raw === '') continue
    out.push({ v: fixLead(raw), unit, raw: raw0, hadUnit })
  }
  return out.filter((x) => x.unit !== '%' && Number.isFinite(x.v))
}
/** "01" on a panel is "0.1" with the point lost (no label prints a leading zero otherwise) */
const fixLead = (s: string) => (/^0\d+$/.test(s) ? num('0.' + s.slice(1)) : num(s))

/** every way a token could be read, with a cost: a dropped unit letter, a lost decimal point */
function readings(t: Val): { x: number; cost: number }[] {
  const bases: { s: string; cost: number }[] = [{ s: t.raw, cost: 0 }]
  if (!t.hadUnit && t.raw.length >= 2 && /[94]$/.test(t.raw)) bases.push({ s: t.raw.slice(0, -1).replace(/[.]$/, ''), cost: t.raw.endsWith('9') ? 0.5 : 1 })
  const out: { x: number; cost: number }[] = []
  for (const b of bases) {
    if (b.s === '') continue
    const v = fixLead(b.s)
    if (!Number.isFinite(v)) continue
    ;[v, v / 10, v / 100].forEach((x, i) => out.push({ x: Math.round(x * 100) / 100, cost: b.cost + i }))
  }
  return out
}

/**
 * Pick the per-100 value from a two-column row. OCR loses decimal points ("4.5g" → "459") and unit
 * letters, but the two columns must keep the label's own ratio (per 100 = per serve × 100 / serve size),
 * so the reading that makes them agree is the right one. Labels round small values (0.1 g per serve
 * and per 100 g), so a small absolute gap is allowed too.
 */
function per100From(vals: Val[], serving?: number, maxG?: number): number | undefined {
  const lastT = vals[vals.length - 1]
  const last = lastT.v
  if (serving && vals.length >= 2) {
    const k = 100 / serving
    let best: { x: number; score: number } | undefined
    for (const a of readings(vals[vals.length - 2])) for (const b of readings(lastT)) {
      // the label's own energy caps every value (61 cal per 100 g can't hold 45 g of carbs)
      if (maxG !== undefined && b.x > maxG) continue
      const want = a.x * k, err = Math.abs(b.x - want), big = Math.max(b.x, want)
      if (err > Math.max(0.12 * big, 0.06)) continue
      const score = err / Math.max(big, 0.1) + (a.cost + b.cost) * 0.2
      if (!best || score < best.score) best = { x: b.x, score }
    }
    if (best) return best.x
  }
  return last > 100 || (maxG !== undefined && last > maxG) ? undefined : last
}

/** Parse OCR text of a nutrition panel. Exported for tests. */
export function parseNutritionPanel(text: string): LabelReading {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[|\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: LabelReading['per100'] = {}
  const sm = /serving size\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)/i.exec(text) ?? /size\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(g|ml|9)\b/i.exec(text)
  let serving = sm ? num(sm[1]) : undefined
  // the energy row: "kJ" may come out as "k)" or "ki", "Cal" as "Ca" or "CD"
  const i = lines.findIndex((l) => /energy/i.test(l) || /\d\s*k[j)i]\b|\d\s*k[j)i]\s*\(/i.test(l) || /\(\s*\d+(?:[.,]\d+)?\s*c[a-z)]/i.test(l))
  // the serving size line can be garbled ("Sr fe: 500 mL"): take the first "N g / N mL" above the energy row
  if (serving === undefined && i > 0) {
    for (const l of lines.slice(0, i)) { const m = /(\d+(?:[.,]\d+)?)\s*(ml|g)\b/i.exec(l); if (m && num(m[1]) >= 5) { serving = num(m[1]); break } }
  }
  if (i >= 0) {
    const low = lines[i].toLowerCase()
    // "Cal" may come out as "Ca", "Co", "CD" or "C)"
    const cals = [...low.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kcal|c[a-z)]{1,2})(?![a-z])/g)].map((m) => num(m[1]))
    const kjs = [...low.matchAll(/(\d+(?:[.,]\d+)?)\s*k[j)i]/g)].map((m) => num(m[1]))
    // two columns: the last one is per 100. With only one Cal read, the per-100 kJ is safer than
    // a Cal figure that may belong to the serving column (Monster: 11.8 Cal per can vs 2.36 per 100 mL)
    const lastKj = kjs.length ? kjs[kjs.length - 1] / 4.184 : undefined
    if (cals.length >= 2) out.kcal = cals[cals.length - 1]
    // one Cal read that agrees with the per-100 kJ: the printed Cal wins (61, not 61.19)
    else if (cals.length === 1 && kjs.length >= 2 && lastKj && Math.abs(cals[0] - lastKj) <= Math.max(0.05 * lastKj, 0.3)) out.kcal = cals[0]
    else if (kjs.length >= 2) out.kcal = Math.round((kjs[kjs.length - 1] / 4.184) * 100) / 100
    else if (cals.length === 1 && kjs.length <= 1) out.kcal = cals[0]
    else if (kjs.length === 1) out.kcal = Math.round((kjs[0] / 4.184) * 100) / 100
  }
  // rows after energy: named rows by name, unnamed rows by the panel's fixed order
  let pos = 0
  for (const l of lines.slice(i + 1)) {
    const low = l.toLowerCase()
    if (/composition|ingredient|contains|caffeine/.test(low)) break
    const vals = valuesIn(l)
    if (!vals.length) continue
    const named: Key | null = /protein/.test(low) ? 'protein' : /saturated/.test(low) ? 'satFat' : /\bfat\b/.test(low) ? 'fat'
      : /sugar|sears/.test(low) ? 'sugar' : /carbohydrate|carb/.test(low) ? 'carbs' : /fibre|fiber/.test(low) ? 'fibre' : /sodium|\bs[o0]{2}/.test(low) ? 'sodium' : null
    const isMg = vals.some((x) => x.unit === 'mg')
    const key: Key | undefined = named ?? (isMg ? 'sodium' : ORDER[pos])
    if (!key) continue
    // two-column panel with one number left on the row: the per-100 value is missing, leave it blank
    const cap = out.kcal && key !== 'sodium' ? (key === 'fat' || key === 'satFat' ? out.kcal / 9 : out.kcal / 4) * 1.15 + 0.5 : undefined
    // sodium: only trust it when both mg columns were read
    const use = key === 'sodium' ? vals.filter((x) => x.unit === 'mg') : vals
    const v = use.length >= 2 ? per100From(use, serving, cap) : undefined
    if (out[key] === undefined && v !== undefined) out[key] = v
    const at = ORDER.indexOf(key); if (at >= pos) pos = at + 1
    if (key === 'sodium') break
  }
  const found = (['kcal', 'protein', 'fat', 'carbs', 'sugar', 'sodium'] as const).filter((k) => out[k] !== undefined).length
  return { per100: out, servingGrams: serving, found, text }
}

let worker: Promise<{ recognize: (img: Blob) => Promise<{ data: { text: string } }> }> | null = null
function getWorker() {
  if (!worker) {
    worker = import('tesseract.js').then(async (T) => {
      // 17 Nov 2026: was `.origin + '/ocr'`, which is "null/ocr" inside the iPhone app (capacitor:// has no origin)
      const base = new URL('/ocr', window.location.href).href
      return T.createWorker('eng', 1, { workerPath: `${base}/worker.min.js`, corePath: `${base}/core`, langPath: `${base}/lang`, gzip: true, workerBlobURL: false })
    })
    worker.catch(() => { worker = null })
  }
  return worker
}

/**
 * Greyscale at a given size. 17 Nov 2026, tested on his Monster and yoghurt photos: plain greyscale at
 * the photo's own size reads best; strong contrast plus upscaling (the first version) wrecked the Monster
 * panel, so it is gone. Phone photos (4032 px) are brought down to about 2400 px.
 */
async function prepare(photo: Blob, maxScale: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(photo)
    const scale = Math.min(maxScale, 2400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    const g = c.getContext('2d')!
    g.filter = 'grayscale(1)'
    g.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? photo), 'image/png'))
  } catch {
    return photo
  }
}

/** how much to trust a reading: values found, then whether protein/carbs/fat agree with the calories */
export function readingScore(r: LabelReading): number {
  const p = r.per100
  let s = r.found + (r.servingGrams ? 0.5 : 0)
  if (p.kcal !== undefined && p.protein !== undefined && p.carbs !== undefined && p.fat !== undefined) {
    const est = p.protein * 4 + p.carbs * 4 + p.fat * 9
    if (Math.abs(est - p.kcal) <= Math.max(0.2 * p.kcal, 3)) s += 1
  }
  return s
}

/**
 * Safe to fill the form with? 17 Nov 2026: a tilted, blurry photo once read "35 g fat" off a can with none.
 * Only trust a reading whose calories were read AND whose protein/carbs/fat add up to them (4/4/9).
 */
export function trustworthy(r: LabelReading): boolean {
  const p = r.per100
  if (p.kcal === undefined || p.protein === undefined || p.carbs === undefined || p.fat === undefined) return false
  const est = p.protein * 4 + p.carbs * 4 + p.fat * 9
  return Math.abs(est - p.kcal) <= Math.max(0.2 * p.kcal, 3)
}

const goodEnough = (r: LabelReading) => r.found >= 6 || (r.found >= 5 && readingScore(r) >= r.found + 1.5)

/** Apple's own on-device text reader (Vision), through the app's TextReader plugin. iPhone app only. */
const TextReader = registerPlugin<{ read: (o: { image: string }) => Promise<{ text: string }> }>('TextReader')
async function readNative(photo: Blob): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('TextReader')) return null
  try {
    // greyscale JPEG at ≤2400 px with the camera's rotation applied, as base64
    const bmp = await createImageBitmap(photo, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const { text } = await TextReader.read({ image: c.toDataURL('image/jpeg', 0.9) })
    return text || ''
  } catch {
    return null
  }
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

/**
 * Read the panel in a photo, on the phone. In the iPhone app Apple's reader goes first (17 Nov 2026);
 * the bundled reader tries up to three sizes if that reading is weak, or in a browser. Best reading wins.
 */
export async function readNutritionLabel(photo: Blob): Promise<LabelReading> {
  let best: LabelReading | undefined
  const native = await readNative(photo)
  if (native !== null) {
    best = parseNutritionPanel(native)
    if (goodEnough(best)) return best
  }
  try {
    const w = await withTimeout(getWorker(), 30_000)
    for (const scale of [1, 1.5, 0.8]) {
      const { data } = await withTimeout(w.recognize(await prepare(photo, scale)), 30_000)
      const r = parseNutritionPanel(data.text || '')
      if (!best || readingScore(r) > readingScore(best)) best = r
      // all six read and the numbers agree with each other: no need to try again
      if (goodEnough(best)) break
    }
  } catch (e) {
    if (!best) throw e
  }
  return best!
}
