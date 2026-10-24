import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Board, type BoardItem, type EventEntry, type Opportunity, type Project, type Todo } from '../../db/db'
import { isActive, projectDate, projectSubtitle } from '../../lib/projects'
import { formatEventDate, isUpcoming } from '../../lib/eventDates'
import { fileToDataUrl } from '../../lib/images'

type DeskType = 'project' | 'tasks' | 'list' | 'submission' | 'comingup' | 'note' | 'quote' | 'image' | 'title'
type Picker = 'project' | 'submission' | 'earlier' | null
type DragMode = 'move' | 'resize'
interface Slot { col: number; span: number; y: number; h: number }
interface Box { left: number; top: number; width: number; height: number }
interface Live extends Box { id: number; mode: DragMode }
interface DragData extends Box { id: number; mode: DragMode; sx: number; sy: number; moved: boolean }
interface ListData { title: string; items: Array<{ id: string; text: string; done: boolean }> }

// Desk blocks store their column in x (0 to 3) and their width in columns in w (1 to 4).
const GRID = 24
const COLS = 4
const PAD = 24
const GAP = 24
const NARROW = '(max-width: 900px)'
const INTERACTIVE = 'input,textarea,button,a,label,select,[data-nodrag]'
const TEXT_TYPES: DeskType[] = ['note', 'quote', 'title']
const CONFIRM_TYPES: DeskType[] = ['list', 'note', 'quote', 'image', 'title']

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

const cardStyle: React.CSSProperties = { background: '#FFFFFF', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }
const smallLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E6E' }
const plainBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }
const bareInput: React.CSSProperties = { border: 'none', outline: 'none', background: 'none', padding: 0, width: '100%', font: 'inherit', color: '#111111' }

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
    return { title: d.title ?? 'List', items: Array.isArray(d.items) ? d.items : [] }
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

function ProjectBlock({ p, todos, compact, onOpen }: { p: Project; todos: Todo[]; compact: boolean; onOpen: () => void }) {
  const mine = todos.filter(t => t.projectId === p.id)
  const done = mine.filter(t => t.done).length
  const next = mine.filter(t => !t.done).sort(byDue)[0]
  const sub = projectSubtitle(p)
  const date = projectDate(p)
  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', minHeight: compact ? undefined : 168 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={smallLabel}>{p.projectType ?? 'Project'}</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
      </div>
      <button onClick={onOpen} style={{ ...plainBtn, fontFamily: 'Recoleta, serif', fontSize: 17, lineHeight: 1.3, color: '#111111' }}>{p.title}</button>
      {sub && <div style={{ fontSize: 11, color: '#6E6E6E', marginTop: 3 }}>{sub}</div>}
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {next && <div style={{ fontSize: 11, color: '#444444' }}><span style={{ color: '#6E6E6E' }}>Next </span>{next.title}</div>}
        {mine.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#F0F0F0', overflow: 'hidden' }}>
              <div style={{ width: `${(done / mine.length) * 100}%`, height: '100%', background: '#111111' }} />
            </div>
            <span style={{ fontSize: 9, color: '#6E6E6E' }}>{done}/{mine.length}</span>
          </div>
        ) : date ? <div style={{ fontSize: 10, color: '#6E6E6E' }}>{date}</div> : null}
      </div>
    </div>
  )
}

