import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

const TABS = [
  { key: 'timeline', label: 'Timeline', to: '/career' },
  { key: 'map', label: 'Map', to: '/career/map' },
  { key: 'recognition', label: 'Recognition', to: '/career/recognition' },
] as const

export function CareerTabs({ active, right }: { active: typeof TABS[number]['key']; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div role="tablist" aria-label="Career" style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => navigate(t.to)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Recoleta, serif', fontSize: 24, color: active === t.key ? '#111111' : '#C8C8C8' }}>
            {t.label}
          </button>
        ))}
      </div>
      {right}
    </div>
  )
}
