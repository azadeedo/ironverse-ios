// ============================================================
// Ironverse Pro — free trial, free tier and the subscription (App Store build).
//
//   • first 7 days after install: everything unlocked (Premium trial, no card)
//   • then FREE: the core app stays fully usable (no ads, ever)
//   • PRO (monthly or yearly subscription via StoreKit): everything
//
// The web build is never gated: tier() is always 'pro' there, so the owner's
// web app behaves exactly as before. Nothing is deleted for free users — Pro
// features are locked behind an upgrade card, and every record they ever made
// stays visible, and backup/export are always free.
// ============================================================

import { create } from 'zustand'
import dayjs from 'dayjs'
import { getSetting, setSetting } from '@/db'
import { isAppStoreEdition, isNativeApp } from './edition'

export const TRIAL_DAYS = 7
export const PRODUCTS = {
  monthly: 'com.nouriapps.ironverse.pro.monthly',
  yearly: 'com.nouriapps.ironverse.pro.yearly',
} as const
/** shown when the App Store can't be reached (store prices always win) */
export const FALLBACK_PRICES = { monthly: 'A$12.99', yearly: 'A$79.99' }
export const FALLBACK_AMOUNTS = { monthly: 12.99, yearly: 79.99 }

/** yearly saving vs paying monthly for 12 months, whole percent (floored, never overstated) */
export function yearlySavingPct(monthly: number, yearly: number): number {
  if (!(monthly > 0) || !(yearly > 0)) return 0
  return Math.max(0, Math.floor((1 - yearly / (monthly * 12)) * 100))
}
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
export const PRIVACY_URL = 'https://ironverse-legal.netlify.app/privacy-policy.html'

const KEYS = { trialStart: 'pro:trialStart', entitlement: 'pro:entitlement' } as const

export type Tier = 'pro' | 'trial' | 'free'
export interface Entitlement { active: boolean; productId?: string; expires?: string; checkedAt: string }

// ---------- what Pro adds (also the paywall copy) ----------
export type ProFeature =
  | 'program12' | 'analytics' | 'barcode' | 'aiPhoto' | 'goalCoach' | 'anatomy3d'
  | 'mealPlan' | 'photoCompare' | 'quests'

export const PRO_FEATURES: Record<ProFeature, { title: string; detail: string }> = {
  program12: { title: '12-week program', detail: '48 written workouts with weekly reviews' },
  analytics: { title: 'Advanced progress', detail: 'Progress hub, insights, weekly review, replays' },
  barcode: { title: 'Barcode scanner', detail: 'Scan packaged food and get a health score' },
  aiPhoto: { title: 'Meal photo estimates', detail: 'Snap a meal, get calories and macros' },
  goalCoach: { title: 'Goal coach', detail: 'Daily calorie targets toward your goal weight' },
  anatomy3d: { title: '3D anatomy', detail: 'Interactive 3D body and muscle explorer' },
  mealPlan: { title: 'Meal plans', detail: 'Plans, photo diary and nutrition ranges' },
  photoCompare: { title: 'Photo compare', detail: 'Side-by-side progress photos' },
  quests: { title: 'Strength journey', detail: 'PR quest, skills and strength levels' },
}

/** route prefix → the Pro feature it belongs to (free routes are simply absent) */
export const PRO_ROUTES: { test: RegExp; feature: ProFeature }[] = [
  { test: /^\/program(\/|$)/, feature: 'program12' },
  { test: /^\/(hub|review|replay|nutrition-week)(\/|$)/, feature: 'analytics' },
  { test: /^\/health-scan(\/|$)/, feature: 'barcode' },
  { test: /^\/(food-photos|meal-plan)(\/|$)/, feature: 'mealPlan' },
  { test: /^\/anatomy\/3d(\/|$)/, feature: 'anatomy3d' },
  { test: /^\/(pr-quest|skills|strength-journey|body)(\/|$)/, feature: 'quests' },
]
export function proFeatureForPath(path: string): ProFeature | null {
  return PRO_ROUTES.find((r) => r.test.test(path))?.feature ?? null
}

