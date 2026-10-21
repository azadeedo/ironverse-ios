// /pro — Ironverse Pro paywall (App Store build). Apple 3.1.2: shows the
// title, length and price of each plan, auto-renew terms, Restore Purchases and
// links to the Terms of Use and Privacy Policy.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Crown, X } from 'lucide-react'
import { Button, Card, Spinner } from '@/components/ui'
import { useUI } from '@/lib/store'
import {
  FALLBACK_AMOUNTS, FALLBACK_PRICES, PRIVACY_URL, PRODUCTS, PRO_FEATURES, TERMS_URL, buy, loadProducts,
  manageSubscription, restore, usePro, yearlySavingPct, type StoreProduct,
} from '@/lib/pro'

export default function ProScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const { tier, daysLeft } = usePro()
  const [products, setProducts] = useState<StoreProduct[] | null>(null)
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly')
  const [busy, setBusy] = useState(false)

  useEffect(() => { void loadProducts().then(setProducts) }, [])

  const m = products?.find((p) => p.id === PRODUCTS.monthly)
  const y = products?.find((p) => p.id === PRODUCTS.yearly)
  const monthly = { price: m?.price ?? FALLBACK_PRICES.monthly, amount: m?.amount ?? FALLBACK_AMOUNTS.monthly }
  const yearly = { price: y?.price ?? FALLBACK_PRICES.yearly, amount: y?.amount ?? FALLBACK_AMOUNTS.yearly }
  const save = yearlySavingPct(monthly.amount, yearly.amount)

  async function go(fn: () => Promise<boolean>, ok: string) {
    if (busy) return
    setBusy(true)
    try {
      if (await fn()) { toast(ok); navigate(-1) } else toast('No active subscription found on this Apple Account', 'error')
    } catch (e) {
      const msg = String((e as Error)?.message ?? e)
      if (!/cancel/i.test(msg)) toast('The App Store could not complete that — please try again', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto min-h-[100svh] max-w-lg px-4 pb-10 pt-safe">
      <div className="flex h-[52px] items-center justify-end">
        <button type="button" onClick={() => navigate(-1)} aria-label="Close" className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink2"><X size={22} /></button>
      </div>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-amber-600 text-black shadow-lg shadow-brand/30"><Crown size={30} /></div>
        <h1 className="shout mt-4 text-[32px] leading-none text-ink">Ironverse Pro</h1>
        <p className="mt-2 text-[13.5px] text-ink2">
          {tier === 'pro' ? 'You have Pro — thank you for supporting an Australian-made app.'
            : tier === 'trial' ? `Your free Premium week: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`
            : 'Your free week has ended. The free version keeps working — Pro unlocks everything below.'}
        </p>
      </div>

      <Card className="mt-5 space-y-2.5 p-4">
        {Object.values(PRO_FEATURES).map((f) => (
          <div key={f.title} className="flex gap-2.5">
            <Check size={18} className="mt-0.5 shrink-0 text-good" />
            <div><div className="text-[14px] font-semibold text-ink">{f.title}</div><div className="text-[12px] text-ink3">{f.detail}</div></div>
          </div>
        ))}
      </Card>

      {tier !== 'pro' && (
        <>
          <div className="mt-4 space-y-2">
            {([['yearly', 'Yearly', yearly.price, '/year', save > 0 ? `Save ${save}%` : ''], ['monthly', 'Monthly', monthly.price, '/month', '']] as const).map(([k, label, price, per, badge]) => (
              <button key={k} type="button" aria-pressed={plan === k} onClick={() => setPlan(k)}
                className={`pressable flex w-full items-center justify-between rounded-xl2 border p-3.5 text-left ${plan === k ? 'border-brand bg-brand/10' : 'border-line bg-surface2'}`}>
                <div>
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">{label}{badge && <span className="rounded-full bg-good/20 px-2 py-0.5 text-[11px] font-bold text-good">{badge}</span>}</div>
                  {k === 'yearly' && <div className="text-[12px] text-ink3">Discounted — about {(yearly.amount / 12).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} a month, billed once a year</div>}
                </div>
                <div className="text-right"><span className="big-num text-[17px] text-ink">{price}</span><span className="text-[12px] text-ink3">{per}</span></div>
              </button>
            ))}
          </div>
          {products === null && <div className="mt-2 flex justify-center"><Spinner /></div>}
          <Button full className="mt-4" disabled={busy} onClick={() => void go(() => buy(plan), 'Welcome to Ironverse Pro')}>
            {busy ? 'Working…' : `Subscribe ${plan === 'yearly' ? 'yearly' : 'monthly'}`}
          </Button>
        </>
      )}

      <div className="mt-3 flex justify-center gap-4 text-[13px]">
        <button type="button" disabled={busy} className="pressable min-h-[44px] text-brand" onClick={() => void go(restore, 'Pro restored')}>Restore purchases</button>
        {tier === 'pro' && <button type="button" className="pressable min-h-[44px] text-brand" onClick={() => void manageSubscription()}>Manage subscription</button>}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink3">
        Ironverse Pro is an auto-renewing subscription: {monthly.price} per month or {yearly.price} per year. Payment is charged to your Apple Account when you confirm.
        The subscription renews automatically unless it is cancelled at least 24 hours before the end of the current period, and your account is charged for renewal within 24 hours before the end of the period.
        Manage or cancel any time in your Apple Account settings. Your workouts, food logs and backups always stay yours, with or without Pro.
      </p>
      <div className="mt-2 flex justify-center gap-4 text-[12px]">
        <a className="text-brand underline" href={TERMS_URL} target="_blank" rel="noreferrer">Terms of Use (EULA)</a>
        <a className="text-brand underline" href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a>
      </div>
    </div>
  )
}
