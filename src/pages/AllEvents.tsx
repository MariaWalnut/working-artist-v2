import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const TYPE_COLORS: Record<string, string> = {
  Exhibition: '#111111',
  Residency:  '#AAAAAA',
  Release:    'transparent',
  Award:      '#F5E642',
  Commission: '#888888',
  Press:      '#EEEEEE',
  'Open call': '#A8C8E0',
  Grant:      '#B8E0A4',
  Other:      '#DDDDDD',
}

const TYPE_BORDER: Record<string, string> = {
  Release: '1.5px solid #CCCCCC',
  Other:   '1px dashed #CCCCCC',
}

type Event = {
  id: string
  title: string
  subtitle?: string
  location?: string
  date?: string
  type: string
  year: number
  upcoming: boolean
  sourceType: 'project' | 'opportunity'
  sourceId: number
}

function toYear(s?: string) { return s ? Number(s.slice(0, 4)) : 0 }

function fmtDate(s?: string) {
  if (!s) return null
  const [y, m] = s.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function AllEvents() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 7)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)

  const projects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const opps = useLiveQuery(() => dept?.id == null ? [] : db.opportunities.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  const events: Event[] = [
    ...projects.map(p => ({
      id: `p${p.id}`,
      title: p.title,
      subtitle: p.projectType,
      location: p.location,
      date: p.dateStart,
      type: p.projectType ?? 'Other',
      year: toYear(p.dateStart) || new Date().getFullYear(),
      upcoming: (p.dateStart ?? '') >= today,
      sourceType: 'project' as const,
      sourceId: p.id!,
    })),
    ...opps.filter(o => o.status === 'Shortlisted' || o.status === 'Won' || o.status === 'Applied').map(o => ({
      id: `o${o.id}`,
      title: o.title,
      subtitle: o.opportunityType,
      location: o.organisation,
      date: o.deadline,
      type: o.opportunityType ?? 'Other',
      year: toYear(o.deadline) || new Date().getFullYear(),
      upcoming: (o.deadline ?? '') >= today,
      sourceType: 'opportunity' as const,
      sourceId: o.id!,
    })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const years = [...new Set(events.map(e => e.year))].sort((a, b) => b - a)
  const types = [...new Set(events.map(e => e.type))]
  const cities = [...new Set(events.map(e => e.location).filter(Boolean))] as string[]

  const filtered = events.filter(e => {
    if (yearFilter && e.year !== yearFilter) return false
    if (typeFilter && e.type !== typeFilter) return false
    if (cityFilter && e.location !== cityFilter) return false
    return true
  })

  const colHeader = (t: string) => <span style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t}</span>

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#888888', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>{label}</button>
  )

  return (
    <Shell>
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Left filters */}
        <div style={{ width: 144, flexShrink: 0, background: '#FFFFFF', borderRadius: 20, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 8px' }}>Year</p>
            {filterBtn('All', yearFilter === null, () => setYearFilter(null))}
            {years.map(y => filterBtn(String(y), yearFilter === y, () => setYearFilter(y)))}
          </div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 8px' }}>Type</p>
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 8, border: 'none', background: typeFilter === t ? '#F5F5F5' : 'none', color: typeFilter === t ? '#111111' : '#888888', fontSize: 12, fontWeight: typeFilter === t ? 600 : 400, cursor: 'pointer' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLORS[t] ?? '#DDDDDD', border: TYPE_BORDER[t] ?? 'none', flexShrink: 0 }} />
                {t}
              </button>
            ))}
          </div>
          {cities.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 8px' }}>City</p>
              {cities.map(c => filterBtn(c, cityFilter === c, () => setCityFilter(cityFilter === c ? null : c)))}
            </div>
          )}
        </div>

        {/* Main card */}
        <div style={{ flex: 1, background: '#FFFFFF', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111111' }}>All events</span>
            <span style={{ fontSize: 10, color: '#CCCCCC', fontWeight: 500, marginLeft: 8 }}>{filtered.length}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', fontSize: 10, color: '#AAAAAA', cursor: 'pointer' }}>← Projects</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px 80px', padding: '10px 20px', borderBottom: '1px solid #F0F0F0' }}>
            {['Date', 'Event', 'City', 'Type', 'Year'].map(h => <span key={h}>{colHeader(h)}</span>)}
          </div>

          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 11, color: '#CCCCCC', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No events</p>
          ) : filtered.map(e => {
            const dotBg = TYPE_COLORS[e.type] ?? '#DDDDDD'
            const dotBorder = TYPE_BORDER[e.type]
            return (
              <div key={e.id} onClick={() => e.sourceType === 'project' ? navigate(`/projects/${e.sourceId}`) : undefined}
                style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px 80px', padding: '13px 20px', borderBottom: '1px solid #F9F9F9', alignItems: 'center', cursor: e.sourceType === 'project' ? 'pointer' : 'default', background: e.upcoming ? '#FDFDF8' : 'transparent' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: e.upcoming ? '#111111' : '#888888' }}>{fmtDate(e.date) ?? '—'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotBg, border: dotBorder ?? 'none', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: e.upcoming ? '#111111' : '#444444' }}>{e.title}</span>
                  {e.upcoming && <span style={{ fontSize: 8, fontWeight: 600, background: '#F5E642', color: '#111111', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Upcoming</span>}
                </div>
                <span style={{ fontSize: 11, color: '#888888' }}>{e.location ?? '—'}</span>
                <span style={{ fontSize: 9, fontWeight: 500, background: TYPE_COLORS[e.type] === '#F5E642' ? '#F5E642' : (TYPE_COLORS[e.type] === '#111111' ? '#111111' : '#F5F5F5'), color: TYPE_COLORS[e.type] === '#111111' ? '#FFFFFF' : (TYPE_COLORS[e.type] === '#F5E642' ? '#111111' : '#666666'), padding: '3px 8px', borderRadius: 4, width: 'fit-content' }}>{e.type}</span>
                <span style={{ fontSize: 11, color: '#CCCCCC', textAlign: 'right' }}>{e.year}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
