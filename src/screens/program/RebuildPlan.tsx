// "I've been away — rebuild my plan" (15 Nov 2026). Shows the rebuilt remaining
// programme first; nothing changes until it is accepted, and the old schedule is kept.

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { db, getSetting, setSetting } from '@/db'
import { Button, Callout, Input, Sheet } from '@/components/ui'
import { useUI } from '@/lib/store'
import { todayStr, nowIso } from '@/lib/id'
import { applyRecovery, buildRecoveryPlan, lastProgramWorkout, weeksAwayFrom } from '@/lib/recovery'
import type { Plan, WorkoutLog } from '@/db/types'

/** Away two weeks or more: the programme offers the rebuild itself. */
export function RebuildPrompt({ plan, logs }: { plan: Plan; logs: WorkoutLog[] }) {
  const [open, setOpen] = useState(false)
  const last = lastProgramWorkout(plan, logs)
  const away = weeksAwayFrom(last.date, todayStr())
  return (
    <>
      {away >= 2 ? (
        <Callout tone="info">
          <div className="space-y-1.5">
            <div className="font-semibold">Welcome back — about {away} weeks away</div>
            <div className="text-[13px]">Missing weeks is different from missing a session. Rebuild the rest of the programme around the time you have left, with an easier first week back.</div>
            <Button small onClick={() => setOpen(true)}><RotateCcw size={14} /> Rebuild my plan</Button>
          </div>
        </Callout>
      ) : (
        <Button small variant="secondary" onClick={() => setOpen(true)}><RotateCcw size={14} /> Been away? Rebuild my plan</Button>
      )}
      <RebuildSheet open={open} onClose={() => setOpen(false)} plan={plan} logs={logs} />
    </>
  )
}

export function RebuildSheet({ open, onClose, plan, logs }: { open: boolean; onClose: () => void; plan: Plan; logs: WorkoutLog[] }) {
  const { toast } = useUI()
  const today = todayStr()
  const last = lastProgramWorkout(plan, logs)
  const autoAway = weeksAwayFrom(last.date, today)
  const [left, setLeft] = useState(String(Math.max(1, 12 - Math.max(0, last.week) + (autoAway >= 2 ? 0 : 0))))
  const [away, setAway] = useState(String(autoAway))
  const rp = useMemo(() => buildRecoveryPlan(plan, logs, { today, weeksLeft: Math.max(1, parseInt(left, 10) || 1), weeksAway: Math.max(0, parseInt(away, 10) || 0) }), [plan, logs, today, left, away])

  const accept = async () => {
    const next = applyRecovery(plan, rp, today)
    // the old schedule is kept so it can be put back
    const saved = await getSetting<{ at: string; plan: Partial<Plan>; summary: string[] }[]>('p12:recoveries', [])
    saved.push({ at: nowIso(), plan: { skippedWeeks: plan.skippedWeeks, repeatedWeeks: plan.repeatedWeeks, manualWeek: plan.manualWeek, loadAdjust: plan.loadAdjust }, summary: rp.summary })
    await setSetting('p12:recoveries', saved)
    await db.plans.put(next)
    toast(`Plan rebuilt — ${rp.sequence.length} weeks, starting with week ${rp.reentryWeek}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Rebuild my plan" tall>
      <div className="space-y-3">
        <p className="text-[13px] text-ink2">Tell it how long you have. It rebuilds the rest of the 12 weeks from what you actually logged. Nothing is squeezed, and your history is not touched.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[12px] font-semibold text-ink3">Weeks left</span><Input inputMode="numeric" value={left} onChange={(e) => setLeft(e.target.value)} /></label>
          <label className="block"><span className="text-[12px] font-semibold text-ink3">Weeks away</span><Input inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value)} /></label>
        </div>
        <p className="text-[11.5px] text-ink3">Last finished workout: {last.date ? `${last.date} (week ${last.week})` : 'none yet'}.</p>
        <div className="space-y-1.5 rounded-2xl bg-surface3 p-3 text-[13px] leading-relaxed text-ink2">
          {rp.summary.map((s, i) => <p key={i}>{s}</p>)}
        </div>
        <div className="rounded-2xl border border-line p-3">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-ink3">Your next {rp.sequence.length} weeks</div>
          {rp.sequence.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-line/60 py-1.5 text-[13.5px] last:border-0">
              <span className="text-ink3">{i === 0 ? 'This week' : `+${i} wk`}</span>
              <span className="font-semibold text-ink">Week {s.week}</span>
              <span className="max-w-[55%] truncate text-right text-[12px] text-ink3">{s.note}</span>
            </div>
          ))}
        </div>
        <Button full onClick={() => void accept()}>Use this plan</Button>
        <Button full variant="secondary" small onClick={onClose}>Not now</Button>
        <p className="text-[11px] text-ink3">Not medical advice. If you were away because of illness or injury, check with your doctor before training hard again.</p>
      </div>
    </Sheet>
  )
}
