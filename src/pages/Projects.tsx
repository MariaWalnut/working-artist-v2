import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const PROJECT_TYPES = ['Exhibition', 'Residency', 'Release', 'Award', 'Commission', 'Other']

function isActive(p: Project) {
  if (!p.dateEnd) return true
  return p.dateEnd >= new Date().toISOString().slice(0, 7)
}

function formatDate(p: Project) {
  if (!p.dateStart) return null
  const fmt = (s: string) => {
    const [y, m] = s.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }
  if (!p.dateEnd) return fmt(p.dateStart)
  if (p.dateStart.slice(0, 7) === p.dateEnd.slice(0, 7)) return fmt(p.dateStart)
  return `${fmt(p.dateStart)} – ${fmt(p.dateEnd)}`
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Exhibition')
  const [location, setLocation] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  async function save() {
    if (!title.trim()) return
    await db.projects.add({ departmentId: dept?.id, title: title.trim(), projectType: type, location, dateStart: dateStart || undefined, dateEnd: dateEnd || undefined, status: 'Active' })
    onDone()
  }

  const inputStyle = { width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none' }

  return (
    <div style={{ marginBottom: 16, background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>New project</p>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title"
        style={{ ...inputStyle, marginBottom: 10, fontSize: 14 }} onKeyDown={e => { if (e.key === 'Enter') void save() }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City / Venue"
          style={{ ...inputStyle, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="month" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <input type="month" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Add</button>
        <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function ProjectRow({ p, past, onClick }: { p: Project; past?: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 160px 100px', alignItems: 'center', padding: past ? '12px 0' : '14px 0', borderBottom: '1px solid #F9F9F9', cursor: 'pointer', opacity: past ? 0.7 : 1 }}>
      <div>
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: past ? 15 : 16, color: past ? '#444444' : '#111111', margin: '0 0 3px' }}>{p.title}</p>
        <p style={{ fontSize: 10, color: past ? '#CCCCCC' : '#BBBBBB', margin: 0 }}>{[p.projectType, p.location].filter(Boolean).join(' · ')}</p>
      </div>
      <p style={{ fontSize: 10, color: past ? '#BBBBBB' : '#888888', margin: 0 }}>{formatDate(p) ?? '—'}</p>
      {!past ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F5E642', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#888888' }}>{p.status ?? 'Active'}</span>
        </div>
      ) : <div />}
      <p style={{ textAlign: 'right', fontSize: 10, color: past ? '#DDDDDD' : '#CCCCCC', margin: 0 }}>→</p>
    </div>
  )
}

export function Projects() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const projects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const active = projects.filter(isActive).sort((a, b) => (b.dateStart ?? '').localeCompare(a.dateStart ?? ''))
  const past = projects.filter(p => !isActive(p)).sort((a, b) => (b.dateEnd ?? '').localeCompare(a.dateEnd ?? ''))

  return (
    <Shell>
      {adding && <NewProjectForm onDone={() => setAdding(false)} />}
      <div style={{ background: '#FFFFFF', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '22px 28px 18px', borderBottom: '1px solid #F5F5F5' }}>
          <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, margin: 0 }}>Projects</p>
          <button onClick={() => setAdding(v => !v)} style={{ marginLeft: 'auto', background: '#F5E642', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>+ New project</button>
        </div>
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column' }}>
            {active.map(p => <ProjectRow key={p.id} p={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
          </div>
          {past.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0 6px' }}>
                <span style={{ fontSize: 9, fontWeight: 500, color: '#CCCCCC', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Earlier work</span>
                <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {past.map(p => <ProjectRow key={p.id} p={p} past onClick={() => navigate(`/projects/${p.id}`)} />)}
              </div>
            </>
          )}
          {projects.length === 0 && (
            <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No projects yet</p>
          )}
        </div>
      </div>
    </Shell>
  )
}
