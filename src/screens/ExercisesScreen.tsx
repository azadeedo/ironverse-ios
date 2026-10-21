// Exercise library — searchable, filterable index of every movement in the
// registry. Deep link: /exercises?muscle=chest
//
// v3 adds, without removing anything: movement-pattern and quality-tier filters,
// a "what can I do where I'm training right now" switch, and a pinned list that
// rides on the existing exerciseMeta table.

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Dumbbell, MapPin, SearchX, SlidersHorizontal, Star } from 'lucide-react'
import { Badge, Button, Card, EmptyState, PageHeader, SearchBar, Sheet, Toggle } from '@/components/ui'
import { EXERCISES } from '@/data/exercises'
import { type AnyEquipment,
  EQUIPMENT_LABELS, MUSCLE_LABELS, PATTERN_LABELS,
  type Equipment, type Exercise, type ExerciseKind, type ExerciseTier,
  type MovementPattern, type Muscle,
} from '@/db/types'
import { useUI } from '@/lib/store'
import {
  KIND_LABELS, KIND_ORDER, MuscleBadges, TIER_LABELS, TIER_SHORT, TIER_TONE, VisibleAnim,
  availableHere, equipmentSummary, matchesQuery, patternOf, tierOf, togglePinned,
  useCurrentEquipment, usePinnedLive,
} from './exercises/shared'

const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[]
const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]
const TIERS: ExerciseTier[] = [1, 2, 3, 4]

