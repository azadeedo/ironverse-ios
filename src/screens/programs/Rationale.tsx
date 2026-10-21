// The teaching layer behind a program: why the order, why the rep ranges, how
// the week moves, what to do when a lift stalls, and how machine work and
// free-weight work split the job.
//
// Read-only. Nothing here changes a plan. It exists so the programming can be
// understood rather than just obeyed — and every block ends with an honest note
// that these are rules of thumb, not measurements.

import { useState } from 'react'
import {
  ChevronDown, Cog, Dumbbell, ListOrdered, Repeat, Ruler, TriangleAlert,
} from 'lucide-react'
import { Card } from '@/components/ui'
import type { ProgramArchetype } from '@/data/coaches'

function Bullets({ lines }: { lines: string[] }) {
  return (
    <ul className="mt-1.5 space-y-1.5">
      {lines.map((l) => (
        <li key={l} className="flex gap-2 text-[13px] leading-snug text-ink2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  )
}

function Block({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <span className="text-brand">{icon}</span>
        <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
      </div>
      {children}
    </div>
  )
}

export default function Rationale({ program }: { program: ProgramArchetype }) {
  const [open, setOpen] = useState(false)
  const r = program.rationale
  if (!r) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="pressable flex min-h-[44px] w-full items-center gap-2 rounded-xl bg-surface3 px-3.5 text-left"
      >
        <ListOrdered size={16} className="shrink-0 text-brand" />
        <span className="flex-1 text-[13.5px] font-semibold text-ink">
          Why it is built this way
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <Card className="mt-2 space-y-3 p-4">
          {/* order */}
          <div>
            <div className="flex items-center gap-2">
              <ListOrdered size={16} className="text-brand" />
              <h4 className="text-[13px] font-semibold text-ink">The running order</h4>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{r.orderWhy}</p>
            <ol className="mt-2 space-y-2">
              {r.order.map((o, i) => (
                <li key={o.slot} className="rounded-xl bg-surface3 p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="big-num mt-0.5 w-5 shrink-0 text-[15px] text-brand">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold leading-tight text-ink">{o.slot}</div>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink2">{o.why}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Block icon={<Ruler size={16} />} title="Why these rep ranges">
            <Bullets lines={r.repRangeWhy} />
          </Block>

          <Block icon={<Repeat size={16} />} title="How the weeks progress">
            <Bullets lines={r.weekToWeek} />
          </Block>

          <Block icon={<TriangleAlert size={16} />} title="When a lift stalls">
            <Bullets lines={r.whenItStalls} />
          </Block>

          <Block icon={<Cog size={16} />} title="Machines and free weights">
            <Bullets lines={r.machinesVsFreeWeights} />
          </Block>

          {program.sampleDay && (
            <Block icon={<Dumbbell size={16} />} title={program.sampleDay.title}>
              <ol className="mt-1.5 space-y-1">
                {program.sampleDay.lines.map((l) => (
                  <li key={l} className="text-[12.5px] leading-snug text-ink2">· {l}</li>
                ))}
              </ol>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink3">
                An example of the shape, not a session to copy — what you actually train is still
                built from the kit in the room and the loads you can really put on the bar.
              </p>
            </Block>
          )}

          <p className="rounded-xl bg-surface3 px-3 py-2.5 text-[12px] leading-relaxed text-ink3">
            {r.uncertainty} Everything above is established practice written plainly: rep ranges and
            volume numbers are starting points, individual response varies, and your own log is the
            only evidence that counts.
          </p>
        </Card>
      )}
    </div>
  )
}
