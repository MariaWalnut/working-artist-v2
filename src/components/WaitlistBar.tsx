import { useEffect, useState } from 'react'
import { demoField, type DemoField } from '../lib/mode'

// In the demos: a slim bar to join the waiting list without leaving the sample studio.
// Sign-ups go to the same request-invite function as the welcome page.

const ENDPOINT = 'https://ibururqeyzgvddbtrgad.supabase.co/functions/v1/request-invite'
const KEY = 'sb_publishable_uIEfLevKCGUUi5eQKJAseA_jmgMl3GN'
const DISCIPLINES = ['Music', 'Painting', 'Fine art', 'Illustration', 'Writing', 'Film', 'Photography', 'Other']
const FROM_DEMO: Record<DemoField, string> = { musician: 'Music', painter: 'Painting', illustrator: 'Illustration', writer: 'Writing', fineart: 'Fine art', filmmaker: 'Film',
  photographer: 'Photography', 'illustrator-painter': 'Illustration', 'photographer-musician': 'Photography' }
const STATE = 'wa-waitlist'

const read = () => { try { return localStorage.getItem(STATE) } catch { return null } }
const write = (v: string) => { try { localStorage.setItem(STATE, v) } catch { /* private mode */ } }

const inp: React.CSSProperties = { width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '0 14px', fontSize: 14, color: 'var(--wa-ink)', fontFamily: 'inherit', outline: 'none' }

export function WaitlistBar() {
  const [state, setState] = useState(read)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [discipline, setDiscipline] = useState(demoField ? FROM_DEMO[demoField] : '')
  const [msg, setMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !email) setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, email])

  if (!demoField || state === 'hidden') return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setMsg('Please enter your email address.'); return }
    if (!discipline) { setMsg('Please choose what you make.'); return }
    setSending(true); setMsg('Sending…')
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), discipline }) })
      const res = await r.json().catch(() => ({}))
      if (r.ok) { write('joined'); setState('joined'); setMsg(res.status === 'already' ? 'You’re already on the list.' : 'You’re on the list. We’ll let you know when it opens.') }
      else setMsg(res.error || 'Something went wrong. Please try again.')
    } catch { setMsg('Something went wrong. Please try again.') }
    setSending(false)
  }

  const joined = state === 'joined'
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', margin: '-8px 0 20px', padding: '10px 16px', borderRadius: 14, background: 'var(--wa-black)', color: '#FFFFFF', fontSize: 13 }}>
        <span>{joined ? 'You’re on the waiting list.' : 'This is a sample studio. Working Artist is still being made.'}</span>
        {!joined && (
          <button onClick={() => { setOpen(true); setMsg(null) }}
            style={{ minHeight: 32, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#111111', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Join the waiting list
          </button>
        )}
        <button aria-label="Hide" onClick={() => { write('hidden'); setState('hidden') }}
          style={{ background: 'none', border: 'none', color: '#B3B3B3', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
      </div>

      {open && (
        <div onPointerDown={e => { if (e.target === e.currentTarget && !email) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <form role="dialog" aria-label="Join the waiting list" onSubmit={e => void submit(e)} noValidate
            style={{ width: 400, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--wa-surface)', borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <p style={{ margin: 0, fontFamily: 'Recoleta, serif', fontSize: 24, color: 'var(--wa-ink)' }}>Join the waiting list</p>
            <p style={{ margin: '8px 0 18px', fontSize: 13, lineHeight: 1.55, color: 'var(--wa-text)' }}>Leave your email and we’ll let you know when Working Artist opens.</p>
            {!joined && <>
              <input autoFocus type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" aria-label="Email" style={{ ...inp, marginBottom: 8 }} />
              <select value={discipline} onChange={e => setDiscipline(e.target.value)} aria-label="What do you make?" style={{ ...inp, marginBottom: 14 }}>
                <option value="" disabled>What do you make?</option>
                {DISCIPLINES.map(d => <option key={d}>{d}</option>)}
              </select>
            </>}
            {msg && <p role="status" style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--wa-ink)' }}>{msg}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)} style={{ minHeight: 40, padding: '0 14px', border: 'none', background: 'none', color: 'var(--wa-text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{joined ? 'Close' : 'Cancel'}</button>
              {!joined && <button type="submit" disabled={sending} style={{ minHeight: 40, padding: '0 18px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#111111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}>Join</button>}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
