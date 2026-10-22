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
})
