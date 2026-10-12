import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

export const PROJECT_TYPES = ['Exhibition', 'Residency', 'Release', 'Award', 'Commission', 'Books', 'Publications', 'Other']

function isActive(p: Project) {
  const end = p.dateEnd ?? p.publishedDate ?? p.releaseDate
  if (!end) return true
  return end >= new Date().toISOString().slice(0, 7)
}

function projectSubtitle(p: Project) {
  const t = p.projectType
  if (t === 'Books' || t === 'Publications') return [p.author, p.publisher].filter(Boolean).join(' · ')
  if (t === 'Release') return [p.label, p.releaseFormat].filter(Boolean).join(' · ')
  if (t === 'Award') return p.organisation
  if (t === 'Commission') return p.client
  return [p.location, p.institution].filter(Boolean).join(' · ')
}

function projectDate(p: Project) {
  const start = p.dateStart
  const end = p.dateEnd ?? p.publishedDate ?? p.releaseDate
  const fmt = (s: string) => {
    const [y, m] = s.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }
  if (p.awardYear) return p.awardYear
  if (!start && end) return fmt(end)
  if (!start) return null
  if (!end) return fmt(start)
  if (start.slice(0, 7) === end.slice(0, 7)) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

const inp: React.CSSProperties = { width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none' }
const lbl: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBBBBB' }
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}><span style={lbl}>{label}</span>{children}</label>
}

function TypeFields({ type, state, set }: {
  type: string
  state: Record<string, string>
  set: (k: string, v: string) => void
}) {
  const s = (k: string) => state[k] ?? ''
  const field = (k: string, placeholder: string, label?: string) => (
    <Field label={label ?? placeholder}>
      <input value={s(k)} onChange={e => set(k, e.target.value)} placeholder={placeholder} style={inp} />
    </Field>
  )
  const monthField = (k: string, label: string) => (
    <Field label={label}>
      <input type="month" value={s(k)} onChange={e => set(k, e.target.value)} style={inp} />
    </Field>
  )

  if (type === 'Exhibition') return (
    <>
      <Row>{field('institution', 'Gallery / Institution')}{field('location', 'City')}</Row>
      <Row>{field('curator', 'Curator')}</Row>
      <Row>{monthField('dateStart', 'Start')}{monthField('dateEnd', 'End')}</Row>
    </>
  )

  if (type === 'Books' || type === 'Publications') return (
    <>
      <Row>{field('author', 'Author')}{field('illustrator', 'Illustrator')}</Row>
      <Row>{field('publisher', 'Publisher')}{field('designer', 'Designer')}</Row>
      <Row>{monthField('publishedDate', 'Published')}{field('isbn', 'ISBN')}</Row>
    </>
  )

  if (type === 'Residency') return (
    <>
      <Row>{field('institution', 'Institution / Programme')}{field('location', 'City / Country')}</Row>
      <Row>{monthField('dateStart', 'Start')}{monthField('dateEnd', 'End')}</Row>
    </>
  )

  if (type === 'Release') return (
    <>
      <Row>{field('label', 'Label')}{field('releaseFormat', 'Format', 'Format (LP / EP / Single)')}</Row>
      <Row>{monthField('releaseDate', 'Release date')}</Row>
    </>
  )

  if (type === 'Award') return (
    <>
      <Row>{field('organisation', 'Organisation / Prize')}{field('awardYear', 'Year')}</Row>
    </>
  )

  if (type === 'Commission') return (
    <>
      <Row>{field('client', 'Client')}{field('location', 'City / Venue')}</Row>
      <Row>{monthField('dateStart', 'Start')}{monthField('dateEnd', 'End')}</Row>
    </>
  )

  // Other
  return (
    <>
      <Row>{field('location', 'City / Venue')}</Row>
      <Row>{monthField('dateStart', 'Start')}{monthField('dateEnd', 'End')}</Row>
    </>
  )
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Exhibition')
  const [customType, setCustomType] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  function setField(k: string, v: string) { setFields(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!title.trim()) return
    const projectType = type === 'Other' ? (customType.trim() || 'Other') : type
    const f = fields
    await db.projects.add({
      departmentId: dept?.id, title: title.trim(), projectType, status: 'Active',
      location: f.location || undefined,
      institution: f.institution || undefined,
      curator: f.curator || undefined,
      dateStart: f.dateStart || undefined,
      dateEnd: f.dateEnd || undefined,
      author: f.author || undefined,
      illustrator: f.illustrator || undefined,
      publisher: f.publisher || undefined,
      designer: f.designer || undefined,
      publishedDate: f.publishedDate || undefined,
      isbn: f.isbn || undefined,
      label: f.label || undefined,
      releaseFormat: f.releaseFormat || undefined,
      releaseDate: f.releaseDate || undefined,
      organisation: f.organisation || undefined,
      awardYear: f.awardYear || undefined,
      client: f.client || undefined,
    })
    onDone()
  }

  return (
    <div style={{ marginBottom: 16, background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>New project</p>
      <div style={{ marginBottom: 10 }}>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
          style={{ ...inp, fontSize: 14 }} onKeyDown={e => { if (e.key === 'Enter') void save() }} />
      </div>
      <Row>
        <Field label="Type">
          <select value={type} onChange={e => { setType(e.target.value); setCustomType(''); setFields({}) }} style={inp}>
            {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {type === 'Other' && (
          <Field label="Category name">
            <input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="e.g. Installation"
              style={inp} onKeyDown={e => { if (e.key === 'Enter') void save() }} />
          </Field>
        )}
      </Row>
      <TypeFields type={type} state={fields} set={setField} />
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Add</button>
        <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function ProjectRow({ p, past, onClick }: { p: Project; past?: boolean; onClick: () => void }) {
  const sub = projectSubtitle(p)
  return (
    <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 160px 100px', alignItems: 'center', padding: past ? '12px 0' : '14px 0', borderBottom: '1px solid #F9F9F9', cursor: 'pointer', opacity: past ? 0.7 : 1 }}>
      <div>
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: past ? 15 : 16, color: past ? '#444444' : '#111111', margin: '0 0 3px' }}>{p.title}</p>
        {sub && <p style={{ fontSize: 10, color: past ? '#CCCCCC' : '#BBBBBB', margin: 0 }}>{sub}</p>}
      </div>
      <p style={{ fontSize: 10, color: past ? '#BBBBBB' : '#888888', margin: 0 }}>{projectDate(p) ?? '—'}</p>
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
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/projects/events')} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '7px 14px', fontSize: 10, color: '#AAAAAA', cursor: 'pointer' }}>All events</button>
            <button onClick={() => setAdding(v => !v)} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>+ New project</button>
          </div>
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
