import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { demoField, exitDemo } from '../../lib/mode'
import { flushCloud, retryCloud, useCloudStatus } from '../../lib/cloud'
import { seedDemo } from '../../lib/demoSeed'

const STATUS_LABEL = {
  idle: '', loading: 'Loading', saving: 'Saving', saved: 'Saved online', offline: 'Offline, saves when back online', error: 'Not saved yet',
} as const

const quiet: React.CSSProperties = { background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: '#666666', cursor: 'pointer' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #F5F5F5' }

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '22px 28px', marginBottom: 10 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', margin: '0 0 16px' }}>{title}</p>
      {children}
    </div>
  )
}

function DemoCard() {
  const [busy, setBusy] = useState(false)
  return (
    <Card title="Demo">
      <p style={{ fontSize: 13, color: '#444444', lineHeight: 1.6, margin: '0 0 14px' }}>
        A sample {demoField} studio. Change anything you like; it stays in this browser only.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={busy} onClick={() => { setBusy(true); void seedDemo(demoField!).then(() => setBusy(false)) }} style={quiet}>{busy ? 'Resetting' : 'Start over'}</button>
        <button onClick={exitDemo} style={quiet}>Leave demo</button>
      </div>
    </Card>
  )
}

function SignedInCard() {
  const status = useCloudStatus()
  const [email, setEmail] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [changing, setChanging] = useState(false)
  const [pw, setPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  async function savePassword() {
    if (pw.length < 8) { setPwMsg('Use at least 8 characters'); setChanging(false); return }
    const { error } = await supabase.auth.updateUser({ password: pw })
    setChanging(false)
    setPwMsg(error ? 'Could not change it' : 'Changed')
  }

  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? '')) }, [])

  async function signOut() {
    setLeaving(true)
    await flushCloud()
    await supabase.auth.signOut()
    location.replace('/')
  }

  return (
    <Card title="Account">
      <div style={row}>
        <span style={{ fontSize: 13, color: '#444444' }}>Email</span>
        <span style={{ fontSize: 13, color: '#111111' }}>{email}</span>
      </div>
      <div style={row}>
        <span style={{ fontSize: 13, color: '#444444' }}>Studio</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: status === 'error' || status === 'offline' ? '#A86400' : '#666666' }}>{STATUS_LABEL[status]}</span>
          {status === 'error' && <button onClick={retryCloud} style={quiet}>Try again</button>}
        </span>
      </div>
      <div style={row}>
        <span style={{ fontSize: 13, color: '#444444' }}>Password</span>
        {changing ? (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="password" autoComplete="new-password" autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="New password"
              onKeyDown={e => { if (e.key === 'Enter') void savePassword(); if (e.key === 'Escape') setChanging(false) }}
              style={{ borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 12px', fontSize: 13, outline: 'none', width: 170 }} />
            <button onClick={() => void savePassword()} style={{ ...quiet, background: 'var(--accent)', color: '#111111', fontWeight: 600 }}>Save</button>
          </span>
        ) : (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pwMsg && <span style={{ fontSize: 12, color: '#666666' }}>{pwMsg}</span>}
            <button onClick={() => { setChanging(true); setPw(''); setPwMsg('') }} style={quiet}>Change</button>
          </span>
        )}
      </div>
      <div style={{ ...row, borderBottom: 'none', paddingBottom: 0, justifyContent: 'flex-end' }}>
        <button disabled={leaving} onClick={() => void signOut()} style={quiet}>{leaving ? 'Signing out' : 'Sign out'}</button>
      </div>
    </Card>
  )
}

export function AccountSection() {
  return demoField ? <DemoCard /> : <SignedInCard />
}
