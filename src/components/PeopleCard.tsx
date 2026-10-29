import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Contact } from '../db/db'
import { byName } from '../lib/contacts'

type Kind = 'work' | 'event' | 'project'
const FIELD = { work: 'workIds', event: 'eventIds', project: 'projectIds' } as const

// The people linked to a work, event or project, with their lists on a project. Links are kept on the contact.
export function PeopleCard({ kind, id, deptId, style }: { kind: Kind; id: number; deptId?: number; style?: React.CSSProperties }) {
  const navigate = useNavigate()
  const field = FIELD[kind]
  const contacts = useLiveQuery(() => deptId == null ? [] : db.contacts.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const lists = useLiveQuery(() => kind !== 'project' || deptId == null ? [] : db.contactLists.where('departmentId').equals(deptId).filter(l => l.projectId === id).toArray(), [kind, id, deptId]) ?? []
  const [adding, setAdding] = useState(false)
  const linked = contacts.filter(c => (c[field] ?? []).includes(id)).sort(byName)
  const others = contacts.filter(c => !linked.includes(c)).sort(byName)

  const link = (c: Contact, on: boolean) => {
    const ids = on ? [...(c[field] ?? []), id] : (c[field] ?? []).filter(x => x !== id)
    return db.contacts.update(c.id!, { [field]: ids } as Partial<Contact>)
  }

  const label: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', margin: 0 }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F5F5F5' }

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={label}>People</p>
        {others.length > 0 && <button onClick={() => setAdding(v => !v)} style={{ background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#6E6E6E', cursor: 'pointer' }}>+ Add</button>}
      </div>
      {adding && (
        <select autoFocus defaultValue="" aria-label="Contact" onChange={e => { const c = others.find(x => x.id === Number(e.target.value)); if (c) { void link(c, true); setAdding(false) } }}
          style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '8px 10px', fontSize: 12, marginBottom: 8, fontFamily: 'inherit' }}>
          <option value="">Choose a contact…</option>
          {others.map(c => <option key={c.id} value={c.id}>{[c.name, c.organisation].filter(Boolean).join(' · ')}</option>)}
        </select>
      )}
      {linked.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: '#6E6E6E', margin: '4px 0 0' }}>
          {contacts.length === 0 ? <>No contacts yet. <button onClick={() => navigate('/contacts')} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#111111', cursor: 'pointer', borderBottom: '1px solid var(--accent)' }}>Add someone</button></> : 'No one linked yet.'}
        </p>
      )}
      {linked.map(c => (
        <div key={c.id} style={row}>
          <button onClick={() => navigate(`/contacts?c=${c.id}`)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#111111' }}>{c.name}</span>
            {(c.role || c.organisation) && <span style={{ display: 'block', fontSize: 10, color: '#6E6E6E', marginTop: 2 }}>{[c.role, c.organisation].filter(Boolean).join(', ')}</span>}
          </button>
          <button onClick={() => void link(c, false)} aria-label={`Unlink ${c.name}`} style={{ background: 'none', border: 'none', fontSize: 12, color: '#767676', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>
      ))}
      {lists.length > 0 && <>
        <p style={{ ...label, margin: '16px 0 6px' }}>Lists</p>
        {lists.map(l => (
          <button key={l.id} onClick={() => navigate(`/contacts?list=${l.id}`)} style={{ ...row, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#111111' }}>{l.name}</span>
            <span style={{ fontSize: 10, color: '#6E6E6E' }}>{l.members.filter(m => m.done).length} of {l.members.length}</span>
          </button>
        ))}
      </>}
    </div>
  )
}