// ---------- tier ----------
export function computeTier(now: dayjs.Dayjs, trialStart: string | null, ent: Entitlement | null): Tier {
  if (ent?.active && (!ent.expires || dayjs(ent.expires).isAfter(now))) return 'pro'
  if (trialStart && now.diff(dayjs(trialStart), 'day', true) < TRIAL_DAYS) return 'trial'
  return 'free'
}
export function trialDaysLeft(now: dayjs.Dayjs, trialStart: string | null): number {
  if (!trialStart) return TRIAL_DAYS
  return Math.max(0, Math.ceil(TRIAL_DAYS - now.diff(dayjs(trialStart), 'day', true)))
}

interface ProState {
  tier: Tier
  daysLeft: number
  ready: boolean
  refresh: () => Promise<void>
}
export const usePro = create<ProState>((set) => ({
  tier: 'pro', daysLeft: TRIAL_DAYS, ready: false,
  async refresh() {
    if (!isAppStoreEdition()) { set({ tier: 'pro', ready: true }); return }
    let start = await getSetting<string | null>(KEYS.trialStart, null)
    if (!start) { start = new Date().toISOString(); await setSetting(KEYS.trialStart, start) }
    const ent = await getSetting<Entitlement | null>(KEYS.entitlement, null)
    const now = dayjs()
    set({ tier: computeTier(now, start, ent), daysLeft: trialDaysLeft(now, start), ready: true })
  },
}))

/** true when the user may use this Pro feature right now */
export function hasPro(tier: Tier): boolean { return tier !== 'free' }

// ---------- StoreKit (iOS) ----------
async function store() {
  const m = await import('@capgo/native-purchases')
  return { NP: m.NativePurchases, SUBS: m.PURCHASE_TYPE.SUBS }
}

export interface StoreProduct { id: string; price: string; amount: number; title: string }
export async function loadProducts(): Promise<StoreProduct[]> {
  if (!isNativeApp()) return []
  try {
    const { NP, SUBS } = await store()
    const { products } = await NP.getProducts({ productIdentifiers: [PRODUCTS.monthly, PRODUCTS.yearly], productType: SUBS })
    return products.map((p) => ({ id: p.identifier, price: p.priceString, amount: p.price, title: p.title }))
  } catch { return [] }
}

/** Ask the App Store what this Apple Account is entitled to and remember it. */
export async function syncEntitlement(): Promise<Entitlement> {
  // outside the iOS app there is no App Store to ask — keep whatever is stored
  if (!isNativeApp()) {
    await usePro.getState().refresh()
    return (await getSetting<Entitlement | null>(KEYS.entitlement, null)) ?? { active: false, checkedAt: new Date().toISOString() }
  }
  const checkedAt = new Date().toISOString()
  let ent: Entitlement = { active: false, checkedAt }
  if (isNativeApp()) {
    try {
      const { NP, SUBS } = await store()
      const { purchases } = await NP.getPurchases({ productType: SUBS, onlyCurrentEntitlements: true })
      const live = purchases.find((t) => (Object.values(PRODUCTS) as string[]).includes(t.productIdentifier)
        && (t.isActive || t.subscriptionState === 'subscribed' || t.subscriptionState === 'inGracePeriod' || t.subscriptionState === 'inBillingRetryPeriod'))
      if (live) ent = { active: true, productId: live.productIdentifier, expires: live.expirationDate, checkedAt }
    } catch {
      // offline: keep the last known answer rather than locking a paying user out
      const prev = await getSetting<Entitlement | null>(KEYS.entitlement, null)
      if (prev) ent = { ...prev, checkedAt: prev.checkedAt }
    }
  }
  await setSetting(KEYS.entitlement, ent)
  await usePro.getState().refresh()
  return ent
}

export async function buy(plan: keyof typeof PRODUCTS): Promise<boolean> {
  const { NP, SUBS } = await store()
  await NP.purchaseProduct({ productIdentifier: PRODUCTS[plan], productType: SUBS, quantity: 1 })
  return (await syncEntitlement()).active
}

export async function restore(): Promise<boolean> {
  const { NP } = await store()
  await NP.restorePurchases()
  return (await syncEntitlement()).active
}

export async function manageSubscription(): Promise<void> {
  const { NP } = await store()
  await NP.manageSubscriptions()
}
