/** Open the iPhone Files / photo picker and resolve with the chosen file(s). */
export function pickFile(accept: string, multiple = false, capture?: 'environment' | 'user'): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    if (capture) input.setAttribute('capture', capture)
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => {
      resolve(input.files ? [...input.files] : [])
      input.remove()
    }
    // cancel: resolve empty on focus return without change (best-effort)
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (document.body.contains(input)) {
          resolve([])
          input.remove()
        }
      }, 700)
    }, { once: true })
    input.click()
  })
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
