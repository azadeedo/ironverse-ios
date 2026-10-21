// Progress → Body: weight trend + tape measurements.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Ruler, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { db, getProfile, saveProfile } from '@/db'
import type { Measurement, WeighIn } from '@/db/types'
import { Badge, Button, Card, EmptyState, Field, Input, Section, Sheet, Spinner } from '@/components/ui'
import { LineChart } from '@/components/charts'
import { weightTrend } from '@/lib/nutrition'
import { dayjs } from '@/lib/fmt'
import { newId, todayStr } from '@/lib/id'
import { useUI } from '@/lib/store'
import TrendHeadline from './TrendHeadline'
import MeasurementTrends from './MeasurementTrends'
import WaistToWeight from './WaistToWeight'

const PARTS = [
  { key: 'chest', label: 'Chest' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'abs', label: 'Abs' },
  { key: 'waist', label: 'Waist' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'calf', label: 'Calf' },
] as const
type PartKey = (typeof PARTS)[number]['key']

/** parts where a smaller number is the win on a fat-loss goal */
const SHRINK_GOOD: readonly PartKey[] = ['abs', 'waist']

function deltaSince(sorted: WeighIn[], days: number): number | null {
  if (sorted.length < 2) return null
  const latest = sorted[sorted.length - 1]
  const cutoff = dayjs(latest.date).subtract(days, 'day').format('YYYY-MM-DD')
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].date <= cutoff) return Math.round((latest.weightKg - sorted[i].weightKg) * 10) / 10
  }
  return null
}

function WeightDelta({ delta, label }: { delta: number | null; label: string }) {
  if (delta === null) return <Badge tone="gray">no data · {label}</Badge>
  const tone = delta < 0 ? 'green' : delta > 0 ? 'amber' : 'gray'
  const Icon = delta < 0 ? TrendingDown : delta > 0 ? TrendingUp : Minus
  return (
    <Badge tone={tone}>
      <Icon size={12} className="mr-1" />
      {delta === 0 ? 'steady' : `${Math.abs(delta).toFixed(1)} kg`} · {label}
    </Badge>
  )
}

