import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PressItem, type RightItem } from '../db/db'
import { Shell } from '../components/layout/Shell'

const RIGHT_STATUSES: Array<RightItem['status']> = ['live', 'sold', 'pending']

function uid() { return Math.random().toString(36).slice(2) }

const RIGHT_BADGE: Record<string, React.CSSProperties> = {
  live:    { background: '#F5E642', color: '#111111' },
  sold:    { background: '#F5F5F5', color: '#666666' },
  pending: { background: 'transparent', color: '#AAAAAA', border: '1px dashed #DDDDDD' },
}

const BOOK_FIELDS = [
  { key: 'subtitle', label: 'Subtitle', placeholder: '' },
  { key: 'publisher', label: 'Publisher', placeholder: '' },
  { key: 'publishedDate', label: 'Published', placeholder: '2025-10' },
  { key: 'isbn', label: 'ISBN', placeholder: '978…' },
  { key: 'language', label: 'Language', placeholder: 'German' },
  { key: 'credits', label: 'Credits', placeholder: 'Text by…, illustrated by…' },
  { key: 'pages', label: 'Pages', placeholder: '32' },
  { key: 'dimensions', label: 'Format', placeholder: '24 × 30 cm' },
  { key: 'technique', label: 'Technique', placeholder: 'Gouache, pencil' },
] as const
type BookField = typeof BOOK_FIELDS[number]['key']
const EMPTY_BOOK: Record<BookField, string> = { subtitle: '', publisher: '', publishedDate: '', isbn: '', language: '', credits: '', pages: '', dimensions: '', technique: '' }

const fieldLabel: React.CSSProperties = { fontSize: 9, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }

