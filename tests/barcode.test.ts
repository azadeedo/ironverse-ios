import { describe, expect, it } from 'vitest'
import * as ZX from '@zxing/library'
import { decodeRGBA } from '@/lib/barcode'

// Draw a real EAN-13 into an RGBA buffer (what a canvas gives us) and decode it.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
function ean13Bits(code: string) {
  const d = code.split('').map(Number), p = PARITY[d[0]]
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (p[i - 1] === 'L' ? L : G)[d[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]]
  return bits + '101'
}
function render(code: string, module = 3, h = 80) {
  const bits = '0'.repeat(12) + ean13Bits(code) + '0'.repeat(12), w = bits.length * module
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = bits[Math.floor(x / module)] === '1' ? 20 : 235, j = (y * w + x) * 4
    px[j] = v; px[j + 1] = v; px[j + 2] = v; px[j + 3] = 255
  }
  return { px, w, h }
}

describe('barcode decoder (iPhone path)', () => {
  it('decodes an EAN-13 from RGBA canvas pixels', () => {
    const reader = new ZX.MultiFormatReader()
    const hints = new Map(); hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13]); reader.setHints(hints)
    const { px, w, h } = render('9310072000466')
    expect(decodeRGBA(ZX, reader, px, w, h)).toBe('9310072000466')
  })
})

import { photoAt } from '@/screens/photos/helpers'
describe('progress photos', () => {
  it('finds the photo of the same pose closest to N days ago', () => {
    const P = (id: string, date: string, pose: 'front' | 'side' = 'front') => ({ id, date, pose, blob: new Blob(), createdAt: date }) as never
    const list = [P('a', '2026-07-01'), P('b', '2026-08-10'), P('c', '2026-09-14'), P('s', '2026-09-14', 'side'), P('d', '2026-10-11')]
    expect((photoAt(list, 'front', 28, '2026-10-11') as { id: string }).id).toBe('c')
    expect((photoAt(list, 'front', 84, '2026-10-11') as { id: string }).id).toBe('a')
    expect(photoAt(list, 'arms' as never, 28, '2026-10-11')).toBeNull()
  })
})

import { matchConfidence } from '@/lib/barcode'
describe('barcode match confidence', () => {
  const base = { barcode: '9300000000001', name: 'Oats', dietTags: [], cached: false, fetchedAt: '' }
  it('high when calories agree with macros', () => {
    expect(matchConfidence({ ...base, per100: { kcal: 380, protein: 12, carbs: 60, fat: 8 } } as never).level).toBe('high')
  })
  it('low when calories and macros disagree badly or numbers are missing', () => {
    expect(matchConfidence({ ...base, per100: { kcal: 900, protein: 10, carbs: 20, fat: 1 } } as never).level).toBe('low')
    expect(matchConfidence({ ...base, per100: { kcal: 250, protein: 0, carbs: 0, fat: 5 } } as never).level).toBe('low')
  })
  it('medium when converted from kJ or unnamed', () => {
    expect(matchConfidence({ ...base, energyFromKj: true, per100: { kcal: 380, protein: 12, carbs: 60, fat: 8 } } as never).level).toBe('medium')
    expect(matchConfidence({ ...base, name: 'Product 9300000000001', per100: { kcal: 380, protein: 12, carbs: 60, fat: 8 } } as never).level).toBe('medium')
  })
})

import { correctEnergy, mapOffProduct, matchConfidence } from '@/lib/barcode'
describe('calories that are too low for the macros are recalculated', () => {
  it('Yo Pro banana: database 47 kcal/100g, macros say ~59 → 59, and not called a good match', () => {
    const p = mapOffProduct('9344962002193', { product_name: 'Yo pro 15g banana', serving_size: '1 serving (150 g)', serving_quantity: 150,
      nutriments: { 'energy-kcal_100g': 46.67, 'energy-kj_100g': 250.3, proteins_100g: 10, carbohydrates_100g: 4, fat_100g: 0.333 } })
    expect(p.per100.kcal).toBe(59)
    expect(p.energyCorrectedFrom).toBe(47)
    expect(Math.round(p.per100.kcal * 1.5)).toBe(89)
    expect(matchConfidence(p).level).toBe('medium')
  })
  it('energy higher than the macros (fibre, sugar alcohols) is left alone', () => {
    expect(correctEnergy({ kcal: 400, protein: 10, carbs: 60, fat: 10 }).from).toBeUndefined()
  })
  it('plain energy_100g is kJ, not kcal', () => {
    const p = mapOffProduct('1', { product_name: 'Bar', nutriments: { energy_100g: 1674, proteins_100g: 20, carbohydrates_100g: 40, fat_100g: 15 } })
    expect(p.per100.kcal).toBe(400)
  })
})
