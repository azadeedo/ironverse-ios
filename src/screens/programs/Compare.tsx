// A fair, side-by-side comparison of the two coach styles.
//
// Deliberately symmetrical: every row is drawn from the SAME field on both
// coaches, so neither can be dressed up. No winner is declared anywhere in
// this file, and nothing here is presented as an official program.

import { Scale } from 'lucide-react'
import { Card } from '@/components/ui'
import type { Coach } from '@/data/coaches'

interface Row {
  label: string
  get: (c: Coach) => string
}

const ROWS: Row[] = [
  { label: 'Weekly volume', get: (c) => c.weeklySets },
  { label: 'How hard each set', get: (c) => c.intensity },
  { label: 'Tempo', get: (c) => c.tempo },
  { label: 'Exercise choice', get: (c) => c.exerciseBias },
  { label: 'Easy weeks', get: (c) => c.deload },
  { label: 'Session length', get: (c) => sessionFeel(c) },
  { label: 'What it asks of you', get: (c) => c.tradeoffs[0] ?? '—' },
]

/** Rough session feel, computed the same way for both — not a claim, an estimate. */
function sessionFeel(c: Coach): string {
  const { compound, isolation } = c.prescription
  const perEx = (p: { sets: number; restSec: number }) => p.sets * (45 + p.restSec)
  const mins = Math.round((3 * perEx(compound) + 3 * perEx(isolation)) / 60) + 8
  return `About ${mins - 5}–${mins + 10} minutes for a six-exercise session (estimate).`
}

export default function Compare({ a, b }: { a: Coach; b: Coach }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Scale size={16} className="text-brand" />
        <h2 className="shout text-[12px] text-brand">Side by side</h2>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
        Both of these build muscle. They disagree about how to spend your time, not about
        whether the work matters. Pick the one whose cost you are happy to pay — you can swap
        for a single day and see for yourself before committing to anything.
      </p>

      {/* headers */}
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface3 px-3 py-2">
          <div className="text-[13.5px] font-bold leading-tight text-ink">{a.name}</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-ink3">{a.shortCredit}</div>
        </div>
        <div className="rounded-xl bg-surface3 px-3 py-2">
          <div className="text-[13.5px] font-bold leading-tight text-ink">{b.name}</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-ink3">{b.shortCredit}</div>
        </div>
      </div>

      {/* rows */}
      <div className="mt-1 divide-y divide-line">
        {ROWS.map((r) => (
          <div key={r.label} className="py-2.5">
            <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink3">
              {r.label}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="text-[12.5px] leading-snug text-ink">{r.get(a)}</div>
              <div className="text-[12.5px] leading-snug text-ink">{r.get(b)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 rounded-xl bg-surface3 px-3 py-2.5">
        <h3 className="text-[12.5px] font-semibold text-ink">Honestly: how to choose</h3>
        <ul className="mt-1 space-y-1 text-[12.5px] leading-snug text-ink2">
          <li>· If you want the logbook to prove it, {b.name.toLowerCase()} gives you numbers to chase.</li>
          <li>· If you want the session to feel like bodybuilding, {a.name.toLowerCase()} gives you volume and squeeze.</li>
          <li>· If you cannot decide, run one for a single day each. The difference is obvious in your own gym.</li>
          <li>· Neither beats consistency. The best of these two is the one you will actually finish.</li>
        </ul>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink3">
        These are our own interpretations of two public training philosophies. They are not
        anyone&rsquo;s official program, they are not endorsed by anyone, and nothing here is a
        quote.
      </p>
    </Card>
  )
}
