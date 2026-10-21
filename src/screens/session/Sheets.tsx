// Bottom sheets for the live player: swap exercise, jump list, finish confirm.

import { useEffect, useState } from 'react'
import {
  ArrowLeftRight, Bandage, Check, Dumbbell, Flag, Flame, Link2, Undo2,
} from 'lucide-react'
import { ExerciseAnim } from '@/anim/rig'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { nowIso, todayStr } from '@/lib/id'
import type { ExerciseMeta } from '@/db/types'
import { alternativesFor } from '@/data/exercises'
import { MUSCLE_LABELS, equipmentLabel, type WorkoutLog } from '@/db/types'
import { fmtDayShort, fmtInt } from '@/lib/fmt'
import type { WarmupRung } from '@/lib/training'
import { Badge, Button, EmptyState, ListGroup, ListRow, Sheet, TextArea, Toggle } from '@/components/ui'
import {
  doneSetCount, fmtElapsed, nameFor, totalSetCount, totalVolume,
  type GroupInfo, type LogEntry,
} from './helpers'

// ---------- swap ----------
export function SwapSheet({ open, onClose, entry, onSwap }: {
  open: boolean
  onClose: () => void
  entry: LogEntry | null
  onSwap: (newId: string) => void
}) {
  const currentId = entry?.exerciseId ?? ''
  // IV-12 smart gym mode: "busy" lasts for today only, "not working" until he clears it
  const metas = useLiveQuery(() => db.exerciseMeta.toArray(), []) ?? []
  const avail = (id: string): ExerciseMeta['availability'] => {
    const m = metas.find((x) => x.exerciseId === id)
    if (!m?.availability || m.availability === 'available') return undefined
    if (m.availability === 'occupied' && (m.availabilityAt ?? '').slice(0, 10) !== todayStr()) return undefined
    return m.availability
  }
  const mark = async (id: string, a: ExerciseMeta['availability']) => {
    const m = metas.find((x) => x.exerciseId === id)
    await db.exerciseMeta.put({ ...(m ?? { exerciseId: id }), exerciseId: id, availability: a, availabilityAt: nowIso(), updatedAt: nowIso() } as ExerciseMeta)
  }
  const alternatives = entry
    ? alternativesFor(currentId).filter((e) => e.id !== currentId)
        .sort((a, b) => Number(!!avail(a.id)) - Number(!!avail(b.id)))
    : []
  const curAvail = avail(currentId)
  const original = entry?.swappedFrom && entry.swappedFrom !== currentId ? entry.swappedFrom : null

  return (
    <Sheet open={open} onClose={onClose} title="Swap exercise">
      {entry && (
        <p className="mb-3 text-[13px] text-ink2">
          Replacing <span className="font-semibold text-ink">{nameFor(currentId)}</span>. Your set targets carry
          over; weights adjust to the new equipment.
        </p>
      )}
      {entry && (
        <div className="mb-3 rounded-xl bg-surface3/60 p-3 text-[12.5px]">
          <div className="mb-1.5 font-semibold text-ink">Gym mode — is {nameFor(currentId)} free?</div>
          <div className="flex flex-wrap gap-1.5">
            {([['occupied', 'Busy right now'], ['unavailable', 'Not working / not at this gym'], ['available', 'Free']] as const).map(([a, l]) => (
              <button key={a} type="button" onClick={() => void mark(currentId, a)}
                className={`pressable rounded-full px-3 py-1 text-[12px] font-semibold ${(curAvail ?? 'available') === a ? 'bg-brand text-white' : 'bg-surface2 text-ink2'}`}>{l}</button>
            ))}
          </div>
          <div className="mt-1.5 text-[11.5px] text-ink3">“Busy” clears tomorrow; “not working” stays until you mark it free. Pick a swap below — the log records what you actually did.</div>
        </div>
      )}
      {original && (
        <button
          type="button"
          onClick={() => onSwap(original)}
          className="pressable mb-3 flex w-full items-center gap-2 rounded-xl bg-brand/12 px-4 py-3 text-left"
        >
          <Undo2 size={18} className="shrink-0 text-brand" />
          <span className="text-[14px] font-semibold text-brand">Swap back to {nameFor(original)}</span>
        </button>
      )}
      {alternatives.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={32} />}
          title="No alternatives found"
          subtitle="Nothing in the exercise library targets the same muscles with your equipment."
        />
      ) : (
        <ListGroup>
          {alternatives.map((ex) => (
            <ListRow
              key={ex.id}
              onClick={() => onSwap(ex.id)}
              chevron={false}
              leading={
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-surface3/60">
                  <ExerciseAnim def={ex.anim} size={52} playing={false} />
                </div>
              }
              title={ex.name}
              subtitle={`${ex.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${ex.equipment
                .map((e) => equipmentLabel(e))
                .join(', ')}`}
              right={avail(ex.id) ? <Badge tone="gray">{avail(ex.id) === 'occupied' ? 'busy today' : 'unavailable'}</Badge> : <Badge tone="brand">Swap</Badge>}
            />
          ))}
        </ListGroup>
      )}
    </Sheet>
  )
}

