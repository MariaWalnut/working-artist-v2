import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatEventDate } from '../lib/eventDates'

// Meetings about a project. They are events of the type Meeting, so they also sit in the calendar.
export function ProjectMeetings({ projectId, deptId, labelStyle, addStyle }: { projectId: number; deptId?: number; labelStyle?: React.CSSProperties; addStyle?: React.CSSProperties }) {
  const navigate = useNavigate()
  const meetings = (useLiveQuery(() => deptId == null ? [] : db.eventEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? [])
    .filter(e => e.projectIds?.includes(projectId))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={labelStyle}>Meetings</p>
        <button onClick={() => navigate(`/projects/events?new=meeting&project=${projectId}`)} style={addStyle}>+ Add</button>
      </div>
      {meetings.map(m => (
        <button key={m.id} onClick={() => navigate(`/projects/events?e=${m.id}`)} style={{ display: 'block', width: '100%', padding: '9px 0', border: 'none', borderBottom: '1px solid var(--wa-line)', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)' }}>{m.title}</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 2 }}>{[formatEventDate(m.date, m.endDate), m.time].filter(Boolean).join(' · ')}</span>
        </button>
      ))}
    </div>
  )
}
