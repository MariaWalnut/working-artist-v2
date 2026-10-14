import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project, type Todo } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { PROJECT_TYPES } from './Projects'

const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%' }
const lbl: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBBBBB' }
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}><span style={lbl}>{label}</span>{children}</label>
}

function EditTypeFields({ type, state, set }: {
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

  return (
    <>
      <Row>{field('location', 'City / Venue')}</Row>
      <Row>{monthField('dateStart', 'Start')}{monthField('dateEnd', 'End')}</Row>
    </>
  )
}

function MetaItem({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#CCCCCC' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#444444' }}>{value}</span>
    </div>
  )
}

function ProjectMeta({ p }: { p: Project }) {
  const t = p.projectType
  const fmt = (s: string) => {
    const [y, m] = s.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  const dateRange = p.dateStart && p.dateEnd
    ? `${fmt(p.dateStart)} – ${fmt(p.dateEnd)}`
    : p.dateStart ? fmt(p.dateStart)
    : p.dateEnd ? fmt(p.dateEnd)
    : null

  const items: [string, string | number | null | undefined][] = []

  if (t === 'Books' || t === 'Publications') {
    items.push(['Author', p.author], ['Illustrator', p.illustrator], ['Designer', p.designer], ['Publisher', p.publisher], ['Published', p.publishedDate ? fmt(p.publishedDate) : null], ['ISBN', p.isbn])
  } else if (t === 'Release') {
    items.push(['Label', p.label], ['Format', p.releaseFormat], ['Released', p.releaseDate ? fmt(p.releaseDate) : null])
  } else if (t === 'Award') {
    items.push(['Organisation', p.organisation], ['Year', p.awardYear])
  } else if (t === 'Commission') {
    items.push(['Client', p.client], ['Location', p.location], ['Dates', dateRange])
  } else {
    items.push(['Institution', p.institution], ['Curator', p.curator], ['Location', p.location], ['Dates', dateRange])
  }

  const filled = items.filter(([, v]) => v)
  if (!filled.length) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px 24px', marginBottom: 28, padding: '16px 0', borderBottom: '1px solid #F5F5F5' }}>
      {filled.map(([label, value]) => <MetaItem key={label} label={label} value={value} />)}
    </div>
  )
}

function projectFieldsFromRecord(p: Project): Record<string, string> {
  return {
    location: p.location ?? '',
    institution: p.institution ?? '',
    curator: p.curator ?? '',
    dateStart: p.dateStart ?? '',
    dateEnd: p.dateEnd ?? '',
    author: p.author ?? '',
    illustrator: p.illustrator ?? '',
    publisher: p.publisher ?? '',
    designer: p.designer ?? '',
    publishedDate: p.publishedDate ?? '',
    isbn: p.isbn ?? '',
    label: p.label ?? '',
    releaseFormat: p.releaseFormat ?? '',
    releaseDate: p.releaseDate ?? '',
    organisation: p.organisation ?? '',
    awardYear: p.awardYear ?? '',
    client: p.client ?? '',
  }
}

type KanbanCol = 'todo' | 'in-progress' | 'done'
const COLUMNS: { key: KanbanCol; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
]

function TaskCard({ task, onMove, onDelete }: { task: Todo; onMove: (s: KanbanCol) => void; onDelete: () => void }) {
  const isDone = task.kanbanStatus === 'done'
  const today = new Date().toISOString().slice(0, 10)
  const overdue = task.dueDate && task.dueDate < today && !isDone
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', position: 'relative' }}>
      <p style={{ fontSize: 13, color: isDone ? '#CCCCCC' : '#111111', textDecoration: isDone ? 'line-through' : 'none', margin: 0 }}>{task.title}</p>
      {task.dueDate && (
        <p style={{ fontSize: 10, color: overdue ? '#E05252' : '#AAAAAA', margin: '4px 0 0' }}>
          {overdue ? 'Overdue' : 'Due'} {task.dueDate.slice(5).replace('-', '/')}
        </p>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {COLUMNS.filter(c => c.key !== task.kanbanStatus).map(c => (
          <button key={c.key} onClick={() => onMove(c.key)}
            style={{ background: '#F5F5F5', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 10, color: '#888888', cursor: 'pointer' }}>
            {c.label}
          </button>
        ))}
        <button onClick={onDelete} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 14, color: '#DDDDDD', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
    </div>
  )
}

function AddTaskInline({ projectId, deptId, col, onDone }: { projectId: number; deptId?: number; col: KanbanCol; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  async function save() {
    if (!title.trim()) { onDone(); return }
    await db.todos.add({ departmentId: deptId, projectId, title: title.trim(), done: false, kanbanStatus: col, dueDate: dueDate || undefined })
    onDone()
  }
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task"
        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#111111', background: 'transparent' }}
        onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') onDone() }} />
      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 11, color: '#AAAAAA', background: 'transparent', marginTop: 6 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => void save()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Add</button>
        <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function KanbanBoard({ projectId, deptId }: { projectId: number; deptId?: number }) {
  const [addingIn, setAddingIn] = useState<KanbanCol | null>(null)
  const tasks = useLiveQuery(() => db.todos.where('projectId').equals(projectId).toArray(), [projectId]) ?? []
  const byCol = (c: KanbanCol) => tasks.filter(t => (t.kanbanStatus ?? 'todo') === c)

  async function moveTask(task: Todo, s: KanbanCol) {
    if (task.id == null) return
    await db.todos.update(task.id, { kanbanStatus: s, done: s === 'done' })
  }
  async function deleteTask(task: Todo) {
    if (task.id == null) return
    await db.todos.delete(task.id)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
      {COLUMNS.map(col => (
        <div key={col.key}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAAAAA' }}>{col.label}</span>
            <span style={{ fontSize: 10, color: '#DDDDDD' }}>{byCol(col.key).length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F9F9F9', borderRadius: 12, padding: 8, minHeight: 60 }}>
            {byCol(col.key).map(task => (
              <TaskCard key={task.id} task={task} onMove={s => void moveTask(task, s)} onDelete={() => void deleteTask(task)} />
            ))}
            {addingIn === col.key && (
              <AddTaskInline projectId={projectId} deptId={deptId} col={col.key} onDone={() => setAddingIn(null)} />
            )}
            <button onClick={() => setAddingIn(col.key)}
              style={{ background: 'none', border: 'none', fontSize: 11, color: '#CCCCCC', cursor: 'pointer', padding: '6px 0', textAlign: 'left' }}>
              + Add task
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pid = Number(id)
  const dept = useActiveDept()

  const project = useLiveQuery(() => db.projects.get(pid), [pid])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('')
  const [customType, setCustomType] = useState('')
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (project === undefined) return null
  if (project === null) { navigate('/projects', { replace: true }); return null }

  function setField(k: string, v: string) { setFields(f => ({ ...f, [k]: v })) }

  function startEdit() {
    const pt = project!.projectType ?? 'Exhibition'
    const knownType = PROJECT_TYPES.includes(pt) ? pt : 'Other'
    setTitle(project!.title)
    setType(knownType)
    setCustomType(knownType === 'Other' ? pt : '')
    setStatus(project!.status ?? 'Active')
    setNotes(project!.notes ?? '')
    setFields(projectFieldsFromRecord(project!))
    setEditing(true)
  }

  async function saveEdit() {
    const projectType = type === 'Other' ? (customType.trim() || 'Other') : type
    const f = fields
    await db.projects.update(pid, {
      title: title.trim() || project!.title,
      projectType, status, notes,
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
    setEditing(false)
  }

  async function deleteProject() {
    await db.projects.delete(pid)
    navigate('/projects', { replace: true })
  }

  return (
    <Shell>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px' }}>
        <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer', padding: 0, marginBottom: 20, letterSpacing: '0.06em' }}>
          ← On My Desk
        </button>

        {editing ? (
          <div>
            <div style={{ marginBottom: 10 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title"
                style={{ ...inp, fontSize: 22, fontFamily: 'Recoleta, serif' }} />
            </div>
            <Row>
              <Field label="Type">
                <select value={type} onChange={e => { setType(e.target.value); setCustomType('') }} style={inp}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              {type === 'Other' && (
                <Field label="Category name">
                  <input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="e.g. Installation" style={inp} />
                </Field>
              )}
            </Row>
            <EditTypeFields type={type} state={fields} set={setField} />
            <div style={{ marginBottom: 10 }}>
              <Field label="Status">
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, maxWidth: 200 }}>
                  {['Active', 'Completed', 'On hold', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ marginBottom: 16 }}>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes…" rows={5}
                style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void saveEdit()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 28, fontWeight: 400, margin: '0 0 4px', color: '#111111' }}>{project.title}</h1>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {project.projectType && <span style={{ fontSize: 11, color: '#AAAAAA' }}>{project.projectType}</span>}
                  {project.status && <span style={{ fontSize: 11, background: '#F5F5F5', borderRadius: 999, padding: '2px 10px', color: '#666666' }}>{project.status}</span>}
                </div>
              </div>
              <button onClick={startEdit} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 10, color: '#888888', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>Edit</button>
            </div>

            <ProjectMeta p={project} />

            {project.notes ? (
              <p style={{ fontSize: 14, color: '#444444', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '0 0 28px' }}>{project.notes}</p>
            ) : (
              <p style={{ fontSize: 13, color: '#CCCCCC', fontStyle: 'italic', margin: '0 0 28px' }}>No notes yet. <button onClick={startEdit} style={{ background: 'none', border: 'none', fontSize: 13, color: '#AAAAAA', cursor: 'pointer', padding: 0, fontStyle: 'italic' }}>Add one →</button></p>
            )}

            {project.id != null && (
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 14px' }}>Tasks</p>
                <KanbanBoard projectId={project.id} deptId={dept?.id} />
              </div>
            )}

            <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 20 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 10, padding: '8px 14px', fontSize: 11, color: '#CCCCCC', cursor: 'pointer' }}>Delete project…</button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#888888' }}>Delete this project?</span>
                  <button onClick={() => void deleteProject()} style={{ background: '#E05252', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
