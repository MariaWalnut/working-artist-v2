import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { PRACTICE_KIND, practiceOf, usePractice } from '../lib/practice'
import type { Activity } from '../db/db'
import { PracticeFilter, PracticeSelect } from '../components/Practice'
import { FrameHeader } from '../components/FrameHeader'
import { AddButton, FrameTitle, SideItem, SidePanel, pageFrame, pageGrid } from '../components/PageFrame'
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

  async function save() {
    if (!title.trim()) return
    const id = await db.works.add({ departmentId: dept?.id, title: title.trim(), kind, category: category.trim() || undefined, practice, image, ...fieldsToPatch(fields, kind) }) as number
    onDone(id)
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '9px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 28, width: 520, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', marginBottom: 16 }}>Add work</p>
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
  const [picked, setPicked] = useState<string | null>(null)

  const allWorks = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const works = allWorks.filter(w => keep(practiceOf(acts).work(w)))
  // Categories, and the kind for works without one, fullest first.
  const count = (shelf: string) => works.filter(w => shelfOf(w) === shelf).length
  const shelves = [...new Set(works.map(shelfOf))].sort((a, b) => count(b) - count(a) || a.localeCompare(b))
  const shelf = picked && shelves.includes(picked) ? picked : null
  const shelfKind = WORK_KINDS.find(k => k === shelf)
  const shown = works
    .filter(w => !shelf || shelfOf(w) === shelf)
    .sort((a, b) => (workYear(b) ?? 0) - (workYear(a) ?? 0) || a.title.localeCompare(b.title))

  const colH = (t: string) => <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wa-muted)' }}>{t}</span>
  const columns = narrow ? '44px minmax(0, 1fr) 48px' : '52px minmax(0, 1fr) 110px 150px 70px'

  return (
    <Shell>
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
        <div data-tour="works-list" style={pageFrame}>
          <FrameHeader right={<AddButton onClick={() => setAdding(true)} />}>
            <FrameTitle count={shown.length}>{shelfKind ? `${shelfKind}s` : shelf ?? 'Works'}</FrameTitle>
          </FrameHeader>
          {shown.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 11, color: 'var(--wa-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No works yet</p>
          ) : (
            <>
              {!narrow && (
                <div style={{ display: 'grid', gridTemplateColumns: columns, padding: '10px 24px', borderBottom: '1px solid var(--wa-line)' }}>
                  {['', 'Title', 'Category', 'Location', 'Year'].map(h => <span key={h}>{colH(h)}</span>)}
                </div>
              )}
              {shown.map(w => {
                const sub = workSubtitle(w)
                return (
                  <button key={w.id} data-tour-title={w.title} onClick={() => navigate(`/studio/${w.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: columns, width: '100%', padding: narrow ? '12px 16px' : '12px 24px', border: 'none', borderBottom: '1px solid var(--wa-line)', background: 'none', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', gap: 0 }}>
                    <div style={{ width: 34, height: 42, borderRadius: 5, background: 'linear-gradient(135deg, var(--wa-line) 0%, var(--wa-line) 100%)', overflow: 'hidden' }}>
                      {w.image && <img src={w.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--wa-ink)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</p>
                      <p style={{ fontSize: 10, color: 'var(--wa-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {narrow ? [shelfOf(w), sub].filter(Boolean).join(' · ') : sub || ' '}
                      </p>
                    </div>
                    {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>{shelfOf(w)}</span>}
                    {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.location ?? ''}</span>}
                    <span style={{ fontSize: 10, color: 'var(--wa-muted)', textAlign: 'right' }}>{workYear(w) ?? ''}</span>
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
