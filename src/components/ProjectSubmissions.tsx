import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Opportunity, type Project } from '../db/db'
import { OPP_STATUSES } from '../pages/Opportunities'
import { PickPopover } from './PickPopover'

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: 'none', background: 'var(--wa-fill)', padding: '8px 10px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', fontFamily: 'inherit' }
const small: React.CSSProperties = { fontSize: 11, color: 'var(--wa-muted)', marginBottom: 3, display: 'block' }

// Where a project was sent: a short form under + Add. Linking an entry that already exists is the second choice.
function SendForm({ names, others, onSend, onLink, onClose }: {
  names: string[]; others: Opportunity[]
  onSend: (to: string, sent: string, status: string) => void
  onLink: (o: Opportunity) => void
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [to, setTo] = useState('')
  const [sent, setSent] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [status, setStatus] = useState('Applied')
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [onClose])

  return (
    <div ref={box} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 'min(300px, calc(100vw - 72px))', background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,.14)', padding: 12, boxSizing: 'border-box' }}>
      {linking ? (
        <PickPopover inline items={others.map(o => ({ id: o.id!, label: o.title, sub: o.organisation }))} placeholder="Search submissions"
          onPick={id => { const o = others.find(x => x.id === id); if (o) onLink(o) }} onClose={onClose} />
      ) : (
        <form onSubmit={e => { e.preventDefault(); if (to.trim()) onSend(to.trim(), sent, status) }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label><span style={small}>Sent to</span>
            <input autoFocus list="sent-to-names" value={to} onChange={e => setTo(e.target.value)} placeholder="Publisher, agent, fund" style={inp} />
            <datalist id="sent-to-names">{names.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0 }}><span style={small}>Date</span><input type="date" value={sent} onChange={e => setSent(e.target.value)} style={inp} /></label>
            <label style={{ flex: 1, minWidth: 0 }}><span style={small}>Status</span>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>{OPP_STATUSES.filter(s => s !== 'Active' && s !== 'Draft').map(s => <option key={s}>{s}</option>)}</select>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
            <button type="submit" style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
            {others.length > 0 && <button type="button" onClick={() => setLinking(true)} style={{ padding: 0, border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Link an existing one</button>}
          </div>
        </form>
      )}
    </div>
  )
}

// Who a project went to. An entry can belong to several projects and is the same one as on the
// Submissions page, so a status changed here changes there.
export function ProjectSubmissions({ project, deptId, labelStyle, addStyle }: { project: Project; deptId?: number; labelStyle?: React.CSSProperties; addStyle?: React.CSSProperties }) {
  const navigate = useNavigate()
  const projectId = project.id!
  const all = useLiveQuery(() => deptId == null ? [] : db.opportunities.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const contacts = useLiveQuery(() => deptId == null ? [] : db.contacts.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const [adding, setAdding] = useState(false)
  const when = (o: Opportunity) => o.sentDate ?? o.deadline ?? ''
  const linked = all.filter(o => o.projectIds?.includes(projectId)).sort((a, b) => when(b).localeCompare(when(a)))
  const others = all.filter(o => !o.projectIds?.includes(projectId))
  const names = [...new Set([...contacts.map(c => c.organisation), ...all.map(o => o.organisation)].filter((n): n is string => !!n?.trim()))].sort()

  const link = (o: Opportunity) => db.opportunities.update(o.id!, { projectIds: [...(o.projectIds ?? []), projectId] })
  const unlink = (o: Opportunity) => db.opportunities.update(o.id!, { projectIds: (o.projectIds ?? []).filter(x => x !== projectId) })
  const date = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  async function send(to: string, sentDate: string, status: string) {
    const book = project.projectType === 'Books' || project.projectType === 'Publications'
    await db.opportunities.add({ departmentId: deptId, title: project.title, organisation: to, opportunityType: book ? 'Publisher proposal' : 'Open call', status, sentDate: sentDate || undefined, projectIds: [projectId], practice: project.practice })
    setAdding(false)
  }

  return (
    <div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={labelStyle}>Submissions</p>
        <button onClick={() => setAdding(v => !v)} style={addStyle}>+ Add</button>
        {adding && <SendForm names={names} others={others} onSend={(t, s, st) => void send(t, s, st)} onLink={o => { void link(o); setAdding(false) }} onClose={() => setAdding(false)} />}
      </div>
      {linked.map(o => {
        const out = o.status === 'Rejected' || o.status === 'Closed'
        const good = o.status === 'Won' || o.status === 'Accepted' || o.status === 'Shortlisted'
        return (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--wa-line)' }}>
            <button onClick={() => navigate(`/opportunities?o=${o.id}`)} style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: out ? 'var(--wa-muted)' : 'var(--wa-ink)' }}>{o.organisation || o.title}</span>
              {when(o) && <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 2 }}>{date(when(o))}</span>}
            </button>
            <select value={o.status} aria-label={`Status of ${o.organisation || o.title}`} onChange={e => void db.opportunities.update(o.id!, { status: e.target.value })}
              style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', background: good ? 'var(--accent)' : 'var(--wa-fill)', color: good ? '#111111' : out ? 'var(--wa-muted)' : 'var(--wa-ink)' }}>
              {OPP_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => void unlink(o)} aria-label={`Unlink ${o.organisation || o.title}`} style={{ flexShrink: 0, background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer' }}>×</button>
          </div>
        )
      })}
    </div>
  )
}
