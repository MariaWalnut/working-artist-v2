import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Opportunity } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { Hint } from '../components/Hint'
import { FrameHeader } from '../components/FrameHeader'
import { AddButton, FrameTitle, SideItem, SidePanel, pageFrame, pageGrid } from '../components/PageFrame'
import { useNarrow } from '../lib/useNarrow'
import { PracticeFilter, PracticeSelect } from '../components/Practice'
import { practiceOf, usePractice } from '../lib/practice'
import type { Activity } from '../db/db'

const OPP_TYPES = ['Open call', 'Grant', 'Residency', 'Publisher proposal', 'Press', 'Commission']
export const OPP_STATUSES = ['Active', 'Draft', 'Applied', 'Shortlisted', 'Accepted', 'Won', 'Rejected', 'Closed']
const FINISHED = ['Won', 'Accepted', 'Rejected', 'Closed']

// Open submissions stand out; finished ones step back. Won keeps its colour.
const BADGE: Record<string, string> = {
  Active:      'bg-[var(--wa-ink)] text-[var(--wa-surface)]',
  Draft:       'text-[var(--wa-ink)]',
  Applied:     'bg-[var(--accent)] text-[#111111]',
  Shortlisted: 'bg-[var(--accent)] text-[#111111]',
  Won:         'bg-[var(--accent)] text-[#111111]',
  Accepted:    'bg-[var(--accent)] text-[#111111]',
  Rejected:    'text-[var(--wa-muted)]',
  Closed:      'text-[var(--wa-muted)]',
}

const BADGE_BORDER: Record<string, string> = {
  Draft: 'border border-dashed border-[var(--wa-ink)]',
  Rejected: 'border border-[var(--wa-line)]',
  Closed: 'border border-[var(--wa-line)]',
}

function badge(status: string) {
  return `inline-block text-[9px] font-semibold uppercase tracking-[0.08em] px-[9px] py-[4px] rounded-full whitespace-nowrap ${BADGE[status] ?? BADGE.Applied} ${BADGE_BORDER[status] ?? ''}`
}

