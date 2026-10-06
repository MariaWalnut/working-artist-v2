import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Shell } from '../components/layout/Shell'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pid = Number(id)

  const project = useLiveQuery(() => db.projects.get(pid), [pid])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (project === undefined) return null
  if (project === null) { navigate('/projects', { replace: true }); return null }

  function startEdit() {
    setTitle(project!.title)
    setNotes(project!.notes ?? '')
    setStatus(project!.status ?? 'Active')
    setEditing(true)
  }

  async function saveEdit() {
    await db.projects.update(pid, { title: title.trim() || project!.title, notes, status })
    setEditing(false)
  }

  async function deleteProject() {
    await db.projects.delete(pid)
    navigate('/projects', { replace: true })
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%' }

  return (
    <Shell>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px' }}>
        {/* Back */}
        <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer', padding: 0, marginBottom: 20, letterSpacing: '0.06em' }}>
          ← Projects
        </button>

        {editing ? (
          <div>
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inp, fontSize: 22, fontFamily: 'Recoleta, serif', marginBottom: 12 }} />
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, marginBottom: 12, maxWidth: 200 }}>
              {['Active', 'Completed', 'On hold', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes…" rows={6}
              style={{ ...inp, resize: 'vertical', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void saveEdit()} style={{ background: '#F5E642', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 28, fontWeight: 400, margin: 0, color: '#111111' }}>{project.title}</h1>
              <button onClick={startEdit} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 10, color: '#888888', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>Edit</button>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              {project.projectType && <span style={{ fontSize: 11, color: '#AAAAAA' }}>{project.projectType}</span>}
              {project.location && <span style={{ fontSize: 11, color: '#AAAAAA' }}>{project.location}</span>}
              {(project.dateStart || project.dateEnd) && (
                <span style={{ fontSize: 11, color: '#AAAAAA' }}>
                  {[project.dateStart, project.dateEnd].filter(Boolean).join(' – ')}
                </span>
              )}
              {project.status && (
                <span style={{ fontSize: 11, background: '#F5F5F5', borderRadius: 999, padding: '3px 10px', color: '#666666' }}>{project.status}</span>
              )}
            </div>

            {project.notes ? (
              <p style={{ fontSize: 14, color: '#444444', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '0 0 32px' }}>{project.notes}</p>
            ) : (
              <p style={{ fontSize: 13, color: '#CCCCCC', fontStyle: 'italic', margin: '0 0 32px' }}>No notes yet. <button onClick={startEdit} style={{ background: 'none', border: 'none', fontSize: 13, color: '#AAAAAA', cursor: 'pointer', padding: 0, fontStyle: 'italic' }}>Add one →</button></p>
            )}

            <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 20 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 10, padding: '8px 14px', fontSize: 11, color: '#CCCCCC', cursor: 'pointer' }}>Delete project…</button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#888888' }}>Delete this project?</span>
                  <button onClick={() => void deleteProject()} style={{ background: '#E05252', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
