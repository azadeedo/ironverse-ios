// Hevy-style workout share card: drawn on a canvas on the phone, shared as a PNG
// through the system share sheet (or downloaded). Nothing is uploaded anywhere.
import type { WorkoutLog } from '@/db/types'
import { isNativeApp } from './edition'

export interface CardData { log: WorkoutLog; durationSec: number; volumeKg: number; prs: { name: string; detail: string }[]; names: Record<string, string> }

export function drawWorkoutCard(d: CardData, canvas: HTMLCanvasElement): void {
  const W = 1080, H = 1350
  canvas.width = W; canvas.height = H
  const g = canvas.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#16181f'); grad.addColorStop(1, '#0b0c10')
  g.fillStyle = grad; g.fillRect(0, 0, W, H)
  g.fillStyle = '#fbbf24'; g.fillRect(0, 0, W, 14)
  g.fillStyle = '#fbbf24'; g.font = '800 44px system-ui, -apple-system, sans-serif'; g.fillText('IRONVERSE', 72, 120)
  g.fillStyle = '#ffffff'; g.font = '800 72px system-ui, -apple-system, sans-serif'; g.fillText(d.log.title.slice(0, 22), 72, 220)
  g.fillStyle = '#9ca3af'; g.font = '500 38px system-ui, -apple-system, sans-serif'
  g.fillText(new Date(d.log.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }), 72, 280)
  const mins = Math.round(d.durationSec / 60), sets = d.log.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done && !s.warmup).length, 0)
  const stats: [string, string][] = [[`${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ''}${mins % 60}m`, 'Duration'], [`${Math.round(d.volumeKg).toLocaleString('en-AU')} kg`, 'Volume'], [String(sets), 'Sets'], [String(d.prs.length), 'PRs']]
  stats.forEach(([v, l], i) => {
    const x = 72 + (i % 2) * 480, y = 360 + Math.floor(i / 2) * 170
    g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, x, y, 450, 140, 28); g.fill()
    g.fillStyle = i === 3 && d.prs.length ? '#fbbf24' : '#ffffff'; g.font = '800 58px system-ui, -apple-system, sans-serif'; g.fillText(v, x + 32, y + 74)
    g.fillStyle = '#9ca3af'; g.font = '500 30px system-ui, -apple-system, sans-serif'; g.fillText(l, x + 32, y + 116)
  })
  let y = 750
  g.fillStyle = '#ffffff'; g.font = '700 40px system-ui, -apple-system, sans-serif'; g.fillText('Exercises', 72, y); y += 60
  for (const e of d.log.exercises.slice(0, 7)) {
    const work = e.sets.filter((s) => s.done && !s.warmup)
    if (!work.length) continue
    const top = work.reduce((b, s) => ((s.weightKg ?? 0) > (b.weightKg ?? 0) ? s : b), work[0])
    g.fillStyle = '#e5e7eb'; g.font = '600 34px system-ui, -apple-system, sans-serif'; g.fillText((d.names[e.exerciseId] ?? e.exerciseId).slice(0, 30), 72, y)
    g.fillStyle = '#9ca3af'; g.font = '500 32px system-ui, -apple-system, sans-serif'
    const txt = `${work.length} × ${top.weightKg ? `${top.weightKg} kg × ` : ''}${top.reps ?? ''}`
    g.fillText(txt, W - 72 - g.measureText(txt).width, y); y += 58
  }
  if (d.prs.length) {
    y += 20; g.fillStyle = '#fbbf24'; g.font = '700 36px system-ui, -apple-system, sans-serif'
    g.fillText(`🏆 ${d.prs.slice(0, 2).map((p) => p.name).join(' · ')}`.slice(0, 48), 72, Math.min(y, H - 90))
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

export async function shareWorkoutCard(d: CardData): Promise<'shared' | 'downloaded'> {
  const c = document.createElement('canvas'); drawWorkoutCard(d, c)
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
  const file = new File([blob], `ironverse-${d.log.date}.png`, { type: 'image/png' })
  // iOS app: hand the PNG to the native share sheet (Save Image, Messages, …)
  if (isNativeApp()) { try { const { nativeShareBlob } = await import('@/native/files'); if (await nativeShareBlob(blob, file.name, d.log.title)) return 'shared' } catch { /* fall through */ } }
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: d.log.title }); return 'shared' } catch { /* cancelled */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'downloaded'
}

/** consecutive weeks (Mon–Sun) with at least `target` finished workouts, counting this week only if already met */
export function weekStreak(logs: Pick<WorkoutLog, 'date' | 'finishedAt' | 'skipped'>[], target: number, today: string): { weeks: number; thisWeek: number } {
  const loc = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const mon = (d: string) => { const x = new Date(d + 'T00:00:00'); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return loc(x) }
  const per = new Map<string, number>()
  for (const l of logs) if (l.finishedAt && !l.skipped) per.set(mon(l.date), (per.get(mon(l.date)) ?? 0) + 1)
  const cur = mon(today), thisWeek = per.get(cur) ?? 0
  let weeks = thisWeek >= target ? 1 : 0
  const d = new Date(cur + 'T00:00:00')
  for (let i = 0; i < 260; i++) { d.setDate(d.getDate() - 7); if ((per.get(loc(d)) ?? 0) >= target) weeks++; else break }
  return { weeks, thisWeek }
}
