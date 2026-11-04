import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project, type Todo } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { PeopleCard } from '../components/PeopleCard'
import { ProjectSubmissions } from '../components/ProjectSubmissions'
import { useNarrow } from '../lib/useNarrow'
import { PROJECT_TYPES } from './Projects'
import { PracticeSelect } from '../components/Practice'
import { practiceOf, usePractice } from '../lib/practice'
import type { Activity } from '../db/db'

const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '9px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', width: '100%' }
const lbl: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wa-muted)' }
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

  if (type === 'Film') return (
    <>
      <Row>{field('client', 'Production company')}{field('location', 'Shooting location')}</Row>
      <Row>{monthField('dateStart', 'Shoot starts')}{monthField('dateEnd', 'Shoot ends')}</Row>
      <Row>{monthField('releaseDate', 'Premiere')}</Row>
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
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wa-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--wa-text)' }}>{value}</span>
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
  } else if (t === 'Film') {
    items.push(['Production', p.client], ['Location', p.location], ['Shoot', dateRange], ['Premiere', p.releaseDate ? fmt(p.releaseDate) : null])
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px 24px', marginBottom: 28, padding: '16px 0', borderBottom: '1px solid var(--wa-line)' }}>
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

const heading: React.CSSProperties = { fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 20, color: 'var(--wa-ink)', margin: 0 }
const COLUMN_RULE: Record<KanbanCol, string> = { todo: 'var(--wa-ink)', 'in-progress': 'var(--accent)', done: 'var(--wa-line)' }

function dueLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function TaskCard({ task, narrow, onMove, onDelete, onDrag }: { task: Todo; narrow: boolean; onMove: (s: KanbanCol) => void; onDelete: () => void; onDrag: (id: number | null) => void }) {
  const status = task.kanbanStatus ?? 'todo'
  const isDone = status === 'done'
  const today = new Date().toLocaleDateString('en-CA')
  const overdue = !!task.dueDate && task.dueDate < today && !isDone
  return (
    <div draggable={!narrow} onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); e.dataTransfer.effectAllowed = 'move'; onDrag(task.id!) }} onDragEnd={() => onDrag(null)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--wa-surface)', borderRadius: 12, padding: '14px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', cursor: narrow ? 'default' : 'grab' }}>
      <button onClick={() => onMove(isDone ? 'todo' : 'done')} aria-label={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        style={{ flexShrink: 0, width: 20, height: 20, marginTop: 1, padding: 0, borderRadius: '50%', border: isDone ? 'none' : '1.5px solid var(--wa-ink)', background: isDone ? 'var(--wa-ink)' : 'none', color: 'var(--wa-surface)', fontSize: 11, lineHeight: '20px', cursor: 'pointer' }}>
        {isDone ? '✓' : ''}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: isDone ? 'var(--wa-muted)' : 'var(--wa-ink)', textDecoration: isDone ? 'line-through' : 'none', margin: 0, textWrap: 'pretty' }}>{task.title}</p>
        {task.dueDate && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: overdue ? 600 : 400, color: overdue ? '#C53030' : 'var(--wa-text-2)', background: overdue ? 'rgba(197,48,48,.1)' : 'var(--wa-fill)', borderRadius: 999, padding: '2px 8px' }}>
            {overdue ? 'Overdue' : 'Due'} {dueLabel(task.dueDate)}
          </span>
        )}
        {narrow && (
          <select value={status} aria-label={`Move ${task.title}`} onChange={e => onMove(e.target.value as KanbanCol)}
            style={{ display: 'block', marginTop: 8, border: 'none', borderRadius: 999, background: 'var(--wa-fill)', padding: '4px 8px', fontSize: 11, color: 'var(--wa-text-2)', fontFamily: 'inherit' }}>
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        )}
      </div>
      <button onClick={onDelete} aria-label={`Delete ${task.title}`} style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, fontSize: 14, color: 'var(--wa-muted)', cursor: 'pointer', lineHeight: 1 }}>×</button>
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
    <div style={{ background: 'var(--wa-surface)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task"
        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: 'var(--wa-ink)', background: 'transparent' }}
        onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') onDone() }} />
      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 11, color: 'var(--wa-muted)', background: 'transparent', marginTop: 6 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Add</button>
        <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function KanbanBoard({ projectId, deptId }: { projectId: number; deptId?: number }) {
  const narrow = useNarrow()
  const [addingIn, setAddingIn] = useState<KanbanCol | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<KanbanCol | null>(null)
  const tasks = useLiveQuery(() => db.todos.where('projectId').equals(projectId).toArray(), [projectId]) ?? []
  const byCol = (c: KanbanCol) => tasks.filter(t => (t.kanbanStatus ?? 'todo') === c)
  const done = byCol('done').length

  async function moveTask(task: Todo, s: KanbanCol) {
    if (task.id == null) return
    await db.todos.update(task.id, { kanbanStatus: s, done: s === 'done', ticked: s === 'done' || undefined })
  }
  async function deleteTask(task: Todo) {
    if (task.id == null) return
    await db.todos.delete(task.id)
  }
  function drop(col: KanbanCol) {
    const task = tasks.find(t => t.id === dragging)
    if (task && (task.kanbanStatus ?? 'todo') !== col) void moveTask(task, col)
    setDragging(null)
    setOver(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <h2 style={heading}>Tasks</h2>
        {tasks.length > 0 && <span style={{ fontSize: 12, color: 'var(--wa-text-2)' }}>{done} of {tasks.length} done</span>}
      </div>
      {tasks.length > 0 && (
        <div role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={tasks.length} aria-label="Tasks done" style={{ height: 8, borderRadius: 999, background: 'var(--wa-fill)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ width: `${done / tasks.length * 100}%`, height: '100%', borderRadius: 999, background: 'var(--accent)' }} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
        {COLUMNS.map(col => (
          <div key={col.key} onDragOver={e => { if (dragging == null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(col.key) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(o => o === col.key ? null : o) }}
            onDrop={e => { e.preventDefault(); drop(col.key) }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: narrow ? undefined : 220, borderRadius: 14, borderTop: `4px solid ${COLUMN_RULE[col.key]}`, padding: '12px 12px 10px', background: over === col.key ? 'var(--wa-fill)' : 'var(--wa-fill-2)', outline: over === col.key ? '2px dashed var(--wa-ink)' : 'none', outlineOffset: -2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 2px 4px' }}>
              <span style={{ fontFamily: 'Recoleta, serif', fontSize: 17, color: 'var(--wa-ink)' }}>{col.label}</span>
              <span style={{ fontFamily: 'Recoleta, serif', fontSize: 17, color: 'var(--wa-muted)' }}>{byCol(col.key).length}</span>
            </div>
            {byCol(col.key).map(task => (
              <TaskCard key={task.id} task={task} narrow={narrow} onMove={s => void moveTask(task, s)} onDelete={() => void deleteTask(task)} onDrag={setDragging} />
            ))}
            {addingIn === col.key && (
              <AddTaskInline projectId={projectId} deptId={deptId} col={col.key} onDone={() => setAddingIn(null)} />
            )}
            {col.key !== 'done' && addingIn !== col.key && (
              <button onClick={() => setAddingIn(col.key)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', padding: '6px 2px', textAlign: 'left', fontFamily: 'inherit' }}>
                + Add task
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pid = Number(id)
  const dept = useActiveDept()
  const narrow = useNarrow()

  const project = useLiveQuery(() => db.projects.get(pid), [pid])
  const { acts, multi, mode, name } = usePractice()
  const [practice, setPractice] = useState<Activity | undefined>()
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
    setPractice(project!.practice)
    setFields(projectFieldsFromRecord(project!))
    setEditing(true)
  }

  async function saveEdit() {
    const projectType = type === 'Other' ? (customType.trim() || 'Other') : type
    const f = fields
    await db.projects.update(pid, {
      title: title.trim() || project!.title,
      projectType, status, notes, practice,
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
    await db.opportunities.filter(o => !!o.projectIds?.includes(pid)).modify(o => { o.projectIds = o.projectIds!.filter(x => x !== pid) })
    await db.projects.delete(pid)
    navigate('/projects', { replace: true })
  }

  return (
    <Shell>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: narrow ? '22px 18px' : '30px 36px' }}>
        <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', padding: 0, marginBottom: 20, letterSpacing: '0.06em' }}>
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
              {multi && (
                <Field label="Practice">
                  <PracticeSelect value={practice ?? practiceOf(acts).project({ projectType: type })} onChange={setPractice} style={inp} />
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
              <button onClick={() => void saveEdit()} style={{ background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setEditing(false); setConfirmDelete(false) }} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                {confirmDelete ? <>
                  <span style={{ fontSize: 12, color: 'var(--wa-text-2)' }}>Delete this project?</span>
                  <button onClick={() => void deleteProject()} style={{ background: '#C53030', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer' }}>Keep</button>
                </> : <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer' }}>Delete project</button>}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: narrow ? 30 : 38, lineHeight: 1.1, fontWeight: 400, margin: '0 0 8px', color: 'var(--wa-ink)', textWrap: 'balance' }}>{project.title}</h1>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {project.projectType && <span style={{ fontSize: 11, color: 'var(--wa-muted)' }}>{project.projectType}</span>}
                  {multi && mode === 'together' && <span style={{ fontFamily: 'Recoleta, serif', fontStyle: 'italic', fontSize: 14, color: 'var(--wa-text-2)' }}>{name(practiceOf(acts).project(project))}</span>}
                  {project.status && <span style={{ fontSize: 11, background: 'var(--wa-fill)', borderRadius: 999, padding: '2px 10px', color: 'var(--wa-text-2)' }}>{project.status}</span>}
                </div>
              </div>
              <button onClick={startEdit} style={{ background: 'var(--wa-fill)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 10, color: 'var(--wa-text-2)', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>Edit</button>
            </div>

            <ProjectMeta p={project} />

            <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: narrow ? 28 : 40, marginBottom: 36, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
                <div>
                  <h2 style={{ ...heading, marginBottom: 8 }}>Notes</h2>
                  {project.notes
                    ? <p style={{ fontSize: 14, color: 'var(--wa-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{project.notes}</p>
                    : <button onClick={startEdit} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add notes</button>}
                </div>
                {project.id != null && <ProjectSubmissions projectId={project.id} deptId={dept?.id} labelStyle={heading} />}
              </div>
              {project.id != null && <PeopleCard kind="project" id={project.id} deptId={dept?.id} labelStyle={heading} />}
            </div>

            {project.id != null && <KanbanBoard projectId={project.id} deptId={dept?.id} />}
          </>
        )}
      </div>
    </Shell>
  )
}
