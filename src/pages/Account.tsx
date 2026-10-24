import { useRef, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Activity } from '../db/db'
import { getActivities, PRACTICE_OPTIONS } from '../lib/activities'
import { downloadBackup, importData, summarise } from '../lib/backup'
import { Shell } from '../components/layout/Shell'
import { AccountSection } from '../components/auth/AccountSection'
import { AccentPicker } from '../components/AccentPicker'
import { startTour } from '../components/GuidedTour'

function Section({ title, tour, children }: { title: string; tour?: string; children: React.ReactNode }) {
  return (
    <div data-tour={tour} style={{ background: '#FFFFFF', borderRadius: 20, padding: '22px 28px', marginBottom: 10 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', margin: '0 0 16px' }}>{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F5F5F5' }}>
      <span style={{ fontSize: 13, color: '#444444' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  )
}

export function Account() {
  const dept = useLiveQuery(() => db.departments.toArray())
  const d = dept?.[0]
  const activities = getActivities(d)

  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editingActivities, setEditingActivities] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Backup & restore
  const fileRef = useRef<HTMLInputElement>(null)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [backupErr, setBackupErr] = useState<string | null>(null)
  const [pending, setPending] = useState<{ json: string; rows: number; exportedAt?: string } | null>(null)
  const [restoring, setRestoring] = useState(false)

  async function handleExport() {
    setBackupErr(null); setBackupMsg(null)
    try { await downloadBackup(); setBackupMsg('Backup downloaded.') }
    catch { setBackupErr('Could not export.') }
  }

  async function handleFilePick(file?: File) {
    setBackupErr(null); setBackupMsg(null); setPending(null)
    if (!file) return
    try {
      const json = await file.text()
      const { rows, exportedAt } = summarise(json)
      setPending({ json, rows, exportedAt })
    } catch (e) {
      setBackupErr(e instanceof Error ? e.message : 'Could not read that file.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleRestore() {
    if (!pending) return
    setRestoring(true); setBackupErr(null)
    try {
      const { rows } = await importData(pending.json)
      setBackupMsg(`Restored ${rows} records, reloading…`)
      setPending(null)
      window.setTimeout(() => window.location.reload(), 700)
    } catch (e) {
      setBackupErr(e instanceof Error ? e.message : 'Restore failed.')
      setRestoring(false)
    }
  }

  useEffect(() => { if (d?.name) setName(d.name) }, [d?.name])

  async function saveName() {
    if (!d?.id || !name.trim()) return
    await db.departments.update(d.id, { name: name.trim() })
    setEditingName(false)
  }

  async function toggleActivity(key: Activity) {
    if (!d?.id) return
    const next = activities.includes(key)
      ? activities.filter(a => a !== key)
      : [...activities, key]
    if (next.length === 0) return
    await db.departments.update(d.id, { activities: next })
  }

  async function resetAll() {
    await db.projects.clear()
    await db.opportunities.clear()
    await db.works.clear()
    await db.books.clear()
    await db.releases.clear()
    await db.dayLogs.clear()
    setConfirmReset(false)
  }


  return (
    <Shell>
      <AccountSection />
      <Section title="Studio">
        <Field label="Name">
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') setEditingName(false) }}
                style={{ borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 12px', fontSize: 13, color: '#111111', outline: 'none', width: 180 }} />
              <button onClick={() => void saveName()} style={{ background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#6E6E6E', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#111111' }}>{d?.name ?? '—'}</span>
              <button onClick={() => setEditingName(true)} style={{ background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: '#666666', cursor: 'pointer' }}>Edit</button>
            </>
          )}
        </Field>
        <div style={{ padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#444444' }}>Activities</span>
            <button onClick={() => setEditingActivities(v => !v)} style={{ background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: '#666666', cursor: 'pointer' }}>
              {editingActivities ? 'Done' : 'Edit'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {editingActivities ? (
              PRACTICE_OPTIONS.map(p => (
                <button key={p.key} onClick={() => void toggleActivity(p.key)}
                  style={{ padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: activities.includes(p.key) ? 'var(--accent)' : '#F5F5F5',
                    color: activities.includes(p.key) ? '#111111' : '#666666',
                    fontWeight: activities.includes(p.key) ? 600 : 400 }}>
                  {p.label}
                </button>
              ))
            ) : (
              activities.map(a => {
                const opt = PRACTICE_OPTIONS.find(p => p.key === a)
                return (
                  <span key={a} style={{ padding: '5px 12px', borderRadius: 999, background: '#F5F5F5', color: '#444444', fontSize: 12 }}>
                    {opt?.label ?? a}
                  </span>
                )
              })
            )}
          </div>
        </div>
      </Section>

      <Section title="Appearance" tour="appearance">
        <AccentPicker dept={d} />
      </Section>

      <Section title="Tour">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#444444' }}>A short walk through each part of Working Artist.</span>
          <button onClick={startTour} style={{ background: '#111111', color: '#FFFFFF', border: 'none', borderRadius: 999, padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Take the tour</button>
        </div>
      </Section>

      <Section title="Danger zone">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 10, padding: '9px 16px', fontSize: 12, color: '#767676', cursor: 'pointer' }}>
            Clear all data…
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#666666' }}>This deletes everything. Continue?</span>
            <button onClick={() => void resetAll()} style={{ background: '#E05252', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>Delete all</button>
            <button onClick={() => setConfirmReset(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#6E6E6E', cursor: 'pointer' }}>Cancel</button>
          </div>
        )}
      </Section>

      <Section title="Backup">
        <p style={{ fontSize: 12, color: '#6E6E6E', lineHeight: 1.6, marginBottom: 18 }}>
          Export a backup to keep your own copy, or to move your studio to another browser or computer. Importing replaces everything here.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <button onClick={() => void handleExport()} style={{ background: '#111111', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFFFFF', cursor: 'pointer' }}>
            Export backup
          </button>
          <label style={{ background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666666', cursor: 'pointer' }}>
            Import backup
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => void handleFilePick(e.target.files?.[0])} />
          </label>
        </div>
        {pending && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#FFFBE6', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: '#666666' }}>
              Restore {pending.rows} records{pending.exportedAt ? ` · ${pending.exportedAt.slice(0, 10)}` : ''} — replaces current data
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={restoring} onClick={() => void handleRestore()} style={{ background: '#E05252', borderRadius: 8, border: 'none', padding: '6px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer', opacity: restoring ? 0.5 : 1 }}>
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
              <button disabled={restoring} onClick={() => setPending(null)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#6E6E6E', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
        {backupMsg && <p style={{ fontSize: 11, color: '#666666', marginTop: 6 }}>{backupMsg}</p>}
        {backupErr && <p style={{ fontSize: 11, color: '#E05252', marginTop: 6 }}>{backupErr}</p>}
      </Section>

      <Section title="About">
        <Field label="Version"><span style={{ fontSize: 13, color: '#767676' }}>Working Artist v2</span></Field>
        <Field label="Storage"><span style={{ fontSize: 13, color: '#767676' }}>Local — stored on this device</span></Field>
      </Section>
    </Shell>
  )
}
