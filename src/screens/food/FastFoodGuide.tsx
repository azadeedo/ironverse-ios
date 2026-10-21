// Fast-food guide: what to order at the chains you actually drive past, what to
// take off, and how much each change saves. Calories are APPROXIMATE (they
// vary by store and recipe changes) — check the chain's app for exact numbers.
// The swap savings come from the ingredient itself (a tablespoon of mayo is
// ~90–100 kcal whoever makes it), so they hold everywhere.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, PageHeader, Section } from '@/components/ui'

interface Swap { id: string; text: string; kcal: number }
interface Chain { name: string; emoji: string; best: { item: string; why: string }[]; ask: string[]; skip: string[] }

const SWAPS: Swap[] = [
  { id: 'drink', text: 'Regular soft drink → Zero / No Sugar / water', kcal: 200 },
  { id: 'fries', text: 'Medium fries → side salad, corn or nothing', kcal: 300 },
  { id: 'friesS', text: 'Medium fries → small fries', kcal: 100 },
  { id: 'mayo', text: 'No mayo / aioli / special sauce (per burger)', kcal: 90 },
  { id: 'cheese', text: 'No cheese slice', kcal: 65 },
  { id: 'bacon', text: 'No bacon', kcal: 80 },
  { id: 'grilled', text: 'Crispy / fried chicken → grilled', kcal: 150 },
  { id: 'bun', text: 'No bun / lettuce wrap or eat open (one half)', kcal: 130 },
  { id: 'double', text: 'Double meat instead of a side (more protein, less carbs)', kcal: 0 },
  { id: 'dessert', text: 'Skip the dessert / thickshake', kcal: 350 },
  { id: 'dip', text: 'One dipping sauce instead of two', kcal: 50 },
  { id: 'sourcream', text: 'No sour cream / cheese in a burrito or bowl', kcal: 150 },
]

const CHAINS: Chain[] = [
  { name: "McDonald's", emoji: '🍟', best: [
    { item: 'Hamburger or Cheeseburger (~250–300 kcal)', why: 'Small, decent protein for the calories.' },
    { item: '6 Chicken McNuggets (~260 kcal) with one sauce', why: 'Easy to fit; sauces add 40–60 each.' },
    { item: 'Double Cheeseburger, no sauce (~400 kcal)', why: 'Most protein per calorie on the menu.' },
  ], ask: ['No mayo / Big Mac sauce', 'Small fries or a side salad', 'Coke No Sugar'], skip: ['Large meals (1,000+ kcal)', 'McFlurry / thickshakes (350–600 kcal)', 'Deluxe / bacon burgers'] },
  { name: 'KFC', emoji: '🍗', best: [
    { item: '2 pieces Original Recipe, skin partly off', why: 'Most of the fat is in the skin and breading.' },
    { item: 'Zinger burger, no mayo', why: 'Removing the mayo saves ~90 kcal.' },
    { item: 'Corn cob or small potato & gravy as the side', why: 'Much lighter than chips.' },
  ], ask: ['No mayo', 'Corn instead of chips', 'Pepsi Max / water'], skip: ['Boxed meals with chips + drink', 'Extra-crispy / Hot & Spicy (more breading)', 'Large popcorn chicken'] },
  { name: "Hungry Jack's", emoji: '🍔', best: [
    { item: 'Whopper Jr, no mayo', why: 'Flame-grilled patty, sensible size.' },
    { item: 'Grilled chicken burger (if available), no mayo', why: 'Grilled beats crispy by ~150 kcal.' },
  ], ask: ['No mayo', 'Small chips or side salad', 'Zero-sugar drink'], skip: ['Bacon deluxe stacks', 'Large onion rings', 'Thickshakes'] },
  { name: 'Subway', emoji: '🥖', best: [
    { item: '6-inch chicken breast or turkey on wholemeal', why: 'High protein, ~350–400 kcal.' },
    { item: 'Salad bowl with double chicken', why: 'Cuts ~200 kcal of bread, doubles protein.' },
  ], ask: ['Mustard, sweet onion or BBQ instead of creamy sauces', 'Load the salad', 'Skip cheese'], skip: ['Footlongs with cheese and ranch / chipotle (~800+)', 'Meatball sub', 'Cookies'] },
  { name: 'Guzman y Gomez', emoji: '🌯', best: [
    { item: 'Burrito bowl (no tortilla) with grilled chicken', why: 'The tortilla alone is ~300 kcal.' },
    { item: 'Ask for extra protein, black beans, salsa', why: 'More protein and fibre, few extra calories.' },
  ], ask: ['No sour cream or cheese', 'Salsa / pico instead of creamy sauce', 'Half rice'], skip: ['Nachos with everything', 'Corn chips + guac sides', 'Fried "mini" add-ons'] },
  { name: "Nando's", emoji: '🔥', best: [
    { item: 'Quarter chicken breast or chicken thighs', why: 'Grilled, high protein.' },
    { item: 'Sides: corn, garden salad, spicy rice (regular)', why: 'Lighter than chips or mash.' },
  ], ask: ['Peri-peri sauce (low calorie) instead of mayo', 'Breast instead of thigh for less fat'], skip: ['Chips + garlic bread combos', 'Creamy mash and coleslaw together'] },
  { name: 'Red Rooster / Oporto', emoji: '🐓', best: [
    { item: 'Quarter chicken (skin off) with a salad', why: 'Rotisserie, not fried.' },
    { item: 'Oporto grilled chicken burger, no mayo', why: 'Grilled + no mayo saves ~200 kcal.' },
  ], ask: ['Salad or corn instead of chips', 'Chilli sauce instead of mayo'], skip: ['Crispy / fried rolls', 'Rooster rolls with gravy + chips'] },
  { name: "Grill'd / burger bars", emoji: '🥬', best: [
    { item: 'Any grilled chicken or lean beef burger as a low-carb / lettuce option', why: 'Drops the bun (~150–200 kcal).' },
  ], ask: ['Sauce on the side', 'Salad instead of chips'], skip: ['Double patties + bacon + cheese', 'Loaded fries'] },
  { name: "Domino's / pizza", emoji: '🍕', best: [
    { item: 'Thin crust, chicken or veg, 2–3 slices', why: 'Thin crust saves ~40–60 kcal per slice.' },
  ], ask: ['Light cheese', 'Add a side salad instead of garlic bread'], skip: ['Deep pan / cheese-stuffed crust', 'Meat lovers with extra cheese', 'Garlic bread + wings sides'] },
]

