// ============================================================
// Barcode scanning + Open Food Facts lookup.
//
//  - Detection uses the native BarcodeDetector API where it exists (Android
//    Chrome, some iOS builds). It is feature-detected, never assumed — plenty
//    of iOS versions ship without it, and those users type the number instead.
//  - Lookup hits Open Food Facts (free, no key, good Australian coverage).
//  - EVERY successful lookup is cached into db.barcodeCache, and the cache is
//    checked FIRST, so a product scanned once works forever offline.
//  - Australian labels are printed in kJ; energy-kcal_100g is preferred and
//    energy-kj_100g is converted with kjToKcal when that's all there is.
// ============================================================

import { db } from '@/db'
import type { BarcodeEntry, DietTag } from '@/db/types'
import { kjToKcal } from '@/lib/energy'
import { autoDietTags } from '@/lib/halal'

// ---------- BarcodeDetector (not in TS's DOM lib) ----------

interface DetectedBarcodeLike {
  rawValue: string
  format?: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource | Blob | ImageBitmap) => Promise<DetectedBarcodeLike[]>
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

function detectorCtor(): BarcodeDetectorCtor | null {
  const g = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return typeof g.BarcodeDetector === 'function' ? g.BarcodeDetector : null
}

// Food products carry EAN/UPC codes. Code 128 / ITF on the same packaging are shipping or
// batch codes; reading one of those used to fetch an unrelated product (15 Nov 2026).
export const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/** True when this browser has a NATIVE decoder (Android Chrome etc). */
export function nativeDetectorSupported(): boolean {
  return detectorCtor() !== null
}

/**
 * True when barcodes can be decoded at all. Since v6 this is always true: when
 * the browser has no BarcodeDetector (every iPhone), a bundled ZXing decoder
 * runs instead — offline, on the phone, nothing uploaded.
 */
export function barcodeDetectorSupported(): boolean {
  return true
}

// ---------- ZXing fallback (lazy-loaded so it costs nothing until used) ----------
type ZX = typeof import('@zxing/library')
let zxPromise: Promise<ZX> | null = null
const loadZx = () => (zxPromise ??= import('@zxing/library'))

/**
 * v9 fix: ZXing's RGBLuminanceSource treats a Uint8ClampedArray as ONE byte per
 * pixel (greyscale). Canvas pixels are RGBA (4 bytes), so the old code fed it a
 * scrambled image and iPhone scans almost never decoded. Convert to luminance first.
 */
export function rgbaToLuminance(rgba: ArrayLike<number>, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (rgba[j] * 306 + rgba[j + 1] * 601 + rgba[j + 2] * 117) >> 10
  return out
}
export function decodeRGBA(ZX: ZX, reader: InstanceType<ZX['MultiFormatReader']>, rgba: ArrayLike<number>, w: number, h: number): string | null {
  const lum = new ZX.RGBLuminanceSource(rgbaToLuminance(rgba, w, h), w, h)
  for (const bin of [new ZX.HybridBinarizer(lum), new ZX.GlobalHistogramBinarizer(lum)]) {
    try {
      return reader.decode(new ZX.BinaryBitmap(bin)).getText()
    } catch { /* try the next binarizer */ } finally { reader.reset() }
  }
  return null
}

async function makeZxingDetector(): Promise<BarcodeDetectorLike> {
  const ZX = await loadZx()
  const hints = new Map()
  hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
    ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E,
    ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.ITF,
  ])
  hints.set(ZX.DecodeHintType.TRY_HARDER, true)
  const reader = new ZX.MultiFormatReader()
  reader.setHints(hints)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const decodeCanvas = (w: number, h: number): string | null => decodeRGBA(ZX, reader, ctx.getImageData(0, 0, w, h).data, w, h)
  return {
    async detect(source) {
      const src = source as HTMLVideoElement & ImageBitmap & HTMLImageElement
      const sw = (src as HTMLVideoElement).videoWidth || src.width
      const sh = (src as HTMLVideoElement).videoHeight || src.height
      if (!sw || !sh) return []
      // phone photos are 12MP — decode a ~1200px copy, plus a centre crop and a rotated copy
      const scale = Math.min(1, 1200 / Math.max(sw, sh))
      const w = Math.round(sw * scale), h = Math.round(sh * scale)
      const attempts: (() => [number, number])[] = [
        () => { canvas.width = w; canvas.height = h; ctx.drawImage(src, 0, 0, w, h); return [w, h] },
        () => { const cw = Math.round(sw * 0.7), ch = Math.round(sh * 0.5); const s2 = Math.min(1, 1200 / cw); canvas.width = Math.round(cw * s2); canvas.height = Math.round(ch * s2); ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height); return [canvas.width, canvas.height] },
        () => { canvas.width = h; canvas.height = w; ctx.save(); ctx.translate(h, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(src, 0, 0, w, h); ctx.restore(); return [h, w] },
      ]
      for (const draw of attempts) {
        const [cw, ch] = draw()
        const text = decodeCanvas(cw, ch)
        if (text) return [{ rawValue: text }]
      }
      return []
    },
  }
}

