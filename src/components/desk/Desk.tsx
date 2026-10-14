import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Board, type BoardItem, type EventEntry, type Opportunity, type Project, type Todo } from '../../db/db'
import { isActive, projectDate, projectSubtitle } from '../../lib/projects'

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
  comingup: { span: 3, h: 56 },
  note: { span: 1, h: 96 },
  quote: { span: 1, h: 112 },
  image: { span: 1, h: 200 },
  title: { span: 1, h: 56 },
}

const EVENT_DOT: Record<string, string> = {
  Reading: '#8CB4D4', Exhibition: '#111111', 'Book Fair': '#F0C878', Market: '#C8A88C', Talk: '#B8C8A8',
  Performance: '#D4A8C8', Screening: '#A8B4D4', Award: '#F5E642', Residency: '#888888', Other: '#DDDDDD',
}

const cardStyle: React.CSSProperties = { background: '#FFFFFF', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }
const smallLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAAAAA' }
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

function monthLabel(ym?: string) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short' })
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

function readRaw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

// Images are downscaled so the local database does not fill up with camera-size photos.
async function fileToDataUrl(file: File, max = 1400): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    const ctx = c.getContext('2d')
    if (!ctx) return readRaw(file)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.85)
  } catch {
    return readRaw(file)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ── blocks ────────────────────────────────────────────────────────────────────

function ComingUpBlock({ events, opps }: { events: EventEntry[]; opps: Opportunity[] }) {
  const navigate = useNavigate()
  const month = localISO().slice(0, 7)
  const today = localISO()
  const ev = events.filter(e => (e.date ?? '') >= month).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 6)
  const subs = opps.filter(o => notSent(o) && o.deadline && o.deadline >= today)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')).slice(0, 5)
  const chip: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', minHeight: 56 }}>
      <span style={{ ...smallLabel, color: '#BBBBBB', flexShrink: 0 }}>Coming up</span>
      <div style={{ width: 1, height: 16, background: '#F0F0F0', flexShrink: 0 }} />
      {ev.length === 0 && subs.length === 0 ? (
        <span style={{ fontSize: 12, color: '#BBBBBB' }}>Nothing scheduled</span>
      ) : (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0' }}>
          {ev.map(e => (
            <button key={`e${e.id}`} onClick={() => navigate('/projects/events')} style={{ ...chip, background: '#F9F9F9' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: EVENT_DOT[e.type ?? ''] ?? '#DDDDDD' }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#444444' }}>{e.title}</span>
              <span style={{ fontSize: 10, color: '#999999' }}>{monthLabel(e.date)}</span>
            </button>
          ))}
          {subs.map(o => {
            const n = daysUntil(o.deadline!)
            const critical = n <= 2
            const urgent = n <= 7
            const color = critical ? '#C53030' : urgent ? '#A86400' : '#999999'
            return (
              <button key={`s${o.id}`} onClick={() => navigate('/opportunities')}
                style={{ ...chip, background: critical ? '#FEF2F2' : urgent ? '#FFFBEB' : '#F9F9F9' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: critical ? '#E05252' : urgent ? '#F0A020' : '#DDDDDD' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#444444' }}>{o.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color }}>{n === 0 ? 'today' : `${n}d`}</span>
              </button>
            )
          })}
        </div>
      )}
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
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F5E642' }} />
      </div>
      <button onClick={onOpen} style={{ ...plainBtn, fontFamily: 'Recoleta, serif', fontSize: 17, lineHeight: 1.3, color: '#111111' }}>{p.title}</button>
      {sub && <div style={{ fontSize: 11, color: '#999999', marginTop: 3 }}>{sub}</div>}
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {next && <div style={{ fontSize: 11, color: '#444444' }}><span style={{ color: '#AAAAAA' }}>Next </span>{next.title}</div>}
        {mine.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#F0F0F0', overflow: 'hidden' }}>
              <div style={{ width: `${(done / mine.length) * 100}%`, height: '100%', background: '#111111' }} />
            </div>
            <span style={{ fontSize: 9, color: '#999999' }}>{done}/{mine.length}</span>
          </div>
        ) : date ? <div style={{ fontSize: 10, color: '#AAAAAA' }}>{date}</div> : null}
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
          style={{ fontSize: 10, color: '#666666', background: '#F5F5F5', border: 'none', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {range === 'week' ? 'This week' : 'All open'}
        </button>
      </div>
      {shown.length === 0 && (
        <p style={{ fontSize: 12, color: '#BBBBBB', margin: '8px 0' }}>{range === 'week' ? 'Nothing due this week' : 'No open tasks'}</p>
      )}
      {shown.map(t => {
        const project = t.projectId != null ? projects.find(p => p.id === t.projectId) : undefined
        const due = dueLabel(t.dueDate)
        return (
          <label key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid #F7F7F7', cursor: 'pointer' }}>
            <input type="checkbox" checked={false}
              onChange={() => void db.todos.update(t.id!, { done: true, kanbanStatus: 'done' })}
              style={{ accentColor: '#111111', width: 14, height: 14, margin: '2px 0 0', flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: '#111111' }}>{t.title}</span>
              {(project || due) && (
                <span style={{ fontSize: 10, color: '#999999' }}>
                  {project?.title}{project && due ? ' · ' : ''}
                  {due && <span style={due.overdue ? { color: '#C53030', fontWeight: 600 } : undefined}>{due.text}</span>}
                </span>
              )}
            </span>
          </label>
        )
      })}
      {open.length > shown.length && <p style={{ fontSize: 10, color: '#AAAAAA', margin: '8px 0 0' }}>{open.length - shown.length} more</p>}
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
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 12, color: it.done ? '#AAAAAA' : '#333333', textDecoration: it.done ? 'line-through' : 'none', cursor: 'pointer' }}>
            <input type="checkbox" checked={it.done}
              onChange={() => void save({ ...data, items: data.items.map(x => x.id === it.id ? { ...x, done: !x.done } : x) })}
              style={{ accentColor: '#111111', width: 14, height: 14, margin: 0, flexShrink: 0 }} />
            {it.text}
          </label>
          <button aria-label={`Remove ${it.text}`} onClick={() => void save({ ...data, items: data.items.filter(x => x.id !== it.id) })}
            style={{ ...plainBtn, fontSize: 12, color: '#CCCCCC', padding: '2px 4px' }}>×</button>
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
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#777777', border: '1px solid #EEEEEE', borderRadius: 999, padding: '3px 8px' }}>{o.status}</span>
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
  note: { padding: '14px 16px', fontSize: 12.5, lineHeight: 1.6, color: '#555555' },
  quote: { padding: '20px 22px', fontFamily: 'Recoleta, serif', fontSize: 20, lineHeight: 1.3, color: '#111111' },
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
          <span style={{ ...smallLabel, color: '#BBBBBB' }}>{title}</span>
          <button onClick={onClose} style={{ ...plainBtn, fontSize: 12, color: '#999999' }}>Close</button>
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
      {sub && <span style={{ fontSize: 10, color: '#AAAAAA', flexShrink: 0 }}>{sub}</span>}
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
        { boardId: id, itemType: 'comingup', content: '', x: 0, y: 24, w: 3, h: 56, createdAt: now },
        { boardId: id, itemType: 'tasks', content: 'week', x: 2, y: 104, w: 1, h: 320, createdAt: now },
      ]
      projects.filter(isActive).forEach((p, i) => {
        seed.push({ boardId: id, itemType: 'project', content: String(p.id), x: i % 2, y: 104 + Math.floor(i / 2) * 200, w: 1, h: 176, createdAt: now })
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
    if (!narrow && isLegacy(i)) return false
    if (i.itemType === 'project') {
      const p = projects?.find(x => String(x.id) === i.content)
      return !!p && isActive(p)
    }
    if (i.itemType === 'submission') return opps.some(o => String(o.id) === i.content)
    return true
  })
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
    if (t === 'note') return { background: '#FFFDE7', border: '1px solid #F5E642', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,.05)' }
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
      <div key={item.id} data-block-id={item.id} style={wrapper}
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
          <button aria-label="Remove block" onClick={() => void removeBlock(item)}
            style={{ position: 'absolute', top: -8, right: -8, width: narrow ? 18 : 22, height: narrow ? 18 : 22, borderRadius: 999, background: '#FFFFFF', border: '1px solid #E5E5E5', boxShadow: narrow ? 'none' : '0 1px 4px rgba(0,0,0,.10)', opacity: narrow ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 2 }}>
            <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="#888888" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
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
      <span style={{ fontSize: 9, fontWeight: 600, color: '#888888', background: '#F5F5F5', borderRadius: 999, padding: '2px 6px' }}>{pastProjects.length}</span>
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

  return (
    <>
      {narrow ? (
        <div ref={canvasRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 120 }}>
          {ordered.map(renderBlock)}
          {earlierButton}
        </div>
      ) : (
        <div ref={canvasRef}
          style={{ position: 'relative', height: canvasH, background: '#FAFAFA', border: '1px solid #EEEEEE', borderRadius: 20 }}>
          {live && Array.from({ length: COLS }, (_, c) => (
            <div key={c} aria-hidden="true"
              style={{ position: 'absolute', top: 12, bottom: 12, left: colLeft(c), width: colW, borderRadius: 12, background: 'rgba(0,0,0,.025)', pointerEvents: 'none' }} />
          ))}
          {preview && (
            <div aria-hidden="true"
              style={{ position: 'absolute', ...preview, borderRadius: 16, border: '1.5px dashed #D8D8D8', background: 'rgba(245,230,66,.08)', pointerEvents: 'none' }} />
          )}
          {deskW > 0 && ordered.map(renderBlock)}
          {loaded && visible.length === 0 && (
            <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, fontSize: 12, color: '#BBBBBB' }}>Nothing on the desk</p>
          )}
          {earlierButton}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void onImagePicked(e)} />

      {/* Toolbar */}
      {minimised ? (
        <button aria-label="Show toolbar" onClick={() => toggleToolbar(false)}
          style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: 999, background: '#F5E642', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 40 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      ) : (
        <div role="toolbar" aria-label="Add to desk"
          style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 32px)', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 2, background: '#FFFFFF', borderRadius: 999, padding: '5px 6px', boxShadow: '0 4px 20px rgba(0,0,0,.12)', zIndex: 40, whiteSpace: 'nowrap' }}>
          <span style={{ ...smallLabel, color: '#BBBBBB', padding: '0 8px 0 10px' }}>Add</span>
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
            style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
            New project
          </button>
          {offDesk.length === 0
            ? <p style={{ fontSize: 12, color: '#BBBBBB', margin: 0 }}>Every active project is on the desk.</p>
            : offDesk.map(p => <PickRow key={p.id} title={p.title} sub={p.projectType} onClick={() => void restoreProject(p)} />)}
        </Modal>
      )}

      {picker === 'submission' && (
        <Modal title="Submission" onClose={() => setPicker(null)}>
          {openSubs.length === 0
            ? <p style={{ fontSize: 12, color: '#BBBBBB', margin: 0 }}>No open submissions to add.</p>
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
