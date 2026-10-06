import { type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useActiveDept } from '../../lib/useDept'

const NAV = [
  { label: 'Today', to: '/today' },
  { label: 'Projects', to: '/projects' },
  { label: 'Opportunities', to: '/opportunities' },
  { label: 'The Map', to: '/the-map' },
  { label: 'Studio', to: '/studio' },
  { label: 'Account', to: '/account' },
]

export function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const dept = useActiveDept()
  const wordmark = dept?.name?.trim() || 'Working Artist'

  return (
    <div className="mx-auto flex min-h-screen max-w-[1080px] flex-col px-5 pb-16 pt-6 sm:px-9 sm:pt-8">
      {/* Top bar */}
      <header className="mb-8 flex items-baseline justify-between">
        <button
          onClick={() => navigate('/today')}
          style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 18, color: '#111111', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {wordmark}
        </button>
        <nav className="hidden items-baseline gap-7 sm:flex">
          {NAV.map((item) => {
            const active = location.pathname === item.to || (item.to !== '/today' && location.pathname.startsWith(item.to))
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                style={{
                  fontFamily: 'Recoleta, serif',
                  fontSize: 14,
                  color: '#111111',
                  opacity: active ? 1 : 0.35,
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid #111111' : '2px solid transparent',
                  paddingBottom: 2,
                  cursor: 'pointer',
                  transition: 'opacity 0.12s',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
