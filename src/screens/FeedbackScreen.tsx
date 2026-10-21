// /feedback — suggest features, report bugs, request fixes or edits.
// Sent only when the user taps Send, to the Ironverse feedback form (Netlify
// Forms on ironverse-legal.netlify.app), which emails the developer. Shows
// exactly what will be sent; email and screenshot are optional.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Lightbulb, MessageSquare, Pencil, Send } from 'lucide-react'
import { Button, Card, Field, Input, PageHeader, TextArea } from '@/components/ui'
import { useUI } from '@/lib/store'
import { pickFile } from '@/lib/files'
import { VERSION } from '@/lib/version'
import { EDITION_LABEL } from '@/lib/edition'

export const FEEDBACK_ENDPOINT = 'https://ironverse-legal.netlify.app/'
const TYPES = [
  { v: 'Idea / new feature', icon: Lightbulb },
  { v: 'Bug', icon: Bug },
  { v: 'Fix or edit', icon: Pencil },
  { v: 'Other', icon: MessageSquare },
] as const

export default function FeedbackScreen() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const [type, setType] = useState<string>(TYPES[0].v)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [shot, setShot] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const device = `${EDITION_LABEL()} · ${navigator.userAgent.match(/(iPhone|iPad|Android)[^;)]*/)?.[0] ?? 'browser'}`

  async function send() {
    if (!message.trim() || busy) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('form-name', 'feedback')
      body.append('type', type)
      body.append('message', message.trim())
      if (email.trim()) body.append('email', email.trim())
      body.append('app_version', VERSION)
      body.append('device', device)
      if (shot) body.append('screenshot', shot, shot.name)
      // no-cors: the form accepts the post; the response just isn't readable from the app
      await fetch(FEEDBACK_ENDPOINT, { method: 'POST', body, mode: 'no-cors' })
      toast('Thanks — sent to the developer')
      navigate(-1)
    } catch {
      toast('Could not send — check your connection and try again', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-lg pb-10">
      <PageHeader title="Suggest & report" back subtitle="Ideas, bugs, fixes and additions — read by the developer" />
      <div className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map(({ v, icon: I }) => (
            <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)}
              className={`pressable flex min-h-[52px] items-center gap-2 rounded-xl2 border px-3 text-left text-[13.5px] font-semibold ${type === v ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface2 text-ink2'}`}>
              <I size={17} className="text-brand" />{v}
            </button>
          ))}
        </div>
        <Field label="Message">
          <TextArea rows={6} value={message} placeholder={type === 'Bug' ? 'What happened, and what did you expect? Which screen?' : 'Tell us your idea or what to change'} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Field label="Your email (optional)" hint="Only if you'd like a reply.">
          <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2">
          <Button small variant="secondary" onClick={() => void pickFile('image/*').then((f) => setShot(f[0] ?? null))}>{shot ? 'Change screenshot' : 'Add screenshot (optional)'}</Button>
          {shot && <span className="truncate text-[12px] text-ink3">{shot.name}</span>}
        </div>
        <Card className="p-3 text-[11.5px] leading-relaxed text-ink3">
          Sent with your message: app version {VERSION} and "{device}". Nothing else from the app is sent — your workouts and food logs stay on your phone.
        </Card>
        <Button full disabled={!message.trim() || busy} onClick={() => void send()}><Send size={17} /> {busy ? 'Sending…' : 'Send'}</Button>
      </div>
    </div>
  )
}