function TasksBlock({ item, todos, projects, deptId }: { item: BoardItem; todos: Todo[]; projects: Project[]; deptId: number }) {
  const [draft, setDraft] = useState('')
  const range = item.content === 'all' ? 'all' : 'week'
  const weekEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return localISO(d) })()
  const open = todos
    .filter(t => !t.done && (range === 'all' || !t.dueDate || t.dueDate <= weekEnd))
    .sort(byDue)
  const shown = open.slice(0, 8)

  async function add() {
    const title = draft.trim()
    if (!title) return
    await db.todos.add({ departmentId: deptId, title, done: false, kanbanStatus: 'todo' })
    setDraft('')
  }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: '#111111' }}>Tasks</span>
        <button onClick={() => void db.boardItems.update(item.id!, { content: range === 'week' ? 'all' : 'week' })}
          style={{ fontSize: 10, color: '#222222', background: 'rgba(0,0,0,.08)', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {range === 'week' ? 'This week' : 'All open'}
        </button>
      </div>
      {shown.length === 0 && (
        <p style={{ fontSize: 12, color: 'rgba(0,0,0,.55)', margin: '8px 0' }}>{range === 'week' ? 'Nothing due this week' : 'No open tasks'}</p>
      )}
      {shown.map(t => {
        const project = t.projectId != null ? projects.find(p => p.id === t.projectId) : undefined
        const due = dueLabel(t.dueDate)
        return (
          <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.1)', cursor: 'pointer' }}>
            <input type="checkbox" checked={false}
              onChange={() => void db.todos.update(t.id!, { done: true, kanbanStatus: 'done' })}
              style={{ accentColor: '#111111', width: 14, height: 14, margin: '2px 0 0', flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: '#111111' }}>{t.title}</span>
              {(project || due) && (
                <span style={{ fontSize: 10, color: 'rgba(0,0,0,.62)' }}>
                  {project?.title}{project && due ? ' · ' : ''}
                  {due && <span style={due.overdue ? { color: '#C53030', fontWeight: 600 } : undefined}>{due.text}</span>}
                </span>
              )}
            </span>
          </label>
        )
      })}
      {open.length > shown.length && <p style={{ fontSize: 10, color: 'rgba(0,0,0,.55)', margin: '8px 0 0' }}>{open.length - shown.length} more</p>}
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void add() }}
        placeholder="+ Add task" aria-label="Add task"
        style={{ ...bareInput, fontSize: 11.5, marginTop: 10 }} />
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
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12, color: it.done ? '#6E6E6E' : '#333333', textDecoration: it.done ? 'line-through' : 'none', cursor: 'pointer' }}>
            <input type="checkbox" checked={it.done}
              onChange={() => void save({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, done: !x.done } : x) })}
              style={{ accentColor: '#111111', width: 14, height: 14, margin: 0, flexShrink: 0 }} />
            {it.text}
          </label>
          <button aria-label={`Remove ${it.text}`} onClick={() => void save({ ...data, items: data.items.filter(x => x.id !== it.id) })}
            style={{ ...plainBtn, fontSize: 12, color: '#767676', padding: '2px 4px' }}>×</button>
        </div>
      ))}
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addItem() }}
        placeholder="+ Add item" aria-label="Add item"
        style={{ ...bareInput, fontSize: 11.5, marginTop: 8 }} />
    </div>
  )
}

function SubmissionBlock({ o }: { o: Opportunity }) {
  const n = o.deadline && notSent(o) ? daysUntil(o.deadline) : null
  let badge: { text: string; color: string; bg: string } | null = null
  if (n !== null && n < 0) badge = { text: 'Overdue', color: '#C53030', bg: 'rgba(224,82,82,.12)' }
  else if (n !== null && n <= 2) badge = { text: n === 0 ? 'Today' : `${n}d`, color: '#C53030', bg: 'rgba(224,82,82,.12)' }
  else if (n !== null && n <= 7) badge = { text: `${n}d`, color: '#A86400', bg: 'rgba(240,160,32,.14)' }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={smallLabel}>Submission</span>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6E6E6E', border: '1px solid #EEEEEE', borderRadius: 999, padding: '3px 8px' }}>{o.status}</span>
      </div>
      <div style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: '#111111' }}>{o.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#666666' }}>{o.deadline ? `Deadline ${fmtDay(o.deadline)}` : 'No deadline'}</span>
        {badge && <span style={{ fontSize: 9, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 4, padding: '1px 6px' }}>{badge.text}</span>}
      </div>
    </div>
  )
}

