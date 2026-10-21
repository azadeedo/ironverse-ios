// IV-07 v2 — build the next 12-week block from what HIS last block proved.
//
// Every exercise in the finished block gets exactly one decision, with the
// reason and the research behind it:
//
//  HARDER  — he passed the milestone for a harder variation (pull-up pathway,
//            goblet → back squat, leg press → hack squat …). Progressive
//            overload by a harder movement once the easier one stops
//            challenging him at a sensible rep range.
//  KEEP    — main lifts always, and anything still progressing (≥2% e1RM).
//            Repeating the same lift builds the skill that drives strength;
//            excessive exercise rotation slows strength gains while a few
//            well-chosen changes help growth (Kassiano et al. 2022 meta-analysis;
//            Baz-Valle et al. 2019).
//  ANGLE   — stalled accessory (<2% over ≥4 sessions) → a same-muscle
//            alternative, preferring ones that load the muscle at long lengths
//            (seated > lying leg curl, Maeo 2021; overhead > pushdown triceps,
//            Maeo 2023; lengthened-bias training, Pedrosa 2022 / Wolf 2023).
//  REPS    — stalled and no good alternative: keep the exercise, change the rep
//            range — growth is similar across 6–30 reps when sets go close to
//            failure, so a new range gives a new stimulus (Schoenfeld 2017,
//            2021).
//  EASIER  — exercise flagged as injured → a joint-friendlier same-pattern
//            option (machine / cable / supported).
//
// Nothing changes until he ticks it; the finished block is kept.
import { byId } from '@/data/exercises'
import type { EquipmentProfile, ExerciseMeta, Plan, WorkoutLog } from '@/db/types'
import { availableExercises } from '@/lib/equipment'
import { liftSessions, samePatternCandidates } from '@/lib/progression'
import { epley1RM } from '@/lib/training'
import { PATHWAYS, minKgOf } from '@/lib/pathways'

export type ChangeKind = 'harder' | 'keep' | 'angle' | 'reps' | 'easier'
export interface BlockChange {
  kind: ChangeKind
  from: string
  to?: string
  fromName: string
  toName?: string
  /** new rep range for REPS changes */
  newReps?: [number, number]
  gainPct?: number
  sessions: number
  title: string
  why: string
  /** keep decisions are informational (no tick box) */
  optional: boolean
}
// kept so older callers still compile
export type BlockSwap = BlockChange

/** muscles trained at long lengths — preferred when a fresh angle is needed */
export const LENGTHENED = new Set([
  'seated-leg-curl', 'overhead-cable-extension', 'overhead-dumbbell-extension', 'seated-overhead-rope-extension',
  'incline-dumbbell-curl', 'bayesian-cable-curl', 'dumbbell-fly', 'incline-dumbbell-fly', 'cable-fly-low',
  'leaning-cable-lateral-raise', 'single-arm-cable-lateral-raise', 'dumbbell-rdl', 'barbell-rdl', 'smith-rdl',
  'dumbbell-bulgarian-split-squat', 'pendulum-squat', 'hack-squat', 'standing-calf-raise-machine', 'dumbbell-pullover', 'machine-pullover',
  'spider-curl', 'preacher-curl', 'reverse-pec-deck', 'deficit-push-up', '45-degree-back-extension',
])

/** strength-based upgrades beyond the pathways: from → to when the test passes */
interface Upgrade { from: string; to: string; test: (best: { kg: number; reps: number }, bw: number) => boolean; why: (bw: number) => string }
const UPGRADES: Upgrade[] = [
  { from: 'leg-press', to: 'hack-squat', test: (b, bw) => b.kg >= bw * 1.5 && b.reps >= 10, why: (bw) => `Leg press ≥ ${Math.round(bw * 1.5)} kg for 10+ — hack squat keeps the quads loaded deep with more stability demand.` },
  { from: 'goblet-squat', to: 'barbell-squat', test: (b, bw) => b.kg >= bw * 0.3 && b.reps >= 10, why: (bw) => `Goblet squat ≥ ${Math.round(bw * 0.3)} kg for 10+ — the dumbbell is now the limit, not your legs.` },
  { from: 'chest-press-machine', to: 'dumbbell-bench-press', test: (b, bw) => b.kg >= bw * 0.9 && b.reps >= 10, why: () => 'Strong on the machine — free dumbbells add stabiliser work and a deeper stretch.' },
  { from: 'lat-pulldown', to: 'pull-up', test: (b, bw) => b.kg >= bw * 0.8 && b.reps >= 8, why: (bw) => `Pulldown ≥ ${Math.round(bw * 0.8)} kg × 8 — you can pull most of your bodyweight, time for pull-ups.` },
  { from: 'push-up', to: 'chest-dip', test: (b) => b.reps >= 25, why: () => '25+ push-ups — dips load the chest and triceps much harder.' },
]
/** joint-friendlier swaps when an exercise is flagged injured */
const EASIER: Record<string, string> = {
  'barbell-squat': 'leg-press', 'front-squat': 'leg-press', 'barbell-bench-press': 'chest-press-machine', 'incline-barbell-bench-press': 'incline-chest-press-machine',
  'barbell-overhead-press': 'shoulder-press-machine', 'barbell-deadlift': 'trap-bar-deadlift', 'barbell-rdl': 'seated-leg-curl', 'barbell-bent-over-row': 'chest-supported-row',
  'pull-up': 'lat-pulldown', 'chest-dip': 'seated-dip-machine', 'skull-crusher': 'rope-pushdown', 'barbell-lunge': 'leg-press', 'dumbbell-bulgarian-split-squat': 'leg-press',
}

