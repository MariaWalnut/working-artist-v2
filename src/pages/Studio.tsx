import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Work } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const MEDIUMS = ['Painting', 'Drawing', 'Print', 'Photography', 'Digital', 'Sculpture', 'Mixed media', 'Other']
const STATUSES = ['In studio', 'In collection', 'On loan', 'Sold', 'Archived']

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  'In studio':     { background: '#F5F5F5', color: '#111111', border: 'none' },
  'In collection': { background: '#F5E642', color: '#111111', border: 'none' },
  'On loan':       { background: 'transparent', color: '#888888', border: '1px solid #E0E0E0' },
  'Sold':          { background: 'transparent', color: '#AAAAAA', border: '1px dashed #DDDDDD' },
  'Archived':      { background: '#FAFAFA', color: '#CCCCCC', border: 'none' },
}

function badgeStyle(status: string): React.CSSProperties {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE['In studio']
  return { ...s, display: 'inline-block', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999 }
}

function WorkForm({ work, onDone }: { work: Work | null; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(work?.title ?? '')
  const [medium, setMedium] = useState(work?.medium ?? 'Painting')
  const [dimensions, setDimensions] = useState(work?.dimensions ?? '')
  const [year, setYear] = useState(work?.year ?? new Date().getFullYear())
  const [status, setStatus] = useState(work?.studioStatus ?? 'In studio')

  async function save() {
    if (!title.trim()) return
    const data = { departmentId: dept?.id, title: title.trim(), medium, dimensions, year, studioStatus: status }
    if (work?.id != null) await db.works.update(work.id, data)
    else await db.works.add(data)
    onDone()
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>{work ? 'Edit work' : 'Add work'}</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={medium} onChange={e => setMedium(e.target.value)} style={{ ...inp, flex: 2 }}>{MEDIUMS.map(m => <option key={m}>{m}</option>)}</select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, flex: 1 }} min={1900} max={2100} />
        </div>
        <input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="Dimensions (e.g. 40 × 60 cm)" style={{ ...inp, marginBottom: 10 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, marginBottom: 16 }}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{work ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
          {work && <button onClick={async () => { if (work.id) await db.works.delete(work.id); onDone() }}
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

export function Studio() {
  const dept = useActiveDept()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [mediumFilter, setMediumFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Work | 'new' | null>(null)

  const works = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  const filtered = works.filter(w => {
    if (statusFilter && w.studioStatus !== statusFilter) return false
    if (mediumFilter && w.medium !== mediumFilter) return false
    return true
  }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

  const byYear = filtered.reduce<Record<number, Work[]>>((acc, w) => {
    const y = w.year ?? 0
    acc[y] = [...(acc[y] ?? []), w]
    return acc
  }, {})
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a)
  const usedMediums = [...new Set(works.map(w => w.medium).filter(Boolean))] as string[]

  const sidePanel: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }
  const sectionLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', padding: '0 8px 8px' }

  return (
    <Shell>
      {editing !== null && <WorkForm work={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={sidePanel}>
            <p style={sectionLabel}>Status</p>
            <FilterItem label="All works" active={statusFilter === null} count={works.length} onClick={() => setStatusFilter(null)} />
            {STATUSES.map(s => {
              const c = works.filter(w => w.studioStatus === s).length
              return c > 0 ? <FilterItem key={s} label={s} active={statusFilter === s} count={c} onClick={() => setStatusFilter(s)} /> : null
            })}
          </div>

          {usedMediums.length > 0 && (
            <div style={sidePanel}>
              <p style={sectionLabel}>Medium</p>
              <FilterItem label="All" active={mediumFilter === null} onClick={() => setMediumFilter(null)} />
              {usedMediums.map(m => <FilterItem key={m} label={m} active={mediumFilter === m} onClick={() => setMediumFilter(m)} />)}
            </div>
          )}

          <button onClick={() => setEditing('new')} style={{ background: '#F5E642', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + Add work
          </button>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '22px 24px 16px', borderBottom: '1px solid #F5F5F5' }}>
            <p style={{ fontFamily: 'Recoleta, serif', fontSize: 18, margin: 0 }}>{statusFilter ?? 'All works'}</p>
            <span style={{ marginLeft: 10, background: '#F5F5F5', borderRadius: 999, padding: '3px 9px', fontSize: 10, color: '#888888' }}>{filtered.length}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 120px 130px 150px 90px', padding: '10px 24px', borderBottom: '1px solid #F5F5F5' }}>
            {['', 'Title', 'Medium', 'Dimensions', 'Status', 'Year'].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAAAAA' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No works yet</p>
          ) : sortedYears.map(y => (
            <div key={y}>
              <div style={{ background: '#FAFAFA', padding: '6px 24px', borderBottom: '1px solid #F5F5F5' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{y || '—'}</span>
              </div>
              {byYear[y].map(w => (
                <div key={w.id} onClick={() => setEditing(w)} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 120px 130px 150px 90px', padding: '12px 24px', borderBottom: '1px solid #F9F9F9', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 40, borderRadius: 6, background: 'linear-gradient(135deg, #EEEEEE 0%, #DDDDDD 100%)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', margin: '0 0 2px' }}>{w.title}</p>
                    <p style={{ fontSize: 10, color: '#AAAAAA', margin: 0 }}>{w.year}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#666666' }}>{w.medium ?? '—'}</span>
                  <span style={{ fontSize: 11, color: '#AAAAAA' }}>{w.dimensions ?? '—'}</span>
                  <span style={badgeStyle(w.studioStatus ?? 'In studio')}>{w.studioStatus ?? 'In studio'}</span>
                  <span style={{ fontSize: 10, color: '#CCCCCC', textAlign: 'right' }}>{w.year ?? '—'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}