const TEXT_LOOK: Record<string, React.CSSProperties> = {
  note: { padding: '14px 16px', fontSize: 12.5, lineHeight: 1.6, color: '#222222' },
  quote: { padding: '20px 22px', fontFamily: 'Recoleta, serif', fontSize: 20, lineHeight: 1.3, color: 'var(--accent)' },
  title: { padding: '2px 4px', fontFamily: 'Recoleta, serif', fontSize: 34, lineHeight: 1.15, color: '#111111' },
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
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, width: 420, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ ...smallLabel, color: '#767676' }}>{title}</span>
          <button onClick={onClose} style={{ ...plainBtn, fontSize: 12, color: '#6E6E6E' }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PickRow({ title, sub, onClick }: { title: string; sub?: string | null; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...plainBtn, display: 'flex', alignItems: 'baseline', gap: 10, width: '100%', padding: '11px 0', borderBottom: '1px solid #F5F5F5' }}>
      <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: '#111111', flex: 1 }}>{title}</span>
      {sub && <span style={{ fontSize: 10, color: '#6E6E6E', flexShrink: 0 }}>{sub}</span>}
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
  const [canvasH, setCanvasH] = useState(600)
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
  const projects = useLiveQuery(() => db.projects.where('departmentId').equals(deptId).toArray(), [deptId])
  const todos = useLiveQuery(() => db.todos.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const opps = useLiveQuery(() => db.opportunities.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const events = useLiveQuery(() => db.eventEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []

  function slotOf(i: BoardItem): Slot {
    const el = canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${i.id}"]`)
    return { col: i.x, span: i.w, y: i.y, h: el && !narrow ? el.offsetHeight : i.h }
  }

  // First visit: create the desk with Coming up, Tasks and every active project.
  useEffect(() => {
    if (board !== null || projects === undefined) return
    void db.transaction('rw', db.boards, db.boardItems, async () => {
      const existing = await db.boards.where('departmentId').equals(deptId).filter(b => b.boardType === 'desk').first()
      if (existing) return
      const id = await db.boards.add({ departmentId: deptId, name: 'Desk', boardType: 'desk', createdAt: Date.now() }) as number
      const now = Date.now()
      const seed: BoardItem[] = [
        { boardId: id, itemType: 'comingup', content: '', x: 3, y: 24, w: 1, h: 300, createdAt: now },
        { boardId: id, itemType: 'tasks', content: 'week', x: 2, y: 24, w: 1, h: 320, createdAt: now },
      ]
      projects.filter(isActive).forEach((p, i) => {
        seed.push({ boardId: id, itemType: 'project', content: String(p.id), x: i % 2, y: 24 + Math.floor(i / 2) * 216, w: 1, h: 176, createdAt: now })
      })
      await db.boardItems.bulkAdd(seed)
    })
  }, [board, projects, deptId])

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
    if (!board || board.id == null || !items || !projects) return
    const deskId = board.id
    const onDesk = new Set(items.filter(i => i.itemType === 'project').map(i => i.content))
    const hidden = new Set(board.hiddenProjectIds ?? [])
    const missing = projects.filter(p => p.id != null && isActive(p) && !onDesk.has(String(p.id)) && !hidden.has(p.id))
    const orphans = items.filter(i => i.itemType === 'project' && !projects.some(p => String(p.id) === i.content))
    if (missing.length === 0 && orphans.length === 0) return
    void db.transaction('rw', db.boardItems, async () => {
      if (orphans.length) await db.boardItems.bulkDelete(orphans.map(o => o.id!))
      const current = await db.boardItems.where('boardId').equals(deskId).toArray()
      const have = new Set(current.filter(i => i.itemType === 'project').map(i => i.content))
      const slots = current.filter(i => !isLegacy(i)).map(slotOf)
      for (const p of missing) {
        if (have.has(String(p.id))) continue
        const pos = findFreeSlot(slots, 1, 176)
        slots.push({ col: pos.col, span: 1, y: pos.y, h: 176 })
        await db.boardItems.add({ boardId: deskId, itemType: 'project', content: String(p.id), x: pos.col, y: pos.y, w: 1, h: 176, createdAt: Date.now() })
      }
    })
  }, [board, items, projects])

  // The canvas grows to fit its lowest block.
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el || narrow) return
    let bottom = 0
    el.querySelectorAll<HTMLElement>('[data-block-id]').forEach(b => { bottom = Math.max(bottom, b.offsetTop + b.offsetHeight) })
    const h = Math.max(560, bottom + 160)
    if (h !== canvasH) setCanvasH(h)
  })

  const visible = (items ?? []).filter(i => {
    if (i.hidden) return false
    if (!narrow && isLegacy(i)) return false
    if (i.itemType === 'project') {
      const p = projects?.find(x => String(x.id) === i.content)
      return !!p && isActive(p)
    }
    if (i.itemType === 'submission') return opps.some(o => String(o.id) === i.content)
    return true
  })
  const hiddenItems = (items ?? []).filter(i => i.hidden && (i.itemType !== 'project' || projects?.some(p => String(p.id) === i.content)))
  function labelOf(i: BoardItem): string {
    switch (i.itemType) {
      case 'project': return projects?.find(p => String(p.id) === i.content)?.title ?? 'Project'
      case 'submission': return opps.find(o => String(o.id) === i.content)?.title ?? 'Submission'
      case 'tasks': return 'Tasks'
      case 'comingup': return 'Coming up'
      case 'list': return parseList(i.content).title
      case 'image': return i.content || 'Image'
      case 'quote': return i.content ? `“${i.content.slice(0, 40)}${i.content.length > 40 ? '…' : ''}”` : 'Quote'
      default: return i.content ? i.content.slice(0, 40) + (i.content.length > 40 ? '…' : '') : 'Note'
    }
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
  const openSubs = opps.filter(o => !['Won', 'Closed'].includes(o.status) && !subIdsOnDesk.has(String(o.id)))

  async function addBlock(type: DeskType, content = '', extra: Partial<BoardItem> = {}) {
    if (board?.id == null || !items) return
    const { span, h } = SPAN[type]
    const pos = findFreeSlot(items.filter(i => !isLegacy(i)).map(slotOf), span, h)
    const id = await db.boardItems.add({ boardId: board.id, itemType: type, content, x: pos.col, y: pos.y, w: span, h, createdAt: Date.now(), ...extra }) as number
    if (TEXT_TYPES.includes(type)) setEditingId(id)
    requestAnimationFrame(() => {
      canvasRef.current?.querySelector(`[data-block-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  async function removeBlock(item: BoardItem) {
    if (item.id == null) return
    const t = item.itemType as DeskType
    if (CONFIRM_TYPES.includes(t) && item.content && !window.confirm('Remove this block?')) return
    if (t === 'project' && board?.id != null) {
      const hidden = [...new Set([...(board.hiddenProjectIds ?? []), Number(item.content)])]
      await db.boards.update(board.id, { hiddenProjectIds: hidden } as Partial<Board>)
    }
    await db.boardItems.delete(item.id)
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
      await db.boardItems.update(d.id, { x: colAt(g.left, item.w), y: snap(g.top) })
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
    if (t === 'quote' || t === 'comingup') return { ...cardStyle, background: '#111111' }
    if (t === 'title') return {}
    if (t === 'image') return { borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)', background: '#EEEEEE' }
    return cardStyle
  }

  function blockContent(item: BoardItem) {
    const t = item.itemType as DeskType
    switch (t) {
      case 'project': {
        const p = projects?.find(x => String(x.id) === item.content)
        return p ? <ProjectBlock p={p} todos={todos} compact={narrow} onOpen={() => navigate(`/projects/${p.id}`)} /> : null
      }
      case 'tasks':
        return <TasksBlock item={item} todos={todos} projects={projects ?? []} deptId={deptId} />
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
    const shell = blockShell(t)
    const showRemove = (hovered === item.id || narrow) && !mine && editingId !== item.id
    const showHandle = !narrow && editingId !== item.id && ((hovered === item.id && !mine) || mine?.mode === 'resize')
    const imageHeight = mine ? mine.height : item.h
    const wrapper: React.CSSProperties = narrow
      ? { position: 'relative' }
      : {
          position: 'absolute', left: mine ? mine.left : colLeft(item.x), top: mine ? mine.top : item.y,
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
        <div style={{ ...shell, height: t === 'image' && !narrow ? imageHeight : undefined, boxShadow: mine ? '0 12px 32px rgba(0,0,0,.14)' : shell.boxShadow }}>
          {blockContent(item)}
        </div>
        {showRemove && (
          <div style={{ position: 'absolute', top: -10, right: -8, display: 'flex', gap: 4, zIndex: 2 }}>
            <button aria-label="Hide this box" title="Hide" onClick={() => void setHidden(item, true)}
              style={{ width: narrow ? 22 : 24, height: narrow ? 22 : 24, borderRadius: 999, background: '#FFFFFF', border: '1px solid #E5E5E5', boxShadow: narrow ? 'none' : '0 1px 4px rgba(0,0,0,.10)', opacity: narrow ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8s2.2-4.2 6-4.2S14 8 14 8s-2.2 4.2-6 4.2S2 8 2 8z" stroke="#666666" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="8" cy="8" r="1.8" stroke="#666666" strokeWidth="1.4" /><path d="M3 13L13 3" stroke="#666666" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
            {CONFIRM_TYPES.includes(t) && (
              <button aria-label="Delete this box" title="Delete" onClick={() => void removeBlock(item)}
                style={{ width: narrow ? 22 : 24, height: narrow ? 22 : 24, borderRadius: 999, background: '#FFFFFF', border: '1px solid #E5E5E5', boxShadow: narrow ? 'none' : '0 1px 4px rgba(0,0,0,.10)', opacity: narrow ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="#888888" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>
        )}
        {showHandle && (
          <div aria-hidden="true" onPointerDown={e => onPointerDown(e, item, 'resize')}
            style={t === 'image'
              ? { position: 'absolute', right: -5, bottom: -5, width: 10, height: 10, background: '#FFFFFF', border: '1.5px solid #111111', borderRadius: 2, cursor: 'nwse-resize', touchAction: 'none', zIndex: 2 }
              : { position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 28, background: '#FFFFFF', border: '1.5px solid #111111', borderRadius: 4, cursor: 'ew-resize', touchAction: 'none', zIndex: 2 }} />
        )}
      </div>
    )
  }

  // Where a dragged block will land.
  const liveItem = live ? visible.find(i => i.id === live.id) : undefined
  const preview = live && liveItem ? (() => {
    if (live.mode === 'move') {
      const col = colAt(live.left, liveItem.w)
      return { left: colLeft(col), top: snap(live.top), width: spanWidth(liveItem.w), height: live.height }
    }
    const span = spanFor(live.width, liveItem.x)
    return { left: colLeft(liveItem.x), top: liveItem.y, width: spanWidth(span), height: liveItem.itemType === 'image' ? snap(live.height) : live.height }
  })() : null

  const earlierButton = pastProjects.length > 0 && (
    <button onClick={() => setPicker('earlier')}
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1px solid #EEEEEE', borderRadius: 999, padding: '9px 14px', fontSize: 11, color: '#666666', cursor: 'pointer', fontFamily: 'inherit', width: 'fit-content', ...(narrow ? {} : { position: 'absolute', left: PAD, bottom: 20 }) }}>
      Earlier work
      <span style={{ fontSize: 9, fontWeight: 600, color: '#666666', background: '#F5F5F5', borderRadius: 999, padding: '2px 6px' }}>{pastProjects.length}</span>
    </button>
  )

  const toolButtons: Array<{ label: string; run: () => void }> = [
    { label: 'Project', run: () => setPicker('project') },
    { label: 'Tasks', run: () => void addBlock('tasks', 'week') },
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '0 14px', border: '1px solid #DDDDDD', borderRadius: 999, background: '#FFFFFF', color: '#111111', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Hidden boxes
            <span style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>{hiddenItems.length}</span>
          </button>
          {trayOpen && (
            <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 50, width: 280, maxWidth: 'calc(100vw - 40px)', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 14px 44px rgba(0,0,0,.18)', padding: '12px 16px' }}>
              <p style={{ ...smallLabel, margin: '0 0 6px' }}>Hidden boxes</p>
              {hiddenItems.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid #F0F0F0' }}>
                  <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(i)}</span>
                  <button onClick={() => { void setHidden(i, false); if (hiddenItems.length === 1) setTrayOpen(false) }}
                    style={{ flexShrink: 0, minHeight: 30, padding: '0 12px', border: 'none', borderRadius: 999, background: '#111111', color: '#FFFFFF', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Show</button>
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
          style={{ position: 'relative', height: canvasH, background: '#E6E6E6', borderRadius: 20 }}>
          {live && Array.from({ length: COLS }, (_, c) => (
            <div key={c} aria-hidden="true"
              style={{ position: 'absolute', top: 12, bottom: 12, left: colLeft(c), width: colW, borderRadius: 12, background: 'rgba(0,0,0,.025)', pointerEvents: 'none' }} />
          ))}
          {preview && (
            <div aria-hidden="true"
              style={{ position: 'absolute', ...preview, borderRadius: 16, border: '1.5px dashed #D8D8D8', background: 'rgba(0,0,0,.03)', pointerEvents: 'none' }} />
          )}
          {deskW > 0 && ordered.map(renderBlock)}
          {loaded && visible.length === 0 && (
            <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, fontSize: 12, color: '#767676' }}>Nothing on the desk</p>
          )}
          {earlierButton}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void onImagePicked(e)} />

      {/* Hint, just above the toolbar, until the first card is moved */}
      {!narrow && !hintDone && (
        <p style={{ position: 'fixed', bottom: minimised ? 80 : 74, left: '50%', transform: 'translateX(-50%)', zIndex: 40, margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.92)', boxShadow: '0 2px 10px rgba(0,0,0,.08)', fontSize: 12, color: '#555555', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          <svg width="10" height="14" viewBox="0 0 12 16" fill="none" aria-hidden="true"><circle cx="3" cy="3" r="1.4" fill="#555555" /><circle cx="9" cy="3" r="1.4" fill="#555555" /><circle cx="3" cy="8" r="1.4" fill="#555555" /><circle cx="9" cy="8" r="1.4" fill="#555555" /><circle cx="3" cy="13" r="1.4" fill="#555555" /><circle cx="9" cy="13" r="1.4" fill="#555555" /></svg>
          Drag cards to arrange your desk. Drag the side handle to resize.
        </p>
      )}

      {/* Toolbar */}
      {minimised ? (
        <button aria-label="Show toolbar" data-tour="desk-toolbar" onClick={() => toggleToolbar(false)}
          style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 999, background: 'var(--accent)', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 40 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      ) : (
        <div role="toolbar" aria-label="Add to desk" data-tour="desk-toolbar"
          style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 32px)', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 2, background: '#FFFFFF', borderRadius: 999, padding: '5px 6px', boxShadow: '0 4px 20px rgba(0,0,0,.12)', zIndex: 40, whiteSpace: 'nowrap' }}>
          <span style={{ ...smallLabel, color: '#767676', padding: '0 8px 0 10px' }}>Add</span>
          {toolButtons.map(b => (
            <button key={b.label} onClick={b.run}
              style={{ fontSize: 11, color: '#555555', background: 'none', border: 'none', borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {b.label}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: '#EEEEEE', margin: '0 4px', flexShrink: 0 }} />
          <button aria-label="Minimise toolbar" onClick={() => toggleToolbar(true)}
            style={{ width: 32, height: 32, borderRadius: 999, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
            ? <p style={{ fontSize: 12, color: '#767676', margin: 0 }}>Every active project is on the desk.</p>
            : offDesk.map(p => <PickRow key={p.id} title={p.title} sub={p.projectType} onClick={() => void restoreProject(p)} />)}
        </Modal>
      )}

      {picker === 'submission' && (
        <Modal title="Submission" onClose={() => setPicker(null)}>
          {openSubs.length === 0
            ? <p style={{ fontSize: 12, color: '#767676', margin: 0 }}>No open submissions to add.</p>
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
