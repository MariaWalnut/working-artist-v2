import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import type { Activity } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { practiceOf, usePractice } from '../lib/practice'
import { projectTypeOptions, useCustomCategories } from '../lib/categories'
import { PracticeSelect } from './Practice'

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '9px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', fontFamily: 'inherit' }

const FIRST_TYPE: Partial<Record<Activity, string>> = { filmmaker: 'Film', musician: 'Release', writer: 'Books', picture_book: 'Books' }

// Title and type are all a project needs to start. The rest is filled in on its page.
export function NewProjectForm({ onDone, status = 'Active', from }: { onDone: () => void; status?: string; from?: string }) {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const { acts, multi, start } = usePractice()
  const [chosenPractice, setPractice] = useState<Activity | undefined>()
  const practice = chosenPractice ?? start
  const [title, setTitle] = useState('')
  // Worked out each render: the studio may still be loading when the form opens.
  const [chosenType, setType] = useState<string | undefined>()
  const type = chosenType ?? FIRST_TYPE[start ?? acts[0]] ?? 'Exhibition'
  const [customType, setCustomType] = useState('')
  const custom = useCustomCategories()

  async function save() {
    if (!title.trim()) return
    const projectType = type === 'Other' ? (customType.trim() || 'Other') : type
    const id = await db.projects.add({ departmentId: dept?.id, title: title.trim(), projectType, status, practice })
    onDone()
    navigate(`/projects/${id}`, from ? { state: { from } } : undefined)
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void save() }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title" style={{ ...inp, fontFamily: 'Recoleta, serif', fontSize: 16 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={type} onChange={e => { setType(e.target.value); setCustomType('') }} aria-label="Type" style={inp}>
          {projectTypeOptions(custom).map(t => <option key={t}>{t}</option>)}
        </select>
        {multi && <PracticeSelect value={practice ?? practiceOf(acts).project({ projectType: type })} onChange={setPractice} style={inp} />}
      </div>
      {type === 'Other' && <input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="Type, e.g. Installation" aria-label="Type name" style={inp} />}
      <button type="submit" style={{ alignSelf: 'flex-start', marginTop: 4, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 11, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
    </form>
  )
}
