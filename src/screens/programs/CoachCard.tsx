// One coach, summarised honestly: what it is, who it suits, what it costs.

import { ChevronRight, ListChecks, Sparkles } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import type { ProgramArchetype } from '@/data/coaches'
import Rationale from './Rationale'

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <div className="w-[92px] shrink-0 text-[12px] font-medium uppercase tracking-wide text-ink3">
        {label}
      </div>
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-ink">{value}</div>
    </div>
  )
}

export default function CoachCard({ coach, active, applicable = true, onPicks, onUse }: {
  coach: ProgramArchetype
  active?: boolean
  /** false for archetypes that are reading material rather than a plan source */
  applicable?: boolean
  onPicks: () => void
  onUse: () => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="shout text-[11.5px] text-brand">Coach style</div>
          <h2 className="mt-0.5 text-[20px] font-bold leading-tight">{coach.name}</h2>
        </div>
        {active && <Badge tone="green">In effect</Badge>}
      </div>

      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink2">{coach.tagline}</p>

      <div className="mt-3 divide-y divide-line border-y border-line">
        <Line label="Weekly sets" value={coach.weeklySets} />
        <Line label="Intensity" value={coach.intensity} />
        <Line label="Tempo" value={coach.tempo} />
        <Line label="Selection" value={coach.exerciseBias} />
        <Line label="Deloads" value={coach.deload} />
      </div>

      <h3 className="mt-3.5 text-[13px] font-semibold text-ink">How it trains</h3>
      <ul className="mt-1.5 space-y-1.5">
        {coach.principles.map((p) => (
          <li key={p} className="flex gap-2 text-[13px] leading-snug text-ink2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="text-[13px] font-semibold text-emerald-500">Suits you when</h3>
          <ul className="mt-1 space-y-1">
            {coach.bestFor.map((b) => (
              <li key={b} className="text-[12.5px] leading-snug text-ink2">· {b}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-amber-500">What it costs</h3>
          <ul className="mt-1 space-y-1">
            {coach.tradeoffs.map((t) => (
              <li key={t} className="text-[12.5px] leading-snug text-ink2">· {t}</li>
            ))}
          </ul>
        </div>
      </div>

      <Rationale program={coach} />

      <p className="mt-3 rounded-xl bg-surface3 px-3 py-2 text-[12px] leading-relaxed text-ink3">
        {coach.influence}
      </p>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" full onClick={onPicks}>
          <ListChecks size={15} /> The picks <ChevronRight size={15} />
        </Button>
        {applicable && (
          <Button full onClick={onUse}>
            <Sparkles size={15} /> Train this way
          </Button>
        )}
      </div>

      {!applicable && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink3">
          Reading material, not a switch: this one is here so you can borrow the structure into your
          own sessions. The two styles above are the ones the generator builds blocks from.
        </p>
      )}
    </Card>
  )
}
