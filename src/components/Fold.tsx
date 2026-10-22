// A section heading you can tap to fold away (v10). Open by default; the choice
// is remembered on this device. Folding hides nothing permanently.
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const key = `fold:${id}`
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== '0' } catch { return true } })
  const flip = () => { const n = !open; setOpen(n); try { localStorage.setItem(key, n ? '1' : '0') } catch { /* private mode */ } }
  return (
    <>
      <button type="button" onClick={flip} aria-expanded={open} className="flex w-full items-center justify-between px-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink3">
        <span>{title}</span><ChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && children}
    </>
  )
}
