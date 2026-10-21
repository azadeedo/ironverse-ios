// Hand-portion meal estimate — works with no API key and no internet.
// Based on the Precision Nutrition hand-portion guide (typical values for a man's hand):
//   palm of protein ≈ 24 g protein · cupped hand of carbs ≈ 25 g carbs
//   thumb of fats ≈ 9 g fat · fist of vegetables ≈ 25 kcal
// It is a rough guide, labelled as such, and nothing is logged until confirmed.
import type { DraftItem } from '@/screens/food/capture/types'

export interface HandCounts { palms: number; cupped: number; thumbs: number; fists: number }

export const HAND_PORTIONS = {
  palm: { label: 'Palm of protein', hint: 'meat, fish, eggs, tofu — the size and thickness of your palm', grams: 110, kcal: 140, protein: 24, carbs: 0, fat: 4.5 },
  cupped: { label: 'Cupped hand of carbs', hint: 'rice, pasta, potato, bread, fruit', grams: 130, kcal: 115, protein: 3, carbs: 25, fat: 0.5 },
  thumb: { label: 'Thumb of fats', hint: 'oil, butter, cheese, nuts, sauce, avocado', grams: 12, kcal: 85, protein: 0.5, carbs: 0.5, fat: 9 },
  fist: { label: 'Fist of vegetables', hint: 'salad, greens, mixed veg', grams: 80, kcal: 25, protein: 1.5, carbs: 4, fat: 0.2 },
} as const

export function handEstimate(c: HandCounts): DraftItem[] {
  const rows: [keyof typeof HAND_PORTIONS, number, string][] = [
    ['palm', c.palms, 'Protein (hand estimate)'],
    ['cupped', c.cupped, 'Carbs (hand estimate)'],
    ['thumb', c.thumbs, 'Fats (hand estimate)'],
    ['fist', c.fists, 'Vegetables (hand estimate)'],
  ]
  return rows
    .filter(([, n]) => n > 0)
    .map(([k, n, name]) => {
      const p = HAND_PORTIONS[k]
      const r1 = (v: number) => Math.round(v * n * 10) / 10
      return { name, grams: Math.round(p.grams * n), kcal: Math.round(p.kcal * n), protein: r1(p.protein), carbs: r1(p.carbs), fat: r1(p.fat), confidence: 0.4 }
    })
}
