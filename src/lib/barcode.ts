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

export const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf']

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
    const code = hits.map((h) => normaliseBarcode(h.rawValue)).find((c) => c.length >= 6)
    return code ?? null
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
        const code = hits.map((h) => normaliseBarcode(h.rawValue)).find((c) => c.length >= 6)
        if (code) {
          stop()
          onDetect(code)
          return
        }
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
export function correctEnergy<T extends { kcal: number; protein: number; carbs: number; fat: number; fibre?: number }>(per100: T): { per100: T; from?: number } {
  const { kcal, protein, carbs, fat } = per100
  if (!(protein > 0 || carbs > 0 || fat > 0)) return { per100 }
  const fromMacros = protein * 4 + carbs * 4 + fat * 9 + (per100.fibre ?? 0) * 2
  if (fromMacros >= 20 && kcal < fromMacros * 0.9) return { per100: { ...per100, kcal: Math.round(fromMacros) }, from: kcal }
  return { per100 }
}

/** Map an Open Food Facts product object into our shape. Exported for testing. */
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

  const protein = n(nut['proteins_100g'])
  const carbs = n(nut['carbohydrates_100g'])
  const fat = n(nut['fat_100g'])

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

  const fixed = correctEnergy({
      kcal: Math.round(kcal ?? 0),
      protein: round1(protein ?? 0),
      carbs: round1(carbs ?? 0),
      fat: round1(fat ?? 0),
      fibre: n(nut['fiber_100g']) !== undefined ? round1(n(nut['fiber_100g'])!) : undefined,
  })

  return {
    energyCorrectedFrom: fixed.from,
    barcode: code,
    name: String(name).slice(0, 90),
    brand: brand?.slice(0, 60),
    per100: {
      kcal: fixed.per100.kcal,
      protein: round1(protein ?? 0),
      carbs: round1(carbs ?? 0),
      fat: round1(fat ?? 0),
      fibre: n(nut['fiber_100g']) !== undefined ? round1(n(nut['fiber_100g'])!) : undefined,
      sugar: n(nut['sugars_100g']) !== undefined ? round1(n(nut['sugars_100g'])!) : undefined,
      // OFF reports sodium in GRAMS per 100g; we store milligrams.
      sodium: sodiumG !== undefined ? Math.round(sodiumG * 1000) : undefined,
      satFat: n(nut['saturated-fat_100g']) !== undefined ? round1(n(nut['saturated-fat_100g'])!) : undefined,
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
  }
}

export async function cachedProduct(code: string): Promise<ScannedProduct | null> {
  try {
    const row = await db.barcodeCache.get(normaliseBarcode(code))
    return row ? entryToProduct(row) : null
  } catch {
    return null
  }
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

  if (!opts.forceRefresh) {
    const hit = await cachedProduct(code)
    if (hit) return hit
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
    res = await fetch(OFF_URL(code), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
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
