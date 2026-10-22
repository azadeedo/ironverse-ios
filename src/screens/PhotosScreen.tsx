// ============================================================
// PROGRESS PHOTOS (/photos)
// Camera or library → compressed on-device → stored as a Blob in IndexedDB.
// Nothing is ever uploaded. Gallery by date with pose filters, full-size
// viewer, and a draggable side-by-side comparison.
// ============================================================
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Images, Lock, Plus } from 'lucide-react'
import { db, getSetting, setSetting } from '@/db'
import { todayStr } from '@/lib/id'
import type { PhotoPose, ProgressPhoto } from '@/db/types'
import {
  Button, Card, ConfirmDialog, EmptyState, Fab, PageHeader, Section, Segmented, Spinner,
} from '@/components/ui'
import { dayjs } from '@/lib/fmt'
import { useUI } from '@/lib/store'
import CaptureSheet from './photos/CaptureSheet'
import CompareView from './photos/CompareView'
import Viewer from './photos/Viewer'
import { CHECKIN_POSES, POSES, defaultComparePair, groupByDate, poseLabel, usePhotoUrls } from './photos/helpers'

type Mode = 'gallery' | 'checkins' | 'compare'
type Filter = PhotoPose | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...POSES.map((p) => ({ value: p.value as Filter, label: p.label })),
]

