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

function ProjectCard({ p, onClick }: { p: Project; onClick: () => void }) {
  const sub = projectSubtitle(p)
  const date = projectDate(p)
  return (
    <div onClick={onClick}
      style={{ background: '#FFFFFF', borderRadius: 16, padding: '20px 22px', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 110, transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.10)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.06)')}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#BBBBBB' }}>{p.projectType ?? 'Project'}</span>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F5E642', flexShrink: 0, marginTop: 2 }} />
      </div>
      <p style={{ fontFamily: 'Recoleta, serif', fontSize: 17, color: '#111111', margin: '0 0 4px', lineHeight: 1.3 }}>{p.title}</p>
      {sub && <p style={{ fontSize: 11, color: '#AAAAAA', margin: 0, lineHeight: 1.4 }}>{sub}</p>}
      {date && <p style={{ fontSize: 10, color: '#CCCCCC', margin: 'auto 0 0', paddingTop: 12 }}>{date}</p>}
    </div>
  )
}

function PastRow({ p, onClick }: { p: Project; onClick: () => void }) {
  const sub = projectSubtitle(p)
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid #F9F9F9', cursor: 'pointer' }}>
      <p style={{ fontFamily: 'Recoleta, serif', fontSize: 14, color: '#666666', margin: 0, flex: 1 }}>{p.title}</p>
      {sub && <span style={{ fontSize: 10, color: '#CCCCCC', flexShrink: 0 }}>{sub}</span>}
      <span style={{ fontSize: 10, color: '#DDDDDD', flexShrink: 0, width: 100, textAlign: 'right' }}>{projectDate(p) ?? ''}</span>
    </div>
  )
}

const EVENT_DOT: Record<string, string> = {
  Reading: '#8CB4D4', Exhibition: '#111111', 'Book Fair': '#F0C878', Talk: '#B8C8A8',
  Performance: '#D4A8C8', Screening: '#A8B4D4', Award: '#F5E642', Residency: '#888888', Other: '#DDDDDD',
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export function Projects() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  const projects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const active = projects.filter(isActive).sort((a, b) => (b.dateStart ?? '').localeCompare(a.dateStart ?? ''))
  const past = projects.filter(p => !isActive(p)).sort((a, b) => (b.dateEnd ?? '').localeCompare(a.dateEnd ?? ''))

  const upcomingEvents = useLiveQuery(async () => {
    if (dept?.id == null) return []
    const tm = new Date().toISOString().slice(0, 7)
    const all = await db.eventEntries.where('departmentId').equals(dept.id).toArray()
    return all.filter(e => (e.date ?? '') >= tm).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 6)
  }, [dept?.id]) ?? []

  const upcomingSubs = useLiveQuery(async () => {
    if (dept?.id == null) return []
    const today = new Date().toISOString().slice(0, 10)
    const all = await db.opportunities.where('departmentId').equals(dept.id).toArray()
    return all.filter(o => o.deadline && o.deadline >= today && (o.status === 'Active' || o.status === 'Draft'))
              .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')).slice(0, 5)
  }, [dept?.id]) ?? []

  const hasUpcoming = upcomingEvents.length > 0 || upcomingSubs.length > 0

  return (
    <Shell>
      {adding && <NewProjectForm onDone={() => setAdding(false)} />}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, margin: 0 }}>On My Desk</p>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setAdding(v => !v)} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>+ New</button>
        </div>
      </div>

      {hasUpcoming && (
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto' }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#CCCCCC', flexShrink: 0 }}>Coming up</span>
          <div style={{ width: 1, height: 16, background: '#F0F0F0', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {upcomingEvents.map(e => {
              const [y, m] = (e.date ?? '').split('-')
              const label = y && m ? new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : e.date
              return (
                <button key={`ev-${e.id}`} onClick={() => navigate('/projects/events')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9F9F9', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: EVENT_DOT[e.type ?? ''] ?? '#DDDDDD', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#444444', fontWeight: 500 }}>{e.title}</span>
                  <span style={{ fontSize: 10, color: '#AAAAAA' }}>{label}</span>
                </button>
              )
            })}
            {upcomingSubs.map(o => {
              const days = o.deadline ? daysUntil(o.deadline) : null
              const urgent = days !== null && days <= 7
              const critical = days !== null && days <= 2
              const dotColor = critical ? '#E05252' : urgent ? '#F0A020' : '#DDDDDD'
              const dayLabel = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days !== null ? `${days}d` : ''
              return (
                <button key={`sub-${o.id}`} onClick={() => navigate('/opportunities')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: critical ? '#FEF2F2' : urgent ? '#FFFBEB' : '#F9F9F9', border: 'none', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#444444', fontWeight: 500 }}>{o.title}</span>
                  {dayLabel && <span style={{ fontSize: 10, color: dotColor, fontWeight: 600 }}>{dayLabel}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
          {active.map(p => <ProjectCard key={p.id} p={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Earlier work</span>
            <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
          </div>
          {past.map(p => <PastRow key={p.id} p={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
        </div>
      )}

      {projects.length === 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '64px 0', textAlign: 'center', color: '#CCCCCC', fontSize: 13, fontStyle: 'italic' }}>No projects yet.</div>
      )}
    </Shell>
  )
}
