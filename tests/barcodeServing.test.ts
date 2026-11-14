import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mapOffProduct, matchConfidence, portionOf } from '@/lib/barcode'

const off = (code: string) => JSON.parse(readFileSync(`tests/fixtures/off-${code}.json`, 'utf8')).product

// 15 Nov 2026, the owner's scans against the labels he photographed
describe('per-serve numbers stored as per 100 g', () => {
  it('Pauls PLUS+ protein yoghurt 150 g: label 92 Cal, 15.1 g protein per pouch', () => {
    const p = mapOffProduct('9310036075707', off('9310036075707'))
    expect(p.per100.kcal).toBe(61)                 // the label's per-100 g energy, not "corrected" to 90
    expect(p.per100.protein).toBeCloseTo(10.1, 0)  // label: 10.1 g per 100 g
    expect(p.per100.carbs).toBeCloseTo(4.5, 0)     // label: 4.5 g per 100 g
    const pouch = portionOf(p.per100, 150)
    expect(pouch.kcal).toBeGreaterThanOrEqual(90)
    expect(pouch.kcal).toBeLessThanOrEqual(93)     // label: 92 Cal per pouch (was 135)
    expect(pouch.protein).toBeCloseTo(15.1, 0)
    expect(matchConfidence(p).level).toBe('medium')
  })
})
