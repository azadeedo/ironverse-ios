// Health scanner — separate from the calorie logger. Scan a barcode and get a
// score out of 100 with plain-English reasons: which additives, what each one
// does, how risky the evidence says it is, and better options in the same aisle.
import { useEffect, useRef, useState } from 'react'
import { PageHeader, Section, Card, Button, Input, Spinner } from '@/components/ui'
import { barcodeDetectorSupported, cameraSupported, detectBarcodeInImage, normaliseBarcode, isPlausibleBarcode, startLiveScan, type LiveScanHandle, NO_DETECTOR_NOTE } from '@/lib/barcode'
import { compressImage } from './capture/compress'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProfile } from '@/db'
import { halalMode } from '@/db/defaults'
import { HALAL_COLOUR, halalCheck } from '@/lib/halalCheck'
import { betterOptions, healthHistory, lookupHealth, RISK_COLOUR, RISK_LABEL, scoreFood, trafficLight, type ScannedHealth } from '@/lib/foodScore'

function Dial({ score, colour, band }: { score: number; colour: string; band: string }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="10" /><circle cx="60" cy="60" r={r} fill="none" stroke={colour} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .8s' }} /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-[34px] leading-none" style={{ color: colour }}>{score}</b><span className="text-[11px] text-ink3">/100</span><span className="mt-0.5 text-[12px] font-bold" style={{ color: colour }}>{band}</span></div>
    </div>
  )
}