/** True when a live camera stream is even possible here. */
export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export const NO_DETECTOR_NOTE =
  "Couldn't start the barcode reader on this device. Type the number under the barcode instead — the lookup works exactly the same."

async function makeDetector(): Promise<BarcodeDetectorLike | null> {
  const Ctor = detectorCtor()
  if (!Ctor) {
    try { return await makeZxingDetector() } catch { return null }
  }
  try {
    let formats = PRODUCT_FORMATS
    if (Ctor.getSupportedFormats) {
      const supported = await Ctor.getSupportedFormats()
      const usable = PRODUCT_FORMATS.filter((f) => supported.includes(f))
      if (usable.length > 0) formats = usable
    }
    return new Ctor({ formats })
  } catch {
    try {
      return new Ctor()
    } catch {
      return null
    }
  }
}

/** Decode a barcode out of a still photo. Returns null when nothing is found. */
export async function detectBarcodeInImage(blob: Blob): Promise<string | null> {
  const detector = await makeDetector()
  if (!detector) return null
  let source: CanvasImageSource | Blob = blob
  let bitmap: ImageBitmap | null = null
  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(blob)
      source = bitmap
    } catch {
      /* fall back to passing the blob */
    }
  }
  try {
    const hits = await detector.detect(source as CanvasImageSource)
    const codes = hits.map((h) => normaliseBarcode(h.rawValue)).filter((c) => c.length >= 6)
    // prefer a code whose check digit is right; a misread one is still returned so lookup can explain
    return codes.find((c) => barcodeChecksumOk(c)) ?? codes[0] ?? null
  } catch {
    return null
  } finally {
    bitmap?.close()
  }
}

export interface LiveScanHandle {
  stop: () => void
}

/**
 * Drive a live camera scan into `video`, calling `onDetect` once with the first
 * code found. Always call `.stop()` — it releases the camera.
 */
// ---------- one camera stream for the whole visit ----------
// Phones (iPhone especially) ask for camera permission again whenever a page asks
// for a brand-new stream. So the stream is kept and handed to the next scan, and
// only released after a few idle minutes (the camera light goes off then).
let sharedStream: MediaStream | null = null
let releaseTimer: number | undefined
const KEEP_MS = 3 * 60_000
function streamAlive(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === 'live')
}
async function acquireCamera(): Promise<MediaStream> {
  if (releaseTimer !== undefined) { clearTimeout(releaseTimer); releaseTimer = undefined }
  if (streamAlive(sharedStream)) {
    sharedStream.getVideoTracks().forEach((t) => { t.enabled = true })
    return sharedStream
  }
  sharedStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    audio: false,
  })
  return sharedStream
}
function parkCamera() {
  if (!sharedStream) return
  sharedStream.getVideoTracks().forEach((t) => { t.enabled = false })
  if (releaseTimer !== undefined) clearTimeout(releaseTimer)
  releaseTimer = window.setTimeout(releaseCamera, KEEP_MS)
}
/** Really turn the camera off (also used when the app goes to the background). */
export function releaseCamera() {
  if (releaseTimer !== undefined) { clearTimeout(releaseTimer); releaseTimer = undefined }
  sharedStream?.getTracks().forEach((t) => t.stop())
  sharedStream = null
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseCamera() })
}

