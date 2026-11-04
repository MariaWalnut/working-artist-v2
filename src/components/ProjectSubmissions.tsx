import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Opportunity } from '../db/db'
import { OPP_STATUSES } from '../pages/Opportunities'
import { PickPopover } from './PickPopover'

// The submissions a project went out to. A submission can belong to several projects, and is the same
// entry as on the Submissions page, so a status changed here changes there.
export function ProjectSubmissions({ projectId, deptId, labelStyle }: { projectId: number; deptId?: number; labelStyle?: React.CSSProperties }) {
  const navigate = useNavigate()
  const all = useLiveQuery(() => deptId == null ? [] : db.opportunities.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const [adding, setAdding] = useState(false)
  const linked = all.filter(o => o.projectIds?.includes(projectId)).sort((a, b) => (b.deadline ?? '').localeCompare(a.deadline ?? ''))
  const others = all.filter(o => !o.projectIds?.includes(projectId))

  const link = (o: Opportunity) => db.opportunities.update(o.id!, { projectIds: [...(o.projectIds ?? []), projectId] })
  const unlink = (o: Opportunity) => db.opportunities.update(o.id!, { projectIds: (o.projectIds ?? []).filter(x => x !== projectId) })
  const date = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  async function create(title: string) {
    await db.opportunities.add({ departmentId: deptId, title, opportunityType: 'Open call', status: 'Draft', projectIds: [projectId] })
    setAdding(false)
  }

  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={labelStyle}>Submissions</p>
        <button onClick={() => setAdding(v => !v)} style={{ background: 'none', border: '1px solid var(--wa-line)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--wa-muted)', cursor: 'pointer' }}>+ Add</button>
        {adding && <PickPopover items={others.map(o => ({ id: o.id!, label: o.title, sub: o.organisation }))} placeholder="Search submissions" newLabel={t => `+ New submission: ${t}`}
          onPick={id => { const o = others.find(x => x.id === id); if (o) void link(o); setAdding(false) }} onCreate={t => void create(t)} onClose={() => setAdding(false)} />}
      </div>
      {linked.length === 0 && <p style={{ fontSize: 12, color: 'var(--wa-muted)', margin: '4px 0 0' }}>Not sent anywhere yet.</p>}
      {linked.map(o => {
        const out = o.status === 'Rejected' || o.status === 'Closed'
        const good = o.status === 'Won' || o.status === 'Shortlisted'
        return (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--wa-line)' }}>
            <button onClick={() => navigate(`/opportunities?o=${o.id}`)} style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: out ? 'var(--wa-muted)' : 'var(--wa-ink)' }}>{o.title}</span>
              {(o.organisation || o.deadline) && <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 2 }}>{[o.organisation, date(o.deadline)].filter(Boolean).join(' · ')}</span>}
            </button>
            <select value={o.status} aria-label={`Status of ${o.title}`} onChange={e => void db.opportunities.update(o.id!, { status: e.target.value })}
              style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', background: good ? 'var(--accent)' : 'var(--wa-fill)', color: good ? '#111111' : out ? 'var(--wa-muted)' : 'var(--wa-ink)' }}>
              {OPP_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => void unlink(o)} aria-label={`Unlink ${o.title}`} style={{ flexShrink: 0, background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer' }}>×</button>
          </div>
        )
      })}
    </div>
  )
}
