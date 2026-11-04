import { Fragment, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { practiceOf, usePractice } from '../lib/practice'
import { Shell } from '../components/layout/Shell'
import { kindOf, parseLooseDate, workSubtitle } from '../lib/works'
import { ClippingViewer } from '../components/ClippingViewer'
import { CareerFrame } from '../components/CareerTabs'
import type { PressEntry } from '../db/db'
import { formatAnyDate, formatEventDate, onTimeline } from '../lib/eventDates'
import { useNarrow } from '../lib/useNarrow'

// ─── Event model ─────────────────────────────────────────────────────────────

type EventKind = 'project' | 'event' | 'work' | 'rights' | 'press' | 'award'

interface CareerEvent {
  key: string
  year: number
  month: number // 1–12, or 0 = undated within year
  kind: EventKind
  label: string
  sub: string
  dateLabel?: string
  open?: string // route for "Open"
  groups?: Array<{ title: string; links: Array<{ label: string; to: string }> }>
  clipping?: PressEntry
  eventId?: number // set for events, which can be taken off the timeline
}

function projectDate(p: { projectType?: string; dateStart?: string; dateEnd?: string; publishedDate?: string; releaseDate?: string; awardYear?: string }): [number, number] | null {
  const raw = p.projectType === 'Award' ? (p.awardYear ? `${p.awardYear}-01` : null)
    : (p.projectType === 'Books' || p.projectType === 'Publications') ? p.publishedDate
    : p.projectType === 'Release' ? p.releaseDate
    : p.projectType === 'Film' ? (p.releaseDate ?? p.dateStart ?? p.dateEnd)
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
const DEFAULT_GAP = 170 // safe for the 500px minimum width until the real width is known

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthX(m: number): number {
  return m >= 1 ? ((m - 0.5) / 12) * 1000 : 0
}

interface Placed { e: CareerEvent; mx: number; lx: number; lane: number }

// Labels are packed into lanes by where they are actually drawn (edge labels are pulled inward),
// so two labels in one lane are always at least a label width apart.
function layoutYear(events: CareerEvent[], minGap: number): Placed[] {
  const sorted = [...events].sort((a, b) => monthX(a.month) - monthX(b.month) || a.label.localeCompare(b.label))
  const laneRight: number[] = []
  return sorted.map((e) => {
    const x = monthX(e.month)
    const half = Math.max(HALF_LABEL, minGap / 2)
    const lx = Math.max(half, Math.min(1000 - half, x))
    let lane = laneRight.findIndex((r) => lx - r >= minGap)
    if (lane === -1) { lane = laneRight.length; laneRight.push(lx) }
    else laneRight[lane] = lx
    return { e, mx: x, lx, lane }
  })
}

// ─── Kind config ─────────────────────────────────────────────────────────────

const KIND_DOT: Record<EventKind, string> = {
  project: 'var(--wa-ink)',
  event: '#E0A030',
  work: '#7A7A7A',
  rights: '#D0805A',
  press: '#9C86C4',
  award: '#5FA897',
}

const KIND_LABELS: Record<EventKind, string> = {
  project: 'Projects',
  event: 'Events',
  work: 'Works',
  rights: 'Rights',
  press: 'Press',
  award: 'Awards',
}

// ─── YearRow ─────────────────────────────────────────────────────────────────

function YearRow({ year, events, minGap, measureRef, collapsed, last, onToggle, onSelect }: {
  year: number
  events: CareerEvent[]
  minGap: number
  measureRef?: React.Ref<HTMLDivElement>
  collapsed: boolean
  last: boolean
  onToggle: () => void
  onSelect: (e: CareerEvent) => void
}) {
  const hasEvents = events.length > 0
  const placed = collapsed ? [] : layoutYear(events, minGap)
  const lanes = placed.length ? Math.max(...placed.map(p => p.lane)) + 1 : 1
  const rowH = TOP + lanes * LANE_H
  const markerY = (lane: number) => TOP + lane * LANE_H

  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--wa-line)' }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Year label */}
        <button
          onClick={hasEvents ? onToggle : undefined}
          style={{ width: 58, flexShrink: 0, background: 'none', border: 'none', borderRight: '1px solid var(--wa-line)', cursor: hasEvents ? 'pointer' : 'default', minHeight: MONTH_BAR_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 0 }}
        >
          <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, lineHeight: `${MONTH_BAR_H}px`, color: hasEvents ? 'var(--wa-ink)' : 'var(--wa-muted)', fontWeight: 400 }}>{year}</span>
          {hasEvents && (
            <span style={{ fontSize: 8, lineHeight: `${MONTH_BAR_H}px`, color: 'var(--wa-muted)', marginLeft: 4 }}>{collapsed ? '▶' : '▼'}</span>
          )}
        </button>

        {/* Timeline area */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div ref={measureRef} style={{ position: 'relative', minWidth: 500, height: collapsed || !hasEvents ? MONTH_BAR_H : rowH }}>

            {/* Month bar */}
            <div style={{ position: 'absolute', inset: '0 0 auto 0', height: MONTH_BAR_H, borderBottom: '1px solid var(--wa-line)', display: 'flex', alignItems: 'center' }}>
              {MONTHS.map((m, i) => (
                <div key={m} style={{ position: 'absolute', left: `${((i + 0.5) / 12) * 100}%`, transform: 'translateX(-50%)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--wa-muted)', fontWeight: 600 }}>
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
                      stroke="#BDBDBD" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>

                {placed.map(({ e, mx, lx, lane }) => (
                  <Fragment key={e.key}>
                    {/* Month tick */}
                    <div style={{ position: 'absolute', left: `${mx / 10}%`, top: LINE_Y, width: 1, height: 6, background: '#8A8A8A' }} />
                    {/* Event label */}
                    <button data-tour-title={e.label} onClick={() => onSelect(e)}
                      style={{ position: 'absolute', left: `${lx / 10}%`, top: markerY(lane), transform: 'translateX(-50%)', width: 92, maxHeight: LANE_H - 8, overflow: 'hidden', background: 'var(--wa-surface)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '0 0 2px', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_DOT[e.kind] }} />
                      </div>
                      <span style={{ display: '-webkit-box', fontSize: 11, fontWeight: 500, color: 'var(--wa-ink)', lineHeight: 1.25, overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {e.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 9, color: '#6B6B6B', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

// ─── Year list (phones) ──────────────────────────────────────────────────────
// The month grid needs a wide screen; on a phone each year is a plain list, newest first.

function YearList({ year, events, onSelect }: { year: number; events: CareerEvent[]; onSelect: (e: CareerEvent) => void }) {
  const sorted = [...events].sort((a, b) => b.month - a.month)
  return (
    <section style={{ padding: '18px 16px 8px', borderTop: '1px solid var(--wa-line)' }}>
      <h3 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 22, color: 'var(--wa-ink)', margin: '0 0 6px' }}>{year}</h3>
      {sorted.map(e => (
        <button key={e.key} data-tour-title={e.label} onClick={() => onSelect(e)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--wa-line)', padding: '11px 0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <span style={{ width: 34, flexShrink: 0, paddingTop: 2, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wa-muted)' }}>
            {e.month > 0 ? new Date(year, e.month - 1).toLocaleDateString('en-GB', { month: 'short' }) : ''}
          </span>
          <span style={{ width: 8, height: 8, flexShrink: 0, marginTop: 5, borderRadius: '50%', background: KIND_DOT[e.kind] }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--wa-ink)', lineHeight: 1.3 }}>{e.label}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 2 }}>{e.sub}</span>
          </span>
        </button>
      ))}
    </section>
  )
}

// ─── Event popup ─────────────────────────────────────────────────────────────

function EventPopup({ e, onClose }: { e: CareerEvent; onClose: () => void }) {
  const navigate = useNavigate()
  const [viewing, setViewing] = useState(false)
  if (viewing && e.clipping) return <ClippingViewer entry={e.clipping} onClose={() => setViewing(false)} />
  const monthLabel = e.dateLabel ?? (e.month > 0
    ? new Date(e.year, e.month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : String(e.year))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: '28px 32px', maxWidth: 420, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.18)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 10px' }}>{e.kind} · {monthLabel}</p>
        <h2 style={{ fontFamily: 'Recoleta, serif', fontSize: 22, fontWeight: 400, margin: '0 0 6px', color: 'var(--wa-ink)' }}>{e.label}</h2>
        <p style={{ fontSize: 13, color: 'var(--wa-text-2)', margin: 0 }}>{e.sub}</p>
        {(e.groups ?? []).filter(g => g.links.length > 0).map(g => (
          <div key={g.title} style={{ marginTop: 18 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 6px' }}>{g.title}</p>
            {g.links.map(l => (
              <button key={l.to + l.label} onClick={() => navigate(l.to)}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--wa-line)', padding: '9px 0', fontSize: 13, color: 'var(--wa-ink)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                {l.label}<span style={{ color: 'var(--wa-muted)' }}>→</span>
              </button>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {e.clipping && <button onClick={() => setViewing(true)} style={{ background: 'var(--wa-black)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 11, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>View clipping</button>}
          {e.open && <button onClick={() => navigate(e.open!)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 11, fontWeight: 600, color: '#111111', cursor: 'pointer' }}>Open</button>}
          <button onClick={onClose} style={{ background: 'var(--wa-fill)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 11, color: 'var(--wa-text)', cursor: 'pointer' }}>Close</button>
        </div>
        {e.eventId != null && (
          <button onClick={() => { void db.eventEntries.update(e.eventId!, { onTimeline: false }); onClose() }}
            style={{ display: 'block', marginTop: 14, padding: 0, border: 'none', background: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Remove from timeline</button>
        )}
      </div>
    </div>
  )
}

// ─── Career page ─────────────────────────────────────────────────────────────

export function Career() {
  const dept = useActiveDept()
  const deptId = dept?.id

  const { acts, keep } = usePractice()
  const allProjects = useLiveQuery(() => deptId == null ? [] : db.projects.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const allWorks = useLiveQuery(() => deptId == null ? [] : db.works.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const allEvents = useLiveQuery(() => deptId == null ? [] : db.eventEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const allPress = useLiveQuery(() => deptId == null ? [] : db.pressEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const of = practiceOf(acts, allWorks)
  const projects = allProjects.filter(p => keep(of.project(p)))
  const works = allWorks.filter(w => keep(of.work(w)))
  const events = allEvents.filter(e => of.eventAll(e).some(keep))
  const press = allPress.filter(p => keep(of.press(p)))

  const narrow = useNarrow()
  const [show, setShow] = useState<Record<EventKind, boolean>>({ project: true, event: true, work: true, rights: true, press: true, award: true })
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<CareerEvent | null>(null)
  const [chartW, setChartW] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)

  // Measured whenever the timeline appears (it mounts only after data loads) and on resize.
  const chartRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    setChartW(el.clientWidth)
    observer.current = new ResizeObserver(() => setChartW(el.clientWidth))
    observer.current.observe(el)
  }, [])

  const minGap = chartW > 0 ? Math.min(500, (LABEL_W_PX / chartW) * 1000) : DEFAULT_GAP

  const all: CareerEvent[] = []

  if (show.project) {
    for (const p of projects) {
      const d = projectDate(p)
      if (!d) continue
      const [y, m] = d
      all.push({ key: `p${p.id}`, year: y, month: m, kind: 'project', label: p.title, sub: p.projectType ?? 'Project', open: `/projects/${p.id}` })
    }
  }
  if (show.event) {
    for (const ev of events) {
      if (!ev.date || !onTimeline(ev)) continue
      const y = parseInt(ev.date.slice(0, 4), 10)
      if (!y) continue
      const shown = (ev.workIds ?? []).flatMap(id => {
        const w = works.find(x => x.id === id)
        return w ? [{ label: w.title, to: `/studio/${w.id}` }] : []
      })
      all.push({
        key: `e${ev.id}`, year: y, month: parseInt(ev.date.slice(5, 7), 10) || 0, kind: 'event', label: ev.title,
        sub: [ev.type, ev.location].filter(Boolean).join(' · ') || 'Event', dateLabel: formatEventDate(ev.date, ev.endDate),
        open: `/projects/events?e=${ev.id}`, eventId: ev.id, groups: [{ title: 'Works shown', links: shown }],
      })
    }
  }
  if (show.work) {
    for (const w of works) {
      if (w.inProgress) continue
      // Published works sit on their publication month; others on their own year and month.
      const pubYear = w.publishedDate ? parseInt(w.publishedDate.slice(0, 4), 10) || 0 : 0
      const year = pubYear || w.year
      if (!year) continue
      const month = pubYear ? parseInt(w.publishedDate!.slice(5, 7), 10) || 0 : w.month ?? 0
      const shownAt = events.filter(ev => (ev.workIds ?? []).includes(w.id!)).map(ev => ({ label: [ev.title, formatEventDate(ev.date, ev.endDate)].filter(Boolean).join(' · '), to: '/projects/events' }))
      const about = press.filter(p => p.workId === w.id).map(p => ({ award: p.category === 'award', label: [p.title, p.outlet].filter(Boolean).join(' · '), to: '/career/recognition' }))
      const pressAbout = about.filter(p => !p.award)
      const awardsFor = about.filter(p => p.award)
      all.push({
        key: `w${w.id}`, year, month, kind: 'work', label: w.title, sub: workSubtitle(w).split(' · ')[0] || kindOf(w), open: `/studio/${w.id}`,
        groups: [{ title: 'Shown at', links: shownAt }, { title: 'Press', links: pressAbout }, { title: 'Awards', links: awardsFor }],
      })
    }
  }

  if (show.rights) {
    for (const w of works) {
      for (const r of w.rights ?? []) {
        if (r.status !== 'sold' || !r.year) continue
        all.push({ key: `rt${w.id}-${r.id}`, year: r.year, month: 0, kind: 'rights', label: `${w.title}, ${r.language}`, sub: r.publisher ?? 'Rights sold', dateLabel: String(r.year), open: `/studio/${w.id}` })
      }
    }
  }

  for (const p of press) {
    const kind: EventKind = p.category === 'award' ? 'award' : 'press'
    const d = parseLooseDate(p.date)
    if (!show[kind] || !d) continue
    const about = p.workId != null ? works.find(w => w.id === p.workId) : undefined
    all.push({
      key: `r${p.id}`, year: d[0], month: d[1], kind, label: p.title,
      sub: [p.type, p.outlet].filter(Boolean).join(' · ') || (kind === 'award' ? 'Award' : 'Press'), dateLabel: formatAnyDate(p.date), open: '/career/recognition',
      groups: about ? [{ title: kind === 'award' ? 'For' : 'About', links: [{ label: about.title, to: `/studio/${about.id}` }] }] : [],
      clipping: p.clipping ? p : undefined,
    })
  }

  const currentYear = new Date().getFullYear()
  const years = [...new Set([...all.map(e => e.year), currentYear])].sort((a, b) => b - a)

  const toggleKind = (k: EventKind) => setShow(s => ({ ...s, [k]: !s[k] }))
  const toggleYear = (y: number) => setCollapsed(prev => { const next = new Set(prev); next.has(y) ? next.delete(y) : next.add(y); return next })

  const isEmpty = all.length === 0

  return (
    <Shell>
      <CareerFrame active="timeline" right={
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(KIND_LABELS) as EventKind[]).map(k => (
            <button key={k} onClick={() => toggleKind(k)} aria-pressed={show[k]}
              style={{ padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11,
                background: show[k] ? 'var(--wa-ink)' : 'var(--wa-fill)', color: show[k] ? 'var(--wa-surface)' : 'var(--wa-text-2)', fontWeight: show[k] ? 600 : 400 }}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      }>

      {isEmpty ? (
        <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--wa-muted)', fontSize: 13, fontStyle: 'italic' }}>
          Add dated projects, events, works, press or awards to build your career timeline.
        </div>
      ) : narrow ? (
        <div style={{ paddingBottom: 8 }}>
          {years.filter(y => all.some(e => e.year === y)).map(year => (
            <YearList key={year} year={year} events={all.filter(e => e.year === year)} onSelect={setSelected} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '10px 6px' }}>
          {years.map((year, i) => (
            <YearRow
              key={year}
              year={year}
              events={all.filter(e => e.year === year)}
              minGap={minGap}
              measureRef={i === 0 ? chartRef : undefined}
              last={i === years.length - 1}
              collapsed={collapsed.has(year)}
              onToggle={() => toggleYear(year)}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}
      </CareerFrame>

      {selected && <EventPopup e={selected} onClose={() => setSelected(null)} />}

    </Shell>
  )
}
