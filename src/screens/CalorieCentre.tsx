// /calories — Smart calorie adjustment centre (IV-22, IV-17).
// One authoritative target, every change dated with its reason, proposals that
// need his confirmation, and undo. Energy figures are labelled as estimates.

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { Check, RotateCcw, X } from 'lucide-react'
import { db, getProfile } from '@/db'
import { Badge, Button, Callout, Card, ConfirmDialog, Input, PageHeader, Section, Spinner } from '@/components/ui'
import { useUI } from '@/lib/store'
import { acceptProposal, dismissProposal, pendingProposal, safetyFloor, setBaseTarget, targetBreakdown, targetHistory, undoLastChange, MIN_BASE_KCAL } from '@/lib/calorieTarget'
import { adaptiveTdee, tdeeFormula } from '@/lib/nutrition'
import { todayStr } from '@/lib/id'

export default function CalorieCentre() {
  const { toast } = useUI()
  const profile = useLiveQuery(() => getProfile(), [])
  const history = useLiveQuery(() => targetHistory(), [profile?.calorieTarget]) ?? []
  const proposal = useLiveQuery(() => pendingProposal(), [profile?.calorieTarget])
  const today = todayStr()
  const adj = useLiveQuery(() => db.dayAdjust.get(today), [today])
  const weighIns = useLiveQuery(() => db.weighIns.toArray(), []) ?? []
  const food = useLiveQuery(() => db.foodLog.toArray(), []) ?? []
  const [val, setVal] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)
  if (!profile) return <div className="flex h-[60svh] items-center justify-center"><Spinner /></div>
  const b = targetBreakdown(profile, adj?.deltaKcal ?? 0)
  const intake = new Map<string, number>()
  for (const f of food) intake.set(f.date, (intake.get(f.date) ?? 0) + f.kcal)
  const adaptive = adaptiveTdee(weighIns, intake)
  const formula = tdeeFormula(profile)
  return (
    <div className="pb-8">
      <PageHeader title="Calorie target" subtitle="One target used everywhere in the app" back="/food" />
      <div className="space-y-4 px-4">
        <Card className="p-4">
          <div className="text-[12px] font-bold uppercase tracking-wide text-ink3">Your target</div>
          <div className="mt-0.5 text-[34px] font-black leading-none">{b.base.toLocaleString('en-AU')} <span className="text-[16px] font-semibold text-ink2">kcal / day</span></div>
          <div className="mt-2 text-[13px] text-ink2">Today: <b>{b.text}</b></div>
          <div className="mt-1 text-[12px] text-ink3">Safety floor for carry-over cuts: {b.floor.toLocaleString('en-AU')} kcal (estimated resting burn). It never changes the target you set.</div>
        </Card>

        {proposal && (
          <Card className="space-y-2 border border-amber-400/30 p-4">
            <div className="flex items-center gap-2"><b className="text-[15px]">Recommended change</b><Badge tone="amber">needs your OK</Badge></div>
            <div className="text-[22px] font-black">{proposal.from.toLocaleString('en-AU')} → {proposal.to.toLocaleString('en-AU')} kcal</div>
            <div className="text-[13px] leading-relaxed text-ink2"><b>Why:</b> {proposal.why}</div>
            {proposal.evidence.length > 0 && <ul className="list-disc pl-5 text-[12.5px] text-ink3">{proposal.evidence.map((e) => <li key={e}>{e}</li>)}</ul>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void acceptProposal().then(() => toast('Target updated — undo any time below'))}><Check size={15} /> Accept</Button>
              <Button className="flex-1" variant="secondary" onClick={() => void dismissProposal().then(() => toast('Kept your current target'))}><X size={15} /> Dismiss</Button>
            </div>
          </Card>
        )}

        <Section title="Change it yourself">
          <Card className="space-y-2 p-4">
            <div className="flex gap-2">
              <Input inputMode="numeric" placeholder={String(profile.calorieTarget)} value={val} onChange={(e) => setVal(e.target.value)} aria-label="New daily calorie target" />
              <Button onClick={() => { const n = parseInt(val.replace(/[,\s]/g, ''), 10); if (!(n >= MIN_BASE_KCAL && n <= 6000)) { toast(`Choose between ${MIN_BASE_KCAL} and 6,000 kcal`, 'error'); return } setConfirm(n) }}>Set</Button>
            </div>
            <div className="text-[11.5px] text-ink3">Below {MIN_BASE_KCAL.toLocaleString('en-AU')} kcal is not offered — very low targets cost muscle and training quality.</div>
          </Card>
        </Section>

        <Section title="Energy estimates">
          <Card className="space-y-1 p-4 text-[13px]">
            <div>Formula estimate (Mifflin-St Jeor × activity): <b>~{formula.toLocaleString('en-AU')} kcal/day</b></div>
            <div>From your logs + weight trend: <b>{adaptive ? `~${adaptive.tdee.toLocaleString('en-AU')} kcal/day` : 'not enough data yet'}</b></div>
            <div className="text-[11.5px] text-ink3">Both are estimates, not measured metabolism. Water, sodium and logging gaps move them.</div>
          </Card>
        </Section>

        <Section title="History" action={history.length ? <Button small variant="ghost" onClick={() => void undoLastChange().then((c) => toast(c ? `Undone — back to ${c.from.toLocaleString('en-AU')} kcal` : 'Nothing to undo'))}><RotateCcw size={14} /> Undo last</Button> : undefined}>
          <Card className="divide-y divide-line">
            {history.length === 0 && <div className="p-4 text-[13px] text-ink3">No changes recorded yet.</div>}
            {[...history].reverse().map((c) => (
              <div key={c.id} className="p-3 text-[13px]">
                <div className="flex justify-between"><b>{c.from.toLocaleString('en-AU')} → {c.to.toLocaleString('en-AU')} kcal</b><span className="text-ink3">{dayjs(c.effective).format('D MMM YYYY')}</span></div>
                <div className="text-[12px] text-ink2">{c.why}</div>
                <div className="text-[11px] text-ink3">{c.source === 'proposal-accepted' ? 'Accepted recommendation' : c.source === 'manual' ? 'Set by you' : c.source === 'undo' ? 'Undo' : 'Repair'}</div>
              </div>
            ))}
          </Card>
        </Section>
        {profile.calorieTarget < safetyFloor(profile) && <Callout tone="warn">Your target is below your estimated resting burn. That is allowed, but check in on energy and training quality.</Callout>}
      </div>
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} danger={false} title="Change your calorie target?"
        message={confirm !== null ? `${profile.calorieTarget.toLocaleString('en-AU')} → ${confirm.toLocaleString('en-AU')} kcal from today. It is recorded in History and can be undone.` : ''}
        confirmLabel="Yes, change it" onConfirm={() => { if (confirm !== null) void setBaseTarget(confirm).then(() => { toast('Target updated'); setVal('') }).catch((e: Error) => toast(e.message, 'error')); setConfirm(null) }} />
    </div>
  )
}
