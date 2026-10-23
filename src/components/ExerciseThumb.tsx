// One exercise thumbnail for every list (v10.1, owner request 23 Oct 2026):
//   1. our generated demonstration (looping video, else its image)
//   2. a real photo — shown WHOLE (square thumb of position 1, never cropped)
//   3. the stick-figure animation when there is no picture at all
// The stick figure is still one tap away on the exercise page ("Show movement diagram").
import { useState } from 'react'
import { ExerciseAnim } from '@/anim/rig'
import { MEDIA } from '@/data/media'
import type { Exercise } from '@/db/types'

export function ExerciseThumb({ ex, size = 64, className = '', playing = true }: { ex: Exercise; size?: number; className?: string; playing?: boolean }) {
  const m = MEDIA[ex.id]
  const [failed, setFailed] = useState(false)
  const box = `flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black ${className}`
  if (m && !failed) {
    if (m.video && m.kind !== 'photo') {
      return <div className={box} style={{ width: size, height: size }}><video src={m.video} poster={m.imgSmall} autoPlay={playing} loop muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden /></div>
    }
    const src = m.kind === 'photo' ? (m.thumb ?? m.imgSmall ?? m.img) : (m.imgSmall ?? m.img)
    return (
      <div className={box} style={{ width: size, height: size }}>
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
          className={`h-full w-full ${m.kind === 'photo' ? 'object-contain' : 'object-cover'}`} />
      </div>
    )
  }
  return <div className={`${box} bg-surface3/60`} style={{ width: size, height: size }}><ExerciseAnim def={ex.anim} size={size - 6} playing={playing} /></div>
}
