import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Dexie from 'dexie'
import { AppDB, db, type Activity } from '../db/db'
import { PRACTICE_OPTIONS } from '../lib/activities'
import { LEGACY_DB, userId } from '../lib/mode'
import { exportData, importData } from '../lib/backup'

// For a new, empty account: bring in a studio kept in this browser before accounts existed, or a backup file.
function BringIn() {
  const [legacy, setLegacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      if (!(await Dexie.exists(LEGACY_DB))) return
      const old = new AppDB(LEGACY_DB)
      try { setLegacy((await old.departments.count()) > 0) } catch { /* unreadable: don't offer it */ } finally { old.close() }
    })()
  }, [])

  async function run(load: () => Promise<string>) {
    setBusy(true); setErr(null)
    try { await importData(await load()) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not bring it in.'); setBusy(false) }
  }

  async function fromLegacy() {
    const old = new AppDB(LEGACY_DB)
    try { return await exportData(old) } finally { old.close() }
  }

  const btn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#666666', cursor: 'pointer', borderBottom: '1px solid #DDDDDD', fontFamily: 'inherit' }
  return (
    <div style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      {legacy && <button disabled={busy} onClick={() => void run(fromLegacy)} style={{ ...btn, color: '#111111', fontWeight: 600 }}>Move the studio saved in this browser into your account</button>}
      <button disabled={busy} onClick={() => fileRef.current?.click()} style={btn}>{busy ? 'Bringing it in' : 'Restore a backup file'}</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void run(() => f.text()); e.target.value = '' }} />
      {err && <p role="alert" style={{ fontSize: 11, color: '#C0392B', margin: 0 }}>{err}</p>}
    </div>
  )
}

export function Onboarding() {
  const [selected, setSelected] = useState<Activity[]>(['visual_artist'])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  function toggle(key: Activity) {
    setSelected(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    )
  }

  async function start() {
    setSaving(true)
    await db.departments.add({
      name: name.trim() || 'Working Artist',
      discipline: 'painter',
      activities: selected,
      createdAt: Date.now(),
    })
    navigate('/today')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#F5F5F5] px-6">
      <div className="w-full max-w-[520px] rounded-[20px] bg-white p-8 shadow-[0_4px_40px_rgba(0,0,0,.12)]">
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: 13, color: '#AAAAAA', textAlign: 'center', marginBottom: 8 }}>Working Artist</p>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 28, color: '#111111', textAlign: 'center', margin: '0 0 8px' }}>
          What is your practice?
        </h1>
        <p style={{ fontSize: 13, color: '#AAAAAA', textAlign: 'center', marginBottom: 28 }}>Select all that apply. You can change this later.</p>

        <div className="mb-5 grid grid-cols-4 gap-2">
          {PRACTICE_OPTIONS.map(p => (
            <button key={p.key} onClick={() => toggle(p.key)}
              style={{
                borderRadius: 12, padding: '10px 12px', fontSize: 13, textAlign: 'left', border: 'none', cursor: 'pointer',
                background: selected.includes(p.key) ? '#F5E642' : '#F5F5F5',
                color: selected.includes(p.key) ? '#111111' : '#888888',
                fontWeight: selected.includes(p.key) ? 600 : 400,
              }}>
              {p.label}
            </button>
          ))}
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Studio name (optional)"
          style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '10px 14px', fontSize: 14, color: '#111111', outline: 'none', marginBottom: 16 }} />

        <button onClick={() => void start()} disabled={saving}
          style={{ width: '100%', borderRadius: 12, background: '#111111', color: '#FFFFFF', padding: '13px', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          Get started
        </button>
        {userId && <BringIn />}
      </div>
    </div>
  )
}
