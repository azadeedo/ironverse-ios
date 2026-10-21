// ============================================================
// AI photo estimate (Anthropic Messages API, called straight from the browser
// with the OWNER'S OWN key).
//
// Rules this file lives by:
//  - The key is read from Dexie settings at call time and used for exactly one
//    thing: an Authorization header to api.anthropic.com. It is never logged,
//    never put in a URL, never sent anywhere else.
//  - The model is asked for STRICT JSON and the response is parsed
//    defensively — models sometimes wrap JSON in prose or fences.
//  - Nothing here writes to the food log. It returns an estimate; the user
//    confirms it.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { SETTING_KEYS, getSetting, setSetting } from '@/db'
import { isAppStoreEdition } from './edition'

export const AI_CONSENT_KEY = 'ai:consent'
export const AI_CONSENT_TEXT = [
  'Send this meal photo to Anthropic (Claude) for a calorie estimate?',
  'The photo is sent using YOUR Anthropic API key, straight from this iPhone to Anthropic — Ironverse has no server and keeps no copy. Anthropic handles it under its own privacy policy.',
  'Allow photo estimates?',
].join('\n\n')

export const VISION_MODEL = 'claude-opus-5-5'
const DEFAULT_TIMEOUT_MS = 45_000

/** One item the model claims to see on the plate. Matches DraftItem's shape. */
export interface VisionItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** 0..1 */
  confidence: number
}

export type VisionErrorKind =
  | 'no-key'
  | 'offline'
  | 'timeout'
  | 'auth'
  | 'rate-limit'
  | 'server'
  | 'parse'
  | 'empty'
  | 'image'
  | 'unknown'

export class VisionError extends Error {
  kind: VisionErrorKind
  /** longer explanation shown under the headline */
  detail?: string
  constructor(kind: VisionErrorKind, message: string, detail?: string) {
    super(message)
    this.name = 'VisionError'
    this.kind = kind
    this.detail = detail
  }
}

// ---------- key ----------

/** Read the stored key. Never log or expose the value itself. */
export async function getAiKey(): Promise<string> {
  const raw = await getSetting<string>(SETTING_KEYS.aiKey, '')
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function hasAiKey(): Promise<boolean> {
  return (await getAiKey()).length > 0
}

/**
 * Check a key without spending anything: asks Anthropic for the model's details
 * (a free metadata call). Returns a plain-English result; never echoes the key.
 */
export async function testAiKey(): Promise<{ ok: boolean; message: string }> {
  const key = await getAiKey()
  if (!key) return { ok: false, message: 'No key saved yet — paste one above first.' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, message: 'You are offline — connect to test the key.' }
  try {
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, timeout: 20_000, maxRetries: 0 })
    await client.models.retrieve(VISION_MODEL)
    return { ok: true, message: 'Key works — photo estimates are ready.' }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, message: 'Anthropic says this key is not valid. Copy it again from console.anthropic.com → API keys.' }
    if (err instanceof Anthropic.PermissionDeniedError) return { ok: false, message: 'This key is not allowed to use the model. Check the key’s workspace permissions at console.anthropic.com.' }
    if (err instanceof Anthropic.NotFoundError) return { ok: true, message: 'Key accepted by Anthropic.' }
    if (err instanceof Anthropic.RateLimitError) return { ok: true, message: 'Key accepted, but Anthropic says slow down — try a photo in a minute.' }
    if (err instanceof Anthropic.APIConnectionError) return { ok: false, message: 'Could not reach Anthropic — check your internet and try again.' }
    return { ok: false, message: 'Anthropic did not accept the test. Try again in a minute.' }
  }
}

/** The friendly explanation shown when no key is set. */
export const NO_KEY_HEADLINE = 'Photo estimates need your own Anthropic API key'
export const NO_KEY_DETAIL =
  'Paste a key from console.anthropic.com below (or in Settings) and the camera estimate turns on. ' +
  'It stays on this phone, is only ever sent to Anthropic, and each photo costs a few cents ' +
  'on your own account. Everything else in Ironverse keeps working offline without it.'

// ---------- prompt ----------

