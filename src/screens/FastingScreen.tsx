// /fasting — intermittent fasting timer (v10). Start/stop, a ring that fills to
// your goal, the stage you're in, an iPhone alert when you hit the goal, and a
// history with streak and hit rate. Works alongside the calorie targets.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, PageHeader, Section } from '@/components/ui'
import { getSetting, setSetting } from '@/db'
import { dayjs } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import { FAST_PLANS, FAST_STAGES, type Fast, fastStats, hoursFasted, stageFor } from '@/lib/fasting'
import { cancelAt, scheduleAt } from '@/native/notifications'

const KEYS = { current: 'fasting:current', history: 'fasting:history', plan: 'fasting:goalHours' } as const

export default function FastingScreen() {
  const { toast } = useUI()
  const current = useLiveQuery(() => getSetting<Fast | null>(KEYS.current, null), [])
  const history = useLiveQuery(() => getSetting<Fast[]>(KEYS.history, []), []) ?? []
  const goal = useLiveQuery(() => getSetting<number>(KEYS.plan, 16), []) ?? 16
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(id) }, [])

  async function start() {
    const f: Fast = { start: new Date().toISOString(), goalHours: goal }
    await setSetting(KEYS.current, f)
    await scheduleAt('fast-goal', new Date(Date.now() + goal * 3_600_000), `${goal}-hour fast done 🎉`, 'You hit your fasting goal. Break it with protein first.')
    toast(`Fast started — goal ${goal} hours`)
  }
  async function stop() {
    if (!current) return
    const done: Fast = { ...current, end: new Date().toISOString() }
    await setSetting(KEYS.history, [done, ...history].slice(0, 300))
    await setSetting(KEYS.current, null)
    await cancelAt('fast-goal')
    const h = hoursFasted(done)
    toast(h >= done.goalHours ? `Goal reached — ${h.toFixed(1)} hours 💪` : `Fast ended at ${h.toFixed(1)} hours`)
  }

  const h = current ? hoursFasted(current) : 0
  const pct = current ? Math.min(1, h / current.goalHours) : 0
  const stage = stageFor(h)
  const stats = fastStats(history)
  const r = 70, c = 2 * Math.PI * r

  return (
    <div className="pb-14">
      <PageHeader title="Fasting" back subtitle="Optional — a timing tool. Calories and protein still drive results." />
      <Section>
        <Card className="flex flex-col items-center p-5">
          <div className="relative h-[170px] w-[170px]">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90"><circle cx="80" cy="80" r={r} fill="none" stroke="var(--line)" strokeWidth="12" /><circle cx="80" cy="80" r={r} fill="none" stroke={pct >= 1 ? '#22c55e' : '#f59e0b'} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s' }} /></svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="big-num text-[34px] leading-none">{current ? `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}` : '—'}</b>
              <span className="text-[11.5px] text-ink3">{current ? `of ${current.goalHours} h` : 'not fasting'}</span>
            </div>
          </div>
          {current ? (
            <>
              <div className="mt-3 text-center"><b className="text-[15px]">{stage.title}</b><p className="text-[12.5px] text-ink2">{stage.body}</p></div>
              <div className="mt-1 text-[12px] text-ink3">Started {dayjs(current.start).format('ddd h:mm a')} · goal at {dayjs(current.start).add(current.goalHours, 'hour').format('ddd h:mm a')}</div>
              <Button full className="mt-3" variant={pct >= 1 ? 'primary' : 'secondary'} onClick={() => void stop()}>{pct >= 1 ? 'End fast — goal reached' : 'End fast early'}</Button>
            </>
          ) : (
            <>
              <div className="mt-3 grid w-full grid-cols-5 gap-1.5">
                {FAST_PLANS.map((p) => (
                  <button key={p.hours} type="button" aria-pressed={goal === p.hours} onClick={() => void setSetting(KEYS.plan, p.hours)} className={`pressable rounded-xl py-2 text-[13px] font-bold ${goal === p.hours ? 'bg-brand text-black' : 'bg-surface3 text-ink2'}`}>{p.label}</button>
                ))}
              </div>
              <div className="mt-1.5 text-[12px] text-ink3">{FAST_PLANS.find((p) => p.hours === goal)?.note}</div>
              <Button full className="mt-3" onClick={() => void start()}>Start {goal}-hour fast</Button>
            </>
          )}
        </Card>
      </Section>

      <Section title="Your fasting">
        <div className="grid grid-cols-4 gap-2 text-center">
          {([['Fasts', stats.total], ['Goal hit', `${stats.hitRate}%`], ['Streak', stats.streak], ['Longest', `${stats.longest} h`]] as const).map(([l, v]) => (
            <div key={l} className="rounded-xl bg-surface2 py-2 shadow-card"><b className="big-num block text-[16px]">{v}</b><span className="text-[10.5px] text-ink3">{l}</span></div>
          ))}
        </div>
        {history.length > 0 && (
          <Card className="mt-2 divide-y divide-line px-3.5">
            {history.slice(0, 10).map((f) => { const fh = hoursFasted(f); return (
              <div key={f.start} className="flex justify-between py-2 text-[13px]"><span>{dayjs(f.start).format('ddd D MMM')}</span><span className={fh >= f.goalHours ? 'font-semibold text-emerald-400' : 'text-ink2'}>{fh.toFixed(1)} / {f.goalHours} h</span></div>
            ) })}
          </Card>
        )}
      </Section>

      <Section title="What happens while you fast">
        <Card className="space-y-2 p-4 text-[13px]">
          {FAST_STAGES.map((s) => <div key={s.from}><b>{s.from}+ h · {s.title}</b><div className="text-ink2">{s.body}</div></div>)}
          <p className="pt-1 text-[11px] text-ink3">Approximate and person-dependent. Studies comparing time-restricted eating with ordinary calorie control at the same calories generally find similar fat loss (e.g. Lowe et al., 2020, JAMA Internal Medicine; Liu et al., 2022, NEJM) — use it if it makes your calories easier. Not suitable in pregnancy, with diabetes medication or a history of eating disorders without medical advice.</p>
        </Card>
      </Section>
    </div>
  )
}
