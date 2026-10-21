import { describe, expect, it } from 'vitest'
import { handEstimate } from '@/lib/handPortions'

describe('hand-portion estimate', () => {
  it('turns palms / cupped hands / thumbs / fists into draft rows', () => {
    const rows = handEstimate({ palms: 2, cupped: 1, thumbs: 1, fists: 0 })
    expect(rows.map((r) => r.name)).toEqual(['Protein (hand estimate)', 'Carbs (hand estimate)', 'Fats (hand estimate)'])
    expect(rows[0].protein).toBe(48)
    expect(rows.reduce((n, r) => n + r.kcal, 0)).toBe(2 * 140 + 115 + 85)
  })
  it('nothing counted → nothing to log', () => {
    expect(handEstimate({ palms: 0, cupped: 0, thumbs: 0, fists: 0 })).toEqual([])
  })
})
