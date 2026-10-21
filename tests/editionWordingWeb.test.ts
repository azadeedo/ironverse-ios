// The web app's owner-personal wording must stay EXACTLY as it was.
import { describe, expect, it } from 'vitest'

;(globalThis as { __IV_EDITION_OVERRIDE__?: string }).__IV_EDITION_OVERRIDE__ = 'web'

describe('web build wording is unchanged', () => {
  it('keeps Flex 24/7, the wife walk, the garage circuit and the garage safety note', async () => {
    const { builtInProfiles } = await import('@/lib/equipment')
    expect(builtInProfiles()[1].name).toBe('Flex 24/7')
    const { ACTIVITIES } = await import('@/lib/goalCoach')
    expect(ACTIVITIES.find((a) => a.key === 'walk-wife')?.detail).toBe('an easy walk outside with your wife — talking pace')
    expect(ACTIVITIES.find((a) => a.key === 'home-gym')?.detail).toBe('your garage: squats, rows, presses, step-ups — 40 s on, 20 s off, keep moving')
    const { byId } = await import('@/data/exercises')
    expect(byId.get('barbell-squat')?.safetyNote).toBe('Training alone in the garage: the rack safeties go just below your bottom position every single set, and practise dumping the bar back onto them before you go heavy.')
  })
})
