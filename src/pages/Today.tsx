import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveDept } from '../lib/useDept'

const MOODS = [
  { key: 'flow',  label: 'Flow',  color: '#F5E642' },
  { key: 'good',  label: 'Good',  color: '#B8E0A4' },
  { key: 'tired', label: 'Tired', color: '#F8D898' },
  { key: 'busy',  label: 'Busy',  color: '#A8C8E0' },
  { key: 'hard',  label: 'Hard',  color: '#E8C4B4' },
]

const NAV = [
  { label: 'Today', to: '/today' },
  { label: 'Projects', to: '/projects' },
  { label: 'Opportunities', to: '/opportunities' },
  { label: 'The Map', to: '/the-map' },
  { label: 'Studio', to: '/studio' },
  { label: 'Account', to: '/account' },
]

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function Today() {
  const [mood, setMood] = useState('flow')
  const navigate = useNavigate()
  const dept = useActiveDept()
  const wordmark = dept?.name?.trim() || 'Working Artist'
  const bg = MOODS.find((m) => m.key === mood)?.color ?? '#F5E642'

  return (
    <div
      className="flex min-h-svh flex-col px-8 py-7 transition-colors duration-500"
      style={{ background: bg }}
    >
      {/* Date */}
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#111111', opacity: 0.4 }}>
        {todayLabel()}
      </div>

      {/* Center */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <h1 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 'clamp(40px, 7vw, 80px)', lineHeight: 1, letterSpacing: '-0.01em', color: '#111111', textAlign: 'center', margin: 0 }}>
          {wordmark}
        </h1>
        <nav className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
          {NAV.map((item) => {
            const active = item.to === '/today'
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                style={{
                  fontFamily: 'Recoleta, serif',
                  fontSize: 15,
                  color: '#111111',
                  opacity: active ? 1 : 0.4,
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '3px solid #111111' : '3px solid transparent',
                  paddingBottom: active ? 3 : 0,
                  cursor: 'pointer',
                  transition: 'opacity 0.12s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.opacity = '0.7' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.opacity = '0.4' }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Mood picker */}
      <div className="flex flex-col items-center gap-4">
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#111111', opacity: 0.4, margin: 0 }}>
          How are you today?
        </p>
        <div className="flex items-start gap-4">
          {MOODS.map((m) => (
            <button key={m.key} onClick={() => setMood(m.key)}
              className="flex flex-col items-center gap-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: m.color, flexShrink: 0,
                outline: mood === m.key ? '2px solid #111111' : '2px solid transparent',
                outlineOffset: 3,
                transition: 'transform 0.15s',
              }} />
              <span style={{ fontSize: 9, fontWeight: 500, color: '#111111', opacity: mood === m.key ? 0.7 : 0.45, whiteSpace: 'nowrap' }}>
                {m.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
