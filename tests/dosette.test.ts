import { describe, expect, it } from 'vitest'
import { STARTER, compartment, onDay, stockStatus, weeklyFill, missStreak, takenKey, type DosetteState } from '@/lib/dosette'

const training = [2, 3, 4, 5]
describe('pill box', () => {
  it('daily, training-day, weekly and as-needed rules', () => {
    const el = STARTER.find((x) => x.id === 'electro')!
    expect(onDay(el, 2, training)).toBe(true); expect(onDay(el, 0, training)).toBe(false)
    const d50 = STARTER.find((x) => x.id === 'd3-50k')!
    expect(BOX(d50)).toEqual([0])
    expect(onDay(STARTER.find((x) => x.id === 'melatonin')!, 1, training)).toBe(false)
    expect(compartment(STARTER, 0, 'bed', training).map((x) => x.id)).toContain('magnesium')
  })
  it('weekly totals: magnesium 2 × 7 = 14, electrolytes 4 training days', () => {
    const W = weeklyFill(STARTER, training)
    expect(W.find((x) => x.item.id === 'magnesium')!.total).toBe(14)
    expect(W.find((x) => x.item.id === 'electro')!.total).toBe(4)
  })
  it('stock: days left and order-by date from weekly use', () => {
    const it = { ...STARTER.find((x) => x.id === 'magnesium')!, stock: 28, stockAt: '2026-10-14', leadDays: 7 }
    const s = stockStatus(it, training, '2026-10-14')!
    expect(s.daysLeft).toBe(14); expect(s.orderBy).toBe('2026-10-21'); expect(s.level).toBe('soon')
  })
  it('miss streak counts scheduled days not ticked', () => {
    const st: DosetteState = { items: STARTER, trainingDays: training, taken: {}, startedAt: '2026-10-10' }
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']) st.taken[takenKey(d, 'noon')] = ['zinc']
    st.taken[takenKey('2026-10-10', 'morn')] = ['creatine']
    expect(missStreak(st, STARTER.find((x) => x.id === 'creatine')!, '2026-10-14')).toBe(3)
    // nothing before the box was started counts as missed
    expect(missStreak({ ...st, startedAt: '2026-10-14' }, STARTER.find((x) => x.id === 'creatine')!, '2026-10-14')).toBe(0)
  })
})
function BOX(it: (typeof STARTER)[number]) { return [0, 1, 2, 3, 4, 5, 6].filter((d) => onDay(it, d, training)) }