function OppForm({ opp, onDone }: { opp: Opportunity | null; onDone: () => void }) {
  const dept = useActiveDept()
  const { acts, start } = usePractice({ filter: true })
  const [practice, setPractice] = useState<Activity | undefined>(opp ? opp.practice : start)
  const [title, setTitle] = useState(opp?.title ?? '')
  const [type, setType] = useState(opp?.opportunityType ?? 'Open call')
  const [org, setOrg] = useState(opp?.organisation ?? '')
  const [status, setStatus] = useState(opp?.status ?? 'Active')
  const [deadline, setDeadline] = useState(opp?.deadline ?? '')
  const [notes, setNotes] = useState(opp?.notes ?? '')
  const [projectIds, setProjectIds] = useState<number[]>(opp?.projectIds ?? [])
  const projects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  async function save() {
    if (!title.trim()) return
    const data = { departmentId: dept?.id, title: title.trim(), opportunityType: type, organisation: org, status, deadline: deadline || undefined, notes, practice, projectIds: projectIds.length ? projectIds : undefined }
    if (opp?.id != null) await db.opportunities.update(opp.id, data)
    else await db.opportunities.add(data)
    onDone()
  }

  const inp = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '9px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none' as const, width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 24, width: 480, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', marginBottom: 16 }}>{opp ? 'Edit' : 'New opportunity'}</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Opportunity name" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1 }}>{OPP_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, flex: 1 }}>{OPP_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        </div>
        <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Organisation / City" style={{ ...inp, marginBottom: 10 }} />
        <PracticeSelect value={practice ?? practiceOf(acts).opportunity({ opportunityType: type })} onChange={setPractice} style={{ ...inp, marginBottom: 10 }} />
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={3}
          style={{ ...inp, resize: 'none', marginBottom: projects.length ? 12 : 16 }} />
        {projects.length > 0 && <>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 6px' }}>Projects</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto', marginBottom: 16 }}>
            {projects.map(p => {
              const on = projectIds.includes(p.id!)
              return (
                <button key={p.id} type="button" onClick={() => setProjectIds(on ? projectIds.filter(x => x !== p.id) : [...projectIds, p.id!])}
                  style={{ padding: '4px 11px', borderRadius: 999, border: on ? '1px solid transparent' : '1px solid var(--wa-line)', background: on ? 'var(--accent)' : 'transparent', color: on ? '#111111' : 'var(--wa-text)', fontSize: 11, fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {p.title}
                </button>
              )
            })}
          </div>
        </>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} style={{ background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{opp ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
          {opp && <button onClick={async () => { if (opp.id) await db.opportunities.delete(opp.id); onDone() }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

export function Opportunities() {
  const dept = useActiveDept()
  const narrow = useNarrow()
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editing, setEditing] = useState<Opportunity | 'new' | null>(null)
  const { acts, keep } = usePractice({ filter: true })

  const allOpps = useLiveQuery(() => dept?.id == null ? [] : db.opportunities.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const opps = allOpps.filter(o => keep(practiceOf(acts).opportunity(o)))
  const projectTitles = new Map((useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []).map(p => [p.id!, p.title]))
  const forProjects = (o: Opportunity) => (o.projectIds ?? []).map(id => projectTitles.get(id)).filter(Boolean)

  // A link from a project opens that submission (?o=).
  const [params, setParams] = useSearchParams()
  const oParam = params.get('o')
  useEffect(() => {
    if (!oParam) return
    const o = allOpps.find(x => x.id === Number(oParam))
    if (o) { setEditing(o); setParams({}, { replace: true }) }
  }, [oParam, allOpps.length])

  // Only the types in use; a filter left on a type that has gone would hide everything.
  const usedTypes = [...new Set(opps.map(o => o.opportunityType).filter((t): t is string => !!t))].sort()
  const activeType = typeFilter && usedTypes.includes(typeFilter) ? typeFilter : null
  const filtered = opps.filter(o => {
    if (activeType && o.opportunityType !== activeType) return false
    if (statusFilter === 'Open') return !FINISHED.includes(o.status)
    if (statusFilter !== 'All') return o.status === statusFilter
    return true
  }).sort((a, b) => Number(FINISHED.includes(a.status)) - Number(FINISHED.includes(b.status)) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))

  const statusFilters: Array<[string, number]> = [
    ['All', opps.length],
    ['Open', opps.filter(o => !FINISHED.includes(o.status)).length],
    ...OPP_STATUSES.filter(st => st !== 'Active').map((st): [string, number] => [st, opps.filter(o => o.status === st).length]).filter(([, n]) => n > 0),
  ]

  return (
    <Shell>
      {editing !== null && <OppForm opp={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      <div style={pageGrid(narrow)}>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <PracticeFilter narrow={narrow} />
          <SidePanel title="Status" narrow={narrow}>
            {statusFilters.map(([s, n]) => <SideItem key={s} label={s} count={n} active={statusFilter === s} narrow={narrow} onClick={() => setStatusFilter(s)} />)}
          </SidePanel>
          {usedTypes.length > 1 && (
            <SidePanel title="Type" narrow={narrow}>
              <SideItem label="All" active={activeType === null} narrow={narrow} onClick={() => setTypeFilter(null)} />
              {usedTypes.map(t => <SideItem key={t} label={t} count={opps.filter(o => o.opportunityType === t).length} active={typeFilter === t} narrow={narrow} onClick={() => setTypeFilter(t)} />)}
            </SidePanel>
          )}
        </div>

        {/* Right */}
        <div data-tour="subs-list" style={{ ...pageFrame, display: 'flex', flexDirection: 'column' }}>
          <FrameHeader right={<AddButton onClick={() => setEditing('new')} />}>
            <FrameTitle count={filtered.length}>Submissions</FrameTitle>
          </FrameHeader>
          {/* Column headers */}
          {!narrow && <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 36px', padding: '14px 24px', borderBottom: '1px solid var(--wa-line)' }}>
            {['Title', 'Type', 'Deadline', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wa-muted)' }}>{h}</span>
            ))}
          </div>}

          {filtered.length === 0 ? (
            <div style={{ padding: '40px 24px' }}><p style={{ textAlign: 'center', margin: '0 0 16px', fontSize: 11, color: 'var(--wa-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No submissions</p><Hint id="subs-start" style={{ maxWidth: 420, margin: '0 auto' }}>Add the calls, grants and proposals you are working on with + Add.</Hint></div>
          ) : filtered.map(o => {
            const today = new Date().toISOString().slice(0, 10)
            const notSent = o.status === 'Active' || o.status === 'Draft'
            const overdue = notSent && !!o.deadline && o.deadline < today
            const isDraft = o.status === 'Draft'
            const finished = o.status === 'Rejected' || o.status === 'Closed'
            const days = notSent && o.deadline && !overdue
              ? Math.round((new Date(o.deadline).setHours(0,0,0,0) - new Date(today).setHours(0,0,0,0)) / 86400000)
              : null
            const critical = days !== null && days <= 2
            const urgent = days !== null && days <= 7
            const rowBg = critical ? 'rgba(224,82,82,0.04)' : urgent ? 'rgba(240,160,32,0.05)' : 'transparent'
            const deadlineColor = overdue ? 'var(--wa-red)' : critical ? 'var(--wa-red)' : urgent ? 'var(--wa-amber)' : 'var(--wa-muted)'
            const deadlineCell = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: deadlineColor }}>
                    {o.deadline ? new Date(o.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : o.sentDate ? `Sent ${new Date(o.sentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : '—'}
                  </span>
                  {overdue && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--wa-red)', background: 'rgba(224,82,82,0.1)', padding: '1px 5px', borderRadius: 4 }}>overdue</span>}
                  {!overdue && critical && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--wa-red)', background: 'rgba(224,82,82,0.1)', padding: '1px 5px', borderRadius: 4 }}>{days === 0 ? 'today' : days === 1 ? '1d' : `${days}d`}</span>}
                  {!overdue && !critical && urgent && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--wa-amber)', background: 'rgba(240,160,32,0.1)', padding: '1px 5px', borderRadius: 4 }}>{days}d</span>}
                </div>
            )
            const rowStyle: React.CSSProperties = { borderBottom: '1px solid var(--wa-line)', cursor: 'pointer', background: rowBg, borderLeft: critical ? '3px solid #E05252' : urgent ? '3px solid #F0A020' : '3px solid transparent' }
            if (narrow) return (
              <div key={o.id} onClick={() => setEditing(o)} style={{ ...rowStyle, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: finished ? 400 : 500, color: finished ? 'var(--wa-muted)' : 'var(--wa-ink)', margin: '0 0 3px' }}>{o.title}</p>
                  <p style={{ fontSize: 11, color: isDraft ? 'var(--wa-muted)' : 'var(--wa-muted)', margin: 0 }}>{[o.opportunityType, o.organisation, ...forProjects(o)].filter(Boolean).join(' · ')}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span className={badge(o.status)}>{o.status}</span>
                  {deadlineCell}
                </div>
              </div>
            )
            return (
              <div key={o.id} onClick={() => setEditing(o)} style={{ ...rowStyle, display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 36px', padding: '14px 24px', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: finished ? 400 : 500, color: finished ? 'var(--wa-muted)' : 'var(--wa-ink)', margin: '0 0 2px' }}>{o.title}</p>
                  {(o.organisation || forProjects(o).length > 0) && <p style={{ fontSize: 10, color: isDraft ? 'var(--wa-muted)' : 'var(--wa-muted)', margin: 0 }}>{[o.organisation, ...forProjects(o)].filter(Boolean).join(' · ')}</p>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: isDraft ? 'var(--wa-muted)' : 'var(--wa-text-2)' }}>{o.opportunityType ?? '—'}</span>
                {deadlineCell}
                <span className={badge(o.status)}>{o.status}</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: o.status === 'Shortlisted' || o.status === 'Won' ? 'var(--accent)' : (isDraft ? 'var(--wa-line)' : 'var(--wa-line)'), margin: 'auto' }} />
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
