import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Board, type BoardItem, type EventEntry, type Opportunity, type Project, type Todo } from '../../db/db'
import { isActive, projectDate, projectSubtitle } from '../../lib/projects'
import { formatEventDate, isUpcoming } from '../../lib/eventDates'
import { fileToDataUrl } from '../../lib/images'
import { practiceOf, usePractice } from '../../lib/practice'
import type { Activity } from '../../db/db'

type DeskType = 'project' | 'tasks' | 'list' | 'submission' | 'comingup' | 'note' | 'quote' | 'image' | 'title'
type Picker = 'project' | 'tasks' | 'submission' | 'earlier' | null
type DragMode = 'move' | 'resize'
interface Slot { col: number; span: number; y: number; h: number }
interface Box { left: number; top: number; width: number; height: number }
interface Live extends Box { id: number; mode: DragMode }
interface DragData extends Box { id: number; mode: DragMode; sx: number; sy: number; moved: boolean }
// `tasks` marks a list made as a Tasks box: its own tasks, in the yellow of the Tasks overview.
interface ListData { title: string; items: Array<{ id: string; text: string; done: boolean }>; tasks?: boolean }

// Desk blocks store their column in x (0 to 3) and their width in columns in w (1 to 4).
const GRID = 24
const COLS = 4
const PAD = 24
const GAP = 24
const NARROW = '(max-width: 900px)'
const INTERACTIVE = 'input,textarea,button,a,label,select,[data-nodrag]'
const TEXT_TYPES: DeskType[] = ['note', 'quote', 'title']
const CONFIRM_TYPES: DeskType[] = ['list', 'note', 'quote', 'image', 'title']
// These boxes only show something kept elsewhere, so removing one loses nothing.
const LINKED_TYPES: DeskType[] = ['project', 'submission', 'tasks', 'comingup']

const SPAN: Record<DeskType, { span: number; h: number }> = {
  project: { span: 1, h: 176 },
  tasks: { span: 1, h: 320 },
  list: { span: 1, h: 200 },
  submission: { span: 1, h: 112 },
  comingup: { span: 1, h: 300 },
  note: { span: 1, h: 96 },
  quote: { span: 1, h: 112 },
  image: { span: 1, h: 200 },
  title: { span: 1, h: 56 },
}

const cardStyle: React.CSSProperties = { background: 'var(--wa-surface)', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }
const smallLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)' }
const plainBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }
const bareInput: React.CSSProperties = { border: 'none', outline: 'none', background: 'none', padding: 0, width: '100%', font: 'inherit', color: 'var(--wa-ink)' }

// ── helpers ───────────────────────────────────────────────────────────────────

const snap = (n: number) => Math.max(0, Math.round(n / GRID) * GRID)
const pad = (n: number) => String(n).padStart(2, '0')
const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const notSent = (o: Opportunity) => o.status === 'Active' || o.status === 'Draft'
const byDue = (a: Todo, b: Todo) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
const uid = () => Math.random().toString(36).slice(2, 10)

function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function daysUntil(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((parseDay(iso).getTime() - today.getTime()) / 86400000)
}

