import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type RightItem } from '../db/db'
import { Shell } from '../components/layout/Shell'
import { KindSelect, WorkFields, fieldsFromWork, fieldsToPatch, type FieldValues } from '../components/WorkFields'
import { KIND_FIELDS, fieldDisplay, kindOf, type WorkKind } from '../lib/works'
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
  sold:    { background: '#F5F5F5', color: '#666666' },
  pending: { background: 'transparent', color: '#6E6E6E', border: '1px dashed #DDDDDD' },
}

function sectionLabel(text: string) {
  return <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', margin: '0 0 12px' }}>{text}</p>
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

  const work = useLiveQuery(() => db.works.get(wid), [wid])
  const linkedEntries = useLiveQuery(() => db.pressEntries.filter(p => p.workId === wid).toArray(), [wid]) ?? []
  const linkedPress = linkedEntries.filter(p => p.category !== 'award')
  const linkedAwards = linkedEntries.filter(p => p.category === 'award')
  const allEvents = useLiveQuery(() => db.eventEntries.toArray(), []) ?? []
  const [linkingEvent, setLinkingEvent] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [kind, setKind] = useState<WorkKind>('Artwork')
  const [fields, setFields] = useState<FieldValues>(() => fieldsFromWork(null))
  const [pendingImage, setPendingImage] = useState<string | undefined>()
  const [addingPress, setAddingPress] = useState(false)
  const [pressOutlet, setPressOutlet] = useState('')
  const [pressTitle, setPressTitle] = useState('')
  const [pressDate, setPressDate] = useState('')
  const [pressUrl, setPressUrl] = useState('')
  const [pressType, setPressType] = useState('')
  const [addingRight, setAddingRight] = useState(false)
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
  const linkable = deptEvents.filter(e => !(e.workIds ?? []).includes(wid))

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
      ...(pendingImage && !w.image ? { image: pendingImage } : {}),
    })
    setEditing(false)
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    await db.works.update(wid, { image: await fileToDataUrl(file) })
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

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 10px', fontSize: 12, color: '#111111', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 16, padding: '18px 20px' }
  const chip: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#F5F5F5', color: '#666666', padding: '4px 10px', borderRadius: 6 }
  const pressRows = [
    ...press.filter(Boolean).map(p => ({ key: p.id, title: p.title, outlet: p.outlet ?? '', date: p.date, url: p.url, type: p.type, remove: () => void removePress(p.id) })),
    ...linkedPress.map(p => ({ key: `lp${p.id}`, title: p.title, outlet: p.outlet ?? '', date: p.date, url: p.url, type: p.type, remove: () => void unlinkPress(p.id!) })),
  ]

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Back + title row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
          <button onClick={() => navigate('/studio')} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6E6E6E', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
            ← Works
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {editing ? (
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} aria-label="Title"
                style={{ fontFamily: 'Recoleta, serif', fontSize: 22, border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', background: 'none', color: '#111111', padding: '0 0 2px', flex: 1, minWidth: 0 }} />
            ) : (
              <span style={{ fontFamily: 'Recoleta, serif', fontSize: 22, color: '#111111' }}>{w.title}</span>
            )}
            {!editing && w.subtitle && <span style={{ fontSize: 13, color: '#6E6E6E' }}>{w.subtitle}</span>}
            {!editing && <span style={chip}>{wKind}</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {editing ? (
                <>
                  <button onClick={() => void saveEdit()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#666666', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <button onClick={startEdit} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '240px minmax(0, 1fr) 280px', gap: 10, alignItems: 'start' }}>

          {/* LEFT: picture + details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <input ref={imageRef} type="file" accept="image/*" hidden onChange={e => void onImagePicked(e)} />
              <button onClick={() => imageRef.current?.click()} aria-label={w.image ? 'Change picture' : 'Add picture'}
                style={{ width: '100%', padding: 0, border: 'none', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: w.image ? 'none' : 'linear-gradient(160deg,#EEEEEE 0%,#DDDDDD 100%)', minHeight: w.image ? undefined : 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {w.image
                  ? <img src={w.image} alt={w.title} style={{ display: 'block', width: '100%', maxHeight: narrow ? 360 : 300, objectFit: 'contain', background: '#F7F7F7' }} />
                  : <span style={{ fontSize: 9, color: '#6E6E6E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Add picture</span>}
              </button>
              {w.image && (
                <button onClick={() => void db.works.update(wid, { image: undefined })} style={{ background: 'none', border: 'none', fontSize: 10, color: '#767676', cursor: 'pointer', padding: 0 }}>Remove</button>
              )}
            </div>
            <div style={{ ...card }}>
              {sectionLabel('Details')}
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <KindSelect value={kind} onChange={setKind} style={inp} />
                  <WorkFields kind={kind} values={fields} onChange={setFields} inp={inp}
                    onIsbnFound={r => { if (r.image) setPendingImage(r.image) }} />
                </div>
              ) : shownFields.length > 0 ? (
                shownFields.map(f => (
                  <div key={f.key} style={{ padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                    <div style={{ fontSize: 9, color: '#6E6E6E', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111111' }}>{fieldDisplay(f.key, w[f.key], w)}</div>
                  </div>
                ))
              ) : (
                <button onClick={startEdit} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#767676', fontStyle: 'italic', cursor: 'pointer' }}>Add details</button>
              )}
            </div>
          </div>

          {/* CENTRE: press + notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                {sectionLabel('Press coverage')}
                <button onClick={() => setAddingPress(v => !v)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', marginTop: -12 }}>+ Add</button>
              </div>
              {addingPress && (
                <div style={{ background: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <input value={pressTitle} onChange={e => setPressTitle(e.target.value)} placeholder="Headline" style={{ ...inp, marginBottom: 6 }} />
                  <input value={pressOutlet} onChange={e => setPressOutlet(e.target.value)} placeholder="Outlet" aria-label="Outlet" style={{ ...inp, marginBottom: 8 }} />
                  <DateFields label="Date" value={pressDate} onChange={setPressDate} inp={inp} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <select value={pressType} onChange={e => setPressType(e.target.value)} style={{ ...inp, flex: 1, color: pressType ? '#111111' : '#6E6E6E' }}>
                      <option value="">Type…</option>
                      {PRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={pressUrl} onChange={e => setPressUrl(e.target.value)} placeholder="https://…" style={{ ...inp, flex: 2 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => void addPress()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setAddingPress(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6E6E6E', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {pressRows.length === 0 && !addingPress && <p style={{ fontSize: 12, color: '#767676', fontStyle: 'italic', margin: 0 }}>No press yet</p>}
              {pressRows.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F3F3F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: '#6E6E6E', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.2 }}>{String(p.outlet ?? '').slice(0, 4).toUpperCase() || '···'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', lineHeight: 1.35 }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: '#6E6E6E', marginTop: 2 }}>{[p.outlet, formatAnyDate(p.date)].filter(Boolean).join(' · ')}</div>
                  </div>
                  {p.type && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#F5F5F5', color: '#666666', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{p.type}</span>}
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Open article" style={{ fontSize: 12, color: '#6E6E6E', textDecoration: 'none', flexShrink: 0 }}>↗</a>}
                  {p.remove && <button onClick={p.remove} aria-label="Remove press item" style={{ background: 'none', border: 'none', fontSize: 12, color: '#767676', cursor: 'pointer', flexShrink: 0 }}>×</button>}
                </div>
              ))}
            </div>

            <div style={{ ...card, flex: 1 }}>
              {sectionLabel('Notes')}
              {editing ? (
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} aria-label="Notes"
                  style={{ ...inp, resize: 'vertical' }} />
              ) : (
                <p style={{ fontSize: 12.5, color: '#666666', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {w.notes || <span style={{ color: '#767676', fontStyle: 'italic' }}>No notes yet.</span>}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: shown at + rights + delete */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                {sectionLabel('Shown at')}
                {linkable.length > 0 && (
                  <button onClick={() => setLinkingEvent(v => !v)} style={{ background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#6E6E6E', cursor: 'pointer', marginTop: -12 }}>+ Add</button>
                )}
              </div>
              {linkingEvent && (
                <select autoFocus defaultValue="" aria-label="Event" onChange={e => { if (e.target.value) void linkEvent(Number(e.target.value)) }} style={{ ...inp, marginBottom: 10 }}>
                  <option value="">Choose an event…</option>
                  {linkable.map(e => <option key={e.id} value={e.id}>{[e.title, formatEventDate(e.date, e.endDate)].filter(Boolean).join(' · ')}</option>)}
                </select>
              )}
              {shownAt.length === 0 && !linkingEvent && (
                <p style={{ fontSize: 12, color: '#767676', fontStyle: 'italic', margin: 0 }}>{deptEvents.length === 0 ? 'Add events to link this work to them' : 'Not linked to any event'}</p>
              )}
              {shownAt.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111111' }}>{e.title}</div>
                    <div style={{ fontSize: 10, color: '#6E6E6E', marginTop: 2 }}>{[e.type, e.location, formatEventDate(e.date, e.endDate)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button onClick={() => void unlinkEvent(e.id!)} aria-label={`Unlink ${e.title}`} style={{ background: 'none', border: 'none', fontSize: 12, color: '#767676', cursor: 'pointer', flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
            {(wKind === 'Book' || w.contract) && <ContractCard key={w.id} work={w} />}
            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                {sectionLabel('Rights')}
                <button onClick={() => setAddingRight(v => !v)} style={{ background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#6E6E6E', cursor: 'pointer', marginTop: -12 }}>+ Add</button>
              </div>
              {addingRight && (
                <div style={{ background: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <input value={rightLang} onChange={e => setRightLang(e.target.value)} placeholder="Language / edition" style={{ ...inp, marginBottom: 6 }} />
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
                    <button onClick={() => setAddingRight(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6E6E6E', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {rights.length === 0 && !addingRight && <p style={{ fontSize: 12, color: '#767676', fontStyle: 'italic', margin: 0 }}>No rights tracked</p>}
              {rights.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: '#111111' }}>{r.language}</div>
                    <div style={{ fontSize: 10, color: '#6E6E6E', marginTop: 1 }}>{[r.publisher, r.year].filter(Boolean).join(' · ')}</div>
                    {(r.advance != null || r.royaltyRate != null || r.printRun != null || r.price != null) && (
                      <div style={{ fontSize: 10, color: '#666666', marginTop: 2 }}>
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

            {linkedAwards.length > 0 && (
              <div style={{ ...card }}>
                {sectionLabel('Awards')}
                {linkedAwards.map(a => (
                  <button key={a.id} onClick={() => navigate('/career/recognition')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #F5F5F5', padding: '8px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111111' }}>{a.title}</div>
                    <div style={{ fontSize: 10, color: '#6E6E6E', marginTop: 2 }}>{[a.type, a.outlet, formatAnyDate(a.date)].filter(Boolean).join(' · ')}</div>
                  </button>
                ))}
              </div>
            )}

            <div style={{ ...card }}>
              {sectionLabel('Danger zone')}
              <button onClick={() => void deleteWork()} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#6E6E6E', cursor: 'pointer' }}>
                Delete work…
              </button>
            </div>
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
