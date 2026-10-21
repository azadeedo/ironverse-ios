// Smart Touch Hub design system — iOS-feel primitives.
// Import from '@/components/ui'.

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import { getSetting, setSetting } from '@/db'
import { useUI } from '@/lib/store'
import { useUndo } from '@/lib/undo'

// ---------- Button ----------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export function Button({
  children, variant = 'primary', className = '', full, small, type = 'button', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; full?: boolean; small?: boolean }) {
  const base = 'pressable inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl2 disabled:opacity-40 disabled:pointer-events-none'
  const size = small ? 'px-3 py-2 text-[13px] rounded-xl' : 'px-4 py-3 text-[15px]'
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-brand text-white',
    secondary: 'bg-surface3 text-ink',
    ghost: 'text-brand bg-transparent',
    danger: 'bg-red-600/10 text-red-500',
    outline: 'border border-line text-ink bg-surface2',
  }
  return (
    <button type={type} className={`${base} ${size} ${variants[variant]} ${full ? 'w-full' : ''} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function IconButton({ children, className = '', label, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface3 text-ink ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------- Card ----------
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-surface2 shadow-card ${onClick ? 'pressable cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, tone = 'default', onClick }: {
  label: string; value: string; sub?: string; tone?: 'default' | 'brand' | 'green' | 'amber' | 'red'; onClick?: () => void
}) {
  const tones = {
    default: 'text-ink',
    brand: 'text-brand',
    green: 'text-emerald-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  }
  return (
    <Card className="p-4" onClick={onClick}>
      <div className="text-[12px] font-medium uppercase tracking-wide text-ink3">{label}</div>
      <div className={`mt-1 text-[22px] font-bold leading-tight ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink2">{sub}</div>}
    </Card>
  )
}

