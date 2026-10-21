// Pro gating UI (App Store build). A locked feature shows an upgrade card in
// its place — the feature's code and the user's data are never removed.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Lock } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { PRO_FEATURES, hasPro, usePro, type ProFeature } from '@/lib/pro'

export function ProLocked({ feature, compact = false }: { feature: ProFeature; compact?: boolean }) {
  const navigate = useNavigate()
  const f = PRO_FEATURES[feature]
  if (compact) {
    return (
      <Card className="flex items-center gap-3 p-3.5">
        <Lock size={18} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink">{f.title} · Pro</div><div className="text-[12px] text-ink3">{f.detail}</div></div>
        <Button small onClick={() => navigate('/pro')}>Unlock</Button>
      </Card>
    )
  }
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-sm flex-col items-center justify-center px-6 pt-safe text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand"><Crown size={30} /></div>
      <h1 className="shout mt-4 text-[26px] leading-none text-ink">{f.title}</h1>
      <p className="mt-2 text-[13.5px] text-ink2">{f.detail}. This is part of Ironverse Pro.</p>
      <Button full className="mt-6" onClick={() => navigate('/pro')}>See Pro</Button>
      <Button full variant="ghost" className="mt-1" onClick={() => navigate(-1)}>Not now</Button>
    </div>
  )
}

/** Renders children with Pro (or during the trial); otherwise a compact upgrade card. */
export function ProGate({ feature, children, fallback }: { feature: ProFeature; children: ReactNode; fallback?: ReactNode }) {
  const tier = usePro((s) => s.tier)
  if (hasPro(tier)) return <>{children}</>
  return <>{fallback ?? <ProLocked feature={feature} compact />}</>
}

/** Small status line: trial days left / free version → Pro. Hidden for Pro users and in the web build. */
export function TrialBanner() {
  const navigate = useNavigate()
  const { tier, daysLeft, ready } = usePro()
  if (!ready || tier === 'pro') return null
  return (
    <button type="button" onClick={() => navigate('/pro')}
      className="pressable mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 px-3.5 py-2.5 text-left">
      <Crown size={17} className="shrink-0 text-brand" />
      <span className="flex-1 text-[12.5px] text-ink">
        {tier === 'trial' ? <><b>Free Premium week</b> — {daysLeft} day{daysLeft === 1 ? '' : 's'} left. Everything is unlocked.</> : <><b>Free version</b> — upgrade to Pro to unlock everything.</>}
      </span>
      <span className="text-[12px] font-semibold text-brand">Pro</span>
    </button>
  )
}
