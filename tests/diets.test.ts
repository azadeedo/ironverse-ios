import { describe, expect, it } from 'vitest'
import { SEED_FOODS } from '@/data/foods'
import { dietById, dietMacros, filterDiet, fitsDiet, highCarbFor } from '@/lib/diets'

const named = (name: string) => SEED_FOODS.find((f) => f.name === name)!

describe('diets', () => {
  it('macro guides follow the diet; protein never changes', () => {
    expect(dietMacros(2400, 160, dietById('balanced'))).toEqual({ protein: 160, carbs: 289, fat: 67 })
    const keto = dietMacros(2400, 160, dietById('keto'))
    expect(keto.carbs).toBe(30)
    expect(keto.protein).toBe(160)
    expect(keto.fat).toBeGreaterThan(150)
    expect(dietMacros(2400, 160, dietById('low-carb')).carbs).toBe(100)
  })

  it('vegetarian hides meat and fish, keeps eggs and dairy', () => {
    const v = dietById('vegetarian')
    expect(fitsDiet(named('Chicken satay skewer'), v)).toBe(false)
    expect(fitsDiet(named('Tuna sashimi'), v)).toBe(false)
    expect(fitsDiet(named('Palak paneer'), v)).toBe(true)
    expect(fitsDiet(named('Dal tadka'), v)).toBe(true)
  })

  it('vegan also hides dairy and eggs', () => {
    const v = dietById('vegan')
    expect(fitsDiet(named('Palak paneer'), v)).toBe(false)
    expect(fitsDiet(named('Chana masala'), v)).toBe(true)
    expect(fitsDiet(named('Menemen (Turkish eggs)'), v)).toBe(false)
  })

  it('pescatarian keeps fish, hides meat', () => {
    const p = dietById('pescatarian')
    expect(fitsDiet(named('Barramundi, grilled'), p)).toBe(true)
    expect(fitsDiet(named('Beef bulgogi'), p)).toBe(false)
  })

  it('gluten-free hides bread and pasta but keeps rice noodles and rice', () => {
    const g = dietById('gluten-free')
    expect(fitsDiet(named('Garlic naan'), g)).toBe(false)
    expect(fitsDiet(named('Spaghetti carbonara'), g)).toBe(false)
    expect(fitsDiet({ name: 'Rice noodles, cooked' }, g)).toBe(true)
  })

  it('balanced/keto never filter; keto flags high-carb foods', () => {
    expect(filterDiet(SEED_FOODS, dietById('keto')).length).toBe(SEED_FOODS.length)
    expect(highCarbFor(dietById('keto'), 25)).toBe(true)
    expect(highCarbFor(dietById('keto'), 5)).toBe(false)
    expect(highCarbFor(dietById('balanced'), 80)).toBe(false)
  })

  it('every filtering diet still leaves plenty to eat', () => {
    for (const id of ['vegetarian', 'vegan', 'pescatarian', 'dairy-free', 'gluten-free']) {
      expect(filterDiet(SEED_FOODS, dietById(id)).length, id).toBeGreaterThan(150)
    }
  })
})
