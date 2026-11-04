import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type RightItem } from '../db/db'
import { Shell } from '../components/layout/Shell'
import { PeopleCard } from '../components/PeopleCard'
import { CategoryField, KindSelect, WorkFields, fieldsFromWork, fieldsToPatch, type FieldValues } from '../components/WorkFields'
import { PracticeSelect } from '../components/Practice'
import { practiceOf, usePractice } from '../lib/practice'
import type { Activity } from '../db/db'
import { KIND_FIELDS, fieldDisplay, kindOf, shelfOf, type WorkKind } from '../lib/works'
import { formatAnyDate, formatEventDate } from '../lib/eventDates'
import { DateFields } from '../components/DateFields'
import { ContractCard, money, parseAmount } from '../components/ContractCard'
import { fileToDataUrl } from '../lib/images'

const RIGHT_STATUSES: Array<RightItem['status']> = ['live', 'sold', 'pending']
const PRESS_TYPES = ['Interview', 'Feature', 'Selection', 'Review', 'Mention', 'Profile']
const NARROW = '(max-width: 900px)'

function uid() { return Math.random().toString(36).slice(2) }

const RIGHT_BADGE: Record<string, React.CSSProperties> = {
  live:    { background: 'var(--accent)', color: '#111111' },
  sold:    { background: 'var(--wa-fill)', color: 'var(--wa-text-2)' },
  pending: { background: 'transparent', color: 'var(--wa-muted)', border: '1px dashed var(--wa-line)' },
}

function sectionLabel(text: string) {
  return <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 12px' }}>{text}</p>
}

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

