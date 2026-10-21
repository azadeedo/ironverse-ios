// Water & Creatine: big daily ring + quick adds + timeline + 7-day chart,
// creatine tick with 30-day adherence grid and streak, and the reminders panel
// (honest copy: same-day timers fire while the app is open).

import { creatineDoseFor } from '@/lib/owner'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, BellRing, Check, Droplets, GlassWater, Pill, Plus, Trash2 } from 'lucide-react'
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, ListGroup, ListRow,
  Modal, PageHeader, Section, Spinner, Toggle,
} from '@/components/ui'
import { BarChart, ProgressRing } from '@/components/charts'
import { db, getProfile, getSetting, saveProfile, setSetting } from '@/db'
import { newId, nowIso, todayStr } from '@/lib/id'
import { dayjs } from '@/lib/fmt'
import { ensurePermission, showNotification } from '@/lib/notify'
import { useUI } from '@/lib/store'
import { deleteWithUndo, toastWithUndo } from '@/lib/undo'
import { mealForNow } from './food/helpers'
import type { CreatineLog, ReminderConfig, WaterLog } from '@/db/types'
import { Stepper } from './cardio/shared'
import { ed, isAppStoreEdition, isNativeApp } from '@/lib/edition'

const WATER = '#38bdf8'
const QUICK = [250, 500, 750]

/** IV-23: saved bottles & drinks. `pct` = how much of it counts toward water (honest default 100). */
interface Bottle { id: string; name: string; ml: number; pct: number; /** v10: drinks with calories also go into the food log */ kcal?: number; protein?: number; carbs?: number; fat?: number }
/** his energy drink: mostly water — research finds caffeinated drinks hydrate about as well as water at normal doses (Maughan et al. 2016, Beverage Hydration Index) */
const MONSTER_BOTTLE: Bottle = { id: 'owner-monster-peach', name: 'Monster Ultra Peachy Keen', ml: 500, pct: 100, kcal: 12, carbs: 3 }
const DEFAULT_BOTTLES: Bottle[] = ed([MONSTER_BOTTLE], [{ id: 'bottle-750', name: 'Water bottle', ml: 750, pct: 100 }])

function BottleRow({ onAdd }: { onAdd: (b: Bottle) => void }) {
  const bottles = useLiveQuery(() => getSetting<Bottle[]>('water:bottles', DEFAULT_BOTTLES), []) ?? DEFAULT_BOTTLES
  // existing users: add the Monster bottle once (writes can't happen inside a live query)
  useEffect(() => { void (async () => {
    if (isAppStoreEdition()) return // the owner's drink is pre-saved in the web app only
    if (await getSetting<boolean>('water:monster-v1', false)) return
    await setSetting('water:monster-v1', true)
    const L = await getSetting<Bottle[]>('water:bottles', DEFAULT_BOTTLES)
    if (!L.some((b) => b.id === MONSTER_BOTTLE.id)) await setSetting('water:bottles', [MONSTER_BOTTLE, ...L])
  })() }, [])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', ml: '', pct: '100', kcal: '', protein: '' })
  const save = async () => {
    const ml = Math.round(Number(f.ml)), pct = Math.round(Number(f.pct)), kcal = Math.max(0, Math.round(Number(f.kcal) || 0)), protein = Math.max(0, Number(f.protein) || 0)
    if (!f.name.trim() || !(ml >= 50 && ml <= 3000) || !(pct >= 0 && pct <= 100)) return
    await setSetting('water:bottles', [...bottles, { id: newId(), name: f.name.trim(), ml, pct, ...(kcal ? { kcal } : {}), ...(protein ? { protein } : {}) }])
    setF({ name: '', ml: '', pct: '100', kcal: '', protein: '' }); setOpen(false)
  }
  return (
    <div className="mt-3 w-full">
      <div className="flex flex-wrap gap-1.5">
        {bottles.map((b) => (
          <button key={b.id} type="button" onClick={() => onAdd(b)} onContextMenu={(e) => { e.preventDefault(); if (confirm(`Remove “${b.name}”?`)) void setSetting('water:bottles', bottles.filter((x) => x.id !== b.id)) }}
            className="pressable rounded-full bg-sky-400/12 px-3 py-1.5 text-[12.5px] font-semibold text-sky-400">{b.name} · {b.ml} ml{b.pct < 100 ? ` (${b.pct}%)` : ''}{b.kcal ? ` · ${b.kcal} kcal` : ''}</button>
        ))}
        <button type="button" onClick={() => setOpen(!open)} className="pressable rounded-full bg-surface3 px-3 py-1.5 text-[12.5px] font-semibold text-ink2">+ Save a bottle / drink</button>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-left">
          <Input placeholder="Name (e.g. Gym bottle)" aria-label="Name (Gym bottle)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="col-span-3" />
          <Input inputMode="numeric" placeholder="ml" aria-label="ml" value={f.ml} onChange={(e) => setF({ ...f, ml: e.target.value })} />
          <Input inputMode="numeric" placeholder="% counts" aria-label="% counts" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} />
          <Button small onClick={() => void save()}>Save</Button>
          <Input inputMode="numeric" placeholder="kcal (0 for water)" aria-label="kcal (0 for water)" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} className="col-span-2" />
          <Input inputMode="decimal" placeholder="protein g" aria-label="protein g" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} />
          <div className="col-span-3 text-[11px] text-ink3">“% counts” lets you count only part of a drink (e.g. a protein shake) — leave 100 for water. Drinks with calories are also added to your food log automatically. Long-press a saved bottle to remove it.</div>
        </div>
      )}
    </div>
  )
}

