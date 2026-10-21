import { describe, expect, it } from 'vitest'
import { ANATOMY, anatomySets, heatHex, quizPick, searchAnatomy } from '@/lib/anatomy'
import { MUSCLE_LABELS, type Muscle } from '@/db/types'

describe('real anatomy body map', () => {
  it('every muscle has unique id, real names, full anatomy facts and a drawable shape', () => {
    const ids = new Set<string>()
    for (const m of ANATOMY) {
      expect(ids.has(m.id)).toBe(false); ids.add(m.id)
      for (const k of ['name', 'latin', 'origin', 'insertion', 'action', 'nerve'] as const) expect(m[k].length).toBeGreaterThan(3)
      expect(m.latin.startsWith('m')).toBe(true)
      expect(m.d.length > 0 || m.only3d).toBeTruthy()
      for (const d of m.d) { expect(d).toMatch(/^M[\d.,]+/); expect(d.trim().endsWith('Z')).toBe(true) }
      for (const t of m.train) expect(MUSCLE_LABELS[t]).toBeTruthy()
    }
  })
  it('covers every trainable group on at least one view', () => {
    const groups: Muscle[] = ['chest', 'front-delts', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'forearms', 'lats', 'traps', 'upper-back', 'lower-back', 'abs', 'obliques', 'quads', 'hamstrings', 'glutes', 'calves']
    for (const g of groups) expect(ANATOMY.some((m) => m.train.includes(g))).toBe(true)
    expect(ANATOMY.filter((m) => m.view === 'front').length).toBeGreaterThan(15)
    expect(ANATOMY.filter((m) => m.view === 'back').length).toBeGreaterThan(12)
  })
  it('colours a real muscle by the highest set count of its training groups', () => {
    const glute = ANATOMY.find((m) => m.id === 'glute-max')!
    expect(anatomySets(new Map([['glutes', 14]]) as Map<Muscle, number>, glute)).toBe(14)
    expect(heatHex(0)).toBe('#3b4a5e'); expect(heatHex(14)).toBe('#22c55e'); expect(heatHex(25)).toBe('#ef4444')
  })
  it('search finds by common name, latin and region; quiz never repeats the last muscle', () => {
    expect(searchAnatomy('soleus').map((m) => m.id)).toContain('soleus')
    expect(searchAnatomy('gluteus').length).toBeGreaterThanOrEqual(2)
    expect(searchAnatomy('').length).toBe(0)
    for (let i = 0; i < 20; i++) expect(quizPick('soleus').id).not.toBe('soleus')
  })
})