function fmtDay(iso: string) {
  return parseDay(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function dueLabel(iso?: string): { text: string; overdue: boolean } | null {
  if (!iso) return null
  const n = daysUntil(iso)
  if (n < 0) return { text: 'Overdue', overdue: true }
  if (n === 0) return { text: 'Today', overdue: false }
  if (n < 7) return { text: parseDay(iso).toLocaleDateString('en-GB', { weekday: 'short' }), overdue: false }
  return { text: fmtDay(iso), overdue: false }
}

function parseList(content: string): ListData {
  try {
    const d = JSON.parse(content) as Partial<ListData>
    return { title: d.title ?? 'List', items: Array.isArray(d.items) ? d.items : [], tasks: d.tasks }
  } catch {
    return { title: 'List', items: [] }
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function findFreeSlot(slots: Slot[], span: number, h: number) {
  for (let y = GRID; y < 8000; y += GRID) {
    for (let col = 0; col + span <= COLS; col++) {
      const clash = slots.some(o => col < o.col + o.span && col + span > o.col && y < o.y + o.h + GRID && y + h + GRID > o.y)
      if (!clash) return { col, y }
    }
  }
  return { col: 0, y: GRID }
}

// Blocks never overlap: in each column they stack in order, always one GAP apart.
// `key` decides the order; the result is each block's top.
function pack(blocks: Array<{ id: number; col: number; span: number; key: number; h: number }>) {
  const bottom = Array<number>(COLS).fill(PAD - GAP)
  const tops = new Map<number, number>()
  for (const b of [...blocks].sort((a, c) => a.key - c.key || a.col - c.col || a.id - c.id)) {
    const top = Math.max(...bottom.slice(b.col, b.col + b.span)) + GAP
    for (let c = b.col; c < b.col + b.span; c++) bottom[c] = top + b.h
    tops.set(b.id, top)
  }
  return tops
}

// ── blocks ────────────────────────────────────────────────────────────────────

function ComingUpBlock({ events, opps }: { events: EventEntry[]; opps: Opportunity[] }) {
  const navigate = useNavigate()
  const month = localISO().slice(0, 7)
  const today = localISO()
  type Row = { key: string; date: string; title: string; sub: string; urgent?: boolean; go: () => void }
  const rows: Row[] = [
    ...events.filter(e => isUpcoming(e, month)).map(e => ({
      key: `e${e.id}`, date: e.date ?? '', title: e.title,
      sub: [e.type, e.location].filter(Boolean).join(' · ') + (e.endDate ? `, until ${formatEventDate(e.endDate, undefined, { year: false })}` : ''),
      go: () => navigate('/projects/events'),
    })),
    ...opps.filter(o => notSent(o) && o.deadline && o.deadline >= today).map(o => {
      const n = daysUntil(o.deadline!)
      return { key: `s${o.id}`, date: o.deadline!, title: o.title, sub: n === 0 ? 'Deadline today' : `Deadline in ${n} days`, urgent: n <= 7, go: () => navigate('/opportunities') }
    }),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  return (
    <div style={{ padding: '16px 18px 8px', color: '#FFFFFF' }}>
      <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15 }}>Coming up</span>
      {rows.length === 0 && <p style={{ fontSize: 12, color: '#9A9A9A', margin: '10px 0' }}>Nothing scheduled</p>}
      <div style={{ marginTop: 6 }}>
        {rows.map(r => {
          const d = parseDay(r.date.length === 7 ? `${r.date}-01` : r.date)
          return (
            <button key={r.key} onClick={r.go}
              style={{ ...plainBtn, display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 0', borderTop: '1px solid #2A2A2A', color: '#FFFFFF' }}>
              <span style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
                <span style={{ display: 'block', fontFamily: 'Recoleta, serif', fontSize: 19, lineHeight: 1 }}>{r.date.length === 7 ? '' : d.getDate()}</span>
                <span style={{ display: 'block', marginTop: 3, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B3B3B3' }}>{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
              </span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
                  {r.urgent && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                </span>
                <span style={{ fontSize: 10, color: r.urgent ? 'var(--accent)' : '#B3B3B3' }}>{r.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Ticking keeps a task in view with a line through it until it is cleared.
function toggleTask(t: Todo) {
  if (t.done) { void db.todos.update(t.id!, { done: false, kanbanStatus: 'todo', ticked: undefined }); return }
  void db.todos.update(t.id!, { done: true, kanbanStatus: 'done', ticked: true })
  window.dispatchEvent(new Event('wa:task-done'))
}

const PROJECT_TASKS = 6

function ProjectBlock({ p, todos, compact, onOpen, practice }: { p: Project; todos: Todo[]; compact: boolean; onOpen: () => void; practice?: string }) {
  const mine = todos.filter(t => t.projectId === p.id)
  const done = mine.filter(t => t.done).length
  const list = mine.filter(t => !t.done || t.ticked).sort(byDue)
  const ticked = list.filter(t => t.done)
  const sub = projectSubtitle(p)
  const date = projectDate(p)
  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', minHeight: compact ? undefined : 168 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={smallLabel}>{p.projectType ?? 'Project'}</span>
          {practice && <span style={{ fontFamily: 'Recoleta, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--wa-text-2)' }}>{practice}</span>}
        </span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
      </div>
      <button onClick={onOpen} style={{ ...plainBtn, fontFamily: 'Recoleta, serif', fontSize: 17, lineHeight: 1.3, color: 'var(--wa-ink)' }}>{p.title}</button>
      {sub && <div style={{ fontSize: 11, color: 'var(--wa-muted)', marginTop: 3 }}>{sub}</div>}
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {list.slice(0, PROJECT_TASKS).map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.35, color: t.done ? 'var(--wa-muted)' : 'var(--wa-ink)', textDecoration: t.done ? 'line-through' : undefined, cursor: 'pointer' }}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} style={{ accentColor: 'var(--wa-ink)', width: 13, height: 13, margin: '1px 0 0', flexShrink: 0, cursor: 'pointer' }} />
                {t.title}
              </label>
            ))}
            {list.length > PROJECT_TASKS && <button onClick={onOpen} style={{ ...plainBtn, fontSize: 11, color: 'var(--wa-muted)' }}>{list.length - PROJECT_TASKS} more</button>}
            {ticked.length > 0 && (
              <button onClick={() => void db.todos.where('id').anyOf(ticked.map(t => t.id!)).modify({ ticked: undefined })}
                style={{ ...plainBtn, fontSize: 11, color: 'var(--wa-text-2)' }}>Clear completed</button>
            )}
          </div>
        )}
        {mine.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--wa-fill-2)', overflow: 'hidden' }}>
              <div style={{ width: `${(done / mine.length) * 100}%`, height: '100%', background: 'var(--wa-ink)' }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--wa-muted)' }}>{done}/{mine.length}</span>
          </div>
        ) : date ? <div style={{ fontSize: 10, color: 'var(--wa-muted)' }}>{date}</div> : null}
      </div>
    </div>
  )
}

// A Tasks box shows every task, one project's tasks, or a named list of its own, over a span of time.
type TaskRange = 'today' | 'week' | 'overdue' | 'all'
const TASK_RANGES: Array<[TaskRange, string, string]> = [
  ['today', 'Today', 'Nothing due today'],
  ['week', 'This week', 'Nothing due this week'],
  ['overdue', 'Overdue', 'Nothing overdue'],
  ['all', 'All open', 'No open tasks'],
]
interface TaskBox { range: TaskRange; projectId?: number; name?: string; list?: string }

function parseTaskBox(content: string): TaskBox {
  if (content === 'week' || content === 'all') return { range: content }
  try { return { range: 'week', ...(JSON.parse(content) as Partial<TaskBox>) } } catch { return { range: 'week' } }
}

function DueDate({ task }: { task: Todo }) {
  const ref = useRef<HTMLInputElement>(null)
  const due = dueLabel(task.dueDate)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => { try { ref.current?.showPicker() } catch { ref.current?.focus() } }}
        style={{ ...plainBtn, fontSize: 10, ...(due?.overdue ? { color: 'var(--wa-red)', fontWeight: 600 } : {}) }}>
        {due?.text ?? 'Add date'}
      </button>
      <input ref={ref} type="date" value={task.dueDate ?? ''} aria-label={`Due date for ${task.title}`} tabIndex={-1}
        onChange={e => void db.todos.update(task.id!, { dueDate: e.target.value || undefined })}
        style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, padding: 0, border: 'none', opacity: 0, pointerEvents: 'none' }} />
    </span>
  )
}

function TasksBlock({ item, todos, projects, lists, deptId, practice }: { item: BoardItem; todos: Todo[]; projects: Project[]; lists: Record<string, string>; deptId: number; practice?: Activity }) {
  const [draft, setDraft] = useState('')
  const box = parseTaskBox(item.content)
  const boxProject = box.projectId != null ? projects.find(p => p.id === box.projectId) : undefined
  const today = localISO()
  const weekEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return localISO(d) })()
  const inRange = (t: Todo) =>
    box.range === 'all' ? true
    : box.range === 'overdue' ? !!t.dueDate && t.dueDate < today
    : box.range === 'today' ? !!t.dueDate && t.dueDate <= today
    : !t.dueDate || t.dueDate <= weekEnd
  const inBox = (t: Todo) => box.projectId != null ? t.projectId === box.projectId : box.list ? t.taskList === box.list : true
  // Ticked tasks stay where they are, with a line through them, until cleared.
  const open = todos.filter(t => (!t.done || t.ticked) && inBox(t) && inRange(t)).sort(byDue)
  const shown = open.slice(0, 8)
  const ticked = open.filter(t => t.done)
  const save = (next: Partial<TaskBox>) => db.boardItems.update(item.id!, { content: JSON.stringify({ ...box, ...next }) })

  async function add() {
    const title = draft.trim()
    if (!title) return
    await db.todos.add({
      departmentId: deptId, title, done: false, kanbanStatus: 'todo',
      projectId: box.projectId, taskList: box.list, practice: box.projectId == null ? practice : undefined,
      // So it stays in view in a box that only shows today.
      dueDate: box.range === 'today' ? today : undefined,
    })
    setDraft('')
  }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        {box.list
          ? <input value={box.name ?? ''} onChange={e => void save({ name: e.target.value })} aria-label="List name" placeholder="Name"
              style={{ ...bareInput, flex: 1, minWidth: 0, fontFamily: 'Recoleta, serif', fontSize: 15 }} />
          : <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: 'var(--wa-ink)', minWidth: 0 }}>{boxProject?.title ?? 'Tasks'}</span>}
        <select value={box.range} onChange={e => void save({ range: e.target.value as TaskRange })} aria-label="Show"
          style={{ appearance: 'none', flexShrink: 0, fontSize: 10, color: 'var(--wa-text)', background: 'rgba(0,0,0,.08)', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {TASK_RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {shown.length === 0 && (
        <p style={{ fontSize: 12, color: 'rgba(0,0,0,.55)', margin: '8px 0' }}>{TASK_RANGES.find(([value]) => value === box.range)?.[2]}</p>
      )}
      {shown.map(t => {
        const where = box.projectId != null || box.list ? undefined
          : t.projectId != null ? projects.find(p => p.id === t.projectId)?.title
          : t.taskList ? lists[t.taskList] : undefined
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.1)' }}>
            <input id={`task-${item.id}-${t.id}`} type="checkbox" checked={t.done}
              onChange={() => toggleTask(t)}
              style={{ accentColor: 'var(--wa-ink)', width: 14, height: 14, margin: '2px 0 0', flexShrink: 0, cursor: 'pointer' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <label htmlFor={`task-${item.id}-${t.id}`} style={{ fontSize: 12, color: t.done ? 'rgba(0,0,0,.62)' : 'var(--wa-ink)', textDecoration: t.done ? 'line-through' : undefined, cursor: 'pointer' }}>{t.title}</label>
              <span style={{ fontSize: 10, color: 'rgba(0,0,0,.62)' }}>
                {where && `${where} · `}<DueDate task={t} />
              </span>
            </span>
          </div>
        )
      })}
      {open.length > shown.length && <p style={{ fontSize: 10, color: 'rgba(0,0,0,.55)', margin: '8px 0 0' }}>{open.length - shown.length} more</p>}
      {ticked.length > 0 && (
        <button onClick={() => void db.todos.where('id').anyOf(ticked.map(t => t.id!)).modify({ ticked: undefined })}
          style={{ ...plainBtn, display: 'block', fontSize: 11, color: 'rgba(0,0,0,.7)', marginTop: 8 }}>Clear completed</button>
      )}
      {box.range !== 'overdue' && (
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add() }}
          placeholder="+ Add task" aria-label="Add task"
          style={{ ...bareInput, fontSize: 11.5, marginTop: 10 }} />
      )}
    </div>
  )
}