export default function PhotosScreen() {
  const { toast } = useUI()
  const photos = useLiveQuery(() => db.progressPhotos.orderBy('date').toArray(), [])
  const latestWeighIn = useLiveQuery(() => db.weighIns.orderBy('date').last(), [])

  const [mode, setMode] = useState<Mode>('gallery')
  const [filter, setFilter] = useState<Filter>('all')
  const [capture, setCapture] = useState(false)
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProgressPhoto | null>(null)

  const all = useMemo(() => photos ?? [], [photos])
  const photoDay = useLiveQuery(() => getSetting<number>('photos:day', 0), []) ?? 0
  const lastDate = all.length ? all[all.length - 1].date : null
  const shown = useMemo(
    () => (filter === 'all' ? all : all.filter((p) => p.pose === filter)),
    [all, filter],
  )
  const groups = useMemo(() => groupByDate(shown), [shown])
  const urls = usePhotoUrls(photos)
  const pair = useMemo(() => defaultComparePair(all), [all])
  // v10 (owner): transformation hero — first vs latest photo of the pose you shoot most
  const hero = useMemo(() => {
    const counts = new Map<PhotoPose, number>()
    for (const p of all) counts.set(p.pose, (counts.get(p.pose) ?? 0) + 1)
    const pose = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
    const ofPose = all.filter((p) => p.pose === pose)
    if (ofPose.length < 2 || ofPose[0].date === ofPose[ofPose.length - 1].date) return null
    const first = ofPose[0], last = ofPose[ofPose.length - 1]
    return { first, last, days: dayjs(last.date).diff(dayjs(first.date), 'day'), kg: first.weightKg && last.weightKg ? last.weightKg - first.weightKg : null }
  }, [all])
  const checkinDays = useMemo(() => new Set(all.map((p) => p.date)).size, [all])

  async function remove(p: ProgressPhoto) {
    try {
      await db.progressPhotos.delete(p.id)
      toast('Photo deleted')
      setViewing(null)
    } catch {
      toast('Could not delete that photo', 'error')
    }
  }

  if (!photos) {
    return (
      <div>
        <PageHeader title="Progress photos" back />
        <div className="flex justify-center py-20"><Spinner /></div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <PageHeader
        title="Progress photos"
        back
        subtitle="The mirror lies on a bad day. Two photos eight weeks apart don't."
        actions={
          <Button small variant="secondary" onClick={() => setCapture(true)}>
            <Camera size={15} /> Add
          </Button>
        }
      />

      <div className="px-4 pt-1">
        <Segmented
          options={[{ value: 'gallery', label: 'Gallery' }, { value: 'checkins', label: 'Check-ins' }, { value: 'compare', label: 'Compare' }]}
          value={mode}
          onChange={setMode}
        />
      </div>

      <div className="mx-4 mt-3 rounded-xl bg-surface2 px-3 py-2.5 text-[12.5px]">
        <div className="flex items-center justify-between"><b>Photo day</b><span className="text-ink3">{lastDate ? `last photos ${dayjs(todayStr()).diff(dayjs(lastDate), 'day')} days ago` : 'no photos yet'}</span></div>
        <div className="mt-1.5 flex gap-1">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <button key={i} type="button" onClick={() => void setSetting('photos:day', i)} className={`h-8 flex-1 rounded-lg text-[12px] font-bold ${photoDay === i ? 'bg-brand text-white' : 'bg-surface3 text-ink3'}`}>{d}</button>)}</div>
        <div className="mt-1.5 text-ink2">{photoDay === dayjs().day() ? (lastDate === todayStr() ? 'Done for today ✓' : 'Today is photo day — same spot, same light, front · side · back.') : `Next photo day: ${dayjs().add((photoDay - dayjs().day() + 7) % 7, 'day').format('ddd D MMM')}`}</div>
      </div>
      <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-surface3/60 px-3 py-2.5 text-[12.5px] text-ink2">
        <Lock size={15} className="mt-0.5 shrink-0 text-ink3" />
        <span>
          Stored on this phone only — {all.length} photo{all.length === 1 ? '' : 's'} in local storage.
          They are never uploaded, and they are included in your local backup file.
        </span>
      </div>

      {all.length === 0 ? (
        <Section title="">
          <Card>
            <EmptyState
              icon={<Images size={36} strokeWidth={1.4} />}
              title="No photos yet"
              subtitle="Same spot, same light, same time of day. Front, side and back — then leave it eight weeks."
              action={<Button onClick={() => setCapture(true)}><Camera size={16} /> Take the first one</Button>}
            />
          </Card>
        </Section>
      ) : mode === 'checkins' ? (
        <Section title="Check-ins">
          <div className="space-y-2.5">
            {groupByDate(all).slice().reverse().map((g) => (
              <Card key={g.date} className="p-3">
                <div className="mb-2 flex items-baseline justify-between text-[13px]"><b>{dayjs(g.date).format('ddd D MMM YYYY')}</b><span className="text-ink3">{g.photos.find((p) => p.weightKg)?.weightKg?.toFixed(1) ?? '—'} kg · {g.photos.length} photo{g.photos.length === 1 ? '' : 's'}</span></div>
                <div className="grid grid-cols-3 gap-1.5">
                  {CHECKIN_POSES.map((pose) => { const p = g.photos.find((x) => x.pose === pose); return (
                    <button key={pose} type="button" disabled={!p} onClick={() => p && setViewing(p)} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface3">
                      {p && urls[p.id] ? <img src={urls[p.id]} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[11px] text-ink3">no {poseLabel(pose).toLowerCase()}</span>}
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] text-white">{poseLabel(pose)}</span>
                    </button>) })}
                </div>
                {g.photos.filter((p) => !CHECKIN_POSES.includes(p.pose)).length > 0 && <div className="mt-1.5 text-[11.5px] text-ink3">+ {g.photos.filter((p) => !CHECKIN_POSES.includes(p.pose)).map((p) => poseLabel(p.pose)).join(', ')}</div>}
                {(g.photos[0]?.tags?.length ?? 0) > 0 && <div className="mt-1 text-[11px] text-ink3">{g.photos[0].tags!.join(' · ')}</div>}
              </Card>
            ))}
          </div>
        </Section>
      ) : mode === 'compare' ? (
        <CompareView photos={all} initial={pair} />
      ) : (
        <>
          {hero && (
            <Section title="Your transformation">
              <button type="button" onClick={() => setMode('compare')} className="pressable block w-full overflow-hidden rounded-2xl bg-surface2 text-left shadow-card">
                <div className="grid grid-cols-2 gap-0.5">
                  {[hero.first, hero.last].map((p, i) => (
                    <div key={p.id} className="relative aspect-[3/4] bg-surface3">
                      {urls[p.id] && <img src={urls[p.id]} alt={`${poseLabel(p.pose)} on ${p.date}`} className="h-full w-full object-cover" />}
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">{i ? 'NOW' : 'DAY 1'}</span>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-[11.5px] font-semibold text-white">{dayjs(p.date).format('D MMM YYYY')}{p.weightKg ? ` · ${p.weightKg.toFixed(1)} kg` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                  <span><b>{hero.days >= 14 ? `${Math.round(hero.days / 7)} weeks` : `${hero.days} days`}</b> apart · {poseLabel(hero.first.pose)}</span>
                  <span className={hero.kg === null ? 'text-ink3' : 'font-bold text-brand'}>{hero.kg === null ? 'tap to compare' : `${hero.kg > 0 ? '+' : ''}${hero.kg.toFixed(1)} kg`}</span>
                </div>
              </button>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface2 py-2"><b className="big-num block text-[17px]">{all.length}</b><span className="text-[11px] text-ink3">photos</span></div>
                <div className="rounded-xl bg-surface2 py-2"><b className="big-num block text-[17px]">{checkinDays}</b><span className="text-[11px] text-ink3">photo days</span></div>
                <div className="rounded-xl bg-surface2 py-2"><b className="big-num block text-[17px]">{Math.max(1, Math.round(hero.days / 7))}</b><span className="text-[11px] text-ink3">weeks tracked</span></div>
              </div>
            </Section>
          )}
          <div className="mt-2">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1">
              {FILTERS.map((f) => {
                const n = f.value === 'all' ? all.length : all.filter((p) => p.pose === f.value).length
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`min-h-[38px] shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                      filter === f.value ? 'bg-brand text-white' : 'bg-surface3 text-ink2'
                    }`}
                  >
                    {f.label}{n ? ` ${n}` : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {groups.length === 0 ? (
            <Section title="">
              <Card>
                <EmptyState
                  icon={<Images size={32} strokeWidth={1.5} />}
                  title={`No ${filter === 'all' ? '' : poseLabel(filter as PhotoPose).toLowerCase() + ' '}photos`}
                  subtitle="Switch the filter, or add one in this pose."
                  action={<Button small onClick={() => setCapture(true)}>Add photo</Button>}
                />
              </Card>
            </Section>
          ) : (
            groups.map((g) => (
              <Section key={g.date} title={dayjs(g.date).format('ddd D MMM YYYY')}>
                <div className="grid grid-cols-3 gap-2">
                  {g.photos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setViewing(p)}
                      className="pressable relative aspect-[3/4] overflow-hidden rounded-xl bg-surface3"
                    >
                      {urls[p.id] ? (
                        <img
                          src={urls[p.id]}
                          alt={`${poseLabel(p.pose)} on ${p.date}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[11px] text-ink3">…</span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-left text-[10.5px] font-semibold text-white">
                        {poseLabel(p.pose)}{p.weightKg ? ` · ${p.weightKg.toFixed(1)}kg` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            ))
          )}
        </>
      )}

      <Fab label="Add progress photo" onClick={() => setCapture(true)}>
        <Plus size={26} />
      </Fab>

      <CaptureSheet
        open={capture}
        onClose={() => setCapture(false)}
        prefillWeightKg={latestWeighIn?.weightKg ?? null}
        defaultPose={filter === 'all' ? 'front' : (filter as PhotoPose)}
      />

      <Viewer photo={viewing} onClose={() => setViewing(null)} onDelete={(p) => setPendingDelete(p)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) void remove(pendingDelete) }}
        title="Delete this photo?"
        message={
          pendingDelete
            ? `${poseLabel(pendingDelete.pose)}, ${dayjs(pendingDelete.date).format('D MMM YYYY')}. This can't be undone — it's only on this phone.`
            : undefined
        }
        confirmLabel="Delete photo"
      />
    </div>
  )
}
