import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useActiveDept } from '../../lib/useDept'
import { demoField } from '../../lib/mode'
import { applyAccent } from '../../lib/accent'
import { DemoTips } from '../DemoTips'

const NAV = [
  { label: 'On My Desk', to: '/projects' },
  { label: 'Events', to: '/projects/events' },
  { label: 'Submissions', to: '/opportunities' },
  { label: 'Manifest', to: '/manifest' },
  { label: 'Career', to: '/career' },
  { label: 'Works', to: '/studio' },
  { label: 'Account', to: '/account' },
]

export function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const dept = useActiveDept()
  const wordmark = dept?.name?.trim() || 'Working Artist'
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => applyAccent(dept?.accent), [dept?.accent])
  const isActive = (to: string) => location.pathname === to || (to !== '/projects' && location.pathname.startsWith(to)) || (to === '/projects' && /^\/projects\/\d+/.test(location.pathname))

  return (
    <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col px-5 pb-16 pt-6 sm:px-9 sm:pt-8">
      {/* Top bar */}
      <header className="mb-8 flex items-baseline justify-between">
        <button
          onClick={() => navigate('/today')}
          style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 18, color: '#111111', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {wordmark}
          {demoField && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#AAAAAA', marginLeft: 10 }}>Demo</span>}
        </button>
        <nav className="hidden items-baseline gap-7 lg:flex">
          {NAV.map((item) => {
            const active = isActive(item.to)
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                style={{
                  fontFamily: 'Recoleta, serif',
                  fontSize: 15,
                  color: active ? '#111111' : '#C0C0C0',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
                  paddingBottom: active ? 3 : 0,
                  cursor: 'pointer',
                  transition: 'color 0.12s',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
        <button
          className="flex items-center justify-center lg:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
          style={{ width: 44, height: 44, marginRight: -12, alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            {menuOpen
              ? <path d="M3 1l12 12M15 1L3 13" stroke="#111111" strokeWidth="1.6" strokeLinecap="round" />
              : <path d="M1 1h16M1 7h16M1 13h16" stroke="#111111" strokeWidth="1.6" strokeLinecap="round" />}
          </svg>
        </button>
      </header>

      {menuOpen && (
        <nav className="lg:hidden" style={{ background: '#FFFFFF', borderRadius: 20, padding: '8px 20px', marginTop: -16, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
          {NAV.map((item, i) => {
            const active = isActive(item.to)
            return (
              <button
                key={item.to}
                onClick={() => { setMenuOpen(false); navigate(item.to) }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 48, fontFamily: 'Recoleta, serif', fontSize: 17, color: active ? '#111111' : '#888888', background: 'none', border: 'none', borderBottom: i < NAV.length - 1 ? '1px solid #F5F5F5' : 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              >
                {item.label}
                {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
              </button>
            )
          })}
        </nav>
      )}

      <main className="flex-1">{children}
      <DemoTips /></main>
    </div>
  )
}
