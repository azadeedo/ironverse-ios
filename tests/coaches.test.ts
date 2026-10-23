import { describe, expect, it } from 'vitest'
import { PROGRAM_LIST, unknownCoachIds } from '@/data/coaches'

describe('coach programs', () => {
  it('every exercise a coach style picks exists', () => {
    for (const p of PROGRAM_LIST) expect(unknownCoachIds(p), p.id).toEqual([])
  })

  it('every "Inspired by" style says it is not affiliated or endorsed', () => {
    const inspired = PROGRAM_LIST.filter((p) => p.inspiredBy)
    expect(inspired.map((p) => p.inspiredBy)).toEqual(expect.arrayContaining(['Chris Bumstead', 'Jeff Nippard', 'Arnold Schwarzenegger', 'Mike Mentzer', 'Dorian Yates']))
    for (const p of inspired) expect(p.influence, p.id).toMatch(/not (affiliated|endorsed|anybody)|endorsed by anyone/i)
  })

  it('v10.3 styles each carry a weekly routine and no branded program name', () => {
    const added = ['mass-monster', 'volume-landmarks', 'wave-strength', 'novice-linear', 'glute-builder', 'aesthetic-symmetry']
    for (const id of added) {
      const p = PROGRAM_LIST.find((x) => x.id === id)
      expect(p, id).toBeTruthy()
      expect(p!.weeklySplit?.length ?? 0, id).toBeGreaterThanOrEqual(4)
      expect(p!.sampleDay?.lines.length ?? 0, id).toBeGreaterThanOrEqual(4)
      expect(p!.name, id).not.toMatch(/5\/3\/1|starting strength|renaissance|\brp\b/i)
    }
    expect(PROGRAM_LIST.length).toBe(12)
  })
})