export default function FastFoodGuide() {
  const navigate = useNavigate()
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<string | null>(CHAINS[0].name)
  const saved = useMemo(() => SWAPS.filter((s) => on[s.id]).reduce((a, s) => a + s.kcal, 0), [on])
  return (
    <div className="pb-12">
      <PageHeader title="Fast-food guide" back subtitle="Order smarter — same place, a lot fewer calories." />
      <Section title="Swaps calculator">
        <Card className="p-3">
          {SWAPS.map((s) => (
            <label key={s.id} className="flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-0">
              <input type="checkbox" checked={!!on[s.id]} onChange={(e) => setOn((m) => ({ ...m, [s.id]: e.target.checked }))} className="h-5 w-5 accent-[var(--brand,#fbbf24)]" />
              <span className="flex-1">{s.text}</span>
              <b className="text-emerald-400">{s.kcal ? `−${s.kcal}` : '+P'}</b>
            </label>
          ))}
          <div className="mt-2 flex items-baseline justify-between"><span className="text-[13px] text-ink3">You save about</span><b className="text-[24px] text-emerald-400">{saved} kcal</b></div>
          <div className="text-[11.5px] text-ink3">Approximate — based on typical serves. Check the chain’s app for exact numbers.</div>
        </Card>
      </Section>
      <Section title="By chain">
        {CHAINS.map((c) => (
          <Card key={c.name} className="mb-2 p-0">
            <button type="button" onClick={() => setOpen(open === c.name ? null : c.name)} className="pressable flex w-full items-center gap-2 px-4 py-3 text-left"><span className="text-[20px]">{c.emoji}</span><b className="flex-1 text-[15px]">{c.name}</b><span className="text-ink3">{open === c.name ? '▲' : '▼'}</span></button>
            {open === c.name && (
              <div className="space-y-2 px-4 pb-4 text-[13px]">
                <div><div className="mb-1 font-bold text-emerald-400">Order this</div>{c.best.map((b) => <div key={b.item} className="mb-1.5"><b>{b.item}</b><div className="text-[12px] text-ink3">{b.why}</div></div>)}</div>
                <div><div className="mb-1 font-bold text-sky-400">Ask for</div>{c.ask.map((a) => <div key={a}>• {a}</div>)}</div>
                <div><div className="mb-1 font-bold text-red-400">Skip</div>{c.skip.map((a) => <div key={a}>• {a}</div>)}</div>
              </div>
            )}
          </Card>
        ))}
      </Section>
      <div className="mx-4 text-[12px] text-ink3">Ate it anyway? Log it, then use <button type="button" className="text-brand underline" onClick={() => navigate('/food')}>Food</button> → “Spread it” to balance the week instead of starving tomorrow.</div>
    </div>
  )
}