function bestSet(ss: ReturnType<typeof liftSessions>): { kg: number; reps: number } {
  let b = { kg: 0, reps: 0 }
  for (const s of ss.slice(-3)) for (const x of s.sets) { const kg = x.weightKg ?? 0, reps = x.reps ?? 0; if (kg > b.kg || (kg === b.kg && reps > b.reps)) b = { kg, reps } }
  return b
}

export function nextBlockChanges(plan: Plan, logs: WorkoutLog[], eq: EquipmentProfile | null, opts: { bw?: number; meta?: Map<string, ExerciseMeta> } = {}): BlockChange[] {
  const bw = opts.bw ?? 80
  const roles = new Map<string, string | undefined>(), reps = new Map<string, [number, number]>()
  for (const w of plan.weeks) for (const d of w.days) for (const pe of d.exercises) if (!roles.has(pe.exerciseId)) { roles.set(pe.exerciseId, pe.role); reps.set(pe.exerciseId, pe.reps) }
  const used = new Set(roles.keys())
  const avail = new Set((eq ? availableExercises(eq) : []).map((e) => e.id))
  const ok = (id: string) => byId.has(id) && (!eq || avail.has(id)) && !used.has(id)
  const blockLogs = logs.filter((l) => l.date >= plan.startDate && l.finishedAt && !l.skipped)
  const out: BlockChange[] = []

  for (const [id, role] of roles) {
    const ex = byId.get(id)
    if (!ex) continue
    const ss = liftSessions(blockLogs, id)
    const best = bestSet(ss)
    const e1 = (s: (typeof ss)[number]) => Math.max(0, ...s.sets.filter((x) => x.weightKg && x.reps).map((x) => epley1RM(x.weightKg!, x.reps!)))
    const gain = ss.length >= 4 ? (() => { const a = Math.max(e1(ss[0]), e1(ss[1])), b = Math.max(e1(ss[ss.length - 1]), e1(ss[ss.length - 2])); return a ? (b / a - 1) * 100 : undefined })() : undefined
    const base = { from: id, fromName: ex.name, sessions: ss.length, gainPct: gain !== undefined ? Math.round(gain * 10) / 10 : undefined }

    // EASIER — injured
    const m = opts.meta?.get(id)
    if (m?.injured && EASIER[id] && ok(EASIER[id])) {
      const to = EASIER[id]; used.add(to)
      out.push({ ...base, kind: 'easier', to, toName: byId.get(to)!.name, optional: true, title: `${ex.name} → ${byId.get(to)!.name}`, why: `You flagged ${ex.name} as hurting. ${byId.get(to)!.name} trains the same muscles with a fixed path and less joint stress, so you keep the muscle while it settles.` })
      continue
    }

    // HARDER — pathway milestone passed this block
    const pw = PATHWAYS.find((p) => p.stages.some((s) => s.id === id))
    if (pw) {
      const i = pw.stages.findIndex((s) => s.id === id), stage = pw.stages[i], next = pw.stages[i + 1]
      const passed = blockLogs.some((l) => l.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets).filter((s) => s.done && !s.warmup && (s.reps ?? 0) >= stage.reps && (s.weightKg ?? 0) >= minKgOf(stage, bw)).length >= stage.sets)
      if (passed && next && ok(next.id)) {
        used.add(next.id)
        out.push({ ...base, kind: 'harder', to: next.id, toName: byId.get(next.id)!.name, optional: true, title: `${ex.name} → ${byId.get(next.id)!.name}`, why: `You hit the ${pw.name.toLowerCase()} milestone (${stage.sets} × ${stage.reps}${stage.note ? `, ${stage.note}` : ''}). Moving up keeps the overload coming instead of piling on reps.` })
        continue
      }
    }
    const up = UPGRADES.find((u) => u.from === id && best.reps > 0 && u.test(best, bw) && ok(u.to))
    if (up) {
      used.add(up.to)
      out.push({ ...base, kind: 'harder', to: up.to, toName: byId.get(up.to)!.name, optional: true, title: `${ex.name} → ${byId.get(up.to)!.name}`, why: `${up.why(bw)} Best set this block: ${best.kg} kg × ${best.reps}.` })
      continue
    }

    // KEEP — main lifts and anything still moving
    if (role === 'main' || gain === undefined || gain >= 2) {
      out.push({ ...base, kind: 'keep', optional: false, title: `Keep ${ex.name}`,
        why: role === 'main' ? `Main lift — repeating it builds the skill your strength PRs come from${gain !== undefined ? ` (${gain >= 0 ? '+' : ''}${gain.toFixed(1)}% estimated max this block)` : ''}. Starts from your latest working weight.`
          : gain === undefined ? `Only ${ss.length} session${ss.length === 1 ? '' : 's'} logged — not enough to judge, so it stays.`
          : `Still progressing (+${gain.toFixed(1)}% estimated max over ${ss.length} sessions). Don’t change what’s working.` })
      continue
    }

    // ANGLE — stalled: prefer a lengthened-bias, same-muscle alternative
    const cands = samePatternCandidates(id, eq, 8).filter((c) => ok(c.id))
    const pick = cands.find((c) => LENGTHENED.has(c.id)) ?? cands[0]
    if (pick) {
      used.add(pick.id)
      out.push({ ...base, kind: 'angle', to: pick.id, toName: pick.name, optional: true, title: `${ex.name} → ${pick.name}`,
        why: `${ex.name} moved only ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}% over ${ss.length} sessions.${LENGTHENED.has(pick.id) ? ` ${pick.name} loads the same muscle in its stretched position, which research links to more growth (Maeo 2021/2023, Pedrosa 2022).` : ` ${pick.name} hits the same muscles from a new angle to restart progress.`}` })
      continue
    }

    // REPS — stalled, no alternative: same exercise, new rep range
    const cur = reps.get(id) ?? [8, 12]
    const newReps: [number, number] = cur[1] <= 10 ? [10, 15] : cur[0] >= 12 ? [6, 10] : [12, 20]
    out.push({ ...base, kind: 'reps', newReps, optional: true, title: `${ex.name}: ${cur[0]}–${cur[1]} → ${newReps[0]}–${newReps[1]} reps`,
      why: `Stalled (${gain >= 0 ? '+' : ''}${gain.toFixed(1)}%) and there’s no better swap on your equipment. Muscle grows similarly from 6 to 30 reps when sets go close to failure (Schoenfeld 2017), so a new range is a fresh stimulus on the same lift.` })
  }
  const order: ChangeKind[] = ['harder', 'easier', 'angle', 'reps', 'keep']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
}

