// Per-location equipment editor. Everything the load maths and the substitution
// engine read lives here: what kit is on site, what the bars weigh, which plate
// pairs exist, which dumbbells are on the rack, which stack steps the pin has.

import { useEffect, useMemo, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { ed } from '@/lib/edition'
import {
  Badge, Button, Field, Input, Sheet,
} from '@/components/ui'
import {
  EQUIPMENT_LABELS, GYM_EQUIPMENT_LABELS, equipmentLabel,
  type AnyEquipment, type EquipmentProfile,
} from '@/db/types'

const HOME_KEYS = Object.keys(EQUIPMENT_LABELS) as AnyEquipment[]
const GYM_KEYS = Object.keys(GYM_EQUIPMENT_LABELS) as AnyEquipment[]

const GROUPS: { title: string; keys: AnyEquipment[] }[] = [
  { title: 'Bars, racks & basics', keys: HOME_KEYS },
  { title: 'Gym machines', keys: GYM_KEYS },
]

/** '5, 10, 15' → [5,10,15]; junk is dropped rather than saved as NaN. */
export function parseKgList(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
}

const fmtList = (list: number[]): string => list.join(', ')

const numOr = (text: string, fallback: number): number => {
  const n = Number(text)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export interface EquipmentDraft {
  name: string
  equipment: AnyEquipment[]
  barbell: string
  curlBar: string
  smithBar: string
  plates: string
  dumbbells: string
  stack: string
  minIncrement: string
}

export function draftFrom(p: EquipmentProfile): EquipmentDraft {
  return {
    name: p.name,
    equipment: [...p.equipment],
    barbell: String(p.barbellKg),
    curlBar: String(p.curlBarKg),
    smithBar: String(p.smithBarKg),
    plates: fmtList(p.platePairsKg),
    dumbbells: fmtList(p.dumbbellsKg ?? []),
    stack: fmtList(p.stackStepsKg),
    minIncrement: String(p.minIncrementKg ?? 2.5),
  }
}

export function applyDraft(base: EquipmentProfile, d: EquipmentDraft, nowIso: string): EquipmentProfile {
  return {
    ...base,
    name: d.name.trim() || base.name,
    equipment: d.equipment,
    barbellKg: numOr(d.barbell, base.barbellKg),
    curlBarKg: numOr(d.curlBar, base.curlBarKg),
    smithBarKg: numOr(d.smithBar, base.smithBarKg),
    platePairsKg: parseKgList(d.plates),
    dumbbellsKg: parseKgList(d.dumbbells),
    stackStepsKg: parseKgList(d.stack),
    minIncrementKg: numOr(d.minIncrement, base.minIncrementKg ?? 2.5),
    updatedAt: nowIso,
  }
}

function EquipmentCheck({ ekey, on, onToggle }: {
  ekey: AnyEquipment; on: boolean; onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`pressable flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold ${
        on ? 'bg-brand/12 text-brand ring-1 ring-brand/50' : 'bg-surface3 text-ink2'
      }`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${on ? 'bg-brand text-white' : 'bg-surface2'}`}>
        {on && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 leading-tight">{equipmentLabel(ekey)}</span>
    </button>
  )
}

export function EquipmentEditorSheet({ open, target, onClose, onSave, onDelete }: {
  open: boolean
  /** the profile being edited; null while closed */
  target: EquipmentProfile | null
  onClose: () => void
  onSave: (next: EquipmentProfile) => void
  /** omitted for built-in profiles, which are editable but not deletable */
  onDelete?: (p: EquipmentProfile) => void
}) {
  const [draft, setDraft] = useState<EquipmentDraft | null>(null)

  useEffect(() => {
    setDraft(target ? draftFrom(target) : null)
  }, [target])

  const chosen = useMemo(() => new Set(draft?.equipment ?? []), [draft])
  if (!target || !draft) {
    return <Sheet open={open} onClose={onClose} title="Equipment"><div /></Sheet>
  }

  const patch = (p: Partial<EquipmentDraft>) => setDraft({ ...draft, ...p })
  const toggle = (k: AnyEquipment) => {
    const next = chosen.has(k)
      ? draft.equipment.filter((e) => e !== k)
      : [...draft.equipment, k]
    patch({ equipment: next })
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Edit · ${target.name}`} tall>
      <Field label="Location name">
        <Input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={ed("Home, Flex 24/7, Hotel gym…", "Home, Gym, Hotel gym…")}
        />
      </Field>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[13px] font-medium text-ink2">What's here</div>
          <Badge tone="brand">{draft.equipment.length} selected</Badge>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="mt-3">
            <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink3">{g.title}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {g.keys.map((k) => (
                <EquipmentCheck key={k} ekey={k} on={chosen.has(k)} onToggle={() => toggle(k)} />
              ))}
            </div>
          </div>
        ))}
        <p className="mt-2 text-[12px] leading-relaxed text-ink3">
          Anything unticked is treated as not being here — sessions get swapped onto what is.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Field label="Barbell kg">
          <Input inputMode="decimal" value={draft.barbell} onChange={(e) => patch({ barbell: e.target.value })} />
        </Field>
        <Field label="Curl bar kg">
          <Input inputMode="decimal" value={draft.curlBar} onChange={(e) => patch({ curlBar: e.target.value })} />
        </Field>
        <Field label="Smith bar kg">
          <Input inputMode="decimal" value={draft.smithBar} onChange={(e) => patch({ smithBar: e.target.value })} />
        </Field>
      </div>

      <Field
        className="mt-4"
        label="Plate pairs (kg)"
        hint="One pair of each, comma separated — e.g. 5, 10, 15, 20"
      >
        <Input inputMode="decimal" value={draft.plates} onChange={(e) => patch({ plates: e.target.value })} />
      </Field>

      <Field
        className="mt-4"
        label="Dumbbells (kg)"
        hint="Each size on the rack. Leave empty if there are none here."
      >
        <Input inputMode="decimal" value={draft.dumbbells} onChange={(e) => patch({ dumbbells: e.target.value })} />
      </Field>

      <Field
        className="mt-4"
        label="Cable stack steps (kg)"
        hint="The selectable pin weights on the stack."
      >
        <Input inputMode="decimal" value={draft.stack} onChange={(e) => patch({ stack: e.target.value })} />
      </Field>

      <Field
        className="mt-4"
        label="Smallest useful jump (kg)"
        hint="Used when stepping a lift up."
      >
        <Input inputMode="decimal" value={draft.minIncrement} onChange={(e) => patch({ minIncrement: e.target.value })} />
      </Field>

      <Button full className="mt-5" onClick={() => onSave(applyDraft(target, draft, new Date().toISOString()))}>
        <Check size={16} /> Save location
      </Button>

      {onDelete ? (
        <Button full variant="danger" className="mt-2" onClick={() => onDelete(target)}>
          <Trash2 size={16} /> Delete this location
        </Button>
      ) : (
        <p className="mt-2 px-1 text-center text-[12px] text-ink3">
          {ed("Home and Flex 24/7", "Home and Gym")} are built in — editable, but they stay.
        </p>
      )}
    </Sheet>
  )
}
