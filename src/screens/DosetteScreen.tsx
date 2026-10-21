// Virtual pill box — same layout as his 7-day box (SUN–SAT × Morning / Noon /
// Evening / Bed). Tells him which compartment each supplement goes in, ticks
// what's taken, tracks how many are left and when to reorder, and explains
// what missing one actually does.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import dayjs from 'dayjs'
import { db } from '@/db'
import { Badge, Button, Card, Input, PageHeader, Section, Sheet } from '@/components/ui'
import { useUI } from '@/lib/store'
import { newId } from '@/lib/id'
import {
  BOX_DAYS, DAY_SHORT, MISS_EVIDENCE, SLOT_LABEL, SLOTS, compartment, isTaken, loadDosette, mirrorCreatine, missStreak,
  onDay, qty, recommendations, saveDosette, stockStatus, takenKey, weeklyFill, type DayRule, type DoseItem, type DosetteState, type Slot,
} from '@/lib/dosette'
import { useProfile } from './food/useFoodData'

type Tab = 'today' | 'box' | 'fill' | 'stock' | 'insights' | 'items'
const RULE_LABEL: Record<DayRule, string> = { daily: 'Every day', training: 'Training days', rest: 'Rest days', weekly: 'Once a week', asneeded: 'Only when needed' }

function Dot({ c }: { c: string }) { return <i className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/30" style={{ background: c }} /> }

export default function DosetteScreen() {
  const toast = useUI((s) => s.toast)
  const profile = useProfile()
  const [st, setSt] = useState<DosetteState | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [cell, setCell] = useState<{ d: number; s: Slot } | null>(null)
  const [edit, setEdit] = useState<DoseItem | null>(null)
  const today = dayjs().format('YYYY-MM-DD'), wd = dayjs().day()
  useEffect(() => { void loadDosette().then(setSt) }, [])
  const update = (fn: (s: DosetteState) => DosetteState) => setSt((cur) => { if (!cur) return cur; const n = fn(structuredClone(cur)); void saveDosette(n); return n })

  const weekFood = useLiveQuery(() => db.foodLog.where('date').aboveOrEqual(dayjs().subtract(6, 'day').format('YYYY-MM-DD')).toArray(), [])
  const ctx = useMemo(() => {
    if (!weekFood || !profile) return {}
    const days = new Set(weekFood.map((e) => e.date)).size || 1
    const prot = weekFood.reduce((a, e) => a + (e.protein || 0), 0) / days
    const fibreToday = weekFood.filter((e) => e.date === today).reduce((a, e) => a + (e.fibre || 0), 0)
    return { proteinGap: profile.proteinTarget ? profile.proteinTarget - prot : undefined, fibreToday }
  }, [weekFood, profile, today])

  if (!st) return <div className="p-6 text-ink3">Loading…</div>
  const items = st.items
  const training = st.trainingDays

  const toggle = (date: string, slot: Slot, it: DoseItem) => update((s) => {
    const k = takenKey(date, slot), L = s.taken[k] ?? []
    const on = !L.includes(it.id)
    s.taken[k] = on ? [...L, it.id] : L.filter((x) => x !== it.id)
    if (it.kind === 'creatine') void mirrorCreatine(date, on)
    return s
  })
  const takeAll = (date: string, slot: Slot) => update((s) => {
    const due = compartment(s.items, dayjs(date).day(), slot, s.trainingDays).map((x) => x.id)
    s.taken[takenKey(date, slot)] = [...new Set([...(s.taken[takenKey(date, slot)] ?? []), ...due])]
    if (s.items.some((x) => due.includes(x.id) && x.kind === 'creatine')) void mirrorCreatine(date, true)
    return s
  })

  const misses = items.map((it) => ({ it, n: missStreak(st, it, today) })).filter((x) => x.n > 0 && x.it.rule !== 'asneeded')
  const lowStock = items.map((it) => ({ it, s: stockStatus(it, training, today) })).filter((x) => x.s && x.s.level !== 'fine')

  return (
    <div className="pb-12">
      <PageHeader title="Pill box" back subtitle="Your 7-day box — what goes where, what’s left, what you missed." />
      <div className="mx-4 mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {([['today', 'Today'], ['box', 'Box'], ['fill', 'Fill it'], ['stock', 'Stock'], ['insights', 'Insights'], ['items', 'Edit']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`pressable shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold ${tab === k ? 'bg-brand text-black' : 'bg-surface2 text-ink2'}`}>{l}</button>
        ))}
      </div>

      {tab === 'today' && (
        <Section title={`${dayjs().format('dddd')} · ${training.includes(wd) ? 'training day' : 'rest day'}`}>
          {lowStock.length > 0 && <Card className="mb-2 border-amber-400/40 p-3 text-[12.5px]">🛒 {lowStock.map((x) => x.it.name.split(' (')[0]).join(', ')} — running low. <button type="button" className="text-brand underline" onClick={() => setTab('stock')}>See stock</button></Card>}
          {SLOTS.map((slot) => {
            const due = compartment(items, wd, slot, training)
            if (!due.length) return null
            const done = due.every((it) => isTaken(st, today, slot, it.id))
            return (
              <Card key={slot} className="mb-2 p-3">
                <div className="mb-1.5 flex items-center justify-between"><b className="text-[14px]">{SLOT_LABEL[slot]}</b>{done ? <Badge tone="green">✓ all taken</Badge> : <button type="button" onClick={() => takeAll(today, slot)} className="pressable rounded-full bg-brand px-3 py-1 text-[12px] font-bold text-black">Took them all</button>}</div>
                {due.map((it) => { const on = isTaken(st, today, slot, it.id); return (
                  <button key={it.id} type="button" onClick={() => toggle(today, slot, it)} className="pressable flex w-full items-center gap-2.5 border-t border-line py-2 text-left text-[13px]">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line'}`}>{on ? '✓' : ''}</span>
                    <Dot c={it.colour} /><span className="min-w-0 flex-1"><span className={on ? 'text-ink3 line-through' : ''}>{it.name}</span><span className="block text-[11.5px] text-ink3">{qty(it.count, it.unit)}{it.note ? ` · ${it.note}` : ''}</span></span>
                  </button>) })}
              </Card>
            )
          })}
          {(() => { const opt = items.filter((it) => it.rule === 'asneeded' && !it.paused); return opt.length ? (
            <Card className="p-3 text-[13px]"><b>Only when needed</b>{opt.map((it) => <div key={it.id} className="mt-1.5 flex items-center gap-2"><Dot c={it.colour} /><span className="flex-1">{it.name}{it.kind === 'fibre' && ctx.fibreToday !== undefined ? <span className="block text-[11.5px] text-ink3">{ctx.fibreToday < 25 ? `Suggested today — only ${Math.round(ctx.fibreToday)} g fibre logged (aim 25–30 g)` : `Not needed — ${Math.round(ctx.fibreToday)} g fibre logged today`}</span> : <span className="block text-[11.5px] text-ink3">{it.note}</span>}</span><button type="button" onClick={() => toggle(today, it.slots[0], it)} className={`pressable rounded-full px-2.5 py-1 text-[12px] font-semibold ${isTaken(st, today, it.slots[0], it.id) ? 'bg-emerald-500 text-white' : 'bg-surface3'}`}>{isTaken(st, today, it.slots[0], it.id) ? '✓ took' : 'Took it'}</button></div>)}</Card>) : null })()}
        </Section>
      )}

      {tab === 'box' && (
        <Section title="Your box">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
              {BOX_DAYS.map((d) => (
                <div key={d} className="space-y-1.5">
                  <div className={`rounded-lg py-1 text-center text-[11.5px] font-bold ${d === wd ? 'bg-brand text-black' : 'bg-surface2 text-ink2'}`}>{DAY_SHORT[d]}{training.includes(d) ? ' 🏋️' : ''}</div>
                  {SLOTS.map((s) => {
                    const c = compartment(items, d, s, training)
                    const date = dayjs().add(d - wd, 'day').format('YYYY-MM-DD')
                    const all = c.length > 0 && c.every((it) => isTaken(st, date, s, it.id))
                    return (
                      <button key={s} type="button" onClick={() => setCell({ d, s })} className={`pressable flex min-h-[74px] w-full flex-col rounded-xl border p-1.5 text-left ${all ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-line bg-surface2'}`}>
                        <span className="text-[9.5px] font-bold uppercase text-ink3">{SLOT_LABEL[s].slice(0, 4)}</span>
                        <span className="mt-1 flex flex-wrap gap-0.5">{c.flatMap((it) => Array.from({ length: Math.min(it.count, 3) }, (_, i) => <Dot key={it.id + i} c={it.colour} />))}</span>
                        <span className="mt-auto text-[9.5px] text-ink3">{c.length ? `${c.length} item${c.length > 1 ? 's' : ''}` : '—'}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 text-[11.5px] text-ink3">Tap a compartment to see exactly what goes in it. 🏋️ = training day ({training.map((d) => DAY_SHORT[d]).join(', ')}).</div>
        </Section>
      )}

      {tab === 'fill' && (
        <Section title="Fill the box (Sunday → Saturday)">
          <Card className="mb-2 p-3 text-[13px]"><b>Take out for the week</b>{weeklyFill(items, training).map(({ item, total }) => <div key={item.id} className="mt-1.5 flex items-center gap-2"><Dot c={item.colour} /><span className="flex-1">{item.name}</span><b>{qty(total, item.unit)}</b></div>)}</Card>
          {SLOTS.map((s) => (
            <Card key={s} className="mb-2 p-3 text-[13px]">
              <b>{SLOT_LABEL[s]} row</b>
              {items.filter((it) => it.slots.includes(s) && it.rule !== 'asneeded' && !it.paused).map((it) => {
                const days = BOX_DAYS.filter((d) => onDay(it, d, training))
                return <div key={it.id} className="mt-1.5 flex items-start gap-2"><Dot c={it.colour} /><span className="flex-1">{it.count} × {it.name}<span className="block text-[11.5px] text-ink3">{days.length === 7 ? 'every compartment in this row' : `only ${days.map((d) => DAY_SHORT[d]).join(', ')}`}</span></span></div>
              })}
            </Card>
          ))}
          <div className="text-[11.5px] text-ink3">“Only when needed” items (melatonin, fibre gummies) stay in their bottles.</div>
        </Section>
      )}

      {tab === 'stock' && (
        <Section title="How many are left">
          {items.filter((it) => !it.paused).map((it) => ({ it, s: stockStatus(it, training, today) })).sort((a, b) => (a.s?.daysLeft ?? 9999) - (b.s?.daysLeft ?? 9999)).map(({ it, s }) => (
            <Card key={it.id} className="mb-2 p-3 text-[13px]">
              <div className="flex items-center gap-2"><Dot c={it.colour} /><b className="flex-1">{it.name}</b>{s ? <Badge tone={s.level === 'now' ? 'red' : s.level === 'soon' ? 'amber' : 'green'}>{s.level === 'now' ? 'Order now' : s.level === 'soon' ? 'Order soon' : 'Not urgent'}</Badge> : <Badge tone="gray">Count not set</Badge>}</div>
              {s && s.runOut && <div className="mt-1 text-[12px] text-ink3">About {qty(s.left, it.unit)} left · lasts {s.daysLeft} days (to {dayjs(s.runOut).format('D MMM')}) · order by <b className={s.level === 'now' ? 'text-red-400' : ''}>{dayjs(s.orderBy).format('ddd D MMM')}</b> ({it.leadDays ?? 7}-day delivery)</div>}
              {s && !s.runOut && <div className="mt-1 text-[12px] text-ink3">{qty(s.left, it.unit)} · used only when needed</div>}
              <StockInput it={it} onSave={(n, lead) => update((x) => { const t = x.items.find((y) => y.id === it.id)!; t.stock = n; t.stockAt = today; if (lead) t.leadDays = lead; return x })} />
            </Card>
          ))}
          <div className="text-[11.5px] text-ink3">Count what’s in the bottle (not the box) and save — the app subtracts each day’s doses from then on.</div>
        </Section>
      )}

      {tab === 'insights' && (
        <Section title="Missed doses">
          {!misses.length && <Card className="p-3 text-[13px] text-ink3">Nothing missed recently — tick doses on the Today tab and this keeps watch.</Card>}
          {misses.map(({ it, n }) => { const e = MISS_EVIDENCE[it.kind ?? ''] ; const big = e && n >= e.days; return (
            <Card key={it.id} className={`mb-2 p-3 text-[13px] ${big ? 'border-amber-400/40' : ''}`}>
              <div className="flex items-center gap-2"><Dot c={it.colour} /><b className="flex-1">{it.name}</b><Badge tone={big ? 'amber' : 'gray'}>missed {n} day{n > 1 ? 's' : ''} in a row</Badge></div>
              <div className="mt-1 text-ink2">{e ? (big ? e.streak : e.one) : 'Get back on it at the next scheduled time — don’t double up.'}</div>
            </Card>) })}
          <div className="mt-4 mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink3">Worth adding</div>
          {recommendations(items, ctx).map((r) => <Card key={r.title} className="mb-2 p-3 text-[13px]"><b>{r.title}</b><div className="mt-0.5 text-ink2">{r.why}</div></Card>)}
          <div className="text-[11px] text-ink3">General information, not medical advice. Check supplements with your GP or pharmacist, especially if you take prescription medicines.</div>
        </Section>
      )}

      {tab === 'items' && (
        <Section title="Supplements">
          <Card className="mb-2 p-3 text-[13px]"><b>Training days</b><div className="mt-1.5 flex gap-1">{BOX_DAYS.map((d) => <button key={d} type="button" onClick={() => update((s) => { s.trainingDays = s.trainingDays.includes(d) ? s.trainingDays.filter((x) => x !== d) : [...s.trainingDays, d].sort(); return s })} className={`pressable flex-1 rounded-lg py-1.5 text-[11px] font-bold ${training.includes(d) ? 'bg-brand text-black' : 'bg-surface3 text-ink3'}`}>{DAY_SHORT[d]}</button>)}</div></Card>
          {items.map((it) => (
            <button key={it.id} type="button" onClick={() => setEdit(it)} className={`pressable mb-1.5 flex w-full items-center gap-2 rounded-2xl bg-surface2 px-3 py-2.5 text-left text-[13px] ${it.paused ? 'opacity-50' : ''}`}>
              <Dot c={it.colour} /><span className="min-w-0 flex-1"><b className="block truncate">{it.name}</b><span className="text-[11.5px] text-ink3">{it.count} {it.unit} · {it.slots.map((s) => SLOT_LABEL[s]).join(' + ')} · {RULE_LABEL[it.rule]}{it.rule === 'weekly' ? ` (${DAY_SHORT[it.weekday ?? 0]})` : ''}{it.paused ? ' · paused' : ''}</span></span><span className="text-ink3">›</span>
            </button>
          ))}
          <Button full variant="secondary" onClick={() => setEdit({ id: newId(), name: '', count: 1, unit: 'capsule', slots: ['morn'], rule: 'daily', colour: '#9ca3af', leadDays: 7 })}>+ Add a supplement</Button>
        </Section>
      )}

      {cell && (() => { const c = compartment(items, cell.d, cell.s, training); const date = dayjs().add(cell.d - wd, 'day').format('YYYY-MM-DD'); return (
        <Sheet open onClose={() => setCell(null)} title={`${DAY_SHORT[cell.d]} · ${SLOT_LABEL[cell.s]}`}>
          {!c.length && <div className="text-[13px] text-ink3">Empty compartment.</div>}
          {c.map((it) => <button key={it.id} type="button" onClick={() => toggle(date, cell.s, it)} className="pressable flex w-full items-center gap-2.5 border-b border-line py-2.5 text-left text-[13.5px]"><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${isTaken(st, date, cell.s, it.id) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line'}`}>{isTaken(st, date, cell.s, it.id) ? '✓' : ''}</span><Dot c={it.colour} /><span className="flex-1">{it.count} × {it.name}<span className="block text-[11.5px] text-ink3">{it.note}</span></span></button>)}
          <div className="mt-2 text-[11.5px] text-ink3">Tap to tick as taken ({dayjs(date).format('ddd D MMM')}).</div>
        </Sheet>) })()}

      {edit && <EditItem item={edit} onClose={() => setEdit(null)} onSave={(it) => { update((s) => { const i = s.items.findIndex((x) => x.id === it.id); if (i >= 0) s.items[i] = it; else s.items.push(it); return s }); setEdit(null); toast('Saved') }}
        onDelete={(id) => { const before = st; update((s) => { s.items = s.items.filter((x) => x.id !== id); return s }); setEdit(null); toast('Removed from the box'); void before }} />}
    </div>
  )
}

function StockInput({ it, onSave }: { it: DoseItem; onSave: (n: number, lead?: number) => void }) {
  const [n, setN] = useState(''), [lead, setLead] = useState(String(it.leadDays ?? 7))
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <Input inputMode="numeric" placeholder={`${it.unit.length <= 2 ? it.unit : it.unit + 's'} left`} value={n} onChange={(e) => setN(e.target.value)} />
      <Input inputMode="numeric" aria-label="Delivery days" value={lead} onChange={(e) => setLead(e.target.value)} className="w-16" />
      <span className="text-[11px] text-ink3">days</span>
      <Button small disabled={!n} onClick={() => { onSave(Math.max(0, parseFloat(n) || 0), parseInt(lead) || undefined); setN('') }}>Save</Button>
    </div>
  )
}

function EditItem({ item, onClose, onSave, onDelete }: { item: DoseItem; onClose: () => void; onSave: (it: DoseItem) => void; onDelete: (id: string) => void }) {
  const [it, setIt] = useState<DoseItem>(item)
  const set = (p: Partial<DoseItem>) => setIt((x) => ({ ...x, ...p }))
  return (
    <Sheet open onClose={onClose} title={item.name ? 'Edit supplement' : 'Add a supplement'}>
      <div className="space-y-3 text-[13px]">
        <Input placeholder="Name, e.g. Magnesium glycinate" aria-label="Name, Magnesium glycinate" value={it.name} onChange={(e) => set({ name: e.target.value })} />
        <div className="flex gap-2"><Input inputMode="decimal" value={String(it.count)} onChange={(e) => set({ count: parseFloat(e.target.value) || 1 })} className="w-20" /><Input value={it.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="capsule" /><input type="color" value={it.colour} onChange={(e) => set({ colour: e.target.value })} className="h-11 w-12 rounded-lg" aria-label="Pill colour" /></div>
        <div><div className="mb-1 text-ink3">Compartments</div><div className="flex gap-1.5">{SLOTS.map((s) => <button key={s} type="button" onClick={() => set({ slots: it.slots.includes(s) ? it.slots.filter((x) => x !== s) : [...it.slots, s] })} className={`pressable flex-1 rounded-lg py-2 text-[12px] font-semibold ${it.slots.includes(s) ? 'bg-brand text-black' : 'bg-surface3'}`}>{SLOT_LABEL[s]}</button>)}</div></div>
        <div><div className="mb-1 text-ink3">Which days</div><div className="flex flex-wrap gap-1.5">{(Object.keys(RULE_LABEL) as DayRule[]).map((r) => <button key={r} type="button" onClick={() => set({ rule: r })} className={`pressable rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${it.rule === r ? 'bg-brand text-black' : 'bg-surface3'}`}>{RULE_LABEL[r]}</button>)}</div>
          {it.rule === 'weekly' && <div className="mt-1.5 flex gap-1">{BOX_DAYS.map((d) => <button key={d} type="button" onClick={() => set({ weekday: d })} className={`pressable flex-1 rounded-lg py-1.5 text-[11px] font-bold ${(it.weekday ?? 0) === d ? 'bg-brand text-black' : 'bg-surface3'}`}>{DAY_SHORT[d]}</button>)}</div>}
        </div>
        <Input placeholder="Note (with food, before training…)" aria-label="Note (with food, before training…)" value={it.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!it.paused} onChange={(e) => set({ paused: e.target.checked })} className="h-5 w-5" /> Paused (keep it, but don’t put it in the box)</label>
        <Button full disabled={!it.name.trim() || !it.slots.length} onClick={() => onSave({ ...it, name: it.name.trim() })}>Save</Button>
        {item.name && <Button full variant="danger" onClick={() => onDelete(item.id)}>Remove</Button>}
      </div>
    </Sheet>
  )
}