function ListBlock({ item }: { item: BoardItem }) {
  const data = parseList(item.content)
  const [draft, setDraft] = useState('')
  const save = (d: ListData) => db.boardItems.update(item.id!, { content: JSON.stringify(d) })

  function addItem() {
    const text = draft.trim()
    if (!text) return
    void save({ ...data, items: [...data.items, { id: uid(), text, done: false }] })
    setDraft('')
  }

  return (
    <div style={{ padding: '16px 18px' }}>
      <input key={data.title} defaultValue={data.title} aria-label="List title"
        onBlur={e => { const v = e.target.value.trim() || 'List'; if (v !== data.title) void save({ ...data, title: v }) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        style={{ ...bareInput, fontFamily: 'Recoleta, serif', fontSize: 15, marginBottom: 6 }} />
      {data.items.map(it => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12, color: it.done ? (data.tasks ? 'rgba(0,0,0,.62)' : 'var(--wa-muted)') : 'var(--wa-text)', textDecoration: it.done ? 'line-through' : 'none', cursor: 'pointer' }}>
            <input type="checkbox" checked={it.done}
              onChange={() => void save({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, done: !x.done } : x) })}
              style={{ accentColor: 'var(--wa-ink)', width: 14, height: 14, margin: 0, flexShrink: 0 }} />
            {it.text}
          </label>
          <button aria-label={`Remove ${it.text}`} onClick={() => void save({ ...data, items: data.items.filter(x => x.id !== it.id) })}
            style={{ ...plainBtn, fontSize: 12, color: data.tasks ? 'rgba(0,0,0,.62)' : 'var(--wa-muted)', padding: '2px 4px' }}>×</button>
        </div>
      ))}
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem() }}
        placeholder={data.tasks ? '+ Add task' : '+ Add item'} aria-label={data.tasks ? 'Add task' : 'Add item'}
        style={{ ...bareInput, fontSize: 11.5, marginTop: 8 }} />
      {data.items.some(it => it.done) && (
        <button onClick={() => void save({ ...data, items: data.items.filter(it => !it.done) })}
          style={{ ...plainBtn, display: 'block', fontSize: 11, color: data.tasks ? 'rgba(0,0,0,.7)' : 'var(--wa-text-2)', marginTop: 8 }}>Clear completed</button>
      )}
    </div>
  )
}

function SubmissionBlock({ o }: { o: Opportunity }) {
  const n = o.deadline && notSent(o) ? daysUntil(o.deadline) : null
  let badge: { text: string; color: string; bg: string } | null = null
  if (n !== null && n < 0) badge = { text: 'Overdue', color: 'var(--wa-red)', bg: 'rgba(224,82,82,.12)' }
  else if (n !== null && n <= 2) badge = { text: n === 0 ? 'Today' : `${n}d`, color: 'var(--wa-red)', bg: 'rgba(224,82,82,.12)' }
  else if (n !== null && n <= 7) badge = { text: `${n}d`, color: 'var(--wa-amber)', bg: 'rgba(240,160,32,.14)' }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={smallLabel}>Submission</span>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wa-muted)', border: '1px solid var(--wa-line)', borderRadius: 999, padding: '3px 8px' }}>{o.status}</span>
      </div>
      <div style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: 'var(--wa-ink)' }}>{o.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>{o.deadline ? `Deadline ${fmtDay(o.deadline)}` : 'No deadline'}</span>
        {badge && <span style={{ fontSize: 9, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 4, padding: '1px 6px' }}>{badge.text}</span>}
      </div>
    </div>
  )
}

const TEXT_LOOK: Record<string, React.CSSProperties> = {
  note: { padding: '14px 16px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--wa-text)' },
  quote: { padding: '20px 22px', fontFamily: 'Recoleta, serif', fontSize: 20, lineHeight: 1.3, color: 'var(--accent)' },
  title: { padding: '2px 4px', fontFamily: 'Recoleta, serif', fontSize: 34, lineHeight: 1.15, color: 'var(--wa-ink)' },
}
const TEXT_PLACEHOLDER: Record<string, string> = { note: 'Note', quote: 'Quote', title: 'Heading' }

