// Intermittent fasting (v10, 23 Oct 2026) — pure helpers. State lives in two
// settings keys (no schema change): the fast in progress and a capped history.

export interface Fast { start: string; end?: string; goalHours: number }

export const FAST_PLANS = [
  { hours: 13, label: '13:11', note: 'Gentle — an early dinner and a normal breakfast' },
  { hours: 14, label: '14:10', note: 'A good first step' },
  { hours: 16, label: '16:8', note: 'The most popular — skip breakfast or dinner' },
  { hours: 18, label: '18:6', note: 'Advanced' },
  { hours: 20, label: '20:4', note: 'Advanced — one big meal window' },
] as const

/** what research and physiology generally describe at each point (approximate, varies by person) */
export const FAST_STAGES = [
  { from: 0, title: 'Digesting', body: 'Blood sugar rises and falls after your last meal; insulin is up.' },
  { from: 4, title: 'Blood sugar settling', body: 'Insulin drops back toward baseline as the meal is absorbed.' },
  { from: 12, title: 'Fat burning ramps up', body: 'Liver glycogen is running lower, so the body leans more on fat for fuel.' },
  { from: 16, title: 'Deeper fat use', body: 'Ketone levels start to rise for many people. Keep water and salt up.' },
  { from: 18, title: 'Ketosis for many', body: 'Longer fasts are not needed for results — total calories and protein still matter most.' },
] as const

export function hoursFasted(f: Fast, now = Date.now()): number {
  const end = f.end ? new Date(f.end).getTime() : now
  return Math.max(0, (end - new Date(f.start).getTime()) / 3_600_000)
}

export function stageFor(hours: number) {
  return [...FAST_STAGES].reverse().find((s) => hours >= s.from) ?? FAST_STAGES[0]
}

export function fastStats(history: Fast[]) {
  const done = history.filter((f) => f.end)
  const hit = done.filter((f) => hoursFasted(f) >= f.goalHours)
  const longest = done.reduce((m, f) => Math.max(m, hoursFasted(f)), 0)
  const avg = done.length ? done.reduce((s, f) => s + hoursFasted(f), 0) / done.length : 0
  // streak: consecutive most-recent fasts that hit their goal
  let streak = 0
  for (const f of [...done].sort((a, b) => b.start.localeCompare(a.start))) { if (hoursFasted(f) >= f.goalHours) streak++; else break }
  return { total: done.length, hitRate: done.length ? Math.round((hit.length / done.length) * 100) : 0, longest: Math.round(longest * 10) / 10, avg: Math.round(avg * 10) / 10, streak }
}