// ---------- Page scaffolding ----------
export function PageHeader({ title, back, actions, large = true, subtitle }: {
  title: string; back?: string | boolean; actions?: ReactNode; large?: boolean; subtitle?: string
}) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-30 bg-surface/85 pt-safe backdrop-blur-xl">
      <div className="flex min-h-[52px] items-center gap-2 px-4 py-2">
        {back && (
          <button
            type="button"
            className="pressable -ml-2 flex h-9 items-center gap-0.5 pr-2 text-brand"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          >
            <ChevronLeft size={26} strokeWidth={2.4} />
            <span className="text-[15px] font-medium">Back</span>
          </button>
        )}
        {!large && <h1 className="flex-1 truncate text-[17px] font-semibold">{title}</h1>}
        {large && <div className="flex-1" />}
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {large && (
        <div className="px-4 pb-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-ink2">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}

export function Section({ title, children, action, className = '' }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`px-4 ${className}`}>
      {(title || action) && (
        <div className="mb-2 mt-5 flex items-center justify-between">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function EmptyState({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-ink3">{icon}</div>}
      <div className="text-[16px] font-semibold text-ink">{title}</div>
      {subtitle && <div className="max-w-[280px] text-[13px] text-ink2">{subtitle}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// ---------- List ----------
export function ListRow({ title, subtitle, right, onClick, leading, chevron = true, className = '' }: {
  title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; leading?: ReactNode; chevron?: boolean; className?: string
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-[56px] items-center gap-3 px-4 py-2.5 ${onClick ? 'pressable cursor-pointer' : ''} ${className}`}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] text-ink2">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
      {onClick && chevron && <ChevronRight size={18} className="shrink-0 text-ink3" />}
    </div>
  )
}

export function ListGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`divide-y divide-line overflow-hidden ${className}`}>{children}</Card>
}

// ---------- Badge ----------
const BADGE_TONES: Record<string, string> = {
  gray: 'bg-surface3 text-ink2',
  brand: 'bg-brand/12 text-brand',
  green: 'bg-emerald-500/12 text-emerald-500',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/12 text-red-500',
  blue: 'bg-blue-500/12 text-blue-500',
  purple: 'bg-purple-500/12 text-purple-500',
}
export function Badge({ children, tone = 'gray', className = '' }: { children: ReactNode; tone?: keyof typeof BADGE_TONES; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${BADGE_TONES[tone] ?? BADGE_TONES.gray} ${className}`}>
      {children}
    </span>
  )
}

// ---------- Inputs ----------
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink3 focus:border-brand ${className}`}
        {...rest}
      />
    )
  },
)

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink3 focus:border-brand ${className}`}
        rows={3}
        {...rest}
      />
    )
  },
)

export function Select({ className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full appearance-none rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[16px] text-ink outline-none focus:border-brand ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 text-[13px] font-medium text-ink2">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[12px] text-ink3">{hint}</div>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-surface3'}`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
      />
    </button>
  )
}

// ---------- Segmented control ----------
export function Segmented<T extends string>({ options, value, onChange, className = '' }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string
}) {
  return (
    <div className={`flex rounded-xl bg-surface3 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            value === o.value ? 'bg-surface2 text-ink shadow-sm' : 'text-ink2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** horizontally scrollable filter chips */
export function Chips<T extends string>({ options, value, onChange, allLabel }: {
  options: T[]; value: T | null; onChange: (v: T | null) => void; allLabel?: string
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1">
      {allLabel && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${value === null ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}
        >
          {allLabel}
        </button>
      )}
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o === value ? null : o)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${value === o ? 'bg-brand text-white' : 'bg-surface3 text-ink2'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// ---------- Sheet (bottom sheet) ----------
export function Sheet({ open, onClose, title, children, tall }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean
}) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="fade-in absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className={`sheet-up absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-surface2 shadow-sheet ${tall ? 'top-[8svh]' : 'max-h-[86svh]'}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line" />
        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <IconButton onClick={onClose} label="Close" className="h-8 w-8">
            <X size={17} />
          </IconButton>
        </div>
        <div className="scroll-y flex-1 px-4 pb-8 pt-1" style={{ paddingBottom: 'calc(var(--sab) + 24px)' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------- Modal / confirm ----------
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="fade-in absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="scale-in relative w-full max-w-sm rounded-2xl bg-surface2 p-5 shadow-sheet">
        {title && <h2 className="mb-2 text-[17px] font-bold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: string; confirmLabel?: string; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && <p className="mb-4 text-[14px] text-ink2">{message}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" full onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} full onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

// ---------- FAB ----------
export function Fab({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  // Rendered into <body>: the page wrapper animates with a CSS transform, and a
  // position:fixed child of a transformed element scrolls WITH the page on iOS.
  return createPortal(
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="pressable fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30"
      style={{ bottom: 'calc(var(--sab) + 72px)' }}
    >
      {children}
    </button>,
    document.body,
  )
}

// ---------- Search bar ----------
export function SearchBar({ value, onChange, placeholder = 'Search', autoFocus, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; className?: string
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-surface3 px-3 py-2 ${className}`}>
      <Search size={17} className="shrink-0 text-ink3" />
      <input
        autoFocus={autoFocus}
        className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="shrink-0 text-ink3">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// ---------- Progress ----------
export function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-surface3 ${className}`}>
      <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand ${className}`} />
  )
}

// ---------- Toast host ----------
// ADDITIVE (v4): the toast API is unchanged — `useUI().toast(msg, kind)` still
// behaves exactly as before for every existing caller. What's new is the undo
// pill underneath, which only appears when something is genuinely restorable,
// and the one-time app-preferences boot.
export function ToastHost() {
  const toasts = useUI((s) => s.toasts)
  const pending = useUndo((s) => s.pending)
  const runUndo = useUndo((s) => s.run)

  useEffect(() => { void initAppPrefs() }, [])

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ top: 'calc(var(--sat) + 10px)' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={`toast-in pointer-events-auto max-w-sm rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-lg ${
            t.kind === 'error' ? 'bg-red-600' : t.kind === 'info' ? 'bg-zinc-800' : 'bg-emerald-600'
          }`}
        >
          {t.message}
        </div>
      ))}
      {pending && (
        <div className="toast-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-full bg-zinc-800 py-1.5 pl-4 pr-1.5 text-white shadow-lg">
          <span className="truncate text-[13px] font-medium text-white/80">{pending.label}</span>
          <button
            type="button"
            onClick={() => void runUndo()}
            aria-label={`${pending.actionLabel} — ${pending.label}`}
            className={`pressable inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-bold text-white ${FOCUS_RING}`}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {pending.actionLabel}
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}

// ============================================================
// v4 ADDITIONS — app-wide primitives.
// Everything below is NEW. Nothing above was removed or renamed.
// ============================================================

// ---------- focus + tap-target helpers ----------

/** Keyboard-only focus ring. Append to any interactive element's className. */
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

/** The minimum comfortable tap target — sweaty hands between supersets. */
export const TAP_TARGET = 'min-h-[44px] min-w-[44px]'

// ---------- app preferences (font size + haptics/sound) ----------

/**
 * Settings keys owned by this module. Named with the same `namespace:key`
 * convention as SETTING_KEYS in @/db, which we can't extend from here.
 */
export const UI_SETTING_KEYS = {
  prefs: 'ui:prefs',
  whatsNewSeen: 'ui:whatsNewSeenVersion',
} as const

/** What a feedback pulse is FOR — each is opted into separately. */
export type FeedbackCategory = 'set' | 'button' | 'timer' | 'pr'

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, { label: string; hint: string }> = {
  set: { label: 'Set completed', hint: 'A light tap when you tick a set off.' },
  button: { label: 'Buttons & toggles', hint: 'Every tap through the app.' },
  timer: { label: 'Rest timer finished', hint: 'When the rest countdown reaches zero.' },
  pr: { label: 'Personal record', hint: 'When a set beats your previous best.' },
}

export const FONT_SCALES = [0.9, 1, 1.1, 1.25, 1.4] as const
export type FontScale = (typeof FONT_SCALES)[number]

export const FONT_SCALE_LABELS: Record<string, string> = {
  '0.9': 'Compact',
  '1': 'Default',
  '1.1': 'Large',
  '1.25': 'Larger',
  '1.4': 'Largest',
}

export interface AppPrefs {
  haptics: Record<FeedbackCategory, boolean>
  sound: Record<FeedbackCategory, boolean>
  fontScale: number
}

/** Everything off except a light tap on set completion. */
export const DEFAULT_APP_PREFS: AppPrefs = {
  haptics: { set: true, button: false, timer: false, pr: false },
  sound: { set: false, button: false, timer: false, pr: false },
  fontScale: 1,
}

interface AppPrefsState {
  prefs: AppPrefs
  loaded: boolean
  patch: (p: Partial<AppPrefs>) => Promise<void>
  setHaptic: (c: FeedbackCategory, on: boolean) => Promise<void>
  setSound: (c: FeedbackCategory, on: boolean) => Promise<void>
  setFontScale: (v: number) => Promise<void>
}

function mergePrefs(raw: unknown): AppPrefs {
  const r = (raw ?? {}) as Partial<AppPrefs>
  return {
    haptics: { ...DEFAULT_APP_PREFS.haptics, ...(r.haptics ?? {}) },
    sound: { ...DEFAULT_APP_PREFS.sound, ...(r.sound ?? {}) },
    fontScale: typeof r.fontScale === 'number' && r.fontScale >= 0.8 && r.fontScale <= 1.6
      ? r.fontScale
      : DEFAULT_APP_PREFS.fontScale,
  }
}

export const useAppPrefs = create<AppPrefsState>((set, get) => ({
  prefs: DEFAULT_APP_PREFS,
  loaded: false,
  async patch(p) {
    const next = mergePrefs({ ...get().prefs, ...p })
    set({ prefs: next })
    applyFontScale(next.fontScale)
    try { await setSetting(UI_SETTING_KEYS.prefs, next) } catch { /* prefs are a nicety, never fatal */ }
  },
  async setHaptic(c, on) {
    await get().patch({ haptics: { ...get().prefs.haptics, [c]: on } })
    if (on) vibrate(c)
  },
  async setSound(c, on) {
    await get().patch({ sound: { ...get().prefs.sound, [c]: on } })
    if (on) beep(c)
  },
  async setFontScale(v) {
    await get().patch({ fontScale: v })
  },
}))

let prefsBoot: Promise<void> | null = null

/** Load stored prefs once and apply the font scale. Safe to call repeatedly. */
export function initAppPrefs(): Promise<void> {
  if (prefsBoot) return prefsBoot
  prefsBoot = (async () => {
    try {
      const raw = await getSetting<unknown>(UI_SETTING_KEYS.prefs, null)
      const prefs = mergePrefs(raw)
      useAppPrefs.setState({ prefs, loaded: true })
      applyFontScale(prefs.fontScale)
    } catch {
      useAppPrefs.setState({ loaded: true })
    }
  })()
  return prefsBoot
}

/**
 * Scale the whole app. `zoom` scales the px-based type the app is built on;
 * the root font-size keeps rem-based spacing in step. Both are ignored
 * gracefully by engines that don't support them.
 */
export function applyFontScale(scale: number): void {
  if (typeof document === 'undefined') return
  const s = Math.min(1.6, Math.max(0.8, scale || 1))
  const root = document.documentElement as HTMLElement & { style: CSSStyleDeclaration }
  root.style.setProperty('--font-scale', String(s))
  root.style.fontSize = `${16 * s}px`
  ;(document.body.style as CSSStyleDeclaration & { zoom?: string }).zoom = s === 1 ? '' : String(s)
}

// ---------- haptics + sound ----------

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const VIBRATE_PATTERN: Record<FeedbackCategory, number | number[]> = {
  set: 12,
  button: 8,
  timer: [0, 40, 60, 40],
  pr: [0, 25, 50, 25, 50, 60],
}

const TONE: Record<FeedbackCategory, { hz: number; ms: number }> = {
  set: { hz: 880, ms: 60 },
  button: { hz: 660, ms: 40 },
  timer: { hz: 520, ms: 180 },
  pr: { hz: 1046, ms: 140 },
}

/** Vibrate for a category regardless of preference. Silent where unsupported. */
export function vibrate(category: FeedbackCategory): void {
  if (!canVibrate()) return
  try { navigator.vibrate(VIBRATE_PATTERN[category]) } catch { /* no vibration motor */ }
}

let audioCtx: AudioContext | null = null

/** Short tone for a category regardless of preference. Silent on failure. */
export function beep(category: FeedbackCategory): void {
  try {
    const Ctor = (window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    })
    const AC = Ctor.AudioContext ?? Ctor.webkitAudioContext
    if (!AC) return
    audioCtx ??= new AC()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const { hz, ms } = TONE[category]
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = hz
    const now = audioCtx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + ms / 1000 + 0.02)
  } catch {
    // no audio output, autoplay blocked, context limit — all fine, stay quiet
  }
}

/**
 * The one call sites use. Fires whatever the user has opted into for this
 * category, and does nothing at all when they've opted into nothing.
 */
export function feedback(category: FeedbackCategory): void {
  const { prefs } = useAppPrefs.getState()
  if (prefs.haptics[category]) vibrate(category)
  if (prefs.sound[category]) beep(category)
}

// ---------- anchored / highlightable section ----------

/**
 * A section wrapper with a stable id, so search and the Settings filter can
 * scroll to it and flash it. `highlight` respects prefers-reduced-motion:
 * reduced motion gets a static ring instead of a pulse.
 */
export function AnchorSection({ id, highlight = false, children, className = '' }: {
  id: string; highlight?: boolean; children: ReactNode; className?: string
}) {
  return (
    <div
      id={`section-${id}`}
      data-section={id}
      className={`scroll-mt-24 rounded-2xl transition-shadow duration-300 ${
        highlight ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface motion-safe:animate-pulse' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

/** Scroll a section into view and return true if it existed. */
export function scrollToSection(id: string): boolean {
  const el = document.getElementById(`section-${id}`)
  if (!el) return false
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
  return true
}

// ---------- quick action tile ----------

export function QuickAction({ icon, label, sub, onClick, tint = 'text-brand', bg = 'bg-brand/12', disabled }: {
  icon: ReactNode; label: string; sub?: string; onClick: () => void
  tint?: string; bg?: string; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={sub ? `${label} — ${sub}` : label}
      className={`pressable ${TAP_TARGET} ${FOCUS_RING} flex min-h-[92px] flex-col items-start gap-2 rounded-2xl bg-surface2 p-3.5 text-left shadow-card disabled:opacity-40`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${tint}`} aria-hidden="true">
        {icon}
      </span>
      <span className="w-full">
        <span className="block text-[13.5px] font-bold leading-tight text-ink">{label}</span>
        {sub && <span className="mt-0.5 block text-[11.5px] leading-tight text-ink3">{sub}</span>}
      </span>
    </button>
  )
}

// ---------- callout ----------

const CALLOUT_TONES = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  neutral: 'border-line bg-surface3/50 text-ink2',
} as const

export function Callout({ tone = 'neutral', icon, children, className = '' }: {
  tone?: keyof typeof CALLOUT_TONES; icon?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl2 border p-3 ${CALLOUT_TONES[tone]} ${className}`}>
      {icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>}
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed">{children}</div>
    </div>
  )
}

// ---------- meter (labelled progress, accessible) ----------

export function Meter({ value, target, label, valueLabel, tone = 'brand' }: {
  value: number; target: number; label: string; valueLabel?: string
  tone?: 'brand' | 'green' | 'amber'
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0
  const fill = tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand'
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(target)}
      aria-valuetext={valueLabel}
    >
      <div className="h-2 overflow-hidden rounded-full bg-surface3">
        <div className={`h-full rounded-full ${fill} motion-safe:transition-[width] motion-safe:duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---------- skeleton ----------

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-surface3 motion-safe:animate-pulse ${className}`} aria-hidden="true" />
}
