import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Shell } from '../components/layout/Shell'

const PRACTICES = [
  { key: 'painter',       label: 'Visual artist' },
  { key: 'picture_books', label: 'Picture books' },
  { key: 'music',         label: 'Musician' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '22px 28px', marginBottom: 10 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 16px' }}>{title}</p>
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

  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => { if (d?.name) setName(d.name) }, [d?.name])

  async function saveName() {
    if (!d?.id || !name.trim()) return
    await db.departments.update(d.id, { name: name.trim() })
    setEditing(false)
  }

  async function resetAll() {
    await db.projects.clear()
    await db.opportunities.clear()
    await db.works.clear()
    await db.dayLogs.clear()
    setConfirmReset(false)
  }

  const counts = useLiveQuery(async () => ({
    projects: await db.projects.count(),
    opportunities: await db.opportunities.count(),
    works: await db.works.count(),
    days: await db.dayLogs.count(),
  }))

  const practiceLabel = PRACTICES.find(p => p.key === d?.discipline)?.label ?? d?.discipline ?? '—'

  return (
    <Shell>
      <Section title="Studio">
        <Field label="Name">
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') setEditing(false) }}
                style={{ borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 12px', fontSize: 13, color: '#111111', outline: 'none', width: 180 }} />
              <button onClick={() => void saveName()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#111111' }}>{d?.name ?? '—'}</span>
              <button onClick={() => setEditing(true)} style={{ background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: '#888888', cursor: 'pointer' }}>Edit</button>
            </>
          )}
        </Field>
        <Field label="Practice">
          <span style={{ fontSize: 13, color: '#888888' }}>{practiceLabel}</span>
        </Field>
      </Section>

      <Section title="Data">
        <Field label="Projects"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.projects ?? 0}</span></Field>
        <Field label="Opportunities"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.opportunities ?? 0}</span></Field>
        <Field label="Works"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.works ?? 0}</span></Field>
        <Field label="Days logged"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.days ?? 0}</span></Field>
        <div style={{ marginTop: 20 }}>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 10, padding: '9px 16px', fontSize: 12, color: '#CCCCCC', cursor: 'pointer' }}>
              Clear all data…
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#888888' }}>This deletes everything. Continue?</span>
              <button onClick={() => void resetAll()} style={{ background: '#E05252', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>Delete all</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
            </div>
          )}
        </div>
      </Section>

      <Section title="About">
        <Field label="Version"><span style={{ fontSize: 13, color: '#CCCCCC' }}>Working Artist v2</span></Field>
        <Field label="Storage"><span style={{ fontSize: 13, color: '#CCCCCC' }}>Local — stored on this device</span></Field>
      </Section>
    </Shell>
  )
}
