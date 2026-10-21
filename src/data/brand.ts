// Ironverse visual identity — phase / PR / completion hero images (original
// AI-generated with Higgsfield, same athlete and gym as the exercise photos,
// reviewed before inclusion). Files live in public/media/brand.
export type HeroId = 'hero-foundation' | 'hero-hypertrophy' | 'hero-strength' | 'hero-deload' | 'hero-pr' | 'hero-complete'

export const hero = (id: HeroId) => ({ src: `/media/brand/${id}.webp`, small: `/media/brand/${id}-640.webp` })

/** the hero that matches a program week */
export function heroForWeek(week: number): HeroId {
  if (week === 4 || week === 8) return 'hero-deload'
  if (week === 12) return 'hero-pr'
  if (week <= 3) return 'hero-foundation'
  if (week <= 7) return 'hero-hypertrophy'
  return 'hero-strength'
}
