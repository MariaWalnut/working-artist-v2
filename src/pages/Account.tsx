import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Activity } from '../db/db'
import { getActivities, PRACTICE_OPTIONS } from '../lib/activities'
import { Shell } from '../components/layout/Shell'

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
  const activities = getActivities(d)

  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editingActivities, setEditingActivities] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

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

  const counts = useLiveQuery(async () => ({
    projects: await db.projects.count(),
    opportunities: await db.opportunities.count(),
    works: await db.works.count(),
    books: await db.books.count(),
    releases: await db.releases.count(),
    days: await db.dayLogs.count(),
  }))

  return (
    <Shell>
      <Section title="Studio">
        <Field label="Name">
          {editingName ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') setEditingName(false) }}
                style={{ borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 12px', fontSize: 13, color: '#111111', outline: 'none', width: 180 }} />
              <button onClick={() => void saveName()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#111111' }}>{d?.name ?? '—'}</span>
              <button onClick={() => setEditingName(true)} style={{ background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: '#888888', cursor: 'pointer' }}>Edit</button>
            </>
          )}
        </Field>
        <div style={{ padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#444444' }}>Activities</span>
            <button onClick={() => setEditingActivities(v => !v)} style={{ background: '#F5F5F5', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: '#888888', cursor: 'pointer' }}>
              {editingActivities ? 'Done' : 'Edit'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {editingActivities ? (
              PRACTICE_OPTIONS.map(p => (
                <button key={p.key} onClick={() => void toggleActivity(p.key)}
                  style={{ padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: activities.includes(p.key) ? '#F5E642' : '#F5F5F5',
                    color: activities.includes(p.key) ? '#111111' : '#888888',
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

      <Section title="Data">
        <Field label="Projects"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.projects ?? 0}</span></Field>
        <Field label="Opportunities"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.opportunities ?? 0}</span></Field>
        <Field label="Works"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.works ?? 0}</span></Field>
        <Field label="Books"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.books ?? 0}</span></Field>
        <Field label="Releases"><span style={{ fontSize: 13, color: '#888888' }}>{counts?.releases ?? 0}</span></Field>
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
