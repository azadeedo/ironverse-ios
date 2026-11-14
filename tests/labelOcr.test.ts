import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseNutritionPanel } from '@/lib/labelOcr'

// real on-device OCR text of the owner's photos (15 Nov 2026), cropped to the panel
describe('reading an AU nutrition panel', () => {
  it('Monster Ultra Peachy Keewl: per 100 mL is 2.36 Cal, 0.7 g carbs', () => {
    const r = parseNutritionPanel(readFileSync('tests/fixtures/monster_panel.png.txt', 'utf8'))
    expect(r.per100.kcal).toBeCloseTo(2.36, 2)
    expect(r.per100.protein).toBe(0)
    expect(r.per100.fat).toBe(0)
    expect(r.per100.carbs).toBeCloseTo(0.7, 1)
    expect(r.per100.sugar).toBe(0)
    expect(r.servingGrams).toBe(500)
  })
  it('Pauls protein yoghurt (row names under a thumb): 61 Cal, 10.1 g protein per 100 g', () => {
    const r = parseNutritionPanel(readFileSync('tests/fixtures/yog_panel.png.txt', 'utf8'))
    expect(r.per100.kcal).toBeCloseTo(61, 0)
    expect(r.per100.protein).toBeCloseTo(10.1, 1)
    expect(r.per100.fat).toBeCloseTo(0.2, 1)
    expect(r.per100.carbs).toBeCloseTo(4.5, 1)
    expect(r.per100.sugar).toBeCloseTo(3.6, 1)
    expect(r.per100.sodium).toBe(43)
    expect(r.servingGrams).toBe(150)
  })
})
