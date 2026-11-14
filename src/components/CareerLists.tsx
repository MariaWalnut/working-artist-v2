import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { practiceOf, usePractice } from '../lib/practice'
import { parseLooseDate } from '../lib/works'
import { formatAnyDate } from '../lib/eventDates'

// The two list boxes on Career: recognition and rights sold, newest first.

const row: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 16px', border: 'none', borderBottom: '1px solid var(--wa-line)', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
const title: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', lineHeight: 1.35 }
const sub: React.CSSProperties = { display: 'block', fontSize: 11, color: 'var(--wa-text-2)', marginTop: 2 }
const empty: React.CSSProperties = { margin: 0, padding: '28px 16px', textAlign: 'center', fontSize: 12, color: 'var(--wa-text-2)' }

function useStudio() {
  const dept = useActiveDept()
  const { acts, keep } = usePractice()
  const works = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const press = useLiveQuery(() => dept?.id == null ? [] : db.pressEntries.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const of = practiceOf(acts, works)
  return { works: works.filter(w => keep(of.work(w))), press: press.filter(p => keep(of.press(p))) }
}

const sortKey = (d: [number, number] | null) => d ? d[0] * 100 + d[1] : 0

export function RecognitionList() {
  const navigate = useNavigate()
  const { press } = useStudio()
  const sorted = [...press].sort((a, b) => sortKey(parseLooseDate(b.date)) - sortKey(parseLooseDate(a.date)))
  if (sorted.length === 0) return <p style={empty}>No press or awards yet.</p>
  return (
    <div>
      {sorted.map(p => (
        <button key={p.id} onClick={() => navigate('/career/recognition')} style={row}>
          <span style={title}>{p.title}</span>
          <span style={sub}>{[p.category === 'award' ? 'Award' : p.type || 'Press', p.outlet, formatAnyDate(p.date)].filter(Boolean).join(' · ')}</span>
        </button>
      ))}
    </div>
  )
}

export function RightsList() {
  const navigate = useNavigate()
  const { works } = useStudio()
  const sold = works.flatMap(w => (w.rights ?? []).filter(r => r.status === 'sold').map(r => ({ w, r })))
    .sort((a, b) => ((b.r.year ?? 0) * 100 + (b.r.month ?? 0)) - ((a.r.year ?? 0) * 100 + (a.r.month ?? 0)))
  if (sold.length === 0) return <p style={empty}>No rights sold yet.</p>
  return (
    <div>
      {sold.map(({ w, r }) => (
        <button key={`${w.id}-${r.id}`} onClick={() => navigate(`/studio/${w.id}`)} style={row}>
          <span style={title}>{w.title}</span>
          <span style={sub}>{[r.language, r.publisher, r.year ? (r.month ? new Date(r.year, r.month - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : String(r.year)) : null].filter(Boolean).join(' · ')}</span>
        </button>
      ))}
    </div>
  )
}