export default function BodyTab() {
  const { toast } = useUI()
  const weighIns = useLiveQuery(() => db.weighIns.orderBy('date').toArray(), [])
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [])

  const [weightOpen, setWeightOpen] = useState(false)
  const [weightVal, setWeightVal] = useState('')
  const [weightNote, setWeightNote] = useState('')
  const [measureOpen, setMeasureOpen] = useState(false)
  const [mVals, setMVals] = useState<Record<PartKey, string>>({
    chest: '', shoulders: '', biceps: '', abs: '', waist: '', thigh: '', calf: '',
  })
  const [expanded, setExpanded] = useState<PartKey | null>(null)

  const trendRows = useMemo(() => weightTrend(weighIns ?? []), [weighIns])
  const [noteAt, setNoteAt] = useState<number | null>(null)
  const chart = useMemo(() => {
    const rows = trendRows.slice(-60)
    const notes = new Map((weighIns ?? []).filter((w) => w.note).map((w) => [w.date, w.note as string]))
    return {
      points: rows.map((r) => ({ x: dayjs(r.date).format('D MMM'), y: r.raw })),
      secondary: rows.map((r) => r.trend),
      marks: rows.map((r, i) => ({ i, label: notes.get(r.date) ?? '', date: r.date, raw: r.raw })).filter((m) => m.label),
    }
  }, [trendRows, weighIns])

  const partData = useMemo(() => {
    const ms = measurements ?? []
    const out = new Map<PartKey, { latest: number; first: number; history: { date: string; value: number }[] }>()
    for (const p of PARTS) {
      const history = ms
        .filter((m) => typeof m.values[p.key] === 'number')
        .map((m) => ({ date: m.date, value: m.values[p.key] as number }))
      if (history.length === 0) continue
      out.set(p.key, { latest: history[history.length - 1].value, first: history[0].value, history })
    }
    return out
  }, [measurements])

  if (!weighIns || !measurements || profile === undefined) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }

  const sorted = weighIns // already ordered by date
  const latest = sorted.length ? sorted[sorted.length - 1] : null
  const currentKg = latest?.weightKg ?? profile?.weightKg ?? null
  const d7 = deltaSince(sorted, 7)
  const d30 = deltaSince(sorted, 30)
  const maxPart = Math.max(1, ...[...partData.values()].map((v) => v.latest))

  function openWeightSheet() {
    setWeightVal(currentKg !== null ? String(currentKg) : '')
    setWeightNote('')
    setWeightOpen(true)
  }

  async function saveWeight() {
    const w = Math.round(parseFloat(weightVal) * 10) / 10
    if (!isFinite(w) || w < 30 || w > 300) {
      toast('Enter a weight between 30 and 300 kg', 'error')
      return
    }
    const today = todayStr()
    const existing = await db.weighIns.where('date').equals(today).first()
    const note = weightNote.trim() || undefined
    if (existing) await db.weighIns.update(existing.id, { weightKg: w, ...(note ? { note } : {}) })
    else await db.weighIns.add({ id: newId(), date: today, weightKg: w, ...(note ? { note } : {}) })
    const p = await getProfile()
    if (p) await saveProfile({ ...p, weightKg: w })
    setWeightOpen(false)
    toast(`Weight logged — ${w} kg`)
  }

  function openMeasureSheet() {
    const next = { chest: '', shoulders: '', biceps: '', abs: '', waist: '', thigh: '', calf: '' } as Record<PartKey, string>
    for (const p of PARTS) {
      const d = partData.get(p.key)
      if (d) next[p.key] = String(d.latest)
    }
    setMVals(next)
    setMeasureOpen(true)
  }

  async function saveMeasurements() {
    const values: Measurement['values'] = {}
    let any = false
    for (const p of PARTS) {
      const raw = mVals[p.key].trim()
      if (!raw) continue
      const v = Math.round(parseFloat(raw) * 10) / 10
      if (!isFinite(v) || v <= 0 || v > 300) {
        toast(`Check the ${p.label.toLowerCase()} value`, 'error')
        return
      }
      values[p.key] = v
      any = true
    }
    if (!any) {
      toast('Enter at least one measurement', 'error')
      return
    }
    const today = todayStr()
    const existing = await db.measurements.where('date').equals(today).first()
    if (existing) await db.measurements.update(existing.id, { values: { ...existing.values, ...values } })
    else await db.measurements.add({ id: newId(), date: today, values })
    setMeasureOpen(false)
    toast('Measurements saved')
  }

  return (
    <>
      {/* ---------- headline: 7-day rolling average (raw figure kept below) ---------- */}
      <TrendHeadline weighIns={sorted} goal={profile?.goal} />

      {/* ---------- weight ---------- */}
      <Section title="Weight" action={<Button small variant="secondary" onClick={openWeightSheet}>Log weight</Button>}>
        <Card className="p-4">
          {currentKg === null ? (
            <EmptyState
              icon={<Scale size={34} strokeWidth={1.5} />}
              title="No weigh-ins yet"
              subtitle="Log your first weigh-in and the trend line will build itself."
              action={<Button small onClick={openWeightSheet}>Log weight</Button>}
            />
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <div className="big-num text-[38px] leading-none text-ink">
                    {currentKg.toFixed(1)}<span className="ml-1 text-[17px] font-semibold text-ink3">kg</span>
                  </div>
                  {latest && <div className="mt-1 text-[12px] text-ink3">last weighed {dayjs(latest.date).format('ddd D MMM')}</div>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <WeightDelta delta={d7} label="7d" />
                  <WeightDelta delta={d30} label="30d" />
                </div>
              </div>
              <div className="mt-3">
                {sorted.length >= 2 ? (
                  <>
                    <LineChart points={chart.points} secondary={chart.secondary} height={170} marks={chart.marks} activeMark={noteAt} onMark={(i) => setNoteAt((v) => (v === i ? null : i))} />
                    {noteAt !== null && chart.marks.find((m) => m.i === noteAt) && (() => { const m = chart.marks.find((x) => x.i === noteAt)!; return (
                      <div className="mt-1 rounded-xl bg-blue-500/10 px-3 py-2 text-[12.5px] text-ink2"><b>{dayjs(m.date).format('ddd D MMM')} · {m.raw.toFixed(1)} kg</b> — {m.label}</div>) })()}
                    {chart.marks.length > 0 && noteAt === null && <div className="mt-1 text-[11.5px] text-blue-400">● {chart.marks.length} weigh-in note{chart.marks.length === 1 ? '' : 's'} on the chart — tap a blue flag to read it.</div>}
                    <div className="mt-1 text-[11.5px] text-ink3">
                      {sorted.length} weigh-ins · the dashed line is your smoothed trend — trust it over any single morning.
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-surface3/60 px-3 py-2.5 text-[12.5px] text-ink2">
                    One more weigh-in and your trend chart appears here.
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </Section>

      {/* ---------- measurements ---------- */}
      <Section title="Measurements" action={<Button small variant="secondary" onClick={openMeasureSheet}>Update</Button>}>
        <Card className="p-4">
          {partData.size === 0 ? (
            <EmptyState
              icon={<Ruler size={34} strokeWidth={1.5} />}
              title="No measurements yet"
              subtitle="Grab the tape and log a baseline — future you will want the before numbers."
              action={<Button small onClick={openMeasureSheet}>Add measurements</Button>}
            />
          ) : (
            <div className="divide-y divide-line">
              {PARTS.filter((p) => partData.has(p.key)).map((p) => {
                const d = partData.get(p.key)!
                const delta = Math.round((d.latest - d.first) * 10) / 10
                const shrinkGood = SHRINK_GOOD.includes(p.key)
                const tone = d.history.length < 2 || delta === 0 ? 'gray'
                  : shrinkGood ? (delta < 0 ? 'green' : 'amber')
                  : delta > 0 ? 'green' : 'gray'
                const isOpen = expanded === p.key
                return (
                  <div key={p.key} className="py-2.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      className="pressable block w-full text-left"
                      onClick={() => setExpanded(isOpen ? null : p.key)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{p.label}</span>
                        <span className="flex items-center gap-2">
                          {d.history.length >= 2 && (
                            <Badge tone={tone}>{delta > 0 ? '+' : ''}{delta === 0 ? '±0' : delta.toFixed(1)} cm</Badge>
                          )}
                          <span className="big-num w-[64px] text-right text-[15px] text-ink">{d.latest} cm</span>
                        </span>
                      </div>
                      {/* IV-33C: a dated baseline comparison, not a bar sized against other body parts */}
                      <div className="mt-1 text-[11.5px] text-ink3">
                        {d.history.length >= 2
                          ? `Baseline ${d.first} cm (${dayjs(d.history[0].date).format('D MMM')}) → ${d.latest} cm (${dayjs(d.history[d.history.length - 1].date).format('D MMM')})`
                          : `Baseline ${d.first} cm (${dayjs(d.history[0].date).format('D MMM YYYY')}) — log it again to see a change`}
                      </div>
                      {d.history.length >= 2 && (
                        <div className="relative mt-1 h-2 rounded-full bg-surface3" aria-hidden>
                          <div className="absolute inset-y-0 left-1/2 w-px bg-ink3/60" />
                          <div className={`absolute inset-y-0 rounded-full ${tone === 'green' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-ink3'}`}
                            style={delta < 0 ? { right: '50%', width: `${Math.min(50, (Math.abs(delta) / Math.max(1, d.first * 0.05)) * 50)}%` } : { left: '50%', width: `${Math.min(50, (Math.abs(delta) / Math.max(1, d.first * 0.05)) * 50)}%` }} />
                        </div>
                      )}
                    </button>
                    {isOpen && (
                      <div className="mt-2">
                        {d.history.length >= 2 ? (
                          <>
                            <LineChart
                              points={d.history.slice(-60).map((h) => ({ x: dayjs(h.date).format('D MMM'), y: h.value }))}
                              height={120}
                            />
                            <div className="mt-1 text-[11.5px] text-ink3">
                              {d.history.length} entries · {delta === 0 ? 'holding steady' : `${Math.abs(delta).toFixed(1)} cm ${delta < 0 ? 'down' : 'up'}`} since {dayjs(d.history[0].date).format('D MMM YYYY')}
                            </div>
                          </>
                        ) : (
                          <div className="rounded-xl bg-surface3/60 px-3 py-2.5 text-[12.5px] text-ink2">
                            Logged once on {dayjs(d.history[0].date).format('D MMM YYYY')}. Update it to start the trend chart.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
        <p className="mt-2 px-1 text-[11.5px] text-ink3">
          Tap a body part for its trend. Measure relaxed, same time of day, tape level.
        </p>
      </Section>

      {/* ---------- every part charted, plus the ratio the scale can't show ---------- */}
      <MeasurementTrends measurements={measurements} />
      <WaistToWeight measurements={measurements} weighIns={sorted} />

      {/* ---------- log weight sheet ---------- */}
      <Sheet open={weightOpen} onClose={() => setWeightOpen(false)} title="Log weight">
        <Field label="Body weight (kg)" hint="Also updates the weight used for your calorie targets.">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={30}
            max={300}
            autoFocus
            value={weightVal}
            onChange={(e) => setWeightVal(e.target.value)}
            placeholder="e.g. 97.8"
          />
        </Field>
        <Field label="Note (optional)" hint="Explains a surprising number later — it never changes your targets.">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {['Salty / late meal', 'Poor sleep', 'After travel', 'Creatine loading', 'Feeling unwell', 'Big training day', 'Refeed / event'].map((t) => (
              <button key={t} type="button" onClick={() => setWeightNote((n) => (n.includes(t) ? n : n ? `${n}; ${t}` : t))} className="pressable rounded-full bg-surface3 px-2.5 py-1 text-[12px] text-ink2">{t}</button>
            ))}
          </div>
          <Input value={weightNote} onChange={(e) => setWeightNote(e.target.value)} placeholder="e.g. weighed after breakfast" />
        </Field>
        <Button full className="mt-4" onClick={() => void saveWeight()}>Save weigh-in</Button>
        {sorted.some((x) => x.note) && (
          <div className="mt-4 space-y-1 text-[12px]">
            <div className="font-semibold text-ink2">Recent notes</div>
            {[...sorted].reverse().filter((x) => x.note).slice(0, 6).map((x) => <div key={x.id} className="text-ink3"><b className="text-ink2">{x.date} · {x.weightKg} kg</b> — {x.note}</div>)}
          </div>
        )}
      </Sheet>

      {/* ---------- update measurements sheet ---------- */}
      <Sheet open={measureOpen} onClose={() => setMeasureOpen(false)} title="Update measurements">
        <p className="mb-3 text-[13px] text-ink2">
          All in cm. Leave anything you skipped blank — it keeps its last value.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PARTS.map((p) => (
            <Field key={p.key} label={p.label}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                value={mVals[p.key]}
                onChange={(e) => setMVals((v) => ({ ...v, [p.key]: e.target.value }))}
                placeholder="cm"
              />
            </Field>
          ))}
        </div>
        <Button full className="mt-4" onClick={() => void saveMeasurements()}>Save measurements</Button>
      </Sheet>
    </>
  )
}
