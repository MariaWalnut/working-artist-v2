import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PressEntry } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const PRESS_TYPES = ['Interview', 'Feature', 'Selection', 'Review', 'Mention', 'Profile']

const TYPE_COLOR: Record<string, string> = {
  Interview: '#E8D4F0',
  Feature: '#D4E8F0',
  Selection: '#D4F0E4',
  Review: '#F0EAD4',
  Mention: '#F0F0F0',
  Profile: '#F0D4D4',
}

function PressForm({ entry, books, onDone }: { entry: PressEntry | null; books: Array<{ id?: number; title: string }>; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(entry?.title ?? '')
  const [type, setType] = useState(entry?.type ?? '')
  const [outlet, setOutlet] = useState(entry?.outlet ?? '')
  const [date, setDate] = useState(entry?.date ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [bookId, setBookId] = useState<number | undefined>(entry?.bookId)

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F9F9F9', padding: '8px 10px', fontSize: 12, color: '#111111', outline: 'none', width: '100%' }

  async function save() {
    if (!title.trim()) return
    const data: PressEntry = { departmentId: dept?.id, title: title.trim(), type: type || undefined, outlet: outlet.trim() || undefined, date: date.trim() || undefined, url: url.trim() || undefined, notes: notes.trim() || undefined, bookId }
    if (entry?.id != null) await db.pressEntries.update(entry.id, data)
    else await db.pressEntries.add(data)
    onDone()
  }

  async function del() {
    if (entry?.id != null) await db.pressEntries.delete(entry.id)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 16px' }}>{entry ? 'Edit press item' : 'Add press'}</p>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Headline" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={outlet} onChange={e => setOutlet(e.target.value)} placeholder="Outlet" style={{ ...inp, flex: 2 }} />
          <input value={date} onChange={e => setDate(e.target.value)} placeholder="Date (e.g. Oct 2024)" style={{ ...inp, flex: 1 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1, color: type ? '#111111' : '#999999' }}>
            <option value="">Type…</option>
            {PRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={bookId ?? ''} onChange={e => setBookId(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, flex: 2, color: bookId ? '#111111' : '#999999' }}>
            <option value="">About the artist</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={{ ...inp, marginBottom: 10 }} />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 16 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {entry && <button onClick={() => void del()} style={{ background: 'none', border: 'none', fontSize: 11, color: '#CCCCCC', cursor: 'pointer' }}>Delete</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{entry ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Press() {
  const dept = useActiveDept()
  const deptId = dept?.id

  const entries = useLiveQuery(() => deptId == null ? [] : db.pressEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const books = useLiveQuery(() => deptId == null ? [] : db.books.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []

  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<PressEntry | null | 'new'>(null)

  const sorted = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const filtered = typeFilter ? sorted.filter(e => e.type === typeFilter) : sorted

  const usedTypes = [...new Set(entries.map(e => e.type).filter(Boolean))] as string[]

  return (
    <Shell>
      {editing != null && (
        <PressForm
          entry={editing === 'new' ? null : editing}
          books={books}
          onDone={() => setEditing(null)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 24, fontWeight: 400, margin: 0, color: '#111111' }}>Press</h1>
        <button onClick={() => setEditing('new')} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>+ Add</button>
      </div>

      {/* Type filter */}
      {usedTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter(null)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, cursor: 'pointer', background: typeFilter === null ? '#111111' : '#F5F5F5', color: typeFilter === null ? '#FFFFFF' : '#888888' }}>All</button>
          {usedTypes.map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, cursor: 'pointer', background: typeFilter === t ? '#111111' : '#F5F5F5', color: typeFilter === t ? '#FFFFFF' : '#888888' }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '64px 0', textAlign: 'center', color: '#CCCCCC', fontSize: 13, fontStyle: 'italic' }}>
          {entries.length === 0 ? 'No press items yet.' : 'Nothing matches this filter.'}
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          {filtered.map((p, i) => {
            const book = p.bookId ? books.find(b => b.id === p.bookId) : null
            return (
              <div key={p.id} onClick={() => setEditing(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F5F5F5' : 'none', cursor: 'pointer' }}>

                {/* Date */}
                <div style={{ width: 70, flexShrink: 0, fontSize: 10, color: '#CCCCCC', fontWeight: 500 }}>
                  {p.date ?? ''}
                </div>

                {/* Main */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>
                    {[p.outlet, book ? book.title : null].filter(Boolean).join(' · ')}
                  </div>
                </div>

                {/* Right: type badge + link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {p.type && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: TYPE_COLOR[p.type] ?? '#F5F5F5', color: '#555555', padding: '3px 7px', borderRadius: 5 }}>
                      {p.type}
                    </span>
                  )}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ fontSize: 12, color: '#AAAAAA', textDecoration: 'none' }} title="Open link">↗</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}
