import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

// ─── Event model ─────────────────────────────────────────────────────────────

type EventKind = 'project' | 'work' | 'book' | 'release'

interface CareerEvent {
  key: string
  year: number
  month: number // 1–12, or 0 = year only
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

function monthLabel(month: number, year: number): string {
  if (month < 1) return String(year)
  return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// ─── Kind config ─────────────────────────────────────────────────────────────

const KIND_DOT: Record<EventKind, string> = {
  project: '#111111',
  work: '#AAAAAA',
  book: '#888888',
  release: '#BBBBBB',
}

const KIND_LABELS: Record<EventKind, string> = {
  project: 'Projects',
  work: 'Works',
  book: 'Books',
  release: 'Releases',
}

// ─── Event detail popup ───────────────────────────────────────────────────────

function EventPopup({ e, onClose }: { e: CareerEvent; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px', maxWidth: 420, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.18)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 10px' }}>{e.kind} · {monthLabel(e.month, e.year)}</p>
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
  const [selected, setSelected] = useState<CareerEvent | null>(null)

  const toggleKind = (k: EventKind) => setShow(s => ({ ...s, [k]: !s[k] }))

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

  // Group by year, most recent first; within each year sort by month desc
  const years = [...new Set(all.map(e => e.year))].sort((a, b) => b - a)

  const isEmpty = all.length === 0

  return (
    <Shell>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {years.map((year, yi) => {
            const events = all
              .filter(e => e.year === year)
              .sort((a, b) => (b.month || 0) - (a.month || 0))
            return (
              <div key={year} style={{ display: 'flex', gap: 0, paddingTop: yi > 0 ? 0 : 0 }}>
                {/* Year label column */}
                <div style={{ width: 68, flexShrink: 0, paddingTop: 22 }}>
                  <span style={{ fontFamily: 'Recoleta, serif', fontSize: 18, color: '#DDDDDD', fontWeight: 400 }}>{year}</span>
                </div>

                {/* Events card */}
                <div style={{ flex: 1, background: '#FFFFFF', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 12, overflow: 'hidden' }}>
                  {events.map((e, ei) => (
                    <button
                      key={e.key}
                      onClick={() => setSelected(e)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                        padding: '14px 20px',
                        borderBottom: ei < events.length - 1 ? '1px solid #F5F5F5' : 'none',
                        background: 'none', border: 'none',
                        borderBottomColor: ei < events.length - 1 ? '#F5F5F5' : 'transparent',
                        borderBottomWidth: ei < events.length - 1 ? 1 : 0,
                        borderBottomStyle: 'solid',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: KIND_DOT[e.kind], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: '#111111', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                        <span style={{ fontSize: 10, color: '#BBBBBB', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{e.sub}</span>
                      </div>
                      {e.month > 0 && (
                        <span style={{ fontSize: 10, color: '#CCCCCC', flexShrink: 0, letterSpacing: '0.02em' }}>
                          {new Date(e.year, e.month - 1).toLocaleDateString('en-GB', { month: 'short' })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && <EventPopup e={selected} onClose={() => setSelected(null)} />}
    </Shell>
  )
}
