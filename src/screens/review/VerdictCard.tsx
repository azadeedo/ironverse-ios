// The one honest sentence. No scolding, no confetti — just what happened.
import { CheckCircle2, CircleDot, Info, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui'
import type { Verdict } from './helpers'

const TONE: Record<Verdict['tone'], { ring: string; text: string; Icon: typeof Info }> = {
  green: { ring: 'bg-emerald-500/12 text-emerald-500', text: 'text-ink', Icon: CheckCircle2 },
  brand: { ring: 'bg-brand/12 text-brand', text: 'text-ink', Icon: CircleDot },
  amber: { ring: 'bg-amber-500/15 text-amber-500', text: 'text-ink', Icon: TriangleAlert },
  gray: { ring: 'bg-surface3 text-ink2', text: 'text-ink', Icon: Info },
}

export default function VerdictCard({ verdict, weekLabel }: { verdict: Verdict; weekLabel: string }) {
  const tone = TONE[verdict.tone]
  const Icon = tone.Icon
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.ring}`}>
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <div className="shout text-[12px] text-ink3">How {weekLabel.toLowerCase()} went</div>
          <p className={`mt-1 text-[15.5px] leading-[1.45] ${tone.text}`}>{verdict.text}</p>
        </div>
      </div>
    </Card>
  )
}
