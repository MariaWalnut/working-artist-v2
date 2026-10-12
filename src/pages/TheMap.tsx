import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, type DayLog } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MOODS = [
  { key: 'flow',   label: 'Flow',   color: '#F5E642' },
  { key: 'good',   label: 'Good',   color: '#B8E0A4' },
  { key: 'hard',   label: 'Hard',   color: '#E8C4B4' },
  { key: 'collab', label: 'Social', color: '#78AECB' },
]

const DAY_COLOR: Record<string, string> = Object.fromEntries(MOODS.map(m => [m.key, m.color]))

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function pad(n: number) { return String(n).padStart(2, '0') }

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function LogModal({ date, existing, onDone }: { date: string; existing: DayLog | null; onDone: () => void }) {
  const [mood, setMood] = useState(existing?.mood ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const dept = useActiveDept()

  async function save() {
    if (!mood) return
    const data = { departmentId: dept?.id, date, mood, note, dayType: mood }
    if (existing?.id) await db.dayLogs.update(existing.id, data)
    else await db.dayLogs.add(data)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 32, width: 300, boxShadow: '0 24px 64px rgba(0,0,0,.18)' }}>
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: 22, fontWeight: 400, textAlign: 'center', margin: '0 0 6px' }}>How was today?</p>
        <p style={{ fontSize: 11, color: '#AAAAAA', textAlign: 'center', margin: '0 0 24px', letterSpacing: '0.04em' }}>
          {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {MOODS.map(m => (
            <button key={m.key} onClick={() => setMood(m.key)} style={{ width: 34, height: 34, borderRadius: '50%', border: mood === m.key ? '2.5px solid #111111' : '2px solid transparent', background: m.color, cursor: 'pointer', outline: 'none' }} title={m.label} />
          ))}
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="A note… (optional)"
          style={{ width: '100%', border: 'none', borderBottom: '1px solid #EEEEEE', padding: '8px 0', fontSize: 13, fontStyle: 'italic', color: '#666666', outline: 'none', marginBottom: 24, background: 'none' }} />
        <button onClick={() => void save()} style={{ width: '100%', background: '#111111', color: '#FFFFFF', border: 'none', borderRadius: 12, padding: 13, fontFamily: 'Recoleta, serif', fontSize: 16, cursor: 'pointer' }}>That's it</button>
        <button onClick={onDone} style={{ width: '100%', background: 'none', border: 'none', marginTop: 8, fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function dayLabel(ds: string) {
  const d = new Date(ds + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function TheMap() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [logDate, setLogDate] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const logs = useLiveQuery(() => dept?.id == null ? [] : db.dayLogs.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const byDate = Object.fromEntries(logs.map(l => [l.date, l]))
  const loggedThisYear = logs.filter(l => l.date.startsWith(String(year))).length

  const years = [...new Set([...logs.map(l => Number(l.date.slice(0, 4))), today.getFullYear()])].sort()
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const logForDate = logDate ? (byDate[logDate] ?? null) : null

  return (
    <Shell>
      {logDate && <LogModal date={logDate} existing={logForDate} onDone={() => setLogDate(null)} />}

      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '22px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, margin: 0 }}>The Map</p>
          <button onClick={() => navigate('/the-map/world')} style={{ marginLeft: 12, background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '5px 12px', fontSize: 10, color: '#AAAAAA', cursor: 'pointer' }}>World</button>
          <div style={{ marginLeft: 16, display: 'flex', gap: 6 }}>
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: year === y ? '#FFFFFF' : '#EBEBEB', boxShadow: year === y ? '0 1px 6px rgba(0,0,0,.12)' : 'none', fontSize: 12, fontWeight: year === y ? 600 : 400, color: '#111111', cursor: 'pointer' }}>{y}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#AAAAAA' }}><span style={{ fontFamily: 'Recoleta, serif', fontSize: 18, color: '#111111', marginRight: 4 }}>{loggedThisYear}</span>days</span>
            <button onClick={() => setLogDate(todayStr)} style={{ background: '#F5E642', borderRadius: 999, padding: '7px 16px', border: 'none', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Log today</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
          {MONTHS.flatMap((m, mi) => {
            const count = daysInMonth(year, mi)
            const label = (
              <span key={`lbl-${m}`}
                style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 5px', height: 29, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {m}
              </span>
            )
            const days = Array.from({ length: count }, (_, i) => {
              const d = i + 1
              const ds = dateStr(year, mi, d)
              const log = byDate[ds]
              const isToday = ds === todayStr
              const isFuture = ds > todayStr
              let bg = 'transparent'
              let border = '1.5px solid #E8E8E8'
              if (isFuture) { bg = '#F6F6F6'; border = '1px solid #F0F0F0' }
              else if (log) { bg = DAY_COLOR[log.dayType ?? log.mood ?? ''] ?? '#EEEEEE'; border = 'none' }
              return (
                <div key={ds} style={{ position: 'relative', flexShrink: 0 }}
                  onMouseEnter={() => !isFuture && setHovered(ds)}
                  onMouseLeave={() => setHovered(null)}>
                  {hovered === ds && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#111111', color: '#FFFFFF', fontSize: 10, fontWeight: 500, borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>
                      {dayLabel(ds)}
                      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #111111' }} />
                    </div>
                  )}
                  <button onClick={() => !isFuture && setLogDate(ds)}
                    style={{ width: 29, height: 29, borderRadius: '50%', background: bg, border, boxShadow: isToday ? '0 0 0 2px #111111' : 'none', cursor: isFuture ? 'default' : 'pointer', display: 'block' }} />
                </div>
              )
            })
            return [label, ...days]
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24, paddingTop: 18, borderTop: '1px solid #F5F5F5', alignItems: 'center' }}>
          {MOODS.map(m => (
            <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
              <span style={{ fontSize: 10, color: '#888888' }}>{m.label}</span>
            </div>
          ))}
        </div>

      </div>
    </Shell>
  )
}