export default function ExercisesScreen() {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [equip, setEquip] = useState<AnyEquipment[]>([])
  const [pattern, setPattern] = useState<MovementPattern | null>(null)
  const [tier, setTier] = useState<ExerciseTier | null>(null)
  const [onlyHere, setOnlyHere] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const here = useCurrentEquipment()
  const pinned = usePinnedLive()

  // ?muscle= deep link (validated)
  const muscleParam = searchParams.get('muscle')
  const muscle: Muscle | null =
    muscleParam && muscleParam in MUSCLE_LABELS ? (muscleParam as Muscle) : null

  const setMuscle = (m: Muscle | null) => {
    setSearchParams(m ? { muscle: m } : {}, { replace: true })
  }

  // per-muscle + per-equipment counts over the whole registry
  const muscleCounts = useMemo(() => {
    const counts = new Map<Muscle, number>()
    for (const ex of EXERCISES) {
      for (const m of [...ex.primary, ...ex.secondary]) {
        counts.set(m, (counts.get(m) ?? 0) + 1)
      }
    }
    return counts
  }, [])

  const equipCounts = useMemo(() => {
    const counts = new Map<AnyEquipment, number>()
    for (const ex of EXERCISES) {
      for (const e of ex.equipment) counts.set(e, (counts.get(e) ?? 0) + 1)
    }
    return counts
  }, [])

  const patternCounts = useMemo(() => {
    const counts = new Map<MovementPattern, number>()
    for (const ex of EXERCISES) {
      const p = patternOf(ex)
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
    return counts
  }, [])

  const muscleChips = ALL_MUSCLES.filter((m) => (muscleCounts.get(m) ?? 0) > 0 || m === muscle)
  const equipRows = ALL_EQUIPMENT.filter((e) => (equipCounts.get(e) ?? 0) > 0 || equip.includes(e))
  const patternRows = useMemo(
    () => [...patternCounts.entries()]
      .filter(([p]) => p !== 'other')
      .sort((a, b) => PATTERN_LABELS[a[0]].localeCompare(PATTERN_LABELS[b[0]])),
    [patternCounts],
  )

  const filtered = useMemo(() => {
    return EXERCISES.filter((ex) => {
      if (muscle && !ex.primary.includes(muscle) && !ex.secondary.includes(muscle)) return false
      if (equip.length > 0 && !ex.equipment.some((e) => equip.includes(e))) return false
      if (pattern && patternOf(ex) !== pattern) return false
      if (tier && tierOf(ex) !== tier) return false
      if (onlyHere && !availableHere(ex, here)) return false
      if (query && !matchesQuery(ex, query)) return false
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [muscle, equip, pattern, tier, onlyHere, here, query])

  const grouped = useMemo(() => {
    const g = new Map<ExerciseKind, Exercise[]>()
    for (const ex of filtered) {
      const list = g.get(ex.kind)
      if (list) list.push(ex)
      else g.set(ex.kind, [ex])
    }
    return KIND_ORDER.filter((k) => g.has(k)).map((k) => ({ kind: k, items: g.get(k)! }))
  }, [filtered])

  const pinnedList = useMemo(
    () => EXERCISES.filter((ex) => pinned.has(ex.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [pinned],
  )

  const hasFilters =
    query !== '' || muscle !== null || equip.length > 0 || pattern !== null || tier !== null || onlyHere
  const extraFilters = equip.length + (pattern ? 1 : 0) + (tier ? 1 : 0) + (onlyHere ? 1 : 0)

  const clearAll = () => {
    setQuery('')
    setEquip([])
    setPattern(null)
    setTier(null)
    setOnlyHere(false)
    setMuscle(null)
  }

  const toggleEquip = (e: AnyEquipment) => {
    setEquip((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
  }

  async function pin(ex: Exercise) {
    const now = await togglePinned(ex.id)
    toast(now ? `${ex.name} pinned` : `${ex.name} unpinned`)
  }

  return (
    <div>
      <PageHeader
        title="Exercises"
        subtitle={
          here
            ? `${EXERCISES.length} exercises · training at ${here.name}`
            : `${EXERCISES.length} exercises`
        }
        actions={
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setSheetOpen(true)}
            className={`pressable relative inline-flex h-10 w-10 items-center justify-center rounded-full ${
              extraFilters > 0 ? 'bg-brand text-white' : 'bg-surface3 text-ink'
            }`}
          >
            <SlidersHorizontal size={18} />
            {extraFilters > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-surface2 px-1 text-[10px] font-bold text-brand">
                {extraFilters}
              </span>
            )}
          </button>
        }
      />

      <div className="px-4 pb-1">
        <SearchBar value={query} onChange={setQuery} placeholder="Search name, muscle, equipment" />
      </div>

      {/* here-only quick switch */}
      {here && (
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={() => setOnlyHere((v) => !v)}
            className={`pressable flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3.5 ${
              onlyHere ? 'bg-brand/15 text-brand' : 'bg-surface3 text-ink2'
            }`}
          >
            <MapPin size={16} className="shrink-0" />
            <span className="flex-1 text-left text-[13.5px] font-semibold">
              Only what I can do at {here.name}
            </span>
            <span className="text-[12px] font-semibold">{onlyHere ? 'On' : 'Off'}</span>
          </button>
        </div>
      )}

      {/* muscle chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2">
        <button
          type="button"
          onClick={() => setMuscle(null)}
          className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
            muscle === null ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
          }`}
        >
          All
        </button>
        {muscleChips.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle(m === muscle ? null : m)}
            className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
              muscle === m ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
            }`}
          >
            {MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* active filter summary */}
      {(pattern || tier || onlyHere) && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1">
          {pattern && <Badge tone="brand">{PATTERN_LABELS[pattern]}</Badge>}
          {tier && <Badge tone="amber">{TIER_SHORT[tier]}</Badge>}
          {onlyHere && here && <Badge tone="green">At {here.name}</Badge>}
          <button type="button" onClick={clearAll} className="text-[12px] font-semibold text-brand">
            Clear
          </button>
        </div>
      )}

      {/* pinned */}
      {pinnedList.length > 0 && !hasFilters && (
        <section className="px-4 pt-2">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-[15px] font-semibold text-ink">Pinned</h2>
            <span className="text-[12px] font-medium text-ink3">{pinnedList.length}</span>
          </div>
          <Card className="divide-y divide-line overflow-hidden">
            {pinnedList.map((ex) => (
              <ExerciseRow
                key={ex.id}
                ex={ex}
                pinned
                here={here ? availableHere(ex, here) : true}
                onPin={() => void pin(ex)}
                onClick={() => navigate(`/exercise/${ex.id}`)}
              />
            ))}
          </Card>
        </section>
      )}

      {/* results */}
      {filtered.length === 0 ? (
        EXERCISES.length === 0 ? (
          <EmptyState
            icon={<Dumbbell size={40} strokeWidth={1.5} />}
            title="Library loading"
            subtitle="The exercise registry is empty right now. Check back shortly."
          />
        ) : (
          <EmptyState
            icon={<SearchX size={40} strokeWidth={1.5} />}
            title="No exercises match"
            subtitle="Try a different search, or loosen the muscle, pattern and equipment filters."
            action={hasFilters ? <Button variant="secondary" small onClick={clearAll}>Clear filters</Button> : undefined}
          />
        )
      ) : (
        <div className="pb-4">
          {grouped.map(({ kind, items }) => (
            <section key={kind} className="px-4">
              <div className="flex items-baseline justify-between pb-2 pt-4">
                <h2 className="text-[15px] font-semibold text-ink">{KIND_LABELS[kind]}</h2>
                <span className="text-[12px] font-medium text-ink3">{items.length}</span>
              </div>
              <Card className="divide-y divide-line overflow-hidden">
                {items.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    ex={ex}
                    pinned={pinned.has(ex.id)}
                    here={here ? availableHere(ex, here) : true}
                    onPin={() => void pin(ex)}
                    onClick={() => navigate(`/exercise/${ex.id}`)}
                  />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {/* filter sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters" tall>
        {here && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-surface3/60 p-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Only what I can do here</div>
              <div className="mt-0.5 text-[12px] text-ink2">
                Hides anything {here.name} doesn’t have the kit for.
              </div>
            </div>
            <Toggle checked={onlyHere} onChange={setOnlyHere} label="Only available here" />
          </div>
        )}

        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink3">Quality tier</h3>
        <p className="mb-2 text-[12px] leading-snug text-ink2">
          How good the exercise is at its own job — stretch under load, how safely you can push it alone,
          and whether the resistance is honest through the range.
        </p>
        <Card className="mb-4 divide-y divide-line overflow-hidden">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t === tier ? null : t)}
              className="pressable flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  tier === t ? 'border-brand bg-brand text-white' : 'border-line bg-transparent text-transparent'
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="flex-1 text-[15px] font-medium text-ink">{TIER_LABELS[t]}</span>
            </button>
          ))}
        </Card>

        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink3">Movement pattern</h3>
        <Card className="mb-4 divide-y divide-line overflow-hidden">
          {patternRows.map(([p, n]) => (
            <button
              key={p}
              type="button"
              onClick={() => setPattern(p === pattern ? null : p)}
              className="pressable flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  pattern === p ? 'border-brand bg-brand text-white' : 'border-line bg-transparent text-transparent'
                }`}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="flex-1 text-[15px] font-medium text-ink">{PATTERN_LABELS[p]}</span>
              <span className="text-[13px] text-ink3">{n}</span>
            </button>
          ))}
        </Card>

        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink3">Equipment</h3>
        <p className="mb-2 text-[12px] text-ink2">Show exercises that use any of the selected gear.</p>
        <Card className="divide-y divide-line overflow-hidden">
          {equipRows.map((e) => {
            const on = equip.includes(e)
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggleEquip(e)}
                className="pressable flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    on ? 'border-brand bg-brand text-white' : 'border-line bg-transparent text-transparent'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="flex-1 text-[15px] font-medium text-ink">{EQUIPMENT_LABELS[e]}</span>
                <span className="text-[13px] text-ink3">{equipCounts.get(e) ?? 0}</span>
              </button>
            )
          })}
        </Card>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" full disabled={!hasFilters} onClick={clearAll}>
            Reset
          </Button>
          <Button full onClick={() => setSheetOpen(false)}>
            Show {filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function ExerciseRow({ ex, onClick, pinned, here, onPin }: {
  ex: Exercise
  onClick: () => void
  pinned?: boolean
  here?: boolean
  onPin?: () => void
}) {
  const t = tierOf(ex)
  return (
    <div className="flex items-center">
      <div onClick={onClick} className="pressable flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-3">
        <VisibleAnim exercise={ex} size={72} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{ex.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <MuscleBadges muscles={ex.primary} max={2} />
            <Badge tone={TIER_TONE[t]}>{TIER_SHORT[t]}</Badge>
            {here === false && <Badge tone="gray">Not here</Badge>}
            {ex.unilateral && <Badge tone="gray">Unilateral</Badge>}
          </div>
          <div className="mt-1 truncate text-[12px] text-ink3">{equipmentSummary(ex)}</div>
        </div>
      </div>
      {onPin && (
        <button
          type="button"
          aria-label={pinned ? `Unpin ${ex.name}` : `Pin ${ex.name}`}
          onClick={onPin}
          className={`pressable flex h-11 w-11 shrink-0 items-center justify-center ${pinned ? 'text-brand' : 'text-ink3'}`}
        >
          <Star size={19} fill={pinned ? 'currentColor' : 'none'} />
        </button>
      )}
      <div onClick={onClick} className="pressable cursor-pointer pr-3">
        <ChevronRight size={18} className="shrink-0 text-ink3" />
      </div>
    </div>
  )
}