function TextEditor({ item, onDone }: { item: BoardItem; onDone: (text: string) => void }) {
  const [text, setText] = useState(item.content)
  return (
    <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
      onBlur={() => onDone(text)}
      onKeyDown={e => {
        if (e.key === 'Escape' || (e.key === 'Enter' && item.itemType === 'title')) { e.preventDefault(); e.currentTarget.blur() }
      }}
      placeholder={TEXT_PLACEHOLDER[item.itemType]} aria-label={TEXT_PLACEHOLDER[item.itemType]}
      rows={Math.max(item.itemType === 'title' ? 1 : 2, text.split('\n').length)}
      style={{ ...TEXT_LOOK[item.itemType], display: 'block', width: '100%', border: 'none', outline: 'none', background: 'none', resize: 'none', boxSizing: 'border-box' }} />
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 24, width: 420, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ ...smallLabel, color: 'var(--wa-muted)' }}>{title}</span>
          <button onClick={onClose} style={{ ...plainBtn, fontSize: 12, color: 'var(--wa-muted)' }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PickRow({ title, sub, onClick }: { title: string; sub?: string | null; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...plainBtn, display: 'flex', alignItems: 'baseline', gap: 10, width: '100%', padding: '11px 0', borderBottom: '1px solid var(--wa-line)' }}>
      <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: 'var(--wa-ink)', flex: 1 }}>{title}</span>
      {sub && <span style={{ fontSize: 10, color: 'var(--wa-muted)', flexShrink: 0 }}>{sub}</span>}
    </button>
  )
}

// ── desk ──────────────────────────────────────────────────────────────────────

