// IV-35 — optional passphrase-encrypted backups (AES-GCM 256, key from
// PBKDF2-SHA256 250k iterations). Runs entirely on the device with WebCrypto.
// The passphrase is never stored: lose it and the file cannot be opened.

export const VAULT_FORMAT = 'ironverse-encrypted-backup'
export interface VaultEnvelope { format: typeof VAULT_FORMAT; v: 1; kdf: 'PBKDF2-SHA256'; iter: number; salt: string; iv: string; data: string }

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
const unb64 = (s: string): Uint8Array<ArrayBuffer> => { const u = new Uint8Array(new ArrayBuffer(atob(s).length)); const a = atob(s); for (let i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u }

async function key(pass: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptText(text: string, pass: string): Promise<VaultEnvelope> {
  if (pass.length < 8) throw new Error('Use a passphrase of at least 8 characters')
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 250_000
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt, iter), new TextEncoder().encode(text)))
  return { format: VAULT_FORMAT, v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), data: b64(ct) }
}

export function isVault(x: unknown): x is VaultEnvelope {
  return !!x && typeof x === 'object' && (x as { format?: string }).format === VAULT_FORMAT
}

export async function decryptText(env: VaultEnvelope, pass: string): Promise<string> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, await key(pass, unb64(env.salt), env.iter), unb64(env.data))
    return new TextDecoder().decode(pt)
  } catch { throw new Error('Wrong passphrase (or the file was changed)') }
}
