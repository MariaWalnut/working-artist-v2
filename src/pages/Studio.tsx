import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { PRACTICE_KIND, practiceOf, usePractice } from '../lib/practice'
import type { Activity, Project, Work } from '../db/db'
import { isActive, isPlanned, projectSubtitle } from '../lib/projects'
import { linkWorksInProgress } from '../lib/workProjects'
import { NewProjectForm } from '../components/NewProjectForm'
import { PracticeFilter, PracticeSelect } from '../components/Practice'
import { FrameHeader } from '../components/FrameHeader'
import { AddButton, BoxHeading, FrameTitle, SideItem, SidePanel, pageFrame, pageGrid } from '../components/PageFrame'
import { Shell } from '../components/layout/Shell'
import { CategoryField, KindSelect, WorkFields, fieldsFromWork, fieldsToPatch } from '../components/WorkFields'
import { WORK_KINDS, shelfOf, workSubtitle, workYear, type WorkKind } from '../lib/works'

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

function NewWorkForm({ defaultKind, defaultCategory = '', onDone }: { defaultKind: WorkKind; defaultCategory?: string; onDone: (id?: number) => void }) {
  const dept = useActiveDept()
  const { acts, start } = usePractice({ filter: true })
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<WorkKind>(defaultKind)
  const [category, setCategory] = useState(defaultCategory)
  const [practice, setPractice] = useState<Activity | undefined>(start)
  const [fields, setFields] = useState(() => fieldsFromWork(null))
  const [image, setImage] = useState<string | undefined>()
  const [stage, setStage] = useState<'completed' | 'progress' | 'planned'>('completed')

  async function save() {
    if (!title.trim()) return
    const id = await db.works.add({ departmentId: dept?.id, title: title.trim(), kind, category: category.trim() || undefined, practice, image, ...fieldsToPatch(fields, kind) }) as number
    onDone(id)
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '9px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 28, width: 520, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div role="radiogroup" aria-label="Stage" style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'var(--wa-fill)', marginBottom: 16 }}>
          {([['completed', 'Completed'], ['progress', 'In progress'], ['planned', 'Planned']] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={stage === v} onClick={() => setStage(v)}
              style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: stage === v ? 'var(--wa-surface)' : 'none', fontSize: 11, fontWeight: stage === v ? 600 : 400, color: stage === v ? 'var(--wa-ink)' : 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
          ))}
        </div>
        {stage !== 'completed' ? <>
          <NewProjectForm key={stage} status={stage === 'planned' ? 'Planned' : 'Active'} from="works" onDone={() => onDone()} />
          <button onClick={() => onDone()} style={{ marginTop: 10, padding: 0, background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
        </> : <>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title"
          onKeyDown={e => { if (e.key === 'Enter') void save() }}
          style={{ ...inp, marginBottom: 12, fontSize: 14 }} />
        <div style={{ marginBottom: 12 }}>
          <KindSelect value={kind} onChange={setKind} style={inp} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <PracticeSelect labelled value={practice ?? practiceOf(acts).work({ kind })} onChange={setPractice} style={inp} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <CategoryField value={category} onChange={setCategory} practice={practice ?? practiceOf(acts).work({ kind })} style={inp} />
        </div>
        <WorkFields kind={kind} values={fields} onChange={setFields} inp={inp} columns={2}
          onIsbnFound={r => { if (r.title && !title.trim()) setTitle(r.title); if (r.image) setImage(r.image) }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => void save()} style={{ background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
          <button onClick={() => onDone()} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
        </div>
        </>}
      </div>
    </div>
  )
}

export function Studio() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const { acts, start, keep } = usePractice({ filter: true })
  const defaultKind: WorkKind = PRACTICE_KIND[start ?? acts[0]] ?? 'Artwork'

  const [adding, setAdding] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  const allWorks = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  // A work is what a project becomes once it is completed, so a work still in progress waits behind its project.
  const works = allWorks.filter(w => !w.inProgress && keep(practiceOf(acts).work(w)))
  // Categories, and the kind for works without one, fullest first.
  const count = (shelf: string) => works.filter(w => shelfOf(w) === shelf).length
  const shelves = [...new Set(works.map(shelfOf))].sort((a, b) => count(b) - count(a) || a.localeCompare(b))
  const shelf = picked && shelves.includes(picked) ? picked : null
  const shelfKind = WORK_KINDS.find(k => k === shelf)
  const shown = works
    .filter(w => !shelf || shelfOf(w) === shelf)
    .sort((a, b) => (workYear(b) ?? 0) - (workYear(a) ?? 0) || a.title.localeCompare(b.title))

  const makingCount = allWorks.filter(w => w.inProgress).length
  useEffect(() => { if (dept?.id != null && makingCount > 0) void linkWorksInProgress(dept.id) }, [dept?.id, makingCount])
  const allProjects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const notYetWorks = shelf ? [] : allProjects
    .filter(p => keep(practiceOf(acts).project(p)) && !works.some(w => w.id === p.workId || w.projectId === p.id))
    .sort((a, b) => a.title.localeCompare(b.title))
  const ongoing = notYetWorks.filter(isActive)
  const planned = notYetWorks.filter(isPlanned)
  const columns = narrow ? '44px minmax(0, 1fr) 48px' : '52px minmax(0, 1fr) 110px 150px 70px'

  const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: columns, width: '100%', padding: narrow ? '12px 16px' : '12px 24px', border: 'none', background: 'none', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', gap: 0 }

  const workRow = (w: Work, i: number, all: Work[]) => {
    const sub = workSubtitle(w)
    return (
                  <button key={w.id} data-tour-title={w.title} onClick={() => navigate(`/studio/${w.id}`)}
                    style={{ ...rowStyle, borderBottom: i < all.length - 1 ? '1px solid var(--wa-line)' : 'none' }}>
                    <div style={{ width: 34, height: 42, borderRadius: 5, background: 'linear-gradient(135deg, var(--wa-line) 0%, var(--wa-line) 100%)', overflow: 'hidden' }}>
                      {w.image && <img src={w.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--wa-ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</p>
                      {(narrow || sub) && <p style={{ fontSize: 10, color: 'var(--wa-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{narrow ? [shelfOf(w), sub].filter(Boolean).join(' · ') : sub}</p>}
                    </div>
                    {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>{shelfOf(w)}</span>}
                    {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.location ?? ''}</span>}
                    <span style={{ fontSize: 10, color: 'var(--wa-muted)', textAlign: 'right' }}>{workYear(w) ?? ''}</span>
                  </button>
    )
  }

  const typeLabel = (p: Project) => p.projectType === 'Books' || p.projectType === 'Publications' ? 'Book' : p.projectType
  const projectRow = (p: Project, i: number) => (
    <button key={`p${p.id}`} data-tour-title={p.title} onClick={() => navigate(`/projects/${p.id}`, { state: { from: 'works' } })}
      style={{ ...rowStyle, borderTop: i > 0 ? '1px solid var(--wa-line)' : 'none', borderBottom: 'none' }}>
      <div style={{ width: 34, height: 42, borderRadius: 5, background: 'var(--wa-line)' }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--wa-ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
        {(narrow || projectSubtitle(p)) && <p style={{ fontSize: 10, color: 'var(--wa-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{narrow ? [typeLabel(p), projectSubtitle(p)].filter(Boolean).join(' · ') : projectSubtitle(p)}</p>}
      </div>
      {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>{typeLabel(p)}</span>}
      {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location ?? ''}</span>}
      <span style={{ fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap', color: p.status === 'On hold' ? 'var(--wa-ink)' : 'var(--wa-muted)', fontWeight: p.status === 'On hold' ? 600 : 400 }}>{isPlanned(p) ? '' : p.status ?? 'Active'}</span>
    </button>
  )

  // Each stage is its own box; the first one sits under the page title.
  const boxes = [
    { label: 'In progress', count: ongoing.length, onAdd: () => setAddingProject(true), rows: ongoing.map(projectRow) },
    { label: 'Planned', count: planned.length, onAdd: undefined, rows: planned.map(projectRow) },
    { label: 'Completed', count: shown.length, onAdd: undefined, rows: shown.map(workRow) },
  ].filter(b => b.count > 0)
  const box = (b: typeof boxes[number]) => <><BoxHeading label={b.label} count={b.count} onAdd={b.onAdd} />{b.rows}</>

  return (
    <Shell>
      {addingProject && (
        <div role="dialog" aria-modal="true" aria-label="New project" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onPointerDown={e => { if (e.target === e.currentTarget) setAddingProject(false) }}>
          <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 24, width: 420, maxWidth: '100%', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 14px' }}>New project</p>
            <NewProjectForm from="works" onDone={() => setAddingProject(false)} />
          </div>
        </div>
      )}
      {adding && <NewWorkForm defaultKind={shelfKind ?? defaultKind} defaultCategory={shelf && !shelfKind ? shelf : ''} onDone={id => { setAdding(false); if (id != null) navigate(`/studio/${id}`) }} />}

      <div style={pageGrid(narrow)}>
        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <PracticeFilter narrow={narrow} />
          {shelves.length > 1 && (
            <SidePanel title="Category" narrow={narrow}>
              <SideItem label="All" count={works.length} active={shelf === null} narrow={narrow} onClick={() => setPicked(null)} />
              {shelves.map(s => <SideItem key={s} label={s} count={count(s)} active={shelf === s} narrow={narrow} onClick={() => setPicked(shelf === s ? null : s)} />)}
            </SidePanel>
          )}
        </div>

        {/* List */}
        <div data-tour="works-list" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={pageFrame}>
            <FrameHeader right={<AddButton onClick={() => setAdding(true)} />}>
              <FrameTitle count={shown.length + ongoing.length + planned.length}>{shelfKind ? `${shelfKind}s` : shelf ?? 'Works'}</FrameTitle>
            </FrameHeader>
            {boxes.length === 0 && <p style={{ textAlign: 'center', padding: '36px 0', margin: 0, fontSize: 11, color: 'var(--wa-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No works yet</p>}
            {boxes[0] && box(boxes[0])}
          </div>
          {boxes.slice(1).map(b => <div key={b.label} style={pageFrame}>{box(b)}</div>)}
        </div>
      </div>
    </Shell>
  )
}
