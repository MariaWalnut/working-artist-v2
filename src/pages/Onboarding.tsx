import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'

const PRACTICES = [
  { key: 'painter',       label: 'Visual artist' },
  { key: 'picture_books', label: 'Picture books' },
  { key: 'music',         label: 'Musician' },
  { key: 'painter',       label: 'Writer' },
  { key: 'painter',       label: 'Photographer' },
  { key: 'painter',       label: 'Performer' },
  { key: 'painter',       label: 'Other' },
]

export function Onboarding() {
  const [selected, setSelected] = useState(0)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function start() {
    setSaving(true)
    const p = PRACTICES[selected]
    await db.departments.add({
      name: name.trim() || 'Working Artist',
      discipline: p.key as 'painter' | 'picture_books' | 'music',
      createdAt: Date.now(),
    })
    navigate('/today')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#F5F5F5] px-6">
      <div className="w-full max-w-[520px] rounded-[20px] bg-white p-8 shadow-[0_4px_40px_rgba(0,0,0,.12)]">
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: 13, color: '#AAAAAA', textAlign: 'center', marginBottom: 8 }}>Working Artist</p>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 28, color: '#111111', textAlign: 'center', margin: '0 0 8px' }}>
          What is your practice?
        </h1>
        <p style={{ fontSize: 13, color: '#AAAAAA', textAlign: 'center', marginBottom: 28 }}>You can change this at any time.</p>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {PRACTICES.map((p, i) => (
            <button key={p.label} onClick={() => setSelected(i)}
              style={{
                borderRadius: 12, padding: '10px 12px', fontSize: 13, textAlign: 'left', border: 'none', cursor: 'pointer',
                background: selected === i ? '#F5E642' : '#F5F5F5',
                color: selected === i ? '#111111' : '#888888',
                fontWeight: selected === i ? 600 : 400,
              }}>
              {p.label}
            </button>
          ))}
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Studio name (optional)"
          style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '10px 14px', fontSize: 14, color: '#111111', outline: 'none', marginBottom: 16 }} />

        <button onClick={() => void start()} disabled={saving}
          style={{ width: '100%', borderRadius: 12, background: '#111111', color: '#FFFFFF', padding: '13px', fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          Get started
        </button>
      </div>
    </div>
  )
}