export async function startLiveScan(
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
  onError: (message: string) => void,
): Promise<LiveScanHandle> {
  let stopped = false
  let stream: MediaStream | null = null
  let raf = 0
  let timer: number | undefined
  let lastRead: string | null = null

  const stop = () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    if (timer !== undefined) clearTimeout(timer)
    if (stream) parkCamera()
    stream = null
    try {
      video.srcObject = null
    } catch {
      /* ignore */
    }
  }

  const detector = await makeDetector()
  if (!detector) {
    onError(NO_DETECTOR_NOTE)
    return { stop }
  }
  if (!cameraSupported()) {
    onError('This browser will not give the app camera access. Type the barcode number instead.')
    return { stop }
  }

  try {
    stream = await acquireCamera()
  } catch (err) {
    const name = (err as { name?: string })?.name ?? ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      onError('Camera access was blocked. Allow the camera in Settings, or type the barcode number.')
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      onError('No back camera was found. Type the barcode number instead.')
    } else {
      onError("Couldn't start the camera. Type the barcode number instead.")
    }
    return { stop }
  }
  if (stopped) {
    parkCamera()
    return { stop }
  }

  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  video.muted = true
  try {
    await video.play()
  } catch {
    /* autoplay can reject; the loop still works once the user taps */
  }

  const tick = async () => {
    if (stopped) return
    if (video.readyState >= 2) {
      try {
        const hits = await detector.detect(video)
        const code = hits.map((h) => normaliseBarcode(h.rawValue)).find((c) => c.length >= 8 && barcodeChecksumOk(c))
        // accept only when two frames in a row agree: a moving 1D barcode is easy to misread once
        if (code && code === lastRead) {
          stop()
          onDetect(code)
          return
        }
        lastRead = code ?? lastRead
      } catch {
        /* transient decode failures are normal; keep scanning */
      }
    }
    if (stopped) return
    // ~8fps is plenty and keeps the phone cool
    timer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => void tick())
    }, 120)
  }
  void tick()

  return { stop }
}

// ---------- barcode helpers ----------

export function normaliseBarcode(raw: string): string {
  return (raw ?? '').replace(/\D/g, '')
}

/** Loose sanity check — EAN-8/UPC-E through EAN-13/ITF-14. */
export function isPlausibleBarcode(code: string): boolean {
  const c = normaliseBarcode(code)
  return c.length >= 6 && c.length <= 14
}

