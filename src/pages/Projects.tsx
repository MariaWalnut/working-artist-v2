import { useState } from 'react'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { Desk } from '../components/desk/Desk'

export const PROJECT_TYPES = ['Exhibition', 'Residency', 'Release', 'Award', 'Commission', 'Books', 'Publications', 'Other']

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

export function Projects() {
  const dept = useActiveDept()
  const [adding, setAdding] = useState(false)

  return (
    <Shell>
      {adding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 20px', overflowY: 'auto' }}>
          <div style={{ width: 520, maxWidth: '100%' }}>
            <NewProjectForm onDone={() => setAdding(false)} />
          </div>
        </div>
      )}
      <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, margin: '0 0 16px' }}>On My Desk</p>
      {dept?.id != null && <Desk deptId={dept.id} onNewProject={() => setAdding(true)} />}
    </Shell>
  )
}
