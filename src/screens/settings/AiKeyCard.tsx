// Anthropic API key for the photo calorie estimate.
// Rules, in order of importance:
//   1. never log it, never put it in a URL, never include it in a toast
//   2. once saved, only ever show the masked form
//   3. say plainly where it lives and where it goes
//
// The key is stored with setSetting(SETTING_KEYS.aiKey, …) in this device's
// IndexedDB, exactly like every other setting.

import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { Button, Card, ConfirmDialog, Input } from '@/components/ui'
import { SETTING_KEYS, getSetting, setSetting } from '@/db'
import { useUI } from '@/lib/store'
import { testAiKey } from '@/lib/vision'

/** 'sk-ant-api03-abc…wxyz' → 'sk-ant-...wxyz'. Never shows the middle. */
export function maskKey(key: string): string {
  const tail = key.slice(-4)
  return `sk-ant-...${tail}`
}

function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{16,}$/.test(key.trim())
}

export function AiKeyCard({ onChange }: { onChange?: (hasKey: boolean) => void } = {}) {
  const { toast } = useUI()
  const [saved, setSaved] = useState<string | null | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [reveal, setReveal] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; message: string } | 'busy' | null>(null)

  async function runTest() {
    setTest('busy')
    setTest(await testAiKey())
  }

  useEffect(() => {
    let live = true
    void getSetting<string>(SETTING_KEYS.aiKey, '').then((v) => {
      if (live) setSaved(v ? v : null)
    })
    return () => { live = false }
  }, [])

  async function save() {
    const key = draft.trim()
    if (!key) return
    await setSetting(SETTING_KEYS.aiKey, key)
    setSaved(key)
    setDraft('')
    setReveal(false)
    toast('API key saved on this device')
    onChange?.(true)
    void runTest()
  }

  async function clear() {
    await setSetting(SETTING_KEYS.aiKey, '')
    setSaved(null)
    setDraft('')
    toast('API key cleared')
    setTest(null)
    onChange?.(false)
  }

  const valid = looksLikeAnthropicKey(draft)

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-brand" />
          <span className="text-[14.5px] font-semibold text-ink">Anthropic API key</span>
        </div>

        <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">
          This is only used for the <span className="font-semibold text-ink">photo calorie estimate</span> —
          you snap a meal and it comes back with a rough breakdown. It is your own key
          from console.anthropic.com, it is stored only on this device, and the only
          place it is ever sent is <span className="font-semibold text-ink">api.anthropic.com</span>.
          Everything else in Ironverse works with no key and no internet.
        </p>

        {saved === undefined ? (
          <div className="mt-3 h-11 animate-pulse rounded-xl bg-surface3/60" />
        ) : saved ? (
          <>
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-surface3/70 px-3.5 py-3">
              <ShieldCheck size={17} className="shrink-0 text-emerald-500" />
              <span className="big-num min-w-0 flex-1 truncate text-[14px] text-ink">{maskKey(saved)}</span>
            </div>
            <p className="mt-2 text-[12px] text-ink3">
              Saved. The full key is never shown again — replace it by pasting a new one.
            </p>
            {test && test !== 'busy' && (
              <p className={`mt-2 text-[12.5px] font-medium ${test.ok ? 'text-emerald-500' : 'text-amber-400'}`}>{test.message}</p>
            )}
            <p className="mt-1 text-[11.5px] text-ink3">Testing is free — it only asks Anthropic whether the key is valid.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" full small disabled={test === 'busy'} onClick={() => void runTest()}>{test === 'busy' ? 'Testing…' : 'Test key'}</Button>
              <Button variant="secondary" full small onClick={() => setSaved('')}>Replace key</Button>
              <Button variant="danger" full small onClick={() => setClearing(true)}>Clear key</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2">
              <Input
                type={reveal ? 'text' : 'password'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="Anthropic API key"
              />
              <button
                type="button"
                aria-label={reveal ? 'Hide key' : 'Show key'}
                onClick={() => setReveal((r) => !r)}
                className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface3 text-ink2"
              >
                {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {draft.trim().length > 0 && !valid && (
              <p className="mt-1.5 text-[12px] font-medium text-amber-400">
                Anthropic keys start with “sk-ant-”. Double-check the paste.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button full small disabled={!valid} onClick={() => void save()}>Save key</Button>
              {saved === '' && (
                <Button variant="ghost" full small onClick={() => { setDraft(''); void getSetting<string>(SETTING_KEYS.aiKey, '').then((v) => setSaved(v || null)) }}>
                  Cancel
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={() => void clear()}
        title="Clear the API key?"
        message="The photo calorie estimate stops working until you paste a key back in. Nothing else is affected."
        confirmLabel="Clear key"
      />
    </>
  )
}
