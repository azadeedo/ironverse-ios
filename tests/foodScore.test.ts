import { describe, expect, it } from 'vitest'
import { additiveInfo, normaliseAdditive, scoreFood } from '@/lib/foodScore'
import { smartRestSec } from '@/lib/restSmart'

describe('health scanner score', () => {
  it('normalises additive tags and explains them', () => {
    expect(normaliseAdditive('en:e150d')).toBe('e150d')
    expect(normaliseAdditive('en:e322i')).toBe('e322')
    expect(additiveInfo('en:e171').risk).toBe('high')
    expect(additiveInfo('en:e330').risk).toBe('none')
  })
  it('a high-risk additive caps the score at 49', () => {
    const r = scoreFood({ nut: { sugar: 1, satFat: 0.5, salt: 0.1, protein: 20 }, nutriscore: 'a', additives: ['en:e250'] })
    expect(r.score).toBeLessThanOrEqual(49); expect(r.capped).toBe(true)
  })
  it('clean, good-nutrition food scores Excellent; sugary ultra-processed drink scores low', () => {
    expect(scoreFood({ nut: {}, nutriscore: 'a', additives: [] }).band).toBe('Excellent')
    const soda = scoreFood({ nut: { sugar: 10.6 }, nutriscore: 'e', nova: 4, additives: ['en:e150d', 'en:e338', 'en:e211'], isDrink: true })
    expect(soda.score).toBeLessThan(25)
  })
})

describe('smart rest', () => {
  it('heavy compound gets long rest, isolation short, failure adds time, saved rest wins', () => {
    const sq = smartRestSec({ compound: true, reps: 5, ex: { kind: 'strength', loadMode: 'barbell', primary: ['quads'], secondary: [] } as never })
    const curl = smartRestSec({ compound: false, reps: 12, ex: { kind: 'strength', loadMode: 'dumbbell', primary: ['biceps'], secondary: [] } as never })
    expect(sq.sec).toBeGreaterThanOrEqual(210); expect(curl.sec).toBeLessThanOrEqual(90)
    expect(smartRestSec({ compound: false, reps: 6, targetReps: [8, 12] }).sec).toBeGreaterThan(smartRestSec({ compound: false, reps: 10, targetReps: [8, 12] }).sec)
    expect(smartRestSec({ compound: true, reps: 5, userSec: 100 }).sec).toBe(100)
  })
})
