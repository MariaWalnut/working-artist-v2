import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, type Work, type Book, type Release } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { getActivities } from '../lib/activities'
import { Shell } from '../components/layout/Shell'

const MEDIUMS = ['Painting', 'Drawing', 'Print', 'Photography', 'Digital', 'Sculpture', 'Mixed media', 'Other']
const FORMATS = ['Album', 'EP', 'Single', 'Track', 'Other']

function WorkForm({ work, onDone }: { work: Work | null; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(work?.title ?? '')
  const [medium, setMedium] = useState(work?.medium ?? 'Painting')
  const [dimensions, setDimensions] = useState(work?.dimensions ?? '')
  const [year, setYear] = useState(work?.year ?? new Date().getFullYear())
  const [location, setLocation] = useState(work?.location ?? '')

  async function save() {
    if (!title.trim()) return
    const data = { departmentId: dept?.id, title: title.trim(), medium, dimensions, year, location }
    if (work?.id != null) await db.works.update(work.id, data)
    else await db.works.add(data)
    onDone()
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>{work ? 'Edit work' : 'Add work'}</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={medium} onChange={e => setMedium(e.target.value)} style={{ ...inp, flex: 2 }}>{MEDIUMS.map(m => <option key={m}>{m}</option>)}</select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, flex: 1 }} min={1900} max={2100} />
        </div>
        <input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="Dimensions (e.g. 40 × 60 cm)" style={{ ...inp, marginBottom: 10 }} />
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{work ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
          {work && <button onClick={async () => { if (work.id) await db.works.delete(work.id); onDone() }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#CCCCCC', cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

function BookForm({ book, onDone }: { book: Book | null; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(book?.title ?? '')
  const [publisher, setPublisher] = useState(book?.publisher ?? '')
  const [publishedDate, setPublishedDate] = useState(book?.publishedDate ?? '')
  const [isbn, setIsbn] = useState(book?.isbn ?? '')
  const [language, setLanguage] = useState(book?.language ?? '')
  const [credits, setCredits] = useState(book?.credits ?? '')

  async function save() {
    if (!title.trim()) return
    const data = { departmentId: dept?.id, title: title.trim(), publisher, publishedDate, isbn, language, credits }
    if (book?.id != null) await db.books.update(book.id, data)
    else await db.books.add(data)
    onDone()
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>{book ? 'Edit book' : 'Add book'}</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={publisher} onChange={e => setPublisher(e.target.value)} placeholder="Publisher" style={{ ...inp, flex: 2 }} />
          <input value={publishedDate} onChange={e => setPublishedDate(e.target.value)} placeholder="2025-10" style={{ ...inp, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Language" style={{ ...inp, flex: 1 }} />
          <input value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="ISBN" style={{ ...inp, flex: 2 }} />
        </div>
        <input value={credits} onChange={e => setCredits(e.target.value)} placeholder="Credits" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{book ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
          {book && <button onClick={async () => { if (book.id) await db.books.delete(book.id); onDone() }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#CCCCCC', cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

function ReleaseForm({ release, onDone }: { release: Release | null; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(release?.title ?? '')
  const [format, setFormat] = useState(release?.format ?? 'Album')
  const [year, setYear] = useState(release?.year ?? new Date().getFullYear())
  const [label, setLabel] = useState(release?.label ?? '')

  async function save() {
    if (!title.trim()) return
    const data = { departmentId: dept?.id, title: title.trim(), format, year, label }
    if (release?.id != null) await db.releases.update(release.id, data)
    else await db.releases.add(data)
    onDone()
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', marginBottom: 16 }}>{release ? 'Edit release' : 'Add release'}</p>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={format} onChange={e => setFormat(e.target.value)} style={{ ...inp, flex: 2 }}>{FORMATS.map(f => <option key={f}>{f}</option>)}</select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, flex: 1 }} min={1900} max={2100} />
        </div>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{release ? 'Save' : 'Add'}</button>
          <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
          {release && <button onClick={async () => { if (release.id) await db.releases.delete(release.id); onDone() }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#CCCCCC', cursor: 'pointer' }}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

export function Studio() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const activities = getActivities(dept)

  const hasFineArts = activities.includes('visual_artist') || activities.includes('photographer')
  const hasBooks = activities.includes('writer')
  const hasMusic = activities.includes('musician')

  const [editWork, setEditWork] = useState<Work | 'new' | null>(null)
  const [editBook, setEditBook] = useState<Book | 'new' | null>(null)
  const [editRelease, setEditRelease] = useState<Release | 'new' | null>(null)
  const [mediumFilter, setMediumFilter] = useState<string | null>(null)

  const works = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const books = useLiveQuery(() => dept?.id == null ? [] : db.books.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const releases = useLiveQuery(() => dept?.id == null ? [] : db.releases.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  const filteredWorks = works.filter(w => !mediumFilter || w.medium === mediumFilter).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
  const usedMediums = [...new Set(works.map(w => w.medium).filter(Boolean))] as string[]

  const colH = (t: string) => <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAAAAA' }}>{t}</span>
  const sidePanel: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }
  const sectionLbl: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', padding: '0 8px 8px' }

  return (
    <Shell>
      {editWork !== null && <WorkForm work={editWork === 'new' ? null : editWork} onDone={() => setEditWork(null)} />}
      {editBook !== null && <BookForm book={editBook === 'new' ? null : editBook} onDone={() => setEditBook(null)} />}
      {editRelease !== null && <ReleaseForm release={editRelease === 'new' ? null : editRelease} onDone={() => setEditRelease(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hasFineArts && usedMediums.length > 0 && (
            <div style={sidePanel}>
              <p style={sectionLbl}>Medium</p>
              <button onClick={() => setMediumFilter(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: mediumFilter === null ? '#F5F5F5' : 'none', color: mediumFilter === null ? '#111111' : '#666666', fontSize: 12, fontWeight: mediumFilter === null ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                <span>All</span>
                <span style={{ fontSize: 10, color: '#AAAAAA', fontWeight: 400 }}>{works.length}</span>
              </button>
              {usedMediums.map(m => (
                <button key={m} onClick={() => setMediumFilter(mediumFilter === m ? null : m)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: mediumFilter === m ? '#F5F5F5' : 'none', color: mediumFilter === m ? '#111111' : '#666666', fontSize: 12, fontWeight: mediumFilter === m ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                  <span>{m}</span>
                  <span style={{ fontSize: 10, color: '#AAAAAA', fontWeight: 400 }}>{works.filter(w => w.medium === m).length}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hasFineArts && (
              <button onClick={() => setEditWork('new')} style={{ background: '#F5E642', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                + Add work
              </button>
            )}
            {hasBooks && (
              <button onClick={() => setEditBook('new')} style={{ background: '#F5E642', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                + Add book
              </button>
            )}
            {hasMusic && (
              <button onClick={() => setEditRelease('new')} style={{ background: '#F5E642', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                + Add release
              </button>
            )}
            <button onClick={() => navigate('/studio/boards')} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color: '#AAAAAA', cursor: 'pointer' }}>
              Vision boards
            </button>
          </div>
        </div>

        {/* Main: stacked sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {hasFineArts && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 14px', borderBottom: '1px solid #F5F5F5' }}>
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 16, margin: 0 }}>Fine Arts</p>
                <span style={{ marginLeft: 8, background: '#F5F5F5', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#888888' }}>{filteredWorks.length}</span>
                <button onClick={() => setEditWork('new')} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 10, color: '#AAAAAA', cursor: 'pointer', letterSpacing: '0.1em' }}>+ Add</button>
              </div>
              {filteredWorks.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No works yet</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 120px 130px 150px 80px', padding: '10px 24px', borderBottom: '1px solid #F5F5F5' }}>
                    {['', 'Title', 'Medium', 'Dimensions', 'Location', 'Year'].map(h => <span key={h}>{colH(h)}</span>)}
                  </div>
                  {filteredWorks.map(w => (
                    <div key={w.id} onClick={() => navigate(`/studio/${w.id}`)} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 120px 130px 150px 80px', padding: '12px 24px', borderBottom: '1px solid #F9F9F9', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 40, borderRadius: 6, background: 'linear-gradient(135deg, #EEEEEE 0%, #DDDDDD 100%)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', margin: '0 0 2px' }}>{w.title}</p>
                        <p style={{ fontSize: 10, color: '#AAAAAA', margin: 0 }}>{w.year}</p>
                      </div>
                      <span style={{ fontSize: 11, color: '#666666' }}>{w.medium ?? '—'}</span>
                      <span style={{ fontSize: 11, color: '#AAAAAA' }}>{w.dimensions ?? '—'}</span>
                      <span style={{ fontSize: 11, color: '#666666' }}>{w.location ?? '—'}</span>
                      <span style={{ fontSize: 10, color: '#CCCCCC', textAlign: 'right' }}>{w.year ?? '—'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {hasBooks && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 14px', borderBottom: '1px solid #F5F5F5' }}>
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 16, margin: 0 }}>Books</p>
                <span style={{ marginLeft: 8, background: '#F5F5F5', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#888888' }}>{books.length}</span>
                <button onClick={() => setEditBook('new')} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 10, color: '#AAAAAA', cursor: 'pointer', letterSpacing: '0.1em' }}>+ Add</button>
              </div>
              {books.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No books yet</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 160px 110px 110px', padding: '10px 24px', borderBottom: '1px solid #F5F5F5' }}>
                    {['', 'Title', 'Publisher', 'Published', 'Language'].map(h => <span key={h}>{colH(h)}</span>)}
                  </div>
                  {books.map(b => (
                    <div key={b.id} onClick={() => navigate(`/studio/books/${b.id}`)} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 160px 110px 110px', padding: '12px 24px', borderBottom: '1px solid #F9F9F9', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 40, borderRadius: 4, background: 'linear-gradient(135deg, #E8D8C0 0%, #D4C0A0 100%)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', margin: '0 0 2px' }}>{b.title}</p>
                        {b.subtitle && <p style={{ fontSize: 10, color: '#AAAAAA', margin: 0 }}>{b.subtitle}</p>}
                      </div>
                      <span style={{ fontSize: 11, color: '#666666' }}>{b.publisher ?? '—'}</span>
                      <span style={{ fontSize: 11, color: '#AAAAAA' }}>{b.publishedDate ?? '—'}</span>
                      <span style={{ fontSize: 11, color: '#666666' }}>{b.language ?? '—'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {hasMusic && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 14px', borderBottom: '1px solid #F5F5F5' }}>
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 16, margin: 0 }}>Music</p>
                <span style={{ marginLeft: 8, background: '#F5F5F5', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: '#888888' }}>{releases.length}</span>
                <button onClick={() => setEditRelease('new')} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 10, color: '#AAAAAA', cursor: 'pointer', letterSpacing: '0.1em' }}>+ Add</button>
              </div>
              {releases.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '36px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No releases yet</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 160px 80px', padding: '10px 24px', borderBottom: '1px solid #F5F5F5' }}>
                    {['', 'Title', 'Format', 'Label', 'Year'].map(h => <span key={h}>{colH(h)}</span>)}
                  </div>
                  {[...releases].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).map(r => (
                    <div key={r.id} onClick={() => setEditRelease(r)} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 160px 80px', padding: '12px 24px', borderBottom: '1px solid #F9F9F9', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #D8D0E8 0%, #C4B8D8 100%)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111111', margin: '0 0 2px' }}>{r.title}</p>
                        <p style={{ fontSize: 10, color: '#AAAAAA', margin: 0 }}>{r.year}</p>
                      </div>
                      <span style={{ fontSize: 11, color: '#888888' }}>{r.format ?? '—'}</span>
                      <span style={{ fontSize: 11, color: '#666666' }}>{r.label ?? '—'}</span>
                      <span style={{ fontSize: 10, color: '#CCCCCC', textAlign: 'right' }}>{r.year ?? '—'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </Shell>
  )
}
