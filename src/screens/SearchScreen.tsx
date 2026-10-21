// SEARCH — one box over exercises, foods, past sessions, recipes and every
// settings section. Entirely offline; the index is built once from Dexie plus
// the static registries and reused on every keystroke.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Apple, CalendarCheck, ChefHat, Dumbbell, History, Search as SearchIcon,
  SlidersHorizontal, X,
} from 'lucide-react'
import {
  Badge, Callout, Card, EmptyState, FOCUS_RING, ListGroup, ListRow, PageHeader,
  Section, Spinner, TAP_TARGET,
} from '@/components/ui'
import {
  GROUP_LABELS, getIndex, refreshIndexIfStale, runSearch, totalHits,
  type GroupedResults, type SearchGroup, type SearchItem,
} from '@/lib/search'

const GROUP_ICONS: Record<SearchGroup, typeof Dumbbell> = {
  exercise: Dumbbell,
  food: Apple,
  session: CalendarCheck,
  recipe: ChefHat,
  setting: SlidersHorizontal,
}

const GROUP_TONES: Record<SearchGroup, string> = {
  exercise: 'text-violet-400',
  food: 'text-emerald-400',
  session: 'text-brand',
  recipe: 'text-amber-400',
  setting: 'text-sky-400',
}

const FILTERS: { value: SearchGroup | null; label: string }[] = [
  { value: null, label: 'Everything' },
  { value: 'exercise', label: GROUP_LABELS.exercise },
  { value: 'food', label: GROUP_LABELS.food },
  { value: 'session', label: GROUP_LABELS.session },
  { value: 'setting', label: GROUP_LABELS.setting },
  { value: 'recipe', label: GROUP_LABELS.recipe },
]

const SUGGESTIONS = ['bench', 'squat', 'chicken', 'protein', 'halal', 'backup', 'rest timer']

const DEBOUNCE_MS = 120
const PER_GROUP = 6
const RECENT_KEY = 'ironverse:recentSearches'

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

function saveRecent(list: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))) } catch { /* private mode */ }
}

export default function SearchScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [query, setQuery] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(query)
  const [only, setOnly] = useState<SearchGroup | null>(null)
  const [items, setItems] = useState<SearchItem[] | null>(null)
  const [expanded, setExpanded] = useState<Set<SearchGroup>>(new Set())
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const inputRef = useRef<HTMLInputElement>(null)

  // build the index once on mount, refreshing only if Dexie counts moved
  useEffect(() => {
    let alive = true
    void (async () => {
      await refreshIndexIfStale()
      const list = await getIndex()
      if (alive) setItems(list)
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query])

  useEffect(() => { setExpanded(new Set()) }, [debounced, only])

  const groups: GroupedResults[] = useMemo(() => {
    if (!items || debounced.trim().length < 2) return []
    return runSearch(items, debounced, { perGroup: 200, only })
  }, [items, debounced, only])

  const count = totalHits(groups)

  function open(to: string, label: string) {
    const next = [label, ...recent.filter((r) => r !== label)]
    setRecent(next)
    saveRecent(next)
    navigate(to)
  }

  const searching = debounced.trim().length >= 2

  return (
    <div className="mx-auto max-w-lg pb-10">
      <PageHeader title="Search" back large={false} />
      {!query && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
          {([['Start workout', '/workout'], ['Add food', '/food'], ['Log weight', '/progress'], ['Water', '/hydration'], ['Meal planner', '/meal-plan'], ['Records', '/prs'], ['Progress hub', '/hub'], ['Calorie centre', '/calories'], ['Backup', '/backup']] as const).map(([l, to]) => (
            <button key={to} type="button" onClick={() => navigate(to)} className="pressable shrink-0 rounded-full bg-brand/12 px-3.5 py-2 text-[13px] font-semibold text-brand">{l}</button>
          ))}
        </div>
      )}

      <div className="sticky top-[52px] z-20 bg-surface/85 px-4 pb-2 pt-1 backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-xl bg-surface3 px-3 py-2.5">
          <SearchIcon size={18} className="shrink-0 text-ink3" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            type="search"
            role="searchbox"
            aria-label="Search exercises, foods, sessions and settings"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3"
            placeholder="Exercises, foods, sessions, settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear search"
              className={`pressable ${FOCUS_RING} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink3`}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => {
            const active = only === f.value
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={active}
                onClick={() => setOnly(f.value)}
                className={`pressable ${FOCUS_RING} shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                  active ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {items === null && (
        <div className="flex h-[40svh] items-center justify-center"><Spinner /></div>
      )}

      {items !== null && !searching && (
        <>
          {recent.length > 0 && (
            <Section title="Recent">
              <ListGroup>
                {recent.map((r) => (
                  <ListRow
                    key={r}
                    leading={<History size={17} className="text-ink3" aria-hidden="true" />}
                    title={r}
                    onClick={() => { setQuery(r); inputRef.current?.focus() }}
                  />
                ))}
              </ListGroup>
              <button
                type="button"
                onClick={() => { setRecent([]); saveRecent([]) }}
                className={`pressable ${FOCUS_RING} ${TAP_TARGET} mt-2 px-1 text-[13px] font-semibold text-ink3`}
              >
                Clear recent searches
              </button>
            </Section>
          )}

          <Section title="Try">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setQuery(s); inputRef.current?.focus() }}
                  className={`pressable ${FOCUS_RING} min-h-[38px] rounded-full bg-surface3 px-3.5 text-[13px] font-semibold text-ink2`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Section>

          <Section>
            <Callout tone="neutral" icon={<SearchIcon size={15} />}>
              Searches {items.length.toLocaleString('en-AU')} things on this device — every exercise,
              every food, every session you have logged and every settings page. Nothing leaves the phone.
            </Callout>
          </Section>
        </>
      )}

      {items !== null && searching && count === 0 && (
        <EmptyState
          icon={<SearchIcon size={30} />}
          title={`Nothing matches “${debounced.trim()}”`}
          subtitle="Try a shorter word — searching matches the start of words, not the middle."
        />
      )}

      {items !== null && searching && count > 0 && (
        <div className="pt-1">
          <p className="px-4 pt-2 text-[12px] text-ink3" role="status" aria-live="polite">
            {count} result{count === 1 ? '' : 's'}
          </p>
          {groups.map((g) => {
            const Icon = GROUP_ICONS[g.group]
            const isOpen = expanded.has(g.group)
            const shown = isOpen ? g.hits : g.hits.slice(0, PER_GROUP)
            const hidden = g.hits.length - shown.length
            return (
              <Section key={g.group} title={g.label}>
                <ListGroup>
                  {shown.map((hit) => (
                    <ListRow
                      key={hit.key}
                      leading={<Icon size={18} className={GROUP_TONES[g.group]} aria-hidden="true" />}
                      title={hit.title}
                      subtitle={hit.subtitle}
                      onClick={() => open(hit.to, hit.title)}
                    />
                  ))}
                </ListGroup>
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => new Set(prev).add(g.group))}
                    className={`pressable ${FOCUS_RING} ${TAP_TARGET} mt-2 w-full rounded-xl bg-surface2 px-4 py-2.5 text-[13.5px] font-semibold text-brand`}
                  >
                    Show {hidden} more in {g.label.toLowerCase()}
                  </button>
                )}
              </Section>
            )
          })}
        </div>
      )}

      {items !== null && searching && count > 0 && (
        <div className="mt-6 px-4">
          <Card className="p-3.5">
            <div className="flex items-center gap-2">
              <Badge tone="gray">Offline</Badge>
              <span className="text-[12px] text-ink3">Results come from this device only.</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