export function Desk({ deptId, onNewProject }: { deptId: number; onNewProject: () => void }) {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragData | null>(null)
  const [live, setLive] = useState<Live | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [picker, setPicker] = useState<Picker>(null)
  const [listName, setListName] = useState('')
  const [canvasH, setCanvasH] = useState(600)
  const [heights, setHeights] = useState<Record<number, number>>({})
  const [deskW, setDeskW] = useState(0)
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  const [minimised, setMinimised] = useState(() => {
    try { return localStorage.getItem('desk-toolbar-min') === '1' } catch { return false }
  })

  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = canvasRef.current
    if (!el || narrow) return
    const ro = new ResizeObserver(() => setDeskW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [narrow])

  const colW = Math.max(120, (deskW - 2 * PAD - (COLS - 1) * GAP) / COLS)
  const colLeft = (c: number) => PAD + c * (colW + GAP)
  const spanWidth = (n: number) => n * colW + (n - 1) * GAP
  const colAt = (left: number, span: number) => clamp(Math.round((left - PAD) / (colW + GAP)), 0, COLS - span)
  const spanFor = (width: number, col: number) => clamp(Math.round((width + GAP) / (colW + GAP)), 1, COLS - col)
  const isLegacy = (i: BoardItem) => i.w > COLS

  const board = useLiveQuery(
    async () => (await db.boards.where('departmentId').equals(deptId).filter(b => b.boardType === 'desk').first()) ?? null,
    [deptId],
  )
  const boardId = board?.id
  const items = useLiveQuery(
    async () => boardId == null ? undefined : await db.boardItems.where('boardId').equals(boardId).toArray(),
    [boardId],
  )
  // Every project keeps its box; in Separate mode the desk only shows the practice in view.
  const { acts, multi, mode, current, keep, name } = usePractice()
  // In Separate mode new boxes and tasks belong to the practice in view; in Together they're shared.
  const stamp = mode === 'separate' ? current ?? undefined : undefined
  const allProjects = useLiveQuery(() => db.projects.where('departmentId').equals(deptId).toArray(), [deptId])
  const allWorks = useLiveQuery(() => db.works.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const of = practiceOf(acts, allWorks)
  const projects = allProjects?.filter(p => keep(of.project(p)))
  const todos = (useLiveQuery(() => db.todos.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []).filter(t => {
    const p = t.projectId != null ? allProjects?.find(x => x.id === t.projectId) : undefined
    return p ? keep(of.project(p)) : !t.practice || keep(t.practice)
  })
  const opps = (useLiveQuery(() => db.opportunities.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []).filter(o => keep(of.opportunity(o)))
  const events = (useLiveQuery(() => db.eventEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []).filter(e => of.eventAll(e).some(keep))

  function slotOf(i: BoardItem): Slot {
    const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${i.id}"]`)
    return { col: i.x, span: i.w, y: i.y, h: el && !narrow ? el.offsetHeight : i.h }
  }

  // First visit: create the desk with Coming up, Tasks and every active project.
  useEffect(() => {
    if (board !== null || allProjects === undefined) return
    void db.transaction('rw', db.boards, db.boardItems, async () => {
      const existing = await db.boards.where('departmentId').equals(deptId).filter(b => b.boardType === 'desk').first()
      if (existing) return
      const id = await db.boards.add({ departmentId: deptId, name: 'Desk', boardType: 'desk', createdAt: Date.now() }) as number
      const now = Date.now()
      const seed: BoardItem[] = [
        { boardId: id, itemType: 'comingup', content: '', x: 3, y: 24, w: 1, h: 300, createdAt: now },
        { boardId: id, itemType: 'tasks', content: 'week', x: 2, y: 24, w: 1, h: 320, createdAt: now },
      ]
      allProjects.filter(isActive).forEach((p, i) => {
        seed.push({ boardId: id, itemType: 'project', content: String(p.id), x: i % 2, y: 24 + Math.floor(i / 2) * 216, w: 1, h: 176, createdAt: now })
      })
      await db.boardItems.bulkAdd(seed)
    })
  }, [board, allProjects, deptId])

  // Desks laid out before columns existed: move each block to its nearest column.
  useEffect(() => {
    if (!items || deskW === 0 || narrow) return
    const legacy = items.filter(isLegacy)
    if (legacy.length === 0) return
    void db.transaction('rw', db.boardItems, async () => {
      for (const i of legacy) {
        const col = colAt(i.x, 1)
        await db.boardItems.update(i.id!, { x: col, w: spanFor(i.w, col) })
      }
    })
  }, [items, deskW, narrow])

  useEffect(() => {
    if (!items || narrow) return
    const strips = items.filter(i => i.itemType === 'comingup' && i.w > 1 && !isLegacy(i))
    if (strips.length === 0) return
    void db.transaction('rw', db.boardItems, async () => {
      for (const strip of strips) {
        const grow = 260
        for (const o of items) {
          if (o.id === strip.id || isLegacy(o) || o.y <= strip.y) continue
          if (o.x <= strip.x && strip.x < o.x + o.w) await db.boardItems.update(o.id!, { y: o.y + grow })
        }
        await db.boardItems.update(strip.id!, { w: 1, h: 300 })
      }
    })
  }, [items, narrow])

  // Keep the desk in step with projects: new active ones get a card, deleted ones lose theirs.
  useEffect(() => {
    const projects = allProjects
    if (!board || board.id == null || !items || !projects) return
    const deskId = board.id
    const onDesk = new Set(items.filter(i => i.itemType === 'project').map(i => i.content))
    const hidden = new Set(board.hiddenProjectIds ?? [])
    const missing = projects.filter(p => p.id != null && isActive(p) && !onDesk.has(String(p.id)) && !hidden.has(p.id))
    const orphans = items.filter(i => i.itemType === 'project' && !projects.some(p => String(p.id) === i.content))
    if (missing.length === 0 && orphans.length === 0) return
    void db.transaction('rw', db.boardItems, db.boards, async () => {
      if (orphans.length) await db.boardItems.bulkDelete(orphans.map(o => o.id!))
      const current = await db.boardItems.where('boardId').equals(deskId).toArray()
      const have = new Set(current.filter(i => i.itemType === 'project').map(i => i.content))
      // Read again here: a card just removed may not have reached this render's copy of the board yet.
      const removed = new Set((await db.boards.get(deskId))?.hiddenProjectIds ?? [])
      const slots = current.filter(i => !isLegacy(i)).map(slotOf)
      for (const p of missing) {
        if (have.has(String(p.id)) || removed.has(p.id!)) continue
        const pos = findFreeSlot(slots, 1, 176)
        slots.push({ col: pos.col, span: 1, y: pos.y, h: 176 })
        await db.boardItems.add({ boardId: deskId, itemType: 'project', content: String(p.id), x: pos.col, y: pos.y, w: 1, h: 176, createdAt: Date.now() })
      }
    })
  }, [board, items, allProjects])

  // The canvas grows to fit its lowest block.
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el || narrow) return
    let bottom = 0
    const hs: Record<number, number> = {}
    el.querySelectorAll<HTMLElement>('[data-block-id]').forEach(b => {
      bottom = Math.max(bottom, b.offsetTop + b.offsetHeight)
      hs[Number(b.dataset.blockId)] = b.offsetHeight
    })
    const h = Math.max(560, bottom + 160)
    if (h !== canvasH) setCanvasH(h)
    if (Object.keys(hs).some(id => hs[Number(id)] !== heights[Number(id)])) setHeights(hs)
  })

  const visible = (items ?? []).filter(i => {
    if (i.hidden) return false
    if (!narrow && isLegacy(i)) return false
    if (i.itemType === 'project') {
      const p = projects?.find(x => String(x.id) === i.content)
      return !!p && isActive(p)
    }
    if (i.itemType === 'submission') return opps.some(o => String(o.id) === i.content)
    if (i.itemType === 'tasks') {
      const { projectId } = parseTaskBox(i.content)
      if (projectId != null && !projects?.some(p => p.id === projectId)) return false
    }
    return !i.practice || keep(i.practice)
  })
  const hiddenItems = (items ?? []).filter(i => i.hidden && (i.itemType === 'project' ? projects?.some(p => String(p.id) === i.content) : i.itemType === 'submission' ? opps.some(o => String(o.id) === i.content) : !i.practice || keep(i.practice)))
  function labelOf(i: BoardItem): string {
    switch (i.itemType) {
      case 'project': return projects?.find(p => String(p.id) === i.content)?.title ?? 'Project'
      case 'submission': return opps.find(o => String(o.id) === i.content)?.title ?? 'Submission'
      case 'tasks': {
        const box = parseTaskBox(i.content)
        return box.name || projects?.find(p => p.id === box.projectId)?.title || 'Tasks'
      }
      case 'comingup': return 'Coming up'
      case 'list': return parseList(i.content).title
      case 'image': return i.content || 'Image'
      case 'quote': return i.content ? `“${i.content.slice(0, 40)}${i.content.length > 40 ? '…' : ''}”` : 'Quote'
      default: return i.content ? i.content.slice(0, 40) + (i.content.length > 40 ? '…' : '') : 'Note'
    }
  }
  // The names of the named Tasks boxes, so other boxes can say where a task comes from.
  const taskLists: Record<string, string> = {}
  for (const i of items ?? []) {
    if (i.itemType !== 'tasks') continue
    const box = parseTaskBox(i.content)
    if (box.list) taskLists[box.list] = box.name ?? ''
  }
  const [trayOpen, setTrayOpen] = useState(false)
  const [hintDone, setHintDone] = useState(() => {
    try { return localStorage.getItem('desk-hint-done') === '1' } catch { return false }
  })

  async function setHidden(item: BoardItem, hidden: boolean) {
    await db.boardItems.update(item.id!, { hidden: hidden || undefined } as Partial<BoardItem>)
    setHovered(null)
  }

  const ordered = narrow ? [...visible].sort((a, b) => a.y - b.y || a.x - b.x) : visible
  const pastProjects = (projects ?? []).filter(p => !isActive(p)).sort((a, b) => (b.dateEnd ?? '').localeCompare(a.dateEnd ?? ''))
  const projectIdsOnDesk = new Set((items ?? []).filter(i => i.itemType === 'project').map(i => i.content))
  const offDesk = (projects ?? []).filter(p => isActive(p) && !projectIdsOnDesk.has(String(p.id)))
  const subIdsOnDesk = new Set((items ?? []).filter(i => i.itemType === 'submission').map(i => i.content))
  const openSubs = opps.filter(o => !['Won', 'Rejected', 'Closed'].includes(o.status) && !subIdsOnDesk.has(String(o.id)))

  async function addBlock(type: DeskType, content = '', extra: Partial<BoardItem> = {}) {
    if (board?.id == null || !items) return
    const { span, h } = SPAN[type]
    const pos = findFreeSlot(items.filter(i => !isLegacy(i)).map(slotOf), span, h)
    const practice = type === 'project' || type === 'submission' ? undefined : stamp
    const id = await db.boardItems.add({ boardId: board.id, itemType: type, content, x: pos.col, y: pos.y, w: span, h, createdAt: Date.now(), practice, ...extra }) as number
    if (TEXT_TYPES.includes(type)) setEditingId(id)
    requestAnimationFrame(() => {
      canvasRef.current?.querySelector(`[data-block-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  async function removeBlock(item: BoardItem) {
    if (item.id == null) return
    const t = item.itemType as DeskType
    if (CONFIRM_TYPES.includes(t) && item.content && !window.confirm('Remove this block?')) return
    await db.transaction('rw', db.boardItems, db.boards, async () => {
      if (t === 'project' && board?.id != null) {
        const saved = await db.boards.get(board.id)
        const hidden = [...new Set([...(saved?.hiddenProjectIds ?? []), Number(item.content)])]
        await db.boards.update(board.id, { hiddenProjectIds: hidden } as Partial<Board>)
      }
      await db.boardItems.delete(item.id!)
    })
    setHovered(null)
  }

  async function restoreProject(p: Project) {
    setPicker(null)
    await addBlock('project', String(p.id))
    if (board?.id != null) {
      await db.boards.update(board.id, { hiddenProjectIds: (board.hiddenProjectIds ?? []).filter(id => id !== p.id) } as Partial<Board>)
    }
  }

  async function finishEdit(item: BoardItem, text: string) {
    setEditingId(null)
    const v = text.trim()
    if (!v) await db.boardItems.delete(item.id!)
    else if (v !== item.content) await db.boardItems.update(item.id!, { content: v })
  }

  function onBlockClick(item: BoardItem) {
    const t = item.itemType as DeskType
    if (t === 'project') navigate(`/projects/${item.content}`)
    else if (t === 'submission') navigate('/opportunities')
    else if (TEXT_TYPES.includes(t)) setEditingId(item.id!)
  }

  // ── dragging and resizing ─────────────────────────────────────────────────
  // The block itself holds the pointer, so a resize keeps going even when the handle moves away.
  function onPointerDown(e: React.PointerEvent<HTMLElement>, item: BoardItem, mode: DragMode) {
    if (narrow || e.button !== 0 || item.id == null || editingId === item.id) return
    if (mode === 'move' && (e.target as HTMLElement).closest(INTERACTIVE)) return
    e.stopPropagation()
    e.preventDefault()
    const block = e.currentTarget.closest<HTMLElement>('[data-block-id]') ?? e.currentTarget
    block.setPointerCapture(e.pointerId)
    dragRef.current = {
      id: item.id, mode, sx: e.clientX, sy: e.clientY, moved: false,
      left: colLeft(item.x), top: item.y, width: spanWidth(item.w), height: block.offsetHeight,
    }
  }

  function geometry(d: DragData, e: React.PointerEvent): Live {
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    return d.mode === 'move'
      ? { id: d.id, mode: d.mode, left: Math.max(0, d.left + dx), top: Math.max(0, d.top + dy), width: d.width, height: d.height }
      : { id: d.id, mode: d.mode, left: d.left, top: d.top, width: Math.max(colW, d.width + dx), height: Math.max(72, d.height + dy) }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
    d.moved = true
    setLive(geometry(d, e))
  }

  async function onPointerUp(e: React.PointerEvent, item: BoardItem) {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (!d.moved) {
      setLive(null)
      if (d.mode === 'move') onBlockClick(item)
      return
    }
    const g = geometry(d, e)
    if (!hintDone) {
      setHintDone(true)
      try { localStorage.setItem('desk-hint-done', '1') } catch { /* private mode */ }
    }
    if (d.mode === 'move') {
      // Store every block at its packed top, so the order on the desk is the order saved.
      const final = dropTops(d.id, g.left, g.top, d.height)
      await db.transaction('rw', db.boardItems, async () => {
        for (const i of visible) {
          const y = final.get(i.id!) ?? i.y
          if (i.id === d.id) await db.boardItems.update(d.id, { x: colAt(g.left, item.w), y })
          else if (y !== i.y) await db.boardItems.update(i.id!, { y })
        }
      })
      window.dispatchEvent(new Event('wa:card-moved'))
    } else {
      const upd: Partial<BoardItem> = { w: spanFor(g.width, item.x) }
      if (item.itemType === 'image') upd.h = snap(g.height)
      await db.boardItems.update(d.id, upd)
    }
    setLive(null)
  }

  function onPointerCancel() {
    dragRef.current = null
    setLive(null)
  }

  function toggleToolbar(min: boolean) {
    setMinimised(min)
    try { localStorage.setItem('desk-toolbar-min', min ? '1' : '0') } catch { /* private mode */ }
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const data = await fileToDataUrl(file)
    await addBlock('image', file.name, { imageData: data })
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  function blockShell(t: DeskType): React.CSSProperties {
    if (t === 'note' || t === 'tasks') return { ...cardStyle, background: 'var(--accent)' }
    if (t === 'quote' || t === 'comingup') return { ...cardStyle, background: 'var(--wa-black)' }
    if (t === 'title') return {}
    if (t === 'image') return { borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)', background: 'var(--wa-line)' }
    return cardStyle
  }

  function blockContent(item: BoardItem) {
    const t = item.itemType as DeskType
    switch (t) {
      case 'project': {
        const p = projects?.find(x => String(x.id) === item.content)
        return p ? <ProjectBlock p={p} todos={todos} compact={narrow} onOpen={() => navigate(`/projects/${p.id}`)} practice={multi && mode === 'together' ? name(of.project(p)) : undefined} /> : null
      }
      case 'tasks':
        return <TasksBlock item={item} todos={todos} projects={projects ?? []} lists={taskLists} deptId={deptId} practice={stamp} />
      case 'list':
        return <ListBlock item={item} />
      case 'submission': {
        const o = opps.find(x => String(x.id) === item.content)
        return o ? <SubmissionBlock o={o} /> : null
      }
      case 'comingup':
        return <ComingUpBlock events={events} opps={opps} />
      case 'image':
        return item.imageData
          ? <img src={item.imageData} alt={item.content || 'Image'} draggable={false}
              style={{ display: 'block', width: '100%', height: narrow ? 220 : '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          : null
      default:
        return editingId === item.id
          ? <TextEditor item={item} onDone={text => void finishEdit(item, text)} />
          : <div style={{ ...TEXT_LOOK[t], whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.content}</div>
    }
  }

  function renderBlock(item: BoardItem) {
    const t = item.itemType as DeskType
    const mine = live?.id === item.id ? live : null
    const ownTasks = t === 'list' && parseList(item.content).tasks
    const shell = ownTasks ? blockShell('tasks') : blockShell(t)
    const showRemove = (hovered === item.id || narrow) && !mine && editingId !== item.id
    const showHandle = !narrow && editingId !== item.id && ((hovered === item.id && !mine) || mine?.mode === 'resize')
    const imageHeight = mine ? mine.height : item.h
    const wrapper: React.CSSProperties = narrow
      ? { position: 'relative' }
      : {
          position: 'absolute', left: mine ? mine.left : colLeft(item.x), top: mine ? mine.top : tops.get(item.id!) ?? item.y,
          width: mine ? mine.width : spanWidth(item.w), zIndex: mine ? 30 : 1, touchAction: 'none',
          cursor: editingId === item.id ? 'auto' : mine?.mode === 'move' ? 'grabbing' : 'grab',
        }

    return (
      <div key={item.id} data-block-id={item.id} data-tour={`desk-${item.itemType}`} style={wrapper}
        onPointerDown={e => onPointerDown(e, item, 'move')}
        onPointerMove={onPointerMove}
        onPointerUp={e => void onPointerUp(e, item)}
        onPointerCancel={onPointerCancel}
        onPointerEnter={() => setHovered(item.id!)}
        onPointerLeave={() => setHovered(h => (h === item.id ? null : h))}
        onClick={narrow ? e => { if (!(e.target as HTMLElement).closest(INTERACTIVE)) onBlockClick(item) } : undefined}>
        <div className={t === 'note' || t === 'tasks' || ownTasks ? 'wa-light' : undefined} style={{ ...shell, height: t === 'image' && !narrow ? imageHeight : undefined, boxShadow: mine ? '0 12px 32px rgba(0,0,0,.14)' : shell.boxShadow }}>
          {blockContent(item)}
        </div>
        {showRemove && (
          <div style={{ position: 'absolute', top: -10, right: -8, display: 'flex', gap: 4, zIndex: 2 }}>
            <button aria-label="Hide this box" title="Hide" onClick={() => void setHidden(item, true)}
              style={{ width: narrow ? 22 : 24, height: narrow ? 22 : 24, borderRadius: 999, background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', boxShadow: narrow ? 'none' : '0 1px 4px rgba(0,0,0,.10)', opacity: narrow ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8s2.2-4.2 6-4.2S14 8 14 8s-2.2 4.2-6 4.2S2 8 2 8z" stroke="var(--wa-muted)" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="8" cy="8" r="1.8" stroke="var(--wa-muted)" strokeWidth="1.4" /><path d="M3 13L13 3" stroke="var(--wa-muted)" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
            <button aria-label={LINKED_TYPES.includes(t) ? 'Remove this box from the desk' : 'Delete this box'} title={LINKED_TYPES.includes(t) ? 'Remove from desk' : 'Delete'} onClick={() => void removeBlock(item)}
              style={{ width: narrow ? 22 : 24, height: narrow ? 22 : 24, borderRadius: 999, background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', boxShadow: narrow ? 'none' : '0 1px 4px rgba(0,0,0,.10)', opacity: narrow ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="var(--wa-muted)" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        {showHandle && (
          <div aria-hidden="true" onPointerDown={e => onPointerDown(e, item, 'resize')}
            style={t === 'image'
              ? { position: 'absolute', right: -5, bottom: -5, width: 10, height: 10, background: 'var(--wa-surface)', border: '1.5px solid var(--wa-ink)', borderRadius: 2, cursor: 'nwse-resize', touchAction: 'none', zIndex: 2 }
              : { position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 28, background: 'var(--wa-surface)', border: '1.5px solid var(--wa-ink)', borderRadius: 4, cursor: 'ew-resize', touchAction: 'none', zIndex: 2 }} />
        )}
      </div>
    )
  }

  // Where every block sits. While one is dragged, the others make room where it would land.
  const liveItem = live ? visible.find(i => i.id === live.id) : undefined
  const heightOf = (i: BoardItem) => heights[i.id!] ?? i.h
  const restTops = pack(visible.map(i => ({ id: i.id!, col: i.x, span: i.w, key: i.y, h: heightOf(i) })))
  const dropTops = (id: number, left: number, top: number, height: number) =>
    pack(visible.map(i => i.id === id
      ? { id, col: colAt(left, i.w), span: i.w, key: top, h: height }
      : { id: i.id!, col: i.x, span: i.w, key: restTops.get(i.id!) ?? i.y, h: heightOf(i) }))
  const tops = live?.mode === 'move' && liveItem ? dropTops(live.id, live.left, live.top, live.height) : restTops

  const preview = live && liveItem ? (() => {
    const top = tops.get(liveItem.id!) ?? liveItem.y
    if (live.mode === 'move') return { left: colLeft(colAt(live.left, liveItem.w)), top, width: spanWidth(liveItem.w), height: live.height }
    const span = spanFor(live.width, liveItem.x)
    return { left: colLeft(liveItem.x), top, width: spanWidth(span), height: liveItem.itemType === 'image' ? snap(live.height) : live.height }
  })() : null

  const earlierButton = pastProjects.length > 0 && (
    <button onClick={() => setPicker('earlier')}
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', borderRadius: 999, padding: '9px 14px', fontSize: 11, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit', width: 'fit-content', ...(narrow ? {} : { position: 'absolute', left: PAD, bottom: 20 }) }}>
      Earlier work
      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--wa-text-2)', background: 'var(--wa-fill)', borderRadius: 999, padding: '2px 6px' }}>{pastProjects.length}</span>
    </button>
  )

  const toolButtons: Array<{ label: string; run: () => void }> = [
    { label: 'Project', run: () => setPicker('project') },
    { label: 'Tasks', run: () => setPicker('tasks') },
    { label: 'List', run: () => void addBlock('list', JSON.stringify({ title: 'List', items: [] })) },
    { label: 'Submission', run: () => setPicker('submission') },
    { label: 'Coming up', run: () => void addBlock('comingup') },
    { label: 'Note', run: () => void addBlock('note') },
    { label: 'Quote', run: () => void addBlock('quote') },
    { label: 'Image', run: () => fileRef.current?.click() },
    { label: 'Heading', run: () => void addBlock('title') },
  ]

  const loaded = items !== undefined

  const topRow = hiddenItems.length > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
      {hiddenItems.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setTrayOpen(o => !o)} aria-expanded={trayOpen}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 14px', border: '1px solid var(--wa-line)', borderRadius: 999, background: 'var(--wa-surface)', color: 'var(--wa-ink)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Hidden boxes
            <span style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>{hiddenItems.length}</span>
          </button>
          {trayOpen && (
            <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 280, maxWidth: 'calc(100vw - 40px)', background: 'var(--wa-surface)', borderRadius: 14, boxShadow: '0 14px 44px rgba(0,0,0,.18)', padding: '12px 16px' }}>
              <p style={{ ...smallLabel, margin: '0 0 6px' }}>Hidden boxes</p>
              {hiddenItems.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid var(--wa-line)' }}>
                  <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(i)}</span>
                  <button onClick={() => { void removeBlock(i); if (hiddenItems.length === 1) setTrayOpen(false) }}
                    style={{ flexShrink: 0, marginLeft: 'auto', padding: 0, border: 'none', background: 'none', color: 'var(--wa-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{LINKED_TYPES.includes(i.itemType as DeskType) ? 'Remove' : 'Delete'}</button>
                  <button onClick={() => { void setHidden(i, false); if (hiddenItems.length === 1) setTrayOpen(false) }}
                    style={{ flexShrink: 0, minHeight: 30, padding: '0 12px', border: 'none', borderRadius: 999, background: 'var(--wa-black)', color: '#FFFFFF', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Show</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      {topRow}
      {narrow ? (
        <div ref={canvasRef} data-tour="desk" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 120 }}>
          {ordered.map(renderBlock)}
          {earlierButton}
        </div>
      ) : (
        <div ref={canvasRef} data-tour="desk"
          style={{ position: 'relative', height: canvasH, background: 'var(--wa-desk)', borderRadius: 20 }}>
          {live && Array.from({ length: COLS }, (_, c) => (
            <div key={c} aria-hidden="true"
              style={{ position: 'absolute', top: 12, bottom: 12, left: colLeft(c), width: colW, borderRadius: 12, background: 'rgba(0,0,0,.025)', pointerEvents: 'none' }} />
          ))}
          {preview && (
            <div aria-hidden="true"
              style={{ position: 'absolute', ...preview, borderRadius: 16, border: '1.5px dashed var(--wa-line)', background: 'rgba(0,0,0,.03)', pointerEvents: 'none' }} />
          )}
          {deskW > 0 && ordered.map(renderBlock)}
          {loaded && visible.length === 0 && (
            <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, fontSize: 12, color: 'var(--wa-muted)' }}>Nothing on the desk yet. Add a project from the toolbar below.</p>
          )}
          {earlierButton}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void onImagePicked(e)} />

      {/* Hint, just above the toolbar, until the first card is moved */}
      {!narrow && !hintDone && (
        <p style={{ position: 'fixed', bottom: minimised ? 80 : 74, left: '50%', transform: 'translateX(-50%)', zIndex: 40, margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'color-mix(in srgb, var(--wa-surface) 92%, transparent)', boxShadow: '0 2px 10px rgba(0,0,0,.08)', fontSize: 12, color: 'var(--wa-text)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <svg width="10" height="14" viewBox="0 0 12 16" fill="none" aria-hidden="true"><circle cx="3" cy="3" r="1.4" fill="var(--wa-text)" /><circle cx="9" cy="3" r="1.4" fill="var(--wa-text)" /><circle cx="3" cy="8" r="1.4" fill="var(--wa-text)" /><circle cx="9" cy="8" r="1.4" fill="var(--wa-text)" /><circle cx="3" cy="13" r="1.4" fill="var(--wa-text)" /><circle cx="9" cy="13" r="1.4" fill="var(--wa-text)" /></svg>
          Drag cards to arrange your desk. Drag the side handle to resize.
        </p>
      )}

      {/* Toolbar */}
      {minimised ? (
        <button aria-label="Show toolbar" data-tour="desk-toolbar" onClick={() => toggleToolbar(false)}
          style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 999, background: 'var(--accent)', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 40 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="var(--wa-ink)" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      ) : (
        <div role="toolbar" aria-label="Add to desk" data-tour="desk-toolbar"
          style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 32px)', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 2, background: 'var(--wa-surface)', borderRadius: 999, padding: '5px 6px', boxShadow: '0 4px 20px rgba(0,0,0,.12)', zIndex: 40, whiteSpace: 'nowrap' }}>
          <span style={{ ...smallLabel, color: 'var(--wa-muted)', padding: '0 8px 0 10px' }}>Add</span>
          {toolButtons.map(b => (
            <button key={b.label} onClick={b.run}
              style={{ fontSize: 11, color: 'var(--wa-text)', background: 'none', border: 'none', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {b.label}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'var(--wa-line)', margin: '0 4px', flexShrink: 0 }} />
          <button aria-label="Minimise toolbar" onClick={() => toggleToolbar(true)}
            style={{ width: 32, height: 32, borderRadius: 999, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="var(--wa-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}

      {picker === 'project' && (
        <Modal title="Project" onClose={() => setPicker(null)}>
          <button onClick={() => { setPicker(null); onNewProject() }}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
            New project
          </button>
          {offDesk.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--wa-muted)', margin: 0 }}>Every active project is on the desk.</p>
            : offDesk.map(p => <PickRow key={p.id} title={p.title} sub={p.projectType} onClick={() => void restoreProject(p)} />)}
        </Modal>
      )}

      {picker === 'tasks' && (
        <Modal title="Tasks" onClose={() => setPicker(null)}>
          <PickRow title="All tasks" sub="Everything open" onClick={() => { setPicker(null); void addBlock('tasks', 'week') }} />
          <form onSubmit={e => {
            e.preventDefault()
            const name = listName.trim()
            if (!name) return
            setPicker(null); setListName('')
            void addBlock('tasks', JSON.stringify({ range: 'all', name, list: uid() }))
          }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--wa-line)' }}>
            <input value={listName} onChange={e => setListName(e.target.value)} placeholder="New list, like Studio admin" aria-label="List name"
              style={{ ...bareInput, flex: 1, minWidth: 0, fontFamily: 'Recoleta, serif', fontSize: 15 }} />
            <button type="submit" style={{ flexShrink: 0, background: 'var(--accent)', color: '#111111', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
          </form>
          {(projects ?? []).some(isActive) && <p style={{ ...smallLabel, margin: '18px 0 2px' }}>One project</p>}
          {(projects ?? []).filter(isActive).map(p => (
            <PickRow key={p.id} title={p.title} sub={p.projectType} onClick={() => { setPicker(null); void addBlock('tasks', JSON.stringify({ range: 'all', projectId: p.id })) }} />
          ))}
        </Modal>
      )}

      {picker === 'submission' && (
        <Modal title="Submission" onClose={() => setPicker(null)}>
          {openSubs.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--wa-muted)', margin: 0 }}>No open submissions to add.</p>
            : openSubs.map(o => (
              <PickRow key={o.id} title={o.title} sub={o.deadline ? fmtDay(o.deadline) : o.status}
                onClick={() => { setPicker(null); void addBlock('submission', String(o.id)) }} />
            ))}
        </Modal>
      )}

      {picker === 'earlier' && (
        <Modal title="Earlier work" onClose={() => setPicker(null)}>
          {pastProjects.map(p => (
            <PickRow key={p.id} title={p.title} sub={projectDate(p)} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </Modal>
      )}
    </>
  )
}
