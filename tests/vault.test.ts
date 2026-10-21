import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, isVault } from '@/lib/vault'

describe('IV-35 encrypted backup', () => {
  it('round-trips with the right passphrase, refuses the wrong one, never contains plaintext', async () => {
    const text = JSON.stringify({ format: 'ironverse-backup', secret: 'weigh-in 98.2' })
    const env = await encryptText(text, 'correct horse')
    expect(isVault(env)).toBe(true)
    expect(JSON.stringify(env)).not.toContain('98.2')
    expect(await decryptText(env, 'correct horse')).toBe(text)
    await expect(decryptText(env, 'wrong pass')).rejects.toThrow(/Wrong passphrase/)
  })
  it('rejects short passphrases', async () => { await expect(encryptText('x', 'short')).rejects.toThrow() })
})
