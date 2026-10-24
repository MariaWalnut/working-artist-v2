import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Opportunity } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { Hint } from '../components/Hint'

const OPP_TYPES = ['Open call', 'Grant', 'Residency', 'Publisher proposal', 'Press', 'Commission']
const OPP_STATUSES = ['Active', 'Draft', 'Applied', 'Shortlisted', 'Won', 'Closed']

const BADGE: Record<string, string> = {
  Shortlisted: 'bg-[var(--accent)] text-[#111111]',
  Won:         'bg-[var(--accent)] text-[#111111]',
  Applied:     'bg-[#F5F5F5] text-[#666666]',
  Active:      'bg-[#F5F5F5] text-[#111111]',
  Draft:       'text-[#6E6E6E]',
  Closed:      'bg-[#F5F5F5] text-[#767676]',
}

const BADGE_BORDER: Record<string, string> = {
  Draft: 'border border-dashed border-[#DDDDDD]',
}

function badge(status: string) {
  return `inline-block text-[9px] font-semibold uppercase tracking-[0.08em] px-[9px] py-[4px] rounded-full whitespace-nowrap ${BADGE[status] ?? BADGE.Applied} ${BADGE_BORDER[status] ?? ''}`
}

function OppForm({ opp, onDone }: { opp: Opportunity | null; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(opp?.title ?? '')
  const [type, setType] = useState(opp?.opportunityType ?? 'Open call')
  const [org, setOrg] = useState(opp?.organisation ?? '')
  const [status, setStatus] = useState(opp?.status ?? 'Active')
  const [deadline, setDeadline] = useState(opp?.deadline ?? '')
  const [notes, setNotes] = useState(opp?.notes ?? '')

  async function save() {
    if (!title.trim()) return
    const data = { departmentId: dept?.id, title: title.trim(), opportunityType: type, organisation: org, status, deadline: deadline || undefined, notes }
    if (opp?.id != null) await db.opportunities.update(opp.id, data)
    else await db.opportunities.add(data)
    onDone()
  }

  const inp = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none' as const, width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', marginBottom: 16 }}>{opp ? 'Edit' : 'New opportunity'}</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Opportunity name" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1 }}>{OPP_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, flex: 1 }}>{OPP_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Organisation / City" style={{ ...inp, marginBottom: 10 }} />
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={3}
          style={{ ...inp, resize: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} style={{ background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{opp ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#666666', cursor: 'pointer' }}>Cancel</button>
          {opp && <button onClick={async () => { if (opp.id) await db.opportunities.delete(opp.id); onDone() }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#767676', cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

function FilterItem({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#666666', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
      <span>{label}</span>
      {count != null && <span style={{ fontSize: 10, color: '#6E6E6E', fontWeight: 400 }}>{count}</span>}
    </button>
  )
}

// ─── Import ──────────────────────────────────────────────────────────────────

// Minimal CSV reader: quoted fields, doubled quotes, commas, semicolons or tabs, line breaks inside quotes.
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const sep = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}

type Incoming = Pick<Opportunity, 'title' | 'opportunityType' | 'organisation' | 'deadline' | 'status' | 'notes'>

// Reads a CSV (Title, Type, Organisation, Deadline, Status, Notes) or a JSON list with the same fields.
function readSubmissions(text: string): Incoming[] {
  const trimmed = text.trim()
  if (trimmed.startsWith('[')) {
    return (JSON.parse(trimmed) as Array<Record<string, unknown>>).map(r => ({
      title: String(r.title ?? ''), opportunityType: r.type ? String(r.type) : r.opportunityType ? String(r.opportunityType) : undefined,
      organisation: r.organisation ? String(r.organisation) : undefined, deadline: r.deadline ? String(r.deadline) : undefined,
      status: r.status ? String(r.status) : 'Active', notes: r.notes ? String(r.notes) : undefined,
    }))
  }
  const [header, ...rows] = parseCsv(text)
  const col = (name: string) => header.findIndex(h => h.trim().toLowerCase() === name)
  const at = (r: string[], name: string) => { const i = col(name); return i >= 0 ? r[i]?.trim() || undefined : undefined }
  return rows.map(r => ({
    title: at(r, 'title') ?? '', opportunityType: at(r, 'type'), organisation: at(r, 'organisation'),
    deadline: at(r, 'deadline'), status: at(r, 'status') ?? 'Active', notes: at(r, 'notes'),
  }))
}

export function Opportunities() {
  const dept = useActiveDept()
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('Active')
  const [editing, setEditing] = useState<Opportunity | 'new' | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Adds entries; never replaces. Skips anything already here with the same title and deadline.
  async function importFile(file?: File) {
    if (!file || dept?.id == null) return
    try {
      const incoming = readSubmissions(await file.text()).filter(o => o.title.trim())
      const seen = new Set(opps.map(o => `${o.title.trim().toLowerCase()}|${o.deadline ?? ''}`))
      const fresh = incoming.filter(o => !seen.has(`${o.title.trim().toLowerCase()}|${o.deadline ?? ''}`))
      const valid = (d?: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined
      await db.opportunities.bulkAdd(fresh.map(o => ({
        departmentId: dept.id, title: o.title.trim(), opportunityType: o.opportunityType, organisation: o.organisation,
        deadline: valid(o.deadline), status: OPP_STATUSES.includes(o.status) ? o.status : 'Active', notes: o.notes,
      })))
      const skipped = incoming.length - fresh.length
      setImportMsg(`Added ${fresh.length}${skipped ? `, skipped ${skipped} already here` : ''}.`)
    } catch {
      setImportMsg('That file could not be read. Use a CSV with Title, Type, Organisation, Deadline, Status, Notes.')
    }
  }

  const opps = useLiveQuery(() => dept?.id == null ? [] : db.opportunities.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  const filtered = opps.filter(o => {
    if (typeFilter && o.opportunityType !== typeFilter) return false
    if (statusFilter === 'Active') return !['Won', 'Closed'].includes(o.status)
    if (statusFilter !== 'All') return o.status === statusFilter
    return true
  }).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))

  const activeCount = opps.filter(o => !['Won', 'Closed'].includes(o.status)).length
  const wonCount = opps.filter(o => o.status === 'Won').length
  const shortCount = opps.filter(o => o.status === 'Shortlisted').length
  const closedCount = opps.filter(o => o.status === 'Closed').length

  const sidePanel: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }
  const sectionLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', padding: '0 8px 8px' }

  return (
    <Shell>
      {editing !== null && <OppForm opp={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10, minHeight: 600 }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Stats */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[{ label: 'Active', v: activeCount, muted: false }, { label: 'Won', v: wonCount, muted: false }, { label: 'Shortlisted', v: shortCount, muted: false }, { label: 'Closed', v: closedCount, muted: true }].map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '14px 0', borderTop: i >= 2 ? '1px solid #F5F5F5' : undefined, borderLeft: i % 2 === 1 ? '1px solid #F5F5F5' : undefined }}>
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 26, color: s.muted ? '#6E6E6E' : '#111111', margin: '0 0 2px', lineHeight: 1.1 }}>{s.v}</p>
                <p style={{ fontSize: 9, color: s.muted ? '#767676' : '#6E6E6E', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Type */}
          <div style={sidePanel}>
            <p style={sectionLabel}>Type</p>
            <FilterItem label="All types" active={typeFilter === null} onClick={() => setTypeFilter(null)} />
            {OPP_TYPES.map(t => <FilterItem key={t} label={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} />)}
          </div>

          {/* Status */}
          <div style={sidePanel}>
            <p style={sectionLabel}>Status</p>
            {['Active', 'Draft', 'Applied', 'Shortlisted', 'All'].map(s => <FilterItem key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />)}
          </div>

          <button onClick={() => setEditing('new')} style={{ background: 'var(--accent)', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + Add
          </button>
          <input ref={importRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
          <button data-tour="subs-import" onClick={() => { setImportMsg(null); importRef.current?.click() }} style={{ background: '#FFFFFF', borderRadius: 999, padding: 10, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: '1px solid #EEEEEE', color: '#666666', cursor: 'pointer' }}>
            Import
          </button>
          {importMsg && <p role="status" style={{ fontSize: 11, color: '#666666', margin: '2px 8px 0', textAlign: 'center' }}>{importMsg}</p>}
        </div>

        {/* Right */}
        <div data-tour="subs-list" style={{ background: '#FFFFFF', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 36px', padding: '14px 24px', borderBottom: '1px solid #F5F5F5' }}>
            {['Title', 'Type', 'Deadline', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E6E6E' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '40px 24px' }}><p style={{ textAlign: 'center', margin: '0 0 16px', fontSize: 11, color: '#767676', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No submissions</p><Hint id="subs-start" style={{ maxWidth: 420, margin: '0 auto' }}>Add a call with + Add, or bring in a whole list with Import, from a spreadsheet with Title, Type, Organisation, Deadline and Status.</Hint></div>
          ) : filtered.map(o => {
            const today = new Date().toISOString().slice(0, 10)
            const notSent = o.status === 'Active' || o.status === 'Draft'
            const overdue = notSent && !!o.deadline && o.deadline < today
            const isDraft = o.status === 'Draft'
            const days = notSent && o.deadline && !overdue
              ? Math.round((new Date(o.deadline).setHours(0,0,0,0) - new Date(today).setHours(0,0,0,0)) / 86400000)
              : null
            const critical = days !== null && days <= 2
            const urgent = days !== null && days <= 7
            const rowBg = critical ? 'rgba(224,82,82,0.04)' : urgent ? 'rgba(240,160,32,0.05)' : 'transparent'
            const deadlineColor = overdue ? '#C53030' : critical ? '#C53030' : urgent ? '#A86400' : (isDraft ? '#767676' : '#6E6E6E')
            return (
              <div key={o.id} onClick={() => setEditing(o)} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 36px', padding: '14px 24px', borderBottom: '1px solid #F5F5F5', alignItems: 'center', cursor: 'pointer', background: rowBg, borderLeft: critical ? '3px solid #E05252' : urgent ? '3px solid #F0A020' : '3px solid transparent' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: isDraft ? '#666666' : '#111111', margin: '0 0 2px' }}>{o.title}</p>
                  {o.organisation && <p style={{ fontSize: 10, color: isDraft ? '#767676' : '#6E6E6E', margin: 0 }}>{o.organisation}</p>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: isDraft ? '#767676' : '#666666' }}>{o.opportunityType ?? '—'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: deadlineColor }}>
                    {o.deadline ? new Date(o.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </span>
                  {overdue && <span style={{ fontSize: 8, fontWeight: 700, color: '#E05252', background: 'rgba(224,82,82,0.1)', padding: '1px 5px', borderRadius: 4 }}>overdue</span>}
                  {!overdue && critical && <span style={{ fontSize: 8, fontWeight: 700, color: '#E05252', background: 'rgba(224,82,82,0.1)', padding: '1px 5px', borderRadius: 4 }}>{days === 0 ? 'today' : days === 1 ? '1d' : `${days}d`}</span>}
                  {!overdue && !critical && urgent && <span style={{ fontSize: 8, fontWeight: 700, color: '#F0A020', background: 'rgba(240,160,32,0.1)', padding: '1px 5px', borderRadius: 4 }}>{days}d</span>}
                </div>
                <span className={badge(o.status)}>{o.status}</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: o.status === 'Shortlisted' || o.status === 'Won' ? 'var(--accent)' : (isDraft ? '#EEEEEE' : '#DDDDDD'), margin: 'auto' }} />
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
