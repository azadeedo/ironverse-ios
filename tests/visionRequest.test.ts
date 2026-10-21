import { afterEach, describe, expect, it, vi } from 'vitest'
import { setSetting, SETTING_KEYS } from '@/db'
import { estimateMealFromPhoto, VISION_MODEL } from '@/lib/vision'

describe('photo calorie estimate request', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('uses the current model, no assistant prefill, structured JSON, and parses the items', async () => {
    await setSetting(SETTING_KEYS.aiKey, 'sk-ant-test-not-real')
    vi.stubGlobal('FileReader', class { result: string | null = null; onload: (() => void) | null = null; onerror: (() => void) | null = null
      readAsDataURL() { this.result = 'data:image/jpeg;base64,/9j/'; setTimeout(() => this.onload?.(), 0) } })
    let sent: { url: string; body: Record<string, unknown>; headers: Headers } | null = null
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      sent = { url: u, body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) }
      return new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: VISION_MODEL, stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [{ type: 'text', text: JSON.stringify({ items: [{ name: 'Grilled chicken', grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5, confidence: 0.8 }] }) }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    const items = await estimateMealFromPhoto(new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' }))
    expect(items[0]).toMatchObject({ name: 'Grilled chicken', kcal: 248, protein: 46 })
    expect(sent!.url).toContain('api.anthropic.com/v1/messages')
    expect(sent!.body.model).toBe('claude-opus-5-5')
    const msgs = sent!.body.messages as { role: string }[]
    expect(msgs[msgs.length - 1].role).toBe('user') // no prefilled assistant turn
    expect((sent!.body.output_config as { format: { type: string } }).format.type).toBe('json_schema')
    expect(sent!.headers.get('x-api-key')).toBe('sk-ant-test-not-real')
  })
})