const SYSTEM_PROMPT = [
  'You estimate the food in a photo for a training log.',
  'Reply as JSON: {"items": [...]}.',
  'Each element: {"name": string, "grams": number, "kcal": number, "protein": number, "carbs": number, "fat": number, "confidence": number}.',
  'One element per distinct food component you can see (e.g. rice, grilled chicken, salad, sauce) — do not lump a plate into one row unless it genuinely is one food.',
  'grams is the portion actually visible in the photo. kcal/protein/carbs/fat are the totals FOR THAT PORTION, not per 100g.',
  'Energy is in calories (kcal), never kilojoules. Macros are grams.',
  'confidence is 0..1: how sure you are about the identification AND the portion size. Be honest — a hidden or ambiguous portion deserves a low number.',
  'Keep 4·protein + 4·carbs + 9·fat roughly consistent with kcal.',
  'If the photo contains no food at all, return {"items": []}.',
].join('\n')

/** guaranteed response shape (structured outputs) */
const VISION_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' },
          protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' }, confidence: { type: 'number' },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

const USER_PROMPT =
  'Identify everything edible in this photo and estimate the portion on the plate.'

// ---------- helpers ----------

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new VisionError('image', 'That photo could not be read.'))
    fr.onload = () => {
      const s = String(fr.result ?? '')
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    fr.readAsDataURL(blob)
  })
}

function mediaTypeFor(blob: Blob): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const t = (blob.type || '').toLowerCase()
  if (t === 'image/png') return 'image/png'
  if (t === 'image/webp') return 'image/webp'
  if (t === 'image/gif') return 'image/gif'
  return 'image/jpeg'
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    if (isFinite(n)) return n
  }
  return null
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Pull a JSON array out of whatever the model returned.
 * Tolerates: fenced blocks, a wrapping object ({items:[…]}, {foods:[…]}),
 * a single bare object, and leading/trailing prose.
 */
export function parseVisionJson(raw: string): VisionItem[] {
  let text = (raw ?? '').trim()
  if (!text) throw new VisionError('parse', 'The estimate came back empty.')

  // strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  const candidates: string[] = [text]
  const arrStart = text.indexOf('[')
  const arrEnd = text.lastIndexOf(']')
  if (arrStart >= 0 && arrEnd > arrStart) candidates.push(text.slice(arrStart, arrEnd + 1))
  const objStart = text.indexOf('{')
  const objEnd = text.lastIndexOf('}')
  if (objStart >= 0 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1))

  let parsed: unknown = undefined
  for (const c of candidates) {
    try {
      parsed = JSON.parse(c)
      break
    } catch {
      /* try the next shape */
    }
  }
  if (parsed === undefined) {
    throw new VisionError(
      'parse',
      "The estimate came back in a format I couldn't read.",
      'Try the photo again — a clearer, closer shot usually fixes it.',
    )
  }

  let list: unknown[]
  if (Array.isArray(parsed)) {
    list = parsed
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const wrapped = ['items', 'foods', 'food', 'results', 'data', 'estimate']
      .map((k) => obj[k])
      .find((v) => Array.isArray(v))
    if (Array.isArray(wrapped)) list = wrapped
    else if (typeof obj.name === 'string') list = [obj]
    else {
      throw new VisionError('parse', "The estimate came back in a format I couldn't read.")
    }
  } else {
    throw new VisionError('parse', "The estimate came back in a format I couldn't read.")
  }

  const items: VisionItem[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const name = typeof e.name === 'string' ? e.name.trim() : typeof e.food === 'string' ? String(e.food).trim() : ''
    const grams = num(e.grams) ?? num(e.weight) ?? num(e.portion_grams)
    const kcal = num(e.kcal) ?? num(e.calories) ?? num(e.energy_kcal)
    if (!name || grams === null || kcal === null) continue
    const protein = num(e.protein) ?? 0
    const carbs = num(e.carbs) ?? num(e.carbohydrates) ?? 0
    const fat = num(e.fat) ?? 0
    const conf = num(e.confidence)
    items.push({
      name: name.slice(0, 80),
      grams: Math.round(clamp(grams, 1, 5000)),
      kcal: Math.round(clamp(kcal, 0, 10000)),
      protein: Math.round(clamp(protein, 0, 1000) * 10) / 10,
      carbs: Math.round(clamp(carbs, 0, 1000) * 10) / 10,
      fat: Math.round(clamp(fat, 0, 1000) * 10) / 10,
      // some models answer 0-100 instead of 0-1
      confidence: conf === null ? 0.5 : clamp(conf > 1 ? conf / 100 : conf, 0, 1),
    })
  }

  if (items.length === 0) {
    throw new VisionError(
      'empty',
      'No food was recognised in that photo.',
      'Get the whole plate in frame with decent light, or add the items by hand.',
    )
  }
  return items
}

