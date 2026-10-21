import { create } from 'zustand'

interface UIState {
  toasts: { id: number; message: string; kind: 'success' | 'error' | 'info' }[]
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void
  dismissToast: (id: number) => void
  // live rest timer (survives navigation within the session)
  restEndsAt: number | null
  restTotalSec: number
  startRest: (sec: number) => void
  clearRest: () => void
}

let toastId = 0

export const useUI = create<UIState>((set) => ({
  toasts: [],
  toast: (message, kind = 'success') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  restEndsAt: null,
  restTotalSec: 0,
  startRest: (sec) => set({ restEndsAt: Date.now() + sec * 1000, restTotalSec: sec }),
  clearRest: () => set({ restEndsAt: null, restTotalSec: 0 }),
}))
