import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type DayLog } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DAY_TYPES = [
  { key: 'flow',        label: 'Flow',        color: '#F5E642' },
  { key: 'achievement', label: 'Achievement', color: '#8BC87A' },
  { key: 'star',        label: 'Star',        color: '#F0A840' },
  { key: 'collab',      label: 'Collab',      color: '#78AECB' },
  { key: 'connection',  label: 'Connection',  color: '#B898D8' },
  { key: 'stressful',   label: 'Stressful',   color: '#D4907A' },
]

const DAY_COLOR: Record<string, string> = Object.fromEntries(DAY_TYPES.map(d => [d.key, d.color]))

const LOG_MOODS = [
  { key: 'flow',    label: 'Flow',   color: '#F5E642' },
  { key: 'good',    label: 'Good',   color: '#B8E0A4' },
  { key: 'hard',    label: 'Hard',   color: '#E8C4B4' },
  { key: 'collab',  label: 'Social', color: '#78AECB' },
]

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
          {LOG_MOODS.map(m => (
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

export function TheMap() {
  const dept = useActiveDept()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [logDate, setLogDate] = useState<string | null>(null)

  const logs = useLiveQuery(() => dept?.id == null ? [] : db.dayLogs.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const byDate = Object.fromEntries(logs.map(l => [l.date, l]))
  const loggedThisYear = logs.filter(l => l.date.startsWith(String(year))).length

  const years = [...new Set([...logs.map(l => Number(l.date.slice(0, 4))), today.getFullYear()])].sort()
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const logForDate = logDate ? (byDate[logDate] ?? null) : null

  const streakDays = (() => {
    let s = 0
    const d = new Date(today)
    while (true) {
      const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate())
      if (!byDate[ds]) break
      s++
      d.setDate(d.getDate() - 1)
    }
    return s
  })()

  return (
    <Shell>
      {logDate && <LogModal date={logDate} existing={logForDate} onDone={() => setLogDate(null)} />}

      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '22px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, margin: 0 }}>The Map</p>
          <div style={{ marginLeft: 16, display: 'flex', gap: 6 }}>
            {years.map(y => (
              <button key={y} onClick={() => setYear(y)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: year === y ? '#FFFFFF' : '#EBEBEB', boxShadow: year === y ? '0 1px 6px rgba(0,0,0,.12)' : 'none', fontSize: 12, fontWeight: year === y ? 600 : 400, color: '#111111', cursor: 'pointer' }}>{y}</button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#AAAAAA' }}><span style={{ fontFamily: 'Recoleta, serif', fontSize: 18, color: '#111111', marginRight: 4 }}>{loggedThisYear}</span>days</span>
            {streakDays > 0 && <span style={{ fontSize: 11, color: '#AAAAAA' }}><span style={{ fontFamily: 'Recoleta, serif', fontSize: 18, color: '#F0A840', marginRight: 4 }}>{streakDays}</span>streak</span>}
            <button onClick={() => setLogDate(todayStr)} style={{ background: '#F5E642', borderRadius: 999, padding: '7px 16px', border: 'none', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>+ Log today</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {MONTHS.map((m, mi) => {
            const count = daysInMonth(year, mi)
            const firstDow = new Date(year, mi, 1).getDay()
            return (
              <div key={m} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.06em', textTransform: 'uppercase', height: 29, display: 'flex', alignItems: 'center' }}>{m}</span>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {Array.from({ length: firstDow }, (_, i) => (
                    <div key={`e${i}`} style={{ width: 29, height: 29, flexShrink: 0 }} />
                  ))}
                  {Array.from({ length: count }, (_, i) => {
                    const d = i + 1
                    const ds = dateStr(year, mi, d)
                    const log = byDate[ds]
                    const isToday = ds === todayStr
                    const isFuture = ds > todayStr
                    const isLogged = !!log
                    let bg = 'transparent'
                    let border = '1.5px solid #E8E8E8'
                    if (isFuture) { bg = '#F6F6F6'; border = '1px solid #F0F0F0' }
                    else if (isLogged) { bg = DAY_COLOR[log.dayType ?? log.mood] ?? '#EEEEEE'; border = 'none' }
                    return (
                      <button key={d} onClick={() => !isFuture && setLogDate(ds)} title={ds}
                        style={{ width: 29, height: 29, borderRadius: '50%', flexShrink: 0, background: bg, border, outline: isToday ? '2.5px solid #111111' : 'none', outlineOffset: 2, cursor: isFuture ? 'default' : 'pointer' }} />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24, paddingTop: 18, borderTop: '1px solid #F5F5F5', alignItems: 'center' }}>
          {DAY_TYPES.map(t => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }} />
              <span style={{ fontSize: 10, color: '#888888' }}>{t.label}</span>
            </div>
          ))}
        </div>

        {logs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
            {DAY_TYPES.slice(0, 3).map(t => {
              const c = logs.filter(l => (l.dayType ?? l.mood) === t.key).length
              return (
                <div key={t.key} style={{ background: '#FAFAFA', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, marginBottom: 8 }} />
                  <p style={{ fontFamily: 'Recoleta, serif', fontSize: 22, margin: '0 0 2px', color: '#111111' }}>{c}</p>
                  <p style={{ fontSize: 10, color: '#AAAAAA', margin: 0 }}>{t.label} days</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}
