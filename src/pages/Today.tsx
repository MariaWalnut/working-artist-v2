import { useNavigate } from 'react-router-dom'
import { useActiveDept } from '../lib/useDept'

const DAILY = [
  'Rest is part of the work.',    // Sunday
  'New week. New work.',          // Monday
  'One thing at a time.',         // Tuesday
  'You\'re in it.',               // Wednesday
  'Keep the momentum.',           // Thursday
  'Finish strong.',               // Friday
  'The studio is always open.',   // Saturday
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
  const navigate = useNavigate()
  const dept = useActiveDept()
  const wordmark = dept?.name?.trim() || 'Working Artist'
  const phrase = DAILY[new Date().getDay()]

  return (
    <div className="flex min-h-svh flex-col px-8 py-7" style={{ background: '#F5E642' }}>
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

      {/* Daily phrase */}
      <div className="flex justify-center">
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: '#111111', opacity: 0.45, margin: 0, textAlign: 'center' }}>
          {phrase}
        </p>
      </div>
    </div>
  )
}
