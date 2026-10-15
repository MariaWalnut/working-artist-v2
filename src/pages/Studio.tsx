import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { getActivities } from '../lib/activities'
import { Shell } from '../components/layout/Shell'
import { KindSelect, WorkFields, fieldsFromWork, fieldsToPatch } from '../components/WorkFields'
import { WORK_KINDS, kindOf, workSubtitle, workYear, type WorkKind } from '../lib/works'

const NARROW = '(max-width: 760px)'

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function NewWorkForm({ defaultKind, onDone }: { defaultKind: WorkKind; onDone: (id?: number) => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<WorkKind>(defaultKind)
  const [fields, setFields] = useState(() => fieldsFromWork(null))
  const [image, setImage] = useState<string | undefined>()

  async function save() {
    if (!title.trim()) return
    const id = await db.works.add({ departmentId: dept?.id, title: title.trim(), kind, image, ...fieldsToPatch(fields, kind) }) as number
    onDone(id)
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 520, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>Add work</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title"
          onKeyDown={e => { if (e.key === 'Enter') void save() }}
          style={{ ...inp, marginBottom: 12, fontSize: 14 }} />
        <div style={{ marginBottom: 12 }}>
          <KindSelect value={kind} onChange={setKind} style={inp} />
        </div>
        <WorkFields kind={kind} values={fields} onChange={setFields} inp={inp} columns={2}
          onIsbnFound={r => { if (r.title && !title.trim()) setTitle(r.title); if (r.image) setImage(r.image) }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
          <button onClick={() => onDone()} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function Studio() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const activities = getActivities(dept)
  const defaultKind: WorkKind = activities.length === 1 && activities[0] === 'musician' ? 'Release'
    : activities.length === 1 && activities[0] === 'writer' ? 'Book' : 'Artwork'

  const [adding, setAdding] = useState(false)
  const [kindFilter, setKindFilter] = useState<WorkKind | null>(null)

  const works = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const usedKinds = WORK_KINDS.filter(k => works.some(w => kindOf(w) === k))
  const shown = works
    .filter(w => !kindFilter || kindOf(w) === kindFilter)
    .sort((a, b) => (workYear(b) ?? 0) - (workYear(a) ?? 0) || a.title.localeCompare(b.title))

  const colH = (t: string) => <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAAAAA' }}>{t}</span>
  const filterBtn = (label: string, count: number, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: narrow ? 'auto' : '100%', flexShrink: 0, padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#666666', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>
      <span>{label}</span>
      <span style={{ fontSize: 10, color: '#AAAAAA', fontWeight: 400 }}>{count}</span>
    </button>
  )
  const columns = narrow ? '44px minmax(0, 1fr) 48px' : '52px minmax(0, 1fr) 110px 150px 70px'

  return (
    <Shell>
      {adding && <NewWorkForm defaultKind={kindFilter ?? defaultKind} onDone={id => { setAdding(false); if (id != null) navigate(`/studio/${id}`) }} />}

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '220px minmax(0, 1fr)', gap: 10 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {usedKinds.length > 1 && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: narrow ? 10 : '18px 16px', display: 'flex', flexDirection: narrow ? 'row' : 'column', gap: 2, overflowX: narrow ? 'auto' : undefined }}>
              {!narrow && <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', padding: '0 8px 8px', margin: 0 }}>Kind</p>}
              {filterBtn('All', works.length, kindFilter === null, () => setKindFilter(null))}
              {usedKinds.map(k => filterBtn(k, works.filter(w => kindOf(w) === k).length, kindFilter === k, () => setKindFilter(kindFilter === k ? null : k)))}
            </div>
          )}
          {!narrow && (
            <button onClick={() => setAdding(true)} style={{ background: '#F5E642', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              + Add work
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 14px', borderBottom: '1px solid #F5F5F5' }}>
            <p style={{ fontFamily: 'Recoleta, serif', fontSize: 16, margin: 0 }}>{kindFilter ? `${kindFilter}s` : 'Works'}</p>
            <span style={{ marginLeft: 8, background: '#F5F5F5', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#888888' }}>{shown.length}</span>
            <button onClick={() => setAdding(true)} style={{ marginLeft: 'auto', background: narrow ? '#F5E642' : 'none', border: 'none', borderRadius: 8, padding: narrow ? '7px 14px' : 0, fontSize: 10, fontWeight: narrow ? 600 : 400, color: narrow ? '#111111' : '#AAAAAA', cursor: 'pointer', letterSpacing: '0.1em' }}>+ Add</button>
          </div>
          {shown.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No works yet</p>
          ) : (
            <>
              {!narrow && (
                <div style={{ display: 'grid', gridTemplateColumns: columns, padding: '10px 24px', borderBottom: '1px solid #F5F5F5' }}>
                  {['', 'Title', 'Kind', 'Location', 'Year'].map(h => <span key={h}>{colH(h)}</span>)}
                </div>
              )}
              {shown.map(w => {
                const sub = workSubtitle(w)
                return (
                  <button key={w.id} onClick={() => navigate(`/studio/${w.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: columns, width: '100%', padding: narrow ? '12px 16px' : '12px 24px', border: 'none', borderBottom: '1px solid #F9F9F9', background: 'none', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', gap: 0 }}>
                    <div style={{ width: 34, height: 42, borderRadius: 5, background: 'linear-gradient(135deg, #EEEEEE 0%, #DDDDDD 100%)', overflow: 'hidden' }}>
                      {w.image && <img src={w.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</p>
                      <p style={{ fontSize: 10, color: '#AAAAAA', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {narrow ? [kindOf(w), sub].filter(Boolean).join(' · ') : sub || ' '}
                      </p>
                    </div>
                    {!narrow && <span style={{ fontSize: 11, color: '#666666' }}>{kindOf(w)}</span>}
                    {!narrow && <span style={{ fontSize: 11, color: '#888888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.location ?? ''}</span>}
                    <span style={{ fontSize: 10, color: '#BBBBBB', textAlign: 'right' }}>{workYear(w) ?? ''}</span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
