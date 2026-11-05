import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase, needsPassword } from '../../lib/supabase'

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '11px 14px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', fontFamily: 'inherit' }
const btn: React.CSSProperties = { width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '13px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }
const link: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 9, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }

function Frame({ children, below }: { children: ReactNode; below?: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--wa-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 40, lineHeight: 1, color: 'var(--wa-ink)', textAlign: 'center', margin: 0 }}>Working Artist</h1>
        <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wa-muted)', textAlign: 'center', margin: '10px 0 28px' }}>By invitation during testing</p>
        <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 28 }}>{children}</div>
        {below}
      </div>
    </div>
  )
}

// For people who aren't testers yet: the welcome page has the demos and the invite form.
function NewHere() {
  const a: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 18px', borderRadius: 999, fontSize: 12, fontWeight: 600, textDecoration: 'none', flex: 1 }
  return (
    <div style={{ marginTop: 28, textAlign: 'center' }}>
      <p style={{ fontFamily: 'Recoleta, serif', fontSize: 18, color: 'var(--wa-ink)', margin: '0 0 12px' }}>New here?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <a href="/welcome#demos" style={{ ...a, background: 'var(--wa-black)', color: '#FFFFFF' }}>Try a demo</a>
        <a href="/welcome#waitlist" style={{ ...a, background: 'var(--wa-surface)', color: 'var(--wa-ink)', border: '1px solid var(--wa-line)' }}>Join the waiting list</a>
      </div>
    </div>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setInfo(null)
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setBusy(false)
      setErr(error.status === 400 ? 'Email or password not recognised.' : 'Could not reach the server. Try again in a moment.')
      return
    }
    location.replace('/')
  }

  async function forgot() {
    setErr(null); setInfo(null)
    if (!email.trim()) { setErr('Enter your email first.'); return }
    setBusy(true)
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/` })
    setBusy(false)
    if (error) setErr('Could not send the email. Try again in a moment.')
    else setInfo('If that address has an account, a link to set a new password is on its way.')
  }

  return (
    <Frame below={<NewHere />}>
      <form onSubmit={e => void signIn(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label><span style={label}>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={inp} /></label>
        <label><span style={label}>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={inp} /></label>
        {err && <p role="alert" style={{ fontSize: 11, color: 'var(--wa-red)', margin: 0 }}>{err}</p>}
        {info && <p style={{ fontSize: 11, color: 'var(--wa-text-2)', margin: 0, lineHeight: 1.5 }}>{info}</p>}
        <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>{busy ? 'One moment' : 'Sign in'}</button>
        <button type="button" onClick={() => void forgot()} disabled={busy} style={{ ...link, alignSelf: 'center' }}>Forgot password</button>
      </form>
    </Frame>
  )
}

function SetPasswordScreen() {
  const [ready, setReady] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // The link in the email signs the person in; wait for that before asking for a password.
  useEffect(() => {
    const fallback = setTimeout(() => setReady(r => r ?? false), 8000)
    void supabase().auth.getSession().then(({ data }) => { if (data.session) { clearTimeout(fallback); setReady(true) } })
    const { data: sub } = supabase().auth.onAuthStateChange((_e, s) => { if (s) { clearTimeout(fallback); setReady(true) } })
    return () => { clearTimeout(fallback); sub.subscription.unsubscribe() }
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setErr('Use at least 8 characters.'); return }
    setBusy(true); setErr(null)
    const { error } = await supabase().auth.updateUser({ password })
    if (error) { setBusy(false); setErr(error.message); return }
    location.replace('/')
  }

  if (ready === null) return <Frame><p style={{ fontSize: 12, color: 'var(--wa-muted)', margin: 0, textAlign: 'center' }}>Checking your link</p></Frame>
  if (!ready) return (
    <Frame>
      <p style={{ fontSize: 12, color: 'var(--wa-text-2)', margin: '0 0 16px', lineHeight: 1.6 }}>This link has expired or was already used. Ask for a new one from the sign-in page.</p>
      <a href="/" style={{ ...btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Sign in</a>
    </Frame>
  )
  return (
    <Frame>
      <form onSubmit={e => void save(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label><span style={label}>Choose a password</span>
          <input type="password" autoComplete="new-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} style={inp} /></label>
        {err && <p role="alert" style={{ fontSize: 11, color: 'var(--wa-red)', margin: 0 }}>{err}</p>}
        <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>{busy ? 'One moment' : 'Save and open my studio'}</button>
      </form>
    </Frame>
  )
}

export function AuthScreens() {
  return needsPassword ? <SetPasswordScreen /> : <LoginScreen />
}
