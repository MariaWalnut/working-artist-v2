import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

// ─── Event model ─────────────────────────────────────────────────────────────

type EventKind = 'project' | 'work' | 'book' | 'release'

interface CareerEvent {
  key: string
  year: number
  month: number // 1–12, or 0 = undated within year
  kind: EventKind
  label: string
  sub: string
}

function projectDate(p: { projectType?: string; dateStart?: string; dateEnd?: string; publishedDate?: string; releaseDate?: string; awardYear?: string }): [number, number] | null {
  const raw = p.projectType === 'Award' ? (p.awardYear ? `${p.awardYear}-01` : null)
    : (p.projectType === 'Books' || p.projectType === 'Publications') ? p.publishedDate
    : p.projectType === 'Release' ? p.releaseDate
    : (p.dateStart ?? p.dateEnd)
  if (!raw) return null
  const y = parseInt(raw.slice(0, 4), 10)
  const m = parseInt(raw.slice(5, 7) ?? '0', 10) || 0
  return y > 0 ? [y, m] : null
}

// ─── Layout algorithm ────────────────────────────────────────────────────────

const MONTH_BAR_H = 24
const LINE_Y = MONTH_BAR_H
const TOP = MONTH_BAR_H + 24
const LANE_H = 72
const HALF_LABEL = 40
const LABEL_W_PX = 84
const DEFAULT_GAP = 90

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthX(m: number): number {
  return m >= 1 ? ((m - 0.5) / 12) * 1000 : 0
}

interface Placed { e: CareerEvent; mx: number; lx: number; lane: number }

function layoutYear(events: CareerEvent[], minGap: number): Placed[] {
  const sorted = [...events].sort((a, b) => monthX(a.month) - monthX(b.month))
  const laneRight: number[] = []
  return sorted.map((e) => {
    const x = monthX(e.month)
    let lane = laneRight.findIndex((r) => x - r >= minGap)
    if (lane === -1) { lane = laneRight.length; laneRight.push(x) }
    else laneRight[lane] = x
    return { e, mx: x, lx: Math.max(HALF_LABEL, Math.min(1000 - HALF_LABEL, x)), lane }
  })
}

// ─── Kind config ─────────────────────────────────────────────────────────────

const KIND_DOT: Record<EventKind, string> = {
  project: '#111111',
  work: '#AAAAAA',
  book: '#888888',
  release: '#C0C0C0',
}

const KIND_LABELS: Record<EventKind, string> = {
  project: 'Projects',
  work: 'Works',
  book: 'Books',
  release: 'Releases',
}

// ─── YearRow ─────────────────────────────────────────────────────────────────

