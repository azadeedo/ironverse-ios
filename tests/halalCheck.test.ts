import { describe, expect, it } from 'vitest'
import { halalCheck } from '@/lib/halalCheck'

describe('halal check', () => {
  it('a halal label wins', () => {
    expect(halalCheck({ ingredients: 'beef, gelatine', labels: ['en:halal'] }).verdict).toBe('certified')
  })
  it('pork or alcohol is not halal', () => {
    expect(halalCheck({ ingredients: 'Pork (80%), salt' }).verdict).toBe('not-halal')
    expect(halalCheck({ ingredients: 'cream, white wine, salt' }).verdict).toBe('not-halal')
  })
  it('gelatine or doubtful E-numbers ask you to check', () => {
    expect(halalCheck({ ingredients: 'sugar, gelatine' }).verdict).toBe('check')
    expect(halalCheck({ ingredients: 'sugar', additives: ['en:e471'] }).verdict).toBe('check')
  })
  it('halal gelatine is not flagged', () => {
    expect(halalCheck({ ingredients: 'sugar, halal gelatine' }).verdict).toBe('no-concerns')
  })
  it('"hamburger" and "champagne colour" words do not trip the pork/alcohol rules', () => {
    expect(halalCheck({ ingredients: 'wheat flour, water, salt' }).verdict).toBe('no-concerns')
    expect(halalCheck({ name: 'Hamburger buns', ingredients: 'wheat flour, water' }).verdict).toBe('no-concerns')
  })
  it('no ingredient list is unknown', () => {
    expect(halalCheck({ name: 'Mystery bar' }).verdict).toBe('unknown')
  })
})