/** GS1 mod-10 check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
function gtinCheckOk(c: string): boolean {
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return false
  const digits = c.split('').map(Number)
  const check = digits.pop() as number
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** UPC-E (8 digits) → the UPC-A it stands for. */
export function expandUpcE(c: string): string | null {
  if (!/^[01]\d{7}$/.test(c)) return null
  const [ns, d1, d2, d3, d4, d5, d6, chk] = c.split('')
  let body: string
  if ('012'.includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  return `${ns}${body}${chk}`
}

/**
 * True when the digits pass the barcode's own check digit. A camera that misreads one digit
 * almost always fails this, which is how a wrong product used to slip through.
 */
export function barcodeChecksumOk(raw: string): boolean {
  const c = normaliseBarcode(raw)
  if (gtinCheckOk(c)) return true
  const upca = c.length === 8 ? expandUpcE(c) : null
  return !!upca && gtinCheckOk(upca)
}

/** The same product written different ways (UPC-A 12 ↔ EAN-13 with a leading 0, UPC-E, GTIN-14). */
export function barcodeVariants(raw: string): string[] {
  const c = normaliseBarcode(raw)
  const out = [c]
  const upca = c.length === 8 ? expandUpcE(c) : null
  if (upca) out.push(upca, `0${upca}`)
  if (c.length === 12) out.push(`0${c}`)
  if (c.length === 13 && c.startsWith('0')) out.push(c.slice(1))
  if (c.length === 14 && c.startsWith('0')) out.push(c.slice(1), c.slice(2))
  return [...new Set(out)].filter((x) => x.length >= 8)
}

// ---------- product model ----------

export interface Per100g {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre?: number
  sugar?: number
  /** milligrams per 100g */
  sodium?: number
  satFat?: number
}

export interface ScannedProduct {
  barcode: string
  name: string
  brand?: string
  per100: Per100g
  servingGrams?: number
  servingName?: string
  dietTags: DietTag[]
  /** true when this came from the local cache rather than the network */
  cached: boolean
  fetchedAt: string
  /** set when the energy figure had to be converted from the kJ value */
  energyFromKj?: boolean
  /** set when the database calories were too low for its own macros and were recalculated (the old value) */
  energyCorrectedFrom?: number
  /** protein/carbs/fat in the database were for one serve of this many grams, not per 100 g — scaled back */
  macrosFromServing?: number
  /** how the record was mapped; older cache entries are refreshed */
  mapVersion?: number
  /** your own checked version of this barcode */
  userVerified?: boolean
}

export type BarcodeErrorKind = 'offline' | 'timeout' | 'not-found' | 'no-nutrition' | 'server' | 'bad-code' | 'unknown'

export class BarcodeError extends Error {
  kind: BarcodeErrorKind
  detail?: string
  constructor(kind: BarcodeErrorKind, message: string, detail?: string) {
    super(message)
    this.name = 'BarcodeError'
    this.kind = kind
    this.detail = detail
  }
}

// ---------- Open Food Facts ----------

const OFF_URL = (code: string) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`
const OFF_TIMEOUT_MS = 15_000

function n(v: unknown): number | undefined {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(',', '.'))
    if (isFinite(p)) return p
  }
  return undefined
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

/** Pull grams out of OFF's free-text serving size ('30 g', '2 biscuits (25g)'). */
export function parseServingGrams(raw: unknown, quantity: unknown): number | undefined {
  const q = n(quantity)
  if (q !== undefined && q > 0 && q < 5000) return Math.round(q)
  if (typeof raw !== 'string') return undefined
  const m = raw.match(/([\d.]+)\s*(g|ml)\b/i)
  if (m) {
    const v = parseFloat(m[1])
    if (isFinite(v) && v > 0 && v < 5000) return Math.round(v)
  }
  return undefined
}

interface OffNutriments {
  [key: string]: unknown
}

/**
 * Database calories that are clearly LOWER than the product's own protein, carbs and fat
 * add up to are a data-entry error (e.g. Yo Pro banana: listed 47 kcal/100g, macros say ~59,
 * the real label ~63). Energy can be higher than the macros (fibre, alcohol, polyols), but it
 * can't be meaningfully lower — so then the calories are rebuilt from the macros.
 */
/**
 * Open Food Facts records sometimes hold one serve's protein/carbs/fat in the per-100 g fields
 * while the energy is really per 100 g (Pauls protein yoghurt, 15 Nov 2026: 15.1 g protein "per
 * 100 g" on a 150 g pouch that has 10.1 g per 100 g). Then the macros only agree with the energy
 * after dividing by the serve size. Returns the scale to apply to the macros, or null.
 */
export function macrosLookPerServing(per100: { kcal: number; protein: number; carbs: number; fat: number; fibre?: number }, servingGrams?: number): number | null {
  if (!servingGrams || servingGrams < 20 || Math.abs(servingGrams - 100) < 5 || !(per100.kcal > 0)) return null
  const est = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9 + (per100.fibre ?? 0) * 2
  if (est < 15) return null
  const off = Math.abs(per100.kcal - est) / Math.max(per100.kcal, est)
  if (off <= 0.15) return null
  const scaled = (est * 100) / servingGrams
  const offScaled = Math.abs(per100.kcal - scaled) / Math.max(per100.kcal, scaled)
  return offScaled <= 0.12 ? 100 / servingGrams : null
}

export function correctEnergy<T extends { kcal: number; protein: number; carbs: number; fat: number; fibre?: number }>(per100: T): { per100: T; from?: number } {
  const { kcal, protein, carbs, fat } = per100
  if (!(protein > 0 || carbs > 0 || fat > 0)) return { per100 }
  const fromMacros = protein * 4 + carbs * 4 + fat * 9 + (per100.fibre ?? 0) * 2
  if (fromMacros >= 20 && kcal < fromMacros * 0.9) return { per100: { ...per100, kcal: Math.round(fromMacros) }, from: kcal }
  return { per100 }
}

/** Map an Open Food Facts product object into our shape. Exported for testing. */
/** bump when the mapping changes: cached products mapped before it are fetched again */
export const MAP_VERSION = 2

export function mapOffProduct(code: string, product: Record<string, unknown>): ScannedProduct {
  const nut = (product.nutriments ?? {}) as OffNutriments

  let kcal = n(nut['energy-kcal_100g'])
  let energyFromKj = false
  if (kcal === undefined) {
    const kj = n(nut['energy-kj_100g']) ?? (String(nut['energy_unit'] ?? '').toLowerCase() === 'kj' ? n(nut['energy_100g']) : undefined)
    if (kj !== undefined) {
      kcal = kjToKcal(kj)
      energyFromKj = true
    }
  }
  // OFF's plain energy_100g is always kJ, never kcal
  if (kcal === undefined && n(nut['energy_100g']) !== undefined) { kcal = kjToKcal(n(nut['energy_100g'])!); energyFromKj = true }

  let protein = n(nut['proteins_100g'])
  let carbs = n(nut['carbohydrates_100g'])
  let fat = n(nut['fat_100g'])

  if (kcal === undefined && protein === undefined && carbs === undefined && fat === undefined) {
    throw new BarcodeError(
      'no-nutrition',
      'That product is in Open Food Facts but has no nutrition data.',
      'Add it by hand from the label — you can save it as your own food so the scan works next time.',
    )
  }

  const sodiumG = n(nut['sodium_100g'])

  const name =
    (typeof product.product_name_en === 'string' && product.product_name_en.trim()) ||
    (typeof product.product_name === 'string' && product.product_name.trim()) ||
    (typeof product.generic_name === 'string' && product.generic_name.trim()) ||
    `Product ${code}`

  const brandsRaw = typeof product.brands === 'string' ? product.brands : ''
  const brand = brandsRaw.split(',')[0]?.trim() || undefined

  const ingredients =
    (typeof product.ingredients_text_en === 'string' && product.ingredients_text_en) ||
    (typeof product.ingredients_text === 'string' && product.ingredients_text) ||
    ''

  const tagSource = [name, brandsRaw, ingredients, String(product.categories ?? '')].join(' ')
  const dietTags = autoDietTags(tagSource)

  const servingGrams = parseServingGrams(product.serving_size, product.serving_quantity)
  const servingName =
    typeof product.serving_size === 'string' && product.serving_size.trim()
      ? product.serving_size.trim()
      : undefined

  // per-serve macros stored as per 100 g: scale them back before any calorie check
  const scale = macrosLookPerServing({ kcal: Math.round(kcal ?? 0), protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0, fibre: n(nut['fiber_100g']) }, servingGrams) ?? 1
  const sc = (v: number | undefined) => (v === undefined ? undefined : v * scale)
  protein = sc(protein); carbs = sc(carbs); fat = sc(fat)
  const fibre100 = sc(n(nut['fiber_100g'])), sugar100 = sc(n(nut['sugars_100g'])), sat100 = sc(n(nut['saturated-fat_100g']))
  const sodium100 = sc(sodiumG)

  const fixed = correctEnergy({
      kcal: Math.round(kcal ?? 0),
      protein: round1(protein ?? 0),
      carbs: round1(carbs ?? 0),
      fat: round1(fat ?? 0),
      fibre: fibre100 !== undefined ? round1(fibre100) : undefined,
  })

  return {
    energyCorrectedFrom: fixed.from,
    macrosFromServing: scale !== 1 ? servingGrams : undefined,
    mapVersion: MAP_VERSION,
    barcode: code,
    name: String(name).slice(0, 90),
    brand: brand?.slice(0, 60),
    per100: {
      kcal: fixed.per100.kcal,
      protein: round1(protein ?? 0),
      carbs: round1(carbs ?? 0),
      fat: round1(fat ?? 0),
      fibre: fibre100 !== undefined ? round1(fibre100) : undefined,
      sugar: sugar100 !== undefined ? round1(sugar100) : undefined,
      // OFF reports sodium in GRAMS per 100g; we store milligrams.
      sodium: sodium100 !== undefined ? Math.round(sodium100 * 1000) : undefined,
      satFat: sat100 !== undefined ? round1(sat100) : undefined,
    },
    servingGrams,
    servingName,
    dietTags,
    cached: false,
    fetchedAt: new Date().toISOString(),
    energyFromKj,
  }
}

/** How much to trust a scanned product's numbers (IV-06.11).
 *  high   — name, all four macros and calories agree (calories within 20% of 4·P + 4·C + 9·F)
 *  medium — usable, but converted from kJ, macros missing, or calories off by 20–35%
 *  low    — calories and macros clearly disagree, or most numbers are missing: check the label */
export function matchConfidence(p: ScannedProduct): { level: 'high' | 'medium' | 'low'; why: string } {
  const { kcal, protein, carbs, fat } = p.per100
  const fromMacros = protein * 4 + carbs * 4 + fat * 9
  const missing = [protein, carbs, fat].filter((v) => !v).length
  const named = !/^Product \d+$/.test(p.name)
  if (!kcal || (missing >= 2 && kcal > 40)) return { level: 'low', why: 'Most nutrition numbers are missing — check the label.' }
  const off = fromMacros > 0 ? Math.abs(kcal - fromMacros) / Math.max(kcal, fromMacros) : 1
  if (p.macrosFromServing) return { level: 'medium', why: `The database had protein, carbs and fat for one serve (${p.macrosFromServing} g) in its per-100 g boxes — scaled back to per 100 g. Check the label if you can.` }
  if (p.energyCorrectedFrom !== undefined) return { level: 'medium', why: `The database said ${p.energyCorrectedFrom} cal per 100 g, which is too low for its own protein, carbs and fat — recalculated to ${kcal}. Check the label if you can.` }
  if (off > 0.35 && kcal > 40) return { level: 'low', why: `Calories (${kcal}) do not match the macros (about ${Math.round(fromMacros)}) — check the label.` }
  if (off > 0.12 || p.energyFromKj || missing || !named) return { level: 'medium', why: p.energyFromKj ? 'Calories converted from kJ.' : !named ? 'No product name in the database.' : missing ? 'Some macros are missing.' : 'Calories and macros differ a little.' }
  return { level: 'high', why: 'Name, calories and macros all agree.' }
}

// ---------- cache ----------

function entryToProduct(e: BarcodeEntry): ScannedProduct {
  // products saved before the calorie check get the same correction when read back
  const fixed = correctEnergy({ kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fibre: e.fibre })
  return {
    energyCorrectedFrom: fixed.from,
    barcode: e.barcode,
    name: e.name,
    brand: e.brand,
    per100: {
      kcal: fixed.per100.kcal,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      fibre: e.fibre,
      sugar: e.sugar,
      sodium: e.sodium,
      satFat: e.satFat,
    },
    servingGrams: e.servingGrams,
    servingName: e.servingName,
    dietTags: e.dietTags ?? [],
    cached: true,
    fetchedAt: e.fetchedAt,
    userVerified: e.userVerified,
    mapVersion: e.mapVersion,
    macrosFromServing: e.macrosFromServing,
  }
}

function productToEntry(p: ScannedProduct): BarcodeEntry {
  return {
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    kcal: p.per100.kcal,
    protein: p.per100.protein,
    carbs: p.per100.carbs,
    fat: p.per100.fat,
    fibre: p.per100.fibre,
    sugar: p.per100.sugar,
    sodium: p.per100.sodium,
    satFat: p.per100.satFat,
    servingGrams: p.servingGrams,
    servingName: p.servingName,
    dietTags: p.dietTags,
    fetchedAt: p.fetchedAt,
    userVerified: p.userVerified,
    mapVersion: p.mapVersion,
    macrosFromServing: p.macrosFromServing,
  }
}

export async function cachedProduct(code: string): Promise<ScannedProduct | null> {
  try {
    for (const v of barcodeVariants(code)) {
      const row = await db.barcodeCache.get(v)
      if (row) return entryToProduct(row)
    }
    return null
  } catch {
    return null
  }
}

/** Save your own checked or typed-in product for this barcode. It wins over every database from now on. */
export async function saveUserProduct(p: ScannedProduct): Promise<ScannedProduct> {
  const fixed: ScannedProduct = { ...p, barcode: normaliseBarcode(p.barcode), userVerified: true, cached: true, energyCorrectedFrom: undefined, energyFromKj: false, fetchedAt: new Date().toISOString() }
  await db.barcodeCache.put(productToEntry(fixed))
  return fixed
}

/** 4·protein + 4·carbs + 9·fat (+2·fibre) against the calories you typed; a hint, not a block. */
export function macroCheck(per100: { kcal: number; protein: number; carbs: number; fat: number; fibre?: number }): string | null {
  const est = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9 + (per100.fibre ?? 0) * 2
  if (!per100.kcal || est < 20) return null
  const off = Math.abs(per100.kcal - est) / Math.max(per100.kcal, est)
  return off > 0.15 ? `Protein, carbs and fat add up to about ${Math.round(est)} cal per 100 g, but the calories say ${per100.kcal}. Double-check the label.` : null
}

export async function cacheProduct(p: ScannedProduct): Promise<void> {
  try {
    await db.barcodeCache.put(productToEntry(p))
  } catch {
    /* a failed cache write must never break a scan */
  }
}

/** Everything scanned before — shown as "recent scans" so offline still has a list. */
export async function recentScans(limit = 12): Promise<ScannedProduct[]> {
  try {
    const rows = await db.barcodeCache.orderBy('fetchedAt').reverse().limit(limit).toArray()
    return rows.map(entryToProduct)
  } catch {
    return []
  }
}

// ---------- lookup ----------

/**
 * Cache first, then Open Food Facts. Successful network hits are cached.
 * Throws BarcodeError with a human message for every failure path.
 */
export async function lookupBarcode(
  rawCode: string,
  opts: { forceRefresh?: boolean; signal?: AbortSignal } = {},
): Promise<ScannedProduct> {
  const code = normaliseBarcode(rawCode)
  if (!isPlausibleBarcode(code)) {
    throw new BarcodeError('bad-code', "That doesn't look like a barcode.", 'Product barcodes are 8 to 14 digits.')
  }

  // your own checked version always wins, even over "refresh"
  const hit = await cachedProduct(code)
  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  // products saved before the per-serve fix (MAP_VERSION) are fetched again when online
  const stale = !!hit && !hit.userVerified && (hit.mapVersion ?? 1) < MAP_VERSION && online
  if (hit && (hit.userVerified || (!opts.forceRefresh && !stale))) return hit

  // a misread digit fails the check digit; never look up a guess
  if (!barcodeChecksumOk(code)) {
    throw new BarcodeError('bad-code', "That barcode didn't read cleanly.", 'The last digit does not check out, so it was not looked up. Scan again holding steady, or type the number under the bars.')
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new BarcodeError(
      'offline',
      "You're offline and this one hasn't been scanned before.",
      'Anything you have scanned before still works offline. Otherwise add it by hand from the label.',
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onAbort)

  let res: Response
  try {
    // UPC-A (12) and EAN-13 with a leading 0 are the same product; try each way it may be stored
    const tries = barcodeVariants(code)
    res = await fetch(OFF_URL(tries[0]), { signal: controller.signal, headers: { accept: 'application/json' } })
    for (const v of tries.slice(1)) {
      if (res.status !== 404) {
        const peek = (await res.clone().json().catch(() => null)) as { status?: number } | null
        if (!peek || peek.status !== 0) break
      }
      res = await fetch(OFF_URL(v), { signal: controller.signal, headers: { accept: 'application/json' } })
    }
  } catch {
    if (controller.signal.aborted && !opts.signal?.aborted) {
      throw new BarcodeError('timeout', 'Open Food Facts took too long to answer.', 'Try again, or add it by hand.')
    }
    throw new BarcodeError(
      'offline',
      "Couldn't reach Open Food Facts.",
      'Check your connection. Previously scanned products still work offline.',
    )
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }

  if (res.status === 404) {
    throw new BarcodeError(
      'not-found',
      "That barcode isn't in Open Food Facts.",
      "It's a community database, so plenty of Australian products are missing. Add it by hand and save it as your own food.",
    )
  }
  if (!res.ok) {
    throw new BarcodeError('server', `Open Food Facts returned an error (${res.status}).`, 'Try again in a moment.')
  }

  let payload: Record<string, unknown>
  try {
    payload = (await res.json()) as Record<string, unknown>
  } catch {
    throw new BarcodeError('server', 'Open Food Facts sent back something unreadable.')
  }

  const status = payload.status
  const product = payload.product as Record<string, unknown> | undefined
  if (status === 0 || !product) {
    throw new BarcodeError(
      'not-found',
      "That barcode isn't in Open Food Facts.",
      "It's a community database, so plenty of Australian products are missing. Add it by hand and save it as your own food.",
    )
  }

  const mapped = mapOffProduct(code, product)
  await cacheProduct(mapped)
  return mapped
}

// ---------- portion maths ----------

export interface PortionMacros {
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre?: number
  sugar?: number
  sodium?: number
  satFat?: number
}

/** Scale a per-100g product to an arbitrary gram amount. */
export function portionOf(per100: Per100g, grams: number): PortionMacros {
  const f = (isFinite(grams) ? Math.max(0, grams) : 0) / 100
  const scale = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * f * 10) / 10)
  return {
    grams: Math.round(grams),
    kcal: Math.round(per100.kcal * f),
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
    fibre: scale(per100.fibre),
    sugar: scale(per100.sugar),
    sodium: per100.sodium === undefined ? undefined : Math.round(per100.sodium * f),
    satFat: scale(per100.satFat),
  }
}
