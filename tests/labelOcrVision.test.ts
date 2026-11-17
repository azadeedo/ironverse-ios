// The iPhone app reads labels with Apple's Vision (TextReader plugin): clean rows, units kept.
// These are his two labels written the way Vision returns them (rows top to bottom, words left to right).
import { describe, expect, it } from 'vitest'
import { parseNutritionPanel } from '@/lib/labelOcr'

const monster = `NUTRITION INFORMATION
Servings per package: 1
Serving size: 500 mL
AVERAGE QUANTITY PER SERVING PER 100 mL
ENERGY 49.3 kJ (11.8 Cal) 9.86 kJ (2.36 Cal)
PROTEIN 0 g 0 g
FAT, TOTAL 0 g 0 g
- SATURATED 0 g 0 g
CARBOHYDRATE, TOTAL 3.5 g 0.7 g
- SUGARS 0 g 0 g
DIETARY FIBRE, TOTAL 0 g 0 g
SODIUM 284 mg 56.8 mg
COMPOSITION INFORMATION
CAFFEINE 153 mg 30.5 mg`

const yoghurt = `NUTRITION INFORMATION
Servings per package: 1
Serving size: 150 g
Average quantity Average quantity
per serving per 100 g
Energy 386kJ (92Cal) 256kJ (61Cal)
Protein 15.1g 10.1g
Fat, total 0.3g 0.2g
- saturated 0.1g 0.1g
Carbohydrate 6.8g 4.5g
- sugars 5.4g 3.6g
Dietary fibre 0.0g 0.0g
Sodium 65mg 43mg
Calcium 1% (20% 10`

describe('label text from Apple Vision', () => {
  it('Monster Ultra: 2.36 Cal and 0.7 g carbs per 100 mL', () => {
    const r = parseNutritionPanel(monster)
    expect(r.servingGrams).toBe(500)
    expect(r.per100).toMatchObject({ kcal: 2.36, protein: 0, fat: 0, satFat: 0, carbs: 0.7, sugar: 0, fibre: 0, sodium: 56.8 })
    expect(r.found).toBe(6)
  })
  it('Pauls PLUS+ yoghurt: every value per 100 g', () => {
    const r = parseNutritionPanel(yoghurt)
    expect(r.servingGrams).toBe(150)
    expect(r.per100).toMatchObject({ kcal: 61, protein: 10.1, fat: 0.2, satFat: 0.1, carbs: 4.5, sugar: 3.6, fibre: 0, sodium: 43 })
    expect(r.found).toBe(6)
  })
  it('Vision sometimes splits a row: values on their own line still land in order', () => {
    const split = yoghurt.replace('Protein 15.1g 10.1g', 'Protein\n15.1g 10.1g')
    expect(parseNutritionPanel(split).per100.protein).toBe(10.1)
  })
})