/** older name: just the swaps (angle) — kept for compatibility */
export function nextBlockSwaps(plan: Plan, logs: WorkoutLog[], eq: EquipmentProfile | null): BlockChange[] {
  return nextBlockChanges(plan, logs, eq).filter((c) => c.kind === 'angle')
}

/** apply accepted changes to a freshly built plan (every week, every day) */
export function applyBlockChanges(plan: Plan, changes: BlockChange[]): Plan {
  const swap = new Map(changes.filter((c) => c.to).map((c) => [c.from, c] as const))
  const rep = new Map(changes.filter((c) => c.newReps).map((c) => [c.from, c.newReps!] as const))
  return { ...plan, weeks: plan.weeks.map((w) => ({ ...w, days: w.days.map((d) => ({ ...d, exercises: d.exercises.map((pe) => {
    const s = swap.get(pe.exerciseId)
    if (s) return { ...pe, exerciseId: s.to!, note: `${s.kind === 'harder' ? 'Harder variation' : s.kind === 'easier' ? 'Easier on the joint' : 'New angle'} (was ${s.fromName})` }
    const r = rep.get(pe.exerciseId)
    if (r) return { ...pe, reps: r, note: `New rep range this block (was ${pe.reps[0]}–${pe.reps[1]})` }
    return pe
  }) })) })) }
}
export const applyBlockSwaps = applyBlockChanges