const fmt12 = (hhmm: string) => dayjs(`2000-01-01T${hhmm}`).format('h:mm a')

function creatineStreak(logs: CreatineLog[], today: string): number {
  const taken = new Set(logs.filter((l) => l.taken).map((l) => l.date))
  let d = dayjs(today)
  if (!taken.has(today)) d = d.subtract(1, 'day') // today is still open — don't break the streak yet
  let streak = 0
  while (taken.has(d.format('YYYY-MM-DD'))) {
    streak += 1
    d = d.subtract(1, 'day')
  }
  return streak
}

export default function HydrationScreen() {
  const toast = useUI((s) => s.toast)
  const today = todayStr()

  const profile = useLiveQuery(() => getProfile(), [])
  const reminders = useLiveQuery(() => db.reminders.get('reminders'), [])
  const todayLogs = useLiveQuery(async () => {
    const rows = await db.waterLog.where('date').equals(today).toArray()
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }, [today])
  const weekLogs = useLiveQuery(() => {
    const start = todayStr(new Date(Date.now() - 6 * 86400000))
    return db.waterLog.where('date').aboveOrEqual(start).toArray()
  }, [today])
  const creatineLogs = useLiveQuery(() => db.creatineLog.toArray(), [])

  // modals / dialogs
  const [customOpen, setCustomOpen] = useState(false)
  const [customMl, setCustomMl] = useState('')
  const [targetOpen, setTargetOpen] = useState(false)
  const [targetDraft, setTargetDraft] = useState(3500)
  const [gramsOpen, setGramsOpen] = useState(false)
  const [gramsDraft, setGramsDraft] = useState(5)
  const [pendingWater, setPendingWater] = useState<WaterLog | null>(null)

  if (!profile || !todayLogs || !weekLogs || !creatineLogs) {
    return (
      <div>
        <PageHeader title="Water & Creatine" />
        <div className="flex justify-center py-16"><Spinner /></div>
      </div>
    )
  }

  // ---------- water derived ----------
  const targetMl = profile.waterTargetMl
  const totalMl = todayLogs.reduce((a, l) => a + l.ml, 0)
  const remainingMl = Math.max(0, targetMl - totalMl)
  const done = targetMl > 0 && totalMl >= targetMl

  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = todayStr(new Date(Date.now() - (6 - i) * 86400000))
    const sum = weekLogs.filter((l) => l.date === d).reduce((a, l) => a + l.ml, 0)
    return { label: dayjs(d).format('ddd'), value: sum }
  })

  async function addWater(ml: number, drink?: { name: string; drunkMl: number }) {
    if (ml <= 0) return
    const crossed = !done && totalMl + ml >= targetMl
    await db.waterLog.add({ id: newId(), date: today, ml, at: nowIso(), ...(drink ? { drink: drink.name, drunkMl: drink.drunkMl } : {}) })
    toast(crossed ? 'Daily water target hit — well done' : `+${ml} ml logged`)
  }

  /** IV-23: a saved drink counts toward water AND, if it has calories, goes into the food log (undo removes both) */
  async function addDrink(b: Bottle) {
    const ml = Math.round(b.ml * b.pct / 100)
    if (!b.kcal && !b.protein) { await addWater(ml, { name: b.name, drunkMl: b.ml }); return }
    const wid = newId(), fid = newId()
    await db.waterLog.add({ id: wid, date: today, ml, at: nowIso(), drink: b.name, drunkMl: b.ml })
    await db.foodLog.add({ id: fid, date: today, meal: mealForNow(), name: b.name, grams: b.ml, kcal: b.kcal ?? 0, protein: b.protein ?? 0, carbs: b.carbs ?? 0, fat: b.fat ?? 0, createdAt: nowIso(), source: 'manual' })
    toastWithUndo(`+${ml} ml water · ${b.kcal ?? 0} kcal added to food`, async () => { await db.waterLog.delete(wid); await db.foodLog.delete(fid) }, 'success')
  }

  function submitCustom() {
    const ml = Math.round(parseFloat(customMl.replace(',', '.')))
    if (!isFinite(ml) || ml < 1 || ml > 3000) {
      toast('Enter an amount between 1 and 3000 ml', 'error')
      return
    }
    void addWater(ml)
    setCustomOpen(false)
    setCustomMl('')
  }

  // ---------- creatine derived ----------
  const todayCreatine = creatineLogs.find((l) => l.date === today)
  const taken = !!todayCreatine?.taken
  const streak = creatineStreak(creatineLogs, today)
  const days30 = Array.from({ length: 30 }, (_, i) => todayStr(new Date(Date.now() - (29 - i) * 86400000)))
  const takenSet = new Set(creatineLogs.filter((l) => l.taken).map((l) => l.date))
  const adherence = Math.round((days30.filter((d) => takenSet.has(d)).length / 30) * 100)

  async function toggleCreatine() {
    if (todayCreatine) {
      const next = !todayCreatine.taken
      await db.creatineLog.put({ ...todayCreatine, taken: next, at: next ? nowIso() : undefined })
      toast(next ? `Creatine ${profile!.creatineGrams}g logged` : 'Creatine unticked', next ? 'success' : 'info')
    } else {
      await db.creatineLog.add({ id: newId(), date: today, taken: true, at: nowIso() })
      toast(`Creatine ${profile!.creatineGrams}g logged`)
    }
  }

  // ---------- reminders ----------
  function updateReminders(patch: Partial<ReminderConfig>, msg?: string) {
    if (!reminders) return
    void db.reminders.put({ ...reminders, ...patch, updatedAt: nowIso() }).then(() => {
      if (msg) toast(msg)
    })
  }

  async function testNotification() {
    const ok = await ensurePermission()
    if (!ok) {
      toast('Notifications are blocked — allow them in your browser settings', 'error')
      return
    }
    await showNotification('Ironverse', 'Notifications are working. Stay on target.', 'test')
  }

  const timeInput = (value: string, onChange: (v: string) => void, label: string) => (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="rounded-lg border border-line bg-surface2 px-2 py-1.5 text-[14px] text-ink outline-none focus:border-brand"
    />
  )

  return (
    <div className="pb-6">
      <PageHeader title="Water & Creatine" subtitle="Two easy daily wins — tick them off." />

      {/* ================= WATER ================= */}
      <Section title="Water">
        <Card className="flex flex-col items-center px-4 pb-4 pt-5">
          <ProgressRing
            value={totalMl}
            target={targetMl}
            size={172}
            stroke={14}
            accent={WATER}
            label={`${(totalMl / 1000).toFixed(2)} L`}
            sub={done ? 'target hit' : `of ${(targetMl / 1000).toFixed(1)} L`}
          />
          <div className="mt-2 text-[12.5px] text-ink2">
            {done ? 'Hydrated — anything extra is a bonus.' : `${remainingMl.toLocaleString('en-AU')} ml to go today`}
          </div>
          <div className="mt-4 grid w-full grid-cols-4 gap-1.5">
            {QUICK.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => void addWater(ml)}
                className="pressable rounded-xl bg-sky-400/12 py-2.5 text-[13px] font-bold tabular-nums text-sky-400"
              >
                +{ml}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setCustomMl(''); setCustomOpen(true) }}
              className="pressable flex items-center justify-center gap-0.5 rounded-xl bg-surface3 py-2.5 text-[13px] font-bold text-ink2"
            >
              <Plus size={14} /> Custom
            </button>
          </div>
          <BottleRow onAdd={(b) => void addDrink(b)} />
        </Card>
      </Section>

      <Section title="Today's log">
        {todayLogs.length === 0 ? (
          <ListGroup>
            <EmptyState
              icon={<GlassWater size={30} />}
              title="Nothing logged yet"
              subtitle="Tap a quick-add button above — first glass of the day starts the streak."
            />
          </ListGroup>
        ) : (
          <ListGroup>
            {todayLogs.map((l) => (
              <ListRow
                key={l.id}
                leading={<Droplets size={18} className="text-sky-400" />}
                title={`${l.ml} ml`}
                subtitle={dayjs(l.at).format('h:mm a')}
                right={
                  <button
                    type="button"
                    aria-label="Delete water entry"
                    className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-surface3 text-ink3"
                    onClick={() => setPendingWater(l)}
                  >
                    <Trash2 size={15} />
                  </button>
                }
              />
            ))}
          </ListGroup>
        )}
      </Section>

      <Section title="Last 7 days">
        <Card className="p-4">
          <BarChart bars={bars} height={150} accent={WATER} />
          <div className="mt-1 text-center text-[11.5px] text-ink3">ml per day · target {targetMl.toLocaleString('en-AU')} ml</div>
        </Card>
        <ListGroup className="mt-2.5">
          <ListRow
            title="Daily target"
            subtitle="Used by the ring, the Today card and reminders"
            right={<span className="text-[15px] font-semibold text-sky-400">{(targetMl / 1000).toFixed(2)} L</span>}
            onClick={() => { setTargetDraft(targetMl); setTargetOpen(true) }}
          />
        </ListGroup>
      </Section>

      {/* ================= CREATINE ================= */}
      <Section title="Creatine">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-pressed={taken}
              aria-label={taken ? 'Mark creatine as not taken' : 'Mark creatine as taken'}
              onClick={() => void toggleCreatine()}
              className={`pressable relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                taken
                  ? 'scale-100 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                  : 'border-2 border-dashed border-line bg-surface3 text-ink3'
              }`}
            >
              {taken && <span className="pulse-ring absolute inset-0 rounded-full bg-emerald-500/40" />}
              <Check size={36} strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-ink">{creatineDoseFor(profile).loading ? `${creatineDoseFor(profile).grams} g today (loading)` : `${profile.creatineGrams} g daily`}</span>
                {streak > 0 && <Badge tone="green">{streak} day streak</Badge>}
              </div>
              {creatineDoseFor(profile).loading && <div className="mt-0.5 text-[12px] text-amber-300">{creatineDoseFor(profile).note}</div>}
              <div className="mt-0.5 text-[12.5px] text-ink2">
                {taken
                  ? todayCreatine?.at ? `Taken today at ${dayjs(todayCreatine.at).format('h:mm a')}` : 'Taken today'
                  : reminders?.creatineEnabled ? `Not yet — usually around ${fmt12(reminders.creatineTime)}` : 'Not yet today'}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink3">Timing doesn't matter much — daily consistency does.</div>
            </div>
          </div>

          <div className="mt-4 border-t border-line pt-3.5">
            <div className="mb-2 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-wide text-ink3">
              <span>Last 30 days</span>
              <span>{adherence}% taken</span>
            </div>
            <div className="grid grid-cols-10 gap-1.5">
              {days30.map((d) => {
                const isToday = d === today
                const hit = takenSet.has(d)
                return (
                  <div key={d} title={`${dayjs(d).format('D MMM')}${hit ? ' — taken' : ''}`} className="flex justify-center">
                    <span
                      className={`h-3.5 w-3.5 rounded-full ${
                        hit ? 'bg-emerald-500' : 'bg-surface3'
                      } ${isToday ? 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-surface2' : ''}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <ListGroup className="mt-2.5">
          <ListRow
            title="Daily dose"
            right={<span className="text-[15px] font-semibold text-emerald-400">{profile.creatineGrams} g</span>}
            onClick={() => { setGramsDraft(profile.creatineGrams); setGramsOpen(true) }}
          />
          {reminders && (
            <ListRow
              title="Reminder time"
              subtitle={reminders.creatineEnabled ? undefined : 'Reminder is off — toggle it below'}
              right={timeInput(reminders.creatineTime, (v) => updateReminders({ creatineTime: v }, 'Creatine reminder time updated'), 'Creatine reminder time')}
              chevron={false}
            />
          )}
        </ListGroup>
      </Section>

      {/* ================= REMINDERS ================= */}
      <Section title="Reminders">
        {reminders ? (
          <>
            <Card className="divide-y divide-line">
              {/* water */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <Droplets size={18} className="shrink-0 text-sky-400" />
                  <div className="flex-1">
                    <div className="text-[15px] font-medium text-ink">Water reminders</div>
                    <div className="text-[12px] text-ink2">Nudge to drink through the day</div>
                  </div>
                  <Toggle
                    checked={reminders.waterEnabled}
                    label="Water reminders"
                    onChange={(v) => updateReminders({ waterEnabled: v }, v ? 'Water reminders on' : 'Water reminders off')}
                  />
                </div>
                {reminders.waterEnabled && (
                  <div className="mt-3.5 space-y-3 border-t border-line pt-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] text-ink2">Every</span>
                      <Stepper
                        value={reminders.waterIntervalMin}
                        min={30}
                        max={240}
                        step={15}
                        format={(v) => `${v} min`}
                        onChange={(v) => updateReminders({ waterIntervalMin: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] text-ink2">Between</span>
                      <div className="flex items-center gap-2">
                        {timeInput(reminders.waterWindow[0], (v) => updateReminders({ waterWindow: [v, reminders.waterWindow[1]] }), 'Water window start')}
                        <span className="text-[13px] text-ink3">and</span>
                        {timeInput(reminders.waterWindow[1], (v) => updateReminders({ waterWindow: [reminders.waterWindow[0], v] }), 'Water window end')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* creatine */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <Pill size={18} className="shrink-0 text-emerald-400" />
                  <div className="flex-1">
                    <div className="text-[15px] font-medium text-ink">Creatine reminder</div>
                    <div className="text-[12px] text-ink2">
                      {reminders.creatineEnabled ? `Daily at ${fmt12(reminders.creatineTime)}` : 'One nudge a day'}
                    </div>
                  </div>
                  <Toggle
                    checked={reminders.creatineEnabled}
                    label="Creatine reminder"
                    onChange={(v) => updateReminders({ creatineEnabled: v }, v ? 'Creatine reminder on' : 'Creatine reminder off')}
                  />
                </div>
              </div>

              {/* workout */}
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <BellRing size={18} className="shrink-0 text-brand" />
                  <div className="flex-1">
                    <div className="text-[15px] font-medium text-ink">Workout reminder</div>
                    <div className="text-[12px] text-ink2">Before your computed training slot</div>
                  </div>
                  <Toggle
                    checked={reminders.workoutEnabled}
                    label="Workout reminder"
                    onChange={(v) => updateReminders({ workoutEnabled: v }, v ? 'Workout reminder on' : 'Workout reminder off')}
                  />
                </div>
                {reminders.workoutEnabled && (
                  <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5">
                    <span className="text-[13.5px] text-ink2">Lead time</span>
                    <Stepper
                      value={reminders.workoutLeadMin}
                      min={5}
                      max={120}
                      step={5}
                      format={(v) => `${v} min`}
                      onChange={(v) => updateReminders({ workoutLeadMin: v })}
                    />
                  </div>
                )}
              </div>
            </Card>

            <Button variant="outline" full className="mt-2.5" onClick={() => void testNotification()}>
              <Bell size={16} /> Test notification
            </Button>

            <Card className="mt-2.5 p-3.5">
              <p className="text-[12.5px] leading-relaxed text-ink2">
                Honest note: Ironverse has no server, so reminders only fire while the app is open (foreground or installed and running).
                Add it to your Home Screen and leave it open during the day — and the Today timeline always shows the full schedule regardless.
              </p>
              {isNativeApp() && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">
                  iPhone app: when you leave Ironverse, today's remaining reminders are handed to iOS as local notifications, so they still arrive while the app is in the background. They are created on your phone only — nothing is sent anywhere.
                </p>
              )}
            </Card>
          </>
        ) : (
          <Card><EmptyState icon={<Bell size={30} />} title="Reminders unavailable" subtitle="Reminder settings couldn't be loaded. Restart the app to re-seed them." /></Card>
        )}
      </Section>

      {/* ---------- dialogs ---------- */}
      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="Add water">
        <Field label="Amount (ml)" hint="A regular glass is ~250 ml, a big bottle 600–750 ml.">
          <Input
            inputMode="numeric"
            autoFocus
            placeholder="e.g. 400" aria-label="400"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCustom() }}
          />
        </Field>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" full onClick={() => setCustomOpen(false)}>Cancel</Button>
          <Button full onClick={submitCustom}>Add</Button>
        </div>
      </Modal>

      <Modal open={targetOpen} onClose={() => setTargetOpen(false)} title="Daily water target">
        <div className="flex justify-center py-3">
          <Stepper value={targetDraft} min={1000} max={6000} step={250} format={(v) => `${(v / 1000).toFixed(2)} L`} onChange={setTargetDraft} />
        </div>
        <p className="mb-4 text-center text-[12px] text-ink3">~35 ml per kg bodyweight is a solid baseline — more on training days.</p>
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={() => setTargetOpen(false)}>Cancel</Button>
          <Button full onClick={() => {
            void saveProfile({ ...profile, waterTargetMl: targetDraft }).then(() => toast('Water target updated'))
            setTargetOpen(false)
          }}>Save</Button>
        </div>
      </Modal>

      <Modal open={gramsOpen} onClose={() => setGramsOpen(false)} title="Creatine dose">
        <div className="flex justify-center py-3">
          <Stepper value={gramsDraft} min={1} max={15} step={1} format={(v) => `${v} g`} onChange={setGramsDraft} />
        </div>
        <p className="mb-4 text-center text-[12px] text-ink3">3–5 g of monohydrate daily is the standard, well-studied dose.</p>
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={() => setGramsOpen(false)}>Cancel</Button>
          <Button full onClick={() => {
            void saveProfile({ ...profile, creatineGrams: gramsDraft }).then(() => toast('Creatine dose updated'))
            setGramsOpen(false)
          }}>Save</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingWater !== null}
        onClose={() => setPendingWater(null)}
        onConfirm={() => {
          if (!pendingWater) return
          void deleteWithUndo(db.waterLog, pendingWater.id, 'Water entry removed')
        }}
        title="Remove water entry?"
        message={pendingWater ? `${pendingWater.ml} ml at ${dayjs(pendingWater.at).format('h:mm a')}` : undefined}
        confirmLabel="Remove"
      />
    </div>
  )
}
