import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { supabase, needsPassword } from '../../lib/supabase'
import { DEMO_FIELDS } from '../../lib/mode'

const DEMO_LABEL: Record<typeof DEMO_FIELDS[number], string> = {
  musician: 'Musician', painter: 'Painter', illustrator: 'Illustrator', writer: 'Writer',
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '11px 14px', fontSize: 13, color: '#111111', outline: 'none', fontFamily: 'inherit' }
const btn: React.CSSProperties = { width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '13px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }
const link: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#999999', cursor: 'pointer', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 9, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }

function Frame({ children, below }: { children: ReactNode; below?: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 40, lineHeight: 1, color: '#111111', textAlign: 'center', margin: 0 }}>Working Artist</h1>
        <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#AAAAAA', textAlign: 'center', margin: '10px 0 28px' }}>By invitation during testing</p>
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28 }}>{children}</div>
        {below}
      </div>
    </div>
  )
}

function DemoLinks() {
  return (
    <div style={{ marginTop: 28, textAlign: 'center' }}>
      <p style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#AAAAAA', margin: '0 0 10px' }}>Try a demo studio</p>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', columnGap: 16, rowGap: 6 }}>
        {DEMO_FIELDS.map(f => (
          <a key={f} href={`/demo/${f}`} style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: '#111111', textDecoration: 'none', borderBottom: '2px solid var(--accent)' }}>{DEMO_LABEL[f]}</a>
        ))}
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/` })
    setBusy(false)
    if (error) setErr('Could not send the email. Try again in a moment.')
    else setInfo('If that address has an account, a link to set a new password is on its way.')
  }

  return (
    <Frame below={<DemoLinks />}>
      <form onSubmit={e => void signIn(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label><span style={label}>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={inp} /></label>
        <label><span style={label}>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={inp} /></label>
        {err && <p role="alert" style={{ fontSize: 11, color: '#C0392B', margin: 0 }}>{err}</p>}
        {info && <p style={{ fontSize: 11, color: '#666666', margin: 0, lineHeight: 1.5 }}>{info}</p>}
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
    void supabase.auth.getSession().then(({ data }) => { if (data.session) { clearTimeout(fallback); setReady(true) } })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) { clearTimeout(fallback); setReady(true) } })
    return () => { clearTimeout(fallback); sub.subscription.unsubscribe() }
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setErr('Use at least 8 characters.'); return }
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setBusy(false); setErr(error.message); return }
    location.replace('/')
  }

  if (ready === null) return <Frame><p style={{ fontSize: 12, color: '#999999', margin: 0, textAlign: 'center' }}>Checking your link</p></Frame>
  if (!ready) return (
    <Frame>
      <p style={{ fontSize: 12, color: '#666666', margin: '0 0 16px', lineHeight: 1.6 }}>This link has expired or was already used. Ask for a new one from the sign-in page.</p>
      <a href="/" style={{ ...btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Sign in</a>
    </Frame>
  )
  return (
    <Frame>
      <form onSubmit={e => void save(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label><span style={label}>Choose a password</span>
          <input type="password" autoComplete="new-password" autoFocus value={password} onChange={e => setPassword(e.target.value)} style={inp} /></label>
        {err && <p role="alert" style={{ fontSize: 11, color: '#C0392B', margin: 0 }}>{err}</p>}
        <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>{busy ? 'One moment' : 'Save and open my studio'}</button>
      </form>
    </Frame>
  )
}

export function AuthScreens() {
  return needsPassword ? <SetPasswordScreen /> : <LoginScreen />
}