function sectionLabel(text: string) {
  return <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 12px' }}>{text}</p>
}

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bid = Number(id)

  const book = useLiveQuery(() => db.books.get(bid), [bid])
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState<Record<BookField, string>>(EMPTY_BOOK)
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

  if (book === undefined) return null
  if (!book) { navigate('/studio', { replace: true }); return null }

  const bk = book
  const press = bk.press ?? []
  const rights = bk.rights ?? []

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      await db.books.update(bid, { coverImage: reader.result as string })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function removeCover() {
    await db.books.update(bid, { coverImage: undefined })
  }

  function startEdit() {
    setTitle(bk.title)
    setNotes(bk.notes ?? '')
    setFields(Object.fromEntries(BOOK_FIELDS.map(f => [f.key, bk[f.key] != null ? String(bk[f.key]) : ''])) as Record<BookField, string>)
    setEditing(true)
  }

  async function saveEdit() {
    const text = (k: BookField) => fields[k].trim() || undefined
    const pages = Number(fields.pages)
    await db.books.update(bid, {
      title: title.trim() || bk.title,
      notes,
      subtitle: text('subtitle'),
      publisher: text('publisher'),
      publishedDate: text('publishedDate'),
      isbn: text('isbn'),
      language: text('language'),
      credits: text('credits'),
      pages: fields.pages.trim() && Number.isFinite(pages) ? pages : undefined,
      dimensions: text('dimensions'),
      technique: text('technique'),
    })
    setEditing(false)
  }

  async function addPress() {
    if (!pressTitle.trim()) return
    const item: PressItem = { id: uid(), outlet: pressOutlet.trim(), title: pressTitle.trim(), date: pressDate || undefined, url: pressUrl.trim() || undefined, type: pressType || undefined }
    await db.books.update(bid, { press: [...press, item] })
    setPressOutlet(''); setPressTitle(''); setPressDate(''); setPressUrl(''); setPressType(''); setAddingPress(false)
  }

  async function removePress(pid: string) {
    await db.books.update(bid, { press: press.filter(p => p.id !== pid) })
  }

  async function addRight() {
    if (!rightLang.trim()) return
    const item: RightItem = { id: uid(), language: rightLang.trim(), publisher: rightPub.trim() || undefined, year: rightYear ? Number(rightYear) : undefined, status: rightStatus }
    await db.books.update(bid, { rights: [...rights, item] })
    setRightLang(''); setRightPub(''); setRightYear(''); setRightStatus('live'); setAddingRight(false)
  }

  async function deleteBook() {
    await db.books.delete(bid)
    navigate('/studio', { replace: true })
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 10px', fontSize: 12, color: '#111111', outline: 'none', width: '100%' }
  const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 16, padding: '18px 20px' }

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
          <button onClick={() => navigate('/studio')} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
            ← Works
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {editing ? (
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                style={{ fontFamily: 'Recoleta, serif', fontSize: 22, border: 'none', borderBottom: '2px solid #F5E642', outline: 'none', background: 'none', color: '#111111', padding: '0 0 2px', flex: 1 }} />
            ) : (
              <span style={{ fontFamily: 'Recoleta, serif', fontSize: 22, color: '#111111' }}>{bk.title}</span>
            )}
            {!editing && bk.subtitle && <span style={{ fontSize: 13, color: '#999999' }}>{bk.subtitle}</span>}
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#F5F5F5', color: '#666666', padding: '4px 10px', borderRadius: 6 }}>Book</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {editing ? (
                <>
                  <button onClick={() => void saveEdit()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <button onClick={startEdit} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', gap: 10, alignItems: 'start' }}>

          {/* LEFT: cover + details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void handleCoverFile(e)} />
              <div
                onClick={() => coverInputRef.current?.click()}
                title="Click to change cover"
                style={{ width: 100, height: 140, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, background: 'linear-gradient(160deg, #E8D8C0 0%, #C8B090 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {bk.coverImage
                  ? <img src={bk.coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 9, color: '#AAAAAA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Add cover</span>}
              </div>
              {bk.coverImage && (
                <button onClick={() => void removeCover()} style={{ background: 'none', border: 'none', fontSize: 10, color: '#CCCCCC', cursor: 'pointer', padding: 0 }}>Remove</button>
              )}
            </div>
            <div style={{ ...card }}>
              {sectionLabel('Details')}
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {BOOK_FIELDS.map(f => (
                    <label key={f.key}>
                      <span style={fieldLabel}>{f.label}</span>
                      <input value={fields[f.key]} onChange={e => setFields(v => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} inputMode={f.key === 'pages' ? 'numeric' : undefined} style={inp} />
                    </label>
                  ))}
                </div>
              ) : BOOK_FIELDS.some(f => f.key !== 'subtitle' && bk[f.key]) ? (
                BOOK_FIELDS.map(f => f.key !== 'subtitle' && bk[f.key] ? (
                  <div key={f.key} style={{ padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                    <div style={{ fontSize: 9, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111111' }}>{String(bk[f.key])}</div>
                  </div>
                ) : null)
              ) : (
                <button onClick={startEdit} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#BBBBBB', fontStyle: 'italic', cursor: 'pointer' }}>Add details</button>
              )}
            </div>
          </div>

          {/* CENTRE: press + notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                {sectionLabel('Press coverage')}
                <button onClick={() => setAddingPress(v => !v)} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', marginTop: -12 }}>+ Add</button>
              </div>
              {addingPress && (
                <div style={{ background: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <input value={pressTitle} onChange={e => setPressTitle(e.target.value)} placeholder="Headline" style={{ ...inp, marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={pressOutlet} onChange={e => setPressOutlet(e.target.value)} placeholder="Outlet" style={{ ...inp, flex: 2 }} />
                    <input value={pressDate} onChange={e => setPressDate(e.target.value)} placeholder="Date" style={{ ...inp, flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <select value={pressType} onChange={e => setPressType(e.target.value)} style={{ ...inp, flex: 1, color: pressType ? '#111111' : '#AAAAAA' }}>
                      <option value="">Type…</option>
                      {['Interview', 'Feature', 'Selection', 'Review', 'Mention', 'Profile'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={pressUrl} onChange={e => setPressUrl(e.target.value)} placeholder="https://…" style={{ ...inp, flex: 2 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => void addPress()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setAddingPress(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {press.length === 0 && !addingPress && <p style={{ fontSize: 12, color: '#CCCCCC', fontStyle: 'italic', margin: 0 }}>No press yet</p>}
              {press.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ width: 38, flexShrink: 0, fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.3 }}>
                    {p.date ?? ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 1 }}>{p.outlet}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {p.type && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#F5F5F5', color: '#888888', padding: '2px 6px', borderRadius: 4 }}>{p.type}</span>}
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#AAAAAA', textDecoration: 'none', display: 'flex', alignItems: 'center' }} title={p.url}>↗</a>}
                    <button onClick={() => void removePress(p.id)} style={{ background: 'none', border: 'none', fontSize: 13, color: '#DDDDDD', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...card, flex: 1 }}>
              {sectionLabel('Notes')}
              {editing ? (
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                  style={{ ...inp, resize: 'vertical' }} />
              ) : (
                <p style={{ fontSize: 12.5, color: '#666666', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {bk.notes || <span style={{ color: '#CCCCCC', fontStyle: 'italic' }}>No notes yet.</span>}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: rights + delete */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                {sectionLabel('Rights')}
                <button onClick={() => setAddingRight(v => !v)} style={{ background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#AAAAAA', cursor: 'pointer', marginTop: -12 }}>+ Add</button>
              </div>
              {addingRight && (
                <div style={{ background: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <input value={rightLang} onChange={e => setRightLang(e.target.value)} placeholder="Language / territory" style={{ ...inp, marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={rightPub} onChange={e => setRightPub(e.target.value)} placeholder="Publisher" style={{ ...inp, flex: 2 }} />
                    <input type="number" value={rightYear} onChange={e => setRightYear(e.target.value)} placeholder="Year" style={{ ...inp, flex: 1 }} />
                  </div>
                  <select value={rightStatus} onChange={e => setRightStatus(e.target.value as RightItem['status'])} style={{ ...inp, marginBottom: 8 }}>
                    {RIGHT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => void addRight()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setAddingRight(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {rights.length === 0 && !addingRight && <p style={{ fontSize: 12, color: '#CCCCCC', fontStyle: 'italic', margin: 0 }}>No rights tracked</p>}
              {rights.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: '#111111' }}>{r.language}</div>
                    <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 1 }}>{[r.publisher, r.year].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, ...(RIGHT_BADGE[r.status] ?? {}) }}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ ...card }}>
              {sectionLabel('Danger zone')}
              <button onClick={() => void deleteBook()} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#CCCCCC', cursor: 'pointer' }}>
                Delete book…
              </button>
            </div>
          </div>

        </div>
      </div>
    </Shell>
  )
}