export function WorkDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const narrow = useNarrow()
  const wid = Number(id)
  const imageRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const work = useLiveQuery(() => db.works.get(wid), [wid])
  const linkedEntries = useLiveQuery(() => db.pressEntries.filter(p => p.workId === wid).toArray(), [wid]) ?? []
  const linkedPress = linkedEntries.filter(p => p.category !== 'award')
  const linkedAwards = linkedEntries.filter(p => p.category === 'award')
  const allEvents = useLiveQuery(() => db.eventEntries.toArray(), []) ?? []
  const peopleCount = useLiveQuery(() => db.contacts.filter(c => (c.workIds ?? []).includes(wid)).count(), [wid]) ?? 0
  const [linkingEvent, setLinkingEvent] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [kind, setKind] = useState<WorkKind>('Artwork')
  const [category, setCategory] = useState('')
  const [practice, setPractice] = useState<Activity | undefined>()
  const { acts } = usePractice()
  const [fields, setFields] = useState<FieldValues>(() => fieldsFromWork(null))
  const [pendingImage, setPendingImage] = useState<string | undefined>()
  const [addingPress, setAddingPress] = useState(false)
  const [pressOutlet, setPressOutlet] = useState('')
  const [pressTitle, setPressTitle] = useState('')
  const [pressDate, setPressDate] = useState('')
  const [pressUrl, setPressUrl] = useState('')
  const [pressType, setPressType] = useState('')
  const [addingRight, setAddingRight] = useState(false)
  const [addingPeople, setAddingPeople] = useState(false)
  const fromProject = useLiveQuery(async () => { const x = await db.works.get(wid); return x?.projectId != null ? db.projects.get(x.projectId) : undefined }, [wid])
  const [shown, setShown] = useState(0) // the picture in view
  const [dropping, setDropping] = useState(false)
  const [rightLang, setRightLang] = useState('')
  const [rightPub, setRightPub] = useState('')
  const [rightYear, setRightYear] = useState('')
  const [rightStatus, setRightStatus] = useState<RightItem['status']>('live')
  const [rightAdvance, setRightAdvance] = useState('')
  const [rightRoyalty, setRightRoyalty] = useState('')
  const [rightRun, setRightRun] = useState('')
  const [rightPrice, setRightPrice] = useState('')

  if (work === undefined) return null
  if (!work) { navigate('/studio', { replace: true }); return null }

  const w = work
  const press = w.press ?? []
  const rights = w.rights ?? []
  const wKind = kindOf(w)
  const deptEvents = allEvents
    .filter(e => e.departmentId === w.departmentId)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const shownAt = deptEvents.filter(e => (e.workIds ?? []).includes(wid))
  const linkable = deptEvents.filter(e => !(e.workIds ?? []).includes(wid) && e.type !== 'Meeting')

  async function linkEvent(eventId: number) {
    const ev = deptEvents.find(e => e.id === eventId)
    if (!ev) return
    await db.eventEntries.update(eventId, { workIds: [...(ev.workIds ?? []), wid] } as Partial<typeof ev>)
    setLinkingEvent(false)
  }

  async function unlinkEvent(eventId: number) {
    const ev = deptEvents.find(e => e.id === eventId)
    if (!ev) return
    await db.eventEntries.update(eventId, { workIds: (ev.workIds ?? []).filter(id => id !== wid) } as Partial<typeof ev>)
  }
  const shownFields = KIND_FIELDS[wKind].filter(f => f.key !== 'subtitle' && w[f.key] != null && w[f.key] !== '')

  function startEdit() {
    setTitle(w.title)
    setNotes(w.notes ?? '')
    setKind(wKind)
    setCategory(w.category ?? '')
    setPractice(w.practice)
    setFields(fieldsFromWork(w))
    setPendingImage(undefined)
    setEditing(true)
  }

  async function saveEdit() {
    await db.works.update(wid, {
      ...fieldsToPatch(fields, kind),
      title: title.trim() || w.title,
      notes,
      kind,
      category: category.trim() || undefined,
      practice,
      ...(pendingImage && !w.image ? { image: pendingImage } : {}),
    })
    setEditing(false)
  }

  // The cover comes first; the rest follow in the order they were added.
  const gallery = [w.image, ...(w.pictures ?? [])].filter((x): x is string => !!x)
  const inView = Math.min(shown, Math.max(0, gallery.length - 1))
  const saveGallery = (next: string[]) => db.works.update(wid, { image: next[0], pictures: next.slice(1) })

  async function addPictures(files: FileList | null | undefined) {
    const images = [...(files ?? [])].filter(f => f.type.startsWith('image/'))
    if (!images.length) return
    const added = await Promise.all(images.map(f => fileToDataUrl(f)))
    await saveGallery([...gallery, ...added])
    setShown(gallery.length)
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    await addPictures(files)
    e.target.value = ''
  }

  async function makeCover(i: number) {
    await saveGallery([gallery[i], ...gallery.filter((_, j) => j !== i)])
    setShown(0)
  }

  async function removePicture(i: number) {
    await saveGallery(gallery.filter((_, j) => j !== i))
    setShown(Math.max(0, i - 1))
  }

  async function addPress() {
    if (!pressTitle.trim()) return
    await db.pressEntries.add({
      departmentId: w.departmentId, category: 'press', workId: wid, title: pressTitle.trim(),
      outlet: pressOutlet.trim() || undefined, date: pressDate || undefined, url: pressUrl.trim() || undefined, type: pressType || undefined,
    })
    setPressOutlet(''); setPressTitle(''); setPressDate(''); setPressUrl(''); setPressType(''); setAddingPress(false)
  }

  async function removePress(pid: string) {
    await db.works.update(wid, { press: press.filter(p => p.id !== pid) })
  }

  // Takes a press item off this work; it stays in the press list under Recognition.
  async function unlinkPress(id: number) {
    await db.pressEntries.update(id, { workId: undefined })
  }

  async function addRight() {
    if (!rightLang.trim()) return
    const item: RightItem = {
      id: uid(), language: rightLang.trim(), publisher: rightPub.trim() || undefined, year: rightYear ? Number(rightYear) : undefined, status: rightStatus,
      advance: parseAmount(rightAdvance), royaltyRate: parseAmount(rightRoyalty), printRun: parseAmount(rightRun), price: parseAmount(rightPrice),
    }
    await db.works.update(wid, { rights: [...rights, item] })
    setRightLang(''); setRightPub(''); setRightYear(''); setRightStatus('live'); setRightAdvance(''); setRightRoyalty(''); setRightRun(''); setRightPrice(''); setAddingRight(false)
  }

  async function deleteWork() {
    if (!window.confirm(`Delete "${w.title}"?`)) return
    await db.works.delete(wid)
    navigate('/studio', { replace: true })
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '7px 10px', fontSize: 12, color: 'var(--wa-ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const card: React.CSSProperties = { background: 'var(--wa-surface)', borderRadius: 16, padding: '18px 20px' }
  const addBtn: React.CSSProperties = { background: 'none', border: '1px solid var(--wa-line)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--wa-muted)', cursor: 'pointer', marginTop: -12 }
  const quietBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }
  const pressRows = [
    ...press.filter(Boolean).map(p => ({ key: p.id, title: p.title, outlet: p.outlet ?? '', date: p.date, url: p.url, type: p.type, remove: () => void removePress(p.id) })),
    ...linkedPress.map(p => ({ key: `lp${p.id}`, title: p.title, outlet: p.outlet ?? '', date: p.date, url: p.url, type: p.type, remove: () => void unlinkPress(p.id!) })),
  ]

  // Sections with nothing in them fold into a row of small buttons under the details. People always starts folded.
  const showShown = shownAt.length > 0 || linkingEvent
  const showPeople = addingPeople
  const showPress = pressRows.length > 0 || addingPress
  const showRights = rights.length > 0 || addingRight
  const showNotes = !!w.notes && !editing
  const folded: Array<[string, () => void]> = [
    ...(!showShown && linkable.length > 0 ? [['Shown at', () => setLinkingEvent(true)] as [string, () => void]] : []),
    ...(!showPeople ? [[peopleCount > 0 ? `People (${peopleCount})` : 'People', () => setAddingPeople(true)] as [string, () => void]] : []),
    ...(!showPress ? [['Press', () => setAddingPress(true)] as [string, () => void]] : []),
    ...(!showRights ? [['Rights', () => setAddingRight(true)] as [string, () => void]] : []),
    ...(!w.notes && !editing ? [['Notes', () => { startEdit(); setTimeout(() => notesRef.current?.focus(), 0) }] as [string, () => void]] : []),
  ]

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} aria-label="Title"
            style={{ fontFamily: 'Recoleta, serif', fontSize: 30, lineHeight: 1.15, border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', background: 'none', color: 'var(--wa-ink)', padding: '0 0 2px', width: '100%' }} />
        ) : (
          <h1 style={{ margin: 0, fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 30, lineHeight: 1.15, color: 'var(--wa-ink)', textWrap: 'balance' } as React.CSSProperties}>{w.title}</h1>
        )}
        {!editing && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--wa-text-2)' }}>
            {[w.subtitle, shelfOf(w), w.year].filter(Boolean).join(' · ')}
            {fromProject && <> · <button onClick={() => navigate(`/projects/${fromProject.id}`)} style={{ padding: 0, border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', borderBottom: '1px solid var(--accent)' }}>Project</button></>}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {editing ? (
          <>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void saveEdit()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
          </>
        ) : (
          <button onClick={startEdit} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
        )}
      </div>
    </div>
  )

  const pictures = (
    <div onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }}
      onDragLeave={() => setDropping(false)}
      onDrop={e => { e.preventDefault(); setDropping(false); void addPictures(e.dataTransfer.files) }}
      style={{ ...card, padding: 14, position: narrow ? 'static' : 'sticky', top: 16, outline: dropping ? '2px solid var(--accent)' : 'none' }}>
      <input ref={imageRef} type="file" accept="image/*" multiple hidden onChange={e => void onImagePicked(e)} />
      {gallery.length === 0 ? (
        <button onClick={() => imageRef.current?.click()}
          style={{ width: '100%', aspectRatio: '4 / 3', border: '1px dashed var(--wa-line-strong)', borderRadius: 12, background: 'var(--wa-fill-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)' }}>Add pictures</span>
          <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>or drop them here</span>
        </button>
      ) : (
        <>
          <img src={gallery[inView]} alt={inView === 0 ? w.title : `${w.title}, picture ${inView + 1}`}
            style={{ display: 'block', width: '100%', maxHeight: narrow ? 420 : '70vh', objectFit: 'contain', borderRadius: 12, background: 'var(--wa-fill-2)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {gallery.map((src, i) => (
              <button key={i} onClick={() => setShown(i)} aria-label={`Picture ${i + 1} of ${gallery.length}${i === 0 ? ', cover' : ''}`} aria-pressed={i === inView}
                style={{ width: 56, height: 56, padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'var(--wa-fill-2)', border: i === inView ? '2px solid var(--wa-ink)' : '1px solid var(--wa-line)', boxSizing: 'border-box' }}>
                <img src={src} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
            <button onClick={() => imageRef.current?.click()} aria-label="Add pictures"
              style={{ width: 56, height: 56, borderRadius: 8, border: '1px dashed var(--wa-line-strong)', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--wa-text-2)' }}>+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
            {inView === 0
              ? <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>Cover</span>
              : <button onClick={() => void makeCover(inView)} style={quietBtn}>Make cover</button>}
            <button onClick={() => void removePicture(inView)} style={quietBtn}>Remove</button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => navigate('/studio')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
          ← Works
        </button>
        {narrow && header}

        <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(320px, 1fr)', gap: narrow ? 10 : 24, alignItems: 'start' }}>
          {pictures}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!narrow && <div style={{ padding: '4px 0 8px' }}>{header}</div>}

            <div style={{ ...card }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sectionLabel('Details')}
                  <KindSelect value={kind} onChange={setKind} style={inp} />
                  <PracticeSelect labelled value={practice ?? practiceOf(acts).work({ kind })} onChange={setPractice} style={inp} />
                  <CategoryField value={category} onChange={setCategory} practice={practice ?? practiceOf(acts).work({ kind })} style={inp} />
                  <WorkFields kind={kind} values={fields} onChange={setFields} inp={inp}
                    onIsbnFound={r => { if (r.image) setPendingImage(r.image) }} />
                  <label>
                    <span style={{ fontSize: 9, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Notes</span>
                    <textarea ref={notesRef} value={notes} onChange={e => setNotes(e.target.value)} rows={5} style={{ ...inp, resize: 'vertical' }} />
                  </label>
                  <button onClick={() => void deleteWork()} style={{ ...quietBtn, alignSelf: 'flex-start', marginTop: 6 }}>Delete work…</button>
                </div>
              ) : shownFields.length > 0 ? (
                shownFields.map((f, i) => (
                  <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 12, padding: '9px 0', borderTop: i ? '1px solid var(--wa-line)' : 'none' }}>
                    <div style={{ fontSize: 10, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingTop: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--wa-ink)' }}>{fieldDisplay(f.key, w[f.key], w)}</div>
                  </div>
                ))
              ) : (
                <button onClick={startEdit} style={{ ...quietBtn, fontSize: 12 }}>Add details</button>
              )}
            </div>

            {showShown && (
              <div data-tour="work-shown" style={{ ...card }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  {sectionLabel('Shown at')}
                  {linkable.length > 0 && <button onClick={() => setLinkingEvent(v => !v)} style={addBtn}>+ Add</button>}
                </div>
                {linkingEvent && (
                  <select autoFocus defaultValue="" aria-label="Event" onChange={e => { if (e.target.value) void linkEvent(Number(e.target.value)) }} style={{ ...inp, marginBottom: 10 }}>
                    <option value="">Choose an event…</option>
                    {linkable.map(e => <option key={e.id} value={e.id}>{[e.title, formatEventDate(e.date, e.endDate)].filter(Boolean).join(' · ')}</option>)}
                  </select>
                )}
                {shownAt.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--wa-line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)' }}>{e.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>{[e.type, e.location, formatEventDate(e.date, e.endDate)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button onClick={() => void unlinkEvent(e.id!)} aria-label={`Unlink ${e.title}`} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer', flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {showPeople && w.id != null && <PeopleCard kind="work" id={w.id} deptId={w.departmentId} startAdding={addingPeople && peopleCount === 0} style={{ ...card }} />}
            {(wKind === 'Book' || w.contract || w.contractFile) && <ContractCard key={w.id} work={w} />}

            {showPress && (
              <div style={{ ...card }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  {sectionLabel('Press')}
                  <button onClick={() => setAddingPress(v => !v)} style={addBtn}>+ Add</button>
                </div>
                {addingPress && (
                  <div style={{ background: 'var(--wa-fill-2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <input autoFocus value={pressTitle} onChange={e => setPressTitle(e.target.value)} placeholder="Headline" style={{ ...inp, marginBottom: 6 }} />
                    <input value={pressOutlet} onChange={e => setPressOutlet(e.target.value)} placeholder="Outlet" aria-label="Outlet" style={{ ...inp, marginBottom: 8 }} />
                    <DateFields label="Date" value={pressDate} onChange={setPressDate} inp={inp} />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <select value={pressType} onChange={e => setPressType(e.target.value)} style={{ ...inp, flex: 1, color: pressType ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>
                        <option value="">Type…</option>
                        {PRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={pressUrl} onChange={e => setPressUrl(e.target.value)} placeholder="https://…" style={{ ...inp, flex: 2 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => void addPress()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                      <button onClick={() => setAddingPress(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
                {pressRows.map(p => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--wa-line)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--wa-ink)', lineHeight: 1.35 }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>{[p.type, p.outlet, formatAnyDate(p.date)].filter(Boolean).join(' · ')}</div>
                    </div>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Open article" style={{ fontSize: 12, color: 'var(--wa-muted)', textDecoration: 'none', flexShrink: 0 }}>↗</a>}
                    {p.remove && <button onClick={p.remove} aria-label="Remove press item" style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer', flexShrink: 0 }}>×</button>}
                  </div>
                ))}
              </div>
            )}

            {showRights && (
              <div style={{ ...card }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  {sectionLabel('Rights')}
                  <button onClick={() => setAddingRight(v => !v)} style={addBtn}>+ Add</button>
                </div>
                {addingRight && (
                  <div style={{ background: 'var(--wa-fill-2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <input autoFocus value={rightLang} onChange={e => setRightLang(e.target.value)} placeholder="Language / edition" style={{ ...inp, marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input value={rightPub} onChange={e => setRightPub(e.target.value)} placeholder="Publisher" style={{ ...inp, flex: 2 }} />
                      <input type="number" value={rightYear} onChange={e => setRightYear(e.target.value)} placeholder="Year" style={{ ...inp, flex: 1 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 6 }}>
                      <input value={rightAdvance} onChange={e => setRightAdvance(e.target.value)} placeholder="Advance" aria-label="Advance" inputMode="decimal" style={inp} />
                      <input value={rightRoyalty} onChange={e => setRightRoyalty(e.target.value)} placeholder="Royalty %" aria-label="Royalty %" inputMode="decimal" style={inp} />
                      <input value={rightRun} onChange={e => setRightRun(e.target.value)} placeholder="Print run" aria-label="Print run" inputMode="numeric" style={inp} />
                      <input value={rightPrice} onChange={e => setRightPrice(e.target.value)} placeholder="Price" aria-label="Price" inputMode="decimal" style={inp} />
                    </div>
                    <select value={rightStatus} onChange={e => setRightStatus(e.target.value as RightItem['status'])} style={{ ...inp, marginBottom: 8 }}>
                      {RIGHT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => void addRight()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                      <button onClick={() => setAddingRight(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
                {rights.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--wa-line)' }}>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--wa-ink)' }}>{r.language}</div>
                      <div style={{ fontSize: 10, color: 'var(--wa-muted)', marginTop: 1 }}>{[r.publisher, r.year].filter(Boolean).join(' · ')}</div>
                      {(r.advance != null || r.royaltyRate != null || r.printRun != null || r.price != null) && (
                        <div style={{ fontSize: 10, color: 'var(--wa-text-2)', marginTop: 2 }}>
                          {[r.advance != null ? `Advance ${money(r.advance, w.contract?.currency)}` : '', r.royaltyRate != null ? `${r.royaltyRate}%` : '', r.printRun != null ? `${r.printRun.toLocaleString('en-GB')} copies` : '', r.price != null ? money(r.price, w.contract?.currency) : ''].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, ...(RIGHT_BADGE[r.status] ?? {}) }}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {linkedAwards.length > 0 && (
              <div style={{ ...card }}>
                {sectionLabel('Awards')}
                {linkedAwards.map(a => (
                  <button key={a.id} onClick={() => navigate('/career/recognition')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--wa-line)', padding: '8px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)' }}>{a.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>{[a.type, a.outlet, formatAnyDate(a.date)].filter(Boolean).join(' · ')}</div>
                  </button>
                ))}
              </div>
            )}

            {showNotes && (
              <div style={{ ...card }}>
                {sectionLabel('Notes')}
                <p style={{ fontSize: 12.5, color: 'var(--wa-text-2)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{w.notes}</p>
              </div>
            )}

            {folded.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                {folded.map(([label, open]) => (
                  <button key={label} onClick={open}
                    style={{ minHeight: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--wa-line-strong)', background: 'none', fontSize: 11, color: 'var(--wa-text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

// Old /studio/books/:id links lead to the work the book became.
export function LegacyBookRedirect() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bookId = Number(id)
  const target = useLiveQuery(async () => (await db.works.filter(w => w.legacyBookId === bookId).first()) ?? null, [bookId])
  useEffect(() => {
    if (target === undefined) return
    navigate(target?.id != null ? `/studio/${target.id}` : '/studio', { replace: true })
  }, [target, navigate])
  return null
}
