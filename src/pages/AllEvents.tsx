import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EventEntry } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { currentMonth, formatEventDate, isOngoing, isUpcoming } from '../lib/eventDates'
import { DateFields } from '../components/DateFields'
import { Shell } from '../components/layout/Shell'


const EVENT_TYPES = ['Reading', 'Exhibition', 'Book Fair', 'Market', 'Talk', 'Performance', 'Screening', 'Award', 'Residency', 'Other']

const TYPE_DOT: Record<string, string> = {
  Reading:     '#8CB4D4',
  Exhibition:  '#111111',
  'Book Fair': '#F0C878',
  Market:      '#C8A88C',
  Talk:        '#B8C8A8',
  Performance: '#D4A8C8',
  Screening:   '#A8B4D4',
  Award:       'var(--accent)',
  Residency:   '#888888',
  Other:       '#DDDDDD',
}

const NARROW = '(max-width: 720px)'

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

// ─── Form ─────────────────────────────────────────────────────────────────────

function EventForm({ entry, works, onDone }: {
  entry: EventEntry | null
  works: Array<{ id?: number; title: string; medium?: string }>
  onDone: () => void
}) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(entry?.title ?? '')
  const [type, setType] = useState(entry?.type ?? '')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [date, setDate] = useState(entry?.date ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [goals, setGoals] = useState(entry?.goals ?? '')
  const [workIds, setWorkIds] = useState<number[]>(entry?.workIds ?? [])
  const [endDate, setEndDate] = useState(entry?.endDate ?? '')
  const [showEnd, setShowEnd] = useState(!!entry?.endDate)
  const upcoming = !date || isUpcoming({ title, date, endDate: endDate || undefined })

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F9F9F9', padding: '8px 10px', fontSize: 12, color: '#111111', outline: 'none', width: '100%' }

  function toggleWork(id: number) {
    setWorkIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function save() {
    if (!title.trim()) return
    const data: EventEntry = {
      departmentId: dept?.id,
      title: title.trim(),
      type: type || undefined,
      location: location.trim() || undefined,
      ...orderedDates(date, endDate),
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      goals: goals.trim() || undefined,
      workIds: workIds.length > 0 ? workIds : undefined,
    }
    if (entry?.id != null) await db.eventEntries.update(entry.id, data as Partial<EventEntry>)
    else await db.eventEntries.add(data)
    onDone()
  }

  async function del() {
    if (entry?.id != null) await db.eventEntries.delete(entry.id)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 460, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', margin: '0 0 16px' }}>{entry ? 'Edit event' : 'Add event'}</p>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
          style={{ ...inp, marginBottom: 10, fontSize: 14 }}
          onKeyDown={e => { if (e.key === 'Enter') void save() }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <select aria-label="Type" value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1, color: type ? '#111111' : '#6E6E6E' }}>
            <option value="">Type…</option>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City / Venue" style={{ ...inp, flex: 1 }} />
        </div>

        <DateFields label={showEnd ? 'Starts' : 'Date'} value={date} onChange={setDate} inp={inp}
          action={!showEnd && (
            <button type="button" onClick={() => setShowEnd(true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: '#6E6E6E', cursor: 'pointer' }}>+ End date</button>
          )} />
        {showEnd && (
          <DateFields label="Ends" value={endDate} onChange={setEndDate} inp={inp}
            action={
              <button type="button" onClick={() => { setShowEnd(false); setEndDate('') }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: '#6E6E6E', cursor: 'pointer' }}>Remove</button>
            } />
        )}

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" style={{ ...inp, marginBottom: 10 }} />

        {(upcoming || goals) && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676', margin: '0 0 8px' }}>Goals</p>
            <textarea value={goals} onChange={e => setGoals(e.target.value)} rows={3} aria-label="Goals"
              placeholder={'One per line, e.g.\nMeet two publishers\nSell 20 books'}
              style={{ ...inp, resize: 'vertical' }} />
          </div>
        )}

        {works.length > 0 && !upcoming && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676', margin: '0 0 8px' }}>Works shown</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto' }}>
              {works.map(w => {
                if (w.id == null) return null
                const sel = workIds.includes(w.id)
                return (
                  <button key={w.id} type="button" onClick={() => toggleWork(w.id!)}
                    style={{ padding: '4px 11px', borderRadius: 999, border: sel ? 'none' : '1px solid #E8E8E8', background: sel ? 'var(--accent)' : 'transparent', color: sel ? '#111111' : '#666666', fontSize: 11, fontWeight: sel ? 600 : 400, cursor: 'pointer', transition: 'background 0.1s' }}>
                    {w.title}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
          style={{ ...inp, resize: 'vertical', marginBottom: 16 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>{entry && <button onClick={() => void del()} style={{ background: 'none', border: 'none', fontSize: 11, color: '#767676', cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#666666', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{entry ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYear(s?: string) { return s ? Number(s.slice(0, 4)) : 0 }

// Drops an end that matches the start and swaps the two if they were entered backwards.
function orderedDates(start: string, end: string): Pick<EventEntry, 'date' | 'endDate'> {
  if (!start) return { date: end || undefined, endDate: undefined }
  if (!end || end === start) return { date: start, endDate: undefined }
  return end < start ? { date: end, endDate: start } : { date: start, endDate: end }
}

function exportCSV(events: EventEntry[]) {
  const rows = [['Date', 'Event', 'City', 'Type'], ...events.map(e => [formatEventDate(e.date, e.endDate), e.title, e.location ?? '', e.type ?? ''])]
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'events.csv'
  a.click()
}

// ─── AllEvents ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export function AllEvents() {
  const dept = useActiveDept()
  const narrow = useNarrow()
  const today = currentMonth()

  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState<EventEntry | 'new' | null>(null)

  const entries = useLiveQuery(() => dept?.id == null ? [] : db.eventEntries.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const works = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  const sorted = useMemo(() => [...entries].sort((a, b) => sortAsc
    ? (a.date ?? '').localeCompare(b.date ?? '')
    : (b.date ?? '').localeCompare(a.date ?? '')), [entries, sortAsc])

  const years = useMemo(() => [...new Set(sorted.map(e => toYear(e.date)).filter(Boolean))].sort((a, b) => b - a), [sorted])
  const types = useMemo(() => [...new Set(sorted.map(e => e.type).filter(Boolean))] as string[], [sorted])
  const cities = useMemo(() => [...new Set(sorted.map(e => e.location).filter(Boolean))] as string[], [sorted])

  const filtered = useMemo(() => sorted.filter(e => {
    if (yearFilter && toYear(e.date) !== yearFilter) return false
    if (typeFilter && e.type !== typeFilter) return false
    if (cityFilter && e.location !== cityFilter) return false
    return true
  }), [sorted, yearFilter, typeFilter, cityFilter])

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE)

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(e => { if (e.type) m[e.type] = (m[e.type] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const cityCounts = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(e => { if (e.location) m[e.location] = (m[e.location] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [filtered])

  const maxCity = cityCounts[0]?.[1] ?? 1

  const colH = (t: string) => <span style={{ fontSize: 9, fontWeight: 600, color: '#767676', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t}</span>
  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ display: 'block', width: narrow ? 'auto' : '100%', flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'left', padding: narrow ? '6px 10px' : '4px 8px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#666666', fontSize: 11, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>
      {label}
    </button>
  )

  return (
    <Shell>
      {editing !== null && (
        <EventForm entry={editing === 'new' ? null : editing} works={works} onDone={() => setEditing(null)} />
      )}

      <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 10, alignItems: narrow ? 'stretch' : 'flex-start' }}>

        {/* ── Left: filters ─────────────────────────────────────── */}
        <div style={{ width: narrow ? 'auto' : 144, flexShrink: 0, background: '#FFFFFF', borderRadius: 20, padding: narrow ? '14px' : '20px 14px', display: 'flex', flexDirection: 'column', gap: narrow ? 10 : 20 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#767676', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>Year</p>
            <div style={narrow ? { display: 'flex', gap: 4, overflowX: 'auto' } : undefined}>
              {filterBtn('All', yearFilter === null, () => setYearFilter(null))}
              {years.map(y => filterBtn(String(y), yearFilter === y, () => setYearFilter(yearFilter === y ? null : y)))}
            </div>
          </div>
          {types.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#767676', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>Type</p>
              <div style={narrow ? { display: 'flex', gap: 4, overflowX: 'auto' } : undefined}>
              {types.map(t => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: narrow ? 'auto' : '100%', flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'left', padding: narrow ? '6px 10px' : '4px 8px', borderRadius: 8, border: 'none', background: typeFilter === t ? '#F5F5F5' : 'none', color: typeFilter === t ? '#111111' : '#666666', fontSize: 11, fontWeight: typeFilter === t ? 600 : 400, cursor: 'pointer' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: TYPE_DOT[t] ?? '#DDDDDD' }} />
                  {t}
                </button>
              ))}
              </div>
            </div>
          )}
          {cities.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#767676', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>City</p>
              <div style={narrow ? { display: 'flex', gap: 4, overflowX: 'auto' } : undefined}>
                {cities.slice(0, 8).map(c => filterBtn(c, cityFilter === c, () => setCityFilter(cityFilter === c ? null : c)))}
              </div>
            </div>
          )}
        </div>

        {/* ── Centre: table ─────────────────────────────────────── */}
        <div style={{ flex: 1, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid #F0F0F0', gap: 8 }}>
            <span style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: '#111111' }}>Events</span>
            <span style={{ fontSize: 10, color: '#767676', fontWeight: 500 }}>{filtered.length}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setSortAsc(v => !v)}
                style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '5px 10px', fontSize: 10, color: '#666666', cursor: 'pointer' }}>
                Date {sortAsc ? '↑' : '↓'}
              </button>
              <button onClick={() => setEditing('new')}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                + Add
              </button>
            </div>
          </div>

          {!narrow && (
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 110px', columnGap: 16, padding: '10px 20px', borderBottom: '1px solid #F0F0F0' }}>
              {['Date', 'Event', 'City', 'Type'].map(h => <span key={h}>{colH(h)}</span>)}
            </div>
          )}

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 11, color: '#767676', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {entries.length === 0 ? 'No events yet' : 'Nothing matches'}
            </p>
          ) : visible.map((e, i) => (
            <div key={e.id} onClick={() => setEditing(e)}
              style={{ display: 'grid', gridTemplateColumns: narrow ? '76px 1fr' : '110px 1fr 130px 110px', columnGap: narrow ? 12 : 16, padding: narrow ? '13px 16px' : '13px 20px', borderBottom: i < visible.length - 1 ? '1px solid #F9F9F9' : 'none', alignItems: 'center', cursor: 'pointer', background: isUpcoming(e, today) ? 'rgba(245,230,66,0.04)' : 'transparent' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: isUpcoming(e, today) ? '#111111' : '#6E6E6E' }}>{formatEventDate(e.date, e.endDate)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: TYPE_DOT[e.type ?? ''] ?? '#DDDDDD' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#444444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                  {isUpcoming(e, today) && <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--accent)', color: '#111111', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{isOngoing(e) ? 'On now' : 'Upcoming'}</span>}
                </div>
                {narrow && (e.location || e.type) && (
                  <span style={{ paddingLeft: 14, fontSize: 10, color: '#6E6E6E' }}>{[e.location, e.type].filter(Boolean).join(' · ')}</span>
                )}
                {e.workIds && e.workIds.length > 0 && (
                  <div style={{ paddingLeft: 14, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {e.workIds.map(id => {
                      const w = works.find(x => x.id === id)
                      if (!w) return null
                      return <span key={id} style={{ fontSize: 9, color: '#6E6E6E', background: '#F5F5F5', padding: '1px 6px', borderRadius: 999 }}>{w.title}</span>
                    })}
                  </div>
                )}
              </div>
              {!narrow && <span style={{ fontSize: 11, color: '#666666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location ?? ''}</span>}
              {!narrow && <span style={{ fontSize: 9, fontWeight: 600, background: '#F5F5F5', color: '#666666', padding: '3px 8px', borderRadius: 4, width: 'fit-content' }}>{e.type ?? ''}</span>}
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', padding: '12px 20px', borderTop: '1px solid #F5F5F5', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#767676' }}>{filtered.length} events{!showAll && filtered.length > PAGE_SIZE ? ` · showing ${PAGE_SIZE}` : ''}</span>
            {!showAll && filtered.length > PAGE_SIZE && (
              <button onClick={() => setShowAll(true)} style={{ background: 'none', border: 'none', fontSize: 10, color: '#666666', cursor: 'pointer', textDecoration: 'underline' }}>Load all</button>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => exportCSV(filtered)} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '5px 12px', fontSize: 10, color: '#666666', cursor: 'pointer' }}>Export CSV</button>
            </div>
          </div>
        </div>

        {/* ── Right: analytics ──────────────────────────────────── */}
        <div style={{ width: narrow ? 'auto' : 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {typeCounts.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 16px' }}>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#767676', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 14px' }}>By type</p>
              {typeCounts.map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_DOT[type] ?? '#DDDDDD', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#444444', flex: 1 }}>{type}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#111111' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
          {cityCounts.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 16px' }}>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#767676', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 14px' }}>By city</p>
              {cityCounts.map(([city, count]) => (
                <div key={city} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#444444' }}>{city}</span>
                    <span style={{ fontSize: 10, color: '#6E6E6E' }}>{count}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: '#F5F5F5', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxCity) * 100}%`, background: '#111111', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Shell>
  )
}
