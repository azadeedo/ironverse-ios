// ============================================================
// Read an Australian / NZ nutrition information panel from a photo, ON THE PHONE
// (Tesseract, files bundled in /ocr — nothing is uploaded). 15 Nov 2026: the database
// had a Monster can's per-can numbers in its per-100 mL boxes, which no maths can spot,
// so the label itself is the source of truth.
//
// AU/NZ panels (FSANZ Standard 1.2.8) have two number columns: per serving, then
// per 100 g / 100 mL. The LAST number on a nutrient line is the per-100 value.
// ============================================================

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

/** OCR reads a small "g" as "9": "0.79" → 0.7 g, "09" → 0 g, "10.19" → 10.1 g. Only used inside nutrient rows. */
function valuesIn(line: string): { v: number; unit: string }[] {
  const out: { v: number; unit: string }[] = []
  for (const m of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(kj|kcal|cal|ca|mg|µg|ug|g|ml|%)?(?![a-z])/gi)) {
    let raw = m[1], unit = (m[2] ?? '').toLowerCase()
    if (!unit && raw.length >= 2 && raw.endsWith('9')) { raw = raw.slice(0, -1).replace(/[.,]$/, ''); unit = 'g' }
    if (raw === '') continue
    out.push({ v: num(raw), unit })
  }
  return out.filter((x) => x.unit !== '%' && Number.isFinite(x.v))
}

/**
 * Pick the per-100 value from a two-column row. OCR often drops the decimal point ("4.5g" → "459"),
 * but the two columns must keep the label's own ratio (per 100 = per serve × 100 / serve size),
 * so the decimal placement that makes them agree is the right one.
 */
function per100From(vals: { v: number }[], serving?: number, maxG?: number): number | undefined {
  const last = vals[vals.length - 1].v
  const cands = (v: number) => [v, v / 10, v / 100].map((x) => Math.round(x * 100) / 100)
  if (serving && vals.length >= 2) {
    const k = 100 / serving
    const best: { x: number; off: number }[] = []
    // fewest decimal shifts wins a tie (0.3 / 0.2 over 0.03 / 0.02)
    cands(vals[vals.length - 2].v).forEach((a, ia) => cands(last).forEach((b, ib) => {
      const want = a * k, fit = Math.abs(b - want) / Math.max(b, want, 0.05)
      const off = fit + (ia + ib) * 0.02
      // the label's own energy caps every value (61 cal per 100 g can't hold 45 g of carbs)
      if (maxG !== undefined && b > maxG) return
      if (fit <= 0.12 && (!best[0] || off < best[0].off)) best[0] = { x: b, off }
    }))
    if (best[0]) return best[0].x
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
    if (cals.length >= 2) out.kcal = cals[cals.length - 1]
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
      const base = new URL('.', window.location.href).origin + '/ocr'
      return T.createWorker('eng', 1, { workerPath: `${base}/worker.min.js`, corePath: `${base}/core`, langPath: `${base}/lang`, gzip: true, workerBlobURL: false })
    })
    worker.catch(() => { worker = null })
  }
  return worker
}

/** Greyscale, more contrast and a sensible size: small label text reads far better (tested on his photos). */
async function prepare(photo: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(photo)
    const scale = Math.min(2.2, 2400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    const g = c.getContext('2d')!
    g.filter = 'grayscale(1) contrast(1.8)'
    g.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? photo), 'image/png'))
  } catch {
    return photo
  }
}

/** Read the panel in a photo (on the phone). */
export async function readNutritionLabel(photo: Blob): Promise<LabelReading> {
  const w = await getWorker()
  const { data } = await w.recognize(await prepare(photo))
  return parseNutritionPanel(data.text || '')
}
