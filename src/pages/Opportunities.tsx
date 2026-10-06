import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Opportunity } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const OPP_TYPES = ['Open call', 'Grant', 'Residency', 'Press', 'Commission']
const OPP_STATUSES = ['Active', 'Draft', 'Applied', 'Shortlisted', 'Won', 'Closed']

const BADGE: Record<string, string> = {
  Shortlisted: 'bg-[#F5E642] text-[#111111]',
  Won:         'bg-[#F5E642] text-[#111111]',
  Applied:     'bg-[#F5F5F5] text-[#666666]',
  Active:      'bg-[#F5F5F5] text-[#111111]',
  Draft:       'text-[#AAAAAA]',
  Closed:      'bg-[#F5F5F5] text-[#CCCCCC]',
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
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>{opp ? 'Edit' : 'New opportunity'}</p>
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
          <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{opp ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
          {opp && <button onClick={async () => { if (opp.id) await db.opportunities.delete(opp.id); onDone() }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#CCCCCC', cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

function FilterItem({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#666666', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
      <span>{label}</span>
      {count != null && <span style={{ fontSize: 10, color: '#AAAAAA', fontWeight: 400 }}>{count}</span>}
    </button>
  )
}

export function Opportunities() {
  const dept = useActiveDept()
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('Active')
  const [editing, setEditing] = useState<Opportunity | 'new' | null>(null)

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
  const sectionLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', padding: '0 8px 8px' }

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
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 26, color: s.muted ? '#AAAAAA' : '#111111', margin: '0 0 2px', lineHeight: 1.1 }}>{s.v}</p>
                <p style={{ fontSize: 9, color: s.muted ? '#CCCCCC' : '#AAAAAA', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
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

          <button onClick={() => setEditing('new')} style={{ background: '#F5E642', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + Add
          </button>
        </div>

        {/* Right */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 36px', padding: '14px 24px', borderBottom: '1px solid #F5F5F5' }}>
            {['Title', 'Type', 'Deadline', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAAAAA' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No opportunities</p>
          ) : filtered.map(o => {
            const today = new Date().toISOString().slice(0, 10)
            const overdue = o.deadline && o.deadline < today && !['Won', 'Closed'].includes(o.status)
            const isDraft = o.status === 'Draft'
            return (
              <div key={o.id} onClick={() => setEditing(o)} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 36px', padding: '14px 24px', borderBottom: '1px solid #F5F5F5', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: isDraft ? '#888888' : '#111111', margin: '0 0 2px' }}>{o.title}</p>
                  {o.organisation && <p style={{ fontSize: 10, color: isDraft ? '#CCCCCC' : '#AAAAAA', margin: 0 }}>{o.organisation}</p>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: isDraft ? '#CCCCCC' : '#666666' }}>{o.opportunityType ?? '—'}</span>
                <span style={{ fontSize: 10, color: overdue ? '#E05252' : (isDraft ? '#CCCCCC' : '#AAAAAA') }}>
                  {o.deadline ? new Date(o.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
                <span className={badge(o.status)}>{o.status}</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: o.status === 'Shortlisted' || o.status === 'Won' ? '#F5E642' : (isDraft ? '#EEEEEE' : '#DDDDDD'), margin: 'auto' }} />
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
