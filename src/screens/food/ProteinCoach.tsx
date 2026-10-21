// IV-18 / IV-06 — protein distribution coach. Uses only what he logged today:
// grams per meal, how many meals reached a useful dose (~0.3 g/kg, at least
// 20 g), and — on a training day from his active plan — a reminder about the
// meal around the gym session. Advice, never a rule.
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Beef } from 'lucide-react'
import { Card } from '@/components/ui'
import type { FoodLogEntry, Profile } from '@/db/types'
import { getProgramPlan } from '@/lib/programStore'
import { MEALS } from './helpers'

export function proteinDose(weightKg: number) { return Math.max(20, Math.round(weightKg * 0.3 / 5) * 5) }

export function ProteinCoach({ date, profile, byMeal }: { date: string; profile: Profile; byMeal: Map<string, FoodLogEntry[]> }) {
  const plan = useLiveQuery(async () => (await getProgramPlan()) ?? null, [])
  const dose = Math.min(45, proteinDose(profile.weightKg))
  const rows = MEALS.map((m) => ({ ...m, g: Math.round((byMeal.get(m.key) ?? []).reduce((a, e) => a + (e.protein ?? 0), 0)) }))
  const total = rows.reduce((a, r) => a + r.g, 0)
  if (total === 0) return null
  const hits = rows.filter((r) => r.g >= dose).length
  const max = Math.max(dose * 1.6, ...rows.map((r) => r.g))
  const training = !!plan?.trainingWeekdays?.includes(dayjs(date).day())
  const left = Math.max(0, Math.round(profile.proteinTarget - total))
  const tip = left === 0 ? `Protein target reached (${total} g of ${profile.proteinTarget} g).`
    : hits >= 3 ? `Good spread — ${left} g still to go; one more ${dose} g serve covers most of it.`
      : `${left} g to go. Spreading it into ${Math.max(1, Math.ceil(left / dose))} serve${Math.ceil(left / dose) === 1 ? '' : 's'} of ~${dose} g works better than one huge one.`
  return (
    <Card className="p-4 text-[13px]">
      <div className="flex items-center gap-2"><Beef size={16} className="text-brand" /><b className="flex-1">Protein spread</b><span className="text-[12px] text-ink3">{hits} meal{hits === 1 ? '' : 's'} ≥ {dose} g</span></div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-[12px]">
            <span className="w-20 text-ink2">{r.label}</span>
            <div className="relative h-2.5 flex-1 rounded-full bg-surface3">
              <div className={`h-2.5 rounded-full ${r.g >= dose ? 'bg-emerald-500' : 'bg-brand/60'}`} style={{ width: `${Math.min(100, (r.g / max) * 100)}%` }} />
              <div className="absolute top-[-2px] h-3.5 w-px bg-ink3" style={{ left: `${(dose / max) * 100}%` }} />
            </div>
            <b className="w-11 text-right">{r.g} g</b>
          </div>
        ))}
      </div>
      <div className="mt-2 text-ink2">{tip}</div>
      {training && <div className="mt-1 text-[12px] text-ink3">Training day on your plan{profile.gymTime ? ` (gym ${profile.gymTime})` : ''}: a protein-rich meal 1–3 h before and a serve after helps recovery.</div>}
      <div className="mt-1 text-[11px] text-ink3">Line = ~{dose} g per meal (about 0.3 g per kg). A guide from research averages, not a strict rule.</div>
    </Card>
  )
}