// ---------- the call ----------

interface EstimateOptions {
  signal?: AbortSignal
  timeoutMs?: number
  /** extra context typed by the user, e.g. "the rice bowl is a large" */
  hint?: string
}

/**
 * Send a (already compressed) image to Anthropic and return the parsed items.
 * Throws VisionError with a human message for every failure path.
 */
export async function estimateMealFromPhoto(
  image: Blob,
  opts: EstimateOptions = {},
): Promise<VisionItem[]> {
  const key = await getAiKey()
  if (!key) throw new VisionError('no-key', NO_KEY_HEADLINE, NO_KEY_DETAIL)

  // App Store build: ask once before any photo goes to a third-party AI service (App Review 5.1.2)
  if (isAppStoreEdition() && !(await getSetting<boolean>(AI_CONSENT_KEY, false))) {
    const yes = typeof window !== 'undefined' && window.confirm(AI_CONSENT_TEXT)
    if (!yes) throw new VisionError('no-key', 'Photo estimate not sent.', 'Nothing left your iPhone. You can add the meal by hand, or allow photo estimates next time.')
    await setSetting(AI_CONSENT_KEY, true)
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new VisionError(
      'offline',
      "You're offline — photo estimates need a connection.",
      'Barcode scans of things you\'ve scanned before still work offline, and you can always add the meal by hand.',
    )
  }

  const b64 = await blobToBase64(image)

  // Official SDK, straight from the browser with HIS key (stored only on this phone).
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: 1 })

  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: VISION_MODEL,
      max_tokens: 16000,
      // a quick visual estimate: low effort keeps it fast and cheap without losing accuracy on a plate photo
      output_config: { effort: 'low', format: { type: 'json_schema', schema: VISION_SCHEMA } },
      // if a safety classifier declines, Anthropic re-runs the request on its recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaTypeFor(image), data: b64 } },
            { type: 'text', text: opts.hint?.trim() ? `${USER_PROMPT}\n\nExtra context from me: ${opts.hint.trim()}` : USER_PROMPT },
          ],
        },
      ],
    }, { signal: opts.signal })
  } catch (err) {
    if (opts.signal?.aborted) throw new VisionError('unknown', 'Estimate cancelled.')
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new VisionError('auth', 'Anthropic rejected that API key.', 'Check the key in Settings — it should start with "sk-ant-" and still be active at console.anthropic.com.')
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new VisionError('rate-limit', 'Too many requests, or your Anthropic credit ran out.', 'Wait a minute and try again. If it keeps happening, check the billing balance on your Anthropic account.')
    }
    if (err instanceof Anthropic.BadRequestError) {
      // show the real reason instead of guessing it was the photo
      throw new VisionError('image', 'Anthropic could not process that request.', err.message.slice(0, 300))
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new VisionError('timeout', 'The estimate took too long and timed out.', 'Usually a slow connection. Try again, or add the meal by hand.')
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new VisionError('offline', "Couldn't reach Anthropic.", 'Check your connection and try again — nothing has been logged.')
    }
    if (err instanceof Anthropic.InternalServerError) {
      throw new VisionError('server', 'Anthropic is having trouble right now.', 'Try again in a moment.')
    }
    if (err instanceof Anthropic.APIError) {
      throw new VisionError('unknown', `The estimate failed (error ${err.status ?? '?'}).`, err.message.slice(0, 300))
    }
    throw new VisionError('unknown', 'The estimate failed.', err instanceof Error ? err.message : undefined)
  }

  if (response.stop_reason === 'refusal') {
    throw new VisionError('empty', "That photo couldn't be estimated.", 'Try a different photo of the meal, or add it by hand.')
  }
  const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n')
  if (!text.trim()) throw new VisionError('empty', 'The estimate came back empty.', 'Try the photo again.')
  return parseVisionJson(text)
}

/** Rough running cost note shown in the UI — honest, not a promise. */
export const COST_NOTE = 'Each photo costs a few cents on your own Anthropic account.'