// ---------- jump list ----------
export function JumpSheet({ open, onClose, log, currentIdx, onJump, groups = [] }: {
  open: boolean
  onClose: () => void
  log: WorkoutLog | null
  currentIdx: number
  onJump: (idx: number) => void
  /** superset letter per exercise index, when it's part of a block */
  groups?: (string | undefined)[]
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Exercises">
      {log && (
        <ListGroup>
          {log.exercises.map((e, i) => {
            const done = e.sets.filter((s) => s.done).length
            const allDone = done === e.sets.length && e.sets.length > 0
            return (
              <ListRow
                key={`${e.exerciseId}-${i}`}
                onClick={() => onJump(i)}
                chevron={false}
                leading={
                  <div
                    className={`big-num flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${
                      i === currentIdx
                        ? 'bg-brand text-white'
                        : allDone
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-surface3 text-ink2'
                    }`}
                  >
                    {allDone ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </div>
                }
                title={
                  <span className={i === currentIdx ? 'text-brand' : undefined}>
                    {groups[i] ? <span className="mr-1.5 text-brand">{groups[i]}</span> : null}
                    {nameFor(e.exerciseId)}
                  </span>
                }
                subtitle={
                  [
                    e.swappedFrom ? `Swapped in for ${nameFor(e.swappedFrom)}` : '',
                    e.sets.some((s) => s.warmup) ? 'warm-up rungs added' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                right={
                  <Badge tone={allDone ? 'green' : done > 0 ? 'brand' : 'gray'}>
                    {done}/{e.sets.length} sets
                  </Badge>
                }
              />
            )
          })}
        </ListGroup>
      )}
    </Sheet>
  )
}

// ---------- finish confirm ----------
export function FinishSheet({ open, onClose, log, elapsedSec, estCalories, onFinish, onDiscard, onNotes }: {
  open: boolean
  onClose: () => void
  log: WorkoutLog | null
  elapsedSec: number
  estCalories: number
  onFinish: () => void
  onDiscard: () => void
  /** session note, saved as you type into WorkoutLog.notes */
  onNotes?: (notes: string) => void
}) {
  if (!log) return null
  const done = doneSetCount(log)
  const total = totalSetCount(log)
  const remaining = total - done
  const volume = totalVolume(log)

  return (
    <Sheet open={open} onClose={onClose} title="Finish workout?">
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface3/60 p-3 text-center">
          <div className="big-num text-[20px] text-ink">{fmtElapsed(elapsedSec)}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink3">Elapsed</div>
        </div>
        <div className="rounded-xl bg-surface3/60 p-3 text-center">
          <div className="big-num text-[20px] text-ink">
            {done}<span className="text-[13px] text-ink3">/{total}</span>
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink3">Sets</div>
        </div>
        <div className="rounded-xl bg-surface3/60 p-3 text-center">
          <div className="big-num text-[20px] text-ink">{fmtInt(volume)}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink3">kg volume</div>
        </div>
      </div>
      {remaining > 0 ? (
        <p className="mb-4 rounded-xl bg-amber-500/12 px-3.5 py-2.5 text-[13px] font-medium text-amber-500">
          {remaining} {remaining === 1 ? 'set is' : 'sets are'} not ticked — only completed sets count toward
          your stats.
        </p>
      ) : done > 0 ? (
        <p className="mb-4 text-[13px] text-ink2">
          Every set done — strong session. Est. {fmtInt(estCalories)} kcal burned.
        </p>
      ) : (
        <p className="mb-4 rounded-xl bg-amber-500/12 px-3.5 py-2.5 text-[13px] font-medium text-amber-500">
          No sets logged yet. Finish anyway, or discard the session if you started it by mistake.
        </p>
      )}
      {onNotes && (
        <div className="mb-4">
          <div className="mb-1.5 text-[13px] font-medium text-ink2">Session notes (optional)</div>
          <TextArea
            rows={2}
            defaultValue={log.notes ?? ''}
            placeholder="How it went, what felt off, what to change next time…"
            onChange={(e) => onNotes(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button full onClick={onFinish}>
          <Flag size={17} /> Finish workout
        </Button>
        <Button full variant="danger" onClick={onDiscard}>
          Discard session
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-ink3">
        <Dumbbell size={13} /> Your progress is saved as you go — closing the app resumes this session.
      </div>
    </Sheet>
  )
}

// ---------- warm-up ramp ----------
export function WarmupSheet({ open, onClose, exerciseName, workingKg, rungs, alreadyAdded, onAdd }: {
  open: boolean
  onClose: () => void
  exerciseName: string
  workingKg?: number
  rungs: WarmupRung[]
  alreadyAdded: number
  onAdd: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Warm-up sets">
      <p className="mb-3 text-[13.5px] leading-snug text-ink2">
        Ramp up to your working load on{' '}
        <span className="font-semibold text-ink">{exerciseName}</span>. Warm-ups are marked as such, so they
        never count toward volume or your weekly hard sets.
      </p>
      {alreadyAdded > 0 && (
        <p className="mb-3 rounded-xl bg-surface3/60 px-3.5 py-2.5 text-[12.5px] text-ink2">
          {alreadyAdded} warm-up {alreadyAdded === 1 ? 'set is' : 'sets are'} already on this exercise.
        </p>
      )}
      {rungs.length === 0 ? (
        <EmptyState
          icon={<Flame size={30} />}
          title="No ramp needed"
          subtitle={
            workingKg
              ? "The lightest load you can build here is already your working weight — a couple of easy reps at that load is the whole warm-up."
              : 'Set a working weight on this exercise first and a ramp can be worked out.'
          }
        />
      ) : (
        <>
          <ListGroup className="mb-4">
            {rungs.map((r, i) => (
              <ListRow
                key={`${r.kg}-${i}`}
                chevron={false}
                leading={
                  <div className="big-num flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 text-[12px] text-orange-400">
                    {Math.round(r.pct * 100)}
                  </div>
                }
                title={r.label}
                right={<Badge tone="gray">{r.reps} reps</Badge>}
              />
            ))}
          </ListGroup>
          <Button full onClick={onAdd}>
            <Flame size={17} /> Add {rungs.length} warm-up {rungs.length === 1 ? 'set' : 'sets'}
          </Button>
        </>
      )}
    </Sheet>
  )
}

// ---------- per-exercise notes + niggle flag ----------
export function ExerciseNoteSheet({ open, onClose, exerciseName, note, injured, injuredSince, substituteName, onSaveNote, onSetInjured }: {
  open: boolean
  onClose: () => void
  exerciseName: string
  note: string
  injured: boolean
  injuredSince?: string
  /** what would stand in for it while it's flagged */
  substituteName?: string
  onSaveNote: (note: string) => void
  onSetInjured: (injured: boolean) => void
}) {
  const [draft, setDraft] = useState(note)
  useEffect(() => {
    if (open) setDraft(note)
  }, [open, note])

  return (
    <Sheet open={open} onClose={onClose} title={exerciseName}>
      <div className="mb-1.5 text-[13px] font-medium text-ink2">Your notes on this lift</div>
      <TextArea
        rows={3}
        value={draft}
        placeholder="Bench at hole 4, feet flat, elbows tucked…"
        onChange={(e) => setDraft(e.target.value)}
      />
      <p className="mt-1 text-[12px] text-ink3">Saved against the exercise, so it shows up every time you do it.</p>
      <Button
        full
        className="mt-2"
        onClick={() => {
          onSaveNote(draft)
          onClose()
        }}
      >
        Save note
      </Button>

      <div className="mt-5 rounded-2xl border border-line bg-surface3/40 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              <Bandage size={15} className="text-red-500" /> Niggle or injury
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink2">
              {injured
                ? `Flagged${injuredSince ? ` since ${fmtDayShort(injuredSince)}` : ''}. It stays out of your sessions and gets substituted until you clear it.`
                : 'Flag it and this lift is kept out of your sessions, with the closest stand-in swapped in automatically.'}
            </p>
          </div>
          <Toggle checked={injured} onChange={onSetInjured} label="Flag this exercise as injured" />
        </div>
        {!injured && substituteName && (
          <p className="mt-2 text-[12px] text-ink3">Stand-in would be {substituteName}.</p>
        )}
        {injured && (
          <Button variant="secondary" full className="mt-3" onClick={() => onSetInjured(false)}>
            <Check size={16} /> It's fine now — clear the flag
          </Button>
        )}
      </div>
    </Sheet>
  )
}

// ---------- ad-hoc superset picker ----------
export function SupersetSheet({ open, onClose, log, currentIdx, groups, onGroupWith, onUngroup }: {
  open: boolean
  onClose: () => void
  log: WorkoutLog | null
  currentIdx: number
  groups: (string | undefined)[]
  onGroupWith: (idx: number) => void
  onUngroup: () => void
  /** kept for symmetry with GroupInfo consumers */
  info?: GroupInfo | null
}) {
  if (!log) return null
  const current = log.exercises[currentIdx]
  if (!current) return null

  return (
    <Sheet open={open} onClose={onClose} title="Superset with…">
      <p className="mb-3 text-[13.5px] leading-snug text-ink2">
        Pair <span className="font-semibold text-ink">{nameFor(current.exerciseId)}</span> with another
        exercise and you'll bounce between them instead of resting twice.
      </p>
      {groups[currentIdx] && (
        <Button variant="secondary" full className="mb-3" onClick={onUngroup}>
          Leave superset {groups[currentIdx]}
        </Button>
      )}
      <ListGroup>
        {log.exercises.map((e, i) => {
          if (i === currentIdx) return null
          const same = groups[i] && groups[i] === groups[currentIdx]
          return (
            <ListRow
              key={`${e.exerciseId}-${i}`}
              onClick={() => onGroupWith(i)}
              chevron={false}
              title={nameFor(e.exerciseId)}
              subtitle={groups[i] ? `Currently in superset ${groups[i]}` : undefined}
              right={same ? <Badge tone="brand">Paired</Badge> : <Link2 size={17} className="text-ink3" />}
            />
          )
        })}
      </ListGroup>
    </Sheet>
  )
}
