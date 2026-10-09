import { useState } from 'react'
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

function sectionLabel(text: string) {
  return <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 12px' }}>{text}</p>
}

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bid = Number(id)

  const book = useLiveQuery(() => db.books.get(bid), [bid])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [publisher, setPublisher] = useState('')
  const [publishedDate, setPublishedDate] = useState('')
  const [isbn, setIsbn] = useState('')
  const [language, setLanguage] = useState('')
  const [credits, setCredits] = useState('')
  const [addingPress, setAddingPress] = useState(false)
  const [pressOutlet, setPressOutlet] = useState('')
  const [pressTitle, setPressTitle] = useState('')
  const [pressDate, setPressDate] = useState('')
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

  function startEdit() {
    setTitle(bk.title)
    setNotes(bk.notes ?? '')
    setPublisher(bk.publisher ?? '')
    setPublishedDate(bk.publishedDate ?? '')
    setIsbn(bk.isbn ?? '')
    setLanguage(bk.language ?? '')
    setCredits(bk.credits ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    await db.books.update(bid, { title: title.trim() || bk.title, notes, publisher, publishedDate, isbn, language, credits })
    setEditing(false)
  }

  async function addPress() {
    if (!pressTitle.trim()) return
    const item: PressItem = { id: uid(), outlet: pressOutlet.trim(), title: pressTitle.trim(), date: pressDate || undefined }
    await db.books.update(bid, { press: [...press, item] })
    setPressOutlet(''); setPressTitle(''); setPressDate(''); setAddingPress(false)
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
            ← Studio
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {editing ? (
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                style={{ fontFamily: 'Recoleta, serif', fontSize: 22, border: 'none', borderBottom: '2px solid #F5E642', outline: 'none', background: 'none', color: '#111111', padding: '0 0 2px', flex: 1 }} />
            ) : (
              <span style={{ fontFamily: 'Recoleta, serif', fontSize: 22, color: '#111111' }}>{bk.title}</span>
            )}
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
            <div style={{ ...card, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 100, height: 140, borderRadius: 8, background: 'linear-gradient(160deg, #E8D8C0 0%, #C8B090 100%)' }} />
            </div>
            <div style={{ ...card }}>
              {sectionLabel('Details')}
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={publisher} onChange={e => setPublisher(e.target.value)} placeholder="Publisher" style={inp} />
                  <input value={publishedDate} onChange={e => setPublishedDate(e.target.value)} placeholder="Published (2025-10)" style={inp} />
                  <input value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="ISBN" style={inp} />
                  <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Language" style={inp} />
                  <input value={credits} onChange={e => setCredits(e.target.value)} placeholder="Credits" style={inp} />
                </div>
              ) : (
                [
                  { label: 'Published', value: bk.publishedDate },
                  { label: 'Publisher', value: bk.publisher },
                  { label: 'ISBN', value: bk.isbn },
                  { label: 'Credits', value: bk.credits },
                  { label: 'Language', value: bk.language },
                ].map(f => f.value ? (
                  <div key={f.label} style={{ padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                    <div style={{ fontSize: 9, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111111' }}>{f.value}</div>
                  </div>
                ) : null)
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
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={pressOutlet} onChange={e => setPressOutlet(e.target.value)} placeholder="Outlet" style={{ ...inp, flex: 1 }} />
                    <input value={pressDate} onChange={e => setPressDate(e.target.value)} placeholder="Date" style={{ ...inp, flex: 1 }} />
                  </div>
                  <input value={pressTitle} onChange={e => setPressTitle(e.target.value)} placeholder="Headline / description" style={{ ...inp, marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => void addPress()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setAddingPress(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {press.length === 0 && !addingPress && <p style={{ fontSize: 12, color: '#CCCCCC', fontStyle: 'italic', margin: 0 }}>No press yet</p>}
              {press.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F0F0F0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: '#888888', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.2 }}>{p.outlet.slice(0, 4).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', lineHeight: 1.35 }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>{[p.outlet, p.date].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button onClick={() => void removePress(p.id)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#CCCCCC', cursor: 'pointer', flexShrink: 0 }}>×</button>
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
