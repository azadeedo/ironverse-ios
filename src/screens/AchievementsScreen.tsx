// ACHIEVEMENTS — every badge here was earned by something in the log, and it
// says exactly what and when. The "next up" list states a number and stops:
// nothing on this screen tells him off for a milestone he hasn't reached.

import { useEffect, useMemo, useState } from 'react'
import {
  Award, Calendar, Dumbbell, Droplets, Flame, Medal, Pill, Repeat, Scale,
  TrendingDown, TrendingUp, Utensils,
} from 'lucide-react'
import {
  Badge, Callout, Card, EmptyState, FOCUS_RING, Meter, PageHeader, Section,
  Spinner, StatCard,
} from '@/components/ui'
import {
  CATEGORY_LABELS, loadAchievements,
  type Achievement, type AchievementCategory, type AchievementIcon, type AchievementReport,
} from '@/lib/achievements'
import { dayjs } from '@/lib/fmt'

const ICONS: Record<AchievementIcon, typeof Medal> = {
  flame: Flame,
  calendar: Calendar,
  weight: Scale,
  dumbbell: Dumbbell,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  droplets: Droplets,
  pill: Pill,
  utensils: Utensils,
  repeat: Repeat,
  medal: Medal,
}

const CATEGORY_TONE: Record<AchievementCategory, { tint: string; bg: string }> = {
  consistency: { tint: 'text-brand', bg: 'bg-brand/12' },
  volume: { tint: 'text-violet-400', bg: 'bg-violet-400/12' },
  strength: { tint: 'text-rose-400', bg: 'bg-rose-400/12' },
  bodyweight: { tint: 'text-emerald-400', bg: 'bg-emerald-400/12' },
  habit: { tint: 'text-sky-400', bg: 'bg-sky-400/12' },
}

const CATEGORY_ORDER: AchievementCategory[] = [
  'consistency', 'strength', 'volume', 'bodyweight', 'habit',
]

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-AU')

function AchievementRow({ a }: { a: Achievement }) {
  const Icon = ICONS[a.icon]
  const tone = CATEGORY_TONE[a.category]
  return (
    <li>
      <Card className="p-3.5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.bg} ${tone.tint}`}
            aria-hidden="true"
          >
            <Icon size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[14.5px] font-bold leading-tight text-ink">{a.title}</h3>
              <time
                dateTime={a.date}
                className="shrink-0 text-[11.5px] font-medium tabular-nums text-ink3"
              >
                {dayjs(a.date).format('D MMM YY')}
              </time>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink2">{a.evidence}</p>
          </div>
        </div>
      </Card>
    </li>
  )
}

export default function AchievementsScreen() {
  const [report, setReport] = useState<AchievementReport | null>(null)
  const [filter, setFilter] = useState<AchievementCategory | null>(null)

  useEffect(() => {
    let alive = true
    void loadAchievements().then((r) => { if (alive) setReport(r) })
    return () => { alive = false }
  }, [])

  const byCategory = useMemo(() => {
    if (!report) return new Map<AchievementCategory, Achievement[]>()
    const map = new Map<AchievementCategory, Achievement[]>()
    for (const a of report.earned) {
      const list = map.get(a.category)
      if (list) list.push(a)
      else map.set(a.category, [a])
    }
    return map
  }, [report])

  if (!report) {
    return (
      <div>
        <PageHeader title="Achievements" back="/more" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  if (report.thin) {
    return (
      <div className="mx-auto max-w-lg pb-10">
        <PageHeader title="Achievements" back="/more" />
        <EmptyState
          icon={<Award size={32} />}
          title="Nothing earned yet"
          subtitle={report.thinReason}
        />
      </div>
    )
  }

  const visibleCategories = CATEGORY_ORDER.filter(
    (c) => (byCategory.get(c)?.length ?? 0) > 0 && (filter === null || filter === c),
  )

  return (
    <div className="mx-auto max-w-lg pb-10">
      <PageHeader
        title="Achievements"
        back="/more"
        subtitle={`${report.earned.length} earned from your own log — each one says what did it.`}
      />

      {/* ---------- totals ---------- */}
      <Section>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Sessions" value={fmtInt(report.totals.sessions)} sub="logged with real sets" />
          <StatCard
            label="Volume moved"
            value={report.totals.volumeKg >= 1000
              ? `${(report.totals.volumeKg / 1000).toFixed(1)} t`
              : `${fmtInt(report.totals.volumeKg)} kg`}
            sub={`${fmtInt(report.totals.workingSets)} working sets`}
            tone="brand"
          />
          <StatCard label="Weigh-ins" value={fmtInt(report.totals.weighIns)} />
          <StatCard label="Days of food" value={fmtInt(report.totals.foodDays)} />
        </div>
      </Section>

      {/* ---------- category filter ---------- */}
      {report.earned.length > 0 && (
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4">
          {[{ value: null as AchievementCategory | null, label: 'All' },
            ...CATEGORY_ORDER
              .filter((c) => (byCategory.get(c)?.length ?? 0) > 0)
              .map((c) => ({ value: c as AchievementCategory | null, label: CATEGORY_LABELS[c] }))
          ].map((f) => {
            const active = filter === f.value
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
                className={`pressable ${FOCUS_RING} shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                  active ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ---------- earned ---------- */}
      {report.earned.length === 0 ? (
        <Section>
          <Callout tone="neutral" icon={<Award size={15} />}>
            Nothing has crossed a milestone yet. The list below shows what the next
            markers are — they fill in on their own as you log.
          </Callout>
        </Section>
      ) : (
        visibleCategories.map((cat) => {
          const list = byCategory.get(cat) ?? []
          return (
            <Section key={cat} title={CATEGORY_LABELS[cat]} action={<Badge tone="gray">{list.length}</Badge>}>
              <ul className="space-y-2.5">
                {list.map((a) => <AchievementRow key={a.id} a={a} />)}
              </ul>
            </Section>
          )
        })
      )}

      {/* ---------- next up ---------- */}
      {report.next.length > 0 && (
        <Section title="Next markers">
          <ul className="space-y-2.5">
            {report.next.map((n) => {
              const Icon = ICONS[n.icon]
              const tone = CATEGORY_TONE[n.category]
              const pct = n.target > 0 ? Math.round((n.current / n.target) * 100) : 0
              return (
                <li key={n.id}>
                  <Card className="p-3.5">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface3 ${tone.tint} opacity-70`}
                        aria-hidden="true"
                      >
                        <Icon size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-[14px] font-semibold text-ink2">{n.title}</h3>
                          <span className="shrink-0 text-[11.5px] tabular-nums text-ink3">{pct}%</span>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink3">{n.note}</p>
                        <div className="mt-2">
                          <Meter
                            value={n.current}
                            target={n.target}
                            label={n.title}
                            valueLabel={`${fmtInt(n.current)} of ${fmtInt(n.target)}`}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 px-1 text-[12px] leading-relaxed text-ink3">
            These are markers, not targets you are behind on. They move when the log moves.
          </p>
        </Section>
      )}
    </div>
  )
}