function YearRow({ year, events, minGap, measureRef, collapsed, onToggle, onSelect }: {
  year: number
  events: CareerEvent[]
  minGap: number
  measureRef?: React.Ref<HTMLDivElement>
  collapsed: boolean
  onToggle: () => void
  onSelect: (e: CareerEvent) => void
}) {
  const hasEvents = events.length > 0
  const placed = collapsed ? [] : layoutYear(events, minGap)
  const lanes = placed.length ? Math.max(...placed.map(p => p.lane)) + 1 : 1
  const rowH = TOP + lanes * LANE_H
  const markerY = (lane: number) => TOP + lane * LANE_H

  return (
    <div style={{ borderBottom: '1px solid #F5F5F5' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Year label */}
        <button
          onClick={hasEvents ? onToggle : undefined}
          style={{ width: 58, flexShrink: 0, background: 'none', border: 'none', borderRight: '1px solid #F5F5F5', cursor: hasEvents ? 'pointer' : 'default', minHeight: MONTH_BAR_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8 }}
        >
          <span style={{ fontFamily: 'Recoleta, serif', fontSize: 13, color: hasEvents ? '#999999' : '#DDDDDD', fontWeight: 400 }}>{year}</span>
          {hasEvents && (
            <span style={{ fontSize: 7, color: '#DDDDDD', marginLeft: 3, marginTop: 4 }}>{collapsed ? '▶' : '▼'}</span>
          )}
        </button>

        {/* Timeline area */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div ref={measureRef} style={{ position: 'relative', minWidth: 500, height: collapsed || !hasEvents ? MONTH_BAR_H : rowH }}>

            {/* Month bar */}
            <div style={{ position: 'absolute', inset: '0 0 auto 0', height: MONTH_BAR_H, borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center' }}>
              {MONTHS.map((m, i) => (
                <div key={m} style={{ position: 'absolute', left: `${((i + 0.5) / 12) * 100}%`, transform: 'translateX(-50%)', fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#DDDDDD', fontWeight: 500 }}>
                  {m}
                </div>
              ))}
            </div>

            {!collapsed && hasEvents && (
              <>
                {/* Connector lines */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox={`0 0 1000 ${rowH}`} preserveAspectRatio="none" fill="none">
                  {placed.map(({ e, mx, lx, lane }) => (
                    <path key={e.key}
                      d={`M ${mx} ${LINE_Y} L ${mx} ${markerY(lane) - 4} L ${lx} ${markerY(lane)}`}
                      stroke="#EEEEEE" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>

                {placed.map(({ e, mx, lx, lane }) => (
                  <Fragment key={e.key}>
                    {/* Month tick */}
                    <div style={{ position: 'absolute', left: `${mx / 10}%`, top: LINE_Y, width: 1, height: 5, background: '#DDDDDD' }} />
                    {/* Event label */}
                    <button onClick={() => onSelect(e)}
                      style={{ position: 'absolute', left: `${lx / 10}%`, top: markerY(lane), transform: 'translateX(-50%)', width: 80, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_DOT[e.kind] }} />
                      </div>
                      <span style={{ display: '-webkit-box', fontSize: 9, fontWeight: 500, color: '#444444', lineHeight: 1.3, overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {e.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 8, color: '#BBBBBB', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>
                        {e.sub}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Event popup ─────────────────────────────────────────────────────────────

function EventPopup({ e, onClose }: { e: CareerEvent; onClose: () => void }) {
  const monthLabel = e.month > 0
    ? new Date(e.year, e.month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : String(e.year)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px', maxWidth: 420, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.18)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 10px' }}>{e.kind} · {monthLabel}</p>
        <h2 style={{ fontFamily: 'Recoleta, serif', fontSize: 22, fontWeight: 400, margin: '0 0 6px', color: '#111111' }}>{e.label}</h2>
        <p style={{ fontSize: 13, color: '#888888', margin: 0 }}>{e.sub}</p>
        <button onClick={onClose} style={{ marginTop: 24, background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 11, color: '#888888', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )
}

// ─── Career page ─────────────────────────────────────────────────────────────

export function Career() {
  const dept = useActiveDept()
  const deptId = dept?.id

  const projects = useLiveQuery(() => deptId == null ? [] : db.projects.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const works = useLiveQuery(() => deptId == null ? [] : db.works.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const books = useLiveQuery(() => deptId == null ? [] : db.books.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const releases = useLiveQuery(() => deptId == null ? [] : db.releases.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []

  const [show, setShow] = useState<Record<EventKind, boolean>>({ project: true, work: true, book: true, release: true })
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<CareerEvent | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(0)

  useLayoutEffect(() => {
    const el = chartRef.current
    if (!el) return
    const measure = () => setChartW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const minGap = chartW > 0 ? Math.min(500, (LABEL_W_PX / chartW) * 1000) : DEFAULT_GAP

  const all: CareerEvent[] = []

  if (show.project) {
    for (const p of projects) {
      const d = projectDate(p)
      if (!d) continue
      const [y, m] = d
      all.push({ key: `p${p.id}`, year: y, month: m, kind: 'project', label: p.title, sub: p.projectType ?? 'Project' })
    }
  }
  if (show.work) {
    for (const w of works) {
      if (!w.year) continue
      all.push({ key: `w${w.id}`, year: w.year, month: 0, kind: 'work', label: w.title, sub: w.medium ?? 'Work' })
    }
  }
  if (show.book) {
    for (const b of books) {
      if (!b.publishedDate) continue
      const y = parseInt(b.publishedDate.slice(0, 4), 10)
      const m = parseInt(b.publishedDate.slice(5, 7) ?? '0', 10) || 0
      if (!y) continue
      all.push({ key: `b${b.id}`, year: y, month: m, kind: 'book', label: b.title, sub: b.publisher ?? 'Book' })
    }
  }
  if (show.release) {
    for (const r of releases) {
      if (!r.year) continue
      all.push({ key: `r${r.id}`, year: r.year, month: 0, kind: 'release', label: r.title, sub: r.format ?? 'Release' })
    }
  }

  const currentYear = new Date().getFullYear()
  const years = [...new Set([...all.map(e => e.year), currentYear])].sort((a, b) => b - a)

  const toggleKind = (k: EventKind) => setShow(s => ({ ...s, [k]: !s[k] }))
  const toggleYear = (y: number) => setCollapsed(prev => { const next = new Set(prev); next.has(y) ? next.delete(y) : next.add(y); return next })

  const isEmpty = all.length === 0

  return (
    <Shell>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 24, fontWeight: 400, margin: 0, color: '#111111' }}>Career</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(KIND_LABELS) as EventKind[]).map(k => (
            <button key={k} onClick={() => toggleKind(k)}
              style={{ padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11,
                background: show[k] ? '#111111' : '#F5F5F5', color: show[k] ? '#FFFFFF' : '#888888', fontWeight: show[k] ? 600 : 400 }}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '64px 0', textAlign: 'center', color: '#CCCCCC', fontSize: 13, fontStyle: 'italic' }}>
          Add dated projects, works, books or releases to build your career timeline.
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          {years.map((year, i) => (
            <YearRow
              key={year}
              year={year}
              events={all.filter(e => e.year === year)}
              minGap={minGap}
              measureRef={i === 0 ? chartRef : undefined}
              collapsed={collapsed.has(year)}
              onToggle={() => toggleYear(year)}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {selected && <EventPopup e={selected} onClose={() => setSelected(null)} />}
    </Shell>
  )
}