export default function FoodScoreScreen() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanRef = useRef<LiveScanHandle | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [item, setItem] = useState<ScannedHealth | null>(null)
  const [hist, setHist] = useState<ScannedHealth[]>(() => healthHistory())
  const [alts, setAlts] = useState<ScannedHealth[] | null>(null)
  const [altBusy, setAltBusy] = useState(false)
  const [openAdd, setOpenAdd] = useState<string | null>(null)
  // halal check shows only when Halal mode is on (Settings → Food)
  const halal = useLiveQuery(async () => halalMode(await getProfile()), [])
  useEffect(() => () => { scanRef.current?.stop() }, [])

  const look = async (raw: string) => {
    const code = normaliseBarcode(raw)
    if (!isPlausibleBarcode(code)) { setErr('That doesn’t look like a barcode (8–14 digits).'); return }
    setErr(null); setBusy(true); setAlts(null)
    try { const h = await lookupHealth(code); setItem(h); setHist(healthHistory()); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const beginLive = async () => {
    setErr(null); setLive(true); await new Promise((r) => setTimeout(r, 0))
    if (!videoRef.current) return
    scanRef.current = await startLiveScan(videoRef.current, (code) => { scanRef.current?.stop(); setLive(false); void look(code) }, (m) => { setLive(false); setErr(m) })
  }
  const fromPhoto = async (f?: File) => {
    if (!f) return
    setBusy(true); setErr(null)
    try { const code = await detectBarcodeInImage(await compressImage(f, 1600, 0.85)); if (code) await look(code); else setErr(barcodeDetectorSupported() ? 'No barcode found — fill the frame with it and keep it flat.' : NO_DETECTOR_NOTE) } finally { setBusy(false) }
  }

  const r = item ? scoreFood(item) : null
  const tl = item ? trafficLight(item.nut) : {}
  const lvlCol = { low: '#16a34a', medium: '#f59e0b', high: '#dc2626' }

  return (
    <div className="pb-12">
      <PageHeader title="Health scanner" back subtitle={halal ? "Scan food — score out of 100, what’s in it, and a halal check." : "Scan food — get a score out of 100 and what’s in it."} />
      <div className="mx-4 space-y-2">
        {live ? (
          <Card className="overflow-hidden p-0"><video ref={videoRef} playsInline muted className="h-[260px] w-full bg-black object-cover" /><button type="button" onClick={() => { scanRef.current?.stop(); setLive(false) }} className="pressable w-full py-3 text-[13px] font-semibold">Stop</button></Card>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {barcodeDetectorSupported() && cameraSupported() && <Button onClick={() => void beginLive()}>📷 Scan barcode</Button>}
            <Button variant="secondary" onClick={() => photoRef.current?.click()}>🖼 Photo of barcode</Button>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
          </div>
        )}
        <div className="flex gap-2"><Input inputMode="numeric" placeholder="Or type the barcode number" aria-label="Or type the barcode number" value={manual} onChange={(e) => setManual(e.target.value)} /><Button onClick={() => void look(manual)} disabled={!manual}>Check</Button></div>
        {busy && <div className="flex items-center gap-2 text-[13px] text-ink3"><Spinner className="h-4 w-4" /> Checking Open Food Facts…</div>}
        {err && <div className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] text-red-400">{err}</div>}
      </div>

      {item && r && (
        <Section>
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <Dial score={r.score} colour={r.colour} band={r.band} />
              <div className="min-w-0">
                {item.image && <img src={item.image} alt="" className="mb-1 h-12 w-12 rounded-lg bg-white object-contain" />}
                <b className="block text-[16px] leading-tight">{item.name}</b>
                <div className="text-[12.5px] text-ink3">{item.brand ?? ''}</div>
                <div className="mt-1 text-[11.5px] text-ink3">Nutrition {r.nutrition.pts}/100 ({r.nutrition.from === 'nutriscore' ? `Nutri-Score ${item.nutriscore!.toUpperCase()}` : 'estimated from label'}) · Additives {r.additivePts}/100{item.nova ? ` · NOVA ${item.nova}` : ''}</div>
              </div>
            </div>
            {r.capped && <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">Contains a high-risk additive, so the score can’t go above 49 — however good the nutrition is.</div>}
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
              <div><div className="mb-1 font-bold text-red-400">Negatives</div>{r.reasons.bad.length ? r.reasons.bad.map((x) => <div key={x} className="mb-1">✕ {x}</div>) : <div className="text-ink3">None</div>}</div>
              <div><div className="mb-1 font-bold text-emerald-400">Positives</div>{r.reasons.good.length ? r.reasons.good.map((x) => <div key={x} className="mb-1">✓ {x}</div>) : <div className="text-ink3">None</div>}</div>
            </div>
          </Card>

          {halal && (() => {
            const h = halalCheck(item)
            return (
              <Card className="mt-2 p-4 text-[13px]" >
                <div className="flex items-center gap-2"><i className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: HALAL_COLOUR[h.verdict] }} /><b className="text-[15px]" style={{ color: HALAL_COLOUR[h.verdict] }}>Halal check: {h.title}</b></div>
                <div className="mt-1.5 space-y-0.5 text-ink2">{h.reasons.map((x) => <div key={x}>• {x}</div>)}</div>
                <div className="mt-2 text-[11.5px] text-ink3">From the label and ingredients in Open Food Facts. A guide, not a certification — the halal logo on the pack is what counts.</div>
              </Card>
            )
          })()}

          <Card className="mt-2 p-4 text-[13px]">
            <b>Per 100 g</b>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11.5px]">
              {([['Sugar', item.nut.sugar, tl.sugar], ['Sat fat', item.nut.satFat, tl.satFat], ['Salt', item.nut.salt, tl.salt], ['Fat', item.nut.fat, tl.fat]] as const).map(([l, v, lv]) => (
                <div key={l} className="rounded-xl py-2" style={{ background: lv ? `${lvlCol[lv]}22` : 'var(--surface2)' }}><b className="block text-[14px]" style={{ color: lv ? lvlCol[lv] : undefined }}>{v ?? '–'}{v !== undefined ? 'g' : ''}</b>{l}{lv ? ` · ${lv}` : ''}</div>
              ))}
            </div>
            <div className="mt-2 text-[11.5px] text-ink3">{item.nut.kcal !== undefined ? `${item.nut.kcal} kcal` : ''}{item.nut.protein !== undefined ? ` · ${item.nut.protein} g protein` : ''}{item.nut.fibre !== undefined ? ` · ${item.nut.fibre} g fibre` : ''} · traffic lights use UK FSA thresholds</div>
          </Card>

          <Card className="mt-2 p-4 text-[13px]">
            <b>Additives ({r.additives.length})</b>
            {!r.additives.length && <div className="mt-1 text-ink3">None listed on this product.</div>}
            <div className="mt-2 space-y-1.5">
              {r.additives.map((a) => (
                <button key={a.code} type="button" onClick={() => setOpenAdd(openAdd === a.code ? null : a.code)} className="pressable block w-full rounded-xl bg-surface2 px-3 py-2 text-left">
                  <div className="flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RISK_COLOUR[a.risk] }} /><b className="flex-1">{a.code.toUpperCase()} · {a.name}</b><span className="text-[11.5px] font-semibold" style={{ color: RISK_COLOUR[a.risk] }}>{RISK_LABEL[a.risk]}</span></div>
                  <div className="text-[11.5px] text-ink3">{a.role}</div>
                  {openAdd === a.code && <div className="mt-1 text-[12.5px] text-ink2">{a.why}</div>}
                </button>
              ))}
            </div>
            {r.additives.length > 0 && <div className="mt-2 text-[11.5px] text-ink3">Tap an additive for why. “Risk” describes the strength of concern in the research, not harm from one serve.</div>}
          </Card>

          {(item.allergens.length > 0 || item.palmOil !== undefined || item.vegan !== undefined || item.ingredients) && (
            <Card className="mt-2 p-4 text-[13px]">
              {item.allergens.length > 0 && <div><b>Allergens:</b> {item.allergens.join(', ')}</div>}
              {item.palmOil !== undefined && <div className="mt-1"><b>Palm oil:</b> {item.palmOil ? 'contains palm oil' : 'palm-oil free'}</div>}
              {item.vegan !== undefined && <div className="mt-1"><b>Vegan:</b> {item.vegan ? 'yes' : 'no'}</div>}
              {item.ingredients && <details className="mt-2"><summary className="cursor-pointer font-semibold">Ingredients</summary><p className="mt-1 text-[12.5px] text-ink2">{item.ingredients}</p></details>}
            </Card>
          )}

          <div className="mt-2">
            {alts === null ? (
              <Button full variant="secondary" disabled={altBusy} onClick={() => { setAltBusy(true); void betterOptions(item.code).then(setAlts).catch(() => setAlts([])).finally(() => setAltBusy(false)) }}>{altBusy ? 'Looking…' : '🔄 Find a healthier option in this aisle'}</Button>
            ) : alts.length ? (
              <Card className="p-3"><b className="text-[13px]">Healthier options</b>
                {alts.map((h) => { const s = scoreFood(h); return (
                  <button key={h.code} type="button" onClick={() => { setItem(h); setAlts(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="pressable mt-1.5 flex w-full items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-left text-[13px]">
                    <b className="w-9 text-center text-[16px]" style={{ color: s.colour }}>{s.score}</b><span className="min-w-0 flex-1 truncate">{h.name}<span className="block text-[11.5px] text-ink3">{h.brand ?? ''}</span></span>
                  </button>) })}
              </Card>
            ) : <div className="text-center text-[12.5px] text-ink3">No better match found in Open Food Facts for this category.</div>}
          </div>
        </Section>
      )}

      {hist.length > 0 && (
        <Section title="Your scans">
          {hist.slice(0, 20).map((h) => { const s = scoreFood(h); return (
            <button key={h.code} type="button" onClick={() => { setItem(h); setAlts(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="pressable mb-1.5 flex w-full items-center gap-3 rounded-2xl bg-surface2 px-3 py-2.5 text-left">
              <b className="w-10 text-center text-[18px]" style={{ color: s.colour }}>{s.score}</b>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{h.name}</span><span className="text-[11.5px] text-ink3">{s.band} · {h.brand ?? ''}</span></span>
            </button>) })}
        </Section>
      )}

      <div className="mx-4 mt-4 text-[11px] text-ink3">Data: Open Food Facts (community database). Score: 60% nutrition (Nutri-Score), 30% additives, 10% organic; high-risk additives cap it at 49; ultra-processed −10. Additive notes summarise EFSA, IARC and published studies. Not medical advice.</div>
    </div>
  )
}
