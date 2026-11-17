// His checked version is used exactly as saved: no calorie "correction", decimals kept (17 Nov 2026).
import { describe, expect, it } from 'vitest'
import { lookupBarcode, saveUserProduct } from '@/lib/barcode'

describe('your checked version is used exactly', () => {
  it('Monster Ultra from the label: 2.36 cal per 100 mL stays 2.36 (11.8 per can)', async () => {
    await saveUserProduct({ barcode: '9342866001151', name: 'Monster Ultra Peachy Keen', brand: 'Monster', per100: { kcal: 2.36, protein: 0, carbs: 0.7, fat: 0, sugar: 0, sodium: 56.8 }, servingGrams: 500, dietTags: [], cached: true, fetchedAt: '' } as never)
    const p = await lookupBarcode('9342866001151')
    expect(p.userVerified).toBe(true)
    expect(p.per100.kcal).toBe(2.36)
    expect(p.per100.sodium).toBe(56.8)
    expect(Math.round(p.per100.kcal * 5 * 10) / 10).toBe(11.8)
  })
  it('a protein bar whose label is lower than 4/4/9 (sugar alcohols) is not raised', async () => {
    await saveUserProduct({ barcode: '9300633603126', name: 'Bar', per100: { kcal: 330, protein: 33, carbs: 40, fat: 12 }, dietTags: [], cached: true, fetchedAt: '' } as never)
    const p = await lookupBarcode('9300633603126')
    expect(p.per100.kcal).toBe(330)
    expect(p.energyCorrectedFrom).toBeUndefined()
  })
})
