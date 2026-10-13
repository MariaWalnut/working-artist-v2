import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

// ─── Type styling ─────────────────────────────────────────────────────────────

const TYPE_DOT: Record<string, string> = {
  Exhibition:  '#111111',
  Residency:   '#888888',
  Release:     'transparent',
  Award:       '#F5E642',
  Commission:  '#AAAAAA',
  Press:       '#DDDDDD',
  Books:       '#AAAAAA',
  Publications:'#AAAAAA',
  Other:       '#EEEEEE',
}
const TYPE_DOT_BORDER: Record<string, string> = {
  Release: '1.5px solid #CCCCCC',
}

const TYPE_BADGE_BG: Record<string, string> = {
  Exhibition: '#111111',
  Award:      '#F5E642',
  Residency:  '#888888',
}
const TYPE_BADGE_COLOR: Record<string, string> = {
  Exhibition: '#FFFFFF',
  Residency:  '#FFFFFF',
}

// ─── Event type ───────────────────────────────────────────────────────────────

type Event = {
  id: string
  title: string
  location?: string
  date?: string
  type: string
  year: number
  upcoming: boolean
  sourceType: 'project' | 'press'
  sourceId?: number
}

function toYear(s?: string) { return s ? Number(s.slice(0, 4)) : 0 }
function fmtDate(s?: string): string | null {
  if (!s) return null
  const parts = s.split('-')
  if (parts.length < 2 || !parts[1]) return parts[0] ?? null
  return new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function exportCSV(events: Event[]) {
  const rows = [['Date', 'Event', 'City', 'Type', 'Year'], ...events.map(e => [fmtDate(e.date) ?? '', e.title, e.location ?? '', e.type, String(e.year)])]
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
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 7)

  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const projects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const pressEntries = useLiveQuery(() => dept?.id == null ? [] : db.pressEntries.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  const events: Event[] = useMemo(() => {
    const fromProjects: Event[] = projects.map(p => ({
      id: `p${p.id}`,
      title: p.title,
      location: p.location,
      date: p.dateStart ?? p.dateEnd,
      type: p.projectType ?? 'Other',
      year: toYear(p.dateStart ?? p.dateEnd) || new Date().getFullYear(),
      upcoming: (p.dateStart ?? '') >= today,
      sourceType: 'project' as const,
      sourceId: p.id,
    }))
    const fromPress: Event[] = pressEntries.map(p => ({
      id: `pr${p.id}`,
      title: p.title,
      location: p.outlet,
      date: p.date,
      type: 'Press',
      year: toYear(p.date) || new Date().getFullYear(),
      upcoming: false,
      sourceType: 'press' as const,
      sourceId: p.id,
    }))
    const all = [...fromProjects, ...fromPress]
    return all.sort((a, b) => sortAsc
      ? (a.date ?? '').localeCompare(b.date ?? '')
      : (b.date ?? '').localeCompare(a.date ?? ''))
  }, [projects, pressEntries, sortAsc, today])

  const years = useMemo(() => [...new Set(events.map(e => e.year))].sort((a, b) => b - a), [events])
  const types = useMemo(() => [...new Set(events.map(e => e.type))], [events])
  const cities = useMemo(() => [...new Set(events.map(e => e.location).filter(Boolean))] as string[], [events])

  const filtered = useMemo(() => events.filter(e => {
    if (yearFilter && e.year !== yearFilter) return false
    if (typeFilter && e.type !== typeFilter) return false
    if (cityFilter && e.location !== cityFilter) return false
    return true
  }), [events, yearFilter, typeFilter, cityFilter])

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE)

  // Analytics
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(e => { m[e.type] = (m[e.type] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const cityCounts = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(e => { if (e.location) m[e.location] = (m[e.location] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [filtered])

  const maxCity = cityCounts[0]?.[1] ?? 1

  const colH = (t: string) => <span style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t}</span>
  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#888888', fontSize: 11, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>
      {label}
    </button>
  )

  return (
    <Shell>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

        {/* ── Left: filters ─────────────────────────────────────── */}
        <div style={{ width: 144, flexShrink: 0, background: '#FFFFFF', borderRadius: 20, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>Year</p>
            {filterBtn('All', yearFilter === null, () => setYearFilter(null))}
            {years.map(y => filterBtn(String(y), yearFilter === y, () => setYearFilter(yearFilter === y ? null : y)))}
          </div>
          {types.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>Type</p>
              {types.map(t => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '4px 8px', borderRadius: 8, border: 'none', background: typeFilter === t ? '#F5F5F5' : 'none', color: typeFilter === t ? '#111111' : '#888888', fontSize: 11, fontWeight: typeFilter === t ? 600 : 400, cursor: 'pointer' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: TYPE_DOT[t] ?? '#DDDDDD', border: TYPE_DOT_BORDER[t] ?? 'none' }} />
                  {t}
                </button>
              ))}
            </div>
          )}
          {cities.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 6px' }}>City</p>
              {cities.slice(0, 8).map(c => filterBtn(c, cityFilter === c, () => setCityFilter(cityFilter === c ? null : c)))}
            </div>
          )}
        </div>

        {/* ── Centre: event table ───────────────────────────────── */}
        <div style={{ flex: 1, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid #F0F0F0', gap: 8 }}>
            <span style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: '#111111' }}>All events</span>
            <span style={{ fontSize: 10, color: '#CCCCCC', fontWeight: 500 }}>{filtered.length}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setSortAsc(v => !v)}
                style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '5px 10px', fontSize: 10, color: '#888888', cursor: 'pointer' }}>
                Date {sortAsc ? '↑' : '↓'}
              </button>
              <button onClick={() => navigate('/projects')}
                style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                + Add event
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 110px 60px', padding: '10px 20px', borderBottom: '1px solid #F0F0F0' }}>
            {['Date', 'Event', 'City', 'Type', 'Year'].map(h => <span key={h}>{colH(h)}</span>)}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No events</p>
          ) : visible.map((e, i) => {
            const badgeBg = TYPE_BADGE_BG[e.type] ?? '#F5F5F5'
            const badgeColor = TYPE_BADGE_COLOR[e.type] ?? '#666666'
            return (
              <div key={e.id} onClick={() => e.sourceType === 'project' && e.sourceId ? navigate(`/projects/${e.sourceId}`) : undefined}
                style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 110px 60px', padding: '13px 20px', borderBottom: i < visible.length - 1 ? '1px solid #F9F9F9' : 'none', alignItems: 'center', cursor: e.sourceType === 'project' ? 'pointer' : 'default', background: e.upcoming ? 'rgba(245,230,66,0.04)' : 'transparent' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: e.upcoming ? '#111111' : '#999999' }}>{fmtDate(e.date) ?? '—'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: TYPE_DOT[e.type] ?? '#DDDDDD', border: TYPE_DOT_BORDER[e.type] ?? 'none' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: e.upcoming ? '#111111' : '#444444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                  {e.upcoming && <span style={{ fontSize: 8, fontWeight: 700, background: '#F5E642', color: '#111111', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>Upcoming</span>}
                </div>
                <span style={{ fontSize: 11, color: '#888888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location ?? ''}</span>
                <span style={{ fontSize: 9, fontWeight: 600, background: badgeBg, color: badgeColor, padding: '3px 8px', borderRadius: 4, width: 'fit-content' }}>{e.type}</span>
                <span style={{ fontSize: 11, color: '#CCCCCC', textAlign: 'right' }}>{e.year || ''}</span>
              </div>
            )
          })}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F5F5F5', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#CCCCCC' }}>{filtered.length} events{!showAll && filtered.length > PAGE_SIZE ? ` · showing ${PAGE_SIZE}` : ''}</span>
            {!showAll && filtered.length > PAGE_SIZE && (
              <button onClick={() => setShowAll(true)} style={{ background: 'none', border: 'none', fontSize: 10, color: '#888888', cursor: 'pointer', textDecoration: 'underline' }}>Load all</button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => exportCSV(filtered)} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '5px 12px', fontSize: 10, color: '#888888', cursor: 'pointer' }}>Export CSV</button>
            </div>
          </div>
        </div>

        {/* ── Right: analytics ──────────────────────────────────── */}
        <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {typeCounts.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 16px' }}>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 14px' }}>By type</p>
              {typeCounts.map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_DOT[type] ?? '#DDDDDD', border: TYPE_DOT_BORDER[type] ?? 'none', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#444444', flex: 1 }}>{type}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#111111' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
          {cityCounts.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 16px' }}>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 14px' }}>By city</p>
              {cityCounts.map(([city, count]) => (
                <div key={city} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#444444' }}>{city}</span>
                    <span style={{ fontSize: 10, color: '#AAAAAA' }}>{count}</span>
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
