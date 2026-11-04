import { useState } from 'react'
import type { EventEntry } from '../db/db'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SHOWN_PER_DAY = 3

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// One month. Events sit on their days, across all of them if they run longer. Events that only
// have a month sit above the grid. Clicking an empty part of a day adds an event on it.
export function EventCalendar({ events, narrow, dot, onOpen, onDay }: {
  events: EventEntry[]
  narrow: boolean
  dot: (e: EventEntry) => string
  onOpen: (e: EventEntry) => void
  onDay: (date: string) => void
}) {
  const now = new Date()
  const [shown, setShown] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const today = iso(now)
  const monthKey = iso(shown).slice(0, 7)

  const first = new Date(shown.getFullYear(), shown.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7)) // back to Monday
  const last = new Date(shown.getFullYear(), shown.getMonth() + 1, 0)
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })

  const onDate = (e: EventEntry, day: string) => {
    if (!e.date || e.date.length < 10) return false
    const end = e.endDate && e.endDate.length >= 10 ? e.endDate : e.date
    return e.date <= day && day <= end
  }
  const byTime = (a: EventEntry, b: EventEntry) => (a.time ?? '').localeCompare(b.time ?? '')
  const wholeMonth = events.filter(e => e.date?.length === 7 && e.date === monthKey)

  const move = (by: number) => setShown(new Date(shown.getFullYear(), shown.getMonth() + by, 1))
  const nav: React.CSSProperties = { width: 28, height: 28, padding: 0, border: 'none', borderRadius: 8, background: 'none', fontSize: 15, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ padding: narrow ? '12px 10px 14px' : '14px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <span style={{ fontFamily: 'Recoleta, serif', fontSize: 20, color: 'var(--wa-ink)', marginRight: 'auto' }}>{shown.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setShown(new Date(now.getFullYear(), now.getMonth(), 1))} style={{ ...nav, width: 'auto', padding: '0 8px', fontSize: 11 }}>Today</button>
        <button onClick={() => move(-1)} aria-label="Previous month" style={nav}>‹</button>
        <button onClick={() => move(1)} aria-label="Next month" style={nav}>›</button>
      </div>

      {wholeMonth.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {wholeMonth.map(e => <button key={e.id} onClick={() => onOpen(e)} style={{ padding: '3px 10px', border: 'none', borderRadius: 999, background: 'var(--wa-fill)', fontSize: 11, color: 'var(--wa-text)', cursor: 'pointer', fontFamily: 'inherit' }}>{e.title}</button>)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: '1px solid var(--wa-line)', borderLeft: '1px solid var(--wa-line)' }}>
        {WEEKDAYS.map(d => <div key={d} style={{ padding: '6px 6px', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wa-muted)', borderRight: '1px solid var(--wa-line)', borderBottom: '1px solid var(--wa-line)' }}>{narrow ? d.charAt(0) : d}</div>)}
        {days.map(d => {
          const day = iso(d)
          const inMonth = d.getMonth() === shown.getMonth()
          const here = events.filter(e => onDate(e, day)).sort(byTime)
          return (
            <div key={day} onClick={() => onDay(day)} style={{ minWidth: 0, minHeight: narrow ? 62 : 96, padding: narrow ? 3 : 5, boxSizing: 'border-box', borderRight: '1px solid var(--wa-line)', borderBottom: '1px solid var(--wa-line)', background: inMonth ? 'none' : 'var(--wa-fill-2)', cursor: 'pointer' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: day === today ? 'var(--accent)' : 'none', fontSize: 11, fontWeight: day === today ? 600 : 400, color: day === today ? '#111111' : inMonth ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>{d.getDate()}</span>
              {here.slice(0, SHOWN_PER_DAY).map(e => (
                <button key={e.id} onClick={ev => { ev.stopPropagation(); onOpen(e) }} title={e.title}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '1px 2px', border: 'none', borderRadius: 4, background: 'none', fontSize: narrow ? 9 : 11, lineHeight: 1.3, color: 'var(--wa-ink)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: dot(e) }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.time && !narrow ? `${e.time} ` : ''}{e.title}</span>
                </button>
              ))}
              {here.length > SHOWN_PER_DAY && <span style={{ display: 'block', padding: '0 2px', fontSize: 10, color: 'var(--wa-muted)' }}>{here.length - SHOWN_PER_DAY} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
